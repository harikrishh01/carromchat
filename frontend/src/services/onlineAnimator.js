/**
 * Online shot animation â€” client-side prediction + server reconciliation.
 *
 * SHOOTER: animation starts IMMEDIATELY when they fire (zero delay, same as
 *          offline mode). When shot_result arrives the server's authoritative
 *          final state is applied once animation completes.
 *
 * RECEIVER: animation starts when shot_result arrives (~200ms after shot
 *           with the optimised server PhysicsEngine). Full physics, same feel.
 */
import { ClientPhysics } from '../physics/ClientPhysics.js';
import { useGameStore } from '../store/gameStore.js';
import { POCKET } from '../constants/gameConstants.js';

class OnlineAnimator {
  constructor() {
    this.physics   = null;
    this._running  = false;   // true while local animation is active
    this._pending  = null;    // server result buffered until animation ends
  }

  init() {
    this.destroy();
    this.physics  = new ClientPhysics();
    this._running = false;
    this._pending = null;
  }

  destroy() {
    this.physics?.stopSimulation();
    this.physics?.destroy();
    this.physics  = null;
    this._running = false;
    this._pending = null;
    useGameStore.setState({ liveStrikerPos: null, isSimulating: false });
  }

  // â”€â”€ Called immediately when SHOOTER fires â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Starts physics right away â€” no server round-trip wait, zero felt delay.
  startLocal(shotParams, sound) {
    if (!this.physics || !shotParams) return;
    this._running = true;
    this._pending = null;
    this._runPhysics(shotParams, null, sound, () => {
      // Physics done; apply buffered server result if it arrived already
      if (this._pending) {
        const { serverState, foul, s, onDone } = this._pending;
        this._pending = null;
        this._applyServerState(serverState, foul, s, onDone);
      }
      // Otherwise applyServerState will be called by handleServerResult
    });
  }

  // â”€â”€ Called when shot_result arrives (both shooter & receiver) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  handleServerResult(shotParams, serverState, foul, sound, onDone) {
    if (this._running) {
      // SHOOTER: animation already running â€” buffer result for when it ends
      this._pending = { serverState, foul, s: sound, onDone };
    } else {
      // RECEIVER (or shot_result arrived before startLocal): run full animation
      this._running = true;
      if (!this.physics) { this._applyServerState(serverState, foul, sound, onDone); return; }
      this._runPhysics(shotParams, serverState, sound, () => {
        onDone?.();
      });
    }
  }

  // â”€â”€ Shared physics runner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  _runPhysics(shotParams, serverState, sound, onLocalDone) {
    const preState = useGameStore.getState();
    useGameStore.setState({ isSimulating: true });

    this.physics.loadState(preState.coins, {
      x: shotParams.strikerX,
      y: preState.strikerPos.y,
    });

    this.physics.shoot(shotParams.angle, shotParams.power, {
      onPocketed: (id, pos) => {
        sound?.playPocket();
        useGameStore.setState(s => ({
          coins: s.coins.map(c => c.id === id ? { ...c, pocketed: true } : c),
        }));
        const coinData = useGameStore.getState().coins.find(c => c.id === id);
        const nearest  = POCKET.POSITIONS.reduce((best, p) => {
          const d = Math.hypot(p.x - pos.x, p.y - pos.y);
          return d < best.d ? { p, d } : best;
        }, { p: POCKET.POSITIONS[0], d: Infinity }).p;
        useGameStore.getState().addPocketAnimation({
          id: `${id}_${Date.now()}`, coinId: id,
          color: coinData?.color ?? 'black', isQueen: id === 'queen',
          x: pos.x, y: pos.y, pocketX: nearest.x, pocketY: nearest.y,
          startTime: Date.now(), duration: 350,
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
          liveStrikerPos: strikerSnap ? { x: strikerSnap.x, y: strikerSnap.y } : null,
        });
      },
      onComplete: () => {
        this._running = false;
        useGameStore.setState({ liveStrikerPos: null });
        if (serverState) {
          // RECEIVER path: apply authoritative final state immediately
          this._applyServerState(serverState, null, sound, onLocalDone);
        } else {
          // SHOOTER path: local animation done, let handleServerResult apply state
          onLocalDone?.();
        }
      },
    });
  }

  _applyServerState(serverState, foul, sound, onDone) {
    useGameStore.getState().applyResult(serverState);
    if (serverState?.lastFoul) sound?.playFoul();
    if (serverState?.winner)   sound?.playWin();
    onDone?.();
  }
}

export const onlineAnimator = new OnlineAnimator();
