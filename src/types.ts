// Shared shapes for the sim, renderer, and network protocol.

export interface Rect {
  cx: number;
  cy: number;
  w: number;
  h: number;
  r: number;
}

export interface MapDef {
  id: string;
  name: string;
  tagline: string;
  floors: Rect[];
  holes: Rect[];
  walls: Rect[];
  spawns: [number, number][];
}

export type GameMode = 'rumble' | 'lts' | 'sandbox';
export type Phase = 'countdown' | 'playing' | 'roundover' | 'over';
export type TankStateName = 'active' | 'falling' | 'dead' | 'ghost';
export type PlayerId = string;

export interface PlayerConfig {
  id: PlayerId;
  name: string;
  colorIdx: number;
  isBot?: boolean;
  botSkill?: number;
}

export interface BotBrain {
  nextThink: number;
  dangerT: number;
}

// Everything the renderer needs from a tank. Sim tanks and the guest's
// interpolated ghost tanks both satisfy this structurally.
export interface RenderTank {
  id: PlayerId;
  name: string;
  colorIdx: number;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  angle: number;
  pangle: number;
  radius: number;
  state: TankStateName;
  stateT: number;
  shield: number;
  score: number;
  deaths: number;
  roundWins: number;
}

export interface Tank extends RenderTank {
  isBot: boolean;
  botSkill: number;
  bot: BotBrain | null;
  targetAngle: number;
  queued: boolean;
  cooldown: number;
  lastHitBy: PlayerId | null;
  lastHitT: number;
  pendingKiller: PlayerId | null;
}

export interface RenderShell {
  id: number;
  owner: PlayerId;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface Shell extends RenderShell {
  dist: number;
  age: number;
}

// The renderer/HUD-facing view of a match; SimState and the guest's ghost
// state both satisfy it.
export interface RenderState {
  mode: GameMode;
  mapId: string;
  map: MapDef;
  time: number;
  phase: Phase;
  phaseT: number;
  timeLeft: number;
  round: number;
  winnerId: PlayerId | null;
  tanks: RenderTank[];
  shells: RenderShell[];
}

export interface SimState extends RenderState {
  tanks: Tank[];
  shells: Shell[];
  roundWinnerId: PlayerId | null;
  nextShellId: number;
  events: SimEvent[];
}

export type SimEvent =
  | { type: 'fire'; id: PlayerId; x: number; y: number; angle: number }
  | { type: 'hit'; x: number; y: number; targetId: PlayerId; shooterId: PlayerId }
  | { type: 'explode'; x: number; y: number; owner: PlayerId }
  | { type: 'bump'; x: number; y: number; intensity: number }
  | { type: 'fall'; id: PlayerId; x: number; y: number }
  | { type: 'ko'; victimId: PlayerId; killerId: PlayerId | null }
  | { type: 'spawn'; id: PlayerId; x: number; y: number }
  | { type: 'shieldPop'; x: number; y: number; id: PlayerId }
  | { type: 'countdown'; n: number }
  | { type: 'roundStart'; round: number }
  | { type: 'roundOver'; winnerId: PlayerId | null; round: number }
  | { type: 'matchOver'; winnerId: PlayerId | null };

// Guest-side interpolated view: display pos/angle chase snapshot targets.
export interface GhostTank extends RenderTank {
  tx: number;
  ty: number;
  tangle: number;
}

export interface GhostState extends RenderState {
  tanks: GhostTank[];
}

export interface RosterEntry {
  id: PlayerId;
  name: string;
  colorIdx: number;
  isBot: boolean;
  botSkill?: number;
}

export interface Standing {
  id: PlayerId;
  name: string;
  colorIdx: number;
  score: number;
  deaths: number;
  roundWins: number;
  mode: GameMode;
}
