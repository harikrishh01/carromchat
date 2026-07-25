import { GameState } from './GameState.js';

/**
 * Manages all active game rooms.
 */
export class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomCode -> GameState
  }

  createRoom(roomCode) {
    const state = new GameState(roomCode);
    this.rooms.set(roomCode, state);
    return state;
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode) || null;
  }

  deleteRoom(roomCode) {
    const room = this.rooms.get(roomCode);
    if (room) {
      room.physics.destroy();
      this.rooms.delete(roomCode);
    }
  }

  /**
   * Find the room a given socket belongs to.
   */
  findRoomBySocket(socketId) {
    for (const [code, state] of this.rooms.entries()) {
      if (state.players[socketId]) return { roomCode: code, state };
    }
    return null;
  }

  /**
   * Generate a unique 6-char room code.
   */
  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }

  cleanup() {
    // Remove empty rooms
    for (const [code, state] of this.rooms.entries()) {
      if (Object.keys(state.players).length === 0) {
        this.deleteRoom(code);
      }
    }
  }
}
