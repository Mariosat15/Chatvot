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

**BUILT 4 September 2026, with one field this table did not mention and should have.**

Every field above is now on both copies of `Competition`, all optional so no existing
trading contest is invalidated. `attemptsAllowed` is left **undefined rather than defaulted
to 1**, because `single` ignores it and a stored `1` beside a `best_of_n` policy reads as a
deliberate one-attempt allowance rather than as an unanswered question.

**The blocker was `startingCapital`, which this chapter never listed because it is a
pre-existing trading field.** It was `required: true, min: 100` unconditionally, so a
provider contest could not be saved at all — and the failure arrives as a Mongoose
validation error naming a concept the operator was never shown. It is now required only
when the contest is trading:

```ts
required: function (this: { gameType?: string }) {
  return (this.gameType ?? "trading") === "trading";
}
```

**The `?? "trading"` is load-bearing, not defensive.** Invariant 5 resolves an absent game
label to trading, so a contest written by one of the raw-driver paths before X1's backfill
has no `gameType` and *is* a trading contest. Written as `this.gameType === "trading"` the
predicate would let an unlabelled trading contest be saved with no starting capital, and
every downstream trading calculation would divide by it. Pinned by a test that asserts the
`?? "trading"` form in **both** copies, because a conditional requirement that differs
between the apps is a validation rule that depends on which process saved the document.

**The general rule: narrowing a required field is a change to the OTHER game's contract.**
The instinct is to read this as "provider games do not need starting capital". What it
actually does is move a guarantee trading relies on from the schema into a predicate, and
the predicate is now the only thing standing between a trading contest and a missing
capital figure.

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
- `{ contestId: 1, userId: 1 }` unique, **partial** - one LIVE round per player per contest.
  Added in X3; see below
- `{ status: 1, expiresAt: 1 }` - drives the reconciliation job
- `{ userId: 1, createdAt: -1 }` - player history
- `{ providerKey: 1, gameCode: 1, createdAt: -1 }` - provider reporting

> **`configSnapshot` matters more than it looks.** If an admin edits a game's
> settings mid-contest, or the provider changes a default, historical rounds must
> still be explainable. Storing the exact configuration used is what lets us answer
> "why did I score differently from them" months later.

#### Added in X3, 4 September 2026 - two gaps this table left open

**1. The partial unique index, because the documented one did not enforce the rule it was
credited with.** `03` section 1.3 states "one live round at a time, per player per contest"
and `07` section 4 says it is *"enforced in the database"* - citing
`{ contestId, userId, attemptNumber }`. That index does not enforce it. Attempt 1 `launched`
beside attempt 2 `launched` satisfies it perfectly, and that is precisely the
abandon-and-peek exploit the rule exists to stop. The general lesson is worth more than the
fix: **a claim that a rule is enforced by an index is a hypothesis until you name the index
and check what it actually excludes.**

```
{ contestId: 1, userId: 1 }
  unique: true
  partialFilterExpression: {
    contestId: { $type: "objectId" },
    status: { $in: ["pending", "launched"] }
  }
```

Two details that are easy to get wrong. The `contestId` clause scopes the index to real
contests - practice rounds carry a null `contestId`, so without it every practice round
would collide with the player's previous one. And it is a **`$type` check rather than
`$ne: null`** because MongoDB does not permit `$ne` inside a `partialFilterExpression`;
writing the obvious thing fails at index build time with an error that does not mention the
restriction.

**2. A transition table, because seven statuses with no stated rules means every call site
invents its own.** Declared as `ROUND_TRANSITIONS` in the model:

| From | May become |
|---|---|
| `pending` | `launched`, `expired`, `voided` |
| `launched` | `completed`, `abandoned`, `expired`, `voided`, `unresolved` |
| `unresolved` | `completed`, `abandoned`, `expired`, `voided` |
| `completed`, `abandoned`, `expired`, `voided` | **nothing** |

**A terminal round is never reopened.** The score that was ranked has to stay the score that
is stored, so a late or conflicting result is recorded on the document
(`lateResultRecordedAt`, `conflictFlaggedAt`, both added in X3) instead of moving the status
back. `unresolved` is the single terminal state that can still move, and only to a real
result: stages 2 and 3 of the reconciliation net can pull a score for a round the policy
already gave up on, and honouring it beats keeping a zero we know is wrong. It can never
return to `launched`.

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

#### Added in X3, 4 September 2026

**`processingResult` is an enum, not free text.** Twelve values, in
`EVENT_PROCESSING_RESULTS`: `scored`, `duplicate_ignored`, `signature_invalid`,
`timestamp_rejected`, `provider_unknown`, `round_not_found`, `round_not_acceptable`,
`score_out_of_range`, `conflict_flagged`, `late_recorded_not_applied`, `unparseable`,
`error`. Reason: these are what an operator filters the round inspector by (`12`) and what
an alert rule keys off, and free-text outcomes drift into near-synonyms until the filter
silently stops matching some of them.

**Two indexes beyond the unique `eventId`.** `{ roundId, receivedAt }`, because the inspector
opens from a round and because **unmatched events - `roundId` absent - are exactly what an
operator hunts for after a provider changes an id format**. And
`{ providerKey, receivedAt }` for the retention trim and the per-provider feed.

**A REJECTED EVENT IS STILL STORED, and this is the part most likely to be "optimised" away
later.** A row with `signatureValid: false` is the record of an attack or a
misconfiguration. Skipping the write for events that fail verification looks like an obvious
saving and destroys the only trace of the one case you will be asked about. Pinned by a test
that sends a wrong HMAC, a stale timestamp and an unknown round, and asserts all three are
stored with their exact raw body.

**One thing this table cannot express: the event id must come from the header, not the
body.** Reading it from an unverified body would let a forged payload choose its own
deduplication key, and therefore replay a genuine score under a fresh id - defeating the
unique index entirely. The body is a fallback for providers that only carry it there, and by
then the signature has passed. An event with **no** id at all is refused *before* storage,
because an id we invented cannot deduplicate anything, so the provider's retry would look
like a new event and score twice.

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
