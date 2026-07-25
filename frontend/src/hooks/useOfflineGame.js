import { useRef, useCallback, useEffect } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { ClientPhysics } from '../physics/ClientPhysics.js';
import { OfflineGameService } from '../services/OfflineGameService.js';
import { CarromAI } from '../services/CarromAI.js';
import { TURN, GAME_STATUS, POCKET } from '../constants/gameConstants.js';
import { useSoundManager } from './useSoundManager.js';

/**
 * Core game logic hook for offline mode.
 * Manages physics, AI, turn flow.
 */
export function useOfflineGame() {
  const physicsRef = useRef(null);
  const aiRef = useRef(null);
  const store = useGameStore();
  const sound = useSoundManager();

  // Init physics engine once
  useEffect(() => {
    physicsRef.current = new ClientPhysics();
    return () => physicsRef.current?.destroy();
  }, []);

  // Reinit AI when difficulty changes
  useEffect(() => {
    aiRef.current = new CarromAI(store.difficulty);
  }, [store.difficulty]);

  const shoot = useCallback((angle, power, strikerX) => {
    const state = useGameStore.getState();
    if (state.isSimulating || state.status !== GAME_STATUS.PLAYING) return;

    useGameStore.setState({ isSimulating: true });
    sound.playShoot();

    // Load state into physics
    const physics = physicsRef.current;
    physics.loadState(state.coins, { x: strikerX, y: state.strikerPos.y });

    physics.shoot(angle, power, {
      onPocketed: (id, pos) => {
        sound.playPocket();

        // ── Key fix: immediately hide the coin from the main board renderer ──
        // Without this the coin "ghost" stays visible at its last physics
        // position until ALL pieces stop (up to 3-4 s).
        useGameStore.setState(s => ({
          coins: s.coins.map(c => c.id === id ? { ...c, pocketed: true } : c),
        }));

        // Find the nearest pocket corner so the animation targets it correctly
        const nearest = POCKET.POSITIONS.reduce((best, p) => {
          const d = Math.hypot(p.x - pos.x, p.y - pos.y);
          return d < best.d ? { p, d } : best;
        }, { p: POCKET.POSITIONS[0], d: Infinity }).p;

        const coin = useGameStore.getState().coins.find(c => c.id === id);

        useGameStore.getState().addPocketAnimation({
          id: `${id}_${Date.now()}`,
          coinId: id,
          color: coin?.color ?? 'black',
          isQueen: id === 'queen',
          x: pos.x,
          y: pos.y,
          pocketX: nearest.x,
          pocketY: nearest.y,
          startTime: Date.now(),
          duration: 350,  // fast, snappy – coin is gone in under 1 second
        });
      },
      onTick: (snapshot) => {
        // Separate striker from coin data in the snapshot
        const strikerSnap = snapshot.find(s => s.id === 'striker');
        const coinSnap    = snapshot.filter(s => s.id !== 'striker');

        // Update coin positions for live rendering
        const currentCoins = useGameStore.getState().coins;
        const updatedCoins = currentCoins.map(c => {
          const live = coinSnap.find(s => s.id === c.id);
          return live ? { ...c, x: live.x, y: live.y } : c;
        });

        useGameStore.setState({
          coins: updatedCoins,
          // Drive the striker's visual position from physics every frame
          liveStrikerPos: strikerSnap ? { x: strikerSnap.x, y: strikerSnap.y } : null,
        });
      },
      onComplete: ({ pocketed, strikerPocketed }) => {
        const currentState = useGameStore.getState();
        const result = OfflineGameService.processResult(currentState, { pocketed, strikerPocketed });
        // Clear live striker position – it snaps back to the new-turn baseline via strikerPos
        useGameStore.setState({ liveStrikerPos: null });
        store.applyResult(result);

        if (result.foul) sound.playFoul();
        if (result.winner) sound.playWin();

        // If next turn is AI, trigger AI shot after delay
        if (result.status === GAME_STATUS.PLAYING && result.turn === TURN.PLAYER2) {
          setTimeout(() => triggerAIShot(), 300);
        }
      },
    });
  }, [sound]);

  const triggerAIShot = useCallback(() => {
    const state = useGameStore.getState();
    if (state.status !== GAME_STATUS.PLAYING || state.turn !== TURN.PLAYER2) return;

    const ai = aiRef.current;
    if (!ai) return;

    const aiShot = ai.calculateShot(state);
    shoot(aiShot.angle, aiShot.power, aiShot.strikerX);
  }, [shoot]);

  return { shoot, triggerAIShot };
}
