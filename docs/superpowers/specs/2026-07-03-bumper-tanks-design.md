# Bumper Tanks — Design

Date: 2026-07-03
Source spec: `spec.md`
Status: approved-in-absentia (user delegated design decisions, optimizing for fun — see `DECISIONS.md`)

## Vision

Sumo with guns, played with one finger. Every tap does three things at once: aims your
tank, fires a shell, and — via recoil — moves you. There is no health bar; the only way
to die is to leave the arena. Arenas float in a void with no borders. Shots shove
opponents toward the edge; recoil shoves you away from where you tapped. Movement,
offense, and risk are the same verb.

## Core mechanic

- **Tap/click anywhere**: tank rotates its barrel toward the tap point (fast, ~900°/s),
  and fires the instant it is aligned. One queued shot; taps during rotation retarget.
- **Recoil**: firing applies an impulse to the shooter, opposite the shot direction.
  Recoil is the *only* locomotion. To move somewhere, shoot away from it.
- **Direct hit**: shell hits a tank → large impulse along the shell's travel direction,
  shell dies with a burst.
- **Indirect hit**: shell hits a wall or exceeds max range → explodes; area-of-effect
  impulse with linear falloff (roughly half a direct hit at the epicenter).
- **Falling off**: a tank whose center leaves the floor union falls into the void
  (shrink + streak animation), counts one death, credits one kill to the last tank that
  applied hit force to it within the last 5 s. Respawn after 2.5 s with 1.5 s of spawn
  protection (no incoming impulses, visible shield ring).
- **Bumping**: tank–tank collisions are elastic and bouncy (bumper cars). Body contact
  alone can push someone off; the kill-credit window applies to bumps too.

## Physics (custom, fixed 60 Hz timestep)

Circle bodies only. Tanks: r≈22 world units, linear damping so momentum carries but
decays (ice-with-grip feel). Shells: r≈6, fast (~9× tank recoil speed), no damping,
max range ~½ arena width. Walls: axis-aligned rounded rects; tanks bounce off
(restitution ~0.6), shells explode on contact. Floor: union of rounded rects per map;
support test = tank center inside union. Rendering interpolates between physics steps.

## Camera & viewport

Player's tank is always screen-center; the world moves. Zoom is computed from viewport
area: `pixelsPerUnit = sqrt(vw*vh / VISIBLE_WORLD_AREA)` so every device sees the same
amount of map. devicePixelRatio-aware canvas. Subtle screen shake on explosions and
direct hits (capped).

## Game modes

1. **Rumble** (score attack): 120 s timer, free-for-all, +1 per knockout. Deaths shown
   but not penalized (dying already costs you 2.5 s of scoring time). Most KOs wins.
2. **Last Tank Standing**: round-based elimination; fallen tanks spectate the round.
   First to 3 round wins takes the match.
3. **Playground**: solo sandbox — spawn/despawn bots, cycle maps, reset. For testing
   and practice. Reachable from the main menu.

## Maps (random selection per match)

All built from floor rects + optional wall rects, roughly equal playable area:

1. **The Rink** — one big rounded square. Pure sumo, no cover.
2. **Donut** — ring floor with a deadly hole in the middle.
3. **Quad** — four island pods bridged to a central plaza; four pillar walls near the
   middle give cover and ricochet-free AoE play.
4. **Skywalk** — two large platforms joined by a narrow bridge, plus two side pods;
   long sightlines, terrifying bridge fights.

## Multiplayer (host-authoritative P2P)

- **Transport**: WebRTC data channels via PeerJS (vendored, MIT). PeerJS's public
  cloud broker performs signaling only; all game traffic is peer-to-peer and the app
  itself stays 100 % static/client-side. Lobby ID is random (e.g. `TANK-4F7Q3`);
  host renders a QR code (vendored `qrcode-generator`, MIT) encoding
  `<page-url>#join=<lobbyId>`. Opening that URL auto-joins.
- **Topology**: star — every guest connects to the host. Host runs the one true
  simulation. Up to 8 players.
- **Guest → host**: `{tap: {x, y}}` in world coordinates (guest converts using its own
  camera), plus name/color on join.
- **Host → guests**: lobby state, match start/end, and ~20 Hz snapshots
  (tank pos/vel/angle/state, shells, scores, events like kills/explosions for FX).
  Guests interpolate between snapshots; the local turret angle is predicted
  immediately on tap so aiming feels instant.
- **Degradation**: if the PeerJS broker is unreachable, solo modes (Playground, vs
  bots) still work; lobby UI shows the error plainly.

## Aesthetic — "VOID SUMO"

Commit hard: neon holo-arenas floating in deep space. Near-black indigo void with a
sparse parallax starfield; arena floor is dark glass with glowing rim edges; each
player owns a saturated neon (cyan, magenta, lime, amber, violet, coral, blue, white).
Tanks are chunky rounded-hex pods with a stubby barrel, drawn in their neon with
additive glow. Muzzle flash, recoil streaks, shockwave rings, tanks falling shrink
into the void with a light streak. UI is uppercase, wide-tracked, holo-panel cards.
Everything canvas + system fonts; zero external assets at runtime.

## Structure (static site, no build step)

```
index.html            style.css
js/main.js            — screens, wiring, decision of host/guest/solo
js/engine/            — loop, physics, camera, renderer, particles, input
js/game/              — constants (all tuning in one file), sim, maps, modes, bots
js/net/               — lobby (PeerJS wrapper), protocol (msg schemas, snapshots)
vendor/               — peerjs.min.js, qrcode.js (vendored, pinned)
```

`js/game/sim.js` is pure & deterministic-ish (no DOM): `step(state, inputs, dt)` —
runnable by host, by solo mode, and by tests alike.

## Verification

Serve via `python3 -m http.server`; drive with `agent-browser`: screenshot each screen,
play the Playground (synthetic taps), spawn bots, verify falls/kills/scoring via
exposed debug state (`window.__game`), and a two-tab host+guest smoke test.
