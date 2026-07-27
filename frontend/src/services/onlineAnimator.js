/**
 * Online shot animation using direct tweening (no client-side physics).
 *
 * Why tweening instead of ClientPhysics:
 *  - ClientPhysics.shoot() has its own requestAnimationFrame loop which runs
 *    AFTER the GameCanvas render loop each frame → 1-frame lag per update.
 *    In online mode (with network latency), this makes animation imperceptible.
 *  - This tween drives requestAnimationFrame directly, updating Zustand
 *    BEFORE each canvas render within the same rAF cycle.
 *  - The server already computed the authoritative final positions; we just
 *    animate smoothly from current positions to those final positions.
 */
import { useGameStore } from '../store/gameStore.js';
import { POCKET, BOARD, STRIKER_LINE } from '../constants/gameConstants.js';

const ANIM_DURATION = 1400; // ms  — clearly visible even on slow connections

// Ease-in-out cubic for natural feel
function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

class OnlineAnimator {
  constructor() {
    this._rafId  = null;
  }

  /** Called in OnlineGame useEffect on mount. */
  init() {
    this._cancel();
  }

  /** Called in OnlineGame useEffect cleanup. */
  destroy() {
    this._cancel();
    useGameStore.setState({ liveStrikerPos: null, isSimulating: false });
  }

  _cancel() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Animate from current board state to the server's final state.
   * @param {object} shotParams - { angle, power, strikerX }
   * @param {object} serverState - final authoritative state from server
   * @param {string|null} foul
   * @param {object} sound - useSoundManager() result
   * @param {function} onDone
   */
  run(shotParams, serverState, foul, sound, onDone) {
    this._cancel();

    const preState   = useGameStore.getState();
    const startCoins = preState.coins.map(c => ({ ...c })); // snapshot pre-shot

    useGameStore.setState({ isSimulating: true });

    // Striker start position
    const strikerStartX = shotParams?.strikerX ?? preState.strikerPos.x;
    const strikerStartY = preState.strikerPos.y;

    // ── Use actual shot angle so striker moves in the CORRECT direction ──────
    // If shotParams is missing, infer angle from striker toward board center
    const angle = shotParams?.angle
      ?? Math.atan2(BOARD.CENTER - strikerStartY, BOARD.CENTER - strikerStartX);
    const power     = shotParams?.power ?? 50;
    const vMag      = power * 0.25;

    // Striker travels in shot direction for a distance proportional to power
    // Clamp so it doesn't leave board visuals
    const travelDist = Math.min(550, Math.max(80, vMag * 32));
    const strikerEndX = strikerStartX + Math.cos(angle) * travelDist;
    const strikerEndY = strikerStartY + Math.sin(angle) * travelDist;

    // Coins that will be pocketed this shot
    const finalCoinIds = new Set(serverState.coins.filter(c => !c.pocketed).map(c => c.id));
    const toBePocketed = startCoins.filter(c => !c.pocketed && !finalCoinIds.has(c.id));

    // Pre-calculate pocket targets for pocketed coins
    const pocketTargets = new Map();
    toBePocketed.forEach(coin => {
      const nearest = POCKET.POSITIONS.reduce((best, p) => {
        const d = Math.hypot(p.x - coin.x, p.y - coin.y);
        return d < best.d ? { p, d } : best;
      }, { p: POCKET.POSITIONS[0], d: Infinity }).p;
      pocketTargets.set(coin.id, nearest);
    });

    let pocketSoundPlayed = false;
    const startTime = performance.now();

    const frame = (now) => {
      const elapsed = now - startTime;
      const rawT    = Math.min(elapsed / ANIM_DURATION, 1);

      // ── Striker ────────────────────────────────────────────────────────────
      // Phase 0 → 0.45 : striker rushes forward in the ACTUAL shot direction (ease-out = fast then slow)
      // Phase 0.45 → 0.70 : striker decelerates / impact zone
      // Phase > 0.70 : striker disappears (liveStrikerPos = null)
      let liveStrikerPos = null;
      if (rawT < 0.70) {
        // ease-out: fast start, slow end — feels like being fired
        const easeOut = (t) => 1 - Math.pow(1 - t, 3);
        const strikerT = rawT < 0.45
          ? easeOut(rawT / 0.45)                                   // rush forward
          : 1 - easeInOut((rawT - 0.45) / 0.25) * 0.25;           // slight bounce-back
        liveStrikerPos = {
          x: strikerStartX + (strikerEndX - strikerStartX) * strikerT,
          y: strikerStartY + (strikerEndY - strikerStartY) * strikerT,
        };
      }

      // ── Coins ──────────────────────────────────────────────────────────────
      // Striker hits ~45% into animation → coins start moving then
      // Phase 0 → 0.40 : coins stationary (striker is still approaching)
      // Phase 0.40 → 1.0 : coins scatter to server final positions
      const coinPhaseStart = 0.38;
      const coinT = rawT < coinPhaseStart
        ? 0
        : easeInOut((rawT - coinPhaseStart) / (1 - coinPhaseStart));

      const animCoins = startCoins.map(coin => {
        if (coin.pocketed) return coin; // already pocketed before this shot

        // Coin to be pocketed: animate toward pocket
        if (pocketTargets.has(coin.id)) {
          const pocket = pocketTargets.get(coin.id);
          if (coinT > 0.1 && !pocketSoundPlayed) {
            sound?.playPocket();
            pocketSoundPlayed = true;
          }
          if (coinT >= 0.5 && rawT >= coinPhaseStart) {
            // Spawn pocket animation once
            if (!coin._vfxSpawned) {
              coin._vfxSpawned = true;
              useGameStore.getState().addPocketAnimation({
                id: `${coin.id}_online`,
                coinId: coin.id,
                color: coin.color,
                isQueen: coin.id === 'queen',
                x: coin.x, y: coin.y,
                pocketX: pocket.x, pocketY: pocket.y,
                startTime: performance.now(),
                duration: 350,
              });
            }
            // Mark visually pocketed so board hides it
            return { ...coin, pocketed: true };
          }
          return {
            ...coin,
            x: coin.x + (pocket.x - coin.x) * coinT,
            y: coin.y + (pocket.y - coin.y) * coinT,
          };
        }

        // Regular coin: tween to final server position
        const target = serverState.coins.find(tc => tc.id === coin.id);
        if (!target) return coin;
        return {
          ...coin,
          x: coin.x + (target.x - coin.x) * coinT,
          y: coin.y + (target.y - coin.y) * coinT,
        };
      });

      useGameStore.setState({ coins: animCoins, liveStrikerPos });

      if (rawT < 1) {
        this._rafId = requestAnimationFrame(frame);
      } else {
        // Animation done — apply authoritative server state
        useGameStore.setState({ liveStrikerPos: null });
        useGameStore.getState().applyResult(serverState);
        if (serverState.lastFoul) sound?.playFoul();
        if (serverState.winner)   sound?.playWin();
        onDone?.();
        this._rafId = null;
      }
    };

    this._rafId = requestAnimationFrame(frame);
  }
}

export const onlineAnimator = new OnlineAnimator();
