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
| `addPlayer()` is idempotent for a known id, refuses once the room left the lobby, refuses the 17th | `race-room.mjs` | A retried round launch must never error; a late entrant must never land mid-race |
| `POST /v1/races/:id/players` (admin key) | `index.mjs` | The HTTP door for `addPlayer()` |
| `scheduledStartAt` - no all-ready start; the countdown begins 5 s early so the race goes green AT the scheduled time with every **connected** player (not-Ready players race, owner decision) | `scheduledTick()` | The contest has a fixed start |
| Fewer than two connected at the start -> `cancelled`, a final signed receipt with no results | `scheduledTick()`, `result()`, `archive()` | Without it the result endpoint answers 202 for ever and nothing can settle the round |
| A scheduled lobby lives until its start + 5 min rather than the vendor's flat 30 minutes | `lobbyExpiresAt()` | A contest may be booked hours ahead |
| `scheduledStartAt` bounded to 6 hours ahead | constructor | Bounds how long an idle room holds memory |
| `scheduledStartAt`, `status`, `cancelReason`, `registered` added to the snapshot / receipt | `snapshot()`, `result()` | Client countdown; the sweeper tells a DNF from a no-show |
| Vendor `GET /` (served `dist/Volt-Velocity-3D.html`) removed | `index.mjs` | The client is served by games-service behind a play token |
| Settings read from **`games-service/.env`** under the `VELOCITY_*` names (`env.mjs`); the vendor's `RACE_*` names, `PORT` and `HOST` are not read, and there is no `.env` of its own | `env.mjs`, `index.mjs`, PM2 `node_args: --env-file=../games-service/.env` | One file means the two secrets cannot drift apart between the two processes. The shared file's `PORT` is the games service's, so the listen address comes from `VELOCITY_RACE_URL`; allowed origins default to the origin of `GAMES_PUBLIC_URL` |

Tests: `npm test` (40 = 21 vendor + 14 in `tests/chartvolt-scheduled.test.mjs` + 5 in
`tests/chartvolt-env.test.mjs`). Deploy: PM2 `chartvolt-velocity` (reads `games-service/.env`),
nginx `/race/` (player endpoints only).
