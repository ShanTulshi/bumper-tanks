// Wire format. Host is authoritative; guests send taps, receive snapshots.
import { PROTOCOL_VERSION } from '../game/constants.js';
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
};
export function hello(name) {
    return { t: MSG.HELLO, v: PROTOCOL_VERSION, name };
}
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const TANK_STATE_CODES = { active: 0, falling: 1, dead: 2, ghost: 3 };
const TANK_STATE_NAMES = ['active', 'falling', 'dead', 'ghost'];
export function packSnapshot(state, events) {
    return {
        t: MSG.SNAP,
        tm: r3(state.time),
        ph: state.phase,
        pt: r2(state.phaseT),
        tl: r2(state.timeLeft),
        rd: state.round,
        wn: state.winnerId,
        tanks: state.tanks.map((k) => [
            k.id, r1(k.x), r1(k.y), r3(k.angle), TANK_STATE_CODES[k.state],
            r2(k.stateT), r2(k.shield), k.score, k.deaths, k.roundWins,
        ]),
        shells: state.shells.map((s) => [s.id, r1(s.x), r1(s.y), r1(s.vx), r1(s.vy), s.owner]),
        ev: events,
    };
}
export function unpackTankState(code) {
    return TANK_STATE_NAMES[code] || 'active';
}
