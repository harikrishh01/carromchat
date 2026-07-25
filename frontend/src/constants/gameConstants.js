// Shared game constants – mirrors backend for client-side use

export const BOARD = {
  SIZE: 800,
  BORDER: 60,
  PLAY_AREA: 680,
  CENTER: 400,
};

export const POCKET = {
  RADIUS: 28,
  POSITIONS: [
    { x: BOARD.BORDER, y: BOARD.BORDER },
    { x: BOARD.SIZE - BOARD.BORDER, y: BOARD.BORDER },
    { x: BOARD.BORDER, y: BOARD.SIZE - BOARD.BORDER },
    { x: BOARD.SIZE - BOARD.BORDER, y: BOARD.SIZE - BOARD.BORDER },
  ],
};

export const COIN = {
  RADIUS: 18,
  MASS: 1,
  FRICTION: 0.025,      // slight surface resistance
  RESTITUTION: 0.76,    // moderately elastic bounces
  FRICTION_AIR: 0.016,  // some air drag – coins settle naturally
};

export const STRIKER = {
  RADIUS: 22,
  MASS: 1.5,
  FRICTION: 0.025,
  RESTITUTION: 0.76,
  FRICTION_AIR: 0.016,
};

export const STRIKER_LINE = {
  Y_BOTTOM: BOARD.SIZE - BOARD.BORDER - 60,
  Y_TOP: BOARD.BORDER + 60,
  X_MIN: BOARD.CENTER - 100,
  X_MAX: BOARD.CENTER + 100,
};

export const COIN_COLORS = {
  BLACK: 'black',
  WHITE: 'white',
  QUEEN: 'queen',
  STRIKER: 'striker',
};

export const GAME_STATUS = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished',
};

export const TURN = {
  PLAYER1: 'player1',
  PLAYER2: 'player2',
};

export const FOUL_TYPES = {
  STRIKER_POCKETED: 'striker_pocketed',
  NO_COIN_HIT: 'no_coin_hit',
  OPPONENT_COIN_POCKETED: 'opponent_coin_pocketed',
  QUEEN_WITHOUT_COVER: 'queen_without_cover',
};

export const COIN_VALUES = {
  BLACK: 1,
  WHITE: 1,
  QUEEN: 3,
};

export const DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

export const SHOT_TIMEOUT = 15000;

export const COLORS = {
  BOARD_BG: '#2d5a1b',
  BOARD_BORDER: '#8B4513',
  BOARD_LINE: '#4a7c2d',
  COIN_BLACK: '#1a1a1a',
  COIN_WHITE: '#f5f5dc',
  COIN_QUEEN: '#cc0000',
  COIN_QUEEN_INNER: '#ff6600',
  STRIKER_COLOR: '#888888',
  STRIKER_INNER: '#cccccc',
  POCKET_COLOR: '#0a0a0a',
  AIM_LINE: 'rgba(255,255,100,0.7)',
  POWER_COLOR: '#ff6600',
};

// Initial coin layout
export const INITIAL_COINS = (() => {
  const cx = BOARD.CENTER;
  const cy = BOARD.CENTER;
  const r = COIN.RADIUS * 2 + 1;
  const coins = [];

  coins.push({ id: 'queen', color: COIN_COLORS.QUEEN, x: cx, y: cy, pocketed: false });

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    coins.push({
      id: `inner_${i}`,
      color: i % 2 === 0 ? COIN_COLORS.BLACK : COIN_COLORS.WHITE,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      pocketed: false,
    });
  }

  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI * 2) / 12;
    coins.push({
      id: `outer_${i}`,
      color: i % 2 === 0 ? COIN_COLORS.WHITE : COIN_COLORS.BLACK,
      x: cx + Math.cos(angle) * r * 2,
      y: cy + Math.sin(angle) * r * 2,
      pocketed: false,
    });
  }
  return coins;
})();
