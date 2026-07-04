// All gameplay tuning lives here. Units are world units (wu); tanks are ~44 wu wide.

export const TANK_RADIUS = 24;
export const SHELL_RADIUS = 7;

// Movement / feel
export const DAMPING = 1.55; // v *= exp(-DAMPING * dt); icy — momentum carries
export const ROT_SPEED = 16; // rad/s (~900 deg/s)
export const FIRE_COOLDOWN = 0.45; // s
export const RECOIL_IMPULSE = 300; // wu/s added opposite shot
export const SHELL_SPEED = 950; // wu/s
export const SHELL_RANGE = 640; // wu before self-detonation
export const HIT_IMPULSE = 640; // wu/s on direct hit, along shell travel
export const AOE_RADIUS = 150; // wu
export const AOE_IMPULSE = 340; // wu/s at epicenter, linear falloff
export const SELF_HIT_GRACE = 0.12; // s a shell can't hit its owner
export const TANK_RESTITUTION = 0.85; // tank-tank bounce
export const WALL_RESTITUTION = 0.6;
export const BUMP_MIN_SPEED = 60; // relative speed for a bump to count as a "hit"

// Death / respawn
export const FALL_TIME = 0.7; // s of falling animation before death
export const RESPAWN_TIME = 2.5; // s
export const SPAWN_SHIELD = 1.5; // s of impulse immunity after spawn
export const KILL_CREDIT_WINDOW = 5; // s since last hit to credit a KO

// Modes
export const RUMBLE_DURATION = 120; // s
export const LTS_ROUND_WINS = 3; // first to N round wins
export const COUNTDOWN = 3; // s before play starts
export const ROUND_END_PAUSE = 2.5; // s banner between rounds
export const MATCH_END_PAUSE = 5; // s on results before lobby

// Camera: every device sees the same world area (wu^2)
export const VISIBLE_WORLD_AREA = 1_150_000;
export const MIN_PPU = 0.25;
export const MAX_PPU = 3;

// Networking
export const PROTOCOL_VERSION = 1;
export const SNAPSHOT_HZ = 15;
export const INTERP_DELAY = 0.12; // s guests render behind latest snapshot
export const MAX_PLAYERS = 8;
export const PEER_PREFIX = 'bumper-tanks-void-sumo-';

// Simulation
export const SIM_DT = 1 / 60;

export const PLAYER_COLORS = [
  { name: 'CYAN', hex: '#26E6FF' },
  { name: 'MAGENTA', hex: '#FF3DDB' },
  { name: 'LIME', hex: '#B8FF3C' },
  { name: 'AMBER', hex: '#FFB224' },
  { name: 'VIOLET', hex: '#A16BFF' },
  { name: 'CORAL', hex: '#FF5C49' },
  { name: 'SPRING', hex: '#2BFFA3' },
  { name: 'ICE', hex: '#8AB6FF' },
];

export const CALLSIGNS = [
  'VECTOR', 'MANGO', 'RIPTIDE', 'JUNIPER', 'SABLE', 'NOVA', 'PICKLE', 'ORBIT',
  'WIDGET', 'COMET', 'BANDIT', 'TANGO', 'FRESNO', 'QUARK', 'DUSTER', 'PONCHO',
  'ZIGZAG', 'MOXIE', 'RUCKUS', 'FABLE', 'TURBO', 'NIMBUS', 'JACKAL', 'SPROCKET',
];

export function randomCallsign() {
  return CALLSIGNS[Math.floor(Math.random() * CALLSIGNS.length)];
}
