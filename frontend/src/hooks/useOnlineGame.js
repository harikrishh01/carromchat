import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { onlineService } from '../network/OnlineService.js';
import { GAME_STATUS, TURN } from '../constants/gameConstants.js';
import { useSoundManager } from './useSoundManager.js';

/**
 * Hook for online multiplayer.
 * Connects to server, registers event callbacks, exposes shoot/rematch.
 */
export function useOnlineGame({ onRoomCreated, onRoomJoined, onGameStart, onShotResult, onGameOver, onDisconnect, onError }) {
  const store = useGameStore();
  const sound = useSoundManager();
  const registeredRef = useRef(false);

  useEffect(() => {
    const socket = onlineService.connect();

    // Register window callbacks consumed by OnlineService
    window.__onRoomCreated = onRoomCreated;
    window.__onRoomJoined = onRoomJoined;
    window.__onGameStart = onGameStart;
    window.__onShotResult = ({ pocketed, foul }) => {
      if (pocketed?.length > 0) sound.playPocket();
      if (foul) sound.playFoul();
      onShotResult?.({ pocketed, foul });
    };
    window.__onGameOver = (data) => {
      sound.playWin();
      onGameOver?.(data);
    };
    window.__onPlayerDisconnected = onDisconnect;
    window.__onSocketError = onError;
    window.__onInvalidShot = ({ reason }) => console.warn('Invalid shot:', reason);
    window.__onTurnTimeout = () => {};

    return () => {
      // Clean up window callbacks but keep socket alive until explicit disconnect
      window.__onRoomCreated = null;
      window.__onRoomJoined = null;
      window.__onGameStart = null;
      window.__onShotResult = null;
      window.__onGameOver = null;
      window.__onPlayerDisconnected = null;
      window.__onSocketError = null;
    };
  }, []);

  const createRoom = useCallback((playerName) => {
    onlineService.createRoom(playerName);
  }, []);

  const joinRoom = useCallback((roomCode, playerName) => {
    onlineService.joinRoom(roomCode, playerName);
  }, []);

  const shoot = useCallback((angle, power, strikerX) => {
    const { roomCode, myPlayerNum, turn, status, isSimulating } = useGameStore.getState();
    // Hard guards: wrong turn, game not active, or already waiting for server response
    if (status !== GAME_STATUS.PLAYING || myPlayerNum !== turn || isSimulating) return;

    // Immediately lock the UI so this player cannot shoot again until server responds
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
