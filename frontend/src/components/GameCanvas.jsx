import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { BoardRenderer } from '../utils/BoardRenderer.js';
import { useAimInput } from '../hooks/useAimInput.js';
import { BOARD, TURN, GAME_STATUS } from '../constants/gameConstants.js';

/**
 * The main game canvas component.
 * Renders board via BoardRenderer and handles input via useAimInput.
 */
export function GameCanvas({ onShoot, isMyTurn = true }) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const animFrameRef = useRef(null);
  const store = useGameStore();

  // Init renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    rendererRef.current = new BoardRenderer(canvas);
  }, []);

  // Render loop
  useEffect(() => {
    const loop = () => {
      const renderer = rendererRef.current;
      if (!renderer) { animFrameRef.current = requestAnimationFrame(loop); return; }

      const state = useGameStore.getState();
      renderer.render(
        {
          coins: state.coins,
          strikerPos: state.strikerPos,
          queenCoverPending: state.queenCoverPending,
          liveStrikerPos: state.liveStrikerPos,
          pocketAnimations: state.pocketAnimations,
        },
        {
          aimAngle: state.aimAngle,
          power: state.power,
          isAiming: state.isAiming,
          strikerDragX: state.strikerDragX,
          turn: state.turn,
          particles: state.particles,
        }
      );

      // GC finished pocket animations
      if (state.pocketAnimations.length > 0) {
        useGameStore.getState().clearFinishedPocketAnimations();
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const handleShoot = useCallback((angle, power, strikerX) => {
    if (!isMyTurn) return;
    onShoot?.(angle, power, strikerX);
  }, [isMyTurn, onShoot]);

  const { onPointerDown, onPointerMove, onPointerUp } = useAimInput({
    canvasRef,
    onShoot: handleShoot,
  });

  return (
    <canvas
      ref={canvasRef}
      width={BOARD.SIZE}
      height={BOARD.SIZE}
      className="touch-none select-none"
      style={{
        maxWidth: '100%',
        maxHeight: '100%',
        aspectRatio: '1 / 1',
        cursor: isMyTurn && store.status === GAME_STATUS.PLAYING ? 'crosshair' : 'default',
        borderRadius: '4px',
        boxShadow: '0 0 40px rgba(0,0,0,0.8)',
      }}
      onMouseDown={onPointerDown}
      onMouseMove={onPointerMove}
      onMouseUp={onPointerUp}
      onTouchStart={onPointerDown}
      onTouchMove={onPointerMove}
      onTouchEnd={onPointerUp}
    />
  );
}
