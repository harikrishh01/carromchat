import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore.js';
import { useOnlineGame } from '../hooks/useOnlineGame.js';
import { GameCanvas } from '../components/GameCanvas.jsx';
import { GameHUD } from '../components/GameHUD.jsx';
import { WinnerPopup } from '../components/WinnerPopup.jsx';
import { SettingsPanel } from '../components/SettingsPanel.jsx';
import { StrikerBar } from '../components/StrikerBar.jsx';
import { GAME_STATUS } from '../constants/gameConstants.js';

export function OnlineGame() {
  const navigate = useNavigate();
  const store = useGameStore();
  const [showSettings, setShowSettings] = useState(false);
  const [notification, setNotification] = useState('');

  const notify = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  const { shoot, requestRematch } = useOnlineGame({
    onGameStart: () => notify('Game started!'),
    onShotResult: ({ foul }) => { if (foul) notify(`Foul: ${foul.replace(/_/g, ' ')}`); },
    onGameOver: () => {},
    onDisconnect: ({ message }) => notify(message),
    onError: ({ message }) => notify(message),
  });

  const isMyTurn = store.myPlayerNum === store.turn && !store.isSimulating && store.status === GAME_STATUS.PLAYING;

  const handleShoot = useCallback((angle, power, strikerX) => {
    shoot(angle, power, strikerX);
  }, [shoot]);

  const p1 = store.players?.player1?.name || store.player1Name || 'Player 1';
  const p2 = store.players?.player2?.name || store.player2Name || 'Player 2';

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-2 gap-4">
      {/* Top bar */}
      <div className="w-full max-w-2xl flex items-center justify-between px-2">
        <button onClick={() => navigate('/online')} className="text-gray-400 hover:text-white text-sm">
          ← Menu
        </button>
        <div className="text-center">
          <span className="text-yellow-400 font-bold text-sm tracking-widest uppercase">Online Match</span>
          {store.roomCode && <div className="text-gray-500 text-xs">Room: {store.roomCode}</div>}
        </div>
        <button onClick={() => setShowSettings(true)} className="text-gray-400 hover:text-white text-sm">⚙️</button>
      </div>

      {/* My player indicator */}
      <div className="text-xs text-gray-500">
        You are: <span className="text-yellow-400 font-bold">{store.myPlayerNum === 'player1' ? p1 : p2}</span>
        {' '}({store.myPlayerNum === 'player1' ? 'White' : 'Black'})
      </div>

      {/* HUD */}
      <div className="w-full max-w-2xl px-2">
        <GameHUD player1Name={p1} player2Name={p2} shotTimeLeft={15} />
      </div>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center w-full">
        <GameCanvas onShoot={handleShoot} isMyTurn={isMyTurn} />
      </div>

      {/* Striker position bar */}
      <StrikerBar isMyTurn={isMyTurn} />

      {/* Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-xl shadow-lg text-sm z-40 animate-fadeIn">
          {notification}
        </div>
      )}

      {/* Winner popup */}
      {store.status === GAME_STATUS.FINISHED && (
        <WinnerPopup
          player1Name={p1}
          player2Name={p2}
          onRematch={requestRematch}
        />
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <SettingsPanel onClose={() => setShowSettings(false)} />
        </div>
      )}
    </div>
  );
}
