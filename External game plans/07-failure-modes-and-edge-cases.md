# 07 - Failure Modes and Edge Cases

The integration depends on a third party we do not control, while real prize money
waits on their answers. This document covers what happens when they do not answer.

---

## 1. The governing principle

> **A provider failure must degrade the experience. It must never corrupt money.**

Acceptable outcomes: a contest is delayed, paused, extended, or cancelled with full
refunds. Unacceptable outcomes: prizes paid on incomplete scores, a player charged
for a round they could not play, a contest that can never settle, or two payouts for
one contest.

---

## 2. The worst failure - a round that never reports

This is the single most important scenario in the integration. A player played, the
contest is over, and we do not know their score. Everyone else's prize money is
blocked behind it.

### 2.1 The four-stage safety net

```
Stage 1  CALLBACK        Provider posts the result       -> normal path, ~99% of cases
Stage 2  POLL            Reconciliation job pulls        -> catches lost webhooks
Stage 3  FINAL SWEEP     Pull once more at grace end     -> last chance before settling
Stage 4  POLICY          Apply the unresolved policy     -> settle without it, and alert
```

### 2.2 The reconciliation job

Runs every minute against rounds that are launched but unresolved.

| Round age | Action |
|---|---|
| < 2 min past expected finish | Wait - the callback is probably in flight |
| 2-10 min | Poll `GET /v1/rounds/{roundId}` with backoff |
| Contest entering grace | Poll every attempt remaining, urgently |
| Grace expired | Apply the unresolved policy and raise a **critical** alert |

Polling is cheap and the failure it prevents is expensive. Poll generously.

### 2.3 The unresolved policy - an explicit per-contest choice

| Policy | Behaviour | Use when |
|---|---|---|
| `score_zero` | Unresolved round scores zero. Contest settles on time | **Default.** Most players finish; one straggler must not block everyone |
| `exclude` | Player removed from ranking and **refunded their entry fee** | Fairer to the affected player, slightly reduces the pot. Good for small, high-value contests |
| `hold_and_alert` | Settlement blocked until a human decides | High-value contests only. Requires someone actually watching |

The choice must be made when the contest is created, not improvised during an
incident. Whichever is chosen, the affected player is **notified explicitly** rather
than silently scored zero.

#### 2.3a BUILT, 4 September 2026 - and there were two gaps here, not one

All three policies are now honoured. Before this, **only `score_zero` worked, and it
worked because it asks settlement to do nothing.** The other two were written, tested at
the reconciliation layer, and consumed by nobody:

- `exclude` left the player **ranked and unrefunded**. Not merely unpaid - because
 `calculateRankings` does not filter on participant status at all, an excluded player
 could still be ranked and **paid a prize while also being owed their fee back**.
- `hold_and_alert` **settled on time and paid out**, exactly as though it were
 `score_zero`, while the policy the operator chose promises the opposite.

Only the first was recorded as an open obligation. The second was a genuine surprise, and
it is the fourth instance of the rule that a plan's count is a hypothesis: **check every
sibling of the thing you are fixing, not just the one a document named.**

**Where it lives.** `lib/services/settlement/unresolved-rounds.ts` reads the state and
`lib/services/settlement/exclusion-refund.ts` moves the money, both mirrored, both driven
from `provider-settlement.service.ts` inside the settlement transaction. Pinned by 15 tests
in `__tests__/services/provider-settlement.test.ts` and 2 in
`provider-settlement-late-hold.test.ts`, every guard probed.

Five things about the build that the table above cannot show:

- **Settlement does not read `refundOwed` or `blocksSettlement`, and must not.** They are
 return values in a worker process that has exited long before a contest settles, and
 nothing persists them. Settlement re-derives both from the one thing stage 4 *writes* -
 `round.status = "unresolved"`. That also means a contest settled by a path the net never
 drove (the lazy auto-finalize, a manual admin trigger) honours the policy anyway; a
 parameter would have made those paths silently skip it.
- **Exclusion is done by filtering the participant list, never by the status field.** The
 refund marks the participant `refunded` for the audit trail and every screen that reads
 it, but `calculateRankings` reads `status` only for the liquidation rule - so the status
 alone removes nobody. This is the whole double-payment defect, and it is one line.
- **The refund happens before ranking, so the pool the winners are paid from is already the
 reduced one.** Reducing after would pay prizes out of a pot that still counted a player
 who had left. The reduction is the **full entry fee**, because entry adds the full fee and
 the platform share is taken later out of the pool - a stale comment in both copies of
 `competition-cancel.actions.ts` claimed the opposite and was corrected the same day.
- **The `hold_and_alert` gate sits before the optimistic lock**, so a parked contest is left
 completely untouched rather than claimed and released on every sweep. The second,
 in-transaction check is a real gate rather than decoration - it catches a round going
 unresolved between the two reads - but it exposed a latent bug that mattered more than
 either policy: **a `success: false` return from settlement used to commit anyway and never
 release the claim**, leaving the contest at `finalizing` for ever, where no caller, cron or
 human could claim it again and nobody would be paid.
- **A duplicate refund is prevented by a ledger check, not by the transaction.** The
 transaction is atomic, so a failed run rolls back - but a run that stalls in `finalizing`
 is reset to `active` after five minutes (R4) and the next sweep settles it *for real*, and
 the first run had already committed.

**Still not built:** the `exclude` refund fires only on the provider settlement path. The
trading path cannot reach it, because trading has no rounds - which is correct, not a gap,
but a document saying "settlement honours the unresolved policies" should say **provider
settlement**.

---

## 3. Provider outage

### 3.1 Detection

Health checks each minute: a lightweight catalogue call, plus round-creation success
rate and callback arrival rate. Three consecutive failures marks the provider
`degraded`; sustained failure marks it `down`.

### 3.2 Response by contest state

| State | Response |
|---|---|
| **Not yet open** | Hide the contest. Postpone or cancel with full refunds before anyone pays |
| **Registration open, play not started** | Stop new entries. If not recovered before play opens, cancel and refund everyone |
| **Play in progress** | **Pause the contest** and extend the play window by the outage duration. Show players an honest message |
| **Settling** | Poll until the grace period ends, then apply the unresolved policy |
| **Completed** | Unaffected |

Pausing and extending is far better than cancelling. Players who already played keep
their scores, and the contest completes late rather than not at all.

### 3.3 The automatic kill switch

If a provider is `down` for more than 15 minutes, automatically disable **new**
contest creation and new round creation for that provider, and notify admins. Live
contests continue under the rules above.

A per-provider manual kill switch must also exist and must be usable without a
deployment.

---

## 4. Round-level edge cases

| Case | Handling |
|---|---|
| Player double-clicks Play | Idempotent round creation returns the same round and launch URL. The unique index on `{contestId, userId, attemptNumber}` is the hard guarantee |
| Launch URL expires before play | Detect on page load; request a fresh round. Does **not** consume another attempt if the original was never started |
| Player closes the tab mid-round | Round stays live until `expiresAt`. Returning resumes if the provider supports it, otherwise it resolves as abandoned |
| Player loses connectivity | Provider's problem to handle gracefully. Our rule: they must not lose a paid attempt to a dropped signal, so `abandoned` results should carry a partial score where possible |
| Two devices, same round | One live round per player per contest, enforced in the database |
| Round outlives the contest | `expiresAt` is always set at or before the play window end |
| Result arrives after settlement | Recorded against the round for audit, **not** applied to the ranking. Alert raised. If it would have changed the outcome, follow the re-settlement path in `06` |
| Provider reports an impossible score | Rejected against `scoreRange`, round marked unresolved, alert raised |
| Provider reports the same round twice with different scores | First valid result wins. Second stored and flagged as a **critical** discrepancy |
| Provider voids a round after settlement | Manual re-settlement. Must be supported deliberately |

---

## 5. Contest-level edge cases

| Case | Handling |
|---|---|
| Nobody plays | Cancel, refund everyone in full |
| Only one player plays | Honour the prize split if minimum participants were met; otherwise cancel and refund. Decided by existing contest rules, not by anything new |
| Fewer than minimum participants | Existing auto-cancel and refund path, unchanged |
| Everyone ties | Existing shared-position logic splits the pot |
| Game withdrawn by the provider mid-contest | Existing rounds honoured; no new rounds; settle on the scores achieved. If nobody played, cancel and refund |
| Admin edits settings mid-contest | **Blocked.** Game, settings and seed lock the moment the first player joins |
| Contest cancelled with live rounds | Void the rounds via the provider if supported, refund everyone regardless |

---

## 6. Money-safety invariants

These must hold at all times and be asserted by automated tests, in the same spirit
as the Stage 0 money tests.

| # | Invariant |
|---|---|
| 1 | Prize pool == sum of entry fees collected, minus refunds |
| 2 | Prizes paid + platform fee == prize pool, to the cent |
| 3 | No participant is ever debited twice for one entry |
| 4 | Settling a contest twice pays winners **once** |
| 5 | A cancelled contest returns every entry fee, and leaves the pool at zero |
| 6 | No money moves as a result of any provider call, ever |
| 7 | A voided round never causes a debit or a credit |
| 8 | Every round reaches a terminal state within grace end + 24h |

Invariant 6 is the one that makes this integration fundamentally safer than a
provider-hosted wallet, and it should be enforced by a test that fails if any
provider code path can reach the wallet service.

---

## 7. Degradation matrix

| Failure | Players see | Money impact |
|---|---|---|
| Catalogue sync fails | Nothing - cached catalogue is served | None |
| Round creation fails | "Cannot start right now, try again" | None - no attempt consumed |
| Launch URL fails to load | Retry, then a fresh round | None |
| Callback delayed | "Score being confirmed" | None - grace period absorbs it |
| Callback never arrives | Unresolved policy applies, player notified | Possible refund under `exclude` |
| Provider down mid-contest | Contest paused, window extended | None |
| Provider down before start | Contest cancelled | Full refunds |
| Provider terminates the contract | Games disabled; live contests settle or refund | Full refunds where unsettled |

**In no row does money move incorrectly.** That is the test of the design.

---

## 8. What must be built alongside the feature

Easy to defer, expensive to add after the first incident.

| Item | Why it cannot wait |
|---|---|
| Reconciliation job | Without it a single lost webhook blocks a contest indefinitely |
| Unresolved-round alert | Silence is the failure mode. Nobody discovers it except an angry player |
| Provider health panel in admin | Otherwise "is it us or them" takes an hour every time |
| Manual round resolution tool | Support must be able to set a score with a reason and an audit entry |
| Re-settlement capability | Contests will occasionally need correcting after payout |
| Pause and extend on a contest | The single most useful outage response |
| Per-provider kill switch | Must be usable without a deployment |

---

## 9. Rehearsal before launch

Every one of these should be executed deliberately in the sandbox, not hoped about:

- [x] Withhold a callback entirely, confirm reconciliation resolves it
- [x] Withhold it permanently, confirm the unresolved policy fires and alerts
- [x] Send a callback with a bad signature, confirm rejection and alert
- [x] Send the same callback twice, confirm one score
- [x] Send two different scores for one round, confirm the discrepancy alert
- [x] Send a result after settlement, confirm it is recorded but not applied
- [ ] Take the provider offline mid-contest, confirm pause and extend
- [ ] Cancel a contest with live rounds, confirm full refunds
- [ ] Settle the same contest twice, confirm winners paid once
- [ ] Run a contest end to end with real (small) entry fees before going public

### Status, 4 September 2026 - and what the ticks do NOT mean

**The first six are green against the mock** (X3, `__tests__/services/round-lifecycle.test.ts`,
49 tests), which is the gate `09` E2 sets: "do not move past E2 until those tests are green."
All six central guards were probed by reintroducing the defect, so each tick rests on a test
proven capable of failing.

**Read the ticks precisely.** They mean the behaviour is correct **against the mock adapter**.
They do not mean it has been seen against a real provider - that is X4 - and they do not mean
any money has moved, because nothing in the first six touches a wallet.

**The last four are deliberately not attempted yet**, and each is blocked on a phase rather
than on effort:

| Rehearsal | Blocked on | Why it cannot be faked now |
|---|---|---|
| Provider offline, pause and extend | E7/X8 (section 3.2) | Needs the health monitor and the pause mechanism, neither of which exists |
| Cancel a contest with live rounds | E4/X5 (section 5) | Needs contest cancellation to know about rounds |
| Settle the same contest twice | E4/X5 (section 6 #4) | Needs provider settlement to exist before it can be made idempotent |
| End to end with real entry fees | E9 pilot | Needs a real provider and real money |

All four are **money tests**. Building half of one now against a stub would produce a green
tick that proves nothing about the path real money takes - which is worse than an empty
checkbox, because an empty checkbox is honest.
