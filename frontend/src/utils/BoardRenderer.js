import { BOARD, POCKET, COIN, STRIKER, COLORS, STRIKER_LINE, COIN_COLORS, TURN } from '../constants/gameConstants.js';

/**
 * Renders the carrom board and all game pieces onto a Canvas 2D context.
 */
export class BoardRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  /** Main render call - call every frame */
  render(state, uiState) {
    const ctx = this.ctx;
    const { coins, strikerPos, queenCoverPending, liveStrikerPos, pocketAnimations } = state;
    const { aimAngle, power, isAiming, strikerDragX, turn, aimCursorPos } = uiState;

    ctx.clearRect(0, 0, BOARD.SIZE, BOARD.SIZE);

    this._drawBoard();
    this._drawPockets();
    this._drawDividers();
    this._drawCenterCircles();
    this._drawStrikerLines(turn);

    // Draw coins (non-pocketed)
    coins.filter(c => !c.pocketed).forEach(coin => this._drawCoin(coin, queenCoverPending));

    // Determine striker render position:
    //  1. During simulation → use live physics position (striker actually moves)
    //  2. Aiming           → striker is at the clicked X on the baseline
    //  3. Idle             → center of the baseline
    const strikerRenderX = liveStrikerPos?.x ?? (strikerDragX ?? strikerPos.x);
    const strikerRenderY = liveStrikerPos?.y ?? strikerPos.y;

    // Draw aim line only when not simulating
    if (isAiming && !liveStrikerPos) {
      this._drawSlingshot(strikerRenderX, strikerRenderY, aimAngle, power, aimCursorPos);
    }

    // Draw striker (moves with physics during simulation)
    this._drawStriker(strikerRenderX, strikerRenderY);

    // Pocket animations – drawn on top of everything
    if (pocketAnimations?.length) {
      pocketAnimations.forEach(a => this._drawPocketAnimation(a));
    }
  }

  _drawBoard() {
    const ctx = this.ctx;
    const { SIZE, BORDER } = BOARD;

    // Outer frame
    const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    grad.addColorStop(0, '#6b3a1f');
    grad.addColorStop(0.5, '#8B4513');
    grad.addColorStop(1, '#5a2e0d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Inner play area
    const playGrad = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
    playGrad.addColorStop(0, '#e8d4a0');
    playGrad.addColorStop(0.7, '#dcc48a');
    playGrad.addColorStop(1, '#c9a855');
    ctx.fillStyle = playGrad;
    ctx.fillRect(BORDER, BORDER, BOARD.PLAY_AREA, BOARD.PLAY_AREA);

    // Diagonal lines
    ctx.strokeStyle = '#c4a035';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(BORDER, BORDER);
    ctx.lineTo(SIZE - BORDER, SIZE - BORDER);
    ctx.moveTo(SIZE - BORDER, BORDER);
    ctx.lineTo(BORDER, SIZE - BORDER);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawPockets() {
    const ctx = this.ctx;
    POCKET.POSITIONS.forEach(pos => {
      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 10;

      // Outer ring
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, POCKET.RADIUS + 4, 0, Math.PI * 2);
      ctx.fillStyle = '#3a1a00';
      ctx.fill();

      // Pocket hole
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, POCKET.RADIUS, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, POCKET.RADIUS);
      grad.addColorStop(0, '#000000');
      grad.addColorStop(0.8, '#0a0a0a');
      grad.addColorStop(1, '#1a0a00');
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.shadowBlur = 0;
    });
  }

  _drawDividers() {
    const ctx = this.ctx;
    const { SIZE, BORDER, CENTER } = BOARD;

    ctx.strokeStyle = '#c4a035';
    ctx.lineWidth = 2;

    // Border inner lines
    const innerBorder = BORDER + 8;
    ctx.strokeRect(innerBorder, innerBorder, SIZE - innerBorder * 2, SIZE - innerBorder * 2);

    // Cross lines
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CENTER, BORDER);
    ctx.lineTo(CENTER, SIZE - BORDER);
    ctx.moveTo(BORDER, CENTER);
    ctx.lineTo(SIZE - BORDER, CENTER);
    ctx.stroke();
  }

  _drawCenterCircles() {
    const ctx = this.ctx;
    const { CENTER } = BOARD;

    // Outer circle
    ctx.strokeStyle = '#c4a035';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, 100, 0, Math.PI * 2);
    ctx.stroke();

    // Middle circle
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, 60, 0, Math.PI * 2);
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, 25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(196, 160, 53, 0.15)';
    ctx.fill();
    ctx.stroke();
  }

  _drawStrikerLines(turn) {
    const ctx = this.ctx;

    const drawLine = (y, alpha, isActive) => {
      ctx.strokeStyle = `rgba(196, 160, 53, ${alpha})`;
      ctx.lineWidth = 2;

      // Full baseline
      ctx.beginPath();
      ctx.moveTo(STRIKER_LINE.X_MIN - 20, y);
      ctx.lineTo(STRIKER_LINE.X_MAX + 20, y);
      ctx.stroke();

      // Small arcs at edges (carrom standard)
      ctx.beginPath();
      ctx.arc(STRIKER_LINE.X_MIN - 20, y, 10, Math.PI / 2, -Math.PI / 2, turn === TURN.PLAYER1 ? false : true);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(STRIKER_LINE.X_MAX + 20, y, 10, -Math.PI / 2, Math.PI / 2, turn === TURN.PLAYER1 ? false : true);
      ctx.stroke();

      // Valid striker zone highlight (between the two inner arcs)
      if (isActive) {
        ctx.beginPath();
        ctx.moveTo(STRIKER_LINE.X_MIN, y);
        ctx.lineTo(STRIKER_LINE.X_MAX, y);
        ctx.strokeStyle = `rgba(255, 255, 120, 0.5)`;
        ctx.lineWidth = 4;
        ctx.stroke();

        // End-cap dots
        ctx.fillStyle = 'rgba(255, 255, 120, 0.7)';
        ctx.beginPath();
        ctx.arc(STRIKER_LINE.X_MIN, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(STRIKER_LINE.X_MAX, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    drawLine(STRIKER_LINE.Y_BOTTOM, turn === 'player1' ? 1 : 0.3, turn === 'player1');
    drawLine(STRIKER_LINE.Y_TOP,    turn === 'player2' ? 1 : 0.3, turn === 'player2');
  }

  _drawCoin(coin, queenPending) {
    const ctx = this.ctx;
    const { x, y } = coin;
    const r = COIN.RADIUS;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    // Outer ring
    let outerColor, innerColor, textColor;
    if (coin.id === 'queen') {
      outerColor = '#8b0000';
      innerColor = '#cc0000';
      textColor = '#ffcc00';
    } else if (coin.color === COIN_COLORS.BLACK) {
      outerColor = '#111';
      innerColor = '#2a2a2a';
      textColor = '#ffffff';
    } else {
      outerColor = '#b8a060';
      innerColor = '#f5f0dc';
      textColor = '#333';
    }

    // Body
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    grad.addColorStop(0, innerColor);
    grad.addColorStop(1, outerColor);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Rim
    ctx.strokeStyle = outerColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.strokeStyle = coin.id === 'queen' ? '#ffcc00' : (coin.color === COIN_COLORS.BLACK ? '#555' : '#c4a035');
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Queen glow when cover pending
    if (coin.id === 'queen' && queenPending) {
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(x, y, r + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,102,0,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawStriker(x, y) {
    const ctx = this.ctx;
    const r = STRIKER.RADIUS;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;

    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    grad.addColorStop(0, '#e0e0e0');
    grad.addColorStop(0.6, '#aaaaaa');
    grad.addColorStop(1, '#666666');

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  _drawAimLine(sx, sy, angle, power) {
    const ctx = this.ctx;
    const len = 60 + power * 2;
    const ex = sx + Math.cos(angle) * len;
    const ey = sy + Math.sin(angle) * len;

    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = `rgba(255, 255, 100, ${0.4 + power / 200})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead
    const arrowLen = 10;
    const arrowAngle = 0.4;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - Math.cos(angle - arrowAngle) * arrowLen, ey - Math.sin(angle - arrowAngle) * arrowLen);
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - Math.cos(angle + arrowAngle) * arrowLen, ey - Math.sin(angle + arrowAngle) * arrowLen);
    ctx.strokeStyle = 'rgba(255, 255, 100, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Slingshot visual:
   *  - Rubber-band line from cursor (pull point) to striker
   *  - Forward aim arrow extending from striker
   *  - Pull-handle dot at cursor position
   */
  _drawSlingshot(sx, sy, shotAngle, power, cursorPos) {
    const ctx = this.ctx;

    // ── 1. Rubber-band (pull-back line) ──────────────────────────────────
    if (cursorPos) {
      const cx = cursorPos.x;
      const cy = cursorPos.y;

      // Elastic line from cursor to striker
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sx, sy);
      ctx.strokeStyle = `rgba(255, 180, 60, ${0.5 + power / 200})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.lineCap = 'round';
      ctx.stroke();

      // Pull handle – glowing dot at cursor
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
      glow.addColorStop(0, 'rgba(255, 200, 80, 0.8)');
      glow.addColorStop(1, 'rgba(255, 140, 0, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Solid centre dot
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 200, 80, 0.95)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
    }

    // ── 2. Forward aim arrow (shot direction) ────────────────────────────
    const aimLen  = 55 + power * 1.8;
    const ex = sx + Math.cos(shotAngle) * aimLen;
    const ey = sy + Math.sin(shotAngle) * aimLen;

    ctx.save();
    // Dotted aim line
    ctx.setLineDash([9, 6]);
    ctx.strokeStyle = `rgba(255, 255, 100, ${0.35 + power / 180})`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead at the tip
    const arrowLen = 12;
    const arrowSpread = 0.42;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(
      ex - Math.cos(shotAngle - arrowSpread) * arrowLen,
      ey - Math.sin(shotAngle - arrowSpread) * arrowLen,
    );
    ctx.moveTo(ex, ey);
    ctx.lineTo(
      ex - Math.cos(shotAngle + arrowSpread) * arrowLen,
      ey - Math.sin(shotAngle + arrowSpread) * arrowLen,
    );
    ctx.strokeStyle = 'rgba(255, 255, 80, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
  }

  // ─── Pocket animation ────────────────────────────────────────────────────

  _drawPocketAnimation(anim) {
    const ctx = this.ctx;
    const elapsed = Date.now() - anim.startTime;
    const raw = Math.min(elapsed / anim.duration, 1);   // 0 → 1 linear

    // Ease-in quart: very slow start, then rockets into the hole
    // Feels like the pocket is sucking the coin in
    const t = raw * raw * raw * raw;

    // Coin travels from start pos to pocket center
    const x = anim.x + (anim.pocketX - anim.x) * t;
    const y = anim.y + (anim.pocketY - anim.y) * t;

    // Scale: shrinks faster in the second half (t² curve on scale)
    const scale = Math.max(0, 1 - raw * raw);
    const r = COIN.RADIUS * scale;

    // Spin angle – 1.5 rotations over the animation
    const spin = raw * Math.PI * 3;

    // ── Draw ripple rings bursting from pocket ──
    this._drawPocketRipple(anim.pocketX, anim.pocketY, raw, anim.isQueen);

    // ── Draw sparks that fly outward ──
    if (raw < 0.4) {
      this._drawPocketSparks(anim, raw);
    }

    if (r < 0.5) return; // fully hidden

    // ── Draw the coin itself, shrinking + spinning ──
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.globalAlpha = Math.max(0, 1 - t * 1.2);

    // Colors per coin type
    let outerC, innerC, ringC;
    if (anim.isQueen) {
      outerC = '#8b0000'; innerC = '#cc0000'; ringC = '#ffcc00';
    } else if (anim.color === 'black') {
      outerC = '#111';    innerC = '#2a2a2a'; ringC = '#555';
    } else {
      outerC = '#b8a060'; innerC = '#f5f0dc'; ringC = '#c4a035';
    }

    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    grad.addColorStop(0, innerC);
    grad.addColorStop(1, outerC);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = outerC;
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.strokeStyle = ringC;
    ctx.lineWidth = 1.2 * scale;
    ctx.stroke();

    ctx.restore();
  }

  _drawPocketRipple(px, py, t, isQueen) {
    const ctx = this.ctx;
    const baseColor = isQueen ? '255, 120, 0' : '255, 220, 60';

    // Three rings – each staggered slightly, expand and fade fast
    for (let i = 0; i < 3; i++) {
      const phase = Math.min((t - i * 0.10) / 0.55, 1);
      if (phase <= 0) continue;

      const r = POCKET.RADIUS * (1 + phase * 2.0);
      const alpha = (1 - phase) * (i === 0 ? 0.9 : i === 1 ? 0.6 : 0.35);

      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${baseColor}, ${alpha})`;
      ctx.lineWidth = Math.max(0.5, 3 - i * 0.8);
      ctx.stroke();
      ctx.restore();
    }

    // Brief intense glow right at entry (first 40% of animation)
    if (t < 0.4) {
      const glowAlpha = (1 - t / 0.4) * 0.65;
      ctx.save();
      const glow = ctx.createRadialGradient(px, py, 0, px, py, POCKET.RADIUS * 1.8);
      glow.addColorStop(0, `rgba(${isQueen ? '255,80,0' : '255,230,80'}, ${glowAlpha})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(px, py, POCKET.RADIUS * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.restore();
    }
  }

  _drawPocketSparks(anim, t) {
    const ctx = this.ctx;
    // 8 sparks radiate outward from where the coin was pocketed
    const count = 8;
    const maxDist = 22;
    const alpha = (1 - t / 0.4) * 0.9;
    const sparkColor = anim.isQueen ? '255,140,0' : (anim.color === 'black' ? '180,180,180' : '245,220,120');

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = t * maxDist / 0.4;
      const sx = anim.pocketX + Math.cos(angle) * dist;
      const sy = anim.pocketY + Math.sin(angle) * dist;
      const size = 2.5 * (1 - t / 0.4);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${sparkColor}, 1)`;
      ctx.fill();
      ctx.restore();
    }
  }

  /** @deprecated – replaced by _drawPocketAnimation */
  _drawParticle() {}
}
