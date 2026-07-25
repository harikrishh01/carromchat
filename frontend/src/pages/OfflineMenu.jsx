import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore.js';
import { Button } from '../components/Button.jsx';
import { DIFFICULTY } from '../constants/gameConstants.js';

const DIFFICULTY_INFO = {
  [DIFFICULTY.EASY]: {
    label: 'Easy',
    desc: 'Random shots, low accuracy. Perfect for beginners.',
    color: 'text-green-400',
    bg: 'bg-green-900/30 border-green-600/50',
    icon: '😊',
  },
  [DIFFICULTY.MEDIUM]: {
    label: 'Medium',
    desc: 'Targets nearest coin, occasional bank shots.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-900/30 border-yellow-600/50',
    icon: '🤔',
  },
  [DIFFICULTY.HARD]: {
    label: 'Hard',
    desc: 'Optimal angles, bank shots, queen awareness.',
    color: 'text-red-400',
    bg: 'bg-red-900/30 border-red-600/50',
    icon: '😈',
  },
};

export function OfflineMenu() {
  const navigate = useNavigate();
  const { setDifficulty, setGameMode, startGame, setPlayer1Name, setPlayer2Name, difficulty } = useGameStore();
  const [playerName, setPlayerName] = useState('Player 1');
  const [selected, setSelected] = useState(difficulty || DIFFICULTY.MEDIUM);

  const handleStart = () => {
    setGameMode('offline');
    setDifficulty(selected);
    setPlayer1Name(playerName || 'Player 1');
    setPlayer2Name(`Computer (${DIFFICULTY_INFO[selected].label})`);
    startGame();
    navigate('/game/offline');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white mb-6 flex items-center gap-2 transition-colors"
        >
          ← Back
        </button>

        <h2 className="text-4xl font-black text-white mb-2">Play Offline</h2>
        <p className="text-gray-400 mb-8">Challenge the computer opponent</p>

        {/* Player name */}
        <div className="mb-6">
          <label className="text-gray-400 text-sm block mb-1">Your Name</label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            maxLength={20}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors"
            placeholder="Enter your name"
          />
        </div>

        {/* Difficulty */}
        <div className="mb-8">
          <label className="text-gray-400 text-sm block mb-2">Difficulty</label>
          <div className="flex flex-col gap-3">
            {Object.entries(DIFFICULTY_INFO).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${selected === key ? info.bg + ' ring-2 ring-white/20' : 'bg-gray-800/50 border-gray-700 hover:border-gray-500'}`}
              >
                <span className="text-2xl">{info.icon}</span>
                <div className="text-left">
                  <div className={`font-bold ${selected === key ? info.color : 'text-white'}`}>{info.label}</div>
                  <div className="text-gray-400 text-xs">{info.desc}</div>
                </div>
                {selected === key && <div className="ml-auto text-yellow-400">✓</div>}
              </button>
            ))}
          </div>
        </div>

        <Button size="xl" className="w-full text-center" onClick={handleStart}>
          Start Game
        </Button>
      </div>
    </div>
  );
}
