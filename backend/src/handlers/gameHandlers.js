import { GAME_STATUS, SHOT_TIMEOUT } from '../constants/gameConstants.js';

/**
 * Registers all Socket.IO event handlers for carrom gameplay.
 */
export function registerGameHandlers(io, socket, roomManager) {
  // --- Create Room ---
  socket.on('create_room', ({ playerName }) => {
    try {
      const roomCode = roomManager.generateCode();
      const state = roomManager.createRoom(roomCode);
      const playerNum = state.addPlayer(socket.id, playerName || 'Player 1');
      socket.join(roomCode);
      socket.emit('room_created', { roomCode, playerNum, state: state.getPublicState() });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // --- Join Room ---
  socket.on('join_room', ({ roomCode, playerName }) => {
    try {
      const state = roomManager.getRoom(roomCode);
      if (!state) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      if (Object.keys(state.players).length >= 2) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }
      const playerNum = state.addPlayer(socket.id, playerName || 'Player 2');
      socket.join(roomCode);
      socket.emit('room_joined', { roomCode, playerNum, state: state.getPublicState() });

      if (state.isReady()) {
        state.startGame();
        io.to(roomCode).emit('game_start', { state: state.getPublicState() });
        _startShotTimer(io, socket, roomManager, roomCode);
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // --- Shoot ---
  socket.on('shoot', ({ roomCode, angle, power, strikerX }) => {
    try {
      const state = roomManager.getRoom(roomCode);
      if (!state) { socket.emit('error', { message: 'Room not found' }); return; }

      // Clear shot timer
      if (state.shotTimer) {
        clearTimeout(state.shotTimer);
        state.shotTimer = null;
      }

      const result = state.processShot(socket.id, angle, power, strikerX);
      if (!result.valid) {
        socket.emit('invalid_shot', { reason: result.reason });
        return;
      }

      io.to(roomCode).emit('shot_result', result);

      if (state.status === GAME_STATUS.FINISHED) {
        io.to(roomCode).emit('game_over', { winner: state.winner, scores: state.scores });
      } else {
        _startShotTimer(io, socket, roomManager, roomCode);
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // --- Rematch ---
  socket.on('request_rematch', ({ roomCode }) => {
    const state = roomManager.getRoom(roomCode);
    if (!state) return;
    state.reset();
    io.to(roomCode).emit('game_start', { state: state.getPublicState(), rematch: true });
    _startShotTimer(io, socket, roomManager, roomCode);
  });

  // --- Disconnect ---
  socket.on('disconnect', () => {
    const found = roomManager.findRoomBySocket(socket.id);
    if (!found) return;
    const { roomCode, state } = found;
    const player = state.players[socket.id];
    state.removePlayer(socket.id);
    io.to(roomCode).emit('player_disconnected', {
      playerNum: player?.playerNum,
      message: `${player?.name || 'A player'} disconnected`,
    });

    if (state.shotTimer) clearTimeout(state.shotTimer);

    // Clean up empty rooms after delay
    setTimeout(() => roomManager.cleanup(), 30000);
  });
}

/**
 * Start/restart the shot timeout timer.
 */
function _startShotTimer(io, socket, roomManager, roomCode) {
  const state = roomManager.getRoom(roomCode);
  if (!state || state.status !== GAME_STATUS.PLAYING) return;

  if (state.shotTimer) clearTimeout(state.shotTimer);

  state.shotTimer = setTimeout(() => {
    const s = roomManager.getRoom(roomCode);
    if (!s || s.status !== GAME_STATUS.PLAYING) return;
    // Auto-skip turn
    s.turn = s.turn === 'player1' ? 'player2' : 'player1';
    io.to(roomCode).emit('turn_timeout', { newTurn: s.turn, state: s.getPublicState() });
    _startShotTimer(io, socket, roomManager, roomCode);
  }, SHOT_TIMEOUT);
}
