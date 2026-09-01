# 18 - Migration, Testing, Rollout and Rollback

Every schema change in this programme is **additive**. Nothing is dropped, nothing is
renamed. That is what makes each phase individually reversible.

---

## 1. Data migration

Four backfills, all idempotent, all safe to re-run.

| # | Backfill | Collections | When |
|---|---|---|---|
| 1 | Set the game label to `"trading"` on every existing contest and participant | `Competition`, `Challenge`, `CompetitionParticipant`, `ChallengeParticipant` | X1 |
| 2 | Populate `score` on participants from their contest's ranking method | participants | X1 - **skip completed contests** |
| 3 | Default `BadgeConfig.gameTypes` to `["trading"]` | `BadgeConfig` | X1 |
| 4 | Build `UserGameStats` rows, including the `"_overall"` rollup | new | X7 |

**Skip the `score` backfill for completed contests.** Their `finalLeaderboard` is already
stored and authoritative; recomputing historical scores risks changing a published result
for no benefit.

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

`scripts/check-model-mirrors.ts` compares each of the **75** mirrored model files against
its `apps/admin` counterpart and **fails the build on divergence**. Delivered in X0.

Counts confirmed on 1 September 2026: 98 models in the main app, 89 in the admin app, 75
mirrored in both, 38 byte-identical, and **10 with real schema field drift**. It must
compare **enum values as well as field names** - `platform-financials.model.ts` drifts in
both directions, and a missing enum value fails the write rather than merely hiding a field.

Two requirements that are easy to miss:

- **An allowlist of intentional differences.** `admin.model.ts` legitimately carries 24
  admin-only RBAC fields and `withdrawal-request.model.ts` has admin-only fields. A guard
  that flags those is noise, and a noisy guard gets disabled.
- **Add-only when syncing.** Removing an enum value to "make them match" orphans every
  document already carrying it.

Special cases: `database/models/whitelabel.model.d.ts` and
`database/models/trading/wallet-transaction.model.d.ts` are hand-maintained third copies of
the same shapes and must be included. Both are currently stale.

Out of scope but worth recording: 19 action files and 51 service files are duplicated the
same way, and the money-critical ones have diverged badly (`competition-end.actions.ts` is
72 KB against 38 KB). A field-comparison script cannot help there.

The existing husky **pre-commit** hook runs `lint-staged` only; there is no `pre-push` hook
yet, so one must be added.

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
- All five finalization entry points dispatch

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
| 12 | `tradingEnabled` flag deployed as `true`; rehearse flipping it in staging only | No |

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
| X11 catalogue | Hide the entries; `/competitions` is untouched |

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
