import { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore.js';
import { useOnlineGame } from '../hooks/useOnlineGame.js';
import { GameCanvas } from '../components/GameCanvas.jsx';
import { GameHUD } from '../components/GameHUD.jsx';
import { WinnerPopup } from '../components/WinnerPopup.jsx';
import { SettingsPanel } from '../components/SettingsPanel.jsx';
import { StrikerBar } from '../components/StrikerBar.jsx';
import { GAME_STATUS, SHOT_TIMEOUT } from '../constants/gameConstants.js';

export function OnlineGame() {
  const navigate = useNavigate();
  const store = useGameStore();
  const [showSettings, setShowSettings] = useState(false);
  const [banner, setBanner] = useState('');          // persistent status banner
  const [notification, setNotification] = useState(''); // temporary toast
  const [shotTimeLeft, setShotTimeLeft] = useState(15);
  const timerRef = useRef(null);

  const notify = (msg, persist = false) => {
    if (persist) {
      setBanner(msg);
    } else {
      setNotification(msg);
      setTimeout(() => setNotification(''), 4000);
    }
  };

  const { shoot, requestRematch } = useOnlineGame({
    onGameStart: () => { setBanner(''); notify('Game started!'); },
    onShotResult: ({ foul }) => {
      if (foul) notify(`Foul: ${foul.replace(/_/g, ' ')}`);
    },
    onGameOver: () => {},
    onDisconnect: ({ message }) => notify(message, true /* persist */),
    onReconnect: ({ message }) => { setBanner(''); notify(message); },
    onConnectionLost: ({ message }) => { notify(message, true); setTimeout(() => navigate('/online'), 3000); },
    onError: ({ message }) => notify(message),
  });

  // Player 2 sees the board flipped 180° so their baseline is at the bottom
  const flipped  = store.myPlayerNum === 'player2';
  const isMyTurn = store.myPlayerNum === store.turn
    && !store.isSimulating
    && store.status === GAME_STATUS.PLAYING;

  const handleShoot = useCallback((angle, power, strikerX) => {
    if (!isMyTurn) return;
    shoot(angle, power, strikerX);
  }, [isMyTurn, shoot]);

  // ── Turn countdown timer ───────────────────────────────────────────────────
  // Starts at the beginning of each of MY turns, resets when turn switches.
  const TURN_SECS = Math.floor(SHOT_TIMEOUT / 1000);

  useEffect(() => {
    if (!isMyTurn) {
      clearInterval(timerRef.current);
      setShotTimeLeft(TURN_SECS);
      return;
    }
    setShotTimeLeft(TURN_SECS);
    timerRef.current = setInterval(() => {
      setShotTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [isMyTurn, TURN_SECS]);

  const p1     = store.players?.player1?.name || store.player1Name || 'Player 1';
  const p2     = store.players?.player2?.name || store.player2Name || 'Player 2';
  const myName = store.myPlayerNum === 'player1' ? p1 : p2;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center p-2 pt-2 gap-2">

      {/* Persistent banner (disconnection / sync errors) */}
      {banner && (
        <div className="w-full max-w-2xl bg-red-900/80 text-red-200 text-sm font-semibold px-4 py-2 rounded-xl text-center border border-red-700">
          {banner}
          {banner.includes('Waiting') && (
            <span className="ml-2 animate-pulse">●</span>
          )}
        </div>
      )}

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

      {/* Player identity */}
      <div className="text-xs text-gray-500">
        You are: <span className="text-yellow-400 font-bold">{myName}</span>
        {' '}({store.myPlayerNum === 'player1' ? 'White ○' : 'Black ●'})
      </div>

      {/* HUD — passes live shotTimeLeft so timer shows */}
      <div className="w-full max-w-2xl px-2">
        <GameHUD
          player1Name={p1}
          player2Name={p2}
          shotTimeLeft={isMyTurn ? shotTimeLeft : TURN_SECS}
        />
      </div>

      {/* Board + Slider grouped directly below board */}
      <div className="flex flex-col items-center gap-2 w-full max-w-2xl flex-1 justify-center relative">
        <div className="flex items-center justify-center w-full relative">
          <GameCanvas onShoot={handleShoot} isMyTurn={isMyTurn} flipped={flipped} />

          {/* Overlay when it's not my turn — blocks interaction visually */}
          {!isMyTurn && store.status === GAME_STATUS.PLAYING && !banner && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-end pb-6 pointer-events-auto"
              style={{ background: 'rgba(0,0,0,0.08)' }}
            >
              <div className="bg-gray-900/90 backdrop-blur rounded-xl px-6 py-3 border border-gray-700 text-center">
                {store.isSimulating
                  ? <span className="text-yellow-400 text-sm font-bold animate-pulse">⏳ Animating…</span>
                  : <span className="text-gray-300 text-sm font-bold animate-pulse">⏳ Opponent's turn…</span>}
              </div>
            </div>
          )}
        </div>

        <StrikerBar isMyTurn={isMyTurn} flipped={flipped} />
      </div>

      {/* Toast notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-xl shadow-lg text-sm z-40 animate-fadeIn">
          {notification}
        </div>
      )}

      {store.status === GAME_STATUS.FINISHED && (
        <WinnerPopup player1Name={p1} player2Name={p2} onRematch={requestRematch} />
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <SettingsPanel onClose={() => setShowSettings(false)} />
        </div>
      )}
    </div>
  );
}
