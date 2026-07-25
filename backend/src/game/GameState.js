import { v4 as uuidv4 } from 'uuid';
import {
  BOARD, COIN_COLORS, GAME_STATUS, TURN, FOUL_TYPES, COIN_VALUES,
  INITIAL_COINS, STRIKER_LINE, SHOT_TIMEOUT,
} from '../constants/gameConstants.js';
import { PhysicsEngine } from '../physics/PhysicsEngine.js';

/**
 * Authoritative server-side game state for one room.
 */
export class GameState {
  constructor(roomCode) {
    this.roomCode = roomCode;
    this.players = {};       // socketId -> { name, color }
    this.status = GAME_STATUS.WAITING;
    this.turn = TURN.PLAYER1;
    this.scores = { player1: 0, player2: 0 };
    this.coins = this._initCoins();
    this.strikerPos = this._defaultStrikerPos(TURN.PLAYER1);
    this.pocketedByPlayer = { player1: [], player2: [] };
    this.queenPocketed = false;
    this.queenCoverPending = false;  // queen was pocketed but needs cover
    this.queenHolder = null;         // which player pocketed the queen
    this.fouls = { player1: 0, player2: 0 };
    this.lastFoul = null;
    this.winner = null;
    this.shotTimer = null;
    this.shotTimeoutMs = SHOT_TIMEOUT;
    this.physics = new PhysicsEngine();
  }

  _initCoins() {
    return INITIAL_COINS.map(c => ({ ...c, pocketed: false }));
  }

  _defaultStrikerPos(turn) {
    return {
      x: BOARD.CENTER,
      y: turn === TURN.PLAYER1 ? STRIKER_LINE.Y_BOTTOM : STRIKER_LINE.Y_TOP,
    };
  }

  addPlayer(socketId, name) {
    const playerKeys = Object.keys(this.players);
    if (playerKeys.length >= 2) return null;
    const playerNum = playerKeys.length === 0 ? 'player1' : 'player2';
    const color = playerNum === 'player1' ? COIN_COLORS.WHITE : COIN_COLORS.BLACK;
    this.players[socketId] = { name, color, playerNum };
    return playerNum;
  }

  removePlayer(socketId) {
    delete this.players[socketId];
  }

  isReady() {
    return Object.keys(this.players).length === 2;
  }

  startGame() {
    this.status = GAME_STATUS.PLAYING;
    this.turn = TURN.PLAYER1;
    this.coins = this._initCoins();
    this.scores = { player1: 0, player2: 0 };
    this.fouls = { player1: 0, player2: 0 };
    this.queenPocketed = false;
    this.queenCoverPending = false;
    this.queenHolder = null;
    this.winner = null;
    this.lastFoul = null;
    this.strikerPos = this._defaultStrikerPos(TURN.PLAYER1);
  }

  getCurrentPlayerSocketId() {
    return Object.keys(this.players).find(
      id => this.players[id].playerNum === this.turn
    );
  }

  /**
   * Process a shot. Returns a result object with updated state.
   */
  processShot(socketId, angle, power, strikerX) {
    // Validate it's this player's turn
    const player = this.players[socketId];
    if (!player || player.playerNum !== this.turn) {
      return { valid: false, reason: 'Not your turn' };
    }
    if (this.status !== GAME_STATUS.PLAYING) {
      return { valid: false, reason: 'Game not in progress' };
    }

    // Validate striker position
    const clampedX = Math.max(STRIKER_LINE.X_MIN, Math.min(STRIKER_LINE.X_MAX, strikerX));
    this.strikerPos.x = clampedX;

    // Load state into physics engine
    const activeCoins = this.coins.filter(c => !c.pocketed);
    this.physics.loadState(activeCoins, this.strikerPos);

    // Simulate
    const { finalCoins, pocketed, strikerPocketed, strikerFinal } = this.physics.simulate(angle, power);

    // Update coin positions
    finalCoins.forEach(fc => {
      const coin = this.coins.find(c => c.id === fc.id);
      if (coin) { coin.x = fc.x; coin.y = fc.y; }
    });

    // Determine pocketed coins' colors
    const pocketedCoins = pocketed.map(id => this.coins.find(c => c.id === id)).filter(Boolean);
    pocketedCoins.forEach(c => { c.pocketed = true; });

    const currentPlayerNum = this.turn;
    const opponentNum = currentPlayerNum === TURN.PLAYER1 ? TURN.PLAYER2 : TURN.PLAYER1;

    let foul = null;
    let switchTurn = true;
    let extraTurn = false;

    // --- Foul: striker pocketed ---
    if (strikerPocketed) {
      foul = FOUL_TYPES.STRIKER_POCKETED;
    }

    // --- Check what was pocketed ---
    const queenJustPocketed = pocketedCoins.some(c => c.id === 'queen');
    const ownColorPocketed = pocketedCoins.filter(c => {
      return c.color === (currentPlayerNum === TURN.PLAYER1 ? COIN_COLORS.WHITE : COIN_COLORS.BLACK);
    });
    const opponentColorPocketed = pocketedCoins.filter(c => {
      return c.color === (currentPlayerNum === TURN.PLAYER1 ? COIN_COLORS.BLACK : COIN_COLORS.WHITE);
    });

    // --- No coin hit is a foul ---
    if (!strikerPocketed && pocketedCoins.length === 0) {
      // Check if striker at least hit something – we can't track this in current simulation
      // so we allow it but switch turns
      switchTurn = true;
    }

    // --- Opponent coin pocketed ---
    if (opponentColorPocketed.length > 0 && !foul) {
      foul = FOUL_TYPES.OPPONENT_COIN_POCKETED;
      // Return opponent coins back to board center
      opponentColorPocketed.forEach(c => {
        c.pocketed = false;
        c.x = BOARD.CENTER + (Math.random() - 0.5) * 20;
        c.y = BOARD.CENTER + (Math.random() - 0.5) * 20;
      });
    }

    // --- Queen logic ---
    if (queenJustPocketed && !foul) {
      this.queenCoverPending = true;
      this.queenHolder = currentPlayerNum;
    }

    if (this.queenCoverPending && ownColorPocketed.length > 0 && this.queenHolder === currentPlayerNum && !foul) {
      // Queen covered!
      this.queenCoverPending = false;
      this.queenPocketed = true;
      this.scores[currentPlayerNum] += COIN_VALUES.QUEEN;
      switchTurn = false;
      extraTurn = true;
    } else if (this.queenCoverPending && !ownColorPocketed.length && this.queenHolder === currentPlayerNum && !foul) {
      // Failed to cover queen – return it
      const queenCoin = this.coins.find(c => c.id === 'queen');
      if (queenCoin) {
        queenCoin.pocketed = false;
        queenCoin.x = BOARD.CENTER;
        queenCoin.y = BOARD.CENTER;
      }
      this.queenCoverPending = false;
      this.queenHolder = null;
    }

    // --- Score own coins ---
    if (!foul) {
      ownColorPocketed.forEach(c => {
        this.scores[currentPlayerNum] += COIN_VALUES.BLACK;
      });
      if (ownColorPocketed.length > 0) {
        extraTurn = true;
        switchTurn = false;
      }
    }

    // --- Apply foul ---
    if (foul) {
      this.fouls[currentPlayerNum]++;
      this.lastFoul = foul;
      switchTurn = true;
      extraTurn = false;

      // Return one coin from player's pocketed to board (penalty)
      if (this.scores[currentPlayerNum] > 0) {
        this.scores[currentPlayerNum] = Math.max(0, this.scores[currentPlayerNum] - 1);
        // Restore a coin visually
        const pocketedOwn = this.coins.filter(c => c.pocketed && !c.id.includes('queen'));
        if (pocketedOwn.length > 0) {
          const restore = pocketedOwn[0];
          restore.pocketed = false;
          restore.x = BOARD.CENTER + (Math.random() - 0.5) * 30;
          restore.y = BOARD.CENTER + (Math.random() - 0.5) * 30;
        }
      }
    } else {
      this.lastFoul = null;
    }

    // --- Switch turn ---
    if (switchTurn || !extraTurn) {
      this.turn = opponentNum;
    }
    this.strikerPos = this._defaultStrikerPos(this.turn);

    // --- Win detection ---
    const player1Coins = this.coins.filter(c => c.color === COIN_COLORS.WHITE);
    const player2Coins = this.coins.filter(c => c.color === COIN_COLORS.BLACK);
    const allP1Pocketed = player1Coins.every(c => c.pocketed);
    const allP2Pocketed = player2Coins.every(c => c.pocketed);

    if ((allP1Pocketed || allP2Pocketed) && this.queenPocketed) {
      this.winner = allP1Pocketed ? TURN.PLAYER1 : TURN.PLAYER2;
      this.status = GAME_STATUS.FINISHED;
    }

    return {
      valid: true,
      state: this.getPublicState(),
      foul,
      pocketed: pocketedCoins.map(c => c.id),
      strikerPocketed,
      extraTurn,
    };
  }

  getPublicState() {
    return {
      status: this.status,
      turn: this.turn,
      scores: { ...this.scores },
      coins: this.coins.map(c => ({ ...c })),
      strikerPos: { ...this.strikerPos },
      queenPocketed: this.queenPocketed,
      queenCoverPending: this.queenCoverPending,
      fouls: { ...this.fouls },
      lastFoul: this.lastFoul,
      winner: this.winner,
      players: Object.fromEntries(
        Object.entries(this.players).map(([id, p]) => [p.playerNum, { name: p.name, color: p.color }])
      ),
    };
  }

  reset() {
    this.physics.destroy();
    this.physics = new PhysicsEngine();
    this.startGame();
  }
}
