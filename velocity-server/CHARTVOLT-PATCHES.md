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
frame. It fails if any panel overlaps another, leaves the screen, or if the on-screen controls are
missing at any size. **Nothing here changes the race server.**

**On-screen controls on a computer too (owner, 28 Sep 2026, third pass).** The desktop rule that hid
`#touch` until a touch was seen is removed (`root/chartvolt.css`); the pads use pointer events, so the
mouse drives them, and `hud-layout.js` already moves the bottom panels clear of them. The analog pad is
the default on every device (`client-patches/touch-controls.js`, now patched): the mode is stored under
`cv-touch-mode-2`, because the vendor wrote `buttons` to `cv-touch-mode` on every computer that ever
loaded the game; a touch device's old value is carried over. That pass was applied to the built
`.html.gz` directly (the asset-complete vendor tree was not available) and re-packed; these sources
produce the same output on the next full rebuild.

### Gates, collisions, a wider road and an F1 grid (28 September 2026, fourth pass)

The owner's brief: gates that visibly score, real ship-to-ship collisions, more power-ups with
names above them, a road wide enough for 16, a three-per-row pole grid, denser and new tracks, and
a lighter game. **There is no newer vendor pack**; everything is built on
`Volt-Velocity-0.21-Complete.zip` plus these patches. The plan, in the order it is being done:

| Step | What | Status |
|---|---|---|
| 1 | One-command rebuild (`tools/games/rebuild-velocity-client.mjs`) | Done |
| 2 | Gates: the drawing now matches the scoring zone, neon pylons in six colours | Done |
| 3 | Physical collisions: a hit changes where ships are going, not only where they are | Done |
| 4 | Road 25% wider (half-width 16 -> 20 m, drive limit 13.3 -> 16.625 m) and a 3-abreast grid for 16 | Done |
| 5 | New power-ups (EMP, shockwave, slick, homing missile, cloak, magnet), floating name labels, slipstream / perfect start / final lap / position callouts | Next |
| 6 | Denser, more alive existing tracks; new tracks | Planned |
| 7 | Lighter build, with before/after sizes (today 62.1 MB built, 44.7 MB gzipped) | Planned |
| 8 | Tests, docs, commit by explicit path, deploy steps | Planned |

| Change | Where |
|---|---|
| **Gates.** The vendor drew a 9 m arch and scored only the middle 6.4 m, so the picture lied about where a gate counts. Every gate dimension now comes from `GATE_HALF_WIDTH`, the constant the simulation scores against | `client-patches/skill-gates.js`, `tests/chartvolt-gates.test.mjs` |
| **Collisions.** The vendor only pushed ships apart sideways, and the simulation rebuilds sideways speed from `heading` every tick, so they slid along each other like ghosts and a rear-end did nothing. A bounce now changes heading and yaw, heavier ships move less, and the rammed ship never gains forward progress. Server-only and authoritative; the client adds sparks, shake and a callout | `server/ship-contact.mjs`, `client-patches/scene.js`, `client-patches/main.js`, `tests/chartvolt-collisions.test.mjs` |
| **One road width.** `ROAD_SCALE` (1.25) in `src/road-width.js` is the only place the width lives. Content lanes are scaled *after* each random draw, so every seed produces the same race layout as before, just wider | `src/road-width.js`, `track.js`, `race-content.js`, `simulation.js`, `server/ship-contact.mjs`, `server/player-combat.mjs`, `client-patches/scene.js` |
| **Vendor files we do not own are widened by transform, not forked.** The rebuild re-reads each pristine file out of the zip and applies exact replacements computed from `ROAD_SCALE` (tunnel, bridges, trackside boards and gantries, hover supports, guide boards, and the four vendor tests that pinned the old width). A vendor update that moves a string fails the rebuild instead of leaving a barrier inside the road | `tools/games/velocity-road-transforms.mjs` |
| **Five new power-ups, server-authoritative.** Shockwave (hits and shoves rivals within 18 m, clears hazards within 40 m), oil slick (dropped behind, spins the first crosser once, 2 per owner, 24 total, shield blocks it), seeker (locks the nearest rival ahead in any lane), cloak (4 s, cannot be locked), magnet (6 s, wider pickup radius). Plus slipstream (drafting a rival 6-32 m ahead) and a perfect start (throttle pressed within 0.5 s before green). The room decides every outcome; specials are placed in addition to, never instead of, vendor capsules. Every value lives in `src/power-tuning.js` | `src/power-tuning.js`, `server/power-effects.mjs`, `server/player-combat.mjs`, `server/race-room.mjs`, `src/simulation.js`, `src/race-content.js`, `src/catalog.js`, `tests/chartvolt-powerups.test.mjs` (15 tests, 9 probes red x1) |
| **Power-up visuals.** Capsule name tags existed but were washed out by the additive beam; they are now a dark pill with a coloured border, one shared texture per kind (at most 13 instead of one per capsule). Distinct models for the five new kinds, a road decal for slicks, shockwave and spin rings, cloak fades the ship to about 22% opacity (materials cloned once so a shared material never fades another ship), and callouts for slipstream, perfect start, shockwave and spin. Presentation only. **Not yet seen by eye** | `client-patches/power-visuals.js`, `client-patches/powerups.js`, `client-patches/scene.js`, `client-patches/main.js` |
| **Grid.** Three abreast, rows 14 m apart, a short last row centred, 16 painted boxes. `gridSlot()` is the only definition, used by the server to place ships and by the client to paint the boxes. A per-box F1 stagger was tried and dropped: it gave one pilot a head start within their own row and moved the front row off the line, which the vendor multiplayer tests pin | `src/start-grid.js`, `server/race-room.mjs`, `client-patches/scene.js`, `tests/chartvolt-road-grid.test.mjs` |

**`PHYSICS_VERSION` is now `velocity-3d-13`** (the drive limit moved), so the race server and
games-service must be deployed together. `ROUTE_VERSION` is unchanged at `circuits-8`.

Rebuilding the client after changing anything in `client-patches/`, `src/` or the transforms:

```
node tools/games/rebuild-velocity-client.mjs            # rebuild, test, gzip and pack
node tools/games/rebuild-velocity-client.mjs --no-pack  # everything except the pack step
```

It unpacks the zip to `%TEMP%\vvfull` only if missing, copies `src/`, then `client-patches/`,
then applies the road transforms, runs the lighten tool, builds, runs the vendor tests (one known
vendor failure is expected and named in the script; any other fails the rebuild), gzips to
`games-service/vendor/volt-velocity-client.html.gz` and packs. Commit `games-service/vendor/`.

Tests: `npm test` (97 on 28 Sep 2026 after the power-ups pass; 82 after the fourth pass; 61 before it, including 4 in `tests/chartvolt-pickup-replace.test.mjs`; the breakdown below is older: 50 = 21 vendor + 14 in `tests/chartvolt-scheduled.test.mjs` + 7 in
`tests/chartvolt-env.test.mjs` + 7 in `tests/chartvolt-input-frames.test.mjs` + 1 in
`tests/chartvolt-client-prediction.test.mjs`, which drives the **real patched client** against the
real server over HTTP and asserts the prediction agrees with the server to within 5 cm). Deploy: PM2 `chartvolt-velocity` (reads `games-service/.env`),
nginx `/race/` (player endpoints only).
