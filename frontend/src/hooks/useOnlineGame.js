import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { onlineService } from '../network/OnlineService.js';
import { GAME_STATUS, POCKET } from '../constants/gameConstants.js';
import { useSoundManager } from './useSoundManager.js';
import { ClientPhysics } from '../physics/ClientPhysics.js';

/**
 * Hook for online multiplayer.
 *
 * Animation strategy:
 *  - Server broadcasts `shot_result` with `shotParams` (angle, power, strikerX).
 *  - BOTH clients (shooter & receiver) run client-side physics animation from
 *    their current coin positions using those params.
 *  - When animation completes the server's authoritative final state is applied.
 *    This keeps both screens in sync while showing smooth real-time physics.
 */
export function useOnlineGame({ onRoomCreated, onRoomJoined, onGameStart, onShotResult, onGameOver, onDisconnect, onError }) {
  const sound = useSoundManager();
  const physicsRef = useRef(null);

  // Initialise one ClientPhysics instance for animation
  useEffect(() => {
    physicsRef.current = new ClientPhysics();
    return () => physicsRef.current?.destroy();
  }, []);

  // ── Physics animation (runs for both shooter and receiver) ───────────────
  const runShotAnimation = useCallback((shotParams, serverState, foul) => {
    const physics = physicsRef.current;
    const storeState = useGameStore.getState();

    if (!physics || !shotParams) {
      // Fallback: no params — just apply server state directly
      storeState.applyResult(serverState);
      onShotResult?.({ foul });
      return;
    }

    useGameStore.setState({ isSimulating: true });
    physics.loadState(storeState.coins, { x: shotParams.strikerX, y: storeState.strikerPos.y });

    physics.shoot(shotParams.angle, shotParams.power, {
      onPocketed: (id, pos) => {
        sound.playPocket();
        // Immediately hide coin from board so it doesn't ghost
        useGameStore.setState(s => ({
          coins: s.coins.map(c => c.id === id ? { ...c, pocketed: true } : c),
        }));
        // Pocket animation
        const coin = useGameStore.getState().coins.find(c => c.id === id);
        const nearest = POCKET.POSITIONS.reduce((best, p) => {
          const d = Math.hypot(p.x - pos.x, p.y - pos.y);
          return d < best.d ? { p, d } : best;
        }, { p: POCKET.POSITIONS[0], d: Infinity }).p;
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
          duration: 350,
        });
      },
      onTick: (snapshot) => {
        const strikerSnap = snapshot.find(s => s.id === 'striker');
        const coinSnap    = snapshot.filter(s => s.id !== 'striker');
        const currentCoins = useGameStore.getState().coins;
        const updatedCoins = currentCoins.map(c => {
          const live = coinSnap.find(s => s.id === c.id);
          return live ? { ...c, x: live.x, y: live.y } : c;
        });
        useGameStore.setState({
          coins: updatedCoins,
          liveStrikerPos: strikerSnap ? { x: strikerSnap.x, y: strikerSnap.y } : null,
        });
      },
      onComplete: () => {
        useGameStore.setState({ liveStrikerPos: null });
        // Apply authoritative server state — corrects any minor physics divergence
        useGameStore.getState().applyResult(serverState);
        if (foul) sound.playFoul();
        if (serverState.winner) sound.playWin();
        onShotResult?.({ foul });
      },
    });
  }, [sound, onShotResult]);

  useEffect(() => {
    onlineService.connect();

    window.__onRoomCreated = onRoomCreated;
    window.__onRoomJoined = onRoomJoined;
    window.__onGameStart  = onGameStart;

    // shot_result now carries shotParams for animation
    window.__onShotResult = ({ state: serverState, shotParams, foul }) => {
      runShotAnimation(shotParams, serverState, foul);
    };

    window.__onGameOver = (data) => {
      sound.playWin();
      onGameOver?.(data);
    };
    window.__onPlayerDisconnected = onDisconnect;
    window.__onSocketError        = onError;
    window.__onInvalidShot        = ({ reason }) => {
      console.warn('Invalid shot:', reason);
      useGameStore.setState({ isSimulating: false });
    };
    window.__onTurnTimeout = () => {};

    return () => {
      window.__onRoomCreated        = null;
      window.__onRoomJoined         = null;
      window.__onGameStart          = null;
      window.__onShotResult         = null;
      window.__onGameOver           = null;
      window.__onPlayerDisconnected = null;
      window.__onSocketError        = null;
    };
  }, [runShotAnimation, sound, onRoomCreated, onRoomJoined, onGameStart, onGameOver, onDisconnect, onError]);

  const createRoom = useCallback((playerName) => {
    onlineService.createRoom(playerName);
  }, []);

  const joinRoom = useCallback((roomCode, playerName) => {
    onlineService.joinRoom(roomCode, playerName);
  }, []);

  const shoot = useCallback((angle, power, strikerX) => {
    const { roomCode, myPlayerNum, turn, status, isSimulating } = useGameStore.getState();
    if (status !== GAME_STATUS.PLAYING || myPlayerNum !== turn || isSimulating) return;
    // Lock UI — animation starts when shot_result arrives (same trigger for both players)
    useGameStore.setState({ isSimulating: true });
    sound.playShoot();
    onlineService.shoot({ angle, power, strikerX, roomCode });
  }, [sound]);

  const requestRematch = useCallback(() => {
    const { roomCode } = useGameStore.getState();
    onlineService.requestRematch(roomCode);
  }, []);

  return { createRoom, joinRoom, shoot, requestRematch };
}
