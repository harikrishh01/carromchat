import { useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore.js';

/**
 * Manages Web Audio API sound effects and background music.
 */
export function useSoundManager() {
  const audioCtxRef = useRef(null);
  const bgMusicRef = useRef(null);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  const playTone = useCallback((freq, duration, type = 'sine', gain = 0.3) => {
    const { soundEnabled } = useGameStore.getState();
    if (!soundEnabled) return;
    try {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gainNode.gain.setValueAtTime(gain, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) { /* silently ignore audio errors */ }
  }, [getCtx]);

  const playShoot = useCallback(() => {
    playTone(220, 0.1, 'sawtooth', 0.2);
    setTimeout(() => playTone(180, 0.05, 'square', 0.1), 80);
  }, [playTone]);

  const playPocket = useCallback(() => {
    playTone(440, 0.3, 'sine', 0.4);
    setTimeout(() => playTone(660, 0.2, 'sine', 0.3), 100);
    setTimeout(() => playTone(880, 0.15, 'sine', 0.2), 200);
  }, [playTone]);

  const playFoul = useCallback(() => {
    playTone(120, 0.4, 'square', 0.3);
    setTimeout(() => playTone(100, 0.3, 'sawtooth', 0.2), 200);
  }, [playTone]);

  const playWin = useCallback(() => {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => setTimeout(() => playTone(n, 0.4, 'sine', 0.4), i * 150));
  }, [playTone]);

  const playClick = useCallback(() => {
    playTone(800, 0.05, 'square', 0.15);
  }, [playTone]);

  return { playShoot, playPocket, playFoul, playWin, playClick };
}
