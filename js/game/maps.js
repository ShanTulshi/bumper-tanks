// Arena definitions. All geometry is rounded rects: {cx, cy, w, h, r}.
// floors = walkable union, holes = subtracted dropoffs, walls = solid cover.

function rect(cx, cy, w, h, r) {
  return { cx, cy, w, h, r };
}

export const MAPS = [
  {
    id: 'rink',
    name: 'THE RINK',
    tagline: 'no cover · no excuses',
    floors: [rect(0, 0, 1340, 1340, 320)],
    holes: [],
    walls: [],
    spawns: [
      [-420, -420], [420, -420], [-420, 420], [420, 420],
      [0, -520], [0, 520], [-520, 0], [520, 0],
    ],
  },
  {
    id: 'donut',
    name: 'DONUT',
    tagline: 'mind the hole',
    floors: [rect(0, 0, 1520, 1520, 600)],
    holes: [rect(0, 0, 480, 480, 240)],
    walls: [],
    spawns: [
      [-540, -540], [540, -540], [-540, 540], [540, 540],
      [0, -600], [0, 600], [-600, 0], [600, 0],
    ],
  },
  {
    id: 'quad',
    name: 'QUAD',
    tagline: 'four pods · one plaza',
    floors: [
      rect(0, 0, 640, 640, 100), // plaza
      rect(0, -700, 440, 440, 120), // N pod
      rect(0, 700, 440, 440, 120), // S pod
      rect(-700, 0, 440, 440, 120), // W pod
      rect(700, 0, 440, 440, 120), // E pod
      rect(0, -420, 210, 340, 60), // N bridge
      rect(0, 420, 210, 340, 60), // S bridge
      rect(-420, 0, 340, 210, 60), // W bridge
      rect(420, 0, 340, 210, 60), // E bridge
    ],
    holes: [],
    walls: [
      rect(-190, -190, 100, 100, 26),
      rect(190, -190, 100, 100, 26),
      rect(-190, 190, 100, 100, 26),
      rect(190, 190, 100, 100, 26),
    ],
    spawns: [
      [0, -700], [0, 700], [-700, 0], [700, 0],
      [-120, -700], [120, 700], [-700, 120], [700, -120],
    ],
  },
  {
    id: 'skywalk',
    name: 'SKYWALK',
    tagline: 'hold the bridge',
    floors: [
      rect(-640, 0, 660, 960, 140), // west platform
      rect(640, 0, 660, 960, 140), // east platform
      rect(0, 0, 720, 190, 70), // the bridge
      rect(0, -560, 340, 300, 90), // north pod (jump-across bait)
      rect(0, 560, 340, 300, 90), // south pod
    ],
    holes: [],
    walls: [
      rect(-360, -260, 90, 260, 30),
      rect(-360, 260, 90, 260, 30),
      rect(360, -260, 90, 260, 30),
      rect(360, 260, 90, 260, 30),
    ],
    spawns: [
      [-700, -300], [-700, 300], [700, -300], [700, 300],
      [-560, 0], [560, 0], [0, -560], [0, 560],
    ],
  },
];

export function mapById(id) {
  return MAPS.find((m) => m.id === id) || MAPS[0];
}

export function randomMap(rng = Math.random) {
  return MAPS[Math.floor(rng() * MAPS.length)];
}
