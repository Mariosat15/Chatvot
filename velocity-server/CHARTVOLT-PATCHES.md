 Volt Velocity race server - ChartVolt patches

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
| **Ship picker two rows of four** (6 Oct 2026): eight `1fr` columns clipped names to VANGU/TEMPE in the practice frame; dock launch column narrowed | `root/chartvolt.css` (mirrored into packed `client.html`) |
| **Hangar fullscreen overlap** (6 Oct 2026): mute/pause/settings sat on the ship panel when actions scaled to 68px; `--cv-hangar-top` + fixed hangar action size | `root/chartvolt.css` (mirrored into packed `client.html`) |
| Race HUD moved to the edges on PC, tablet and short windows (phones keep the vendor layout) | `root/chartvolt.css`, appended by `root/tools/build.mjs` |
| Amber turn chevrons painted on the road before each corner | `client-patches/road-arrows.js`, called from `environment.js` |
| Scene slightly brighter (tone-mapping exposure 1.0 -> 1.16). **Buildings were not redesigned** | `client-patches/scene.js` |
| Lighter: 2K sky and textures by default, smaller audio | `root/tools/chartvolt-lighten.mjs`, `audio.js`, `environment.js`, `root/landscape-manifest.json` |
| **Lighter again (step 7).** `_cv` copies of the road asphalt, the concrete walls and the night sky (q80; normal maps q88), the crowd atlas as WebP (q88, alpha 100, same 1254x1254 so the atlas boxes still fit), and both scanned cliffs with their embedded textures re-encoded (4.6 -> 2.5 and 5.1 -> 2.8 MB, geometry untouched). Chosen after measuring 35-42 dB PSNR. Imports are redirected; every source file stays, so it is reversible. The HDRs are unchanged, because the golden tracks show the sunset HDR as their sky. Per race, measured in a browser: aurora 22.2 -> 16.7 MB, canyon 37.0 -> 27.0 MB | `root/tools/chartvolt-lighten.mjs`, `root/tools/chartvolt-lighten-glb.mjs` |

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
| 5 | New power-ups (EMP, shockwave, slick, homing missile, cloak, magnet), floating name labels, slipstream / perfect start / final lap / position callouts | Done |
| 6 | Denser, more alive existing tracks; three new tracks | Done |
| 7 | Lighter build: 62.1 -> 46.4 MB built, 44.7 -> 32.8 MB gzipped, 42.3 -> 32.4 MB packed | Done |
| 8 | Tests, docs, commit by explicit path, deploy steps; the lobby warm-up now fetches the `.mp3` soundtracks too (the client is MP3-only). Deploy steps: `External game plans/PROGRESS.md`, 28 Sep entry, step 8 | Done |

| Change | Where |
|---|---|
| **Gates.** The vendor drew a 9 m arch and scored only the middle 6.4 m, so the picture lied about where a gate counts. Every gate dimension now comes from `GATE_HALF_WIDTH`, the constant the simulation scores against | `client-patches/skill-gates.js`, `tests/chartvolt-gates.test.mjs` |
| **Collisions.** The vendor only pushed ships apart sideways, and the simulation rebuilds sideways speed from `heading` every tick, so they slid along each other like ghosts and a rear-end did nothing. A bounce now changes heading and yaw, heavier ships move less, and the rammed ship never gains forward progress. Server-only and authoritative; the client adds sparks, shake and a callout | `server/ship-contact.mjs`, `client-patches/scene.js`, `client-patches/main.js`, `tests/chartvolt-collisions.test.mjs` |
| **One road width.** `ROAD_SCALE` (1.25) in `src/road-width.js` is the only place the width lives. Content lanes are scaled *after* each random draw, so every seed produces the same race layout as before, just wider | `src/road-width.js`, `track.js`, `race-content.js`, `simulation.js`, `server/ship-contact.mjs`, `server/player-combat.mjs` (deleted 13 Oct 2026, now `server/race-feed.mjs`), `client-patches/scene.js` |
| **Vendor files we do not own are widened by transform, not forked.** The rebuild re-reads each pristine file out of the zip and applies exact replacements computed from `ROAD_SCALE` (tunnel, bridges, trackside boards and gantries, hover supports, guide boards, and the four vendor tests that pinned the old width). A vendor update that moves a string fails the rebuild instead of leaving a barrier inside the road | `tools/games/velocity-road-transforms.mjs` |
| **SUPERSEDED 13 Oct 2026 by the skill-only pass below** - shockwave, oil slick and cloak are gone, and the seeker now locks towers only; magnet, slipstream and perfect start survive. Kept as history. **Five new power-ups, server-authoritative.** Shockwave (hits and shoves rivals within 18 m, clears hazards within 40 m), oil slick (dropped behind, spins the first crosser once, 2 per owner, 24 total, shield blocks it), seeker (locks the nearest rival ahead in any lane), cloak (4 s, cannot be locked), magnet (6 s, wider pickup radius). Plus slipstream (drafting a rival 6-32 m ahead) and a perfect start (throttle pressed within 0.5 s before green). The room decides every outcome; specials are placed in addition to, never instead of, vendor capsules. Every value lives in `src/power-tuning.js` | `src/power-tuning.js`, `server/power-effects.mjs`, `server/player-combat.mjs`, `server/race-room.mjs`, `src/simulation.js`, `src/race-content.js`, `src/catalog.js`, `tests/chartvolt-powerups.test.mjs` (15 tests, 9 probes red x1) |
| **Power-up visuals.** Capsule name tags existed but were washed out by the additive beam; they are now a dark pill with a coloured border, one shared texture per kind (at most 13 instead of one per capsule). Distinct models for the five new kinds, a road decal for slicks, shockwave and spin rings, cloak fades the ship to about 22% opacity (materials cloned once so a shared material never fades another ship), and callouts for slipstream, perfect start, shockwave and spin. Presentation only. **Not yet seen by eye** | `client-patches/power-visuals.js`, `client-patches/powerups.js`, `client-patches/scene.js`, `client-patches/main.js` |
| **Livelier tracks, every circuit.** Chasing light strips along both barriers in the track's colours, waving pennants every 80 m, ten camera drones circling the course, and weather motes that follow the camera (snow on ice, embers on volcano, pollen, spray, dust, neon motes elsewhere), plus aurora curtains where an environment asks for them. Instanced and shader-animated from one shared clock, so it adds a handful of draw calls rather than hundreds; the low graphics setting draws 60% of the props and 45% of the motes. Presentation only | `client-patches/track-life.js`, `client-patches/environment.js`, `client-patches/scene.js` |
| **Three new circuits: Aurora Highway (ice, night, aurora), Neon Harbour (city, midnight), Nebula Drift (asteroids, planet).** Appended to `TRACKS`, so every existing id and layout is untouched and `ROUTE_VERSION` stays `circuits-8`. The vendor smoothness test (corner radius above 120 m) caught a 56 m hairpin in the first Harbour layout; the shipped radii are 124 / 152 / 124 m, lane clearance above 93 m, grade at most 0.113. The vendor test that pinned 15 tracks now pins 18, by transform. **"auto" still picks from the original fifteen** (`AUTO_TRACK_POOL` in games-service), because it is a modulo over the list and growing it would move a running contest to another track between rounds; the new three are chosen by name. Like the vendor's own ice and asteroid tracks, they race through a skyline: `buildHeroCity` runs for every type except the six natural ones | `src/tracks.js`, `client-patches/environment.js`, `tools/games/velocity-road-transforms.mjs`, `games-service/src/games/volt-velocity/tracks.ts`, `games-service/tools/test-velocity.ts` |
| **Grid. SUPERSEDED 13 Oct 2026 by the two-by-two F1 grid (third pass below); kept as history.** Three abreast, rows 14 m apart, a short last row centred, 16 painted boxes. `gridSlot()` is the only definition, used by the server to place ships and by the client to paint the boxes. A per-box F1 stagger was tried and dropped: it gave one pilot a head start within their own row and moved the front row off the line, which the vendor multiplayer tests pin | `src/start-grid.js`, `server/race-room.mjs`, `client-patches/scene.js`, `tests/chartvolt-road-grid.test.mjs` |

### Skill-only races (13 Oct 2026)

Paid Volt Velocity must be skill-only (legal opinion s3.3/s9). The rules below apply in **every room,
solo included**, so practice teaches the same race a paid contest runs.

| Change | Where |
|---|---|
| **No item touches another pilot.** EMP, shockwave, mines, oil slick and cloak are removed from `ITEMS`, the capsule bag (their slots become missile / counter / shield) and the specials list. Missile and seeker lock **towers only**. Shield, counter, overdrive, repair, energy and magnet act only on the collector | `src/catalog.js`, `src/race-content.js`, `src/power-tuning.js`, `src/simulation.js`, `server/power-effects.mjs`, `tests/chartvolt-skill-only.test.mjs` |
| **The blaster is removed - a deviation from "weapons affect towers".** Its bolts die at `ROAD_HALF_WIDTH` (20 m) while every tower sits at lane 23-26 m, so it could only ever hit ships. With nothing left to hit it was removed rather than retargeted | `server/race-feed.mjs` (replaces `server/player-combat.mjs`), `client-patches/main.js` |
| **Ship contact bounces with no damage.** The bounce, heading change and scrub are unchanged; hull damage and the spin-out are gone. A residual speed scrub and yaw wobble on contact remain, and they are physics rather than an attack. `ship-contact.mjs` itself is unchanged; the damage lived in the deleted `player-combat.mjs` | `server/race-feed.mjs`, `tests/chartvolt-collisions.test.mjs` |
| **Pickups are per pilot.** Collecting a capsule no longer removes it for anyone else - the room sets `competitiveCombat:false` (format `skill-race`), which is the vendor's own per-pilot pickup mode | `server/race-room.mjs`, `src/multiplayer-state.js`, `src/simulation.js`, `tests/chartvolt-pickup-replace.test.mjs` |
| **Grid by standing, not shuffle.** `setGridOrder(ids)` reorders the lobby roster (refused outside the lobby, and refused if shorter than the current roster so a stale order cannot drop a pilot). games-service calls `POST /v1/races/:id/grid` after each shared seat, with an order from the platform's signed standings endpoint: settled Volt Velocity points first, then join time | `server/race-room.mjs`, `server/index.mjs`, `games-service/src/games/volt-velocity/grid.ts` |
| **Disconnection rule.** Unchanged vendor behaviour, now published: a disconnected ship gets empty input and the clock runs; after 30 s the pilot is DNF | `server/race-room.mjs` (`disconnectedAt > 30000`), rules copy in games-service |
| **Client combat UI removed.** Hits/KOs counter, combat feed, spin and shockwave callouts; the item slot reads EMPTY SLOT and the missile hint reads TOWER LOCKED / ALIGN WITH A RED TOWER. `ITEMS` lookups tolerate a removed kind, because `scene.js` still builds mine meshes. **Correction, same day:** that sentence said the array was "always empty"; it was *absent* - `sim.mines` was deleted - and `scene.js`'s per-frame loop indexed it, so every start failed with "Unable to start the 3D renderer ... Cannot read properties of undefined (reading '0')". The loop now reads `s.threats\|\|[]` and `s.mines\|\|[]`. A deleted field is not an empty one; check every reader before removing state | `client-patches/main.js`, `scene.js`, `powerups.js`, `power-visuals.js` |
| **Four vendor tests now fail by design** and are named in `EXPECTED_VENDOR_FAILURES`: the carried-item rule, the capsule quota (offense drops 5 -> 3), the proximity mine and the EMP radius | `tools/games/rebuild-velocity-client.mjs` |

**`PHYSICS_VERSION` was `velocity-3d-14`** (skill-only) and is now **`velocity-3d-15`** (next
section), so the race server and games-service must be deployed together. `ROUTE_VERSION` is
unchanged at `circuits-8`. 94 tests.

### Performance, handling, harder tracks and the phone (13 Oct 2026, second pass)

Owner report: stutters with 16 pilots, too many power-ups, tracks too easy, ships and the phone
joystick slow to turn, and on a phone "you just shrink the game".

| Change | Where |
|---|---|
| **Rival ships come from a pool, built before the race.** A new rival used to build its procedural hull and paint a 1024² livery canvas on the frame it appeared, which is the freeze seen when a 16-pilot grid fills. Hulls are prewarmed and refilled in idle time, shaders compiled and textures uploaded ahead (`renderer.compile`, `initTexture`); a pilot who leaves returns their hull to the pool | `client-patches/scene.js` (`prewarmShips`, `takeShip`, `releaseShip`, `refillPool`, `warmShips`) |
| **Liveries are cached per ship and colour, 512² on a touch device.** ~5.6 MB of texture per hull at 1024², ~84 MB for 16; a phone gets a quarter of that | `client-patches/fleet-livery.js` (replaces the vendor file) |
| **Rival hover height samples 9 points every 3rd frame, then smooths**, instead of 25 points every frame per rival; the per-frame loops allocate nothing (scratch vectors, a reused id set, an allocation-free nearest-pickup search) | `client-patches/scene.js` |
| **Adaptive resolution.** The render scale drops 0.1 (to 0.6) when the frame cost averages above 21 ms and climbs back 0.05 below 17.8 ms; antialiasing is off. **Trade-off:** a display locked to 30 Hz reads as slow and settles at 0.6 | `client-patches/scene.js` |
| **Phone pixel ratio 1.25** on a high-density screen (was the full device ratio), and the standings list rebuilds only when the order changes, at most every 250 ms | `client-patches/main.js` |
| **Sharper handling.** Grip raised to 13 / 10; the touch pad steers at full lock from a quarter of its width with a `pow(x, .7)` curve, so a small thumb movement turns | `src/simulation.js`, `client-patches/touch-controls.js` |
| **Fewer, balanced power-ups.** A fixed 12-capsule mix plus specials at gaps 2/7/4/9/10: 14 per lap, the same for every entrant | `src/race-content.js`, `tests/chartvolt-powerups.test.mjs` |
| **Three ELITE circuits: Gauntlet, Viper, Zenith** - tighter corners and steeper grades within the vendor smoothness limits. Appended, so ids and `ROUTE_VERSION` are untouched; 21 tracks. A catalogue re-sync is needed for games-service to list them | `src/tracks.js`, `tools/games/velocity-road-transforms.mjs`, `games-service/src/games/volt-velocity/tracks.ts` |
| **A phone plays full screen and sideways.** On the first tap the race asks for true full screen and a landscape lock (Android/iPadOS; iPhone has no element Fullscreen API), a "turn your phone sideways" banner shows in portrait while racing (non-blocking, dismissible, remembered for the session), and side panels step in by the safe-area insets. The platform frame separately opens pinned over the whole window on any phone (`components/games/use-stage-fullscreen.ts`) | `client-patches/mobile-immersive.js`, `client-patches/main.js`, `client-patches/root/chartvolt.css` |

**`PHYSICS_VERSION` was `velocity-3d-15`** here and is now `velocity-3d-16` (next section).
Deploy race server and games-service together (games-service needs `npm run build`), then
re-sync the catalogue. **Never verified by eye**, and the frame-time gain has not been measured
on a real phone.

### F1 grid, practice circuit choice, the menu and the phone again (13 Oct 2026, third pass)

Owner report: three ships abreast on the start line, the start menu badly organised, practice
cannot choose the circuit, and on a phone rotating to landscape either dropped back to the
practice screen or errored, panels sat in the way in portrait, and landscape was not full screen.

| Change | Where |
|---|---|
| **F1 grid, two by two.** Two columns 11 m apart, 14 m between rows, and every box half a row (7 m) behind the one ahead, so P1 is on the line and P2 alongside one stagger back. **This reverses the 28 Sep decision to drop the stagger**, and the reason is recorded in the file: the grid order was a seeded shuffle then, so a stagger handed out a random head start; it is now the leaderboard order, so a slightly better slot is the F1 reward for standing higher. The road was not widened instead, because that moves every pickup, gate, wall and prop | `src/start-grid.js`, `tests/chartvolt-road-grid.test.mjs` |
| **Practice chooses its circuit.** The create spec carries `trackChoice: true` for practice only; the room accepts a `track` action from its one pilot while in the lobby and refuses it otherwise (a scheduled competition's circuit is the operator's). The hangar's ALL CIRCUITS and SHUFFLE buttons are enabled exactly when the room says so; elsewhere the card reads "Circuit set by this race" | `server/race-room.mjs`, `server/index.mjs`, `client-patches/multiplayer-client.js`, `main.js`, `games-service/src/games/volt-velocity/{race-server,launch,create}.ts`, `tests/chartvolt-practice-track.test.mjs` |
| **Rotation no longer crashes a phone.** Each resize used to reallocate every render target, and an iPhone rotating fires several in a row - the GPU memory was reclaimed and the race died. Resizes are debounced 220 ms, `resize()` skips a size it has already applied, and a touch device renders at most 1.1 megapixels (`PHONE_PIXEL_BUDGET`) | `client-patches/main.js`, `client-patches/scene.js` |
| **A lost graphics context reloads and REJOINS.** If the device still reclaims the context, the client says so and reloads on restore; the host page rejoins the same race with the same ticket, so the seat and progress survive. Without the host half a reload put the player in solo flight, because the host connected once | `client-patches/main.js`, `games-service/public/play/volt-velocity/velocity-host.js` (`rejoinOnReload`) |
| **Landscape fills the screen.** The platform frame hides its title bar and bezel in landscape, so the game takes the whole pinned stage | `components/games/ProviderGameFrame.tsx`, `__tests__/games/stage-fullscreen.test.ts` |
| **Portrait HUD decluttered.** Lap/time top-left, a small map top-right, standings compact under the lap panel, the integrity, item and speed panels in one row above the touch pads; best lap, sector split, lap progress, the skill panel, checkpoint and buff lists are hidden on a portrait phone only | `client-patches/root/chartvolt.css` |
| **The start menu is three numbered steps** - 01 circuit, 02 ship, 03 launch. The circuit is a card with the track's own outline (cloned from the picker), its name and its environment; compact on a phone in either orientation. Every existing id is kept | `client-patches/root/index.html`, `chartvolt.css`, `main.js` (`updateTrackUI`) |

**`PHYSICS_VERSION` is `velocity-3d-16`** (the grid moved where ships start), so the race server
and games-service deploy together. 98 race-server tests. **Never verified by eye.** iPhone Safari
has no element Fullscreen API, so its own toolbars can still show in landscape; adding the game to
the Home Screen is the only true full screen there.

### Phone: steering response, lighter frames, no scroll, never crash (13 Oct 2026, owner)

Owner report: the analog still answered late, the game was clunky and looked bad on a phone,
iPhone Safari killed the tab ("A problem repeatedly occurred"), scrolling to the end mid-race
crashed it, and a mobile UI guide fixed where the HUD goes.

| Change | Where |
|---|---|
| **Boot crash fixed.** Commit `55368fec` called `setRawPixelRatio` in a way that threw "reading 'call'" inside the resize path, so the 3D view never started | `client-patches/scene.js` |
| **Steering answers a reversal at once.** A turn pulling against the current yaw now closes the gap 1.6x faster, and with the stick near centre (\|steer\| < .15) the built-up heading eases back, so letting go straightens the ship instead of carrying the old turn. The pad's box is read once when the thumb lands rather than on every move, which forced a synchronous layout per `pointermove` | `src/simulation.js`, `client-patches/touch-controls.js` |
| **Lighter frames on a phone.** Textures keep only their drawn size and normal/roughness maps are halved; scanned rock faces and detail props cast no shadow and are drawn to 220 m instead of 350 m; cylinders use 16 sides instead of 40; PCF rather than soft shadows on touch; no clearcoat; the HDR clamp no longer allocates two arrays per pixel. The detail-range and shadow change cannot be raised again until reload - accepted, since a phone starts on Low | `client-patches/graphics-quality.js` (new override), `scene.js`, `architecture.js` (new copy), `environment.js`, `main.js` |
| **The page never scrolls during a race.** The host stage locks `html` and `body` overflow and overscroll in pseudo-fullscreen; inside the frame `touch-action:none`, `overflow:hidden` and a non-passive `touchmove` that cancels every gesture outside the hangar. iOS ignores body `overflow:hidden` alone, which is why both halves exist | `components/games/use-stage-fullscreen.ts`, `client-patches/root/chartvolt.css`, `touch-controls.js` |
| **One bad frame no longer ends the race.** The frame loop catches a throw, warns once and carries on; only 120 consecutive failures stop it and show the error | `client-patches/main.js` |
| **Portrait HUD per the guide.** Hull top-left under the lap panel, speed top-right under the map, equipment alone above the pads; USE and BOOST above, STEER bottom-left, BRAKE/ACCELERATE bottom-right. Measured at 390x844 and 844x390: no panel overlaps another or leaves the screen. This **supersedes** the "integrity, item and speed in one row above the pads" line in the table above | `client-patches/root/chartvolt.css` |

Measured in Playwright's phone emulation (390x844, 3x, touch) on a **desktop GPU**: draw calls
1,042 -> 658, shadow-pass triangles ~550k -> ~370k, frame median and p95 16.7 ms, JS heap
220-242 MB, no page errors, `scrollY` stays 0 after scrolling to 9999. A real phone's frame rate
is unknown. **`PHYSICS_VERSION` is `velocity-3d-17`** (steering changed), so the race server and
games-service deploy together. **Never verified by eye.**

### Reverse, the wall, Leave Race in Settings, fewer freezes (13 Oct 2026, owner)

Owner report: full screen was a mess on a phone, Leave Race should be in Settings, the frame rate
kept freezing, a ship sometimes stuck on the side of the road, and braking should reverse when held.

| Change | Where |
|---|---|
| **Hold brake to reverse.** Brake stops the ship first; held for 0.35 s more at a standstill (and without throttle) it reverses to at most 14 m/s. Releasing the brake, or pressing throttle, brings it back to 0. A ship cannot reverse behind its own start distance, so it cannot back over the line or score a gate or sector twice. `reverseHold` is serialized. The HUD shows positive speed and the word REVERSE | `src/simulation.js`, `src/multiplayer-state.js`, `client-patches/main.js`, `tests/chartvolt-reverse.test.mjs` (6) |
| **No more sticking on the barrier.** A slow scrape (under 4 m/s into the wall) no longer bounces the heading and scrubs 17% of speed every frame; it slides along with mild drag and the nose eased off the wall. A real impact still bounces and damages | `src/simulation.js` |
| **Leave Race lives in Settings** on desktop and mobile, as a full-width danger button above DONE, still only in a shared race | `client-patches/root/index.html`, `main.js`, `root/chartvolt.css` |
| **Freeze sources removed.** The HUD layout pass no longer forces layout every second (only after a real state change); the dynamic resolution may change direction at most twice per race instead of oscillating and reallocating render targets; a phone asks for full screen once per race on a tap instead of repeatedly with a landscape lock, which caused resize storms. The "turn your phone sideways" banner is gone: portrait is a supported layout | `client-patches/hud-layout.js`, `scene.js`, `mobile-immersive.js` |
| **Portrait field of view widened by 4°**, so the road is not cropped on a tall screen | `client-patches/scene.js` |

This **supersedes** the "phone plays full screen and sideways" row above. The vendor test "throttle
accelerates, release coasts, brake stops fully" now fails by design and is named in
`EXPECTED_VENDOR_FAILURES`. **`PHYSICS_VERSION` is `velocity-3d-18`**, so the race server and
games-service deploy together. **Never verified by eye.**

### The HUD is recomposed per device, not scaled (14 Oct 2026, owner)

> **Boot crash fixed the same day.** The vendor's `race-assist.js` (not in this repo) calls
> `el('hullLabel').closest('.integrity').classList`. The recomposed markup dropped that class, so the client
> threw on boot and every player was left on "Joining the grid…". The hull block carries `integrity` again
> with the vendor panel styling neutralised in `cv-hud.css`. The rebuild now runs
> `tools/games/velocity-dom-contract.mjs` after the patches are applied, and refuses to build if any
> non-optional `el()`/`$()` lookup or `.closest()` in the vendor scripts no longer matches `index.html`. No
> vendor test boots the HUD, which is why the suite stayed green.

Owner brief: `External game plans/design-reference/velocity fix`. Mechanics, physics and the server are
untouched; only the presentation layer changed. **This supersedes the "HUD that cannot overlap" pass
above**: the measured collision layout and the `--cv-hud` scale are gone.

| Change | Where |
|---|---|
| **One layout per device**: `html[data-layout]` is `desktop` (≥1024), `tablet` (768-1023 or a coarse pointer), `portrait` or `landscape` (short side ≤500 or under 768 wide), from `visualViewport`, re-applied on resize and rotation without reloading the race | `client-patches/hud-layout.js` (`layoutFor`) |
| **Six zones, empty centre.** TL race card (lap, time, total, hull, sector), TC skill chain and warnings, TR position + speed card and a minimap that can be switched off (off by default on phones), BL keyboard hint strip that collapses after 5 s. A LIVE dot by the timer fades to 40% after 3 s and comes back when the connection changes | `root/index.html`, **new `root/cv-hud.css`** (registered in `root/tools/build.mjs`) |
| **Utility controls**: desktop shows audio, pause, settings, full screen; tablet hides audio; phones show one ☰ that opens the pause card (Resume, Controls, Audio, Graphics, Camera, Full screen, Restart, Leave). Full screen is hidden where the browser has none (iOS), where the platform pins the stage instead | `root/index.html`, `hud-layout.js` |
| **Touch controls**: shown on touch devices or when "Show touch controls" is on in Settings; ITEM above-left, BOOST (energy ring, pulses when ready) above-right, STEER bottom-left, BRAKE + ACCEL bottom-right, all sized with `clamp` per layout, left-hand mirror kept | `root/cv-hud.css`, `main.js` (`--boost`, `data-ready`, `data-item`) |
| **Cameras per layout**: portrait fov 70, landscape 62, desktop 58 | `scene.js` (`CAMERA_PRESETS`) |
| **Phone frame rate and sharpness**: HUD writes only on change, minimap at 10 Hz and skipped when hidden, phone render budget raised so text and road are not blurry; fog thinned 35% on touch devices (fog costs frame time, not memory) | `main.js`, `scene.js`, `environment.js` |

**Not done:** new ship and city 3D models (the brief asked for them; they need modelling work, not a
code change), the hangar swipe carousel, and the track picker / Shuffle report. Tests: vendor 79/84
(5 expected), velocity-server 104/104, games-service velocity 19/19. Deploy: pull +
`pm2 restart chartvolt-games` (client fingerprint changes). **Never verified by eye** — the automated
browser has no WebGL, so the game would not render for a check.

### Phone ship carousel, track picker diagnosis, sharper hangar text (14 Oct 2026, owner)

| Change | Where |
|---|---|
| **Ship carousel on phones** (brief s25, "Mobile must NOT show 8 ships at once"): below 600px wide or 500px tall the 8-button strip is hidden and replaced by `‹ 01 / 08 NAME ›`, one dot per ship in its paint colour, and a horizontal swipe across the hangar (over 40px, clearly more horizontal than vertical, touch/pen only, never starting on a button or input). Every route calls `select()`, so the multiplayer ready lock and the server's authoritative ship still apply; the arrows dim when the ship buttons are disabled. Desktop keeps the 4x2 grid. Spec's separate "SELECT SHIP" button skipped deliberately: selection is immediate and ENTER CIRCUIT is the ready action | `root/index.html` (`.cv-carousel`, `#shipDots`), `main.js` (boot + `select`), `root/chartvolt.css` |
| **Hangar text on phones**: the 9-10px thin monospace labels are 11-12px system sans, semi-bold; the ship and dock panels drop `backdrop-filter` for a solid panel, because small text over GPU blur renders soft on phones | `root/chartvolt.css` |
| **Track picker / Shuffle**: the whole chain (games-service `practice` → `trackChoice` → race-room `changeTrack` → POST `/race/.../track`) is correct in the repo. The live fault is almost certainly the deploy: the `track` endpoint was added to `deploy/nginx.conf` and `next.config.ts` on 13 Oct, and a proxy without it answers with an HTML 404. The client now shows that as "Could not change circuit (... HTTP 404)" instead of a JSON parse error, and solo Shuffle always lands on a different circuit | `multiplayer-client.js` (`request`), `main.js` (`pickTrack`) |

**Deploy for the track fix:** pull; copy `deploy/nginx.conf` into place, `sudo nginx -t`, reload nginx;
rebuild Next; `pm2 restart chartvolt-velocity chartvolt-games`. If Shuffle then shows an HTTP status,
that status names the layer still missing the route. The circuit buttons only appear in **practice**
(solo) rooms by design. **Never verified by eye.**

### Joystick, HUD duplicates, desktop lobby card (14 Oct 2026, owner)

| Change | Where |
|---|---|
| **Phone joystick did nothing**: `#steeringPad` is a plain div inside `.cv-controls`, which sets `pointer-events:none` so the road stays tappable, and the pad inherited it, so no touch ever reached the steering handler. The pad now opts back in, with `touch-action:none` so a drag steers rather than scrolls | `root/cv-hud.css` |
| **TIME and TOTAL showed the same number**: `#best` printed the race total, which equals the lap time on lap one. It is now the best completed lap (`—` until one exists), labelled BEST | `main.js` (`put('best', ...)`), `root/index.html` |
| **Duplicates removed in a race**: the lap bar and race footer (repeat LAP), the standings list in the right card (repeats POSITION), the skill chip, the minimap captions, and on touch the energy row; the idle speed caption reads SPEED, not "HOLD W / ↑ TO ACCELERATE". Left card LAP/TIME/BEST/HULL, right card POSITION/SPEED, icons top right, key strip at the foot | `root/cv-hud.css`, `main.js` |
| **Desktop hangar: RACE LOBBY card overlapped the ship panel**: in a multiplayer hangar it is pinned in the empty centre column (capped at 300px / 28vw, scrolls inside itself) and hidden at 900px and below, where the side panels already hold the same facts. Long circuit names wrap to two lines instead of being cut off | `root/cv-hud.css`, `root/chartvolt.css` |

The platform half of the same report (page chrome hidden on game screens, the pinned phone stage
escaping its ancestors) is in `components/Header.tsx`, `components/AnnouncementBanner.tsx`,
`lib/utils/game-play-route.ts` and `components/games/use-stage-fullscreen.ts`. **Never verified by eye.**

### Phone hangar, quiet callouts, start wobble, sharpness, full screen after app switch (14 Oct 2026, owner)

| Change | Where |
|---|---|
| **Phone hangar hid the ship**: the camera centres the ship on screen, and in landscape (`aspect > 1.2`) shifts it right of centre. Portrait stacked title, step heads, name, description, trade-offs and personal best over the stage row; landscape put the ship panel on the right (over the ship) and the dock across the bottom. Portrait now keeps a slim circuit card, a guaranteed `24dvh` stage, the four stats in one row and a compact dock; landscape stacks circuit, stats and dock in a left column (max 300px) and leaves the right side as the stage. The carousel already names the ship, so the panel's name block is hidden on phones | `root/chartvolt.css` |
| **Phone callouts too big**: the item chip, `#cornerHint`, `#warning`, `#callout` and the pickup banner are smaller (about 10.5px) on a translucent background with no glow; the chip hides its key letter on touch | `root/cv-hud.css` |
| **BOOST and pedals cut off in portrait**: the item chip shared the auto-width steer column and widened it. The chip now sits in a row of its own above steer and boost (`"item item boost" "steer . pedals"`, mirrored for left-handed) and cannot grow past its cell | `root/cv-hud.css` |
| **Ship rocks back and forth for a second after the start**: countdown snapshots still in flight when the local clock reaches zero were restoring the predicted racing ship to the grid. `reconcile` ignores a countdown snapshot under 1.5s once the client is racing | `main.js` |
| **Blurry graphics, poor frame rate**: iPhones were measured as the low tier (1.25x pixel ratio, FXAA over that). An iPhone is now at least mid tier, caps are 2 / 1.75 / 1.5, bloom is off on every phone and, with bloom off, the frame is drawn straight to the screen instead of through three full-screen composer passes | `main.js`, `scene.js` |
| **Full screen lost after another app**: the browser drops real full screen on an app switch and the once-per-race request was already spent. It is re-armed on `visibilitychange` / `pageshow`, the pause screen counts as driving so the Resume tap wins it back, and the layout re-measures and scrolls to the top after rotation, return or a full-screen change (several passes, since phone browsers report the new size late). The platform's pinned stage does the same scroll-to-top | `mobile-immersive.js`, `hud-layout.js`, `components/games/use-stage-fullscreen.ts` |

**Never verified by eye.**

The lighten step is **not idempotent**: it deletes the 4k originals it shrinks, so a second rebuild
over the same `%TEMP%\vvfull` fails with `Input file is missing: ...rock_3_diff_4k.webp`. Pass
`--fresh` when that happens.

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

## 14 Oct 2026 - boost is a power-up, and the phone menu works in a live race

- **Boost** (`src/simulation.js`, `PHYSICS_VERSION` `velocity-3d-19`): the tank starts at
  `STARTING_BOOST = 0` and does not refill on its own (`BOOST_REGEN_PER_SECOND = 0`); a respawn
  no longer tops it up to 40%. It fills only from energy capsules (+40%), boost pads, skill moves
  and the service lane - the same capsules for every pilot, so it stays skill-only. The bump to
  the physics version is required: a client and server disagreeing on regen would mispredict.
  Pinned by `tests/chartvolt-boost-powerup.test.mjs` (5 tests). The HUD label now opens at 0%.
- **Phone menu in a live race** (`client-patches/main.js`): the multiplayer render disabled
  `#pause`, which on a phone (`html[data-layout=portrait|landscape]`) is the ONLY menu button,
  so tapping it did nothing. On a phone it stays enabled and opens the settings dialog (which holds
  LEAVE RACE); a live race is still never paused. Desktop keeps the disabled button.
- **Not verified by eye.**
## 14 Oct 2026 - phones kicked back to the practice screen; clunky start

Owner: "the game while playing or when I press play in practice shoots me out of the game back
to practice screen randomly in mobile ... when start still clunky ... find why the game crashes".

- **Cause of the "kick":** the practice page only returns to idle on the frame's `exit` or when
  it remounts. A phone browser killing the tab for memory reloads it with no `pagehide`, so the
  page remounted idle while the race was still running. The memory came from the sharper-render
  patch (490dea8b, same day): it lifted every iPhone to the mid tier, and mid loaded **2048
  textures** - four times the memory of 1024 - undoing the 13 Oct iOS fix.
- **Fix 1** (`client-patches/main.js`): phones default to 1024 textures unless they measured as
  high, which an iPhone never does (Safari reports no `deviceMemory`). The resolution caps stay,
  because `PHONE_PIXEL_BUDGET` in `scene.js` already bounds the canvas. Settings can still raise it.
- **Fix 2** (`main.js` `nextRace`): `graphics()` ran twice on every race start, walking every
  material and redrawing the phone's downscaled textures twice while the new scene allocated.
  One call after bloom is chosen gives the same result.
- **Fix 3** (`components/games/PracticeRoundHost.tsx`): a `pagehide` with `persisted` (app switch,
  swipe back into the back/forward cache) no longer voids the round, and the tab's
  `sessionStorage` remembers `{roundId, launchUrl}` so a reload after a crash resumes a round the
  server still lists as live. Exit and a deliberate close/reload forget it.
- **Not done:** joining a room still rebuilds the whole scene once (the hangar's solo track is
  replaced by the room's), which is the remaining start-time peak.
- Tests: `tests/chartvolt-phone-memory.test.mjs` (3), `__tests__/admin/practice-round-exit.test.ts`
  (+2). velocity-server 112/112, games-service velocity 19/19. **Not verified by eye.**

## 14 Oct 2026 - the 1.4-second frame at race start (owner console log)

The owner pasted a browser console log. What each line was:

- **`'requestAnimationFrame' handler took 1407ms` - a real defect, fixed.** `RaceScene.render()`
  calls `warmShips()` on its first frame, which links every shader and uploads textures. `nextRace`
  hid the loading screen before that frame, so every race start froze on a frame the player could
  see. The solo boot had the same freeze. The new `warmScene()` in `main.js` does this before the
  loading screen is hidden. It links the shaders with `compileAsync`, which uses parallel shader
  compilation where the browser supports it, with the pooled ships shown so their shaders are
  included. It then runs `warmShips()` and draws one frame to upload the textures. The solo boot
  calls it before its first animation frame.
- **`PCFSoftShadowMap has been removed` - fixed.** three.js 0.186 already replaced it with
  `PCFShadowMap` and printed a warning, so `scene.js` now asks for `PCFShadowMap` directly. The
  picture is identical.
- **`POST .../input 409` - expected.** Inputs are pipelined, up to four requests in flight. When a
  newer request overtakes an older one, the server answers the older one 409, and the client
  ignores it. Chrome still prints every non-2xx response in red.
- **`texImage3D: FLIP_Y or PREMULTIPLY_ALPHA isn't allowed` - not from our code.** The only 3D
  texture is the cloud noise in `cloud-city.js`. It keeps three.js's defaults (`flipY` and
  `premultiplyAlpha` both false), and three sets both flags from the texture on every upload.
  Left alone.
- **`TSS: Caught suspicious full screen spamming`, MetaMask, `MaxListenersExceededWarning`,
  `ObjectMultiplex` - browser extensions.** All three places that request full screen do so only
  from a click or tap (`hud-layout.js`, `mobile-immersive.js` once per race on touch devices,
  `use-stage-fullscreen.ts`).
- Tests: `tests/chartvolt-start-warmup.test.mjs` (4). velocity-server 116/116, games-service
  velocity 19/19, practice host 16/16. Deploy: pull + `pm2 restart chartvolt-games` (client only).
  **Never verified by eye.**

## 14 Oct 2026 - lighter on phones, sound after an app switch, callouts between the buttons (owner)

"Still a bit heavy for mobiles ... when go out and come in the game ... the music and sound stops
... put [the wordings] between the buttons so is not in the way of view."

**Lighter.** A phone is `matchMedia('(pointer:coarse)')`. The new `phone-budget.js` holds that answer
and all the numbers used below. Every cut is rendering only. Anything skipped still consumes its
random draws, and every skipped tower keeps its plot. That means the scenery that remains, the race
seed, the simulation and the driving geometry are identical on every device.
- No shadow map on any phone tier (`main.js`). Only the engine glow is kept of the four local point
  lights (`scene.js`). There is no clearcoat on tower glass or hover-taxis.
- `architecture.js`: every third main tower is dropped, and at most 12 back-skyline towers are built.
- `living-world.js` (new copy): 30 of the 120 hover-taxis are kept, and they move within 450 m.
  `traffic-kit.js` (new copy): taxi meshes use 40% of the segments. `spectators.js` (new copy): the
  crowd animates within 350 m.
- `track-life.js`: barrier lights are half as dense, as are flags. There are 4 drones instead of 10,
  35% of the motes, and no aurora. It **no longer sets `environmentFullCount`**. That setting let
  `graphics-quality.js` keep the first 60% of each instanced mesh, and those meshes are laid out in
  lap order, so the low setting removed the last 40% of the lap rather than thinning it.
  `graphics-quality.js`: on release builds, low clouds keep one in four.

**Sound.** Nothing woke the audio when the player returned to the page. Practice and competition
races are multiplayer, and in multiplayer hiding the page never suspended the audio either. iOS then
leaves the context `interrupted`, and `RaceAudio.update()` only plays while the context is
`running`. Now a multiplayer race suspends its audio when hidden. `visibilitychange`, `pageshow` and
`focus` call `audio.wake()`, and so does the next tap or key press. If a resume failed or the context
is `interrupted`/`closed`, that tap builds a new context (`rebuild()`), because iOS creates a context
only inside a gesture. `unlock()` waits at most 800 ms for `resume()`, which on iOS can never settle,
and before this fix that could hang the solo Resume button. A solo race the player paused stays
silent until they press Resume.

**Callouts.** On phones, FINAL LAP, sector and position messages and the pickup flash are fixed to
the bottom. In landscape they sit in the gap between the ←/→ and BRAKE/ACCEL buttons. In portrait
they sit just above the controls (`root/cv-hud.css`). The corner hint and the warning chip stay small
at top centre.

Tests: `tests/chartvolt-mobile-lighten.test.mjs` (10), including one that a skipped taxi consumes
exactly the draws a kept one makes. velocity-server 126/126, games-service velocity 19/19. Deploy:
pull + `pm2 restart chartvolt-games` (client only). **Never verified by eye or ear on a phone.**
## AI pilots in practice (14 Oct 2026)

`server/ai-pilot.mjs` (new) and `server/race-room.mjs`. A practice room (`trackChoice`) may be created with `aiPilots` (0-15). It fills that many `ai-*` seats driven by a seeded controller that sends the same inputs a browser would, so a bot follows the same physics and rules as a player. Personalities differ in pace (80-94% of the corner limit), reaction time, racing line, apex, wobble, gate and pickup hunting, boost timing and the odd mistake. A bot thinks only every 5-11 steps and allocates nothing per step. A room without `trackChoice` refuses `aiPilots`, so bots never reach a competition, a challenge or a paid room. Tests: `tests/chartvolt-ai-pilots.test.mjs` (6), 132/132 overall. **Never verified by eye.**
