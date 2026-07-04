# Decision Log

Running log of design/implementation decisions made while you were away.
Criterion for every call: **optimize for fun**. Newest at the bottom.

## 2026-07-03

1. **Recoil is the only movement.** No virtual joystick. Tap = aim + fire + move
   (backwards). One verb for offense/locomotion/risk keeps it truly one-finger and
   makes every shot a positioning decision. *Fun:* mastery curve lives in one input.
2. **No health — knockoffs only.** Direct hits shove hard (~3 tank-widths of drift),
   wall/AoE explosions shove ~half that with falloff. Tank-tank bumps are elastic and
   bouncy (bumper cars). *Fun:* comebacks always possible, deaths always legible.
3. **Low-friction "ice with grip" movement.** Momentum carries; damping brings you to
   rest in ~1.5 s. *Fun:* drift near edges creates constant tension; recoil chains
   become a movement skill.
4. **Fire rate 0.45 s cooldown, shot queued while barrel rotates (~900°/s).** Taps
   retarget the queued shot. *Fun:* fast enough to dance, slow enough that whiffs hurt.
5. **Respawn 2.5 s + 1.5 s spawn shield; kill credit = last hitter within 5 s (bumps
   count).** *Fun:* no spawn-camping, no "stolen" deaths feeling arbitrary.
6. **Modes: Rumble (120 s, most KOs) and Last Tank Standing (first to 3 round wins),
   plus Playground sandbox with bots.** Deaths not point-penalized in Rumble — lost
   time is penalty enough. *Fun:* risk-taking stays rewarded.
7. **Four maps** (Rink, Donut, Quad, Skywalk) built from floor/wall rects, randomly
   selected per match. *Fun:* one pure-sumo map, one hole-hazard, one cover map, one
   chokepoint map — different fights, same verbs.
8. **Multiplayer: PeerJS (vendored) star topology, host-authoritative, QR join.**
   PeerJS public cloud does signaling only; no server of ours, app stays static.
   Guests send world-space taps; host simulates; 20 Hz snapshots + interpolation;
   local turret prediction so aiming feels instant. *Fun:* zero-friction "scan and
   you're in" onboarding.
9. **Aesthetic: "VOID SUMO"** — neon holo-arenas over a deep-space void, one saturated
   neon per player, additive glow, screen shake, shockwaves. Canvas + system fonts,
   no runtime assets. *Fun:* readability (you are always the centered bright thing)
   plus spectacle.
10. **Zoom from viewport area** (`sqrt(vw·vh / K)`): all devices see equal map area.
    Phones aren't disadvantaged vs desktops. *Fun:* fairness.
11. **Sim is a pure module** (`step(state, inputs, dt)`, no DOM) shared by host, solo,
    and bots — one source of truth for game feel, easy to test.
12. **Bots move by recoil too** (same rules as players): aim at nearest target with
    error + lead, and when near an edge they fire outward to knock themselves back to
    safety. *Fun:* honest opponents that die to their own greed, just like humans.
