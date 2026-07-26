import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { connectSocket } from '../network/socket.js';
import { GAME_STATUS, POCKET } from '../constants/gameConstants.js';
import { useSoundManager } from './useSoundManager.js';
import { ClientPhysics } from '../physics/ClientPhysics.js';

// ─────────────────────────────────────────────────────────────────────────────
// Standalone animation runner – no React closure dependencies.
// Called directly from the socket event handler (registered once, stays stable).
// ─────────────────────────────────────────────────────────────────────────────
function _runShotAnimation(physicsRef, soundRef, shotParams, serverState, onDone) {
  const physics = physicsRef.current;
  const sound   = soundRef.current;
  const store   = useGameStore.getState();

  // Fallback: no physics available or no shot params — just jump to server state
  if (!physics || !shotParams) {
    store.applyResult(serverState);
    onDone?.();
    return;
  }

  useGameStore.setState({ isSimulating: true });
  physics.loadState(store.coins, { x: shotParams.strikerX, y: store.strikerPos.y });

  physics.shoot(shotParams.angle, shotParams.power, {
    onPocketed: (id, pos) => {
      sound.playPocket();
      // Hide coin immediately so it doesn't ghost during animation
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
        x: pos.x, y: pos.y,
        pocketX: nearest.x, pocketY: nearest.y,
        startTime: Date.now(),
        duration: 350,
      });
    },
    onTick: (snapshot) => {
      const strikerSnap = snapshot.find(s => s.id === 'striker');
      const coinSnap    = snapshot.filter(s => s.id !== 'striker');
      const cur = useGameStore.getState().coins;
      const updated = cur.map(c => {
        const live = coinSnap.find(s => s.id === c.id);
        return live ? { ...c, x: live.x, y: live.y } : c;
      });
      useGameStore.setState({
        coins: updated,
        liveStrikerPos: strikerSnap ? { x: strikerSnap.x, y: strikerSnap.y } : null,
      });
    },
    onComplete: () => {
      useGameStore.setState({ liveStrikerPos: null });
      // Apply authoritative server final state (corrects any float divergence)
      useGameStore.getState().applyResult(serverState);
      if (serverState.lastFoul) sound.playFoul();
      if (serverState.winner)   sound.playWin();
      onDone?.();
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useOnlineGame hook
// ─────────────────────────────────────────────────────────────────────────────
export function useOnlineGame(callbacks = {}) {
  const sound      = useSoundManager();
  const physicsRef = useRef(null);
  const soundRef   = useRef(sound);
  soundRef.current = sound;                    // always latest, no stale closure

  // cbRef holds the LATEST callback props without causing effect re-runs
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  // ── Init physics once per mount ───────────────────────────────────────────
  useEffect(() => {
    physicsRef.current = new ClientPhysics();
    return () => { physicsRef.current?.destroy(); physicsRef.current = null; };
  }, []);

  // ── Register ALL socket events ONCE (empty deps) ──────────────────────────
  // cbRef / physicsRef / soundRef give access to latest values without deps.
  useEffect(() => {
    const socket = connectSocket();

    // Room lifecycle
    socket.off('room_created').on('room_created', ({ roomCode, playerNum, state }) => {
      const s = useGameStore.getState();
      s.setRoomCode(roomCode);
      s.setMyPlayerNum(playerNum);
      s.applyResult(state);
      useGameStore.setState({ status: GAME_STATUS.WAITING });
      cbRef.current.onRoomCreated?.({ roomCode, playerNum });
    });

    socket.off('room_joined').on('room_joined', ({ roomCode, playerNum, state }) => {
      const s = useGameStore.getState();
      s.setRoomCode(roomCode);
      s.setMyPlayerNum(playerNum);
      s.applyResult(state);
      cbRef.current.onRoomJoined?.({ roomCode, playerNum });
    });

    socket.off('game_start').on('game_start', ({ state }) => {
      useGameStore.getState().applyResult(state);
      useGameStore.setState({ status: GAME_STATUS.PLAYING, isSimulating: false });
      cbRef.current.onGameStart?.({});
    });

    // ── Shot result: store in Zustand; OnlineGame.jsx watches and animates ──
    // This decouples animation from socket callbacks so it runs in React lifecycle.
    socket.off('shot_result').on('shot_result', ({ state: serverState, shotParams, foul }) => {
      useGameStore.setState({ pendingOnlineShot: { shotParams, serverState, foul } });
    });

    // game_over arrives nearly simultaneously with shot_result (server sends both).
    // If animation is still running, ignore — onComplete already applies final state.
    // If not animating (edge case), apply immediately.
    socket.off('game_over').on('game_over', ({ winner, scores }) => {
      if (!useGameStore.getState().isSimulating) {
        useGameStore.setState({ winner, scores, status: GAME_STATUS.FINISHED });
      }
      cbRef.current.onGameOver?.({ winner, scores });
    });

    socket.off('turn_timeout').on('turn_timeout', ({ state }) => {
      useGameStore.getState().applyResult(state);
    });

    // Disconnection / reconnection
    socket.off('player_disconnected').on('player_disconnected', ({ playerNum, message }) => {
      // Don't end the game immediately — give 60s reconnect window (server will fire connection_lost)
      useGameStore.setState({ isSimulating: false });
      cbRef.current.onDisconnect?.({ playerNum, message });
    });

    socket.off('player_reconnected').on('player_reconnected', ({ message }) => {
      cbRef.current.onReconnect?.({ message });
    });

    socket.off('connection_lost').on('connection_lost', ({ message }) => {
      // 60s elapsed with no reconnect — end the match, remaining player wins
      const { myPlayerNum } = useGameStore.getState();
      if (myPlayerNum) {
        useGameStore.setState({ winner: myPlayerNum, status: GAME_STATUS.FINISHED, isSimulating: false });
      }
      cbRef.current.onConnectionLost?.({ message });
    });

    socket.off('rejoin_ack').on('rejoin_ack', ({ state, playerNum }) => {
      useGameStore.getState().applyResult(state);
      useGameStore.setState({ status: GAME_STATUS.PLAYING, isSimulating: false });
      const store = useGameStore.getState();
      if (!store.myPlayerNum) useGameStore.setState({ myPlayerNum: playerNum });
      cbRef.current.onReconnect?.({ message: 'Reconnected. Game resumed.' });
    });

    socket.off('error').on('error', ({ message }) => {
      useGameStore.setState({ isSimulating: false });
      cbRef.current.onError?.({ message });
    });

    socket.off('invalid_shot').on('invalid_shot', () => {
      useGameStore.setState({ isSimulating: false });
    });

    // Auto-rejoin if socket reconnects while we're in a room
    socket.off('connect').on('connect', () => {
      const { roomCode, myPlayerNum } = useGameStore.getState();
      if (roomCode && myPlayerNum) {
        socket.emit('rejoin_room', { roomCode, playerNum: myPlayerNum });
      }
    });

    return () => {
      [
        'room_created', 'room_joined', 'game_start', 'shot_result', 'game_over',
        'turn_timeout', 'player_disconnected', 'player_reconnected', 'connection_lost',
        'rejoin_ack', 'error', 'invalid_shot', 'connect',
      ].forEach(e => socket.off(e));
    };
  }, []); // ← EMPTY DEPS — register once, use refs for latest values

  // ── Exposed actions ───────────────────────────────────────────────────────
  const createRoom = useCallback((playerName) => {
    connectSocket().emit('create_room', { playerName });
  }, []);

  const joinRoom = useCallback((roomCode, playerName) => {
    connectSocket().emit('join_room', { roomCode: roomCode.toUpperCase(), playerName });
  }, []);

  const shoot = useCallback((angle, power, strikerX) => {
    const { roomCode, myPlayerNum, turn, status, isSimulating } = useGameStore.getState();
    if (status !== GAME_STATUS.PLAYING || myPlayerNum !== turn || isSimulating) return;
    useGameStore.setState({ isSimulating: true });
    soundRef.current.playShoot();
    connectSocket().emit('shoot', { angle, power, strikerX, roomCode });
  }, []);

  const requestRematch = useCallback(() => {
    const { roomCode } = useGameStore.getState();
    connectSocket().emit('request_rematch', { roomCode });
  }, []);

  return { createRoom, joinRoom, shoot, requestRematch };
}


/**
 * Hook for online multiplayer.
 *
 * Animation strategy:
 *  - Server broadcasts `shot_result` with `shotParams` (angle, power, strikerX).
 *  - BOTH clients (shooter & receiver) run client-side physics animation from
 *    their current coin positions using those params.
 *  - When animation completes the server's authoritative final state is applied.
 *    This keeps both screens in sync while showing smooth real-time physics.
 */

