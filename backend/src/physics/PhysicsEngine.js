import Matter from 'matter-js';
import { BOARD, POCKET, COIN, STRIKER, COIN_COLORS } from '../constants/gameConstants.js';

const { Engine, World, Bodies, Body, Events, Vector } = Matter;

/**
 * Server-side physics simulation using Matter.js.
 * Runs a step-by-step simulation and returns final positions.
 */
export class PhysicsEngine {
  constructor() {
    this.engine = Engine.create({
      gravity: { x: 0, y: 0 }, // Top-down view – no gravity
      positionIterations: 10,
      velocityIterations: 10,
    });
    this.world = this.engine.world;
    this.bodies = new Map(); // id -> body
    this._setupWalls();
  }

  _setupWalls() {
    const { SIZE, BORDER } = BOARD;
    const thickness = 40;
    const walls = [
      Bodies.rectangle(SIZE / 2, BORDER / 2, SIZE, thickness, { isStatic: true, label: 'wall_top' }),
      Bodies.rectangle(SIZE / 2, SIZE - BORDER / 2, SIZE, thickness, { isStatic: true, label: 'wall_bottom' }),
      Bodies.rectangle(BORDER / 2, SIZE / 2, thickness, SIZE, { isStatic: true, label: 'wall_left' }),
      Bodies.rectangle(SIZE - BORDER / 2, SIZE / 2, thickness, SIZE, { isStatic: true, label: 'wall_right' }),
    ];
    World.add(this.world, walls);
  }

  /**
   * Load coins and striker from game state
   */
  loadState(coins, strikerPos) {
    // Clear previous dynamic bodies
    const dynamic = this.world.bodies.filter(b => !b.isStatic);
    World.remove(this.world, dynamic);
    this.bodies.clear();

    coins.forEach(coin => {
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
   * Apply velocity to striker and simulate until everything stops.
   * Returns final state: { coins, pocketed, strikerPocketed }
   */
  simulate(angle, power, maxSteps = 3000) {
    const vMag = power * 0.25; // match client velocity scale
    const striker = this.bodies.get('striker');
    Body.setVelocity(striker, {
      x: Math.cos(angle) * vMag,
      y: Math.sin(angle) * vMag,
    });

    const pocketed = [];
    let strikerPocketed = false;
    const pocketPositions = POCKET.POSITIONS;

    for (let step = 0; step < maxSteps; step++) {
      Engine.update(this.engine, 16.67);

      // Check pocketing
      for (const [id, body] of this.bodies.entries()) {
        if (body.isStatic) continue;
        for (const pocket of pocketPositions) {
          const dx = body.position.x - pocket.x;
          const dy = body.position.y - pocket.y;
          if (Math.sqrt(dx * dx + dy * dy) < POCKET.RADIUS) {
            if (id === 'striker') {
              strikerPocketed = true;
            } else {
              pocketed.push(id);
            }
            World.remove(this.world, body);
            this.bodies.delete(id);
            break;
          }
        }
      }

      // Check if all bodies are sleeping/stopped
      const allStopped = [...this.bodies.values()].every(b => {
        const spd = Vector.magnitude(b.velocity);
        return spd < 0.05;
      });
      if (allStopped && step > 30) break;
    }

    // Collect final positions
    const finalCoins = [];
    for (const [id, body] of this.bodies.entries()) {
      if (id !== 'striker') {
        finalCoins.push({ id, x: body.position.x, y: body.position.y });
      }
    }

    const strikerFinal = this.bodies.has('striker')
      ? { x: this.bodies.get('striker').position.x, y: this.bodies.get('striker').position.y }
      : null;

    return { finalCoins, pocketed, strikerPocketed, strikerFinal };
  }

  destroy() {
    Engine.clear(this.engine);
    World.clear(this.world);
  }
}
