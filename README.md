# BUMPER TANKS — VOID SUMO

Sumo with guns, played with one finger. Tap to aim and fire; the recoil is how
you move. No health bars — knock the other pods off the arena into the void.

## Play

It's a fully static site — serve the directory over HTTP and open it:

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

- **Host arena** — creates a lobby with a code + QR. Friends scan to join.
- **Join with code** — type the 5-letter arena code.
- **Playground** — solo sandbox with bots for practice and testing.

Multiplayer is peer-to-peer WebRTC (PeerJS). The PeerJS public cloud is used
for the handshake only; game traffic never touches a server, and the app has
no backend at all — it deploys anywhere static files go (GitHub Pages, etc.).

## Modes

- **Rumble** — 2 minutes, free-for-all, most knockouts wins.
- **Last tank standing** — round elimination, first to 3 round wins.

## Development

TypeScript sources in `src/`, compiled by `tsc` to plain browser ES modules in
`js/` (committed so branch-based GitHub Pages deploys work — build before you
push). No bundler; the browser loads the modules directly. Canvas 2D + WebAudio,
zero runtime dependencies beyond the two vendored libs.

```sh
npm install
npm run build     # or: npm run watch
npm run balance   # headless bot-brawl balance report (tools/balance-brawl.mjs)
npm run maps      # floor connectivity + spawn sanity check (tools/map-check.mjs)
```

All gameplay tuning lives in `src/game/constants.ts`; the simulation
(`src/game/sim.ts`) is a pure module used identically by solo play, the
multiplayer host, the menu's attract mode, and the headless balance harness.

Design docs: `docs/superpowers/specs/`. Decision log: `DECISIONS.md`.
Deploying: `DEPLOY.md`.
