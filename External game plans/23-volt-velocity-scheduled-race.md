# 23 - Volt Velocity: a scheduled 16-player race

> **Status: PLAN, not built (27 September 2026).** Nothing in this chapter exists in code yet.
> It was written after reading the whole of `Volt-Velocity-0.21-Complete.zip` (server, client
> integration surface, examples, tests) and the parts of the platform it touches. Owner approval
> of section 9's decisions is required before phase VV1 starts.

## 1. What the owner asked for

> "This game is a racing game ... many users can play this game at the same time. 16 players must
> join and start at a specific time ... users must join, pick a ship and wait for the game to start."

So the player's journey is:

1. **Enter** the competition on ChartVolt (pay the fee) any time before entry closes.
2. **Open the lobby** shortly before the race - the game loads, connected to a shared room.
3. **Pick a ship** in the game's own hangar and press **Ready**.
4. **Wait** - a countdown to the scheduled start is visible to everyone in the room.
5. **Race** - at the appointed moment the race starts for every connected player at once.
6. **Result** - finish times come back to ChartVolt and the contest settles as any other.

## 2. What the game package already provides (verified by reading it)

| Piece | What it does | Where |
|---|---|---|
| Race server | Node 22 process, authoritative physics at 60 Hz, broadcasts at 10 Hz over **SSE** (not WebSockets). Rooms of **2-16** players, in memory | `server/index.mjs`, `server/race-room.mjs` |
| Room creation | `POST /v1/races` with the **admin key**: `{ id, trackId (15 tracks), seed (uint32), players: [{id, name}] }`. The roster is **frozen** at creation | `server/index.mjs` |
| Player tickets | HMAC tickets `{ aud: "volt-velocity", raceId, playerId, exp }` signed with `RACE_TICKET_SECRET`; never placed in URLs | `server/tickets.mjs` |
| Player endpoints | `join`, `events` (SSE), `input`, `ship`, `ready`, `leave` under `/v1/races/:id/` | `server/index.mjs` |
| Ship selection + Ready | The game's **hangar UI** already does it once connected: ship buttons lock after Ready, the Play button reads "READY TO RACE" / "READY - WAITING FOR RACERS" | `src/main.js`, `src/multiplayer-client.js` |
| Start | Automatic when **every** registered player is connected and Ready (5 s countdown), or the admin `POST /v1/races/:id/start` starts the connected+ready subset (min 2) | `race-room.mjs` `ready()` / `start()` |
| Race rules | 3 laps or 300 s cap; a disconnected player has 30 s to return before DNF; a lobby expires after 30 min | `race-room.mjs` |
| Result | `GET /v1/races/:id/result` - 202 while running, 200 with an **HMAC-signed receipt** (finish order, times, DNFs) | `server/index.mjs` |
| Browser API | `ChartvoltVelocity3D.connectCompetition({ url, raceId, ticket })`, events `competition-connected` / `competition-result` (UI only, `requiresBackendSettlement: true`) | `examples/chartvolt-host.ts` |
| Practice | The game plays solo with no server at all | `Volt-Velocity-3D.html` |

## 3. The five gaps between the package and the owner's requirement

1. **There is no scheduled start.** The server starts either when *all* registered players are
   ready, or when an admin calls `/start`. "Start at a specific time" does not exist.
2. **The roster is frozen at creation**, but ChartVolt players enter one by one until entry closes.
   Something must either wait until entry closes, or the room must accept players while in lobby.
3. **The platform refuses to launch a round before the play window opens**
   (`lib/services/games/round-launch.service.ts:186`). A race lobby must be joinable *before* the
   gun, so a scheduled contest needs a **lobby window**.
4. **Nothing tells a provider WHEN a scheduled contest starts.** `POST /v1/rounds` carries
   `contentSeed` (one per contest - good, that identifies the shared room) and `expiresAt`, but no
   start time.
5. **Results must enter through the single ingestion door**, per player, signed - the race receipt
   is one document for 16 players.

## 4. Architecture (recommended)

```
Browser (player)                      VPS
  /competitions/[id]/play  ---------> Next.js platform (unchanged play screen, iframe)
     iframe /play/volt-velocity?t=... -> games-service (provider, :3002)  -- bootstrap page
     game client SSE /race/v1/races/* -> nginx /race/ -> race server (:3080, 127.0.0.1 only)
                                          ^ admin API (create room, add player, result)
                                          | called ONLY by games-service over loopback
Platform  <-- signed result callback per player -- games-service (sweeper polls race result)
```

**Why games-service owns the race, not the platform:** the platform already speaks one provider
protocol to games-service, and "a new title needs no platform code" is a hard property of the
programme. Volt Velocity becomes a **fourth ChartVolt Games title**. The platform never holds the
admin key or the ticket secret; the race server never touches money (hard constraint).

### 4.1 Pieces to build

| # | Piece | Side | Notes |
|---|---|---|---|
| A | **Race server as a PM2 process** `chartvolt-velocity` | infra | Copy `server/` into `games-service/velocity-server/` (own `package.json`, Node 22). `HOST=127.0.0.1`, `PORT=3080`, `RACE_DATA_DIR`, two separate 32+ char secrets. **As built it has no env file of its own**: it reads `games-service/.env` under the `VELOCITY_*` names and takes its address from `VELOCITY_RACE_URL` (s8.1 amendment) |
| B | **Server patch 1: open lobby roster** - admin `POST /v1/races/:id/players` adds a player while `status === "lobby"`, max 16 | race server | Closes gap 2 without making entry close early. Small and testable |
| C | **Server patch 2: `startAt` in the room spec** - `ready()` never auto-starts before `startAt`; at `startAt` the loop starts the connected players (auto-readying anyone connected with their chosen or default ship); fewer than 2 connected -> room `cancelled` | race server | Closes gap 1 inside the authoritative process, so a cron delay can never make the gun late. The admin `/start` stays as a manual override |
| D | **Title `volt-velocity`** in `games-service/src/games/titles.ts`: `playMode: "scheduled"`, `scoreDirection: lower_is_better`, `scoreType: duration_ms`, `maxDurationSeconds: 305`, `supportsContentSeed: true`, `supportsOneVsOne: true` (s9 decision 4), `supportsPractice: true`, `configSchema` = `trackId` enum (15 tracks) + `laps` fixed | games-service | Copy in `content.ts` (en + el - both locales are declared, so both are required) |
| E | **Round create for a race** (`rounds/create.ts` branch): room key = hash(gameCode, contentSeed, config); create the room on first launch (with `startAt`), add the player on every launch; refuse the 17th with a clear error | games-service | Idempotent on `roundId` like every other round |
| F | **Bootstrap page** `GET /play/volt-velocity?t=token`: loads the game client, resolves the token server-side, fetches `{ serviceUrl: "/race", raceId, ticket }` from `POST /play/api/velocity/session` (token-authenticated, ticket in body, never in a URL), calls `connectCompetition` | games-service | Shows the scheduled start countdown above the hangar |
| G | **Result sweeper**: poll `GET /v1/races/:id/result` (admin key) after `startAt`; verify the receipt HMAC; per player deliver the **existing** signed result callback: finished -> `completed` + `score = finishTimeMs`; DNF -> `completed` with **no score** (R45/R50: not eligible) | games-service | Delivery, retry and signing are the existing `callback/deliver.ts` |
| H | **Platform: lobby window for scheduled contests** - the launch service admits a seated player from `startTime - lobbySeconds`; everything else about `scheduled` (single attempt, entry closes at start) unchanged | platform (`round-launch.service.ts`, `play-shape.ts`, mirrored) | Closes gap 3. `lobbySeconds` is set per title by the admin in the Games section (s9 decision 1) and copied onto the contest at write time |
| I | **Protocol: `scheduledStartAt` on `POST /v1/rounds`** for scheduled titles | platform adapter + `01` + API HTML version bump | Closes gap 4. The only protocol change |
| J | **Pre-flight: player cap** - refuse `maxParticipants > 16` for this title (title declares `maxPlayers: 16`) | admin pre-flight (mirrored) | Otherwise the 17th payer is refused at the lobby door with their money taken |
| K | **nginx `/race/` location** - `proxy_buffering off`, `proxy_read_timeout 3600s`, forward `Authorization`, HTTP/2; expose only player endpoints, never `POST /v1/races` | deploy | Same origin as the platform, which `connectCompetition` requires |
| L | **Static client** under `/play/volt-velocity/assets/` with fingerprinted long cache | games-service | See risk VV-3 (size) |

### 4.2 What the platform does NOT need

No new model, no new ingestion path, no new settlement code, no new play screen. Ranking, ties,
unscored-player policy, refunds for too few players, prize split and Game Master fees all already
work for a provider contest with `lower_is_better` scores.

## 5. Timeline of one race

| Time | What happens |
|---|---|
| T-days | Operator creates the contest: Volt Velocity, track, **start 18:00**, max 16, min 2. Mode is forced to `scheduled` |
| until 18:00 | Players enter and pay. Entry closes at the gun (existing rule) |
| 17:50 | Lobby opens. A seated player presses Play: the platform creates their round (single attempt), games-service creates/extends the room, the iframe loads, the hangar appears with "Race starts in 9:58" |
| 17:50-18:00 | Pick a ship, press Ready. Leaving and returning resumes the **same** round (existing idempotent resume) |
| 18:00:00 | Race server starts the race for everyone connected (5 s countdown). No-shows are not in the race |
| ~18:05 | Race ends (3 laps or 300 s). Sweeper fetches and verifies the receipt, delivers 16 result callbacks |
| after end + grace | Contest finalizes as any provider contest: fastest time wins, DNF = no score |

## 6. Failure handling

| Failure | Handling |
|---|---|
| Fewer than 2 players connected at the gun | Room cancelled; each launched round reported without a score; the contest's too-few-players / unscored policy refunds (existing) |
| Seated player never opens the lobby | No round -> no score -> unscored policy (existing) |
| Player disconnects mid-race | 30 s to reconnect (server rule), else DNF -> no score |
| **Race server restarts mid-race** | Rooms are in memory and lost. Sweeper sees 404 for a started room -> rounds marked `voided`, operator alerted; contest must be **cancelled with refund** (existing admin control). Risk VV-1 |
| Receipt signature fails | Never delivered; round becomes `unresolved` -> contest's unresolved policy + alert |
| 17th launch | Refused with a clear message; prevented upstream by the pre-flight cap (J) |

## 7. Security

- Admin key and ticket secret live only in `games-service/.env`, which both processes read (s8.1 amendment); the platform never sees them.
- Tickets are issued per round, 1 hour lifetime (covers lobby + race), delivered in a POST body.
- nginx exposes only the six player endpoints; room creation and results are loopback-only.
- Allowed origins = the platform origin only (built as `VELOCITY_ALLOWED_ORIGINS`, defaulting to the origin of `GAMES_PUBLIC_URL`).
- Browser `competition-result` is display only; money moves only from the verified receipt via the single ingestion door.

## 8. Phases

| Phase | Content | Estimate |
|---|---|---|
| **VV1** | Race server in repo + PM2 + nginx + the two server patches (B, C) with tests | 2-3 days - **BUILT 27 Sep 2026**, see 8.1 |
| **VV2** | Title, round-create branch, bootstrap page, session endpoint, static client (D, E, F, L) | 2-3 days - **CODE-COMPLETE 27 Sep 2026**, see 8.2 |
| **VV3** | Result sweeper + receipt verification + per-player callbacks (G) | 1-2 days - **CODE-COMPLETE 27 Sep 2026**, see 8.3 |
| **VV4** | Platform lobby window, `scheduledStartAt`, player-cap pre-flight, spec version bump (H, I, J) | 2 days - **CODE-COMPLETE 27 Sep 2026**, see 8.4 |
| **VV5** | End-to-end rehearsal: 2 then 16 simulated players (headless clients), restart drill, deploy runbook, docs | 2 days |

**Total ~10-13 working days** including the 1v1 decision and the admin lobby control. Behind `externalGamesEnabled` and the title's `chartvoltEnabled`
switch throughout, so nothing reaches players until the owner enables the title.

### 8.1 VV1 - what was built (27 September 2026)

`velocity-server/` at the repository root: the vendor `server/` (four files), the ten `src/`
modules it imports, the three vendor multiplayer tests, and `CHARTVOLT-PATCHES.md`, which is the
authoritative list of every change. **It is not built and not deployed**; nothing calls it yet.

- **Without the two new spec fields the vendor behaviour is unchanged** - a frozen 2-16 roster
  that starts when everybody is Ready. That is what a 1v1 challenge room uses (s9 decision 4), and
  the 21 vendor tests pinning it still pass.
- `openRoster: true` lets a room start empty and grow to 16 through `POST /v1/races/:id/players`
  (admin key). `addPlayer()` is **idempotent for a known id** so a retried launch never errors,
  refuses once the room has left the lobby, and refuses the 17th.
- `scheduledStartAt` disables the all-ready start. The countdown begins 5 seconds early so the
  race goes **green at** the scheduled moment with every **connected** player, Ready or not
  (s9 decision 2). A registered player who never connected does not race.
- **Fewer than two connected at the start cancels the race**, and a cancelled race is archived
  with a signed, final receipt (`status: "cancelled"`, empty `results`, the `registered` list).
  Without this the result endpoint answers 202 for ever and nothing can settle the round - the
  vendor archived `finished` rooms only.
- A scheduled lobby lives until its start plus 5 minutes (the vendor evicted every lobby at 30
  minutes), and a start may be booked at most 6 hours ahead, which bounds idle memory.
- The vendor `GET /` that served the 107 MB client is removed; games-service serves the client
  (VV2).
- Deploy pieces: PM2 `chartvolt-velocity` (**fork, one instance** - rooms are in memory, so two
  processes would each hold half of them), and an nginx location
  that admits **only the six ticket-authenticated player actions** under `/race/`, with
  `proxy_buffering off` because `events` is a server-sent-event stream. The admin endpoints are
  reached by games-service over loopback only.
- Tests: `npm test` in `velocity-server/`, **35** (21 vendor + 14 new). Three probes - restoring
  the all-ready start on a scheduled room, archiving `finished` only, and dropping the auto-Ready
  at the gun - each turned the suite red.
- **VV-6 is resolved**: the vendor declares no Node engine; `--env-file` needs Node 20.6, which is
  what `package.json` now states.
- **Amended 27 September 2026 (owner): there is no `.env` for the race server.** It was first
  built with its own `velocity-server/env.example` under the vendor's `RACE_*` names; the owner
  asked for one file, and that is also the safer design, because the two secrets must be equal
  in both processes and two files are two places for them to disagree - with every result then
  failing its signature check. PM2 now starts it with `--env-file=../games-service/.env`, and
  `server/env.mjs` reads `VELOCITY_TICKET_SECRET`, `VELOCITY_ADMIN_KEY`, and optionally
  `VELOCITY_DATA_DIR` and `VELOCITY_ALLOWED_ORIGINS`. **It must not read `PORT` or `HOST`**:
  in that file they belong to the games service, so a race server reading them would try to
  bind the games service's port. Its listen address comes from `VELOCITY_RACE_URL` (default
  `http://127.0.0.1:3080`), the same line games-service uses to reach it, so the two cannot
  disagree about that either. **Amended 27 Sep 2026 (two servers):** optional
  `VELOCITY_RACE_LISTEN` overrides the bind address only; a machine whose `VELOCITY_RACE_URL`
  names another server runs no race process (`ecosystem.config.js`) and forwards `/race` there
  (`next.config.ts`). Seated players also pre-download the client from the lobby via
  `/play/warmup/:gameCode` - see PROGRESS.md's 27 Sep entry (4). Allowed origins default to the origin of `GAMES_PUBLIC_URL`, and
  with neither set **no** browser origin is admitted rather than all of them. `npm run
  setup:env` does not yet write the two Velocity secrets; add them by hand, or - since 27 Sep
  2026 - generate them from the admin panel (see the amendment below). The race-server
  suite is now **40** (5 new in `tests/chartvolt-env.test.mjs`, one of which passes a
  conflicting `PORT` and asserts it is ignored), and the games-service race test spawns the
  server with the shared names and a decoy `PORT`.
- **Amended 27 September 2026 (owner, option 1 of three): the admin panel can generate the two
  secrets.** This is a deliberate exception to s7's "the platform never sees them", and it is
  written down rather than absorbed. Games -> Volt Velocity -> Race server secrets calls
  `POST /api/games/velocity-secrets` (`guardSection("game-providers")`), which makes two
  different 32-byte hex values and writes only those two lines into `games-service/.env`
  (`apps/admin/lib/services/games/velocity-secrets.service.ts`). What keeps it narrow: the values
  are **never returned, logged or stored in MongoDB** - the screen shows "set" / "not set" and the
  file path, and the audit line says "values not recorded"; the write **refuses when the file does
  not exist**, rather than creating a stray `.env` nothing reads (the failure that retired the
  payment-provider `.env` writer); replacing secrets that are already set - even one - needs the
  typed word `ROTATE`, because it ends every race in progress; the file is replaced atomically
  with its permissions kept, and the placeholder lines `env.example` ships are replaced in place.
  **It only works when the admin app runs on the same server as games-service.** The default path
  is `../../games-service/.env` from `apps/admin` (the PM2 layout); `GAMES_SERVICE_ENV_FILE`
  overrides it. Both processes read the secrets at boot, so the screen then says to run
  `pm2 restart chartvolt-games chartvolt-velocity`. The control names no game - the route reports
  which title it belongs to - and the fs-using service never reaches the browser (R58); the shared
  phrase and restart command live in `apps/admin/lib/admin/velocity-secrets-copy.ts`. Tests:
  `__tests__/admin/velocity-secrets.test.ts` (18).

### 8.2 VV2 - what was built (27 September 2026)

A fourth ChartVolt Games title, `volt-velocity`, in `games-service/src/games/volt-velocity/`
(`title.ts`, `tracks.ts`, `copy.ts`, `race-server.ts`, `launch.ts`), plus
`rounds/play-volt-velocity.ts`, `http/volt-velocity-client.ts` and a host page in
`public/play/volt-velocity/`. **Code-complete, not deployed, and the platform half (VV4) is not
built**, so no contest can be created on it yet. Everything in this list is `games-service` only
and shares no code with the platform (`check:isolation`).

- **The title is `playMode: "scheduled"`, `lower_is_better`, `duration_ms`, `maxDurationSeconds:
  305`, `supportsOneVsOne: true`, desktop only**, config = `trackId` (`auto` or one of the 15
  tracks, resolved per race from the seed). Copy in `en` and `el`.
- **Deviation: `supportsPractice: false`**, where 4.1 D said `true`. A practice round would need a
  race room of its own with nobody else in it, and a one-player scheduled room is cancelled by the
  server at the gun (VV1). A ranked-only title is honest; `mode: "practice"` is refused with a 400
  that names the reason.
- **An unconfigured deployment publishes the title as `maintenance`**, so the platform's pre-flight
  refuses contests on it rather than selling seats in a race nobody can host. Configuration is
  all-or-nothing: `VELOCITY_ADMIN_KEY` and `VELOCITY_TICKET_SECRET` both or neither, and they must
  differ (the race server refuses to boot when they are equal), or games-service refuses to start.
- **Seating happens at round creation, before the round is written**: the room id is derived from
  `(gameCode, contentSeed, track, scheduledStartAt)`, so every entrant of one contest lands in one
  room, and the racer's id on the race server is the **`providerRoundId`**, never the platform's
  user id - the receipt is keyed by it and it keeps a user id out of a second process's archive.
- **Deviation: no new error codes.** 4.1 E sketched `RACE_FULL` / `RACE_CLOSED`; the provider
  error table is a closed set the platform branches on, so a new code is a protocol change. Full or
  closed -> 400 `INVALID_REQUEST` (permanent, and a failed creation consumes no attempt); race
  server unreachable -> 503 `GAME_UNAVAILABLE`, retryable; any other refusal -> 500 `INTERNAL`.
- **`scheduledStartAt` is accepted on `POST /v1/rounds`** (must be before `expiresAt` and at most
  six hours ahead). Absent means a challenge room, which starts when both players are Ready. **The
  requirements document is not yet amended** - that is VV4 piece I, with its version bump.
- **The session endpoint is `POST /play/api/velocity/session`**, token in the body: it marks the
  round `in_progress` and returns the room id, a freshly minted ticket (never stored), the client
  URL and, locally only, the race URL. **No score comes back through it.**
- **Deviation from 4.1 F/L: the client is a nested same-origin frame, not static assets in the
  repository.** The vendor client is one ~107 MB self-contained HTML file and is not edited.
  **Amended 27 Sep 2026 (owner: the manual install was too many steps):** it is now committed
  gzipped (~76 MB) as `games-service/vendor/volt-velocity-client.html.gz` and unpacked beside
  itself on first use, keeping the archive's mtime so the fingerprint survives restarts;
  `VELOCITY_CLIENT_FILE` still overrides it. Each new client build adds ~76 MB to git history.
  **Amended again 27 Sep 2026 (owner: players re-downloaded 100 MB every visit):** the .gz is no
  longer served. `tools/games/pack-velocity-client.ts` splits every inlined `data:` asset into
  `games-service/vendor/volt-velocity/assets/<content-hash>.<ext>`, resizes the six 4096² stone
  maps to 2048² and the two 8192×4096 skies to 4096×2048 (webp q90), and writes a ~1 MB
  `client.html` whose literals point at the files, plus `manifest.json`. ~48 MB in 36 files, the
  largest 5 MB, all `immutable`; the page's fingerprint is now its content hash, not size+mtime.
  The client itself is still not edited - only its literals are rewritten, which is safe because
  every one is a whole quoted `data:` URI handed to a URL-taking three.js loader. Verified by
  loading the packed page in Chromium: every model, texture and HDR requested and 200, menu drawn.
  Originally the operator pointed `VELOCITY_CLIENT_FILE` at it and games-service streams it at a
  size-and-mtime fingerprinted URL with an immutable cache. The host page loads it in a frame and
  drives its public `ChartvoltVelocity3D.connectCompetition` API, so the ticket is handed over as a
  JavaScript value and never reaches a `src`, a `Referer` or an access log. The host only ever
  posts `ready` and `finished` to the platform - never a time, position or lap.
- **Known and accepted: a duplicate concurrent create can leave an orphan seat.** Two requests with
  the same `roundId` arriving together each seat a player before the unique index refuses one of
  them. The loser's seat is a registered racer who never connects, and a registered racer who
  never connects does not race (VV1). Harmless, so it is recorded rather than locked.

### 8.3 VV3 - what was built (27 September 2026)

`games-service/src/callback/race-results.ts`, called at the start of every `sweepOnce`.

- **A race round is closed ONLY by a verified receipt.** The sweeper groups open velocity rounds by
  room, polls each room at most every 10 s (20 rooms per tick), verifies the HMAC over
  `signedPayload` and reads only the signed payload. Finished without DNF -> `completed` with
  `score = timeMs`; DNF, unfinished or absent from the results -> `completed` with **no score**
  (never zero, which on a lower-is-better title would be the best time on the board). A
  **cancelled** race -> every round `voided` with the reason, so the attempt is handed back.
- **A grace window keeps the ordinary expiry from beating the receipt.** `hardDeadline` for a race
  round is `expiresAt + 10 minutes` (`VELOCITY_RESULT_GRACE_MS`), and the overdue sweep and the
  finished-clock sweep both skip race rounds until then - otherwise a race ending at the contest
  window's close is expired a second before its result is read.
- **A room the race server has lost** (404, e.g. a restart mid-race) is voided once the oldest round
  in it is at least 60 s old, so a round created a moment ago is not mistaken for a lost one.
- **Deviation from section 6: a receipt that fails verification closes nothing.** It is logged as an
  error on every poll and the round is left open; when the grace window ends it is expired without a
  score. games-service has no `unresolved` status - that is the platform's reconciliation state -
  and paying on, or voiding on, a receipt we cannot trust are both wrong.
- **Tests: `npm run test:velocity`**, 7, part of `npm test` (now **344**). It **spawns the real
  race server** rather than stubbing it, and reads its track list as text rather than importing it,
  because `check:isolation` forbids that import. It proves the track lists agree, that two entrants
  share one room the race server knows, that the ticket we sign is accepted by the race server and a
  tampered one refused, that no ticket appears in any URL, and that a scheduled race nobody joins is
  cancelled, receipted, verified and delivered to the platform as `voided` with no score. It
  **skips loudly** when `velocity-server/node_modules` is missing. Two probes - scoring a DNF, and
  ignoring a cancellation - each turned exactly one test red.
- **A finished race is not exercised end to end**: it takes five minutes and two steering clients.
  That is VV5's headless rehearsal; here scoring is covered on hand-built entries.
- Two **pre-existing** failures were fixed on the way, both flipped rather than deleted: the progress
  test still expected the pre-v1.20 body without `provisionalScore` / `provisionalDurationMs`, and
  the board test's fake DOM lacked `insertBefore`, which `board.js` has called since `ade774ef`.

### 8.4 VV4 - what was built (27 September 2026)

The platform half: pieces H, I and J. **Code-complete, not deployed, never run against the real
race server** (that is VV5). Nothing is player-visible until the owner enables the title.

- **The lobby (H).** `lobbySeconds` is an operator-owned field on `provider_game` (both model
  copies), set per title in Games -> Providers -> catalogue by `GameLobbyLengthControl.tsx`
  (default **10 minutes, 1-30**, whole seconds; `parseLobbySecondsInput` refuses anything else and
  `null` clears it). It is **copied onto `Competition.lobbySeconds` at write time**, like
  `playMode`, so an operator changing the title later does not move the lobby of a contest people
  have already paid for. It is barred from the content editor (`NEVER_EDITABLE_CONTENT_FIELDS`)
  and the play-style route refuses a request carrying it together with another decision, so one
  audit line covers one decision.
- **One definition of "has a lobby".** `playModeHasLobby` and `lobbyOpensAt` in `play-shape.ts`
  (mirrored, byte-identical) are read by the create service, the launch service and the play
  state. `play-shape.test.ts`'s single-resolver guard forbids a literal `=== "scheduled"` in the
  services; the first cut had one and the guard caught it.
- **The launch service admits an `upcoming` contest from the moment the lobby opens onwards**, not
  only until the gun - the status cron flips `upcoming` to `active` up to a minute late, and a
  player pressing Play in that minute would otherwise be told the race has not started. An
  `anytime` contest has no lobby and every other status is refused exactly as before.
- **Round expiry is measured from `max(now, scheduledStartAt)`.** Measured from creation, a round
  opened 30 minutes early would expire before the race ended, and games-service refuses a round
  whose start is not before its expiry.
- **The protocol (I).** `scheduledStartAt` on `POST /v1/rounds` and `maxPlayers` on the catalogue,
  in `01` and `ChartVolt-Game-API-Requirements.html`, now at **version 1.21**. Both are optional,
  so a provider ignoring them is conformant. `scheduledStartAt` is sent on **every** round of a
  scheduled contest, including one opened after the gun, because it is what puts every entrant in
  the same room; `contestRoundConfig` sets it only for a contest *stored* as scheduled.
- **The seat cap (J).** `maxPlayers` is provider-owned (games-service publishes 16 for
  `volt-velocity` and nothing for the other titles, pinned by a games-service API test). The
  pre-flight refuses a contest whose `maxParticipants` is absent, zero, or above the cap, and a
  minimum above it, naming both numbers; a challenge counts as 2. Publishing re-runs it against
  the stored record. A title with no cap is unchanged.
- **The player screen.** `PlayState.lobbyOpensAt` drives `RoundPreflight`: before the lobby it says
  the lobby has not opened; inside it the button reads **Enter the lobby** / **Back to the
  lobby**. It uses the same rule as the launch service rather than a second one.
- **Tests:** `__tests__/services/volt-velocity-lobby.test.ts` (19), plus the existing play-shape,
  provider-round-launch and create suites; two probes (a lobby on `anytime`, a seventeenth seat)
  each turned exactly their own test red. games-service `npm test` green and `check:isolation`
  clean. One **pre-existing** guard was repaired on the way: `round-progress.test.ts` measured
  the progress call against a file-wide `lastIndexOf`, which `completeRound` (Volt Stack,
  `d664a85e`) had made fail on correct code; it now slices `submitBoard` with both ends asserted.

## 9. Owner decisions (answered 27 September 2026)

1. **Lobby length is set by the admin in the Games section**, not fixed in code. It becomes an
   operator-owned field on the catalogue title (`lobbySeconds`, beside `playModeOverride`, in
   `NEVER_EDITABLE_CONTENT_FIELDS` and edited through its own control in Game Providers), copied
   onto the contest **at write time** like every other forced value, so changing it later never
   moves the lobby of a contest players have already paid into. The per-title field must stay
   outside the provider sync allow-lists, or the next sync reverts it silently. Bounds 1-30
   minutes (the server's lobby expiry is 30 minutes); default 10 when unset.
2. **Connected but not Ready at the gun: they race** with the ship they selected, or the default.
3. **The vendor server may be patched** - pieces B and C stand as written.
4. **1v1 challenges are ON.** This fits the server with no extra patch: a challenge has no
   appointed start (`22` s5), so a challenge room is created **without `startAt`** and uses the
   server's own rule - the race starts when both players are connected and Ready. The lobby
   opens when the challenge is accepted and stays open for the challenge's play window; an
   opponent who never arrives means no round and no score, which the existing challenge
   settlement already handles. `supportsOneVsOne: true` on the title; the room key comes from the
   challenge's own `contentSeed`, so two players are never put into a competition's room.
   Adds about 1 day to VV3/VV5.

## 10. Risks

| ID | Risk | Mitigation |
|---|---|---|
| VV-1 | In-memory rooms: a restart mid-race loses it | Do not deploy during scheduled races; restart drill in VV5; cancel-with-refund runbook |
| VV-2 | Capacity: 100 rooms per process, 60 Hz physics | Benchmark 16 players in VV5; one race at a time is far inside the limit |
| VV-3 | **Client is ~107 MB** (inlined assets) - slow on mobile, and it must load inside the lobby window | Serve the modular build with long cache + compression; lobby opens 10 min early; ask the vendor for a split-asset build |
| VV-4 | Latency: SSE through Cloudflare/nginx buffering | `proxy_buffering off`; verify Cloudflare does not buffer `text/event-stream` |
| VV-5 | Protocol change (`scheduledStartAt`) | Additive field, version bump of `ChartVolt-Game-API-Requirements.html` |
| VV-6 | Node 22 required by the race server | **Resolved in VV1**: no engine declared by the vendor; Node >= 20.6 for `--env-file` |

> **27 Sep 2026 - the race stream froze on the machine that forwards to the race server.** On a server that does not host `chartvolt-velocity`, `/race` goes through the Next.js rewrite, and Next.js gzips every response it sends, including forwarded ones (`router-server.js`). Gzip holds the 10 Hz `events` snapshots back until a chunk fills, so the client saw no updates and showed RECONNECTING. The fix is `Cache-Control: no-cache, no-transform` on the stream in `velocity-server/server/index.mjs`, which the compressor (and Cloudflare) honour. No nginx change is needed. A one-shot `curl` cannot show this, because a single reply is not held back.

