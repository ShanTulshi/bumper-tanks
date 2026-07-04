// Wire format. Host is authoritative; guests send taps, receive snapshots.

import { PROTOCOL_VERSION } from '../game/constants.js';
import type {
  GameMode, Phase, PlayerId, RosterEntry, SimEvent, SimState, Standing, TankStateName,
} from '../types.js';

export const MSG = {
  HELLO: 'hello', // guest → host
  WELCOME: 'welcome', // host → guest
  LOBBY: 'lobby', // host → all
  START: 'start', // host → all
  SNAP: 'snap', // host → all: packed snapshot + events
  TAP: 'tap', // guest → host
  NAME: 'name', // guest → host
  END: 'end', // host → all
  REJECT: 'reject', // host → guest
} as const;

// [id, x, y, angle, stateCode, stateT, shield, score, deaths, roundWins]
export type TankRow = [PlayerId, number, number, number, number, number, number, number, number, number];
// [id, x, y, vx, vy, owner]
export type ShellRow = [number, number, number, number, number, PlayerId];

export interface HelloMsg { t: typeof MSG.HELLO; v: number; name: string }
export interface TapMsg { t: typeof MSG.TAP; x: number; y: number }
export interface NameMsg { t: typeof MSG.NAME; name: string }
export type GuestMsg = HelloMsg | TapMsg | NameMsg;

export interface WelcomeMsg { t: typeof MSG.WELCOME; yourId: PlayerId }
export interface RejectMsg { t: typeof MSG.REJECT; reason: string }
export interface LobbyMsg { t: typeof MSG.LOBBY; roster: RosterEntry[]; mode: GameMode; inMatch: boolean }
export interface StartMsg { t: typeof MSG.START; mode: GameMode; mapId: string; roster: RosterEntry[] }
export interface SnapMsg {
  t: typeof MSG.SNAP;
  tm: number;
  ph: Phase;
  pt: number;
  tl: number;
  rd: number;
  wn: PlayerId | null;
  tanks: TankRow[];
  shells: ShellRow[];
  ev: SimEvent[];
}
export interface EndMsg { t: typeof MSG.END; standings: Standing[]; winnerId: PlayerId | null }
export type HostMsg = WelcomeMsg | RejectMsg | LobbyMsg | StartMsg | SnapMsg | EndMsg;

export function hello(name: string): HelloMsg {
  return { t: MSG.HELLO, v: PROTOCOL_VERSION, name };
}

const r1 = (v: number): number => Math.round(v * 10) / 10;
const r2 = (v: number): number => Math.round(v * 100) / 100;
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

const TANK_STATE_CODES: Record<TankStateName, number> = { active: 0, falling: 1, dead: 2, ghost: 3 };
const TANK_STATE_NAMES: TankStateName[] = ['active', 'falling', 'dead', 'ghost'];

export function packSnapshot(state: SimState, events: SimEvent[]): SnapMsg {
  return {
    t: MSG.SNAP,
    tm: r3(state.time),
    ph: state.phase,
    pt: r2(state.phaseT),
    tl: r2(state.timeLeft),
    rd: state.round,
    wn: state.winnerId,
    tanks: state.tanks.map((k): TankRow => [
      k.id, r1(k.x), r1(k.y), r3(k.angle), TANK_STATE_CODES[k.state],
      r2(k.stateT), r2(k.shield), k.score, k.deaths, k.roundWins,
    ]),
    shells: state.shells.map((s): ShellRow => [s.id, r1(s.x), r1(s.y), r1(s.vx), r1(s.vy), s.owner]),
    ev: events,
  };
}

export function unpackTankState(code: number): TankStateName {
  return TANK_STATE_NAMES[code] || 'active';
}
