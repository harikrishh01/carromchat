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

    // Tween always runs — no shotParams needed, animation goes from current → serverState
    useGameStore.setState({ isSimulating: true });

    // Striker start — use shotParams.strikerX if available, else current baseline centre
    const strikerStartX = shotParams?.strikerX ?? preState.strikerPos.x;
    const strikerStartY = preState.strikerPos.y;

    // Striker arcs ~55% of the way to board centre then fades out
    const strikerMidX = strikerStartX + (BOARD.CENTER - strikerStartX) * 0.55;
    const strikerMidY = strikerStartY + (BOARD.CENTER - strikerStartY) * 0.55;

    useGameStore.setState({ isSimulating: true });

    // Coins that will be pocketed (present in preState but missing in serverState)
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
      const t       = easeInOut(rawT);

      // ── Striker ──────────────────────────────────────────────────────────
      // Phase 0→0.4: move toward impact zone
      // Phase 0.4→0.7: rebound / slow down
      // Phase 0.7→1: fade out (return null → baseline)
      let liveStrikerPos = null;
      if (rawT < 0.65) {
        const strikerT = rawT < 0.4
          ? easeInOut(rawT / 0.4)           // accelerate toward impact
          : easeInOut(1 - (rawT - 0.4) / 0.25); // decelerate away
        liveStrikerPos = {
          x: strikerStartX + (strikerMidX - strikerStartX) * strikerT,
          y: strikerStartY + (strikerMidY - strikerStartY) * strikerT,
        };
      }

      // ── Coins ─────────────────────────────────────────────────────────────
      // Phase 0→0.3: coins mostly static (striker still moving)
      // Phase 0.3→1: coins scatter to final positions
      const coinPhaseStart = 0.25;
      const coinT = rawT < coinPhaseStart
        ? 0
        : easeInOut((rawT - coinPhaseStart) / (1 - coinPhaseStart));

      const animCoins = startCoins.map(coin => {
        if (coin.pocketed) return coin; // already pocketed before shot

        // Coin to be pocketed: animate toward pocket
        if (pocketTargets.has(coin.id)) {
          const pocket = pocketTargets.get(coin.id);
          if (rawT >= coinPhaseStart && !pocketSoundPlayed) {
            sound?.playPocket();
            pocketSoundPlayed = true;
            // Spawn pocket VFX when coin is ~50% of the way in
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
