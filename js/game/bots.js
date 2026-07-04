// Bot brains. Bots obey the same rules as players: their only verb is the tap.
// Survival instinct: when drifting toward an edge, shoot that way — recoil
// knocks you back to safety. Offense: lead the nearest enemy, with human error.

import { SHELL_SPEED, TANK_RADIUS } from './constants.js';
import { applyTap } from './sim.js';
import { supported, edgeMargin } from '../engine/physics.js';

const EMERGENCY_CHECK = 0.15;
const LOOKAHEAD = 0.55; // s of drift projection for the panic brake

export function stepBots(state, dt) {
  if (state.phase !== 'playing') return;
  for (const tank of state.tanks) {
    if (!tank.isBot || tank.state !== 'active') continue;
    tank.bot.nextThink -= dt;
    if (tank.bot.nextThink > 0) continue;

    const emergency = panicDirection(state, tank);
    if (emergency != null) {
      applyTap(state, tank.id, tank.x + Math.cos(emergency) * 200, tank.y + Math.sin(emergency) * 200);
      tank.bot.nextThink = EMERGENCY_CHECK;
      continue;
    }

    const target = nearestEnemy(state, tank);
    if (target) {
      const dist = Math.hypot(target.x - tank.x, target.y - tank.y);
      const flight = dist / SHELL_SPEED;
      const lead = 0.85 * tank.botSkill;
      let aimX = target.x + target.vx * flight * lead;
      let aimY = target.y + target.vy * flight * lead;
      // Human error: worse when unskilled, worse when we're sliding fast.
      const speed = Math.hypot(tank.vx, tank.vy);
      const err = (1 - tank.botSkill) * 0.35 + Math.min(0.15, speed / 4000);
      const jitter = (Math.random() * 2 - 1) * err * dist;
      const perp = Math.atan2(aimY - tank.y, aimX - tank.x) + Math.PI / 2;
      aimX += Math.cos(perp) * jitter;
      aimY += Math.sin(perp) * jitter;
      applyTap(state, tank.id, aimX, aimY);
    } else {
      // Nobody to fight: drift somewhere new.
      const a = Math.random() * Math.PI * 2;
      applyTap(state, tank.id, tank.x + Math.cos(a) * 300, tank.y + Math.sin(a) * 300);
    }
    tank.bot.nextThink = 0.45 + Math.random() * 0.5 + (1 - tank.botSkill) * 0.4;
  }
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
  // 2) Standing too close to an edge → find the nearest dropoff and shoot toward it.
  if (edgeMargin(state.map, tank.x, tank.y) < TANK_RADIUS * 1.6) {
    let worstDir = null;
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
  return null;
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
