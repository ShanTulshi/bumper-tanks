// Pure, DOM-free simulation. One source of truth for host, solo, and bots.
// Drivers call: createMatch → applyTap (on input) → step(dt) → drain returned events.

import {
  TANK_RADIUS, SHELL_RADIUS, DAMPING, ROT_SPEED, FIRE_COOLDOWN, RECOIL_IMPULSE,
  SHELL_SPEED, SHELL_RANGE, HIT_IMPULSE, AOE_RADIUS, AOE_IMPULSE, SELF_HIT_GRACE,
  TANK_RESTITUTION, WALL_RESTITUTION, BUMP_MIN_SPEED, FALL_TIME, RESPAWN_TIME,
  SPAWN_SHIELD, KILL_CREDIT_WINDOW, RUMBLE_DURATION, LTS_ROUND_WINS, COUNTDOWN,
  ROUND_END_PAUSE, MATCH_END_PAUSE,
} from './constants.js';
import { mapById } from './maps.js';
import {
  supported, resolveCircleCircle, bounceOffWall, angleLerpToward, angleDiff,
} from '../engine/physics.js';
import type {
  GameMode, PlayerConfig, PlayerId, SimEvent, SimState, Tank,
} from '../types.js';

export interface MatchConfig {
  mode: GameMode;
  mapId: string;
  players: PlayerConfig[];
}

export function createMatch({ mode, mapId, players }: MatchConfig): SimState {
  const state: SimState = {
    mode, // 'rumble' | 'lts' | 'sandbox'
    mapId,
    map: mapById(mapId),
    time: 0,
    phase: mode === 'sandbox' ? 'playing' : 'countdown',
    phaseT: mode === 'sandbox' ? 0 : COUNTDOWN,
    timeLeft: mode === 'rumble' ? RUMBLE_DURATION : 0,
    round: 1,
    winnerId: null,
    roundWinnerId: null,
    tanks: [],
    shells: [],
    nextShellId: 1,
    events: [],
  };
  for (const p of players) addTank(state, p);
  placeAtSpawns(state);
  if (state.phase === 'countdown') state.events.push({ type: 'countdown', n: COUNTDOWN });
  return state;
}

export function addTank(state: SimState, { id, name, colorIdx, isBot = false, botSkill = 0.7 }: PlayerConfig): Tank {
  const tank: Tank = {
    id, name, colorIdx, isBot, botSkill,
    bot: isBot ? { nextThink: 0.5 + Math.random() * 0.5, dangerT: 0 } : null,
    x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0,
    angle: 0, pangle: 0, targetAngle: 0, queued: false, cooldown: 0,
    radius: TANK_RADIUS,
    state: 'active', stateT: 0, shield: SPAWN_SHIELD,
    score: 0, deaths: 0, roundWins: 0,
    lastHitBy: null, lastHitT: -Infinity, pendingKiller: null,
  };
  state.tanks.push(tank);
  spawnTank(state, tank);
  return tank;
}

export function removeTank(state: SimState, id: PlayerId): void {
  state.tanks = state.tanks.filter((t) => t.id !== id);
  state.shells = state.shells.filter((s) => s.owner !== id);
}

export function getTank<T extends { id: PlayerId }>(state: { tanks: T[] }, id: PlayerId): T | undefined {
  return state.tanks.find((t) => t.id === id);
}

export function applyTap(state: SimState, id: PlayerId, x: number, y: number): void {
  const tank = getTank(state, id);
  if (!tank) return;
  if (tank.state !== 'active') return;
  if (state.phase === 'roundover' || state.phase === 'over') return;
  tank.targetAngle = Math.atan2(y - tank.y, x - tank.x);
  tank.queued = true;
}

function placeAtSpawns(state: SimState): void {
  const spawns = [...state.map.spawns];
  state.tanks.forEach((tank, i) => {
    const [sx, sy] = spawns[i % spawns.length];
    tank.x = tank.px = sx;
    tank.y = tank.py = sy;
    tank.vx = tank.vy = 0;
    tank.angle = tank.pangle = tank.targetAngle = Math.atan2(-sy, -sx);
    tank.queued = false;
    tank.cooldown = 0;
    tank.state = 'active';
    tank.stateT = 0;
    tank.shield = SPAWN_SHIELD;
    tank.lastHitBy = null;
    tank.lastHitT = -Infinity;
    tank.pendingKiller = null;
  });
  state.shells = [];
}

// Respawn at the spawn point farthest from living enemies.
function spawnTank(state: SimState, tank: Tank): void {
  let best = state.map.spawns[0];
  let bestScore = -Infinity;
  for (const [sx, sy] of state.map.spawns) {
    let minDist = Infinity;
    for (const other of state.tanks) {
      if (other === tank || other.state !== 'active') continue;
      minDist = Math.min(minDist, Math.hypot(other.x - sx, other.y - sy));
    }
    if (minDist > bestScore) {
      bestScore = minDist;
      best = [sx, sy];
    }
  }
  tank.x = tank.px = best[0];
  tank.y = tank.py = best[1];
  tank.vx = tank.vy = 0;
  tank.angle = tank.pangle = tank.targetAngle = Math.atan2(-best[1], -best[0]);
  tank.queued = false;
  tank.state = 'active';
  tank.stateT = 0;
  tank.shield = SPAWN_SHIELD;
  tank.lastHitBy = null;
  tank.lastHitT = -Infinity;
  tank.pendingKiller = null;
  state.events.push({ type: 'spawn', id: tank.id, x: tank.x, y: tank.y });
}

function recordHit(state: SimState, victim: Tank, attackerId: PlayerId): void {
  victim.lastHitBy = attackerId;
  victim.lastHitT = state.time;
}

function explode(state: SimState, x: number, y: number, ownerId: PlayerId): void {
  state.events.push({ type: 'explode', x, y, owner: ownerId });
  for (const tank of state.tanks) {
    if (tank.state !== 'active' || tank.shield > 0) continue;
    const dx = tank.x - x;
    const dy = tank.y - y;
    const d = Math.hypot(dx, dy);
    if (d > AOE_RADIUS) continue;
    const falloff = 1 - d / AOE_RADIUS;
    const mag = AOE_IMPULSE * falloff;
    const inv = d > 1e-6 ? 1 / d : 0;
    tank.vx += (d > 1e-6 ? dx * inv : Math.random() - 0.5) * mag;
    tank.vy += (d > 1e-6 ? dy * inv : Math.random() - 0.5) * mag;
    if (tank.id !== ownerId) recordHit(state, tank, ownerId);
  }
}

function fireShell(state: SimState, tank: Tank): void {
  const dir = tank.angle;
  const cos = Math.cos(dir);
  const sin = Math.sin(dir);
  const muzzle = tank.radius + SHELL_RADIUS + 6;
  state.shells.push({
    id: state.nextShellId++,
    owner: tank.id,
    x: tank.x + cos * muzzle,
    y: tank.y + sin * muzzle,
    px: tank.x + cos * muzzle,
    py: tank.y + sin * muzzle,
    vx: cos * SHELL_SPEED,
    vy: sin * SHELL_SPEED,
    dist: 0,
    age: 0,
    radius: SHELL_RADIUS,
  });
  tank.vx -= cos * RECOIL_IMPULSE;
  tank.vy -= sin * RECOIL_IMPULSE;
  tank.cooldown = FIRE_COOLDOWN;
  tank.queued = false;
  state.events.push({ type: 'fire', id: tank.id, x: tank.x, y: tank.y, angle: dir });
}

function roundSurvivors(state: SimState): Tank[] {
  return state.tanks.filter((t) => t.state !== 'ghost');
}

function endMatch(state: SimState, winnerId: PlayerId | null): void {
  state.phase = 'over';
  state.phaseT = MATCH_END_PAUSE;
  state.winnerId = winnerId;
  state.events.push({ type: 'matchOver', winnerId });
}

function rumbleWinner(state: SimState): PlayerId | null {
  const ranked = [...state.tanks].sort((a, b) => b.score - a.score || a.deaths - b.deaths);
  return ranked[0]?.id ?? null;
}

export function step(state: SimState, dt: number): SimEvent[] {
  state.time += dt;

  // --- Phase machinery -------------------------------------------------
  if (state.phase === 'countdown') {
    const before = Math.ceil(state.phaseT);
    state.phaseT -= dt;
    const after = Math.ceil(state.phaseT);
    if (after < before && after > 0) state.events.push({ type: 'countdown', n: after });
    if (state.phaseT <= 0) {
      state.phase = 'playing';
      state.phaseT = 0;
      state.events.push({ type: 'roundStart', round: state.round });
    }
  } else if (state.phase === 'roundover') {
    state.phaseT -= dt;
    if (state.phaseT <= 0) {
      state.round += 1;
      state.tanks.forEach((t) => { if (t.state === 'ghost') t.state = 'active'; });
      placeAtSpawns(state);
      state.phase = 'countdown';
      state.phaseT = COUNTDOWN;
      state.events.push({ type: 'countdown', n: COUNTDOWN });
    }
  } else if (state.phase === 'over') {
    state.phaseT -= dt;
  } else if (state.phase === 'playing' && state.mode === 'rumble') {
    const before = Math.ceil(state.timeLeft);
    state.timeLeft -= dt;
    const after = Math.ceil(state.timeLeft);
    if (after < before && after <= 5 && after > 0) state.events.push({ type: 'countdown', n: after });
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      endMatch(state, rumbleWinner(state));
    }
  }

  const playing = state.phase === 'playing';

  // --- Tanks: aim, fire, integrate -------------------------------------
  for (const tank of state.tanks) {
    tank.px = tank.x;
    tank.py = tank.y;
    tank.pangle = tank.angle;
    tank.stateT += dt;
    tank.cooldown = Math.max(0, tank.cooldown - dt);
    tank.shield = Math.max(0, tank.shield - dt);

    if (tank.state === 'active') {
      tank.angle = angleLerpToward(tank.angle, tank.targetAngle, ROT_SPEED * dt);
      if (playing && tank.queued && tank.cooldown <= 0
          && Math.abs(angleDiff(tank.angle, tank.targetAngle)) < 0.06) {
        fireShell(state, tank);
      }
    }

    if (tank.state === 'active' || tank.state === 'falling') {
      const damp = Math.exp(-DAMPING * dt);
      tank.vx *= damp;
      tank.vy *= damp;
      tank.x += tank.vx * dt;
      tank.y += tank.vy * dt;
    }
  }

  // --- Tank vs tank (bumper cars) ---------------------------------------
  for (let i = 0; i < state.tanks.length; i++) {
    for (let j = i + 1; j < state.tanks.length; j++) {
      const a = state.tanks[i];
      const b = state.tanks[j];
      if (a.state !== 'active' || b.state !== 'active') continue;
      const impact = resolveCircleCircle(a, b, TANK_RESTITUTION);
      if (impact > BUMP_MIN_SPEED) {
        if (a.shield <= 0) recordHit(state, a, b.id);
        if (b.shield <= 0) recordHit(state, b, a.id);
        state.events.push({
          type: 'bump',
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          intensity: Math.min(1, impact / 400),
        });
      }
    }
  }

  // --- Tank vs wall ------------------------------------------------------
  for (const tank of state.tanks) {
    if (tank.state !== 'active') continue;
    for (const wall of state.map.walls) bounceOffWall(tank, wall, WALL_RESTITUTION);
  }

  // --- Shells -------------------------------------------------------------
  const deadShells = new Set<number>();
  for (const shell of state.shells) {
    shell.px = shell.x;
    shell.py = shell.y;
    shell.age += dt;
    shell.x += shell.vx * dt;
    shell.y += shell.vy * dt;
    shell.dist += SHELL_SPEED * dt;

    if (shell.dist >= SHELL_RANGE) {
      explode(state, shell.x, shell.y, shell.owner);
      deadShells.add(shell.id);
      continue;
    }
    let hitWall = false;
    for (const wall of state.map.walls) {
      const probe = { x: shell.x, y: shell.y, vx: shell.vx, vy: shell.vy, radius: shell.radius };
      if (bounceOffWall(probe, wall, 0)) {
        explode(state, probe.x, probe.y, shell.owner);
        deadShells.add(shell.id);
        hitWall = true;
        break;
      }
    }
    if (hitWall) continue;
    for (const tank of state.tanks) {
      if (tank.state !== 'active') continue;
      if (tank.id === shell.owner && shell.age < SELF_HIT_GRACE) continue;
      const d = Math.hypot(tank.x - shell.x, tank.y - shell.y);
      if (d > tank.radius + shell.radius) continue;
      if (tank.shield > 0) {
        state.events.push({ type: 'shieldPop', x: shell.x, y: shell.y, id: tank.id });
      } else {
        const speed = Math.hypot(shell.vx, shell.vy) || 1;
        tank.vx += (shell.vx / speed) * HIT_IMPULSE;
        tank.vy += (shell.vy / speed) * HIT_IMPULSE;
        if (tank.id !== shell.owner) recordHit(state, tank, shell.owner);
        state.events.push({ type: 'hit', x: shell.x, y: shell.y, targetId: tank.id, shooterId: shell.owner });
      }
      deadShells.add(shell.id);
      break;
    }
  }
  if (deadShells.size) state.shells = state.shells.filter((s) => !deadShells.has(s.id));

  // --- Falling off the world ----------------------------------------------
  for (const tank of state.tanks) {
    if (tank.state === 'active' && !supported(state.map, tank.x, tank.y)) {
      tank.state = 'falling';
      tank.stateT = 0;
      const fresh = state.time - tank.lastHitT < KILL_CREDIT_WINDOW;
      tank.pendingKiller = fresh && tank.lastHitBy !== tank.id ? tank.lastHitBy : null;
      state.events.push({ type: 'fall', id: tank.id, x: tank.x, y: tank.y });
    }
  }

  // --- Deaths & respawns ----------------------------------------------------
  for (const tank of state.tanks) {
    if (tank.state === 'falling' && tank.stateT >= FALL_TIME) {
      tank.deaths += 1;
      const killer = tank.pendingKiller != null ? getTank(state, tank.pendingKiller) : null;
      if (killer) killer.score += 1;
      state.events.push({ type: 'ko', victimId: tank.id, killerId: killer ? killer.id : null });
      tank.state = state.mode === 'lts' && state.phase === 'playing' ? 'ghost' : 'dead';
      tank.stateT = 0;
      tank.vx = tank.vy = 0;
    } else if (tank.state === 'dead' && tank.stateT >= RESPAWN_TIME && state.phase === 'playing') {
      spawnTank(state, tank);
    }
  }

  // --- Last-tank-standing round resolution -----------------------------------
  if (state.mode === 'lts' && state.phase === 'playing' && state.tanks.length > 1) {
    const survivors = roundSurvivors(state);
    if (survivors.length <= 1) {
      const winner = survivors[0] ?? null;
      state.roundWinnerId = winner ? winner.id : null;
      if (winner) winner.roundWins += 1;
      state.events.push({ type: 'roundOver', winnerId: state.roundWinnerId, round: state.round });
      if (winner && winner.roundWins >= LTS_ROUND_WINS) {
        endMatch(state, winner.id);
      } else {
        state.phase = 'roundover';
        state.phaseT = ROUND_END_PAUSE;
      }
    }
  }

  const events = state.events;
  state.events = [];
  return events;
}
