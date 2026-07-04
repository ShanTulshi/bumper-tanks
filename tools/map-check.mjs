// Map sanity checker: flood-fills each map's walkable surface and reports
// connected components, plus whether every spawn sits on the main component.
// Usage: npm run build && node tools/map-check.mjs
import { MAPS } from '../js/game/maps.js';
import { supported } from '../js/engine/physics.js';

const STEP = 8; // wu grid resolution

for (const map of MAPS) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const f of map.floors) {
    minX = Math.min(minX, f.cx - f.w / 2);
    maxX = Math.max(maxX, f.cx + f.w / 2);
    minY = Math.min(minY, f.cy - f.h / 2);
    maxY = Math.max(maxY, f.cy + f.h / 2);
  }
  const cols = Math.ceil((maxX - minX) / STEP) + 1;
  const rows = Math.ceil((maxY - minY) / STEP) + 1;
  const cell = (cx, cy) => cy * cols + cx;
  const walk = new Uint8Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      if (supported(map, minX + cx * STEP, minY + cy * STEP)) walk[cell(cx, cy)] = 1;
    }
  }
  // Flood fill (4-connectivity).
  const comp = new Int32Array(cols * rows).fill(-1);
  const sizes = [];
  for (let start = 0; start < walk.length; start++) {
    if (!walk[start] || comp[start] !== -1) continue;
    const id = sizes.length;
    let size = 0;
    const stack = [start];
    comp[start] = id;
    while (stack.length) {
      const c = stack.pop();
      size++;
      const cx = c % cols;
      const cy = Math.floor(c / cols);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const n = cell(nx, ny);
        if (walk[n] && comp[n] === -1) {
          comp[n] = id;
          stack.push(n);
        }
      }
    }
    sizes.push(size);
  }
  const main = sizes.indexOf(Math.max(...sizes));
  const badSpawns = map.spawns.filter(([sx, sy]) => {
    const cx = Math.round((sx - minX) / STEP);
    const cy = Math.round((sy - minY) / STEP);
    return comp[cell(cx, cy)] !== main;
  });
  const ok = sizes.length === 1 && badSpawns.length === 0;
  console.log(`${map.id.padEnd(8)} components: ${sizes.length} ${JSON.stringify(sizes)}`
    + `${badSpawns.length ? ` OFF-MAIN SPAWNS: ${JSON.stringify(badSpawns)}` : ''}`
    + `  ${ok ? 'OK' : '*** NOT CONNECTED ***'}`);
}
