import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore.js';
import { TURN } from '../constants/gameConstants.js';

// Confetti colours
const CONFETTI_COLORS = [
  '#facc15', '#f97316', '#22c55e', '#3b82f6',
  '#a855f7', '#ec4899', '#ef4444', '#06b6d4',
];

function ConfettiCanvas() {
  const canvasRef = useRef(null);
  const pieces   = useRef([]);
  const rafRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Spawn 160 pieces from the top
    pieces.current = Array.from({ length: 160 }, (_, i) => ({
      x:     Math.random() * window.innerWidth,
      y:     -10 - Math.random() * 200,
      w:     6 + Math.random() * 8,
      h:     10 + Math.random() * 10,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rot:   Math.random() * Math.PI * 2,
      vx:    (Math.random() - 0.5) * 3,
      vy:    2 + Math.random() * 4,
      vrot:  (Math.random() - 0.5) * 0.2,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.05 + Math.random() * 0.05,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.current.forEach(p => {
        p.wobble += p.wobbleSpeed;
        p.x  += p.vx + Math.sin(p.wobble) * 0.8;
        p.y  += p.vy;
        p.rot += p.vrot;
        p.vy  = Math.min(p.vy + 0.05, 8); // gentle gravity

        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.88;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 49 }}
    />
  );
}

/**
 * Full-screen winner celebration with confetti + medal popup.
 */
export function WinnerPopup({ player1Name, player2Name, onRestart, onRematch }) {
  const { winner, scores } = useGameStore();
  const navigate = useNavigate();

  const isP1Win    = winner === TURN.PLAYER1;
  const winnerName = isP1Win ? player1Name : player2Name;
  const loserName  = isP1Win ? player2Name : player1Name;
  const wScore     = isP1Win ? scores.player1 : scores.player2;
  const lScore     = isP1Win ? scores.player2 : scores.player1;

  return (
    <>
      {/* Confetti layer */}
      <ConfettiCanvas />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
           style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>

        <div
          className="relative w-full max-w-sm rounded-3xl text-center overflow-hidden shadow-2xl animate-fadeIn"
          style={{
            background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            border: '2px solid rgba(250,204,21,0.6)',
          }}
        >
          {/* Top glow band */}
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#f97316,#facc15,#22c55e,#3b82f6,#a855f7)' }} />

          <div className="p-8">
            {/* Medal */}
            <div className="relative mb-2">
              <div className="text-8xl leading-none select-none animate-bounce">🏆</div>
              <div className="absolute -top-1 -right-1 text-3xl animate-spin" style={{ animationDuration: '3s' }}>✨</div>
              <div className="absolute -top-1 -left-1 text-2xl animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}>🎊</div>
            </div>

            {/* Winner name */}
            <div className="mt-3 mb-1">
              <div className="text-xs tracking-[0.3em] text-yellow-400 uppercase font-bold mb-1">Champion</div>
              <h2
                className="text-4xl font-black tracking-tight"
                style={{
                  background: 'linear-gradient(90deg, #facc15, #f97316, #facc15)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {winnerName}
              </h2>
            </div>

            {/* Scoreboard */}
            <div className="flex items-center justify-center gap-4 my-5">
              <div className="text-center">
                <div className="text-3xl font-black text-white">{wScore}</div>
                <div className="text-xs text-gray-400 mt-0.5">{winnerName}</div>
              </div>
              <div className="text-gray-600 text-2xl font-bold">vs</div>
              <div className="text-center">
                <div className="text-3xl font-black text-gray-500">{lScore}</div>
                <div className="text-xs text-gray-500 mt-0.5">{loserName}</div>
              </div>
            </div>

            {/* Compliment */}
            <div className="text-sm text-gray-400 mb-6 italic">
              {wScore - lScore >= 6
                ? '🔥 Dominant victory!'
                : wScore - lScore >= 3
                ? '⚡ Well played!'
                : '🎯 Close match!'}
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-3">
              {onRematch && (
                <button
                  onClick={onRematch}
                  className="w-full py-3 rounded-2xl font-black text-base text-black transition-all active:scale-95"
                  style={{ background: 'linear-gradient(90deg,#facc15,#f97316)' }}
                >
                  🔁 Rematch
                </button>
              )}
              {onRestart && (
                <button
                  onClick={onRestart}
                  className="w-full py-3 rounded-2xl font-black text-base text-white bg-emerald-600 hover:bg-emerald-500 transition-all active:scale-95"
                >
                  🎮 Play Again
                </button>
              )}
              <button
                onClick={() => navigate('/')}
                className="w-full py-3 rounded-2xl font-bold text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all active:scale-95"
              >
                ← Main Menu
              </button>
            </div>
          </div>

          {/* Bottom glow band */}
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#a855f7,#3b82f6,#22c55e,#facc15,#f97316)' }} />
        </div>
      </div>
    </>
  );
}

