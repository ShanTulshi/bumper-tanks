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
13. **The main menu is a live bot match** (attract mode) — the game sells itself
    behind the panels, and the sim gets exercised constantly. *Fun:* you see the
    game before you play it.
14. **Host can add bots in the lobby** — two friends can still have a 4-tank brawl.
15. **Late joiners drop straight into a running match** (as a ghost until next round
    in Last-Standing). *Fun:* nobody waits at a locked door.
16. **UI chrome is dyed in your player neon**, and the results screen re-dyes itself
    in the winner's color — a little coronation.
17. **Self-knockoffs are possible** (your own AoE can push you) and credited as
    "slipped into the void" — no kill for anyone. Blast-jumping is a legit skill.
18. **Audio is synthesized WebAudio** (no assets): thump on fire, noise-sweep
    explosions, arpeggio win sting. Mute persists in localStorage.

### Found in browser validation (agent-browser)

19. **Verified kill credit works** with a controlled hit → forced fall → score+1.
    The earlier "all scores 0" was not a credit bug — it was bots flinging
    *themselves* into the void (40 self-falls in one session).
20. **Bots are now recoil-aware**: before an attack shot they project the recoil
    drift (at 0.35 s and at rest, v/damping) and skip shots that would carry them
    off; instead they take a repositioning shot. Survival reflex (brake/step-in)
    now runs every tick instead of on the think timer. *Fun:* bots that respect
    the void are worth outplaying; scores now come from real knockouts.
21. **Death camera drifts back to the arena center** instead of staring at the
    empty void where you fell.
22. **Built a headless balance harness** (`tools/balance-brawl.mjs`) — the sim is
    pure ES modules, so Node runs 4-bot × 5-minute brawls on every map in ~2s.
    This became the tuning loop.
23. **Knockback economy retuned for liveliness.** The first playable was a total
    stalemate (0 KOs in 5 min on 3 of 4 maps). Now: HIT 460→640, AoE 270→340,
    damping 1.9→1.55 (icier), Rink shrunk 1340→1240. Result: 43–66 KOs/5min on
    Rink/Donut/Quad, ~100 % credited, and skill wins (0.89-skill bot goes 27/11
    while 0.50 goes 8/21). Skywalk is slower (9) by nature — it's the tactical map.
24. **Bots path with recoil, greedily.** Out-of-range bots sample 12 shot
    directions and take the recoil-safe one whose drift lands nearest the enemy —
    emergent bridge-crossing on island maps with zero pathfinding code.
25. **Bots got human weaknesses on purpose**: 0.1–0.4 s reaction delay and flinch
    error on the survival reflex. Perfect-reflex bots were literally unkillable
    (0 deaths in 5 min); now a well-timed edge shot beats their brake.
26. **Verified end-to-end multiplayer with two real browsers** (agent-browser
    sessions): QR/code join, launch, guest tap → host sim → snapshot → both HUDs
    agree on scores, match end, winner screen, rematch. Also verified: equal-area
    zoom on a 390×844 phone viewport is exactly the 1.15 M wu² constant.
27. **Callsigns are unique per session/lobby** (two JUNIPERs showed up in a
    playtest and made the killfeed ambiguous).
