// App orchestrator: screens, sessions (solo/host/guest), HUD, FX, networking.
import { PLAYER_COLORS, randomCallsign, SNAPSHOT_HZ, MAX_PLAYERS, RESPAWN_TIME, LTS_ROUND_WINS, } from './game/constants.js';
import { MAPS, mapById, randomMap } from './game/maps.js';
import { createMatch, step as simStep, applyTap, addTank, removeTank, getTank } from './game/sim.js';
import { stepBots } from './game/bots.js';
import { Camera } from './engine/camera.js';
import { Renderer } from './engine/renderer.js';
import { Particles } from './engine/particles.js';
import { createLoop } from './engine/loop.js';
import { attachInput } from './engine/input.js';
import { sound } from './engine/sound.js';
import { MSG, hello, packSnapshot, unpackTankState, } from './net/protocol.js';
import { HostLobby, GuestConnection, generateLobbyCode, joinURL } from './net/lobby.js';
import { qrDataURL } from './lib/qr.js';
const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = new Renderer(canvas);
const camera = new Camera();
const particles = new Particles();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const colorHex = (idx) => PLAYER_COLORS[idx % PLAYER_COLORS.length].hex;
let myName = localStorage.getItem('bumper-tanks-name') || randomCallsign();
let session = null;
let host = null;
let guest = null;
// ---------------------------------------------------------------- resize
function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.resize(w, h, Math.min(2.5, window.devicePixelRatio || 1));
    camera.resize(w, h);
}
window.addEventListener('resize', onResize);
onResize();
// ---------------------------------------------------------------- screens
const screens = {
    menu: $('screen-menu'),
    lobby: $('screen-lobby'),
    join: $('screen-join'),
    results: $('screen-results'),
};
function showScreen(name) {
    for (const [key, el] of Object.entries(screens)) {
        el.classList.toggle('hidden', key !== name);
    }
    $('hud').classList.toggle('hidden', name !== null);
}
function setAccent(idx) {
    document.documentElement.style.setProperty('--accent', colorHex(idx));
}
// ---------------------------------------------------------------- HUD & FX
const feedEl = $('killfeed');
const centerEl = $('center-msg');
let transientMsg = null;
let scoreSig = '';
function centerMessage(big, small, dur = 1.6) {
    transientMsg = { big, small, until: performance.now() + dur * 1000 };
}
function feed(html) {
    const div = document.createElement('div');
    div.className = 'feed-entry';
    div.innerHTML = html;
    feedEl.prepend(div);
    setTimeout(() => div.remove(), 4200);
    while (feedEl.children.length > 5)
        feedEl.lastChild?.remove();
}
function nameSpan(tank) {
    return `<span style="color:${colorHex(tank.colorIdx)}">${tank.name}</span>`;
}
function fmtTime(s) {
    const m = Math.floor(Math.max(0, s) / 60);
    const sec = Math.ceil(Math.max(0, s) % 60);
    return `${m}:${String(sec === 60 ? 0 : sec).padStart(2, '0')}`;
}
function updateHUD(state, myId) {
    const timer = $('hud-timer');
    if (state.mode === 'rumble')
        timer.textContent = fmtTime(state.timeLeft);
    else if (state.mode === 'lts')
        timer.textContent = `R${state.round}`;
    else
        timer.textContent = '';
    $('hud-mode').textContent =
        state.mode === 'rumble' ? 'rumble' : state.mode === 'lts' ? `last standing · first to ${LTS_ROUND_WINS}` : 'playground';
    // Scores strip (rebuild only when values change).
    const ranked = [...state.tanks].sort((a, b) => state.mode === 'lts' ? b.roundWins - a.roundWins || b.score - a.score : b.score - a.score || a.deaths - b.deaths);
    const sig = ranked.map((t) => `${t.id}:${t.name}:${t.score}:${t.roundWins}:${t.state === 'ghost' ? 'x' : ''}`).join('|');
    if (sig !== scoreSig) {
        scoreSig = sig;
        $('scores').innerHTML = ranked.map((t) => `
      <div class="score-chip ${t.id === myId ? 'me' : ''} ${t.state === 'ghost' ? 'out' : ''}">
        <div class="dot" style="color:${colorHex(t.colorIdx)};background:${colorHex(t.colorIdx)}"></div>
        ${t.name} ${state.mode === 'lts' ? '★'.repeat(t.roundWins) : t.score}
      </div>`).join('');
    }
    // Center message: transient beats respawn status.
    const now = performance.now();
    if (transientMsg && now < transientMsg.until) {
        centerEl.innerHTML = `<div class="center-big">${transientMsg.big}</div>${transientMsg.small ? `<div class="center-small">${transientMsg.small}</div>` : ''}`;
    }
    else {
        transientMsg = null;
        const me = myId != null ? getTank(state, myId) : undefined;
        if (me && me.state === 'dead') {
            centerEl.innerHTML = `<div class="center-small">respawn in ${Math.ceil(RESPAWN_TIME - me.stateT)}</div>`;
        }
        else if (me && me.state === 'ghost') {
            centerEl.innerHTML = '<div class="center-small">out — next round soon</div>';
        }
        else {
            centerEl.innerHTML = '';
        }
    }
}
function processEvents(events, state, myId, { silent = false } = {}) {
    for (const ev of events) {
        switch (ev.type) {
            case 'fire': {
                const t = getTank(state, ev.id);
                const c = t ? colorHex(t.colorIdx) : '#ffffff';
                particles.burst(ev.x, ev.y, c, { count: 5, speed: 180, life: 0.25, size: 2.5, spread: 0.9, dir: ev.angle });
                if (!silent)
                    sound.fire();
                if (ev.id === myId && !reducedMotion.matches)
                    camera.addShake(2.5);
                break;
            }
            case 'hit': {
                const t = getTank(state, ev.targetId);
                const c = t ? colorHex(t.colorIdx) : '#ffffff';
                particles.burst(ev.x, ev.y, c, { count: 16, speed: 320, life: 0.5, size: 3 });
                particles.burst(ev.x, ev.y, '#ffffff', { count: 6, speed: 200, life: 0.3, size: 2 });
                particles.ring(ev.x, ev.y, c, { radius: 8, growth: 550, life: 0.3, width: 5 });
                if (!silent)
                    sound.hit();
                if (!reducedMotion.matches)
                    camera.addShake(ev.targetId === myId ? 9 : 3.5);
                break;
            }
            case 'explode': {
                const t = getTank(state, ev.owner);
                const c = t ? colorHex(t.colorIdx) : '#a16bff';
                particles.burst(ev.x, ev.y, c, { count: 22, speed: 380, life: 0.55, size: 3.5 });
                particles.ring(ev.x, ev.y, c, { radius: 12, growth: 700, life: 0.42, width: 7 });
                if (!silent)
                    sound.explode();
                if (!reducedMotion.matches) {
                    const d = Math.hypot(ev.x - camera.x, ev.y - camera.y);
                    camera.addShake(Math.max(0, 7 - d / 120));
                }
                break;
            }
            case 'bump':
                particles.burst(ev.x, ev.y, '#ffffff', { count: 6, speed: 160, life: 0.3, size: 2 });
                if (!silent)
                    sound.bump(ev.intensity);
                break;
            case 'fall':
                if (!silent)
                    sound.fall();
                break;
            case 'ko': {
                const victim = getTank(state, ev.victimId);
                const killer = ev.killerId != null ? getTank(state, ev.killerId) : undefined;
                if (victim) {
                    if (killer)
                        feed(`${nameSpan(killer)} ⌁ ${nameSpan(victim)}`);
                    else
                        feed(`${nameSpan(victim)} slipped into the void`);
                }
                if (!silent)
                    sound.ko();
                if (ev.victimId === myId)
                    centerMessage('INTO THE VOID', killer ? `${killer.name} got you` : 'nobody to blame', 1.8);
                else if (ev.killerId === myId && victim)
                    centerMessage('+1', `${victim.name} knocked out`, 1.2);
                break;
            }
            case 'spawn': {
                const t = getTank(state, ev.id);
                if (t)
                    particles.ring(ev.x, ev.y, colorHex(t.colorIdx), { radius: 6, growth: 320, life: 0.5, width: 4 });
                break;
            }
            case 'shieldPop':
                particles.ring(ev.x, ev.y, '#ffffff', { radius: 6, growth: 260, life: 0.25, width: 3 });
                if (!silent)
                    sound.shieldPop();
                break;
            case 'countdown':
                centerMessage(String(ev.n), null, 0.85);
                if (!silent)
                    sound.countdown(ev.n);
                break;
            case 'roundStart':
                centerMessage('GO', null, 0.8);
                if (!silent)
                    sound.roundStart();
                break;
            case 'roundOver': {
                const w = ev.winnerId != null ? getTank(state, ev.winnerId) : undefined;
                centerMessage(w ? `${w.name}` : 'DRAW', w ? 'takes the round' : null, 2.2);
                if (!silent)
                    sound.win();
                break;
            }
            case 'matchOver':
                if (!silent)
                    sound.win();
                break;
        }
    }
}
// Local simulation session: solo playground, attract mode, and the host side
// of a network match all run this.
class LocalSession {
    myId;
    attract;
    playground;
    onOver;
    state;
    pendingNetEvents = [];
    snapTimer = 0;
    overFired = false;
    botCount;
    loop;
    constructor({ mode, mapId, players, myId, attract = false, playground = false, onOver = null }) {
        this.myId = myId;
        this.attract = attract;
        this.playground = playground;
        this.onOver = onOver;
        this.state = createMatch({ mode, mapId, players });
        this.botCount = players.filter((p) => p.isBot).length;
        particles.clear();
        const me = myId != null ? getTank(this.state, myId) : undefined;
        camera.snapTo(me ? me.x : 0, me ? me.y : 0);
        this.loop = createLoop((dt) => this.step(dt), (alpha) => this.render(alpha));
        this.loop.start();
    }
    step(dt) {
        stepBots(this.state, dt);
        const events = simStep(this.state, dt);
        processEvents(events, this.state, this.myId, { silent: this.attract });
        if (host?.lobby && host.inMatch && !this.attract) {
            this.pendingNetEvents.push(...events);
            this.snapTimer -= dt;
            if (this.snapTimer <= 0) {
                this.snapTimer = 1 / SNAPSHOT_HZ;
                host.lobby.broadcast(packSnapshot(this.state, this.pendingNetEvents));
                this.pendingNetEvents = [];
            }
        }
        if (this.attract) {
            // Watch the brawl from its center of mass.
            let cx = 0;
            let cy = 0;
            let n = 0;
            for (const t of this.state.tanks) {
                if (t.state === 'active') {
                    cx += t.x;
                    cy += t.y;
                    n++;
                }
            }
            if (n)
                camera.follow(cx / n, cy / n, dt * 0.25);
        }
        else {
            const me = this.myId != null ? getTank(this.state, this.myId) : undefined;
            if (me && (me.state === 'active' || me.state === 'falling'))
                camera.follow(me.x, me.y, dt);
            else
                camera.follow(0, 0, dt * 0.35); // dead: drift back to the arena
        }
        if (this.state.phase === 'over' && this.state.phaseT <= 0 && !this.overFired) {
            this.overFired = true;
            this.onOver?.(this.state);
        }
        particles.update(dt);
        camera.update(dt);
    }
    render(alpha) {
        if (!this.attract)
            updateHUD(this.state, this.myId);
        renderer.render({ state: this.state, camera, particles, myId: this.myId, alpha, now: performance.now() / 1000 });
    }
    tap(sx, sy) {
        if (this.attract || this.myId == null)
            return;
        const [wx, wy] = camera.screenToWorld(sx, sy);
        applyTap(this.state, this.myId, wx, wy);
    }
    addBot() {
        const used = new Set(this.state.tanks.map((t) => t.colorIdx));
        let idx = 0;
        while (used.has(idx) && idx < PLAYER_COLORS.length)
            idx++;
        this.botCount++;
        addTank(this.state, {
            id: `bot-${Date.now()}-${this.botCount}`,
            name: randomCallsign(this.state.tanks.map((t) => t.name)),
            colorIdx: idx % PLAYER_COLORS.length,
            isBot: true,
            botSkill: 0.55 + Math.random() * 0.35,
        });
    }
    removeBot() {
        const bot = [...this.state.tanks].reverse().find((t) => t.isBot);
        if (bot)
            removeTank(this.state, bot.id);
    }
    destroy() {
        this.loop.destroy();
        particles.clear();
    }
}
// Guest session: renders interpolated snapshots, sends taps.
class GuestSession {
    myId;
    roster;
    state;
    tanksById = new Map();
    shellsById = new Map();
    snapped = false;
    loop;
    constructor({ mode, mapId, roster, myId }) {
        this.myId = myId;
        this.roster = new Map(roster.map((p) => [p.id, p]));
        this.state = {
            mode, mapId,
            map: mapById(mapId),
            phase: 'countdown', phaseT: 3, timeLeft: 0, round: 1, winnerId: null,
            time: 0, tanks: [], shells: [],
        };
        particles.clear();
        camera.snapTo(0, 0);
        this.loop = createLoop((dt) => this.step(dt), (alpha) => this.render(alpha));
        this.loop.start();
    }
    onSnapshot(msg) {
        const s = this.state;
        s.time = msg.tm;
        s.phase = msg.ph;
        s.phaseT = msg.pt;
        s.timeLeft = msg.tl;
        s.round = msg.rd;
        s.winnerId = msg.wn;
        const seen = new Set();
        for (const row of msg.tanks) {
            const [id, x, y, angle, stateCode, stateT, shield, score, deaths, roundWins] = row;
            seen.add(id);
            let t = this.tanksById.get(id);
            if (!t) {
                const info = this.roster.get(id) || { name: '???', colorIdx: 7 };
                t = {
                    id, name: info.name, colorIdx: info.colorIdx,
                    x, y, px: x, py: y, tx: x, ty: y,
                    angle, pangle: angle, tangle: angle,
                    state: 'active', stateT: 0, shield: 0, score: 0, deaths: 0, roundWins: 0,
                    radius: 24, vx: 0, vy: 0,
                };
                this.tanksById.set(id, t);
                s.tanks.push(t);
                if (!this.snapped && id === this.myId) {
                    camera.snapTo(x, y);
                    this.snapped = true;
                }
            }
            const newState = unpackTankState(stateCode);
            if ((newState === 'dead' || newState === 'ghost') && t.state !== newState) {
                // Teleport-on-respawn guard: forget stale display position.
                t.x = t.px = t.tx = x;
                t.y = t.py = t.ty = y;
            }
            t.tx = x;
            t.ty = y;
            t.tangle = angle;
            t.state = newState;
            t.stateT = stateT;
            t.shield = shield;
            t.score = score;
            t.deaths = deaths;
            t.roundWins = roundWins;
            const info = this.roster.get(id);
            if (info) {
                t.name = info.name;
                t.colorIdx = info.colorIdx;
            }
        }
        for (const [id, t] of this.tanksById) {
            if (!seen.has(id)) {
                this.tanksById.delete(id);
                s.tanks.splice(s.tanks.indexOf(t), 1);
            }
        }
        const seenShells = new Set();
        for (const [id, x, y, vx, vy, owner] of msg.shells) {
            seenShells.add(id);
            const sh = this.shellsById.get(id);
            if (!sh) {
                const fresh = { id, owner, x, y, px: x, py: y, vx, vy, radius: 7 };
                this.shellsById.set(id, fresh);
                s.shells.push(fresh);
            }
            else {
                // Gentle correction toward authoritative position.
                sh.x += (x - sh.x) * 0.5;
                sh.y += (y - sh.y) * 0.5;
                sh.vx = vx;
                sh.vy = vy;
            }
        }
        for (const [id, sh] of this.shellsById) {
            if (!seenShells.has(id)) {
                this.shellsById.delete(id);
                s.shells.splice(s.shells.indexOf(sh), 1);
            }
        }
        processEvents(msg.ev || [], s, this.myId);
    }
    step(dt) {
        const s = this.state;
        s.phaseT = Math.max(0, s.phaseT - dt);
        if (s.mode === 'rumble' && s.phase === 'playing')
            s.timeLeft = Math.max(0, s.timeLeft - dt);
        const k = 1 - Math.exp(-14 * dt);
        for (const t of s.tanks) {
            t.px = t.x;
            t.py = t.y;
            t.pangle = t.angle;
            t.x += (t.tx - t.x) * k;
            t.y += (t.ty - t.y) * k;
            let da = t.tangle - t.angle;
            while (da > Math.PI)
                da -= Math.PI * 2;
            while (da < -Math.PI)
                da += Math.PI * 2;
            t.angle += da * k;
            t.stateT += dt;
            // Approximate velocity for the falling streak.
            t.vx = (t.x - t.px) / Math.max(dt, 1e-4);
            t.vy = (t.y - t.py) / Math.max(dt, 1e-4);
        }
        for (const sh of s.shells) {
            sh.px = sh.x;
            sh.py = sh.y;
            sh.x += sh.vx * dt;
            sh.y += sh.vy * dt;
        }
        const me = this.tanksById.get(this.myId);
        if (me && (me.state === 'active' || me.state === 'falling'))
            camera.follow(me.x, me.y, dt);
        else
            camera.follow(0, 0, dt * 0.35); // dead/ghost: drift back to the arena
        particles.update(dt);
        camera.update(dt);
    }
    render(alpha) {
        updateHUD(this.state, this.myId);
        renderer.render({ state: this.state, camera, particles, myId: this.myId, alpha, now: performance.now() / 1000 });
    }
    tap(sx, sy) {
        const [wx, wy] = camera.screenToWorld(sx, sy);
        guest?.conn?.send({ t: MSG.TAP, x: wx, y: wy });
        // Predict the turret turn locally so aiming feels instant.
        const me = this.tanksById.get(this.myId);
        if (me && me.state === 'active')
            me.tangle = Math.atan2(wy - me.y, wx - me.x);
    }
    updateRoster(roster) {
        this.roster = new Map(roster.map((p) => [p.id, p]));
    }
    destroy() {
        this.loop.destroy();
        particles.clear();
    }
}
function endSession() {
    session?.destroy();
    session = null;
    transientMsg = null;
    feedEl.innerHTML = '';
    centerEl.innerHTML = '';
    scoreSig = '';
    $('scores').innerHTML = '';
}
// ---------------------------------------------------------------- attract
function startAttract() {
    endSession();
    const map = randomMap();
    const names = [];
    session = new LocalSession({
        mode: 'sandbox',
        mapId: map.id,
        myId: null,
        attract: true,
        players: [0, 1, 2, 3].map((i) => {
            names.push(randomCallsign(names));
            return { id: `attract-${i}`, name: names[i], colorIdx: i, isBot: true, botSkill: 0.75 };
        }),
    });
}
// ---------------------------------------------------------------- results
function showResults(standings, winnerId, isHost) {
    const winner = standings.find((p) => p.id === winnerId);
    $('results-title').textContent = winner ? `${winner.name} wins` : 'Match over';
    // Results glow in the winner's color — a little coronation.
    if (winner)
        setAccent(winner.colorIdx);
    $('results-list').innerHTML = standings.map((p, i) => `
    <div class="results-row ${p.id === winnerId ? 'winner' : ''}">
      <div class="place">${String(i + 1).padStart(2, '0')}</div>
      <div class="chip" style="color:${colorHex(p.colorIdx)};background:${colorHex(p.colorIdx)}"></div>
      <div class="name">${p.name}</div>
      <div class="pts">${p.mode === 'lts' || p.roundWins > 0 ? '★'.repeat(p.roundWins) + ' ' : ''}${p.score} KO · ${p.deaths} falls</div>
    </div>`).join('');
    $('btn-rematch').classList.toggle('hidden', !isHost);
    $('results-wait').classList.toggle('hidden', isHost);
    showScreen('results');
}
function standingsFrom(state) {
    return [...state.tanks]
        .sort((a, b) => (state.mode === 'lts'
        ? b.roundWins - a.roundWins || b.score - a.score
        : b.score - a.score || a.deaths - b.deaths))
        .map((t) => ({ id: t.id, name: t.name, colorIdx: t.colorIdx, score: t.score, deaths: t.deaths, roundWins: t.roundWins, mode: state.mode }));
}
// ---------------------------------------------------------------- host flow
function refreshLobbyUI() {
    if (!host)
        return;
    $('lobby-code').textContent = host.code;
    $('lobby-roster').innerHTML = host.roster.map((p) => `
    <div class="roster-row">
      <div class="chip" style="color:${colorHex(p.colorIdx)};background:${colorHex(p.colorIdx)}"></div>
      <div>${p.name}</div>
      <div class="who">${p.isBot ? 'bot' : p.id === 'host' ? 'host · you' : 'pilot'}</div>
    </div>`).join('');
    const startBtn = $('btn-start');
    const canStart = host.roster.filter((p) => !p.isBot).length >= 1 && host.roster.length >= 2;
    startBtn.disabled = !canStart;
    startBtn.textContent = canStart ? 'Launch' : 'Need 2+ tanks';
    $('btn-add-bot').disabled = host.roster.length >= MAX_PLAYERS;
}
function broadcastLobby() {
    if (!host)
        return;
    host.lobby?.broadcast({ t: MSG.LOBBY, roster: host.roster, mode: host.mode, inMatch: host.inMatch });
    refreshLobbyUI();
}
function startHosting() {
    endSession();
    startAttract(); // keep the void alive behind the lobby panel
    const code = generateLobbyCode();
    host = {
        code,
        mode: 'rumble',
        mapChoice: 'random',
        roster: [{ id: 'host', name: myName, colorIdx: 0, isBot: false }],
        inMatch: false,
        lobby: null,
    };
    setAccent(0);
    $('lobby-status').textContent = 'opening lobby…';
    $('lobby-status').classList.remove('error');
    $('host-controls').classList.remove('hidden');
    $('guest-wait').classList.add('hidden');
    showScreen('lobby');
    refreshLobbyUI();
    host.lobby = new HostLobby(code, {
        onOpen: () => {
            $('lobby-status').textContent = 'scan or share the code to join';
            $('qr-img').src = qrDataURL(joinURL(code));
        },
        onError: (err) => {
            if (err.type === 'unavailable-id') {
                // Code collision (rare): mint a new one.
                host?.lobby?.destroy();
                startHosting();
                return;
            }
            $('lobby-status').textContent = `network trouble: ${err.type || err.message}`;
            $('lobby-status').classList.add('error');
        },
        onJoin: () => { },
        onLeave: (peerId) => {
            if (!host)
                return;
            host.roster = host.roster.filter((p) => p.id !== peerId);
            if (host.inMatch && session instanceof LocalSession)
                removeTank(session.state, peerId);
            broadcastLobby();
        },
        onMessage: (peerId, msg) => {
            if (!host)
                return;
            if (msg.t === MSG.HELLO) {
                if (host.roster.length >= MAX_PLAYERS) {
                    host.lobby?.sendTo(peerId, { t: MSG.REJECT, reason: 'arena full' });
                    host.lobby?.kick(peerId);
                    return;
                }
                const used = new Set(host.roster.map((p) => p.colorIdx));
                let idx = 0;
                while (used.has(idx))
                    idx++;
                host.roster.push({ id: peerId, name: (msg.name || 'PILOT').slice(0, 10), colorIdx: idx, isBot: false });
                host.lobby?.sendTo(peerId, { t: MSG.WELCOME, yourId: peerId });
                broadcastLobby();
                // Late joiner during a match: drop them straight in.
                if (host.inMatch && session instanceof LocalSession) {
                    const p = host.roster.find((q) => q.id === peerId);
                    const tank = addTank(session.state, p);
                    if (session.state.mode === 'lts' && session.state.phase === 'playing')
                        tank.state = 'ghost';
                    host.lobby?.sendTo(peerId, { t: MSG.START, mode: session.state.mode, mapId: session.state.mapId, roster: host.roster });
                }
            }
            else if (msg.t === MSG.TAP) {
                if (host.inMatch && session instanceof LocalSession)
                    applyTap(session.state, peerId, msg.x, msg.y);
            }
            else if (msg.t === MSG.NAME) {
                const p = host.roster.find((q) => q.id === peerId);
                if (p) {
                    p.name = String(msg.name || '').slice(0, 10).toUpperCase() || p.name;
                    broadcastLobby();
                    if (host.inMatch && session instanceof LocalSession) {
                        const t = getTank(session.state, peerId);
                        if (t)
                            t.name = p.name;
                    }
                }
            }
        },
    });
}
function hostLaunch() {
    if (!host?.lobby)
        return;
    const mapId = host.mapChoice === 'random' ? randomMap().id : host.mapChoice;
    host.inMatch = true;
    host.lobby.broadcast({ t: MSG.START, mode: host.mode, mapId, roster: host.roster });
    endSession();
    showScreen(null);
    session = new LocalSession({
        mode: host.mode,
        mapId,
        myId: 'host',
        players: host.roster,
        onOver: (state) => {
            if (!host)
                return;
            const standings = standingsFrom(state);
            host.lobby?.broadcast({ t: MSG.END, standings, winnerId: state.winnerId });
            host.inMatch = false;
            showResults(standings, state.winnerId, true);
        },
    });
}
// ---------------------------------------------------------------- guest flow
function connectAsGuest(code) {
    endSession();
    startAttract();
    $('join-status').textContent = 'connecting…';
    $('join-status').classList.remove('error');
    const ctx = { code, myId: null, roster: [], conn: null };
    guest = ctx;
    ctx.conn = new GuestConnection(code, {
        onOpen: () => {
            ctx.conn?.send(hello(myName));
            $('join-status').textContent = 'joining lobby…';
        },
        onError: (err) => {
            const reason = err.type === 'peer-unavailable' ? 'no arena with that code' : `connection failed: ${err.type || err.message}`;
            $('join-status').textContent = reason;
            $('join-status').classList.add('error');
            ctx.conn?.destroy();
            if (guest === ctx)
                guest = null;
            showScreen('join');
        },
        onClose: () => {
            // Host vanished.
            endSession();
            ctx.conn?.destroy();
            if (guest === ctx)
                guest = null;
            startAttract();
            $('join-status').textContent = 'host disconnected';
            $('join-status').classList.add('error');
            showScreen('join');
        },
        onMessage: (msg) => {
            if (msg.t === MSG.WELCOME) {
                ctx.myId = msg.yourId;
            }
            else if (msg.t === MSG.REJECT) {
                $('join-status').textContent = msg.reason || 'rejected';
                $('join-status').classList.add('error');
                ctx.conn?.destroy();
                if (guest === ctx)
                    guest = null;
                showScreen('join');
            }
            else if (msg.t === MSG.LOBBY) {
                ctx.roster = msg.roster;
                const me = msg.roster.find((p) => p.id === ctx.myId);
                if (me)
                    setAccent(me.colorIdx);
                if (session instanceof GuestSession) {
                    session.updateRoster(msg.roster);
                }
                else {
                    showGuestLobby(msg);
                }
            }
            else if (msg.t === MSG.START) {
                if (ctx.myId == null)
                    return;
                endSession();
                showScreen(null);
                session = new GuestSession({ mode: msg.mode, mapId: msg.mapId, roster: msg.roster, myId: ctx.myId });
            }
            else if (msg.t === MSG.SNAP) {
                if (session instanceof GuestSession)
                    session.onSnapshot(msg);
            }
            else if (msg.t === MSG.END) {
                endSession();
                startAttract();
                showResults(msg.standings, msg.winnerId, false);
            }
        },
    });
}
function showGuestLobby(lobbyMsg) {
    if (!guest)
        return;
    $('lobby-code').textContent = guest.code;
    $('qr-img').src = qrDataURL(joinURL(guest.code));
    $('lobby-status').textContent = 'connected — waiting in the hangar';
    $('host-controls').classList.add('hidden');
    $('guest-wait').classList.remove('hidden');
    $('lobby-roster').innerHTML = lobbyMsg.roster.map((p) => `
    <div class="roster-row">
      <div class="chip" style="color:${colorHex(p.colorIdx)};background:${colorHex(p.colorIdx)}"></div>
      <div>${p.name}</div>
      <div class="who">${p.isBot ? 'bot' : p.id === 'host' ? 'host' : p.id === guest?.myId ? 'you' : 'pilot'}</div>
    </div>`).join('');
    showScreen('lobby');
}
// ---------------------------------------------------------------- playground
function startPlayground() {
    endSession();
    setAccent(0);
    showScreen(null);
    $('playground-bar').classList.remove('hidden');
    startPlaygroundOn(randomMap().id, 2);
}
function startPlaygroundOn(mapId, botCount) {
    endSession();
    const players = [{ id: 'me', name: myName, colorIdx: 0, isBot: false }];
    for (let i = 0; i < botCount; i++) {
        players.push({
            id: `bot-${i}`,
            name: randomCallsign(players.map((p) => p.name)),
            colorIdx: (i + 1) % PLAYER_COLORS.length,
            isBot: true,
            botSkill: 0.55 + Math.random() * 0.35,
        });
    }
    session = new LocalSession({ mode: 'sandbox', mapId, myId: 'me', playground: true, players });
    centerMessage('PLAYGROUND', mapById(mapId).name, 1.5);
}
// ---------------------------------------------------------------- input & buttons
attachInput(canvas, (sx, sy) => {
    sound.unlock();
    session?.tap(sx, sy);
});
document.addEventListener('pointerdown', () => sound.unlock(), { capture: true });
$('btn-host').addEventListener('click', () => startHosting());
$('btn-join').addEventListener('click', () => {
    $('join-code').value = '';
    $('join-status').textContent = '';
    showScreen('join');
    $('join-code').focus();
});
$('btn-playground').addEventListener('click', () => startPlayground());
$('btn-connect').addEventListener('click', () => {
    const code = $('join-code').value.trim().toUpperCase();
    if (code.length >= 4)
        connectAsGuest(code);
});
$('join-code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter')
        $('btn-connect').click();
});
$('btn-join-back').addEventListener('click', () => {
    guest?.conn?.destroy();
    guest = null;
    showScreen('menu');
});
$('btn-leave-lobby').addEventListener('click', () => {
    leaveEverything();
});
const nameInput = $('name-input');
nameInput.value = myName;
nameInput.addEventListener('change', () => {
    const name = nameInput.value.trim().toUpperCase().slice(0, 10) || myName;
    myName = name;
    nameInput.value = name;
    localStorage.setItem('bumper-tanks-name', name);
    if (host) {
        const me = host.roster.find((p) => p.id === 'host');
        if (me)
            me.name = name;
        broadcastLobby();
    }
    else if (guest?.conn) {
        guest.conn.send({ t: MSG.NAME, name });
    }
});
// Mode & map segments (host lobby).
$('mode-seg').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn || !host)
        return;
    host.mode = btn.dataset.mode;
    for (const b of $('mode-seg').children)
        b.classList.toggle('on', b === btn);
    broadcastLobby();
});
for (const map of MAPS) {
    const b = document.createElement('button');
    b.className = 'btn small';
    b.dataset.map = map.id;
    b.textContent = map.name.toLowerCase();
    $('map-seg').appendChild(b);
}
$('map-seg').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-map]');
    if (!btn || !host)
        return;
    host.mapChoice = btn.dataset.map;
    for (const b of $('map-seg').children)
        b.classList.toggle('on', b === btn);
});
$('btn-add-bot').addEventListener('click', () => {
    if (!host || host.roster.length >= MAX_PLAYERS)
        return;
    const used = new Set(host.roster.map((p) => p.colorIdx));
    let idx = 0;
    while (used.has(idx))
        idx++;
    host.roster.push({
        id: `bot-${idx}-${Math.floor(Math.random() * 1e6)}`,
        name: randomCallsign(host.roster.map((p) => p.name)),
        colorIdx: idx,
        isBot: true,
        botSkill: 0.55 + Math.random() * 0.35,
    });
    broadcastLobby();
});
$('btn-start').addEventListener('click', () => hostLaunch());
// Results.
$('btn-rematch').addEventListener('click', () => {
    if (host)
        hostLaunch();
});
$('btn-results-leave').addEventListener('click', () => {
    if (host) {
        // Host returns everyone to the lobby.
        broadcastLobby();
        startAttract();
        showScreen('lobby');
    }
    else {
        leaveEverything();
    }
});
// In-game corners.
$('btn-quit').addEventListener('click', () => leaveEverything());
const muteBtn = $('btn-mute');
muteBtn.textContent = sound.muted ? 'sound off' : 'sound on';
muteBtn.addEventListener('click', () => {
    sound.setMuted(!sound.muted);
    muteBtn.textContent = sound.muted ? 'sound off' : 'sound on';
});
// Playground bar.
$('pg-add-bot').addEventListener('click', () => {
    if (session instanceof LocalSession)
        session.addBot();
});
$('pg-remove-bot').addEventListener('click', () => {
    if (session instanceof LocalSession)
        session.removeBot();
});
$('pg-map').addEventListener('click', () => {
    if (!(session instanceof LocalSession))
        return;
    const { mapId, tanks } = session.state;
    const cur = MAPS.findIndex((m) => m.id === mapId);
    const next = MAPS[(cur + 1) % MAPS.length];
    startPlaygroundOn(next.id, tanks.filter((t) => t.isBot).length);
});
$('pg-reset').addEventListener('click', () => {
    if (!(session instanceof LocalSession))
        return;
    const bots = session.state.tanks.filter((t) => t.isBot).length;
    startPlaygroundOn(session.state.mapId, bots);
});
function leaveEverything() {
    endSession();
    $('playground-bar').classList.add('hidden');
    host?.lobby?.destroy();
    host = null;
    guest?.conn?.destroy();
    guest = null;
    setAccent(0);
    startAttract();
    showScreen('menu');
}
// ---------------------------------------------------------------- boot
function boot() {
    const hash = location.hash;
    const joinMatch = hash.match(/#join=([A-Za-z0-9]+)/);
    startAttract();
    if (joinMatch) {
        try {
            history.replaceState(null, '', location.pathname + location.search);
        }
        catch { /* file:// */ }
        showScreen('join');
        $('join-code').value = joinMatch[1].toUpperCase();
        connectAsGuest(joinMatch[1].toUpperCase());
    }
    else if (hash === '#playground') {
        startPlayground();
    }
    else {
        showScreen('menu');
    }
}
// Debug/validation hooks (used by agent-browser checks).
window.__game = {
    get session() { return session; },
    get state() { return session?.state; },
    get host() { return host; },
    get guest() { return guest; },
    tapWorld(x, y) {
        if (session instanceof LocalSession && session.myId != null)
            applyTap(session.state, session.myId, x, y);
        else if (session instanceof GuestSession)
            guest?.conn?.send({ t: MSG.TAP, x, y });
    },
    startPlayground,
    leaveEverything,
};
boot();
