import { useCallback, useRef } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { BOARD, STRIKER_LINE } from '../constants/gameConstants.js';

/**
 * Hook to manage striker aiming input on the canvas.
 *
 * Slingshot mechanic (matches mobile carrom games):
 *  1. Striker X is set by the StrikerBar slider.
 *  2. Pointer DOWN  – lock striker position.
 *  3. Pointer MOVE  – drag BACKWARD; shot angle = OPPOSITE of drag direction.
 *                     The further you pull, the more power.
 *  4. Pointer UP    – release to shoot forward.
 */
export function useAimInput({ canvasRef, boardScale, flipped = false, onShoot }) {
  const isDragging  = useRef(false);
  const lockedStrikerX = useRef(BOARD.CENTER);

  const toBoard = useCallback((clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const scale = boardScale || (rect.width / BOARD.SIZE);
    const rawX = (clientX - rect.left) / scale;
    const rawY = (clientY - rect.top)  / scale;
    // For a 180°-flipped canvas, screen coords are inverted in both axes
    return flipped
      ? { x: BOARD.SIZE - rawX, y: BOARD.SIZE - rawY }
      : { x: rawX, y: rawY };
  }, [canvasRef, boardScale, flipped]);

  const onPointerDown = useCallback((e) => {
    const { isSimulating, status, strikerDragX } = useGameStore.getState();
    if (isSimulating || status !== 'playing') return;
    e.preventDefault();

    lockedStrikerX.current = strikerDragX ?? BOARD.CENTER;
    isDragging.current = true;
    useGameStore.setState({ isAiming: true, power: 10, aimCursorPos: null });
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    e.preventDefault();

    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    const pos = toBoard(clientX, clientY);

    const sx = lockedStrikerX.current;
    const sy = useGameStore.getState().strikerPos.y;

    const dx = pos.x - sx;
    const dy = pos.y - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // SLINGSHOT: user drags backward; shot fires in the OPPOSITE direction
    const pullAngle = Math.atan2(dy, dx);          // direction user dragged
    const shotAngle = pullAngle + Math.PI;          // shot goes the other way

    const power = Math.min(100, Math.max(5, dist * 0.65));

    useGameStore.setState({
      aimAngle: shotAngle,
      power,
      aimCursorPos: { x: pos.x, y: pos.y },        // cursor pos for rubber-band draw
    });
  }, [toBoard]);

  const onPointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const state = useGameStore.getState();
    useGameStore.setState({ isAiming: false, aimCursorPos: null });
    onShoot?.(state.aimAngle, state.power, lockedStrikerX.current);
  }, [onShoot]);

  return { onPointerDown, onPointerMove, onPointerUp };
}
