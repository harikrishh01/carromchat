import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore.js';
import { useOnlineGame } from '../hooks/useOnlineGame.js';
import { Button } from '../components/Button.jsx';

export function OnlineMenu() {
  const navigate = useNavigate();
  const store = useGameStore();
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [playerName, setPlayerName] = useState('Player');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  const { createRoom, joinRoom } = useOnlineGame({
    onRoomCreated: ({ roomCode }) => {
      setStatus(`Room created! Code: ${roomCode}`);
      setWaitingForOpponent(true);
      store.setPlayer1Name(playerName);
    },
    onRoomJoined: ({ roomCode }) => {
      setStatus(`Joined room ${roomCode}! Waiting for game...`);
      store.setPlayer2Name(playerName);
    },
    onGameStart: () => {
      navigate('/game/online');
    },
    onError: ({ message }) => {
      setError(message);
      setWaitingForOpponent(false);
    },
    onDisconnect: ({ message }) => setError(message),
  });

  const handleCreate = () => {
    if (!playerName.trim()) { setError('Enter your name'); return; }
    setError('');
    store.setGameMode('online');
    createRoom(playerName.trim());
  };

  const handleJoin = () => {
    if (!playerName.trim()) { setError('Enter your name'); return; }
    if (!roomCodeInput.trim() || roomCodeInput.length < 4) { setError('Enter a valid room code'); return; }
    setError('');
    store.setGameMode('online');
    joinRoom(roomCodeInput.trim(), playerName.trim());
  };

  const roomCode = store.roomCode;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2 transition-colors">
          ← Back
        </button>

        <h2 className="text-4xl font-black text-white mb-2">Play Online</h2>
        <p className="text-gray-400 mb-8">Challenge a friend in real-time</p>

        {/* Player name */}
        <div className="mb-6">
          <label className="text-gray-400 text-sm block mb-1">Your Name</label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            maxLength={20}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
            placeholder="Enter your name"
          />
        </div>

        {!mode && !waitingForOpponent && (
          <div className="flex flex-col gap-4">
            <Button size="lg" onClick={() => setMode('create')} className="w-full">
              🏠 Create Room
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setMode('join')} className="w-full">
              🔑 Join Room
            </Button>
          </div>
        )}

        {mode === 'create' && !waitingForOpponent && (
          <div className="flex flex-col gap-4">
            <Button size="lg" onClick={handleCreate} className="w-full">
              Generate Room Code
            </Button>
            <button onClick={() => setMode(null)} className="text-gray-400 hover:text-white text-sm transition-colors">
              ← Back
            </button>
          </div>
        )}

        {mode === 'join' && !waitingForOpponent && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-gray-400 text-sm block mb-1">Room Code</label>
              <input
                type="text"
                value={roomCodeInput}
                onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                maxLength={6}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-yellow-500"
                placeholder="XXXXXX"
              />
            </div>
            <Button size="lg" onClick={handleJoin} className="w-full">
              Join Game
            </Button>
            <button onClick={() => setMode(null)} className="text-gray-400 hover:text-white text-sm transition-colors">
              ← Back
            </button>
          </div>
        )}

        {/* Waiting screen */}
        {waitingForOpponent && (
          <div className="text-center">
            <div className="text-6xl mb-4 animate-spin-slow">⏳</div>
            <p className="text-gray-400 mb-2">Waiting for opponent...</p>
            <div className="bg-gray-800 rounded-xl p-4 mb-4">
              <p className="text-gray-400 text-xs mb-1">Room Code</p>
              <p className="text-4xl font-mono font-black text-yellow-400 tracking-widest">{roomCode}</p>
              <p className="text-gray-500 text-xs mt-1">Share this with your friend</p>
            </div>
            <button
              onClick={() => {
                setWaitingForOpponent(false);
                setMode(null);
                setStatus('');
                store.setRoomCode(null);
              }}
              className="text-gray-400 hover:text-white text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Status / Error */}
        {error && <div className="mt-4 text-red-400 text-sm text-center bg-red-900/20 rounded-xl p-3">{error}</div>}
        {status && !waitingForOpponent && <div className="mt-4 text-green-400 text-sm text-center">{status}</div>}
      </div>
    </div>
  );
}
