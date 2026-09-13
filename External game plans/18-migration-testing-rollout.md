# 18 - Migration, Testing, Rollout and Rollback

Every schema change in this programme is **additive**. Nothing is dropped, nothing is
renamed. That is what makes each phase individually reversible.

---

## 1. Data migration

Five backfills, all idempotent, all safe to re-run.

| # | Backfill | Collections | When |
|---|---|---|---|
| 1 | Set the game label to `"trading"` on every existing contest and participant | `Competition`, `Challenge`, `CompetitionParticipant`, `ChallengeParticipant` | **BUILT 4 Sep 2026** |
| 2 | Populate `score` on participants from their contest's ranking method | participants | **DEFERRED to seam 2** - see below |
| 3 | Default `BadgeConfig.gameTypes` to `["trading"]` | `BadgeConfig` | **BUILT 4 Sep 2026** |
| 4 | Build `UserGameStats` rows, including the `"_overall"` rollup | new | X7 |
| 5 | Seed **inferred** `UserGamePreference` rows from `UserGameStats` play counts | new | X11.5 |

**Skip the `score` backfill for completed contests.** Their `finalLeaderboard` is already
stored and authoritative; recomputing historical scores risks changing a published result
for no benefit.

### Backfills 1 and 3 are built - `tools/games/backfill-game-labels.ts`

Report-only by default; `--apply` writes. Proven by 13 tests against a real MongoDB in
`__tests__/services/backfill-game-labels.test.ts`. **Not yet run against production.**

Four things about it are worth knowing before running it.

**It never overwrites a label that exists**, and that is the single most important property
rather than a nicety. `gameKey` is immutable because it is the join key for every
historical stat, so a backfill that *can* rewrite it is a script that can destroy history
silently. Pinned by a test that seeds a `provider` / `chess-blitz` contest and asserts it
comes out untouched; probed by widening the filter, which turned 3 red.

**"Unlabelled" has three shapes, not one.** Absent is the pre-X1 document, `null` is what
some older writers stored, and `""` is what an empty form field produces. A filter matching
only `$exists: false` leaves the other two behind - and those are the two that look correct
in a document dump. Each clause is probed separately; dropping either turns 1 red.

**Each field is filtered independently, not as one `$or` over both.** A row with `gameType`
set and `gameKey` missing is exactly what an interrupted earlier run leaves behind, and a
combined filter would either skip it or rewrite the field that was already correct.

**An empty `gameTypes` array counts as configured and is left alone.** On `BadgeConfig` an
empty array means "every game", which is a legitimate operator choice; overwriting it with
`["trading"]` would silently narrow a badge somebody deliberately made universal.

One thing the script does *not* carry its own copy of: the string `"trading"`. It imports
`TRADING_GAME_TYPE`, and a test asserts the value it writes equals what `contestGameLabel()`
produces. Two sources for that string is one too many - if the app's default ever changed, a
backfill with its own literal would relabel history to a value nothing else uses, and every
row would look correctly labelled.

### Why backfill 2 was deferred rather than written

Chapter 18 already said to skip completed contests, because their `finalLeaderboard` is
stored and authoritative. **The same reasoning extends to active contests, which is what
changed the decision.** Trading ranks on its own six metrics and never reads `score`, and
**seam 2 - the thing that would keep `score` current during play - is not built.** Writing
it now produces a number nothing maintains and nothing reads, which goes stale immediately
while looking authoritative.

The schema default of `0` means nothing crashes in the meantime. It belongs with seam 2, and
`04`'s participant model is where the field is already declared.

### Backfill 4 has an unanswered product question in front of it

**Open question 14, and it must be answered before the backfill is written**, because it
is written once and it is visible to every existing player.

> Does historical **trading** performance enter the new cross-game aggregates, or do they
> start at zero?

Both answers are defensible and both have a cost:

| Answer | Cost |
|---|---|
| Backfill it | Long-standing traders instantly dominate every cross-game rollup and leaderboard on a platform whose point is that trading is one game among several |
| Start at zero | Existing players appear to lose their history. It will be reported as a bug, it will generate support load, and they will not be wrong to complain |

There is a third option worth putting in front of the owner rather than choosing here:
**backfill the per-game trading row but not the `"_overall"` rollup**, so history is
visibly preserved where it belongs and the cross-game ranking starts fair. It costs one
extra condition in the backfill.

Whichever is chosen, **the parallel leaderboard diff in rollout step 8 is what catches
getting it wrong**, and R14 - players read rank changes as unfair - is why that step is
not optional.

### Backfill 5 is a seed, not a declaration

`UserGamePreference` rows written by backfill 5 must carry `interestLevel: "inferred"`.
Two consequences, and the second is the one that would be a live defect:

- A row written as `declared` would be indistinguishable from a player's own answer, and
  section 3.2 of `20` says a declaration is never overwritten by an inference. The backfill
  would permanently pin a guess as a stated preference.
- **An inferred row must not by itself make a player challengeable by strangers.** Paying
  to enter a competition is not consent to receive 1v1 invitations. `20` section 3.2.

This is the same distinction that made `canEnterChallenges` a live defect in Stage 0: a
stored value and an absent one are different facts, and a backfill that erases the
difference is not recoverable.

### The rolling-deploy hazard

During a deploy, old code may still be writing contests without a game label - including
`app/api/gamemaster/competitions/route.ts`, which uses the raw driver and gets no Mongoose
default (**R7**).

**Every reader must treat a missing game label as `"trading"`.** Do this from the first
commit of X1, not as a later hardening pass.

### Provider data has nothing to migrate

`game_provider`, `provider_game`, `game_round`, `provider_event`,
`provider_health_check` and `GameCatalogueEntry` are all new. There is no historical
provider data, which removes an entire class of migration risk from this programme.

### Retention

| Collection | Retention |
|---|---|
| `game_round` | Keep indefinitely. It is the evidence behind every prize paid |
| `provider_event` | 90 days of raw payloads is enough for dispute handling; archive or trim beyond that |
| `provider_health_check` | 30 days |

---

## 2. The mirror-drift CI check

**Delivered 1 September 2026** as part of Stage 0 Defect 2. `tools/model-mirror/` compares
each of the **75** mirrored model files against its `apps/admin` counterpart and **fails the
build on divergence**. Run with `npm run check:mirrors`, or `npm run check:mirrors:list` for
the full report.

It lives in `tools/`, not `scripts/`, because `.cursorignore` excludes `scripts/` - which
would make the guard unreadable to AI sessions expected to maintain it.

Counts confirmed on 1 September 2026: 98 models in the main app, 89 in the admin app, 75
mirrored in both, 38 byte-identical, and **11 with real schema drift**. It compares **enum
values as well as field names**, because a missing enum value **fails the write** rather
than merely dropping a field - `platform-financials.model.ts` drifted in both directions
this way.

Requirements that turned out to matter:

- **Parse the AST, not a regex.** A regex over `field: {` misses nested paths, array
  subdocuments and the `type: { ... }` subdocument form, all of which this codebase uses.
  Getting any of those wrong means the guard either misses real drift or blocks commits on
  imaginary drift.
- **An allowlist of intentional differences.** `admin.model.ts` legitimately carries 26
  admin-only staff fields. A guard that flags those is noise, and a noisy guard gets
  disabled. In practice the allowlist needed exactly **one** entry -
  `withdrawal-request.model.ts` had been expected to need one too, but its difference turned
  out to be a live bug rather than a decision.
- **Do not cry wolf.** Comments, key order, whitespace, differing `default` / `required` /
  `index` values and reordered enum values must all pass silently. Four of the guard's 12
  tests exist for this alone.
- **Add-only when syncing.** Removing an enum value to "make them match" orphans every
  document already carrying it.

Special case, now closed: there were **112 committed declaration files** (57 `.d.ts` + 55
`.d.ts.map`) - not the two originally recorded, and not the 31 + 31 recorded at the first
re-verification, which had searched only `database/` and missed 26 files under `lib/`. All
were stale **orphaned build output**: each carried a `sourceMappingURL`, `tsconfig.json` is
`noEmit` so nothing regenerated them, and TypeScript resolves the sibling `.ts` first, so
they were inert. **All 112 were deleted on 1 September 2026** with owner approval, plus a
`.gitignore` rule. Typecheck was identical before and after (16 errors main, 225 admin).

Two were kept, and the rule is the reusable part: delete a `.d.ts` only if a sibling `.ts`
exists and it is not under `dist/`. The sibling `.ts` is what proves the file is a redundant
copy rather than a declaration in its own right. That kept `types/global.d.ts` (hand-written)
and `websocket-server/dist/index.d.ts` (separate build).

**Do not treat declaration files as a third copy of the models to maintain.** Updating them
by hand was explicitly rejected - it would have created exactly the disease this chapter is
about.

Out of scope but worth recording: 19 action files and 51 service files are duplicated the
same way, and the money-critical ones have diverged badly (`competition-end.actions.ts` is
72 KB against 38 KB). A field-comparison script cannot help there.

The guard runs in CI as its own step and in a new `.husky/pre-push` hook. The existing
husky **pre-commit** hook runs `lint-staged` only.

Without this check, **R2 recurs**. It has already happened once.

---

## 3. Test plan

Extends the `vitest` suite and the GitHub Actions workflow already in the repository.

### Tier 1 - money integrity (X0, and never removed)

The eight tests that gate everything else:

1. **20 concurrent joins** - prize pool, participant count and wallet balances all agree
2. **Insufficient balance** - no partial state, no orphaned participant row
3. **Full payout** - credits paid plus platform fee equals the pool, to the cent
4. **Tie payout** - all three tie-handling modes
5. **Zero qualified winners** - pool moves to the unclaimed pool
6. **Cancel and refund** - every participant refunded whole, `prizePool` zeroed
7. **Double finalization** - paid exactly once
8. **Game Master share caps** - respected at the boundary

### Tier 2 - trading regression (X1)

- Recompute historical completed competitions through the new module path and compare
  against the stored `finalLeaderboard`. **Identical or the extraction is wrong**
- All 16 `placeOrder` guards still fire, in order

### Tier 3 - game abstraction (X1)

- Registry resolves each module; an unknown game type returns a result object rather than
  throwing
- A contest with a missing game label reads as trading
- Trading settle path aborts on a non-trading contest
- Finalization dispatches inside the four finalize functions, covering all **ten** main-app call sites (the "five" here was wrong; `11` s2 seam 3 has the re-counted list)

### Tier 4 - provider integration (X2, X3)

Run entirely against the **mock adapter**, which is why X2 comes first.

| Case | Expected |
|---|---|
| Lost callback | Reconciliation resolves it via the pull endpoint |
| Duplicate callback | Second is ignored; one score, one ledger effect |
| Bad signature | Rejected, logged, alerted; no score written |
| Replayed old event | Rejected on timestamp and event ID |
| Score outside declared range | Rejected as a safety check |
| Conflicting scores for one round | First wins; conflict flagged for review |
| Result arriving after settlement | Handled by the unresolved policy, not silently dropped |
| Round never reports | Four-stage safety net completes; contest settles |
| Same content seed, two players | **Byte-identical content** |
| `lower_is_better` game | Ranked correctly, not backwards |
| Attempts policy `single` | Second round creation refused |

### Tier 5 - flags and infrastructure (X8)

- `tradingEnabled = false`: every layer in `15` section 2 behaves
- Price streamer does **not** initialise - asserted from logs
- A trading contest active when the flag flips still finalises
- A forex holiday does not block a provider contest

### Tier 6 - cross-app integrity (X12)

- A contest written by the main app, saved by the admin app, **retains** its game label and
  game config
- Every new field present in both model copies

### Tier 7 - load (X12)

- A **500-player** provider contest: round creation, callback ingestion, live leaderboard,
  settlement
- Callback storm: many results arriving within a few seconds
- Use `$inc` for counters; the Performance Simulator admin section exists for this

### Tier 8 - contract (X4 onward)

Record real sandbox responses and replay them in CI. **A provider changing their API is
then caught by a failing build rather than by players mid-contest.** This tier is specific
to the external scenario and is the cheapest insurance in the plan.

---

## 4. Rollout sequence

| Step | Action | Player-visible? |
|---|---|---|
| 0 | **X0** complete, owner sign-off recorded | No |
| 1 | Schema additions and backfills 1 and 3 | No |
| 2 | Registry plus trading module wrap. Tier 2 green in staging | No |
| 3 | Provider abstraction, mock adapter, round lifecycle. Tier 4 green | No |
| 4 | Real adapter against sandbox. `externalGamesEnabled = false` | No |
| 5 | Admin screens. Internal-only provider contest, **free entry** | No |
| 6 | Internal provider contests with **real small entry fees** | No |
| 7 | Public launch: one game, low or free entry, capped concurrency | **Yes** |
| 8 | `UserGameStats` and backfill 4. Parallel leaderboard diff on the top 100 | No |
| 9 | Switch the leaderboard; announce the model | **Yes** |
| 10 | Terminology and UI de-trading | **Yes** |
| 11 | Games catalogue and `/games` routes | **Yes** |
| 12 | Backfill 5, then **inferred** matchmaking suggestions only - no stranger invitations | **Yes** |
| 13 | Per-game interest declaration, opponent picker, open challenges | **Yes** |
| 14 | `tradingEnabled` flag deployed as `true`; rehearse flipping it in staging only | No |

**Two additions on 2 September 2026, and step 5 changed meaning.** Step 5 now includes the
**admin navigation restructure and the admin wording pass** (X6, X6.5), which is where
admin-first shows up in the rollout: an operator works a de-trading-ised admin panel from
the first internal contest, not two phases later.

**Steps 12 and 13 are deliberately in that order.** Suggestions from inferred interest ship
before declarations and stranger invitations, for two reasons that pull the same way:
matchmaking that launches with nobody having declared anything returns nothing and gets
removed (risk **X18**), and shipping invitations first would mean the first thing players
experience is unsolicited contact from strangers (risk **X14**).

**Step 6 must not be skipped.** Real money in an internal contest surfaces problems that no
amount of free testing does - fee deduction, pool arithmetic, payout rounding, ledger
entries and the notification chain, all at once, with people who can be asked what they
saw.

**Step 12 deploys the switch without using it.** Never rehearse a trading shutdown in
production for the first time.

---

## 5. Rollback per phase

| Phase | Rollback |
|---|---|
| X0 entry consolidation | Revert the commit; **keep the tests** |
| X0 mirror sync and CI | Disable the guard; the fields are additive and harmless |
| X1 schema | Revert code; `$unset` the new fields if desired |
| X1 registry | Revert; settlement returns to `competition-end.actions.ts` |
| X2, X3 provider plumbing | Nothing player-visible exists yet |
| X4, X5 provider contests | `externalGamesEnabled = false`. Let running contests finish, or cancel and refund |
| One bad game | Per-game enable switch |
| One bad provider | Per-provider enable switch |
| X7 leaderboard | Flag back to the computed path |
| X8 terminology | Revert, or override via `WhiteLabel.terminologyOverrides` **with no deploy** |
| X8 `tradingEnabled` | Set back to `true` |
| X10 open challenges | Stop accepting new ones; existing `Challenge` rows are untouched, because `20` s6 keeps open challenges in a separate collection rather than loosening `Challenge` |
| X11 catalogue | Hide the entries; `/competitions` is untouched |
| X11.5 matchmaking | Flag off suggestions. `UserGamePreference` rows are additive and harmless; **do not delete declared rows** on rollback - they are player intent, and re-collecting them is not free |

Every rollback above is either a flag flip or a revert of an additive change. **There is no
point in this programme where rollback requires a data migration**, and that is a design
constraint worth protecting in review.

---

## 6. Definition of done

- [ ] An admin can create, run, monitor, pause, extend, cancel and re-settle a provider
      contest **without a developer**
- [ ] Provider prizes are paid by **exactly the same money code** as trading prizes -
      no parallel payout path exists
- [ ] Trading is unchanged, proven by Tier 2
- [ ] `tradingEnabled = false` produces a coherent product with no dead links
- [ ] Points, badges, levels, journeys and leaderboards work for provider games
- [ ] Financial reporting shows entry-fee volume, revenue and payout ratio **by game and by
      provider**, including provider cost
- [ ] Support can explain any score from stored evidence alone
- [ ] Zero unresolved rounds and zero payout discrepancies across the entire pilot
- [ ] Every model change present and identical in **both** apps, enforced by CI
- [ ] Adding a second provider is one folder plus one registry entry - **confirmed by
      writing the second adapter's skeleton**, even if unused
- [ ] Rollback tested: disable provider games and confirm the platform behaves exactly as it
      does today
- [ ] **No player-visible or operator-visible aggregate is a platform-wide label over a
      trading-only calculation** - `05` section 10. Checked on the dashboard, the profile,
      the leaderboard and the admin financial screens, not asserted
- [ ] An operator can administer a provider contest end to end **without reading the word
      "trading"** outside the Trading section
- [ ] Matchmaking returns opponents for a **non-trading** game, proven by a test that
      fails against the current trading-only `matchmaking.service.ts`
- [ ] A player who declared nothing still receives useful suggestions, and receives **no**
      stranger invitation without an explicit opt-in
