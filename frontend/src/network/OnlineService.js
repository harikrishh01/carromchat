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
    const store = useGameStore.getState();
    const s = this.socket;

    s.on('room_created', ({ roomCode, playerNum, state }) => {
      store.setRoomCode(roomCode);
      store.setMyPlayerNum(playerNum);
      store.applyResult(state);
      useGameStore.setState({ status: GAME_STATUS.WAITING });
      window.__onRoomCreated?.({ roomCode, playerNum });
    });

    s.on('room_joined', ({ roomCode, playerNum, state }) => {
      store.setRoomCode(roomCode);
      store.setMyPlayerNum(playerNum);
      store.applyResult(state);
      window.__onRoomJoined?.({ roomCode, playerNum });
    });

    s.on('game_start', ({ state, rematch }) => {
      store.applyResult(state);
      useGameStore.setState({ status: GAME_STATUS.PLAYING });
      window.__onGameStart?.({ rematch });
    });

    s.on('shot_result', (result) => {
      const { state, pocketed, strikerPocketed, foul, extraTurn } = result;
      store.applyResult(state);
      window.__onShotResult?.({ pocketed, strikerPocketed, foul, extraTurn });
    });

    s.on('game_over', ({ winner, scores }) => {
      useGameStore.setState({ winner, scores, status: GAME_STATUS.FINISHED });
      window.__onGameOver?.({ winner, scores });
    });

    s.on('turn_timeout', ({ newTurn, state }) => {
      store.applyResult(state);
      window.__onTurnTimeout?.({ newTurn });
    });

    s.on('player_disconnected', ({ playerNum, message }) => {
      window.__onPlayerDisconnected?.({ playerNum, message });
    });

    s.on('error', ({ message }) => {
      window.__onSocketError?.({ message });
    });

    s.on('invalid_shot', ({ reason }) => {
      window.__onInvalidShot?.({ reason });
    });
  }
}

export const onlineService = new OnlineService();
