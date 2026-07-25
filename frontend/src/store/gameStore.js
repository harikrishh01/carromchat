import { create } from 'zustand';
import { INITIAL_COINS, TURN, GAME_STATUS, STRIKER_LINE, BOARD, COIN_COLORS, COIN_VALUES, FOUL_TYPES } from '../constants/gameConstants.js';

const defaultStrikerPos = (turn) => ({
  x: BOARD.CENTER,
  y: turn === TURN.PLAYER1 ? STRIKER_LINE.Y_BOTTOM : STRIKER_LINE.Y_TOP,
});

const initialState = () => ({
  // Game state
  status: GAME_STATUS.WAITING,
  turn: TURN.PLAYER1,
  coins: INITIAL_COINS.map(c => ({ ...c })),
  strikerPos: defaultStrikerPos(TURN.PLAYER1),
  scores: { player1: 0, player2: 0 },
  fouls: { player1: 0, player2: 0 },
  queenPocketed: false,
  queenCoverPending: false,
  queenHolder: null,
  lastFoul: null,
  winner: null,

  // UI state
  isSimulating: false,
  aimAngle: 0,
  power: 50,
  isAiming: false,
  strikerDragX: BOARD.CENTER,
  liveStrikerPos: null, // set during physics simulation so striker animates
  aimCursorPos: null,   // board-space cursor pos while pulling back (for rubber-band draw)

  // Players
  player1Name: 'Player 1',
  player2Name: 'Computer',

  // Mode
  gameMode: null, // 'offline' | 'online'
  difficulty: 'medium',

  // Online
  roomCode: null,
  myPlayerNum: null,
  opponentName: null,

  // Sound
  soundEnabled: true,
  musicEnabled: true,

  // Particles
  particles: [],

  // Pocket animations – coins animating into holes
  pocketAnimations: [],

  // HUD timer
  shotTimeLeft: 15,
});

export const useGameStore = create((set, get) => ({
  ...initialState(),

  // ---- Actions ----

  setGameMode: (mode) => set({ gameMode: mode }),
  setDifficulty: (d) => set({ difficulty: d }),

  setPlayer1Name: (name) => set({ player1Name: name }),
  setPlayer2Name: (name) => set({ player2Name: name }),

  toggleSound: () => set(s => ({ soundEnabled: !s.soundEnabled })),
  toggleMusic: () => set(s => ({ musicEnabled: !s.musicEnabled })),

  startGame: () => set({
    status: GAME_STATUS.PLAYING,
    turn: TURN.PLAYER1,
    coins: INITIAL_COINS.map(c => ({ ...c })),
    strikerPos: defaultStrikerPos(TURN.PLAYER1),
    scores: { player1: 0, player2: 0 },
    fouls: { player1: 0, player2: 0 },
    queenPocketed: false,
    queenCoverPending: false,
    queenHolder: null,
    lastFoul: null,
    winner: null,
    isSimulating: false,
    particles: [],
    shotTimeLeft: 15,
  }),

  setAimAngle: (angle) => set({ aimAngle: angle }),
  setPower: (power) => set({ power: Math.max(5, Math.min(100, power)) }),
  setIsAiming: (v) => set({ isAiming: v }),
  setStrikerDragX: (x) => set({ strikerDragX: x }),

  setSimulating: (v) => set({ isSimulating: v }),

  updateCoins: (coins) => set({ coins }),
  updateStrikerPos: (pos) => set({ strikerPos: pos }),

  addParticle: (p) => set(s => ({ particles: [...s.particles, p] })),
  clearParticles: () => set({ particles: [] }),
  removeParticle: (id) => set(s => ({ particles: s.particles.filter(p => p.id !== id) })),

  addPocketAnimation: (anim) => set(s => ({ pocketAnimations: [...s.pocketAnimations, anim] })),
  clearFinishedPocketAnimations: () => set(s => ({
    pocketAnimations: s.pocketAnimations.filter(a => Date.now() - a.startTime < a.duration + 50),
  })),

  setShotTimeLeft: (t) => set({ shotTimeLeft: t }),

  /**
   * Apply shot result to local state (used both offline and online).
   */
  applyResult: ({
    coins, scores, fouls, turn, queenPocketed, queenCoverPending,
    queenHolder, lastFoul, winner, status, strikerPos,
  }) => {
    const updates = {};
    if (coins !== undefined) updates.coins = coins;
    if (scores !== undefined) updates.scores = scores;
    if (fouls !== undefined) updates.fouls = fouls;
    if (turn !== undefined) updates.turn = turn;
    if (queenPocketed !== undefined) updates.queenPocketed = queenPocketed;
    if (queenCoverPending !== undefined) updates.queenCoverPending = queenCoverPending;
    if (queenHolder !== undefined) updates.queenHolder = queenHolder;
    if (lastFoul !== undefined) updates.lastFoul = lastFoul;
    if (winner !== undefined) updates.winner = winner;
    if (status !== undefined) updates.status = status;
    if (strikerPos !== undefined) {
      updates.strikerPos = strikerPos;
      // Reset striker to center of baseline for the new turn
      updates.strikerDragX = BOARD.CENTER;
    }
    updates.isSimulating = false;
    set(updates);
  },

  // Online-specific
  setRoomCode: (code) => set({ roomCode: code }),
  setMyPlayerNum: (num) => set({ myPlayerNum: num }),
  setOpponentName: (name) => set({ opponentName: name }),

  resetGame: () => set(initialState()),
}));
