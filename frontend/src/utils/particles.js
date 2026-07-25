import { COIN_COLORS } from '../constants/gameConstants.js';

/**
 * Create a burst of particles at position for pocketed coin effect.
 */
export function createPocketParticles(x, y, coinColor) {
  const colors = {
    [COIN_COLORS.BLACK]: '80,80,80',
    [COIN_COLORS.WHITE]: '245,240,220',
    [COIN_COLORS.QUEEN]: '255,100,0',
  };
  const color = colors[coinColor] || '255,200,0';

  const dots = Array.from({ length: 12 }, () => ({
    x,
    y,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
  }));

  return {
    id: Date.now() + Math.random(),
    x,
    y,
    born: Date.now(),
    color,
    dots,
  };
}
