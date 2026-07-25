import { useGameStore } from '../store/gameStore.js';

/**
 * Settings panel – sound / music toggles.
 */
export function SettingsPanel({ onClose }) {
  const { soundEnabled, musicEnabled, toggleSound, toggleMusic } = useGameStore();

  return (
    <div className="bg-gray-900/95 backdrop-blur rounded-2xl border border-white/10 p-6 w-80 text-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold">Settings</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
      </div>

      <div className="space-y-4">
        <label className="flex items-center justify-between cursor-pointer">
          <span>Sound Effects</span>
          <div
            onClick={toggleSound}
            className={`w-12 h-6 rounded-full transition-colors ${soundEnabled ? 'bg-yellow-500' : 'bg-gray-600'} relative`}
          >
            <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </div>
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span>Background Music</span>
          <div
            onClick={toggleMusic}
            className={`w-12 h-6 rounded-full transition-colors ${musicEnabled ? 'bg-yellow-500' : 'bg-gray-600'} relative`}
          >
            <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${musicEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </div>
        </label>
      </div>
    </div>
  );
}
