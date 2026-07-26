import { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore.js';
import { useOnlineGame } from '../hooks/useOnlineGame.js';
import { GameCanvas } from '../components/GameCanvas.jsx';
import { GameHUD } from '../components/GameHUD.jsx';
import { WinnerPopup } from '../components/WinnerPopup.jsx';
import { SettingsPanel } from '../components/SettingsPanel.jsx';
import { StrikerBar } from '../components/StrikerBar.jsx';
import { GAME_STATUS, SHOT_TIMEOUT } from '../constants/gameConstants.js';
import { onlineAnimator } from '../services/onlineAnimator.js';

const TURN_SECS = Math.floor(SHOT_TIMEOUT / 1000);

export function OnlineGame() {
  const navigate   = useNavigate();
  const store      = useGameStore();
  const [showSettings, setShowSettings] = useState(false);
  const [banner,       setBanner]       = useState('');
  const [notification, setNotification] = useState('');
  const [shotTimeLeft, setShotTimeLeft] = useState(TURN_SECS);

  // ── Init the module-level physics singleton for online animation ──────────
  // onlineAnimator.init() creates a fresh ClientPhysics instance.
  // This runs before any shot can arrive because game_start fires first.
  useEffect(() => {
    onlineAnimator.init();
    return () => onlineAnimator.destroy();
  }, []);

  const notify = (msg, persist = false) => {
    if (persist) setBanner(msg);
    else { setNotification(msg); setTimeout(() => setNotification(''), 4000); }
  };

  const { shoot, requestRematch } = useOnlineGame({
    onGameStart:      () => { setBanner(''); notify('Game started!'); },
    onShotResult:     ({ foul }) => { if (foul) notify(`Foul: ${foul?.replace(/_/g, ' ')}`); },
    onGameOver:       () => {},
    onDisconnect:     ({ message }) => notify(message, true),
    onReconnect:      ({ message }) => { setBanner(''); notify(message); },
    onConnectionLost: ({ message }) => notify(message),
    onError:          ({ message }) => notify(message),
  });

  const flipped  = store.myPlayerNum === 'player2';
  const isMyTurn = store.myPlayerNum === store.turn
    && !store.isSimulating
    && store.status === GAME_STATUS.PLAYING;

  const handleShoot = useCallback((angle, power, strikerX) => {
    if (!isMyTurn) return;
    shoot(angle, power, strikerX);
  }, [isMyTurn, shoot]);

  // ── Turn countdown timer – resets each time the turn changes ────────────────
  // Uses local countdown tied to store.turn so it works with OR without
  // the backend sending turnStartedAt.
  useEffect(() => {
    if (store.status !== GAME_STATUS.PLAYING) {
      setShotTimeLeft(TURN_SECS);
      return;
    }
    setShotTimeLeft(TURN_SECS);
    const id = setInterval(() => {
      setShotTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [store.turn, store.status]); // reset every turn change

  const p1     = store.players?.player1?.name || store.player1Name || 'Player 1';
  const p2     = store.players?.player2?.name || store.player2Name || 'Player 2';
  const myName = store.myPlayerNum === 'player1' ? p1 : p2;
  const isP1   = store.myPlayerNum === 'player1';

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center p-2 pt-2 gap-2">

      {/* Disconnect / sync banner */}
      {banner && (
        <div className="w-full max-w-2xl bg-red-900/80 text-red-200 text-sm font-semibold px-4 py-2 rounded-xl text-center border border-red-700 flex items-center justify-center gap-2">
          <span className="animate-pulse">●</span>
          {banner}
        </div>
      )}

      {/* Top bar */}
      <div className="w-full max-w-2xl flex items-center justify-between px-2">
        <button onClick={() => navigate('/online')} className="text-gray-400 hover:text-white text-sm">← Menu</button>
        <div className="text-center">
          <span className="text-yellow-400 font-bold text-sm tracking-widest uppercase">Online Match</span>
          {store.roomCode && <div className="text-gray-500 text-xs">Room: {store.roomCode}</div>}
        </div>
        <button onClick={() => setShowSettings(true)} className="text-gray-400 hover:text-white text-sm">⚙️</button>
      </div>

      {/* Player identity with coin visual */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span>You are:</span>
        <span className="font-bold text-yellow-400">{myName}</span>
        {/* Actual coin visual */}
        <span
          className="inline-block w-4 h-4 rounded-full border-2 shadow"
          style={{
            background:   isP1 ? '#f5f0dc' : '#1a1a1a',
            borderColor:  isP1 ? '#c4a035' : '#555',
            boxShadow:    isP1 ? '0 0 4px rgba(196,160,53,0.5)' : '0 0 4px rgba(80,80,80,0.5)',
          }}
        />
        <span>{isP1 ? 'White' : 'Black'}</span>
      </div>

      {/* HUD — synchronized timer visible to both players */}
      <div className="w-full max-w-2xl px-2">
        <GameHUD player1Name={p1} player2Name={p2} shotTimeLeft={shotTimeLeft} />
      </div>

      {/* Board + Slider — slider always directly below the board, no centering tricks */}
      <div className="flex flex-col items-center gap-3 w-full max-w-2xl">
        <div className="flex items-center justify-center w-full relative">
          <GameCanvas onShoot={handleShoot} isMyTurn={isMyTurn} flipped={flipped} />

          {/* Opponent turn overlay — transparent, just blocks clicks */}
          {!isMyTurn && store.status === GAME_STATUS.PLAYING && !banner && (
            <div
              className="absolute inset-0 pointer-events-auto flex items-end justify-center pb-4"
              style={{ background: 'rgba(0,0,0,0.05)' }}
            >
              {!store.isSimulating && (
                <div className="bg-gray-900/80 backdrop-blur rounded-lg px-4 py-2 text-gray-400 text-xs font-semibold animate-pulse">
                  ⏳ Opponent's turn
                </div>
              )}
            </div>
          )}
        </div>

        <StrikerBar isMyTurn={isMyTurn} flipped={flipped} />
      </div>

      {/* Toast */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-xl shadow-lg text-sm z-40 animate-fadeIn">
          {notification}
        </div>
      )}

      {/* Winner popup — also shows when opponent connection_lost (winner = myPlayerNum) */}
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
