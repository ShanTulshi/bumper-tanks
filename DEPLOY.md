# Deploying to GitHub Pages

The game is a fully static site (no backend; multiplayer is P2P WebRTC), so it
deploys anywhere static files go. It also works from a subpath — join/QR URLs
derive from `location.origin + pathname` — so the default
`https://<you>.github.io/bumper-tanks/` URL needs no config changes.

## 0. Build first

Sources are TypeScript in `src/`; the browser loads compiled ES modules from
`js/` (committed, so deploy-from-branch works without CI):

```sh
npm install        # once
npm run build      # tsc: src/*.ts → js/*.js
```

Always build before pushing, or the deployed `js/` will lag behind `src/`.

## 1. Create the repo and push

```sh
cd ~/side-projects/bumper-tanks
gh repo create bumper-tanks --public --source . --push
```

Or manually: create an empty repo on github.com, then
`git remote add origin git@github.com:<you>/bumper-tanks.git && git push -u origin main`.

Note: Pages on a free plan requires a **public** repo (private needs Pro or a
paid org plan).

## 2. Enable Pages

UI: repo → **Settings** → **Pages** (under "Code and automation") →
**Build and deployment** → **Source: Deploy from a branch** → branch `main`,
folder `/ (root)` → **Save**.

Or CLI:

```sh
gh api repos/{owner}/bumper-tanks/pages -X POST \
  -f "source[branch]=main" -f "source[path]=/"
```

## 3. Wait and verify

- First publish can take up to ~10 minutes; later pushes are faster.
- Site: `https://<you>.github.io/bumper-tanks/` — HTTPS by default, which
  also gives phones a secure context.
- Smoke test: open the URL, **Host arena**, scan the QR with a phone,
  confirm the second tank appears in the lobby, then **Launch**.

## Caching

GitHub Pages serves every asset with a fixed `Cache-Control: max-age=600`
(10 minutes) — custom headers aren't configurable. Phones are worse: mobile
browsers restore a backgrounded tab from memory with the old JS still running,
which no HTTP header can fix. The app therefore updates itself:

- `npm run build` stamps the build time into `version.json` (fetched at
  runtime with `cache: no-store`) and `src/build-info.ts` (compiled in).
- The page re-checks `version.json` on load, whenever the tab regains focus,
  and every 5 minutes; when a newer build is live it reloads itself — but only
  from the main menu, never mid-match or mid-lobby.
- Hosts reject guests whose `PROTOCOL_VERSION` doesn't match ("out of date —
  refresh the page"), so mixed-version lobbies fail loudly. Bump that constant
  in `src/game/constants.ts` whenever the wire format changes.

So after a deploy: pages already open converge within ~10 minutes or on the
next app switch, whichever comes first.

## Notes

- Anything pushed to `main` goes live. To gate releases, switch the Pages
  source to a `gh-pages` branch or a GitHub Actions workflow later (an Actions
  workflow could also run `npm run build` so compiled `js/` wouldn't need to
  be committed).
- GitHub only serves the files; game traffic never touches a server. The
  PeerJS public cloud brokers the WebRTC handshake (see `DECISIONS.md` #8).

Sources: [Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) ·
[Quickstart for GitHub Pages](https://docs.github.com/en/pages/quickstart) ·
[Creating a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
