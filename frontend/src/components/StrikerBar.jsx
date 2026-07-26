import { useCallback } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { STRIKER_LINE, BOARD, GAME_STATUS } from '../constants/gameConstants.js';

const RANGE = STRIKER_LINE.X_MAX - STRIKER_LINE.X_MIN; // 200

/**
 * Horizontal bar below the board that lets the player slide the striker
 * left / right along the baseline before shooting.
 * When `flipped` is true (Player 2 in online mode), the slider direction
 * is reversed so left = left on their rotated view.
 */
export function StrikerBar({ isMyTurn, flipped = false }) {
  const { strikerDragX, status, isSimulating } = useGameStore();

  const disabled = !isMyTurn || isSimulating || status !== GAME_STATUS.PLAYING;

  // Map board-X → 0-100 slider value, reversing for flipped board
  const sliderValue = flipped
    ? Math.round(((STRIKER_LINE.X_MAX - strikerDragX) / RANGE) * 100)
    : Math.round(((strikerDragX - STRIKER_LINE.X_MIN) / RANGE) * 100);

  const setStrikerX = useCallback((boardX) => {
    const clamped = Math.max(STRIKER_LINE.X_MIN, Math.min(STRIKER_LINE.X_MAX, boardX));
    useGameStore.setState({ strikerDragX: clamped });
  }, []);

  const handleSlider = (e) => {
    const pct = Number(e.target.value);
    // Reverse mapping for Player 2's flipped view
    const x = flipped
      ? STRIKER_LINE.X_MAX - (pct / 100) * RANGE
      : STRIKER_LINE.X_MIN + (pct / 100) * RANGE;
    setStrikerX(x);
  };

  const nudge = (dir) => {
    const current = useGameStore.getState().strikerDragX;
    // Reverse nudge direction for flipped board
    setStrikerX(current + (flipped ? -dir : dir) * 12);
  };

  return (
    <div className={`w-full max-w-2xl px-2 transition-opacity duration-300 ${disabled ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>

      {/* Label */}
      <div className="flex items-center justify-center gap-1 mb-1">
        <span className="text-xs text-gray-400 tracking-widest uppercase">Striker Position</span>
      </div>

      {/* Bar row */}
      <div className="flex items-center gap-3">

        {/* Left nudge */}
        <button
          onMouseDown={() => nudge(-1)}
          onTouchStart={() => nudge(-1)}
          className="w-9 h-9 rounded-full bg-gray-700 hover:bg-yellow-600 active:scale-90 transition-all flex items-center justify-center text-white font-bold text-lg select-none shrink-0"
          aria-label="Move striker left"
        >
          ‹
        </button>

        {/* Slider track */}
        <div className="relative flex-1 flex items-center h-10">
          {/* Track background */}
          <div className="absolute inset-x-0 h-3 rounded-full bg-gray-700 overflow-hidden">
            {/* Filled portion */}
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-none"
              style={{ width: `${sliderValue}%` }}
            />
          </div>

          {/* Native range input (invisible but functional) */}
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={sliderValue}
            onChange={handleSlider}
            disabled={disabled}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-10"
            style={{ zIndex: 10 }}
            aria-label="Striker horizontal position"
          />

          {/* Custom thumb */}
          <div
            className="absolute w-7 h-7 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 border-2 border-yellow-400 shadow-lg shadow-yellow-900/40 pointer-events-none transition-none"
            style={{ left: `calc(${sliderValue}% - 14px)` }}
          >
            {/* Inner ring */}
            <div className="w-3 h-3 rounded-full bg-gray-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Right nudge */}
        <button
          onMouseDown={() => nudge(1)}
          onTouchStart={() => nudge(1)}
          className="w-9 h-9 rounded-full bg-gray-700 hover:bg-yellow-600 active:scale-90 transition-all flex items-center justify-center text-white font-bold text-lg select-none shrink-0"
          aria-label="Move striker right"
        >
          ›
        </button>
      </div>

      {/* Position markers */}
      <div className="flex justify-between px-12 mt-0.5">
        <span className="text-[10px] text-gray-600">Left</span>
        <span className="text-[10px] text-gray-500">Center</span>
        <span className="text-[10px] text-gray-600">Right</span>
      </div>
    </div>
  );
}
