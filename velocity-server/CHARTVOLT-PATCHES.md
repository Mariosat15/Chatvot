# Volt Velocity race server - ChartVolt patches

Vendor source: `Volt-Velocity-0.21-Play.zip` (`server/`, the ten `src/` modules the server
imports, and the three multiplayer tests), copied unchanged on 27 September 2026 and then patched.
Design: `External game plans/23-volt-velocity-scheduled-race.md`. Every patch is marked
`CHARTVOLT PATCH` in the source.

**Without the two new spec fields the vendor behaviour is unchanged**: a frozen roster of 2-16 players
that starts when everybody is Ready. The 21 vendor tests pin that and still pass.

| Patch | Where | Why |
|---|---|---|
| `openRoster: true` - roster may start empty and grow to 16 | `RaceRoom` constructor, `addPlayer()` | Contest entrants arrive one at a time before the gun |
| `addPlayer()` is idempotent for a known id, refuses the 17th, and refuses once the room left the lobby **unless** `lateEntryOpen` (an open-roster scheduled room counting down or racing, 28 Sep 2026) | `race-room.mjs` `addPlayer()` / `mayEnter()` | A retried round launch must never error. A late entrant may join a running scheduled race (owner rule) but never an unscheduled one |
| `POST /v1/races/:id/players` (admin key) | `index.mjs` | The HTTP door for `addPlayer()` |
| `scheduledStartAt` - no all-ready start. **Since 28 Sep 2026** (owner rule, superseding "connected players race at the gun"): once `now >= scheduledStartAt` **and** at least two connected pilots are Ready, a `SCHEDULED_COUNTDOWN_MS` (10 s) countdown runs, no ship moves during it, and only Ready pilots race | `scheduledTick()`, `start(now, countdownMs)` | The contest has a fixed earliest start, and a race of one is not a race |
| Fewer than two Ready by `latestStartAt` (sent by games-service; default start + 5 min) -> `cancelled` with `cancelReason: 'too-few-ready'`, a final signed receipt with no results | `scheduledTick()`, `result()`, `archive()` | Without it the result endpoint answers 202 for ever and nothing can settle the round |
| A scheduled lobby lives until its `latestStartAt` rather than the vendor's flat 30 minutes | `lobbyExpiresAt()` | A contest may be booked hours ahead, and must wait for a second player |
| **Late join** (28 Sep 2026): `enterLate()` during the countdown takes a grid slot with no penalty; during the race the pilot gets a 3 s (`LATE_JOIN_COUNTDOWN_S`) countdown and `lateOffsetMs` = race time already run + 3 s is added to `timeMs`/`finishTimeMs`; the result row carries `lateStartMs` | `race-room.mjs`, `snapshot()` (`lateEntry`, `latestStartAt`) | "If a user is late he still can join the race" - and lateness must never be an advantage |
| `scheduledStartAt` bounded to 6 hours ahead | constructor | Bounds how long an idle room holds memory |
| `scheduledStartAt`, `status`, `cancelReason`, `registered` added to the snapshot / receipt | `snapshot()`, `result()` | Client countdown; the sweeper tells a DNF from a no-show |
| Vendor `GET /` (served `dist/Volt-Velocity-3D.html`) removed | `index.mjs` | The client is served by games-service behind a play token |
| Settings read from **`games-service/.env`** under the `VELOCITY_*` names (`env.mjs`); the vendor's `RACE_*` names, `PORT` and `HOST` are not read, and there is no `.env` of its own | `env.mjs`, `index.mjs`, PM2 `node_args: --env-file=../games-service/.env` | One file means the two secrets cannot drift apart between the two processes. The shared file's `PORT` is the games service's, so the listen address comes from `VELOCITY_RACE_URL`; allowed origins default to the origin of `GAMES_PUBLIC_URL`. Optional `VELOCITY_RACE_LISTEN` (`host:port`) overrides only the bind address, so the one race server can accept the second machine's forwarded traffic while its own games service still calls loopback; malformed values fall back to `VELOCITY_RACE_URL` |
| `server/start.mjs` is the process entry point (PM2 and `npm start`); it listens unconditionally | `start.mjs`, PM2 `script`, `package.json` | `index.mjs` listens only when `process.argv[1]` is itself, and under PM2 fork mode `argv[1]` is PM2's container - so the server loaded, never listened, and PM2 still showed it **online with empty logs** (found live 27 Sep 2026). `index.mjs` keeps its guard so tests can import it without binding a port |

| **Step-numbered input frames** (`src/input-frames.js`): an input message may carry `frames: [[step, steer×1000, bits], …]` (≤30). The server queues them per player (`frameQueue`, ≤10, oldest dropped with its fire carried forward) and applies **exactly one per physics step**, reporting `ackStep` (last applied) and `inputStep` (newest queued) in every snapshot and input response. A message without `frames` is the vendor path, unchanged | `race-room.mjs` `input()` / `step()` / `snapshot()`, `index.mjs` | The owner reported the ship "stuck back and forth". The vendor applied whatever input was last received, dropped it after 250 ms, and allowed one input request on the wire at a time, so the server simulated a different drive from the one the player saw and every snapshot snapped the ship back. With one frame per step, the client can replay exactly what the server has not yet applied and land on the same position (proven exactly equal in `chartvolt-input-frames.test.mjs`) |
| Malformed `frames` refuse the whole message and consume no `seq` | `race-room.mjs` `input()` | A half-applied batch would desynchronise the replay silently |
| **`laps`** (whole number 1-10, default 3) on the create spec; the race limit is `laps x 100 s`. The simulation reads `laps` / `maxSeconds` from the room config instead of its fixed 3 laps / 300 s. Anything else refuses the create | `race-room.mjs` constructor, `src/simulation.js` constructor | Owner rule, 28 Sep 2026: an operator picks 1-10 laps for a competition, 100 s per lap. 3 laps is exactly the vendor's 300 s |
| **`solo: true`** - exactly one pilot, frozen, unscheduled; starts when that pilot is Ready (the two-player minimum becomes one) | `race-room.mjs` constructor, `start()` | An "each plays alone" competition gives every entrant a private race with no other ships. Anything else with `solo` (open roster, a schedule, two pilots) is refused |
| `skillScore` on each finisher in the receipt | `result()` | games-service tie-breaks equal times on points without re-deriving them |

## The client half (`client-patches/`)

The race client is built from the vendor tree, not from this repository, so the patched client
sources live in `client-patches/` (`multiplayer-client.js`, `main.js`, `scene.js`; the frame codec
is `src/input-frames.js`, shared with the server byte for byte). What they do:

- **Prediction with replay.** Each 1/60 s step is recorded as a quantised frame and simulated
  locally at once. On each snapshot the server state is restored and every frame after `ackStep`
  is replayed, so the ship stays where the player steered it.
- **Visual smoothing only.** Any remaining difference is eased out over ~0.1 s on the rendered
  position; the simulation itself is never nudged. No easing across a respawn or a large jump.
- **Pipelined inputs.** Up to 4 input requests in flight; a 409 (overtaken by a newer request) is harmless.
- **Other ships drawn ahead** by their speed × (time since snapshot + half the round trip), capped
  at 0.35 s. **Hits stay fair**: missiles, mines and collisions are decided by the server on its
  own positions; the lead is drawing only.
- **Both directions are backward compatible.** The client turns framing on only when `join`
  returns `inputStep`, so it still drives an unpatched server the vendor way, and an unpatched
  client still drives this server. Deploy order therefore does not matter.

### Look and feel pass (28 September 2026)

| Change | Where |
|---|---|
| **A new weapon replaces the one you hold** (was: ignored while holding one). Repair and energy never touch it. Same rule for every racer, decided by the server | `src/simulation.js` `collect()` (server **and** client, identical); `tests/chartvolt-pickup-replace.test.mjs` |
| Clearer capsules, a flash and a pop when one is collected | `client-patches/scene.js`, `powerups.js`, `main.js`, `root/index.html` (`#pickupFlash`) |
| Start screen fits one screen: ship picker, visible Launch button, obsolete text removed | `root/index.html`, `main.js`, `root/chartvolt.css` |
| Race HUD moved to the edges on PC, tablet and short windows (phones keep the vendor layout) | `root/chartvolt.css`, appended by `root/tools/build.mjs` |
| Amber turn chevrons painted on the road before each corner | `client-patches/road-arrows.js`, called from `environment.js` |
| Scene slightly brighter (tone-mapping exposure 1.0 -> 1.16). **Buildings were not redesigned** | `client-patches/scene.js` |
| Lighter: 2K sky and textures by default, smaller audio | `root/tools/chartvolt-lighten.mjs`, `audio.js`, `environment.js`, `root/landscape-manifest.json` |

### HUD that cannot overlap, touch controls, logo (28 September 2026, second pass)

The owner reported three faults: the touch controls missing on a phone, equipment drawn over hull
(in the frame and at 1920x1080), and live position drawn over the lap panel.

| Change | Where |
|---|---|
| **Touch controls shown from the start on any touch device.** The vendor revealed them only after the first touch, and our desktop rule hid them until then, so a device reporting a fine pointer too (tablets, hybrids) could never show them | `client-patches/hud-layout.js` `detectTouch()` |
| **Panels are measured, not guessed.** After every layout change the HUD panels are measured and any that touch a neighbour are moved vertically clear of it (top half down, bottom half up). The touch pads, top buttons and logo are never moved. Only the CSS `translate` property is written, so it never fights the scaling `transform`. The aux row counts as its two buttons, since its middle lets touches through | `client-patches/hud-layout.js`, called from `main.js` |
| One panel style, panels scaled to the window (1 on a large monitor, down to .62 in a small frame), live position under the map on PC and beside the lap panel on a sideways phone | `root/chartvolt.css` |
| The text brand is replaced by the Volt Velocity logo (black keyed to transparent, 84 KB), hidden while racing on small screens | `root/assets/ui/volt-velocity-logo.webp`, `root/index.html`, `hud-layout.js` |

`root/tools/chartvolt-shots.mjs [hangar|race|all] [size,...]` screenshots the start screen and a race
(with a forced 8-row live position list) at eight sizes, from 1920x1080 down to a 390x640 phone
frame. It fails if any panel overlaps another, leaves the screen, or if the touch controls are
missing on a touch size or shown on a mouse size. **Nothing here changes the race server.**

Rebuilding the client after changing a file in `client-patches/`:

1. Copy `client-patches/*.js` and `src/input-frames.js` into the vendor tree's `src/`, and
   `client-patches/root/` over the vendor tree's root (`landscape-manifest.json` goes to
   `assets/landscape/manifest.json`). Run `node tools/chartvolt-lighten.mjs` once on a fresh tree.
2. In the vendor tree: `npm i --no-save three@0.186.1 esbuild@0.25.12`, `node tools/build.mjs`
   and `node --test tests/` (84 vendor tests).
3. Gzip `dist/Volt-Velocity-3D.html` to `games-service/vendor/volt-velocity-client.html.gz`,
   then run `npx tsx tools/games/pack-velocity-client.ts` and commit `games-service/vendor/`.

Tests: `npm test` (61 on 28 Sep 2026, including 4 in `tests/chartvolt-pickup-replace.test.mjs`; the breakdown below is older: 50 = 21 vendor + 14 in `tests/chartvolt-scheduled.test.mjs` + 7 in
`tests/chartvolt-env.test.mjs` + 7 in `tests/chartvolt-input-frames.test.mjs` + 1 in
`tests/chartvolt-client-prediction.test.mjs`, which drives the **real patched client** against the
real server over HTTP and asserts the prediction agrees with the server to within 5 cm). Deploy: PM2 `chartvolt-velocity` (reads `games-service/.env`),
nginx `/race/` (player endpoints only).
