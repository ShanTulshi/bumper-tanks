// VOID SUMO renderer: neon holo-arenas floating in an indigo void.
// Draws any RenderState (host sim, solo sim, or a guest's ghost state).
import { PLAYER_COLORS, FALL_TIME, TANK_RADIUS } from '../game/constants.js';
const VOID_TOP = '#0a0d1c';
const VOID_BOTTOM = '#060811';
const GLASS = '#131734';
const RIM = '#3d4a8f';
const HOLE_RIM = '#6a3db0';
const INK = '#eaf2ff';
function colorOf(idx) {
    return PLAYER_COLORS[idx % PLAYER_COLORS.length].hex;
}
function withAlpha(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
}
function roundedRectPath(path, rect) {
    path.roundRect(rect.cx - rect.w / 2, rect.cy - rect.h / 2, rect.w, rect.h, rect.r);
}
export class Renderer {
    canvas;
    ctx;
    dpr = 1;
    vw = 0;
    vh = 0;
    bgGradient = null;
    vignette = null;
    mapCache = new WeakMap();
    stars = [];
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        for (let i = 0; i < 130; i++) {
            this.stars.push({
                sx: Math.random() * 3000,
                sy: Math.random() * 3000,
                size: 0.5 + Math.random() * 1.4,
                layer: i % 2 === 0 ? 0.18 : 0.38,
                phase: Math.random() * Math.PI * 2,
                tw: 0.5 + Math.random() * 2,
            });
        }
    }
    resize(vw, vh, dpr) {
        this.vw = vw;
        this.vh = vh;
        this.dpr = dpr;
        this.canvas.width = Math.round(vw * dpr);
        this.canvas.height = Math.round(vh * dpr);
        const ctx = this.ctx;
        this.bgGradient = ctx.createLinearGradient(0, 0, 0, vh);
        this.bgGradient.addColorStop(0, VOID_TOP);
        this.bgGradient.addColorStop(1, VOID_BOTTOM);
        this.vignette = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
        this.vignette.addColorStop(0, 'rgba(4,6,14,0)');
        this.vignette.addColorStop(1, 'rgba(4,6,14,0.6)');
    }
    mapPaths(map) {
        let cached = this.mapCache.get(map);
        if (!cached) {
            const floors = new Path2D();
            for (const f of map.floors)
                roundedRectPath(floors, f);
            const holes = new Path2D();
            for (const h of map.holes)
                roundedRectPath(holes, h);
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            for (const f of map.floors) {
                minX = Math.min(minX, f.cx - f.w / 2);
                maxX = Math.max(maxX, f.cx + f.w / 2);
                minY = Math.min(minY, f.cy - f.h / 2);
                maxY = Math.max(maxY, f.cy + f.h / 2);
            }
            cached = { floors, holes, bounds: { minX, minY, maxX, maxY } };
            this.mapCache.set(map, cached);
        }
        return cached;
    }
    render({ state, camera, particles, myId, alpha = 1, now = 0 }) {
        const ctx = this.ctx;
        const { vw, vh } = this;
        if (!this.bgGradient || !this.vignette)
            return;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        // Void + stars (screen space, parallax against camera)
        ctx.fillStyle = this.bgGradient;
        ctx.fillRect(0, 0, vw, vh);
        ctx.save();
        for (const s of this.stars) {
            const f = s.layer * camera.ppu;
            const x = (((s.sx - camera.x * f) % (vw + 60)) + vw + 60) % (vw + 60) - 30;
            const y = (((s.sy - camera.y * f) % (vh + 60)) + vh + 60) % (vh + 60) - 30;
            const a = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(now * s.tw + s.phase));
            ctx.fillStyle = `rgba(200,215,255,${a})`;
            ctx.fillRect(x, y, s.size, s.size);
        }
        ctx.restore();
        if (!state) {
            ctx.fillStyle = this.vignette;
            ctx.fillRect(0, 0, vw, vh);
            return;
        }
        const { map } = state;
        const paths = this.mapPaths(map);
        // Enter world space.
        ctx.save();
        ctx.translate(vw / 2 + camera.shakeX, vh / 2 + camera.shakeY);
        ctx.scale(camera.ppu, camera.ppu);
        ctx.translate(-camera.x, -camera.y);
        const px = 1 / camera.ppu; // one screen pixel, in world units
        // Floor: dark glass + telemetry grid + neon rim.
        ctx.fillStyle = GLASS;
        ctx.fill(paths.floors);
        ctx.save();
        ctx.clip(paths.floors);
        ctx.strokeStyle = 'rgba(160,180,255,0.05)';
        ctx.lineWidth = px;
        const { bounds } = paths;
        ctx.beginPath();
        for (let gx = Math.floor(bounds.minX / 80) * 80; gx <= bounds.maxX; gx += 80) {
            ctx.moveTo(gx, bounds.minY);
            ctx.lineTo(gx, bounds.maxY);
        }
        for (let gy = Math.floor(bounds.minY / 80) * 80; gy <= bounds.maxY; gy += 80) {
            ctx.moveTo(bounds.minX, gy);
            ctx.lineTo(bounds.maxX, gy);
        }
        ctx.stroke();
        ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = withAlpha(RIM, 0.35);
        ctx.lineWidth = 7 * px;
        ctx.stroke(paths.floors);
        ctx.restore();
        ctx.strokeStyle = RIM;
        ctx.lineWidth = 2 * px;
        ctx.stroke(paths.floors);
        // Holes: punched-out void with a hot rim.
        if (map.holes.length) {
            ctx.fillStyle = VOID_BOTTOM;
            ctx.fill(paths.holes);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = withAlpha(HOLE_RIM, 0.4);
            ctx.lineWidth = 7 * px;
            ctx.stroke(paths.holes);
            ctx.restore();
            ctx.strokeStyle = HOLE_RIM;
            ctx.lineWidth = 2 * px;
            ctx.stroke(paths.holes);
        }
        // Walls: raised glass blocks.
        for (const w of map.walls) {
            const path = new Path2D();
            roundedRectPath(path, w);
            ctx.fillStyle = '#1b2148';
            ctx.fill(path);
            ctx.strokeStyle = withAlpha('#7c89d8', 0.9);
            ctx.lineWidth = 2 * px;
            ctx.stroke(path);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = withAlpha('#7c89d8', 0.25);
            ctx.lineWidth = 6 * px;
            ctx.stroke(path);
            ctx.restore();
        }
        // Shells: neon tracer + hot head.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const shell of state.shells) {
            const sx = shell.px + (shell.x - shell.px) * alpha;
            const sy = shell.py + (shell.y - shell.py) * alpha;
            const speed = Math.hypot(shell.vx, shell.vy) || 1;
            const tx = sx - (shell.vx / speed) * 26;
            const ty = sy - (shell.vy / speed) * 26;
            const owner = state.tanks.find((t) => t.id === shell.owner);
            const c = owner ? colorOf(owner.colorIdx) : INK;
            ctx.strokeStyle = withAlpha(c, 0.55);
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(sx, sy);
            ctx.stroke();
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(sx, sy, shell.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.beginPath();
            ctx.arc(sx, sy, shell.radius * 0.45, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        // Tanks.
        for (const tank of state.tanks) {
            if (tank.state === 'dead' || tank.state === 'ghost')
                continue;
            this.drawTank(ctx, tank, alpha, now, tank.id === myId, px);
        }
        // Particles (world space, additive).
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const p of particles.sparks) {
            const a = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = withAlpha(p.color, a * 0.9);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        for (const r of particles.rings) {
            const a = Math.max(0, r.life / r.maxLife);
            ctx.strokeStyle = withAlpha(r.color, a * 0.8);
            ctx.lineWidth = Math.max(px, r.width * a);
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
        ctx.restore(); // leave world space
        // Name labels (screen space so they stay crisp).
        ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        for (const tank of state.tanks) {
            if (tank.state !== 'active')
                continue;
            const wx = tank.px + (tank.x - tank.px) * alpha;
            const wy = tank.py + (tank.y - tank.py) * alpha;
            const [sx, sy] = camera.worldToScreen(wx, wy);
            ctx.fillStyle = withAlpha(colorOf(tank.colorIdx), tank.id === myId ? 1 : 0.75);
            ctx.fillText(tank.name, sx, sy - TANK_RADIUS * camera.ppu - 10);
        }
        ctx.fillStyle = this.vignette;
        ctx.fillRect(0, 0, vw, vh);
    }
    drawTank(ctx, tank, alpha, now, isMe, px) {
        const x = tank.px + (tank.x - tank.px) * alpha;
        const y = tank.py + (tank.y - tank.py) * alpha;
        let da = tank.angle - tank.pangle;
        while (da > Math.PI)
            da -= Math.PI * 2;
        while (da < -Math.PI)
            da += Math.PI * 2;
        const angle = tank.pangle + da * alpha;
        const c = colorOf(tank.colorIdx);
        const r = tank.radius;
        let scale = 1;
        let fade = 1;
        if (tank.state === 'falling') {
            const t = Math.min(1, tank.stateT / FALL_TIME);
            scale = 1 - t * t * 0.85;
            fade = 1 - t * 0.85;
            // Streak into the void.
            const speed = Math.hypot(tank.vx, tank.vy) || 1;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = withAlpha(c, 0.5 * t);
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(x - (tank.vx / speed) * 60 * t, y - (tank.vy / speed) * 60 * t);
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.restore();
        }
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.scale(scale, scale);
        ctx.globalAlpha = fade;
        // Hex pod body.
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const vx = Math.cos(a) * r;
            const vy = Math.sin(a) * r;
            if (i === 0)
                ctx.moveTo(vx, vy);
            else
                ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        ctx.lineJoin = 'round';
        ctx.fillStyle = GLASS;
        ctx.fill();
        ctx.fillStyle = withAlpha(c, 0.16);
        ctx.fill();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = withAlpha(c, 0.35);
        ctx.lineWidth = 7 * px;
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = c;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // Barrel.
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.roundRect(r * 0.25, -4.5, r + 12 - r * 0.25, 9, 4);
        ctx.fill();
        // Core.
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // You-marker + spawn shield (unrotated).
        if (isMe && tank.state === 'active') {
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1.5 * px;
            ctx.beginPath();
            ctx.arc(x, y, r + 8, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (tank.shield > 0 && tank.state === 'active') {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(now * 1.5);
            ctx.strokeStyle = withAlpha(c, 0.5 + 0.3 * Math.sin(now * 9));
            ctx.lineWidth = 2.5 * px;
            ctx.setLineDash([10, 8]);
            ctx.beginPath();
            ctx.arc(0, 0, r + 13, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
}
