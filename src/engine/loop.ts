// Fixed-timestep sim loop with interpolated rendering. Falls back to a coarse
// interval while the tab is hidden so a host keeps simulating (throttled).

import { SIM_DT } from '../game/constants.js';

export interface GameLoop {
  start(): void;
  stop(): void;
  destroy(): void;
}

export function createLoop(stepFn: (dt: number) => void, renderFn: (alpha: number, dt: number) => void): GameLoop {
  let running = false;
  let last = 0;
  let acc = 0;
  let rafId = 0;
  let hiddenTimer: ReturnType<typeof setInterval> | undefined;

  function frame(now: number): void {
    if (!running) return;
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= SIM_DT) {
      stepFn(SIM_DT);
      acc -= SIM_DT;
    }
    renderFn(acc / SIM_DT, dt);
    rafId = requestAnimationFrame(frame);
  }

  function onVisibility(): void {
    if (!running) return;
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      last = performance.now();
      hiddenTimer = setInterval(() => {
        const now = performance.now();
        const dt = Math.min(1.5, (now - last) / 1000);
        last = now;
        acc += dt;
        while (acc >= SIM_DT) {
          stepFn(SIM_DT);
          acc -= SIM_DT;
        }
      }, 100);
    } else {
      clearInterval(hiddenTimer);
      last = performance.now();
      acc = 0;
      rafId = requestAnimationFrame(frame);
    }
  }

  document.addEventListener('visibilitychange', onVisibility);

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      acc = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      clearInterval(hiddenTimer);
    },
    destroy() {
      this.stop();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
