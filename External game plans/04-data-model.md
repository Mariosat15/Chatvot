# 04 - Data Model

Every change is **additive**. Nothing is renamed, retyped or removed, so existing
records stay valid and a rollback is a code revert with no data migration.

---

## 1. The mirror rule - applies to every change in this document

ChartVolt keeps duplicate model files for the player app and the admin app. Those
copies have already drifted in production (see Stage 0 in the `New games plan`).

> **Every collection and every field below must be created in BOTH apps, in the
> same commit:**
> - `database/models/...`
> - `apps/admin/database/models/...`
>
> After Stage 0, the automatic mirror check enforces this and fails the build on
> drift. Until then it must be done by hand and reviewed deliberately.

A missing `gameKey` in the admin copy is exactly the failure that pays prize money
to the wrong players, so this is not administrative tidiness.

---

## 2. Changes to existing collections

### 2.1 Competition and Challenge

| Field | Type | Notes |
|---|---|---|
| `gameType` | string | From `New games plan` Phase 1. Value `"provider"` for external games |
| `gameKey` | string | **New here.** e.g. `provider:acme:trivia-blitz`. Immutable once written. Index it |
| `gameConfig` | object | Provider key, game code, validated settings, attempts policy, seed strategy |
| `contentSeed` | string | Generated at creation. Shared by every round in this contest |
| `playWindowStart` / `playWindowEnd` | date | Distinct from registration and from contest end |
| `resultGracePeriodSeconds` | number | Default 600 |
| `attemptsPolicy` | string | `single` \| `best_of_n` \| `sum_of_n` |
| `attemptsAllowed` | number | Default 1 |
| `unresolvedRoundPolicy` | string | `score_zero` \| `exclude` \| `hold_and_alert` |

Indexes: `{ gameType, status }`, `{ gameKey, status }`, `{ status, playWindowEnd }`.

### 2.2 Competition / Challenge participant

| Field | Type | Notes |
|---|---|---|
| `score` | number | From Phase 1. The general score the engine ranks on |
| `gameKey` | string | Denormalised for statistics queries |
| `bestRoundId` | ObjectId | Which round produced the counted score |
| `attemptsUsed` | number | Rounds **created**, not completed |
| `roundsCompleted` | number | Drives the minimum-participation rule |
| `scoreBreakdown` | object | Display only. Never ranked on |
| `totalDurationMs` | number | Tie-break |
| `firstAchievedAt` | date | Second tie-break |
| `hasUnresolvedRound` | boolean | Blocks settlement until cleared or timed out |

Index: `{ competitionId: 1, score: -1 }` for leaderboard reads.

### 2.3 Whitelabel settings

| Field | Notes |
|---|---|
| `gameProviders` | Array of `{ providerKey, enabled, baseUrl, displayName }` |
| `gameProviderCredentials` | API key, API secret, callback secret per provider. **Never returned to the client** |
| `externalGamesEnabled` | Master kill switch for all provider games |

---

## 3. New collections

### 3.1 `game_provider` - one per contracted provider

| Field | Notes |
|---|---|
| `providerKey` | Unique, stable, e.g. `acme` |
| `displayName`, `logoUrl` | Shown in admin, and optionally to players |
| `baseUrl` | API base |
| `enabled` | Per-provider kill switch |
| `capabilities` | What the provider supports - void, matches, practice, seeding |
| `healthStatus` | `healthy` \| `degraded` \| `down` |
| `lastHealthCheckAt`, `lastCatalogueSyncAt` | Monitoring |

Credentials live in settings, **not here**, so this document can be read freely by
admin screens without exposing secrets.

### 3.2 `provider_game` - the cached catalogue

Synced from `GET /v1/games`. Cached so the admin picker and the contest lobby never
depend on a live provider call.

| Field | Notes |
|---|---|
| `providerKey`, `gameCode` | Compound unique index |
| `gameKey` | Derived: `provider:{providerKey}:{gameCode}` |
| `displayName`, `description`, `thumbnailUrl`, `category` | Presentation |
| `family` | `independent` \| `head_to_head` |
| `supportsCompetition`, `supportsOneVsOne`, `supportsPractice`, `supportsContentSeed` | Capability flags |
| `scoreDirection`, `scoreType`, `scoreRange` | Ranking |
| `typicalDurationSeconds`, `maxDurationSeconds` | Scheduling and grace periods |
| `configSchema` | JSON Schema. **The admin settings form is generated from this** |
| `providerStatus` | As reported by the provider |
| `chartvoltEnabled` | Our own on/off switch, independent of theirs |
| `lastSyncedAt`, `lastSuccessfulRoundAt` | Health and the pre-flight check |

> **Two independent switches, deliberately.** A provider marking a game active does
> not make it live on ChartVolt. We enable each title ourselves after testing it.

### 3.3 `game_round` - the core new collection

One document per round. This is the audit trail for every score that decides money.

| Field | Notes |
|---|---|
| `roundId` | **Our** identifier. Unique index. Sent to the provider |
| `providerRoundId` | Theirs. Stored for support conversations |
| `providerKey`, `gameCode`, `gameKey` | Denormalised |
| `userId` | Player |
| `contestType` | `competition` \| `challenge` \| `practice` |
| `contestId` | Null for practice |
| `participantId` | Link to the participant record |
| `attemptNumber` | 1-based |
| `mode` | `ranked` \| `practice` |
| `configSnapshot` | **The exact settings used.** Never re-read from the game later |
| `contentSeed` | The seed used |
| `status` | `pending` \| `launched` \| `completed` \| `abandoned` \| `expired` \| `voided` \| `unresolved` |
| `rawScore`, `scoreBreakdown` | As reported |
| `startedAt`, `completedAt`, `durationMs` | Timing, as reported by the provider |
| `expiresAt` | Round expiry |
| `launchUrlExpiresAt` | Launch token expiry |
| `replayUrl` | Dispute evidence |
| `integrityFlags` | Provider suspicion signals |
| `resultReceivedAt`, `resultSource` | `callback` \| `poll` \| `manual` |
| `pollAttempts`, `lastPolledAt` | Reconciliation state |
| `createdAt`, `updatedAt` | |

Indexes:
- `{ roundId: 1 }` unique
- `{ contestId: 1, userId: 1, attemptNumber: 1 }` unique - **prevents duplicate attempts**
- `{ status: 1, expiresAt: 1 }` - drives the reconciliation job
- `{ userId: 1, createdAt: -1 }` - player history
- `{ providerKey: 1, gameCode: 1, createdAt: -1 }` - provider reporting

> **`configSnapshot` matters more than it looks.** If an admin edits a game's
> settings mid-contest, or the provider changes a default, historical rounds must
> still be explainable. Storing the exact configuration used is what lets us answer
> "why did I score differently from them" months later.

### 3.4 `provider_event` - the raw inbound log

Every inbound callback, stored **before** it is processed.

| Field | Notes |
|---|---|
| `eventId` | Provider's identifier. **Unique index - this is the deduplication mechanism** |
| `providerKey` | |
| `eventType` | |
| `rawBody` | The exact bytes received |
| `headers` | Signature and timestamp headers |
| `signatureValid` | Verification outcome |
| `processedAt`, `processingResult`, `processingError` | Outcome |
| `roundId` | Resolved link, when it could be matched |
| `receivedAt` | |

**Store first, process second.** If processing throws, the evidence still exists and
the event can be replayed. Debugging a money-affecting integration without the
original payloads is close to impossible.

Retention: keep at least 90 days, ideally as long as the provider retains replays.

### 3.5 `provider_health_check`

Small time series recording reachability, latency and error rates per provider.
Feeds the admin health panel and the decision to auto-disable a failing provider.

---

## 4. What must NOT change

| Do not | Reason |
|---|---|
| Add a new wallet transaction type for gameplay | **No money moves during gameplay.** Existing `competition_entry` and `competition_win` categories already describe every movement. Adding types would fragment financial reporting for no gain |
| Rename existing ledger categories | They are written into historical records used by reconciliation, refunds, exports and possibly tax. They are also still accurate |
| Store scores on the wallet or ledger | Scores are game data. Keeping them apart is what stops the financial reports being polluted |
| Recompute `gameKey` | Historical statistics would silently move |
| Reuse a `gameCode` for a different game | It is the identity behind every historical score for that title |

---

## 5. Migration

There is none of consequence.

| Step | Action | Risk |
|---|---|---|
| 1 | Create the new collections with indexes | None - empty |
| 2 | Add new fields to Competition, Challenge, participants | None - optional fields |
| 3 | Backfill `gameType = "trading"` and `gameKey = "trading"` on existing contests | Low - a single idempotent update, re-runnable |
| 4 | Sync the provider catalogue | None - read-only from the provider |

No field changes type. No data is destroyed. Rolling back means reverting code; the
new fields sit unused and harmless.

---

## 6. Retention and volume

| Collection | Growth | Retention |
|---|---|---|
| `game_round` | One per attempt - the largest new collection | Keep indefinitely. It is the audit trail behind prize money |
| `provider_event` | One or more per round, including retries | 90+ days, then archive |
| `provider_game` | Tens to low hundreds | Permanent |
| `provider_health_check` | Frequent, small | 30 days rolling |

At 1,000 rounds a day, `game_round` grows by roughly 30,000 documents a month -
trivial for Atlas, but worth indexing correctly from day one rather than after the
first slow-query warning.
