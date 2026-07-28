import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { connectSocket } from '../network/socket.js';
import { GAME_STATUS } from '../constants/gameConstants.js';
import { useSoundManager } from './useSoundManager.js';
import { onlineAnimator } from '../services/onlineAnimator.js';

// ─────────────────────────────────────────────────────────────────────────────
// useOnlineGame hook
//
// Animation is NOT handled here. OnlineGame.jsx owns the physics engine
// and provides an `onShotArrived` ref. When shot_result arrives, we call
// that ref directly — no Zustand intermediate, no useEffect timing.
// ─────────────────────────────────────────────────────────────────────────────
export function useOnlineGame(callbacks = {}) {
  const sound      = useSoundManager();
  const soundRef   = useRef(sound);
  soundRef.current = sound;

  // cbRef holds the LATEST callback props without causing effect re-runs
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  // Locally cache the last shot params so the SHOOTER sees the correct animation
  // direction even when the backend hasn’t been redeployed yet
  const lastShotRef = useRef(null);

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

    // ── Shot result: run animation via module-level singleton ──────────────────
    // shotParams comes from backend (needs updated Railway deploy).
    // Falls back to locally saved params so the shooter always gets correct direction.
    socket.off('shot_result').on('shot_result', ({ state: serverState, shotParams, foul }) => {
      const params = shotParams ?? lastShotRef.current; // server wins, local is fallback
      lastShotRef.current?._cancelPreAnim?.();          // stop the pre-animation
      lastShotRef.current = null;                       // clear after use
      onlineAnimator.run(params, serverState, foul, soundRef.current, () => {
        cbRef.current.onShotResult?.({ foul });
      });
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
    // Save params so this player’s shot_result handler can use the correct angle
    lastShotRef.current = { angle, power, strikerX };
    useGameStore.setState({ isSimulating: true });
    soundRef.current.playShoot();
    // Immediately animate the striker forward so there's no frozen delay
    // while the server computes physics (~200-400ms round trip).
    // The full physics animation replaces this once shot_result arrives.
    const startY   = useGameStore.getState().strikerPos.y;
    const startX   = strikerX;
    const vMag     = power * 0.25;
    const dist     = Math.min(500, Math.max(60, vMag * 28));
    const endX     = startX + Math.cos(angle) * dist;
    const endY     = startY + Math.sin(angle) * dist;
    const started  = performance.now();
    const duration = 350; // ms — covers typical server round-trip
    let   rafId;

    const preAnim = (now) => {
      const t = Math.min((now - started) / duration, 1);
      const e = 1 - Math.pow(1 - t, 2); // ease-out
      useGameStore.setState({
        liveStrikerPos: { x: startX + (endX - startX) * e, y: startY + (endY - startY) * e },
      });
      if (t < 1) {
        rafId = requestAnimationFrame(preAnim);
      }
    };
    rafId = requestAnimationFrame(preAnim);

    // Store cancel handle so shot_result handler can stop it before running real animation
    lastShotRef.current._cancelPreAnim = () => {
      cancelAnimationFrame(rafId);
      useGameStore.setState({ liveStrikerPos: null });
    };
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

