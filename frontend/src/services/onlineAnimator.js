/**
 * Module-level singleton for online shot animation.
 *
 * Why a singleton instead of React state/refs:
 *  - Lives completely outside React's render lifecycle
 *  - Initialized once when OnlineGame mounts, destroyed on unmount
 *  - Called directly from the socket event handler with zero indirection
 *  - Mirrors exactly how useOfflineGame.js manages ClientPhysics
 */
import { ClientPhysics } from '../physics/ClientPhysics.js';
import { useGameStore } from '../store/gameStore.js';
import { POCKET } from '../constants/gameConstants.js';

class OnlineAnimator {
  constructor() {
    this.physics = null;
  }

  /** Call in OnlineGame's useEffect mount. */
  init() {
    this.destroy();
    this.physics = new ClientPhysics();
  }

  /** Call in OnlineGame's useEffect cleanup. */
  destroy() {
    this.physics?.stopSimulation();
    this.physics?.destroy();
    this.physics = null;
  }

  /**
   * Run physics animation for a shot received from the server.
   * @param {object} shotParams - { angle, power, strikerX } from the server broadcast
   * @param {object} serverState - final authoritative state from server
   * @param {string|null} foul
   * @param {object} sound - from useSoundManager()
   * @param {function} onDone - called when animation completes
   */
  run(shotParams, serverState, foul, sound, onDone) {
    const preState = useGameStore.getState();
    const physics  = this.physics;

    if (!physics || !shotParams) {
      // Fallback: no physics — apply server state directly
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
        const nearest = POCKET.POSITIONS.reduce((best, p) => {
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
        // Apply server's authoritative final state
        useGameStore.getState().applyResult(serverState);
        if (serverState.lastFoul) sound?.playFoul();
        if (serverState.winner)   sound?.playWin();
        onDone?.();
      },
    });
  }
}

/** Singleton instance — shared across all online game sessions. */
export const onlineAnimator = new OnlineAnimator();
