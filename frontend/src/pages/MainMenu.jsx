import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore.js';
import { Button } from '../components/Button.jsx';
import { useState } from 'react';
import { SettingsPanel } from '../components/SettingsPanel.jsx';

export function MainMenu() {
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500 tracking-tight">
          CARROM
        </h1>
        <p className="text-gray-400 text-sm mt-1 tracking-widest uppercase">Board Game</p>

        {/* Decorative board icon */}
        <div className="mt-4 w-24 h-24 mx-auto rounded-xl bg-amber-700/20 border border-amber-600/30 flex items-center justify-center">
          <span className="text-5xl">🎯</span>
        </div>
      </div>

      {/* Menu */}
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Button
          size="lg"
          onClick={() => navigate('/offline')}
          className="w-full text-center"
        >
          🎮 Play Offline
        </Button>

        <Button
          size="lg"
          variant="secondary"
          onClick={() => navigate('/online')}
          className="w-full text-center"
        >
          🌐 Play Online
        </Button>

        <Button
          size="lg"
          variant="ghost"
          onClick={() => setShowSettings(true)}
          className="w-full text-center"
        >
          ⚙️ Settings
        </Button>

        <Button
          size="lg"
          variant="ghost"
          onClick={() => setShowHowTo(true)}
          className="w-full text-center"
        >
          📖 How to Play
        </Button>
      </div>

      <p className="mt-8 text-gray-600 text-xs">v1.0.1 – Production Ready</p>

      {/* Settings overlay */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <SettingsPanel onClose={() => setShowSettings(false)} />
        </div>
      )}

      {/* How To Play overlay */}
      {showHowTo && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-lg w-full text-white max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-yellow-400">How to Play</h3>
              <button onClick={() => setShowHowTo(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="space-y-4 text-sm text-gray-300">
              <section>
                <h4 className="text-white font-bold mb-1">Objective</h4>
                <p>Pocket all your coins (White = Player 1, Black = Player 2) plus the Queen to win.</p>
              </section>
              <section>
                <h4 className="text-white font-bold mb-1">Aiming</h4>
                <p>Click and drag on the board to aim. The further you drag, the more power you apply. Release to shoot.</p>
              </section>
              <section>
                <h4 className="text-white font-bold mb-1">The Queen</h4>
                <p>Pocket the Queen and then immediately pocket one of your own coins to "cover" it. If you can't cover, the Queen returns to the center.</p>
              </section>
              <section>
                <h4 className="text-white font-bold mb-1">Fouls</h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Pocketing the striker</li>
                  <li>Pocketing an opponent's coin</li>
                  <li>Pocketing the Queen without a cover</li>
                </ul>
                <p className="mt-1">On a foul: your turn passes and you lose a point.</p>
              </section>
              <section>
                <h4 className="text-white font-bold mb-1">Winning</h4>
                <p>Pocket all your coins AND have the Queen covered. The player who does this first wins!</p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
