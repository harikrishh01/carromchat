import { useGameStore } from '../store/gameStore.js';
import { TURN } from '../constants/gameConstants.js';

/**
 * HUD overlay showing turn, scores, player names, and power meter.
 */
export function GameHUD({ player1Name, player2Name, shotTimeLeft }) {
  const { turn, scores, fouls, queenPocketed, queenCoverPending, power, isSimulating, lastFoul } = useGameStore();

  const isP1Turn = turn === TURN.PLAYER1;

  return (
    <div className="w-full flex flex-col gap-2 text-white font-['Rajdhani',sans-serif]">

      {/* Score Row */}
      <div className="flex items-center justify-between gap-4">

        {/* Player 1 */}
        <div className={`flex-1 rounded-xl p-3 transition-all duration-300 ${isP1Turn ? 'bg-white/20 ring-2 ring-yellow-400 shadow-lg' : 'bg-white/5'}`}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-100 border-2 border-amber-400 shrink-0" />
            <span className="font-bold text-sm truncate">{player1Name}</span>
            {isP1Turn && !isSimulating && <span className="ml-auto text-yellow-400 text-xs animate-pulse">● YOUR TURN</span>}
          </div>
          <div className="text-2xl font-bold mt-1">{scores.player1} pts</div>
          {fouls.player1 > 0 && <div className="text-xs text-red-400">Fouls: {fouls.player1}</div>}
        </div>

        {/* Center info */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          {queenPocketed ? (
            <div className="text-xs text-green-400 font-bold">Queen ✓</div>
          ) : queenCoverPending ? (
            <div className="text-xs text-orange-400 font-bold animate-pulse">Cover Queen!</div>
          ) : (
            <div className="text-xs text-red-400">Queen ●</div>
          )}
          {/* Shot Timer */}
          {!isSimulating && (
            <div className={`text-2xl font-mono font-bold ${shotTimeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {shotTimeLeft}s
            </div>
          )}
          {isSimulating && <div className="text-xs text-yellow-400 animate-pulse">Simulating...</div>}
        </div>

        {/* Player 2 */}
        <div className={`flex-1 rounded-xl p-3 transition-all duration-300 ${!isP1Turn ? 'bg-white/20 ring-2 ring-yellow-400 shadow-lg' : 'bg-white/5'}`}>
          <div className="flex items-center gap-2 justify-end">
            {!isP1Turn && !isSimulating && <span className="mr-auto text-yellow-400 text-xs animate-pulse">YOUR TURN ●</span>}
            <span className="font-bold text-sm truncate">{player2Name}</span>
            <div className="w-4 h-4 rounded-full bg-gray-800 border-2 border-gray-400 shrink-0" />
          </div>
          <div className="text-2xl font-bold mt-1 text-right">{scores.player2} pts</div>
          {fouls.player2 > 0 && <div className="text-xs text-red-400 text-right">Fouls: {fouls.player2}</div>}
        </div>
      </div>

      {/* Power Meter */}
      {isP1Turn && !isSimulating && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 shrink-0 w-10">Power</span>
          <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-75"
              style={{
                width: `${power}%`,
                background: `linear-gradient(90deg, #22c55e, #eab308, #ef4444)`,
              }}
            />
          </div>
          <span className="text-xs w-8 text-right">{Math.round(power)}</span>
        </div>
      )}

      {/* Foul banner */}
      {lastFoul && (
        <div className="text-center text-red-400 text-sm font-bold animate-bounce py-1 bg-red-900/30 rounded-lg">
          {lastFoul === 'striker_pocketed'     && '⚠️ Foul! Striker pocketed — coin returned'}
          {lastFoul === 'opponent_coin_pocketed' && '⚠️ Foul! Opponent\'s coin returned to board'}
          {lastFoul === 'last_coin_before_queen' && '⚠️ Must cover the Queen first! Coin returned'}
          {lastFoul === 'queen_without_cover'   && '⚠️ Queen returned — no cover coin pocketed'}
          {!['striker_pocketed','opponent_coin_pocketed','last_coin_before_queen','queen_without_cover'].includes(lastFoul)
            && `⚠️ Foul: ${lastFoul.replace(/_/g, ' ')}`}
        </div>
      )}
    </div>
  );
}
