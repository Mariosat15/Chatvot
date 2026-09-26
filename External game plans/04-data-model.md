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
| `roundStartPolicy` | string | **Added 7 September 2026, `12` s2.7.** `reserve_full_round` \| `until_window_closes` - how late a player may start an attempt. **Competition and Challenge read an ABSENT value differently and that is deliberate**: a competition's schema defaults to `reserve_full_round`, because a pre-existing contest must keep the rule its entrants signed up under; a challenge has no operator, no schema default and no pre-flight refusing a too-short window, so absent means **permissive** there. See the challenge note below and **R73** |
| `playMode` | string | **Added 9 September 2026, task 11.** `anytime` \| `scheduled`, no default. **The shape THIS contest was created as**, which from task 11 onwards is not necessarily its title's - a title may support both. Read through `resolveContestPlayMode`, which falls back to the title for a contest created before the field existed. **Frozen once written**: absent from `EditProviderContestInput`, absent from `toEditRequestBody`, and named in `NEVER_EDITABLE_FIELDS`, because it decides when entry closes and how many attempts a paying entrant gets. See `22` s10 |

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

**BUILT ON `Challenge` 13 September 2026, and the differences from the table above are the
interesting part.** Both copies of `Challenge` now carry `gameType`, `gameKey`, `gameConfig`,
`contentSeed`, `attemptsPolicy`, `attemptsAllowed` and `roundStartPolicy`, all optional, with
`gameConfig` being absent *itself* the statement that this is not a provider challenge. Three
fields on the competition table are deliberately **not** there:

- **No `playWindowStart` / `playWindowEnd`.** A challenge's play window *is* `[startTime,
  endTime]`, both already stored and both set once, at acceptance, so `deriveChallengeWindow` in
  `challenge-window.ts` (mirrored) derives the round window from them. Storing a second pair is
  two sources of truth for "when may this be played" that a later edit can let disagree.
- **No `unresolvedRoundPolicy` and no `resultGracePeriodSeconds`.** A challenge is two players and
  settles on the pair, so the three-way competition policy has no meaning here.
- **`roundStartPolicy` reads its absence the other way round**, as the row above says. New
  challenges store `CHALLENGE_ROUND_START_POLICY` (`until_window_closes`) rather than relying on
  the absence, and the model comment asserting the competition's reading was **corrected in place
  rather than retensed**, because that sentence was believed for six days and is why **R73**
  made every short provider challenge unplayable.

**ALSO BUILT ON `Challenge`, 14 September 2026 - the open-challenge fields.** `openToAnyone`
is a `Boolean` defaulting to `false`, and `challengedId` / `challengedName` /
`challengedEmail` became **conditionally required** on both copies, the predicate being
`this.openToAnyone !== true`. Four facts drift easily. The predicate is **not** a drop to
`required: false`: a *directed* challenge with no opponent is still a bug and the schema is
the only thing that catches it. **Both copies must carry the same predicate body** -
`check:mirrors` compares field paths and enum values and **not** predicate bodies, so a
conditional requirement that differs between the apps is a validation rule whose outcome
depends on which process saved the document, with the guard staying green; a byte-comparison
test pins them. `openToAnyone` **stays true after the seat is claimed**, so it is not a
"is this joinable" flag and a reader wanting that question must ask whether `challengedId`
is empty as well - `isUnclaimedOpenChallenge` in `lib/utils/open-challenge.ts` is the one
answer. And there is **no `OpenChallenge` collection**, which reverses the recommendation in
`03` s2.4 point 1 - see `03` **s2.4a** for why. One index was added,
`{ openToAnyone: 1, status: 1, createdAt: -1 }`, for the discovery list.

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
| `gameProviderCredentials` | **Four credentials per provider, in two pairs, and the pairing is load-bearing.** `apiKey` and `apiSecret` are issued to us **by** the provider and travel outbound; `callbackToken` and `callbackSecret` are issued **by us** to them and travel inbound - the token authenticates the request, the secret signs the body. Plus `previousCallbackSecret` and `rotatedAt` for the rotation window. **Never returned to the client** - the admin screen gets presence booleans. `callbackToken` was added 6 Sep 2026 to close **R34**: without it the platform compared a provider's inbound bearer against the API key they had issued us, so a provider implementing the published spec was refused and logged as a suspected attack |
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
| `displayName`, `description`, `tagline`, `rulesSummary`, `howToPlay`, `thumbnailUrl`, `bannerUrl`, `category` | Presentation. **All of these are required of the provider** by `01` s3.1, and all sit in **`firstSyncOnlyFields`** - seeded from the provider on the first sync and the operator's thereafter, so an operator can fix grammar, tone or language and no later sync reverts the edit. That is the opposite treatment to `scoreDirection` or `playMode` beside them, which are the provider's statements about how their own game works. **Four of them were discarded on every sync until 10 September 2026** (`rulesSummary` and `howToPlay` did not exist and were not on `ProviderCatalogueGame`; `tagline` and `bannerUrl` existed and were in neither sync allow-list) - see **R63**. `highlights` is the one presentation field that is genuinely operator-only, being in no contract at all |
| `howToPlayImageUrl`, `highlightsImageUrl` | The arena's two illustrations, beside the rules panel and the highlight cards (owner, 11 September 2026). **Ours rather than the provider's**, which is what separates them from the row above: a logo and a hero banner identify a provider's title, these two illustrate **our** panels at our size. So they are in **no sync allow-list at all** - not even `firstSyncOnlyFields` - no provider is asked for them and the requirements document is unchanged. Both optional and normally **absent**: no title carries either, so each panel draws a recreated emblem instead, which makes an unset value a different look rather than a gap. Neither may become required |
| `heroFeatures` | `{ icon, label }[]`, **no default**, capped at four. The small claims across the middle of the arena's hero banner (owner, 11 September 2026). **Ours**, so in no sync allow-list at all, the requirements document is unchanged and there is no version to bump - same standing as the two illustrations above. **An unset field means the four are DERIVED, never that none are shown**: nothing carries authored features, so the opposite reading would strip four facts off every hero silently, and `game-content.service.ts` already `$unset`s an empty array so clearing the list restores them. `icon` is a **`String` and deliberately not an enum** - a missing enum value rejects the whole write, so a slug we have not foreseen would cost the entire catalogue row on a sync - and an unrecognised one draws a neutral mark with its label intact. Read only through `resolveHeroFeatures` in `components/games/arena/arena-facts.ts`, with the vocabulary in the mirrored, model-free `lib/services/games/hero-features.ts`. On `EDITABLE_CONTENT_FIELDS` and barred from the assistant, because each slot is a **fact position** the platform otherwise fills from the round ceiling, the declared family and the contest's player range. See `13` s4.1x |
| `family` | `independent` \| `head_to_head`. Does the game need an **opponent**? Read only as a fallback by `resolvePlayMode` and rendered as a badge - nothing else branches on it |
| `playMode` | `anytime` \| `scheduled`, defaulting to `anytime`. Does everybody play at **one appointed moment**? A **different axis from `family`** - a race is `independent` and `scheduled`. Provider-owned, rewritten by every catalogue sync, and on `NEVER_EDITABLE_CONTENT_FIELDS`. Resolved by `lib/services/games/play-shape.ts`, never read raw. See `22` s8 |
| `playModeOverride` | `anytime` \| `scheduled`, **with no default** - absent means we have taken no decision and the provider's `playMode` stands. **Ours, not the provider's**, and it is a second field precisely because `playMode` is in `providerOwnedFields` and would be reverted by the next sync. Written only by `game-play-style.service.ts`; **cleared with `$unset`, never `""`**, since an empty string read literally would mask a provider's `scheduled` declaration. Also on `NEVER_EDITABLE_CONTENT_FIELDS`. `head_to_head` beats it. See `22` s9 |
| `supportedPlayModes` | `("anytime" \| "scheduled")[]`, **with no default**, for the same reason as `playModeOverride` - a schema default *is* a stored value, and one here would opt the whole catalogue into a per-contest picker nobody asked for. Which shapes a contest on this title may be **created as** (task 11), so a title can offer both a synchronised race and an async time trial. **Read through `resolveSupportedPlayModes`, never raw**: it unions the resolved default in, because a title's own declared style must not be unselectable and every contest already created on the title was created as it, and it returns `["scheduled"]` alone for a `head_to_head` title. Ours, not the provider's, and on `NEVER_EDITABLE_CONTENT_FIELDS`. See `22` s10 |
| `challengeDefaults` | `{ durationMinutes?, roundStartPolicy?, settings? }`, **with no default** - absent means the platform's own answers apply, which is a different stored fact from an operator having chosen them. What a player's challenge form opens **pre-filled** with (owner request, 13 Sep 2026). **Ours, not the provider's**, so it is in **no** sync allow-list at all, not even `firstSyncOnlyFields`, and it is on `NEVER_EDITABLE_CONTENT_FIELDS`. Written only by `challenge-defaults.service.ts`; **cleared with `$unset`, never `{}`**. **Read through `resolveChallengeDefaults`, never raw** - it clamps the length to the platform bounds and drops a stored setting the `configSchema` has since stopped accepting, so it can never take the challenge dialog down for a title that is otherwise playable. The strict writer **refuses** a `reserve_full_round` default the title cannot honour, which is what stops the control recreating R73. See `12` s4.2d |
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
| `rawScore`, `scoreBreakdown` | As reported. **`scoreBreakdown` has two writers** - the result callback, and the optional mid-round progress report (`01` s5.5). `rawScore` has one, for ever |
| `progressAt` | When a progress report last replaced `scoreBreakdown`. **Absent means no progress reports, never "reported long ago"** - every round predating 11 Sep 2026 and every round from a provider that does not send them. Stored rather than derived from `updatedAt`, which moves for any write at all and so cannot answer whether a player's game has gone quiet |
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

### 3.6 `user_game_stats` - the cross-game standing

**Added 16 September 2026, at the start of X7, and the reason it is being added rather than
cross-referenced is a documentation defect worth stating.** `13` sections 7.1 and 7.3 both
name `UserGameStats` as the **single** source for the leaderboard and the profile, and both
cite **this chapter** for it. This chapter never carried it. The specification lives in
`New games plan/04-scoring-points-leaderboards.md`, which belongs to the programme that is
**not** being delivered - so X7's foundation collection was cited to a chapter that had no
row for it, in the chapter that carries the mirror rule. **The paired-document rule fired in
the direction it usually does: the restatement was right about the design and wrong about
where it lived.** Verified by grep before writing this, not assumed.

One document per user per game, **materialised at settlement and never computed on read.**

| Field | Type | Note |
|---|---|---|
| `userId` | `String` | ObjectId-shaped, as everywhere else |
| `gameKey` | `String` | The game this row is about, or the literal `"_overall"` for the cross-game rollup. **`gameKey`, not `gameType`** - `New games plan/04` says `gameType`, and this chapter's own invariant is that `gameKey` is the immutable join key for every historical statistic, so the rollup must key on the same thing every other row does |
| `contestsEntered` | `Number` | |
| `contestsCompleted` | `Number` | |
| `wins` | `Number` | |
| `podiums` | `Number` | |
| `totalPoints` | `Number` | Lifetime sum of the normalised points of `05` section 3 |
| `seasonPoints` | `Number` | Resets per season |
| `rating` | `Number` | Per-game skill rating, 1200 start. **Never aggregated across games** - `05` section 4 |
| `bestRank` | `Number` | |
| `bestScore` | `Number` | Raw, in that game's own units, never negated - `05` s2 |
| `currentStreak` | `Number` | |
| `lastPlayedAt` | `Date` | |
| `extra` | `Mixed` | Per-game additions, e.g. trading's profit factor. Keeps a game's own metrics out of the shared shape |

Unique index on `{ userId, gameKey }`. Secondary indexes on `{ gameKey, totalPoints: -1 }`
and `{ gameKey, rating: -1 }`, so a leaderboard page is served from an index rather than by
the nine-term rebuild `13` s7.1 measures at about seven seconds.

**Four rules, each of which exists because the alternative fails without erroring:**

- **Totals accumulate on settlement; nothing recomputes them on read.** This is invariant 8
  of `11` and risk **R29**. Summing over *currently enabled* games is the natural
  implementation, reads correctly, passes review, and retroactively subtracts everything a
  player earned in a game an operator later switched off.
- **`"_overall"` is a stored row, not a query.** Same reason. It is also why question 13's
  answer matters to this table: with one headline figure, that row is read on every
  leaderboard and profile request.
- **No row is created for a game the player has not played.** `13` s7.2 hides never-played
  games, and an external-only catalogue may carry twenty titles.
- **Nothing is backfilled into it.** Owner decision on question 14, 16 September 2026: the
  cross-game aggregates start at zero. Trading's history stays in `TradeHistory` and in the
  trading card, which is where it is correctly scoped. `18`'s migration writes no rows here.

> **BUILT 16 September 2026 — X7 step 1 (collection + ONE writer).**
> Live code: `database/models/games/user-game-stats.model.ts` (mirrored),
> `lib/services/games/normalized-points.ts` (mirrored),
> `lib/services/games/user-game-stats.service.ts` (`recordContestFinish`, mirrored),
> called from `awardContestRewards` in both apps after money has committed. All six
> finalize paths pass `fieldSize` and `entryFee`. 10 + 10 + 33 tests;
> `tools/probe-user-game-stats.ps1` (6 probes, each red on exactly one failure).
>
> **X7 step 2 BUILT the same day — leaderboard reader (R14 parallel period).**
> Live code: `lib/services/games/game-leaderboard.service.ts` (main-app only),
> `GET /api/leaderboard?source=stats&gameKey=…`, `GameLeaderboardTable.tsx`,
> tabs on `LeaderboardClient.tsx`. Default tab remains **Trading (current)** = legacy
> rebuild; Overall / per-game tabs read `UserGameStats`. Diff tool:
> `tools/games/diff-leaderboard-top100.ts` + `diffTop100WithLegacy()`. 8 tests,
> `tools/probe-game-leaderboard.ps1` (6 probes RED×1). **Not switched as default** —
> question 14 means the stats board starts empty. Steps 3–5 still outstanding.
> **Nothing was backfilled.**

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
