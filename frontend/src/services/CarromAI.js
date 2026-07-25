import { BOARD, COIN_COLORS, TURN, STRIKER_LINE, POCKET, COIN, STRIKER } from '../constants/gameConstants.js';

/**
 * Carrom AI using ghost-ball billiards geometry.
 *
 * Ghost-ball principle:
 *   To send a target coin into pocket P, the striker must arrive at the
 *   "ghost ball" position: the point one (COIN_R + STRIKER_R) behind the
 *   target along the coin→pocket axis. The striker just aims at that point.
 *
 * Difficulty controls:
 *   Easy   – picks bad shots from the list + large angular/positional noise.
 *   Medium – picks a random shot from the top-3 candidates + moderate noise.
 *   Hard   – always picks the highest-scored shot + minimal noise.
 */
export class CarromAI {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
  }

  /** Returns { angle, power, strikerX } */
  calculateShot(gameState) {
    const { coins, turn, queenPocketed, queenCoverPending } = gameState;
    const myColor   = turn === TURN.PLAYER1 ? COIN_COLORS.WHITE : COIN_COLORS.BLACK;
    const strikerY  = turn === TURN.PLAYER1 ? STRIKER_LINE.Y_BOTTOM : STRIKER_LINE.Y_TOP;
    const shootDown = turn === TURN.PLAYER2;  // player2 sits at top, shoots downward

    const active  = coins.filter(c => !c.pocketed);
    const myCoins = active.filter(c => c.color === myColor);
    const queen   = active.find(c => c.id === 'queen');

    // ── Priority queue of targets ──
    let targets;
    if (queenCoverPending) {
      targets = myCoins;                                    // must cover queen immediately
    } else if (!queenPocketed && queen) {
      targets = this.difficulty === 'hard'
        ? [queen, ...myCoins]                              // hard: queen first
        : [...myCoins, queen];                             // easy/med: own coins first
    } else {
      targets = myCoins;
    }

    if (targets.length === 0) return this._fallback(strikerY, shootDown);

    // ── Find all geometrically valid direct shots ──
    const shots = this._findDirectShots(targets, strikerY, shootDown);

    if (shots.length > 0) {
      shots.sort((a, b) => b.score - a.score);             // higher score = better shot

      let chosen;
      if (this.difficulty === 'easy') {
        // Pick randomly from the bottom half (worst shots)
        const pool = shots.slice(Math.floor(shots.length / 2));
        chosen = pool[Math.floor(Math.random() * pool.length)] ?? shots[shots.length - 1];
      } else if (this.difficulty === 'medium') {
        // Pick randomly from top 3
        const pool = shots.slice(0, Math.min(3, shots.length));
        chosen = pool[Math.floor(Math.random() * pool.length)];
      } else {
        chosen = shots[0];                                 // always best
      }

      return this._addNoise(chosen);
    }

    // ── Fallback: bank shot off nearest wall ──
    const bank = this._bankShot(targets[0], strikerY, shootDown);
    return bank ? this._addNoise(bank) : this._fallback(strikerY, shootDown);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Ghost-ball direct shot
  // ─────────────────────────────────────────────────────────────────────────

  _findDirectShots(targets, strikerY, shootDown) {
    const shots = [];
    const contactR = COIN.RADIUS + STRIKER.RADIUS;  // distance between centers at impact

    for (const target of targets) {
      for (const pocket of POCKET.POSITIONS) {
        const pdx = pocket.x - target.x;
        const pdy = pocket.y - target.y;
        const pLen = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pLen < 1) continue;

        // Unit vector: coin → pocket
        const ux = pdx / pLen;
        const uy = pdy / pLen;

        // Ghost-ball centre: striker must arrive here to send coin to pocket
        const gx = target.x - ux * contactR;
        const gy = target.y - uy * contactR;

        // The ghost ball must be reachable from the striker baseline:
        // Player1 (bottom, Y_BOTTOM≈680) shoots UP  → gy must be above strikerY
        // Player2 (top,    Y_TOP≈120)    shoots DOWN → gy must be below strikerY
        if (!shootDown && gy >= strikerY - 10) continue;
        if ( shootDown && gy <= strikerY + 10) continue;

        // Best strikerX: directly under/over ghost ball (clamped to baseline)
        const strikerX = Math.max(STRIKER_LINE.X_MIN, Math.min(STRIKER_LINE.X_MAX, gx));

        // Angle from striker position to ghost-ball centre
        const adx = gx - strikerX;
        const ady = gy - strikerY;
        const angle = Math.atan2(ady, adx);

        // Guard: angle must point toward the board
        if (!shootDown && ady >= 0) continue;
        if ( shootDown && ady <= 0) continue;

        // ── Score this shot ──
        // Factors that make a shot BETTER:
        //  + coin is close to pocket (short push needed)
        //  + ghost ball X aligns well with baseline (small xOffset)
        //  + ghost ball is not too far from striker (reachable with reasonable power)
        const coinToPocket = pLen;
        const xOffset      = Math.abs(gx - strikerX);
        const ghostDist    = Math.sqrt(adx * adx + ady * ady);
        const score = 1000 - coinToPocket * 0.5 - xOffset * 0.8 - ghostDist * 0.1;

        const power = this._calcPower(ghostDist);
        shots.push({ angle, power, strikerX, score });
      }
    }

    return shots;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Bank shot (off side wall)
  // ─────────────────────────────────────────────────────────────────────────

  _bankShot(target, strikerY, shootDown) {
    if (!target) return null;

    // Pick the wall on the same side as the coin
    const wallX = target.x > BOARD.CENTER
      ? BOARD.SIZE - BOARD.BORDER - 20
      : BOARD.BORDER + 20;

    const strikerX = Math.max(STRIKER_LINE.X_MIN, Math.min(STRIKER_LINE.X_MAX,
      BOARD.CENTER + (target.x > BOARD.CENTER ? 60 : -60)
    ));

    const angle = Math.atan2(target.y - strikerY, wallX - strikerX);
    const power = 50 + Math.random() * 25;
    return { angle, power, strikerX, score: 100 };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /** Add difficulty-calibrated noise to the chosen shot */
  _addNoise(shot) {
    const cfg = {
      easy:   { angle: 0.42, x: 28, power: 18 },
      medium: { angle: 0.13, x: 12, power:  8 },
      hard:   { angle: 0.03, x:  3, power:  3 },
    }[this.difficulty] ?? { angle: 0.13, x: 12, power: 8 };

    return {
      angle:   shot.angle   + (Math.random() - 0.5) * cfg.angle,
      power:   Math.max(15, Math.min(95,
               shot.power   + (Math.random() - 0.5) * cfg.power)),
      strikerX: Math.max(STRIKER_LINE.X_MIN, Math.min(STRIKER_LINE.X_MAX,
               shot.strikerX + (Math.random() - 0.5) * cfg.x)),
    };
  }

  /** Pure center-board aim when no good shot found */
  _fallback(strikerY, shootDown) {
    const targetY = BOARD.CENTER;
    const targetX = BOARD.CENTER + (Math.random() - 0.5) * 60;
    const angle   = Math.atan2(targetY - strikerY, targetX - BOARD.CENTER);
    return {
      angle,
      power:    30 + Math.random() * 20,
      strikerX: BOARD.CENTER + (Math.random() - 0.5) * 40,
    };
  }

  /** Power proportional to distance to ghost ball */
  _calcPower(ghostDist) {
    // ghostDist 100 → ~30 power;  600 → ~80 power
    return Math.min(85, Math.max(25, 25 + (ghostDist / 550) * 60));
  }
}
