# 13 - Migration, Testing, Rollout and Rollback

---

## 1. Data migration

Because every schema change in `03` is **additive**, there is no destructive migration. Only optional backfills for query convenience.

### Backfill 1 - `gameType` on existing contests (optional but recommended)

```
Competition.updateMany({ gameType: { $exists: false } }, { $set: { gameType: "trading" } })
Challenge.updateMany({ gameType: { $exists: false } }, { $set: { gameType: "trading" } })
CompetitionParticipant.updateMany({ gameType: { $exists: false } }, { $set: { gameType: "trading" } })
ChallengeParticipant.updateMany({ gameType: { $exists: false } }, { $set: { gameType: "trading" } })
```

Safe: idempotent, no data loss, reversible with `$unset`. Run in batches on large collections.

Even after backfilling, readers must still treat missing `gameType` as `"trading"` - because of the raw-driver GM insert (risk R7) and any document created by an older deployment during a rolling release.

### Backfill 2 - `score` on existing participants

```
score = (the contest's configured rankingMethod value for that participant)
```

Only needed if historical contests should appear in the new score-sorted views. For completed contests, `currentRank` is already stored, so this is cosmetic. **Recommendation: skip for completed contests, populate only from the changeover forward.** Less risk, no benefit lost.

### Backfill 3 - `BadgeConfig.gameTypes`

```
BadgeConfig.updateMany({ gameTypes: { $exists: false } }, { $set: { gameTypes: ["trading"] } })
```

Then manually reclassify the genuinely generic badges to `[]` per `06` section 4.2. That reclassification is a judgement call per badge and should be done in the admin UI, reviewed, not scripted.

### Backfill 4 - `UserGameStats`

The only substantial one. Build from completed participants:

```
for each completed CompetitionParticipant / ChallengeParticipant:
    derive contestsEntered, contestsCompleted, wins (rank 1), podiums (rank <= 3)
    compute normalizedPoints from stored rank + participant count + entryFee
    accumulate totalPoints, bestRank, bestScore
    replay rating updates in chronological order
  upsert UserGameStats { userId, gameType }
  then build the "_overall" rollup per user
```

Notes:
- Run as an **offline script**, not a migration on boot. It reads a lot.
- Must be **idempotent and re-runnable** - expect to run it several times while tuning the points constants.
- Rating replay must be chronological or ratings will differ between runs.
- Exclude cancelled/refunded contests entirely.
- Verify: total points and win counts should reconcile against the existing leaderboard's win/podium counts. Any large divergence means a bug in the derivation, not in the old leaderboard.

### Rollback

Every backfill is reversible: `$unset` the added fields, or drop `UserGameStats`. Since no existing field is modified or removed, rolling back the code alone restores previous behaviour even with the new fields present - they are simply ignored.

---

## 2. Mirror-drift CI check

Highest value-per-line item in the whole plan. Prevents risk R2 permanently.

**Delivered 1 September 2026** in Stage 0, as `tools/model-mirror/`. Run with
`npm run check:mirrors`, or `npm run check:mirrors:list` for the full report.

```
tools/model-mirror/
  parse-schema.ts   extract field paths and enum values from the TypeScript AST
  compare.ts        discover mirrored pairs by walking both directories, then diff
  allowlist.ts      differences that are deliberate, each with a reason
  cli.ts            the build gate

For every pair present in both directories:
  extract field paths AND enum values from each side
  report anything present on one side only, unless the allowlist names it
  exit non-zero if anything remains
```

Three design points that were **not** obvious when this section was first written, and each
of which would have produced a useless guard:

- **The AST is required; a regex is not sufficient.** This section originally said "regex
  over schema definitions is sufficient - no AST needed". That is wrong. A regex over
  `field: {` misses nested paths, array subdocuments and the `type: { ... }` subdocument
  form, and this codebase uses all three. It would have missed the real
  `hero-settings.model.ts` drift entirely.
- **Enum values must be compared, not just field names.** A missing enum value **rejects
  the write**, which is the worst case, and a name-only comparison cannot see it.
- **The pair list must be derived, never seeded from a document.** A hand-maintained list
  goes stale exactly like the models it is watching. The earlier instruction to "seed the
  pair list from `01` section 11" would have frozen the guard at four pairs out of 75.

Runs in CI as its own step and in `.husky/pre-push`. The repo already used husky, but only
`pre-commit`, running `lint-staged`.

**Do not** treat the committed `.d.ts` files as declarations to keep in step. There are 31
of them, all stale orphaned build output, and TypeScript ignores them in favour of the
sibling `.ts`. See `00a` - they are pending deletion.

---

## 3. Test plan

### Tier 1 - money integrity (must exist before P1)

The eight tests from `05` section 7:

1. 20 concurrent joins: `prizePool == joins x entryFee`, `currentParticipants == joins`, no wallet drift
2. Insufficient balance: no partial state
3. Full payout: credits + platform fee == pool, exact to the cent
4. Tie payout under all three tie modes
5. Zero qualified winners: whole net pool to `unclaimed_pool`
6. Cancel and refund: every participant whole, `prizePool` zeroed
7. **Double finalization: winners paid once**
8. GM share: never exceeds platform fee; not paid when subscription inactive

### Tier 2 - trading regression (the safety proof for P1)

The single most important test in the project:

```
Take N historical completed competitions.
Recompute rankings through the NEW module-dispatched path.
Assert the resulting leaderboard is IDENTICAL to the stored finalLeaderboard.
```

If this passes for a broad sample across all six ranking methods and both tie-breaker positions, the refactor is behaviour-preserving. This converts "we think we did not break trading" into evidence.

Also: place an order and confirm all 16 guards still fire in order; confirm a trading contest finalizes identically.

### Tier 3 - game abstraction

- Registry returns the right module per `gameType`
- Unknown `gameType` degrades safely (falls back to `computeScore`, logs, does not crash)
- Missing `gameType` treated as trading
- `gameType` cannot be changed after participants exist
- Contest of a disabled game type cannot be created or entered
- Trading settle path **refuses** a non-trading contest (the R3 assertion)

### Tier 4 - Trivia

- Question selection respects category, difficulty mix, count
- Contest set is locked and identical for all participants
- Option shuffling differs per participant
- Correct answer is **never** present in any API response before the answer is submitted
- Scoring: base, speed bonus boundaries (instant, exactly at limit, over limit), streak cap
- Timeout scored as zero
- Idempotency: submitting the same answer twice scores once
- Expected-index guard blocks skipping ahead
- Refresh mid-question resumes with correctly reduced time
- Settlement idempotent: run twice, identical result
- Non-qualifier marked `forfeited` and excluded from prizes
- Joinable while the forex market is closed (risk R10)
- **No price request made during a Trivia session** (risk R18)

### Tier 5 - flags and infrastructure

- `tradingEnabled = false`: trading routes redirect, nav hides, order placement rejected, trading contest creation blocked
- `tradingEnabled = false` **with** an active trading contest: price feed still runs, contest finalizes correctly (risk R17)
- Price streamer skips init when trading disabled and no active trading contests
- Worker jobs filter correctly by game type
- Admin app still skips the streamer

### Tier 6 - cross-app integrity

- Write a Trivia contest from the main app, edit it in the admin, assert `gameType` and `gameConfig` survive (risk R2)
- Admin force-finalize on a Trivia contest uses the Trivia settle path

### Tier 7 - load

- 500-player Trivia contest: answer submission throughput, participant update contention (risk R25)
- Leaderboard read latency on `UserGameStats` vs the old computed path
- Reuse the existing Performance Simulator admin section

---

## 4. Rollout sequence

Every step is independently reversible.

| Step | Action | Visible to users? |
|---|---|---|
| 0 | **Deploy STAGE 0 (separate delivery): entry consolidation, mirror sync, mirror CI guard, money tests. OWNER TESTS AND SIGNS OFF before anything below starts.** | No |
| 2 | Deploy schema additions + backfills 1 and 3. Fields unused. | No |
| 3 | Deploy the registry + trading module wrapping existing behaviour. Tier 2 regression must pass in staging **and** production-shadow if possible. | No |
| 4 | Deploy Trivia module, admin sections, `/play` dispatcher. `enabledGameTypes = ["trading"]` still. | No |
| 5 | Seed the question bank. Enable Trivia for **internal accounts only** (an allowlist, or a `draft` contest visible to admins). | No |
| 6 | Run internal Trivia contests with real (small) entry fees. Verify money end to end. | No |
| 7 | Enable Trivia platform-wide with a **free or very low entry fee** first contest. | **Yes** |
| 8 | Deploy `UserGameStats` + backfill 4; run new and old leaderboards in parallel, diff top 100. | No |
| 9 | Switch the leaderboard to the new source. Announce the points/rating model. Consider starting a new season. | **Yes** |
| 10 | Deploy terminology passes and UI de-trading. | **Yes** |
| 11 | Ship `tradingEnabled` flag, still `true`. Rehearse toggling it in staging. | No |

Step 6 is the one not to skip. A Trivia contest with real money that has never been run with real money is an untested payment path.

---

## 5. Rollback plan per phase

| Phase | Rollback |
|---|---|
| Stage 0 entry consolidation | Revert the commit; both old paths return. Keep the tests. |
| Stage 0 mirror sync + CI guard | Guard can be disabled without touching application code; synced fields are additive and safe to leave in place. |
| P1 schema | Revert code; added fields are ignored. `$unset` only if desired. |
| P1 registry/trading module | Revert; the extracted settle code returns to `competition-end.actions.ts`. Keep the extraction as a pure move so the revert is clean. |
| P2 Trivia | Set `enabledGameTypes = ["trading"]`. Existing Trivia contests must be allowed to finish, or cancelled with refunds via the existing path. |
| P4 leaderboard | Flag back to the computed path; `UserGameStats` becomes inert. |
| P5 terminology | Revert; or override via `WhiteLabel.terminologyOverrides` **without a deploy** - a genuine advantage of the DB-override design. |
| P5 `tradingEnabled` | Set back to `true`. |

The terminology rollback being deploy-free is worth noting: wording is the change most likely to attract subjective objections, and being able to adjust it live removes that pressure from the release.

---

## 6. Definition of done

The project is complete when:

1. An admin creates, runs and finalizes a Trivia competition without touching a trading field.
2. A player pays credits, plays, is ranked, and is paid a prize through the **same** money code as trading.
3. A trading player's experience is **unchanged** - verified by the Tier 2 regression test, not by inspection.
4. `tradingEnabled = false` yields a coherent games-only platform with no dead links, no empty trading tiles, and no stranded contests.
5. Leaderboards, points, rating, XP, badges and journey all work for a Trivia-only player.
6. Admin can report GMV, fees and payout ratio **by game type**.
7. Adding a third game requires: one folder under `lib/games/`, one registry entry, one admin config component, plus content - and no edits to the contest engine, money layer or evaluation engines.

Point 7 is the real test of whether this was architecture or just a feature.
