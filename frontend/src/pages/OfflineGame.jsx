import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore.js';
import { useOfflineGame } from '../hooks/useOfflineGame.js';
import { GameCanvas } from '../components/GameCanvas.jsx';
import { GameHUD } from '../components/GameHUD.jsx';
import { WinnerPopup } from '../components/WinnerPopup.jsx';
import { SettingsPanel } from '../components/SettingsPanel.jsx';
import { StrikerBar } from '../components/StrikerBar.jsx';
import { GAME_STATUS, TURN } from '../constants/gameConstants.js';

export function OfflineGame() {
  const navigate = useNavigate();
  const { shoot, triggerAIShot } = useOfflineGame();
  const store = useGameStore();
  const [showSettings, setShowSettings] = useState(false);
  const [shotTimeLeft, setShotTimeLeft] = useState(15);
  const timerRef = useRef(null);

  // Start AI if it's AI's turn at game start
  useEffect(() => {
    if (store.status === GAME_STATUS.PLAYING && store.turn === TURN.PLAYER2) {
      setTimeout(() => triggerAIShot(), 800);
    }
  }, [store.status]);

  // Shot countdown timer (player 1 only)
  useEffect(() => {
    if (store.status !== GAME_STATUS.PLAYING || store.turn !== TURN.PLAYER1 || store.isSimulating) {
      clearInterval(timerRef.current);
      setShotTimeLeft(15);
      return;
    }

    setShotTimeLeft(15);
    timerRef.current = setInterval(() => {
      setShotTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          // Auto-skip: switch turn
          useGameStore.setState(s => ({
            turn: TURN.PLAYER2,
            strikerPos: { x: 400, y: 120 },
          }));
          setTimeout(() => triggerAIShot(), 600);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [store.turn, store.isSimulating, store.status]);

  const handleShoot = useCallback((angle, power, strikerX) => {
    if (store.turn !== TURN.PLAYER1) return;
    shoot(angle, power, strikerX);
  }, [store.turn, shoot]);

  const handleRestart = () => {
    store.startGame();
    setShotTimeLeft(15);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-2 gap-4">
      {/* Top bar */}
      <div className="w-full max-w-2xl flex items-center justify-between px-2">
        <button
          onClick={() => navigate('/offline')}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          ← Menu
        </button>
        <span className="text-yellow-400 font-bold text-sm tracking-widest uppercase">Offline Match</span>
        <button
          onClick={() => setShowSettings(true)}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          ⚙️
        </button>
      </div>

      {/* HUD */}
      <div className="w-full max-w-2xl px-2">
        <GameHUD
          player1Name={store.player1Name}
          player2Name={store.player2Name}
          shotTimeLeft={shotTimeLeft}
        />
      </div>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center w-full">
        <GameCanvas
          onShoot={handleShoot}
          isMyTurn={store.turn === TURN.PLAYER1 && !store.isSimulating}
        />
      </div>

      {/* Striker position bar */}
      <StrikerBar isMyTurn={store.turn === TURN.PLAYER1 && !store.isSimulating} />

      {/* Winner popup */}
      {store.status === GAME_STATUS.FINISHED && (
        <WinnerPopup
          player1Name={store.player1Name}
          player2Name={store.player2Name}
          onRestart={handleRestart}
        />
      )}

      {/* Settings */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <SettingsPanel onClose={() => setShowSettings(false)} />
        </div>
      )}
    </div>
  );
}
