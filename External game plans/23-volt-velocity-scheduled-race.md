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
| A | **Race server as a PM2 process** `chartvolt-velocity` | infra | Copy `server/` into `games-service/velocity-server/` (own `package.json`, Node 22). `HOST=127.0.0.1`, `PORT=3080`, `RACE_DATA_DIR`, two separate 32+ char secrets |
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

- Admin key and ticket secret live only in `games-service` and race-server env; the platform never sees them.
- Tickets are issued per round, 1 hour lifetime (covers lobby + race), delivered in a POST body.
- nginx exposes only the six player endpoints; room creation and results are loopback-only.
- `RACE_ALLOWED_ORIGINS` = the platform origin only.
- Browser `competition-result` is display only; money moves only from the verified receipt via the single ingestion door.

## 8. Phases

| Phase | Content | Estimate |
|---|---|---|
| **VV1** | Race server in repo + PM2 + nginx + the two server patches (B, C) with tests | 2-3 days - **BUILT 27 Sep 2026**, see 8.1 |
| **VV2** | Title, round-create branch, bootstrap page, session endpoint, static client (D, E, F, L) | 2-3 days |
| **VV3** | Result sweeper + receipt verification + per-player callbacks (G) | 1-2 days |
| **VV4** | Platform lobby window, `scheduledStartAt`, player-cap pre-flight, spec version bump (H, I, J) | 2 days |
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
  processes would each hold half of them), `velocity-server/env.example`, and an nginx location
  that admits **only the six ticket-authenticated player actions** under `/race/`, with
  `proxy_buffering off` because `events` is a server-sent-event stream. The admin endpoints are
  reached by games-service over loopback only.
- Tests: `npm test` in `velocity-server/`, **35** (21 vendor + 14 new). Three probes - restoring
  the all-ready start on a scheduled room, archiving `finished` only, and dropping the auto-Ready
  at the gun - each turned the suite red.
- **VV-6 is resolved**: the vendor declares no Node engine; `--env-file` needs Node 20.6, which is
  what `package.json` now states.

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
