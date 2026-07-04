// Lightweight particle system: additive sparks, shockwave rings, fall streaks.
// World-space positions; drawn by the renderer through the camera.

export class Particles {
  constructor() {
    this.sparks = [];
    this.rings = [];
  }

  burst(x, y, color, { count = 12, speed = 260, life = 0.5, size = 3, spread = Math.PI * 2, dir = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = dir + (Math.random() - 0.5) * spread;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.sparks.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * (0.6 + Math.random() * 0.4),
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color,
      });
    }
  }

  ring(x, y, color, { radius = 10, growth = 500, life = 0.45, width = 4 } = {}) {
    this.rings.push({ x, y, r: radius, growth, life, maxLife: life, width, color });
  }

  update(dt) {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      p.vx *= Math.exp(-3.5 * dt);
      p.vy *= Math.exp(-3.5 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      r.r += r.growth * dt;
    }
  }

  clear() {
    this.sparks.length = 0;
    this.rings.length = 0;
  }
}
