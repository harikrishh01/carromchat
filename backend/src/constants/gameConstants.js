// Official Carrom Board Game Constants

export const BOARD = {
  SIZE: 800,           // px (logical units)
  BORDER: 60,         // border thickness
  PLAY_AREA: 680,     // SIZE - 2*BORDER
  CENTER: 400,        // SIZE / 2
};

export const POCKET = {
  RADIUS: 28,
  POSITIONS: [
    { x: BOARD.BORDER, y: BOARD.BORDER },           // top-left
    { x: BOARD.SIZE - BOARD.BORDER, y: BOARD.BORDER }, // top-right
    { x: BOARD.BORDER, y: BOARD.SIZE - BOARD.BORDER }, // bottom-left
    { x: BOARD.SIZE - BOARD.BORDER, y: BOARD.SIZE - BOARD.BORDER }, // bottom-right
  ],
};

export const COIN = {
  RADIUS: 18,
  MASS: 1,
  FRICTION: 0.025,
  RESTITUTION: 0.76,
  FRICTION_AIR: 0.016,
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

export const SHOT_TIMEOUT = 15000; // ms

// Initial coin arrangement – standard carrom setup
export const INITIAL_COINS = (() => {
  const cx = BOARD.CENTER;
  const cy = BOARD.CENTER;
  const r = COIN.RADIUS * 2 + 1;

  const coins = [];

  // Centre ring (alternating B/W, queen in middle)
  coins.push({ id: 'queen', color: COIN_COLORS.QUEEN, x: cx, y: cy });

  // Inner ring: 6 coins alternating
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    coins.push({
      id: `inner_${i}`,
      color: i % 2 === 0 ? COIN_COLORS.BLACK : COIN_COLORS.WHITE,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    });
  }

  // Outer ring: 12 coins alternating
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI * 2) / 12;
    coins.push({
      id: `outer_${i}`,
      color: i % 2 === 0 ? COIN_COLORS.WHITE : COIN_COLORS.BLACK,
      x: cx + Math.cos(angle) * r * 2,
      y: cy + Math.sin(angle) * r * 2,
    });
  }

  return coins;
})();
