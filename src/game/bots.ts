// Bot brains. Bots obey the same rules as players: their only verb is the tap.
// Survival reflex runs every tick (with a human-ish reaction delay); attacking
// happens on a think cadence and only when the shot's own recoil is survivable.

import { SHELL_SPEED, SHELL_RANGE, TANK_RADIUS, RECOIL_IMPULSE, DAMPING } from './constants.js';
import { applyTap } from './sim.js';
import { supported, edgeMargin } from '../engine/physics.js';
import type { SimState, Tank } from '../types.js';

const LOOKAHEAD = 0.7; // s of drift projection for the panic brake

export function stepBots(state: SimState, dt: number): void {
  if (state.phase !== 'playing') return;
  for (const tank of state.tanks) {
    if (!tank.isBot || !tank.bot || tank.state !== 'active') continue;
    tank.bot.nextThink -= dt;

    // Survival reflex: checked every tick, but acts only after a human-ish
    // reaction delay — a hard hit near the edge should beat the brake.
    const panic = panicDirection(state, tank);
    if (panic != null) {
      tank.bot.dangerT += dt;
      const reaction = 0.1 + (1 - tank.botSkill) * 0.3;
      if (tank.bot.dangerT >= reaction) {
        const flinch = (Math.random() - 0.5) * (1 - tank.botSkill) * 0.6;
        const a = panic + flinch;
        applyTap(state, tank.id, tank.x + Math.cos(a) * 200, tank.y + Math.sin(a) * 200);
        tank.bot.nextThink = Math.max(tank.bot.nextThink, 0.25);
      }
      continue;
    }
    tank.bot.dangerT = 0;

    if (tank.bot.nextThink > 0) continue;

    const target = nearestEnemy(state, tank);
    let aim: [number, number];
    if (target && Math.hypot(target.x - tank.x, target.y - tank.y) > SHELL_RANGE * 0.8) {
      // Out of range. Close the gap the only way anyone can: shoot in some
      // direction and ride the recoil. Greedily pick the recoil-safe shot
      // whose drift ends nearest the enemy — on island maps this walks bots
      // across bridges instead of diving at the void between pods.
      let bestAim: number | null = null;
      let bestDist = Math.hypot(target.x - tank.x, target.y - tank.y) - 30;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + Math.random() * 0.2;
        if (!recoilSafe(state, tank, a)) continue;
        const [rx, ry] = recoilRest(tank, a);
        const d = Math.hypot(target.x - rx, target.y - ry);
        if (d < bestDist) {
          bestDist = d;
          bestAim = a;
        }
      }
      if (bestAim != null) {
        applyTap(state, tank.id, tank.x + Math.cos(bestAim) * 200, tank.y + Math.sin(bestAim) * 200);
        tank.bot.nextThink = 0.4 + Math.random() * 0.3;
        continue;
      }
      // No safe way to close — fall through and take the long shot anyway;
      // the blast might still splash them.
    }
    if (target) {
      const dist = Math.hypot(target.x - tank.x, target.y - tank.y);
      const flight = dist / SHELL_SPEED;
      const lead = 0.85 * tank.botSkill;
      const aimX = target.x + target.vx * flight * lead;
      const aimY = target.y + target.vy * flight * lead;
      // Human error: worse when unskilled, worse when sliding fast.
      const speed = Math.hypot(tank.vx, tank.vy);
      const err = (1 - tank.botSkill) * 0.35 + Math.min(0.15, speed / 4000);
      const jitter = (Math.random() * 2 - 1) * err * dist;
      const perp = Math.atan2(aimY - tank.y, aimX - tank.x) + Math.PI / 2;
      aim = [aimX + Math.cos(perp) * jitter, aimY + Math.sin(perp) * jitter];
    } else {
      const a = Math.random() * Math.PI * 2;
      aim = [tank.x + Math.cos(a) * 300, tank.y + Math.sin(a) * 300];
    }

    const aimAngle = Math.atan2(aim[1] - tank.y, aim[0] - tank.x);
    if (recoilSafe(state, tank, aimAngle)) {
      applyTap(state, tank.id, aim[0], aim[1]);
    } else {
      // The shot would fling us off. Reposition instead: shoot toward the
      // nearest dropoff so the recoil walks us back to safety.
      const inward = lowestMarginDirection(state, tank);
      applyTap(state, tank.id, tank.x + Math.cos(inward) * 200, tank.y + Math.sin(inward) * 200);
    }
    tank.bot.nextThink = 0.45 + Math.random() * 0.5 + (1 - tank.botSkill) * 0.4;
  }
}

// Post-recoil drift: [restX, restY, midX, midY] — position at rest (total
// drift of velocity v under damping k is v/k) and ~0.35s out.
function recoilRest(tank: Tank, aimAngle: number): [number, number, number, number] {
  const vx = tank.vx - Math.cos(aimAngle) * RECOIL_IMPULSE;
  const vy = tank.vy - Math.sin(aimAngle) * RECOIL_IMPULSE;
  return [tank.x + vx / DAMPING, tank.y + vy / DAMPING, tank.x + vx * 0.35, tank.y + vy * 0.35];
}

// Would firing along aimAngle recoil us somewhere fatal?
function recoilSafe(state: SimState, tank: Tank, aimAngle: number): boolean {
  const margin = TANK_RADIUS * 0.6; // brave enough to fight near the edge
  const [restX, restY, midX, midY] = recoilRest(tank, aimAngle);
  return edgeMargin(state.map, midX, midY) > margin
    && edgeMargin(state.map, restX, restY) > margin;
}

// Returns the direction to SHOOT (recoil pushes opposite), or null if safe.
function panicDirection(state: SimState, tank: Tank): number | null {
  // 1) Momentum carrying us off the map soon → brake by shooting along velocity.
  const speed = Math.hypot(tank.vx, tank.vy);
  if (speed > 40) {
    const fx = tank.x + tank.vx * LOOKAHEAD;
    const fy = tank.y + tank.vy * LOOKAHEAD;
    if (!supported(state.map, fx, fy)) {
      return Math.atan2(tank.vy, tank.vx);
    }
  }
  // 2) Standing too close to an edge → step back toward the middle.
  if (edgeMargin(state.map, tank.x, tank.y) < TANK_RADIUS * 1.6) {
    return lowestMarginDirection(state, tank);
  }
  return null;
}

// Direction of the nearest dropoff — shooting that way recoils us to safety.
function lowestMarginDirection(state: SimState, tank: Tank): number {
  let worstDir = 0;
  let worstMargin = Infinity;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const m = edgeMargin(state.map, tank.x + Math.cos(a) * TANK_RADIUS * 2, tank.y + Math.sin(a) * TANK_RADIUS * 2);
    if (m < worstMargin) {
      worstMargin = m;
      worstDir = a;
    }
  }
  return worstDir;
}

function nearestEnemy(state: SimState, tank: Tank): Tank | null {
  let best: Tank | null = null;
  let bestDist = Infinity;
  for (const other of state.tanks) {
    if (other === tank || other.state !== 'active' || other.shield > 0) continue;
    const d = Math.hypot(other.x - tank.x, other.y - tank.y);
    if (d < bestDist) {
      bestDist = d;
      best = other;
    }
  }
  return best;
}
