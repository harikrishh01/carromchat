import { connectSocket, disconnectSocket, getSocket } from './socket.js';
import { useGameStore } from '../store/gameStore.js';
import { GAME_STATUS } from '../constants/gameConstants.js';

/**
 * Online multiplayer service – wraps Socket.IO events.
 */
export class OnlineService {
  constructor() {
    this.socket = null;
  }

  connect() {
    this.socket = connectSocket();
    this._registerEvents();
    return this.socket;
  }

  disconnect() {
    disconnectSocket();
  }

  createRoom(playerName) {
    this.socket.emit('create_room', { playerName });
  }

  joinRoom(roomCode, playerName) {
    this.socket.emit('join_room', { roomCode: roomCode.toUpperCase(), playerName });
  }

  shoot({ angle, power, strikerX, roomCode }) {
    this.socket.emit('shoot', { angle, power, strikerX, roomCode });
  }

  requestRematch(roomCode) {
    this.socket.emit('request_rematch', { roomCode });
  }

  _registerEvents() {
    const s = this.socket;

    // Use .off().on() for every event so re-connecting or StrictMode double-mount
    // never registers duplicate handlers that fire events twice.

    s.off('room_created').on('room_created', ({ roomCode, playerNum, state }) => {
      const store = useGameStore.getState();
      store.setRoomCode(roomCode);
      store.setMyPlayerNum(playerNum);
      store.applyResult(state);
      useGameStore.setState({ status: GAME_STATUS.WAITING });
      window.__onRoomCreated?.({ roomCode, playerNum });
    });

    s.off('room_joined').on('room_joined', ({ roomCode, playerNum, state }) => {
      const store = useGameStore.getState();
      store.setRoomCode(roomCode);
      store.setMyPlayerNum(playerNum);
      store.applyResult(state);
      window.__onRoomJoined?.({ roomCode, playerNum });
    });

    s.off('game_start').on('game_start', ({ state, rematch }) => {
      useGameStore.getState().applyResult(state);
      useGameStore.setState({ status: GAME_STATUS.PLAYING, isSimulating: false });
      window.__onGameStart?.({ rematch });
    });

    s.off('shot_result').on('shot_result', (result) => {
      const { state, pocketed, strikerPocketed, foul, extraTurn } = result;
      // Apply server-authoritative state (also resets isSimulating → false)
      useGameStore.getState().applyResult(state);
      window.__onShotResult?.({ pocketed, strikerPocketed, foul, extraTurn });
    });

    s.off('game_over').on('game_over', ({ winner, scores }) => {
      useGameStore.setState({ winner, scores, status: GAME_STATUS.FINISHED, isSimulating: false });
      window.__onGameOver?.({ winner, scores });
    });

    s.off('turn_timeout').on('turn_timeout', ({ newTurn, state }) => {
      useGameStore.getState().applyResult(state);
      window.__onTurnTimeout?.({ newTurn });
    });

    s.off('player_disconnected').on('player_disconnected', ({ playerNum, message }) => {
      useGameStore.setState({ isSimulating: false }); // unblock UI
      window.__onPlayerDisconnected?.({ playerNum, message });
    });

    s.off('error').on('error', ({ message }) => {
      useGameStore.setState({ isSimulating: false }); // unblock UI on error
      window.__onSocketError?.({ message });
    });

    s.off('invalid_shot').on('invalid_shot', ({ reason }) => {
      useGameStore.setState({ isSimulating: false }); // unblock after rejected shot
      window.__onInvalidShot?.({ reason });
    });
  }
}

export const onlineService = new OnlineService();
