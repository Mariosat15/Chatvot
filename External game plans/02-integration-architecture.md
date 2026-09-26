# 02 - Integration Architecture (ChartVolt Side)

How the provider plugs into the game-module architecture from the `New games plan`,
what components are new, and how data flows.

---

## 1. The layering

```
 +---------------------------------------------------------------+
 |  USER INTERFACE                                                |
 |  contest browse -> lobby -> Play -> iframe -> results          |
 +---------------------------------------------------------------+
                              |
 +---------------------------------------------------------------+
 |  SHARED CONTEST ENGINE            (exists today, UNCHANGED)    |
 |  entry fee . prize pool . lock . rank . pay . fee . refund     |
 |  Knows only: participants have a score                         |
 +---------------------------------------------------------------+
                              |
 +---------------------------------------------------------------+
 |  GAME REGISTRY                    (New games plan, Phase 1)    |
 |  "which module handles this contest?"                          |
 +---------------------------------------------------------------+
             |                    |                    |
   +---------v------+   +---------v--------+  +--------v---------+
   | TRADING MODULE |   | IN-HOUSE MODULE  |  | PROVIDER MODULE  |
   | (exists today) |   | (optional)       |  |     <-- NEW      |
   +----------------+   +------------------+  +--------+---------+
                                                        |
                                        +---------------v---------------+
                                        |  PROVIDER REGISTRY            |
                                        |  "which provider adapter?"    |
                                        +---------------+---------------+
                                              |                  |
                                    +---------v-----+   +--------v------+
                                    | ACME ADAPTER  |   | OTHER ADAPTER |
                                    +---------------+   +---------------+
                                              |
                                    ~~~~~~~~~~v~~~~~~~~~~~
                                       External provider
```

**There are two registries, and the distinction is deliberate.** The game registry
answers "which kind of game is this contest", and has very few entries. The provider
registry answers "which external company supplies it", and is only consulted inside
the provider module. The contest engine never sees the second one at all.

---

## 2. The key design decision - one module for all provider games

A provider will offer many games, and will add more over time. If every provider
game needed its own entry in the game registry, adding a title would need a code
change and a deployment. That defeats the point of using a provider.

**So there is exactly one provider module, and the specific game is data.**

```
gameType   = "provider"                      <- selects the CODE MODULE
gameConfig = {
  providerKey: "acme",                       <- which provider
  gameCode:    "trivia-blitz",               <- which game
  settings:    { questionCount: 10, ... },   <- validated against the provider's configSchema
  attemptsPolicy: "best_of_3",
  contentSeedStrategy: "per_contest"
}
```

Adding a new title from an existing provider becomes: **sync the catalogue, tick it
active in admin, create a contest.** No release.

### 2.1 But statistics still need per-game identity

Players expect "best Trivia Blitz players", not "best provider players". So
leaderboards, per-game ratings, badges and stats key on a separate composite value:

| Concept | Purpose | Examples |
|---|---|---|
| `gameType` | Selects the code module | `trading`, `provider` |
| `gameKey` | Identifies the game for stats, leaderboards, badges, ratings | `trading`, `provider:acme:trivia-blitz`, `provider:acme:chess-puzzles` |

`gameKey` is derived once, when the contest is created, and then stored on the
contest and on every participant record. It is **never recomputed**, because the
provider could rename a display title later and historical statistics must not move.

> **Rule: `gameKey` is immutable once written.** It is the join key for every
> historical statistic. Treat it exactly like the ledger category names - the label
> shown to players can change freely, the key cannot.

---

## 3. New components

| Component | Responsibility |
|---|---|
| `GameProviderAdapter` (interface) | The contract every provider adapter implements |
| `AcmeProviderAdapter` | One implementation per provider. The **only** place provider-specific formats exist |
| `ProviderRegistry` | Maps `providerKey` to an adapter instance. Reads enabled providers from settings |
| `ProviderGameModule` | Implements the game-module contract. Delegates gameplay to the adapter, returns scores to the engine |
| `GameCatalogueService` | Syncs and caches the provider catalogue. Serves the admin game picker |
| `RoundService` | Creates rounds, enforces the attempts policy, records round state |
| `ResultIngestionService` | Verifies signatures, deduplicates, stores results, updates participant scores |
| `RoundReconciliationJob` | Finds unresolved rounds and pulls their state. **The safety net** |
| `POST /api/games/providers/[providerKey]/events` | The signed callback endpoint |
| `/play/[contestId]` | The page hosting the game iframe |

---

## 4. The adapter interface

Every provider adapter implements the same shape. This is the seam that makes a
second provider cheap.

| Method | Purpose |
|---|---|
| `listGames()` | Fetch the catalogue, normalised to ChartVolt's shape |
| `createRound(request)` | Create a round, return a launch URL |
| `fetchRound(roundId)` | Pull current state - fallback and reconciliation |
| `voidRound(roundId)` | Cancel a round, if supported |
| `verifyCallback(rawBody, headers)` | Validate signature and timestamp. Returns pass/fail |
| `parseCallback(rawBody)` | Translate the provider's payload into ChartVolt's normalised result |
| `capabilities()` | What this provider supports, so the UI can degrade gracefully |

Every method returns a result object - `{ success, data?, error? }` - never throws.
This matches the existing server-action convention in the codebase.

### 4.1 The normalised result

Whatever shape a provider sends, the adapter converts it to one internal shape:

```
NormalisedRoundResult {
  roundId          our identifier
  providerRoundId  their identifier, stored for support
  status           completed | abandoned | expired | voided
  rawScore         number, in the game's own units
  scoreDirection   higher_is_better | lower_is_better
  breakdown        game-specific detail, display only
  startedAt, completedAt, durationMs
  replayUrl        for disputes
  integrityFlags   provider-side suspicion signals
  occurredAt       provider's event timestamp
}
```

**Nothing downstream of the adapter ever sees a provider-specific field.** If
provider vocabulary appears in the contest engine, the leaderboard or the admin
reports, the abstraction has failed.

---

## 5. Sequence - a player plays a round

```
Player        ChartVolt                          Provider
  |               |                                  |
  |  click Play   |                                  |
  |-------------->|                                  |
  |               | check: entered? contest live?    |
  |               | attempts remaining? not banned?  |
  |               |                                  |
  |               | create Round record (pending)    |
  |               |                                  |
  |               |  POST /v1/rounds                 |
  |               |  roundId, gameCode, config,      |
  |               |  contentSeed, expiresAt          |
  |               |--------------------------------->|
  |               |<---------------------------------|
  |               |   launchUrl (short-lived)        |
  |               |                                  |
  |               | Round -> launched                |
  |<--------------|                                  |
  |  /play page   |                                  |
  |               |                                  |
  |  iframe loads launchUrl ------------------------>|
  |<================ plays the game ================>|
  |               |                                  |
  |               |     POST /events  (signed)       |
  |               |<---------------------------------|
  |               | verify signature + timestamp     |
  |               | dedupe on eventId                |
  |               | store result, Round -> resolved  |
  |               | update participant score         |
  |               | recompute live leaderboard       |
  |               |--------------------------------->|
  |               |          200 received            |
  |               |                                  |
  |<--------------|  results screen                  |
```

Note that the **result never travels through the player's browser**. The iframe may
tell us the player finished so we can refresh the screen, but that message is a UI
hint only and is never trusted as a score.

---

## 6. Sequence - settling a contest

```
Contest window closes
        |
        v
Status -> settling (stop accepting new rounds immediately)
        |
        v
Any rounds still unresolved?
        |
   yes  |                                  no
        v                                   |
  Pull each one:  GET /v1/rounds/{id}       |
        |                                   |
  Resolved now? --yes--> record ------------+
        |                                   |
        no                                  |
        v                                   |
  Grace period expired?                     |
   no -> retry shortly                      |
   yes -> mark as unresolved, score by      |
          policy, RAISE AN ALERT            |
        |                                   |
        +-----------------+-----------------+
                          v
        Hand final scores to the shared contest engine
                          |
                          v
        rank -> prizes -> platform fee -> notifications
             -> points, XP, badges, levels, milestones
                  (all existing code, unchanged)
```

The grace period exists because a player can legitimately finish a round in the last
seconds of a contest and the callback can arrive slightly later. Settling instantly
would score them zero and pay someone else their prize.

---

## 7. The iframe host page

`/play/[contestId]` is intentionally thin: it validates entry, requests a round,
renders the iframe, and listens for a small set of UI messages.

| Concern | Handling |
|---|---|
| Sandboxing | `sandbox="allow-scripts allow-same-origin allow-forms"`, and `allow` limited to what the game needs |
| Origin checks | Every `postMessage` is checked against the provider's declared origin. Anything else is discarded |
| Accepted messages | `ready`, `finished`, `exit`, `resize`. **Nothing score-related is ever accepted** |
| Mobile | Full-height responsive container. Most provider games are mobile-first |
| Launch URL expiry | Typically minutes. If the page sits idle past expiry, request a fresh round rather than showing a dead frame |
| Content Security Policy | The provider's play domain must be added to `frame-src`. Easy to forget and it fails only in production |
| Leaving mid-round | Warn the player that the attempt still counts, matching the abandoned-round rules |

---

## 8. Configuration

Provider credentials follow the existing settings pattern in the codebase -
environment variables mapped into the whitelabel settings document, editable from
Admin > Settings > Environment, exactly as `IP_INTELLIGENCE_API_KEY` is today.

| Setting | Notes |
|---|---|
| `GAME_PROVIDER_ACME_BASE_URL` | API base |
| `GAME_PROVIDER_ACME_API_KEY` | Outbound bearer token |
| `GAME_PROVIDER_ACME_API_SECRET` | Outbound request signing |
| `GAME_PROVIDER_ACME_CALLBACK_SECRET` | Inbound signature verification |
| `GAME_PROVIDER_ACME_ENABLED` | Kill switch, per provider |

Because the admin app mirrors these model and settings files, **every one of these
changes must be made in both apps in the same commit** - which is precisely what the
mirror guard from Stage 0 enforces.

---

## 9. Where each piece of work lands

| Area | New / changed |
|---|---|
| `lib/services/game-providers/` | New - adapter interface, registry, per-provider adapters |
| `lib/services/games/round.service.ts` | New - round lifecycle and attempts policy |
| `lib/services/games/result-ingestion.service.ts` | New - verify, dedupe, score |
| `lib/game-modules/provider/` | New - the provider game module |
| `app/api/games/providers/[providerKey]/events/route.ts` | New - callback endpoint |
| `app/play/[contestId]/` | New - iframe host page |
| `worker/` | New job - round reconciliation |
| `database/models/` + admin mirrors | New collections - see `04-data-model.md` |
| Contest engine, wallet, prize logic | **Unchanged** |

---

## 10. Design rules to hold to

1. **The engine never learns that a provider exists.** It sees participants with scores.
2. **All provider-specific formatting lives in one adapter file.**
3. **Scores enter the system through exactly one function** - the ingestion service.
   One entry point makes verification, deduplication and audit provable. This is the
   same lesson as the duplicate competition join paths in Stage 0.
4. **Never trust the client.** Not for scores, not for timing, not for completion.
5. **Every round reaches a terminal state**, if not from the provider then from our
   reconciliation job.
6. **`gameKey` is immutable** once written.
7. **A provider outage must degrade, not corrupt.** Contests pause or refund; money
   never moves incorrectly.
