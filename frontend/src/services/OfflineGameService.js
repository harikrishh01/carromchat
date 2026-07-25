import {
  BOARD, COIN_COLORS, TURN, GAME_STATUS, FOUL_TYPES, COIN_VALUES,
  STRIKER_LINE,
} from '../constants/gameConstants.js';

/**
 * Pure offline game logic – no physics.
 *
 * Rules implemented:
 *  • Striker pocketed                   → foul
 *  • Opponent coin pocketed             → foul, coin(s) returned to board
 *  • Own coins pocketed                 → score + extra turn
 *  • Last own coin pocketed w/o queen   → foul, coin returned (must cover queen first)
 *  • Queen pocketed alone               → extra turn to cover
 *  • Queen covered (own coin same turn) → queen counted, extra turn
 *  • Queen cover failed (next shot)     → queen returned to centre
 *  • Foul penalty                       → turn switches + 1 pocketed coin returned
 *  • Win                                → all own coins pocketed AND queen covered
 */
export class OfflineGameService {
  static processResult(currentState, { pocketed: pocketedIds, strikerPocketed }) {
    const {
      coins, turn, scores, fouls, queenPocketed, queenCoverPending, queenHolder,
    } = currentState;

    const newCoins    = coins.map(c => ({ ...c }));
    const newScores   = { ...scores };
    const newFouls    = { ...fouls };
    let newTurn             = turn;
    let newQueenPocketed    = queenPocketed;
    let newQueenCoverPending = queenCoverPending;
    let newQueenHolder      = queenHolder;
    let lastFoul  = null;
    let extraTurn = false;
    let foul      = null;

    const opponentTurn = turn === TURN.PLAYER1 ? TURN.PLAYER2 : TURN.PLAYER1;
    const myColor      = turn === TURN.PLAYER1 ? COIN_COLORS.WHITE : COIN_COLORS.BLACK;
    const oppColor     = turn === TURN.PLAYER1 ? COIN_COLORS.BLACK : COIN_COLORS.WHITE;

    // ── 1. Identify what was pocketed this shot ───────────────────────────
    const pocketedCoins = [];
    pocketedIds.forEach(id => {
      const coin = newCoins.find(c => c.id === id);
      if (coin) { coin.pocketed = true; pocketedCoins.push(coin); }
    });

    const queenJustPocketed = pocketedCoins.some(c => c.id === 'queen');
    const ownPocketed       = pocketedCoins.filter(c => c.color === myColor);
    const oppPocketed       = pocketedCoins.filter(c => c.color === oppColor);

    // ── 2. Foul: striker pocketed ─────────────────────────────────────────
    if (strikerPocketed) {
      foul = FOUL_TYPES.STRIKER_POCKETED;
    }

    // ── 3. Foul: opponent's coin(s) pocketed ──────────────────────────────
    // The opponent's coin(s) return to the board; this player loses their turn
    if (!foul && oppPocketed.length > 0) {
      foul = FOUL_TYPES.OPPONENT_COIN_POCKETED;
      oppPocketed.forEach(c => {
        c.pocketed = false;
        c.x = BOARD.CENTER + (Math.random() - 0.5) * 60;
        c.y = BOARD.CENTER + (Math.random() - 0.5) * 60;
      });
    }

    // ── 4. Foul: last own coin pocketed before queen is covered ───────────
    // Cannot legally finish without first covering the queen.
    // The pocketed coin(s) return to the board.
    if (!foul && ownPocketed.length > 0 && !newQueenPocketed && !queenJustPocketed) {
      const stillOnBoard = newCoins.filter(c => c.color === myColor && !c.pocketed);
      // stillOnBoard is 0 → all own coins now pocketed but queen not covered
      if (stillOnBoard.length === 0) {
        foul = 'last_coin_before_queen';
        ownPocketed.forEach(c => {
          c.pocketed = false;
          c.x = BOARD.CENTER + (Math.random() - 0.5) * 60;
          c.y = BOARD.CENTER + (Math.random() - 0.5) * 60;
        });
        // Also undo any queen-cover pending state
        newQueenCoverPending = false;
        newQueenHolder       = null;
      }
    }

    // ── 5. Queen logic ────────────────────────────────────────────────────
    const coverWasPendingBeforeShot = queenCoverPending && !queenJustPocketed;

    if (!foul && queenJustPocketed) {
      newQueenCoverPending = true;
      newQueenHolder       = turn;
      extraTurn = true; // get one more shot to cover
    }

    if (!foul && newQueenCoverPending && newQueenHolder === turn && ownPocketed.length > 0) {
      // Queen covered!
      newQueenCoverPending = false;
      newQueenPocketed     = true;
      newQueenHolder       = null;
      newScores[turn]     += COIN_VALUES.QUEEN;
      extraTurn = true;
    } else if (!foul && coverWasPendingBeforeShot && newQueenHolder === turn && ownPocketed.length === 0) {
      // Cover-shot used but no own coin pocketed → queen returns
      const queenCoin = newCoins.find(c => c.id === 'queen');
      if (queenCoin) {
        queenCoin.pocketed = false;
        queenCoin.x = BOARD.CENTER;
        queenCoin.y = BOARD.CENTER;
      }
      newQueenCoverPending = false;
      newQueenHolder       = null;
    }

    // ── 6. Score own coins ────────────────────────────────────────────────
    if (!foul && ownPocketed.length > 0) {
      ownPocketed.forEach(() => { newScores[turn] += COIN_VALUES.BLACK; });
      extraTurn = true;
    }

    // ── 7. Foul penalty ───────────────────────────────────────────────────
    if (foul) {
      lastFoul = foul;
      newFouls[turn]++;
      extraTurn = false;
      newTurn   = opponentTurn;

      // One pocketed coin returned as penalty (except for last-coin foul,
      // which already returns the coin itself)
      if (foul !== 'last_coin_before_queen' && newScores[turn] > 0) {
        newScores[turn] = Math.max(0, newScores[turn] - 1);
        const penalty = newCoins.find(
          c => c.pocketed && c.color === myColor && c.id !== 'queen'
        );
        if (penalty) {
          penalty.pocketed = false;
          penalty.x = BOARD.CENTER + (Math.random() - 0.5) * 50;
          penalty.y = BOARD.CENTER + (Math.random() - 0.5) * 50;
        }
      }
    } else {
      newTurn = extraTurn ? turn : opponentTurn;
    }

    // ── 8. Win detection ──────────────────────────────────────────────────
    const p1Coins  = newCoins.filter(c => c.color === COIN_COLORS.WHITE);
    const p2Coins  = newCoins.filter(c => c.color === COIN_COLORS.BLACK);
    const allP1Done = p1Coins.every(c => c.pocketed);
    const allP2Done = p2Coins.every(c => c.pocketed);

    let winner = null;
    let status = GAME_STATUS.PLAYING;
    if ((allP1Done || allP2Done) && newQueenPocketed) {
      winner = allP1Done ? TURN.PLAYER1 : TURN.PLAYER2;
      status = GAME_STATUS.FINISHED;
    }

    // Striker baseline position for the next turn
    const strikerPos = {
      x: BOARD.CENTER,
      y: newTurn === TURN.PLAYER1 ? STRIKER_LINE.Y_BOTTOM : STRIKER_LINE.Y_TOP,
    };

    return {
      coins: newCoins,
      scores: newScores,
      fouls: newFouls,
      turn: newTurn,
      queenPocketed: newQueenPocketed,
      queenCoverPending: newQueenCoverPending,
      queenHolder: newQueenHolder,
      lastFoul,
      winner,
      status,
      strikerPos,
      extraTurn,
      foul,
    };
  }
}
