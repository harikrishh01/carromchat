/**
 * Online shot animation using real Matter.js physics (same as offline mode).
 *
 * Both clients receive shotParams { angle, power, strikerX } from the server
 * broadcast, load the pre-shot board state into ClientPhysics, and run the
 * identical simulation so everyone sees the same realistic movement.
 * When physics completes, the server's authoritative final state is applied
 * to correct any floating-point divergence.
 */
import { ClientPhysics } from '../physics/ClientPhysics.js';
import { useGameStore } from '../store/gameStore.js';
import { POCKET } from '../constants/gameConstants.js';

class OnlineAnimator {
  constructor() {
    this.physics = null;
  }

  /** Called in OnlineGame useEffect on mount. */
  init() {
    this.destroy();
    this.physics = new ClientPhysics();
  }

  /** Called in OnlineGame useEffect cleanup. */
  destroy() {
    this.physics?.stopSimulation();
    this.physics?.destroy();
    this.physics = null;
  }

  /**
   * Simulate the shot with real physics then apply authoritative server state.
   * @param {object|null} shotParams - { angle, power, strikerX } — null = fallback
   * @param {object} serverState - final authoritative state from server
   * @param {string|null} foul
   * @param {object} sound - useSoundManager() result
   * @param {function} onDone
   */
  run(shotParams, serverState, foul, sound, onDone) {
    const preState = useGameStore.getState();
    const physics  = this.physics;

    // Fallback: no physics or no params — apply final state immediately
    if (!physics || !shotParams) {
      preState.applyResult(serverState);
      if (serverState.lastFoul) sound?.playFoul();
      if (serverState.winner)   sound?.playWin();
      onDone?.();
      return;
    }

    useGameStore.setState({ isSimulating: true });
    physics.loadState(preState.coins, {
      x: shotParams.strikerX,
      y: preState.strikerPos.y,
    });

    physics.shoot(shotParams.angle, shotParams.power, {
      onPocketed: (id, pos) => {
        sound?.playPocket();
        // Hide coin immediately so it doesn't ghost
        useGameStore.setState(s => ({
          coins: s.coins.map(c => c.id === id ? { ...c, pocketed: true } : c),
        }));
        // Pocket VFX
        const coinData = useGameStore.getState().coins.find(c => c.id === id);
        const nearest  = POCKET.POSITIONS.reduce((best, p) => {
          const d = Math.hypot(p.x - pos.x, p.y - pos.y);
          return d < best.d ? { p, d } : best;
        }, { p: POCKET.POSITIONS[0], d: Infinity }).p;
        useGameStore.getState().addPocketAnimation({
          id: `${id}_${Date.now()}`,
          coinId: id,
          color: coinData?.color ?? 'black',
          isQueen: id === 'queen',
          x: pos.x,       y: pos.y,
          pocketX: nearest.x, pocketY: nearest.y,
          startTime: Date.now(),
          duration: 350,
        });
      },

      onTick: (snapshot) => {
        const strikerSnap = snapshot.find(s => s.id === 'striker');
        const coinSnap    = snapshot.filter(s => s.id !== 'striker');
        const cur = useGameStore.getState().coins;
        useGameStore.setState({
          coins: cur.map(c => {
            const live = coinSnap.find(s => s.id === c.id);
            return live ? { ...c, x: live.x, y: live.y } : c;
          }),
          liveStrikerPos: strikerSnap
            ? { x: strikerSnap.x, y: strikerSnap.y }
            : null,
        });
      },

      onComplete: () => {
        useGameStore.setState({ liveStrikerPos: null });
        useGameStore.getState().applyResult(serverState);
        if (serverState.lastFoul) sound?.playFoul();
        if (serverState.winner)   sound?.playWin();
        onDone?.();
      },
    });
  }
}

/** Singleton — one physics instance per online game session. */
export const onlineAnimator = new OnlineAnimator();
