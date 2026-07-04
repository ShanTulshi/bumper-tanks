// Player-centered camera. Zoom is derived from viewport area so every device
// sees the same amount of world (spec requirement).
import { VISIBLE_WORLD_AREA, MIN_PPU, MAX_PPU } from '../game/constants.js';
export class Camera {
    x = 0;
    y = 0;
    ppu = 1; // pixels per world unit
    vw = 1;
    vh = 1;
    shakeMag = 0;
    shakeX = 0;
    shakeY = 0;
    resize(vw, vh) {
        this.vw = vw;
        this.vh = vh;
        const ppu = Math.sqrt((vw * vh) / VISIBLE_WORLD_AREA);
        this.ppu = Math.max(MIN_PPU, Math.min(MAX_PPU, ppu));
    }
    snapTo(x, y) {
        this.x = x;
        this.y = y;
    }
    follow(x, y, dt) {
        const k = Math.min(1, dt * 10);
        this.x += (x - this.x) * k;
        this.y += (y - this.y) * k;
    }
    addShake(mag) {
        this.shakeMag = Math.min(18, this.shakeMag + mag);
    }
    update(dt) {
        this.shakeMag *= Math.exp(-7 * dt);
        if (this.shakeMag < 0.1)
            this.shakeMag = 0;
        this.shakeX = (Math.random() * 2 - 1) * this.shakeMag;
        this.shakeY = (Math.random() * 2 - 1) * this.shakeMag;
    }
    worldToScreen(wx, wy) {
        return [
            (wx - this.x) * this.ppu + this.vw / 2 + this.shakeX,
            (wy - this.y) * this.ppu + this.vh / 2 + this.shakeY,
        ];
    }
    screenToWorld(sx, sy) {
        return [
            (sx - this.vw / 2 - this.shakeX) / this.ppu + this.x,
            (sy - this.vh / 2 - this.shakeY) / this.ppu + this.y,
        ];
    }
}
