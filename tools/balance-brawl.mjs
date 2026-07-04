// Headless bot brawl: 4 bots, all maps, accelerated — the balance-tuning loop.
// Usage: node tools/balance-brawl.mjs
import { createMatch, step } from '../js/game/sim.js';
import { stepBots } from '../js/game/bots.js';
import { MAPS } from '../js/game/maps.js';
import { SIM_DT } from '../js/game/constants.js';

const MINUTES = 5;
for (const map of MAPS) {
  const players = [0, 1, 2, 3].map((i) => ({
    id: `bot-${i}`, name: `B${i}`, colorIdx: i, isBot: true, botSkill: 0.5 + i * 0.13,
  }));
  const state = createMatch({ mode: 'sandbox', mapId: map.id, players });
  let kos = 0; let credited = 0;
  const steps = Math.round((MINUTES * 60) / SIM_DT);
  for (let i = 0; i < steps; i++) {
    stepBots(state, SIM_DT);
    const events = step(state, SIM_DT);
    for (const ev of events) {
      if (ev.type === 'ko') { kos++; if (ev.killerId != null) credited++; }
    }
  }
  const per = state.tanks.map((t) => `${t.name}(skill ${t.botSkill.toFixed(2)}): ${t.score} KO / ${t.deaths} deaths`).join('  ');
  console.log(`${map.id.padEnd(8)} ${MINUTES}min: ${kos} KOs (${credited} credited, ${kos - credited} slips) | ${per}`);
}
