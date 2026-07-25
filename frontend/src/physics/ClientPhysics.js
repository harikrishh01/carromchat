import Matter from 'matter-js';
import { BOARD, POCKET, COIN, STRIKER } from '../constants/gameConstants.js';

const { Engine, Render, World, Bodies, Body, Events, Vector, Runner } = Matter;

/**
 * Client-side physics engine using Matter.js.
 * Handles rendering and simulation for offline mode.
 */
export class ClientPhysics {
  constructor() {
    this.engine = Engine.create({
      gravity: { x: 0, y: 0 },
      positionIterations: 10,
      velocityIterations: 10,
    });
    this.world = this.engine.world;
    this.bodies = new Map();
    this.pocketedCallbacks = [];
    this.allStoppedCallbacks = [];
    this._simulating = false;
    this._setupWalls();
    this._setupPocketDetection();
  }

  _setupWalls() {
    const { SIZE, BORDER } = BOARD;
    const t = 40;
    const walls = [
      Bodies.rectangle(SIZE / 2, BORDER / 2, SIZE, t, { isStatic: true, label: 'wall_top',    restitution: 0.78, friction: 0.01 }),
      Bodies.rectangle(SIZE / 2, SIZE - BORDER / 2, SIZE, t, { isStatic: true, label: 'wall_bottom', restitution: 0.78, friction: 0.01 }),
      Bodies.rectangle(BORDER / 2, SIZE / 2, t, SIZE, { isStatic: true, label: 'wall_left',   restitution: 0.78, friction: 0.01 }),
      Bodies.rectangle(SIZE - BORDER / 2, SIZE / 2, t, SIZE, { isStatic: true, label: 'wall_right',  restitution: 0.78, friction: 0.01 }),
    ];
    World.add(this.world, walls);
  }

  _setupPocketDetection() {
    // Poll each frame – cheaper than event-based for pocket zones
  }

  /**
   * Load game state (coins + striker).
   */
  loadState(coins, strikerPos) {
    const dynamic = this.world.bodies.filter(b => !b.isStatic);
    World.remove(this.world, dynamic);
    this.bodies.clear();

    coins.filter(c => !c.pocketed).forEach(coin => {
      const body = Bodies.circle(coin.x, coin.y, COIN.RADIUS, {
        restitution: COIN.RESTITUTION,
        friction: COIN.FRICTION,
        frictionAir: COIN.FRICTION_AIR,
        mass: COIN.MASS,
        label: coin.id,
      });
      this.bodies.set(coin.id, body);
      World.add(this.world, body);
    });

    const striker = Bodies.circle(strikerPos.x, strikerPos.y, STRIKER.RADIUS, {
      restitution: STRIKER.RESTITUTION,
      friction: STRIKER.FRICTION,
      frictionAir: STRIKER.FRICTION_AIR,
      mass: STRIKER.MASS,
      label: 'striker',
    });
    this.bodies.set('striker', striker);
    World.add(this.world, striker);
  }

  /**
   * Shoot the striker. Calls onPocketed(id) for each pocketed piece,
   * and onComplete(result) when all pieces stop.
   */
  shoot(angle, power, { onPocketed, onTick, onComplete }) {
    // Scale power to velocity – slightly toned down from full-speed
    const vMag = power * 0.25;
    const striker = this.bodies.get('striker');
    if (!striker) return;

    Body.setVelocity(striker, {
      x: Math.cos(angle) * vMag,
      y: Math.sin(angle) * vMag,
    });

    this._simulating = true;
    const pocketedIds = [];
    const strikerPocketed = { value: false };
    let idleFrames = 0;
    // Substep size: run 3 mini-steps per rAF frame so motion is smooth
    // even at high speeds (avoids tunnelling at small coin sizes)
    const SUBSTEP_DT  = 16.67 / 3;
    const MAX_IDLE = 40;

    const tick = () => {
      if (!this._simulating) return;
      Engine.update(this.engine, SUBSTEP_DT);
      Engine.update(this.engine, SUBSTEP_DT);
      Engine.update(this.engine, SUBSTEP_DT);

      // Pocket detection
      for (const [id, body] of this.bodies.entries()) {
        if (body.isStatic) continue;
        for (const pocket of POCKET.POSITIONS) {
          const dx = body.position.x - pocket.x;
          const dy = body.position.y - pocket.y;
          if (Math.sqrt(dx * dx + dy * dy) < POCKET.RADIUS) {
            if (id === 'striker') {
              strikerPocketed.value = true;
            } else {
              pocketedIds.push(id);
              onPocketed?.(id, body.position);
            }
            World.remove(this.world, body);
            this.bodies.delete(id);
            break;
          }
        }
      }

      if (onTick) onTick(this._getSnapshot());

      // Check stop
      const allStopped = [...this.bodies.values()].every(b => Vector.magnitude(b.velocity) < 0.05);
      if (allStopped) {
        idleFrames++;
        if (idleFrames >= MAX_IDLE) {
          this._simulating = false;
          onComplete?.({
            coins: this._getSnapshot(),
            pocketed: pocketedIds,
            strikerPocketed: strikerPocketed.value,
          });
          return;
        }
      } else {
        idleFrames = 0;
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  _getSnapshot() {
    const snap = [];
    for (const [id, body] of this.bodies.entries()) {
      // Include ALL bodies – coins AND the striker – so callers can animate the striker too
      snap.push({ id, x: body.position.x, y: body.position.y });
    }
    return snap;
  }

  getBodyPositions() {
    const result = {};
    for (const [id, body] of this.bodies.entries()) {
      result[id] = { x: body.position.x, y: body.position.y };
    }
    return result;
  }

  stopSimulation() {
    this._simulating = false;
  }

  destroy() {
    this._simulating = false;
    Engine.clear(this.engine);
    World.clear(this.world);
  }
}
