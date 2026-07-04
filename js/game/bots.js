// Bot brains. Bots obey the same rules as players: their only verb is the tap.
// Survival reflex runs every tick; attacking happens on a human-ish cadence and
// only when the shot's own recoil won't fling the bot into the void.

import { SHELL_SPEED, TANK_RADIUS, RECOIL_IMPULSE, DAMPING } from './constants.js';
import { applyTap } from './sim.js';
import { supported, edgeMargin } from '../engine/physics.js';

const LOOKAHEAD = 0.7; // s of drift projection for the panic brake

export function stepBots(state, dt) {
  if (state.phase !== 'playing') return;
  for (const tank of state.tanks) {
    if (!tank.isBot || tank.state !== 'active') continue;
    tank.bot.nextThink -= dt;

    // Survival reflex: every tick, not on the think timer. A queued brake shot
    // fires the moment the barrel aligns and the cooldown clears.
    const panic = panicDirection(state, tank);
    if (panic != null) {
      applyTap(state, tank.id, tank.x + Math.cos(panic) * 200, tank.y + Math.sin(panic) * 200);
      tank.bot.nextThink = Math.max(tank.bot.nextThink, 0.25);
      continue;
    }

    if (tank.bot.nextThink > 0) continue;

    const target = nearestEnemy(state, tank);
    let aim = null;
    if (target) {
      const dist = Math.hypot(target.x - tank.x, target.y - tank.y);
      const flight = dist / SHELL_SPEED;
      const lead = 0.85 * tank.botSkill;
      let aimX = target.x + target.vx * flight * lead;
      let aimY = target.y + target.vy * flight * lead;
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

// Would firing along aimAngle recoil us somewhere fatal? Project the drift at
// ~0.35s and at rest (total drift of velocity v under damping k is v/k).
function recoilSafe(state, tank, aimAngle) {
  const vx = tank.vx - Math.cos(aimAngle) * RECOIL_IMPULSE;
  const vy = tank.vy - Math.sin(aimAngle) * RECOIL_IMPULSE;
  const margin = TANK_RADIUS * 0.9;
  const midX = tank.x + vx * 0.35;
  const midY = tank.y + vy * 0.35;
  const restX = tank.x + vx / DAMPING;
  const restY = tank.y + vy / DAMPING;
  return edgeMargin(state.map, midX, midY) > margin
    && edgeMargin(state.map, restX, restY) > margin;
}

// Returns the direction to SHOOT (recoil pushes opposite), or null if safe.
function panicDirection(state, tank) {
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
function lowestMarginDirection(state, tank) {
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

function nearestEnemy(state, tank) {
  let best = null;
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
