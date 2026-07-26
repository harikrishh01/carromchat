import { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore.js';
import { useOnlineGame } from '../hooks/useOnlineGame.js';
import { GameCanvas } from '../components/GameCanvas.jsx';
import { GameHUD } from '../components/GameHUD.jsx';
import { WinnerPopup } from '../components/WinnerPopup.jsx';
import { SettingsPanel } from '../components/SettingsPanel.jsx';
import { StrikerBar } from '../components/StrikerBar.jsx';
import { GAME_STATUS, SHOT_TIMEOUT, POCKET, COIN_COLORS } from '../constants/gameConstants.js';
import { ClientPhysics } from '../physics/ClientPhysics.js';
import { useSoundManager } from '../hooks/useSoundManager.js';

// ── Coin VFX helpers (same logic as useOfflineGame) ──────────────────────────
function _spawnPocketVFX(id, pos, coins) {
  const coinData = coins.find(c => c.id === id);
  const nearest = POCKET.POSITIONS.reduce((best, p) => {
    const d = Math.hypot(p.x - pos.x, p.y - pos.y);
    return d < best.d ? { p, d } : best;
  }, { p: POCKET.POSITIONS[0], d: Infinity }).p;
  useGameStore.getState().addPocketAnimation({
    id: `${id}_${Date.now()}`,
    coinId: id,
    color: coinData?.color ?? 'black',
    isQueen: id === 'queen',
    x: pos.x, y: pos.y,
    pocketX: nearest.x, pocketY: nearest.y,
    startTime: Date.now(),
    duration: 350,
  });
}

const TURN_SECS = Math.floor(SHOT_TIMEOUT / 1000);

export function OnlineGame() {
  const navigate   = useNavigate();
  const store      = useGameStore();
  const sound      = useSoundManager();
  const [showSettings, setShowSettings] = useState(false);
  const [banner,       setBanner]       = useState('');
  const [notification, setNotification] = useState('');
  const [shotTimeLeft, setShotTimeLeft] = useState(TURN_SECS);

  // ── Physics lives here — guaranteed to exist when animation is needed ──
  const physicsRef = useRef(null);
  useEffect(() => {
    physicsRef.current = new ClientPhysics();
    return () => { physicsRef.current?.destroy(); physicsRef.current = null; };
  }, []);

  const notify = (msg, persist = false) => {
    if (persist) setBanner(msg);
    else { setNotification(msg); setTimeout(() => setNotification(''), 4000); }
  };

  const { shoot, requestRematch } = useOnlineGame({
    onGameStart:      () => { setBanner(''); notify('Game started!'); },
    onShotResult:     ({ foul }) => { if (foul) notify(`Foul: ${foul.replace(/_/g, ' ')}`); },
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

  // ── Synchronized timer: both clients derive timeLeft from server timestamp ─
  useEffect(() => {
    if (store.status !== GAME_STATUS.PLAYING || !store.turnStartedAt) {
      setShotTimeLeft(TURN_SECS);
      return;
    }
    const update = () => {
      const elapsed = Math.floor((Date.now() - store.turnStartedAt) / 1000);
      setShotTimeLeft(Math.max(0, TURN_SECS - elapsed));
    };
    update();
    const id = setInterval(update, 500); // 500ms tick for smooth display
    return () => clearInterval(id);
  }, [store.turnStartedAt, store.status]);

  // ── Online shot animation: triggered by pendingOnlineShot in store ─────────
  // This runs in React's synchronous effect flow, so physicsRef is always valid.
  useEffect(() => {
    const pending = store.pendingOnlineShot;
    if (!pending) return;

    // Clear immediately so this effect doesn't re-trigger
    useGameStore.setState({ pendingOnlineShot: null });

    const { shotParams, serverState, foul } = pending;
    const physics = physicsRef.current;
    const preState = useGameStore.getState();

    if (!physics || !shotParams) {
      // Fallback: apply server state directly (no animation)
      preState.applyResult(serverState);
      if (foul) sound.playFoul();
      if (serverState.winner) sound.playWin();
      return;
    }

    useGameStore.setState({ isSimulating: true });
    physics.loadState(preState.coins, { x: shotParams.strikerX, y: preState.strikerPos.y });

    physics.shoot(shotParams.angle, shotParams.power, {
      onPocketed: (id, pos) => {
        sound.playPocket();
        // Hide coin immediately (no ghost)
        useGameStore.setState(s => ({
          coins: s.coins.map(c => c.id === id ? { ...c, pocketed: true } : c),
        }));
        _spawnPocketVFX(id, pos, useGameStore.getState().coins);
      },
      onTick: (snapshot) => {
        const strikerSnap = snapshot.find(s => s.id === 'striker');
        const coinSnap    = snapshot.filter(s => s.id !== 'striker');
        const cur = useGameStore.getState().coins;
        useGameStore.setState({
          coins: cur.map(c => {
            const live = coinSnap.find(s => s.id === c.id);
            return live ? { ...c, x: live.x, y: live.y } : c;
          }),
          liveStrikerPos: strikerSnap ? { x: strikerSnap.x, y: strikerSnap.y } : null,
        });
      },
      onComplete: () => {
        useGameStore.setState({ liveStrikerPos: null });
        useGameStore.getState().applyResult(serverState);
        if (foul) sound.playFoul();
        if (serverState.winner) sound.playWin();
      },
    });
  }, [store.pendingOnlineShot, sound]);  // eslint-disable-line

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

      {/* Board + Slider */}
      <div className="flex flex-col items-center gap-2 w-full max-w-2xl flex-1 justify-center">
        <div className="flex items-center justify-center w-full relative">
          <GameCanvas onShoot={handleShoot} isMyTurn={isMyTurn} flipped={flipped} />

          {/* Opponent turn / simulating overlay — transparent, just blocks clicks */}
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
              {/* During simulation: no overlay text — let animation show clearly */}
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
