import { useCallback, useRef } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { BOARD, STRIKER_LINE } from '../constants/gameConstants.js';

/**
 * Hook to manage striker aiming input on the canvas.
 *
 * Interaction model:
 *  1. Striker X is set by the StrikerBar slider (or clicking the canvas).
 *  2. Pointer DOWN on canvas – locks current strikerDragX as the aim origin.
 *  3. Pointer MOVE           – aim angle from locked origin; power = distance.
 *  4. Pointer UP             – shoot.
 */
export function useAimInput({ canvasRef, boardScale, onShoot }) {
  const isDragging = useRef(false);
  // Holds the X position locked at pointer-down (from slider or canvas click)
  const lockedStrikerX = useRef(BOARD.CENTER);

  const toBoard = useCallback((clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const scale = boardScale || (rect.width / BOARD.SIZE);
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  }, [canvasRef, boardScale]);

  const onPointerDown = useCallback((e) => {
    const { isSimulating, status, strikerDragX } = useGameStore.getState();
    if (isSimulating || status !== 'playing') return;
    e.preventDefault();

    // Lock the striker at whatever position the slider last set (or center by default).
    // The canvas click does NOT reposition the striker – use the StrikerBar for that.
    lockedStrikerX.current = strikerDragX ?? BOARD.CENTER;

    isDragging.current = true;
    useGameStore.setState({ isAiming: true, power: 10 });
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    e.preventDefault();

    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    const pos = toBoard(clientX, clientY);

    // Aim origin is the LOCKED striker position
    const sx = lockedStrikerX.current;
    const sy = useGameStore.getState().strikerPos.y;

    // Angle: direction from striker to cursor
    const angle = Math.atan2(pos.y - sy, pos.x - sx);

    // Power: distance from striker position to cursor
    const dx = pos.x - sx;
    const dy = pos.y - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const power = Math.min(100, Math.max(5, dist * 0.65));

    useGameStore.setState({ aimAngle: angle, power });
  }, [toBoard]);

  const onPointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const state = useGameStore.getState();
    useGameStore.setState({ isAiming: false });
    // Shoot from the locked striker X
    onShoot?.(state.aimAngle, state.power, lockedStrikerX.current);
  }, [onShoot]);

  return { onPointerDown, onPointerMove, onPointerUp };
}
