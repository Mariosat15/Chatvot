# STAGE 0 - Prerequisite Fixes (SEPARATE PROJECT - DO FIRST)

> **This is NOT part of the New Games Plan.**
>
> These are **pre-existing defects** that already exist in the application today. They have nothing to do with adding games - they would be worth fixing even if no new game were ever added.
>
> **They are delivered, deployed and signed off as their own standalone piece of work.**
> The New Games Plan implementation (`14-implementation-phases.md`, Phases P1-P7) does **not** begin until the owner has tested these fixes and confirmed they work.

---

## Verification log

The two defects were first documented on 17 August 2026. They were **re-verified against
the codebase on 1 September 2026**, immediately before work started. Both are still
present and unfixed. The re-verification corrected six claims and found seven additional
defects, all recorded below.

| Date | Finding |
|---|---|
| 17 Aug 2026 | Defects 1 and 2 documented from a code audit |
| 1 Sep 2026 | Both re-confirmed present. **Corrections:** the finalize-time safeguard does **not** mask the prize-pool gap; Gate B is reached only by the simulator, not by real players; there are **four** competition-entry writers, not two; the mirror count is **75 pairs, not ~21**, of which **10** have real field drift, not three |
| 1 Sep 2026 | **New:** an unauthenticated caller could credit any wallet in production. Fixed and shipped the same day as Prerequisite A below |
| 1 Sep 2026 | **New:** the challenge *accept* path skips account restrictions and the fraud gate, on a route real players use |
| 1 Sep 2026 | **New:** Gate A writes a ledger field that is not in the schema, so production entry-fee rows carry no competition reference |
| 1 Sep 2026 | **New:** `platform-financials.model.ts` has *bidirectional* enum drift, which fails writes rather than merely hiding fields |
| 1 Sep 2026 | **Correction, measured:** drift is a **write-side** defect. An ordinary `save()` does **not** strip undeclared fields, and `.lean()` / `toObject()` do **not** hide them - both earlier claims were wrong. What actually happens: a missing enum value rejects the write, and the narrower app cannot write the field at all. Evidence: `__tests__/helpers/mirror-drift-behaviour.test.ts` |
| 1 Sep 2026 | **Correction to the correction:** one read *does* break, and it is the one code uses. **Ordinary `doc.field` access returns `undefined`** for an undeclared field, because Mongoose defines getters only for declared paths. The field survives a debug dump while the code beside it reads nothing and takes the wrong branch |
| 1 Sep 2026 | **New, live in production:** `whitelabel.brandingFiles` missing from the admin copy meant **hero and branding images could never be restored after a redeploy**, and deleting one left the database copy behind forever. Three routes affected. Found by diffing the typecheck against a pre-sync baseline - the admin app went from 229 standing errors to 225, and all four were this field |
| 1 Sep 2026 | **New:** an **eleventh** drifted pair - `user-notification-preferences.model.ts`. The admin app cannot represent a player muting challenge, social or messaging notifications, so it ignores that choice |
| 1 Sep 2026 | **New, live in production:** the main app writes `failedAt` and `failedReason` on every failed withdrawal into a schema declaring neither, and `failedReason` was in **neither** app's copy. Every failed withdrawal has been stored with no failure time and no processor reason |
| 1 Sep 2026 | **New:** the `hero-settings` drift is 42 fields, not 26, and made the Game Master, competition-types, marketplace, journey-badges, trust-badge and enterprise landing sections **un-administrable** rather than merely invisible |
| 1 Sep 2026 | **Correction:** there are **31** stale `.d.ts` files plus 31 `.d.ts.map`, not two. All are orphaned build output from February and provably inert. Plan changed from "update" to "delete", pending owner sign-off |
| 1 Sep 2026 | **Correction to that correction, and the count that is right:** the 31 figure counted only `database/`. Repo-wide there were **57 `.d.ts` + 55 `.d.ts.map` = 112 files**, the rest under `lib/services/` and `lib/actions/`. **Owner approved deletion and all 112 are gone**, with a `.gitignore` rule and two deliberate exceptions. Typecheck identical before and after: 16 errors main, 225 admin |
| 1 Sep 2026 | **Owner decision:** joining a competition is **allowed outside market hours**; only trading itself is gated. Unifying the gates would otherwise have adopted Gate B's behaviour and blocked weekend sign-ups for Monday contests - a revenue regression introduced by a bug fix. Now locked in by test 12 |
| 1 Sep 2026 | **Proven, was previously an inference:** competition entry-fee ledger rows carry **no competition reference at all**. `referenceId` is not in the schema and `competitionId` is never set. Measured against a real MongoDB in `__tests__/services/entry-fee-ledger.test.ts`. Harm is a broken audit trail, not a wrong balance - checked, not assumed |

---

## Why these are separated out

| Reason | Explanation |
|---|---|
| **They are not games work** | Both defects exist today with a single game. Bundling them into the games project would hide two real bug fixes inside a feature release, making both harder to review and harder to roll back. |
| **They are independently valuable** | Each one closes a live defect. Shipping them alone improves the platform immediately. |
| **They are independently testable** | Both can be verified by the owner without any game abstraction existing. See the sign-off checklist at the end. |
| **They are the foundation the games work stands on** | The games project adds new ways to join a contest and a new critical field (`gameType`). Building either on top of an inconsistent join path or drifted model mirrors converts two contained bugs into a money-integrity risk. |
| **Clean rollback** | If Stage 0 needs reverting, it reverts on its own, with no half-built game abstraction entangled in it. |

---

# PREREQUISITE A - Simulator authentication (SHIPPED 1 Sep 2026)

Found while re-verifying Defect 1. Recorded here because it had to be fixed before
anything else, and because the fix is the foundation Defect 1's entry service builds on.

## What it was

The `/api/simulator/*` routes act on behalf of an arbitrary user id and can credit
wallets, open positions and ban accounts. Their guard was:

```
if (!isSimulatorMode && !isDev) { return 403 }
```

An `AND` of two negatives, so **sending `X-Simulator-Mode: true` satisfied it in
production**. There is no `middleware.ts` in the repository, so nothing blocked the path
at the edge. `POST /api/simulator/deposit` therefore credited any wallet by user id,
unauthenticated, and also raised `totalDeposited`, so the balance looked like a genuine
funded deposit to everything downstream including withdrawal eligibility.

Nineteen of the twenty simulator routes had no secret check. A correct helper already
existed in `lib/services/simulator/simulator-mode.ts` but was called by one route, and it
accepted the header alone whenever `INTERNAL_API_SECRET` was unset. Two **non**-simulator
money routes read the same headers raw and acted as the named user:
`app/api/competitions/[id]/join/route.ts` and `app/api/challenges/route.ts`.

## What was done

Commit `d5d3a328`, 20 files.

- `simulator-mode.ts` fails closed. Outside development a call needs the header,
  `ENABLE_SIMULATOR=true`, and a constant-time match on `INTERNAL_API_SECRET`. A missing
  or under-16-character secret refuses traffic rather than accepting anonymous traffic.
- `guardSimulatorRoute()` adopted by all ten previously unguarded routes. The ten
  `/api/simulator/attack/*` routes already had a stronger seven-layer guard and were left
  alone - that guard is the model the new one follows.
- The two money routes now call `isSimulatorRequest`, so the impersonation branch is
  unreachable without the secret. Note `positions/tpsl` previously accepted
  `X-Simulator-User-Id` *without even* `X-Simulator-Mode`.
- The same fail-open pattern was fixed in `leaderboard/invalidate`,
  `internal/symbol-config-refresh` and `internal/price-health`, which fell back to the
  literals `"simulator-cleanup"` and `"internal-key"`. They now share
  `lib/utils/internal-auth.ts`.
- `__tests__/services/simulator-auth.test.ts` - 25 tests. Fifteen cover the decision
  function including both exploit shapes; ten import the real route handlers and assert
  403, so the tests prove the routes call the guard.

## Deployment note

`ENABLE_SIMULATOR` is new and unset, so **simulator endpoints are off in production by
default**. That is the intended posture. Set it to `"true"` only if simulations are run
against the live server, and in the admin app's environment too, since that is a separate
process.

## Still open

- [ ] Confirm this was never exploited. On production, look for `wallettransactions` with
      `description: "Simulator deposit"` or `metadata.simulatorMode: true`, and reconcile
      `totalDeposited` against Nuvei and Atlas records. A real exploit leaves an inflated
      wallet with no matching payment-provider record.

---

# DEFECT 1 - Multiple competition entry paths that behave differently

## In plain words

There are two separate pieces of code that let a player join a competition. Think of a
stadium with two entrance gates.

- **Gate A** checks your ticket, your ID and your eligibility, and puts your entry fee into the prize money jar.
- **Gate B** checks almost none of that, and **forgets to put your fee into the jar.**

Both gates take the player's money. Only one records it in the prize pot.

## The evidence (re-verified 1 September 2026)

**Gate A** - `lib/actions/trading/competition.actions.ts`, the `enterCompetition` server
action (lines 352-729), increments **both** counters at lines 584-593:

```
$inc: {
  currentParticipants: 1,
  prizePool: competition.entryFee,
}
```

**Gate B** - `app/api/competitions/[id]/join/route.ts` (handler at lines 16-313)
increments **only** the participant count, at lines 252-256:

```
await Competition.findByIdAndUpdate(
  competitionId,
  { $inc: { currentParticipants: 1 } },
  { session: mongoSession },
);
```

## Full comparison of the two gates

| Check performed | Gate A (`enterCompetition`) | Gate B (`/api/competitions/[id]/join`) |
|---|---|---|
| Email verified | Yes (366-370) | **No** |
| Account restrictions | Yes (376-390) | **No** |
| Fraud gate (IP, device, suspicion score) | Yes (404-415) | **No** |
| Level requirement | Yes (474-507) | **No** |
| Market hours / holiday | **No** | Yes (74-86) |
| **Adds entry fee to prize pool** | **Yes** | **No** |
| Retries on concurrent-join conflict | **No** | Yes, 5 attempts (94-97, 282-297) |
| Duplicate entry | Throws | Returns success, "Already joined" |
| Ledger reference field written | `referenceId` | `competitionId` |
| Ledger currency written | `"CREDITS"` | `"EUR"` |
| KYC | No | No |

Neither gate is fully correct. Gate A has the right security and money handling but lacks
the market-hours check and the concurrency retry. Gate B has the retry and market-hours
check but skips four security checks and the prize-pool update.

## There are four writers, not two

| # | Path | Adds to prize pool? | Notes |
|---|---|---|---|
| 1 | `enterCompetition` | **Yes** | The **only** path real players use |
| 2 | `POST /api/competitions/[id]/join` | **No** | Called **only** by `lib/services/simulator/simulator.service.ts` (lines 683, 713) |
| 3 | `apps/admin/lib/actions/trading/competition.actions.ts` (618-655) | Yes | Admin mirror of Gate A, but **missing** the email check and the fraud gate |
| 4 | `app/api/simulator/competitions/join-batch/route.ts` | **No** | **No callers anywhere in the repo** |

## What it causes today - corrected

The original version of this document overstated the live impact. Being accurate matters
more than being alarming:

- **Gate B is not on the customer path.** Both real join buttons call Gate A -
  `components/trading/CompetitionCard.tsx` line 286 and
  `components/trading/CompetitionEntryButton.tsx` line 182. So no paying customer is
  currently joining through the gate that skips the prize pool. The defect is a loaded gun
  rather than a live wound.
- **The finalize-time safeguard does NOT mask the gap.** The original document claimed it
  did. It does not. The correction at `lib/actions/trading/competition-end.actions.ts`
  lines 695-718 only fires when `prizePool > currentParticipants x entryFee`, i.e. when
  the pool is too **high**. An under-counted pool never enters that branch. So a Gate B
  join would simply distribute **less** than was collected, silently and with no
  correction at all. This is worse than described, not better.
- **Gate B can admit unverified, restricted or fraud-flagged accounts**, and the admin
  mirror of Gate A can admit unverified and fraud-flagged ones.
- **Production entry-fee ledger rows have no competition reference. PROVEN 1 Sep 2026.**
  Gate A writes `referenceId: competitionId` (line 548), but `referenceId` **is not in the
  `WalletTransaction` schema** - the schema defines `competitionId` at line 129, which that
  call never sets. Mongoose strict mode drops undeclared fields on `create`, so the
  reference is discarded and the row lands with no link to its competition at all.

  No longer an inference: `__tests__/services/entry-fee-ledger.test.ts` writes the exact
  row Gate A writes, against a real MongoDB, and reads it back through the driver. The
  `referenceId` property is absent and `competitionId` is `undefined`. Four tests, written
  before the fix so the fix has a signal to prove itself against.

  **The scope of harm is narrower than "money is wrong", and it was checked rather than
  assumed.** Nothing computes money from `WalletTransaction.competitionId`:
  `withdrawal-validator.service.ts` reads `competitionId` from `CompetitionParticipant`,
  and `platform-financials.service.ts` uses its own `sourceId`. So this is a **broken
  audit trail, not a wrong balance** - but every competition entry fee ever collected is
  unattributable to the competition that charged it, which matters for disputes,
  reconciliation and refunds, and will matter more when per-game revenue reporting wants
  exactly this link.

  **Only two places write it**, and they agree: Gate A and its admin mirror at
  `apps/admin/lib/actions/trading/competition.actions.ts` line 610. This is one bug, not
  mirror drift - which is why the mirror guard does not catch it and a test must.
- **Exhausting the retries returns no response.** Gate B's `for` loop is the last
  statement in its `try` block with no `return` after it, so five consecutive write
  conflicts fall through and return `undefined`. Rare, but it should be an explicit 409.

## Sub-defect 1b - the challenge accept path (found 1 Sep 2026)

Challenges have the same asymmetry as competitions, and unlike Gate B **this one is on a
path real players use.**

| Check | Create (`POST /api/challenges`) | Accept (`POST /api/challenges/[id]/accept`) |
|---|---|---|
| Email verified | Yes (135-141) | Yes (28-37) |
| Account restrictions | Yes (168-187) | **No** |
| Fraud gate | Yes (196-211) | **No** |
| Market hours | Yes (217-258) | Yes (43-54) |
| Both wallets debited | No - create does not debit | Yes (95-125) |

Accept is where the money actually moves and where both `ChallengeParticipant` records are
created. It is called from three live components: `app/(root)/challenges/page-content.tsx`
line 95, `components/challenges/ChallengePopup.tsx` line 192, and
`components/trading/ChallengeEntryActions.tsx` line 40. It also writes `challengeId` on
the ledger row, which has the same not-in-schema problem as `referenceId`.

**Recommendation:** fold 1b into Defect 1. It is the same class of bug, the same fix
shape, and it is the only one of the set with a live security consequence for real users.

## The fix

1. **Write the money tests first, against current behaviour.** Before changing anything,
   lock in what the system does today so any unintended change is caught. (Tests listed
   below.) This depends on the test-database decision - see the blocker section.
2. **Create one entry service:** `lib/services/contest-entry.service.ts`
   - Performs the **union** of all checks from both gates.
   - Always increments `currentParticipants` **and** `prizePool`, inside the same database
     transaction as the wallet debit.
   - Keeps the concurrent-join retry from Gate B (it exists for a real reason - simultaneous
     joins genuinely conflict). Copy Gate B's structure rather than inventing one: it
     correctly starts a fresh session and re-reads inside each attempt.
   - Returns an explicit 409 when retries are exhausted instead of falling through.
   - Takes a `source` parameter (`web` / `api` / `simulator`) which controls **only** the
     one legitimate difference: the simulator skips the market-hours check. The simulator
     identity itself is now authenticated by Prerequisite A - do **not** reintroduce a
     header-triggered bypass.
3. **Point all four existing entry points at it.** They become thin wrappers. No caller
   outside changes. Decide explicitly whether `join-batch` should be deleted instead,
   since it has no callers.
4. **Do the same for challenge accept** (sub-defect 1b), adding the restriction and fraud
   checks it lacks.
5. **Unify the ledger reference field.** Write the field the schema actually defines
   (`competitionId` / `challengeId`), backfill nothing (there is nothing to backfill - the
   old value was never stored), and align the `currency` value between paths.

### The market-hours question - DECIDED by the owner, 1 September 2026

Unifying the two gates forces a product decision, because Gate B blocks joining outside
market hours and Gate A does not. Taking the union blindly would have adopted Gate B's
behaviour and **stopped players signing up at the weekend for a contest starting Monday** -
a revenue loss introduced by a bug fix, which is exactly the kind of regression a "just
apply every check from both sides" instruction produces.

**Decision: joining is allowed at any time. Only trading itself is gated by market hours.**

The reasoning, recorded so it is not quietly reversed:

- **Joining is a commercial act, not a trading act.** It moves credits into a prize pool. No
  position is opened and no price is needed, so there is nothing for a closed market to make
  unsafe.
- **The contest may not have started yet.** `upcoming` competitions are the common case for
  weekend sign-ups, and the start time already governs when trading may begin.
- **The existing market-hours check stays exactly where it is** - on order placement in
  `order.actions.ts`. That is the guard that matters and it is untouched by this work.

**Implementation consequence:** the unified `contest-entry.service.ts` performs the union of
the *security* checks from both gates - email verification, account restrictions, the fraud
gate and the level requirement - and **does not** carry Gate B's market-hours check at all.
The `source` parameter therefore no longer needs a market-hours exemption for the simulator,
which removes the one differing behaviour it existed to express. Keep the parameter for
audit and rate-limiting purposes, but it should no longer gate a check.

**What must be true after the fix:** a player can join an `upcoming` competition on a
Saturday, and attempting to place an order in that competition on the Saturday is still
refused. That pair is now a required test - number 12 below.

## Tests that must pass

| # | Test | Asserts |
|---|---|---|
| 1 | 20 simultaneous joins through both entry points | `prizePool == successful joins x entryFee`, `currentParticipants` matches, no wallet drift |
| 2 | Join with insufficient balance | No partial state - no participant without a debit, no debit without a participant |
| 3 | Join with unverified email, via **all** entry points | All refuse |
| 4 | Join while account-restricted, via **all** entry points | All refuse |
| 5 | Join below the level requirement, via **all** entry points | All refuse |
| 6 | Full prize payout on a finished competition | Winner credits + platform fee == prize pool, exact to the cent |
| 7 | Cancel and refund | Every participant made whole, `prizePool` zeroed |
| 8 | Finalize the same competition twice | Winners paid **once** (idempotency) |
| 9 | Entry fee ledger row | Carries a resolvable competition reference in a field the schema defines. **Written 1 Sep 2026** - `__tests__/services/entry-fee-ledger.test.ts`, 4 tests, passing. Pins the current defect, proves the corrected write survives, proves the audit query works, and guards against "fixing" it by loosening the schema |
| 10 | Retries exhausted under sustained write conflict | Returns 409, no participant created, no debit |
| 11 | Accept a challenge while restricted / fraud-flagged | Refused (sub-defect 1b) |
| 12 | Join an `upcoming` competition outside market hours, then try to place an order in it | Join **succeeds**, order **refused**. Locks in the owner's decision above, in both directions - a fix that blocked the join would fail this, and so would one that let the order through |

Test 8 matters because there is an existing recovery process that resets a stuck
competition back to `active` after 5 minutes - so a slow finalization really can be run
twice.

## Risks of making this change

Ordered by how much they should worry you.

| Risk | Why | Mitigation |
|---|---|---|
| **Double debit via the retry loop** | The unified service wraps a wallet debit in a retry loop. A wrong re-read double-charges | Copy Gate B's structure verbatim; assert zero wallet drift across 20 concurrent joins (test 1) |
| **The union of checks is stricter than either gate** | Applying market hours to Gate A would stop players joining an *upcoming* competition at the weekend | **DECIDED by the owner, 1 Sep 2026: joining is allowed at any time; only trading itself is gated by market hours.** See below |
| **Entry is revenue-critical and instantly visible** | If it breaks, nobody can join anything | Deploy at low traffic; be ready to revert; Stage 0 reverts independently |
| **No existing test coverage** | Five tests exist in the repo and none touch entry or settlement | Tests-first is not a formality here |
| **The admin mirror must change too** | Otherwise drift worsens | Do Defect 2 first so the guard is in place |
| **History is not fixed by fixing forward** | Competitions already joined via Gate B have a pool that is too small | Decide explicitly whether to backfill or accept |

## Estimated effort

**3 to 4 working days**, of which roughly half is writing the tests. Add roughly a day if
sub-defect 1b is folded in, which is recommended.

---

# DEFECT 2 - Admin app model mirrors have drifted (CONFIRMED, NOT HYPOTHETICAL)

## In plain words

ChartVolt is really two applications - the player app and the admin app - sharing one
database. But each app keeps its **own separate copy** of the "blueprint" that describes
what a competition is, what a wallet transaction is, and so on.

If a field is added to the player app's blueprint and someone forgets the admin app's
copy, the admin app **cannot write that field**. Not "writes it wrongly" - the write is
discarded, silently, and the operation reports success.

This is not a theoretical risk. **It has already happened, and it is still happening
in production today** - see the withdrawal finding below.

## The evidence (re-verified 1 September 2026)

The original document said "about 21" mirrored files and three confirmed drifted pairs.
The real numbers are larger.

| Measure | Count |
|---|---|
| Model files in the main app | 98 |
| Model files in the admin app | 89 |
| **Mirrored in both** | **75** |
| Main-app-only (no mirror) | 23 |
| Admin-app-only (no mirror) | 14 |
| Byte-identical pairs | 38 |
| Pairs differing in file content | 37 |
| **Pairs with real schema drift** | **11** |

(The guard enumerates 104 files under `database/models`, being the 98 models plus six
non-model helpers - three `index.ts` barrels and the three `hero-settings.*` helper files.
It compares the 75 that exist on both sides.)

The four originally documented claims are **all still true**:

| Blueprint file | Fields missing from the admin app's copy |
|---|---|
| `database/models/trading/competition.model.ts` | `gameMasterId`, `gameMasterName` |
| `database/models/trading/wallet-transaction.model.ts` | `provider`, `providerTransactionId` |
| `database/models/whitelabel.model.ts` | `brandingFiles` |
| `database/models/trading/competition-participant.model.ts` | Field sets match; the main app has 4 compound indexes the admin copy lacks |

And seven more pairs drift that were not previously recorded:

| Blueprint file | Drift |
|---|---|
| `platform-financials.model.ts` | **Bidirectional.** Main has `retainedGmFeeDetails`; admin has `balanceAddDetails`, `expenseDetails`, **and two enum values the main app rejects** |
| `hero-settings.model.ts` | **42** marketing / Game Master / journey / enterprise fields missing from admin |
| `user-bank-account.model.ts` | 5 Nuvei UPO fields missing from admin |
| `trading/challenge-settings.model.ts` | `tiePrizeDistribution` missing from admin |
| `trading/trading-position.model.ts` | `metadata` missing from admin |
| `user-notification-preferences.model.ts` | `categoryPreferences.challenge`, `.social`, `.messaging` missing from admin |
| `withdrawal-request.model.ts` | Missing from **main**: `failedAt`, `withdrawalMethod`, `originalCardDetails.userPaymentOptionId` |

`admin.model.ts` also differs by **26** admin-only RBAC and staff-profile fields. **That
difference is correct and must stay** - see the allowlist section below.

Two of these were worse than the file-level summary suggests:

- **`hero-settings.model.ts` was not cosmetic.** The 42 fields are the Game Master
  showcase, the competition-types showcase, the marketplace preview, the journey-and-badges
  section, the trust badges, the live-data refresh settings and the enterprise case
  studies. The admin app is the **editor** for landing-page content, and
  `apps/admin/app/api/hero-settings/route.ts` saves it with `Object.assign(settings,
  body)` followed by `save()`. An admin posting any of those fields got a success
  response and no change. In effect **those landing sections were not administrable at
  all.**
- **`user-notification-preferences.model.ts` silently overrides player choices.** A player
  who mutes challenge, social or messaging notifications is honoured by the player app and
  ignored by the admin app, because the admin model cannot represent the preference.

## What drift actually does - MEASURED, and not what this document used to say

This document previously claimed the main harm was that "the admin app cannot see the
field" and that "whole-document saves strip it". Both claims were wrong. The behaviour was
measured against a real MongoDB on 1 September 2026 and the evidence is in
`__tests__/helpers/mirror-drift-behaviour.test.ts` (8 tests, all passing).

In descending order of harm:

| # | What happens | Severity |
|---|---|---|
| 1 | A **missing enum value rejects the entire write.** The record is never created | **Severe** - the money movement that needed recording is not recorded |
| 2 | The narrower app **cannot write the field.** `create`, assignment-then-`save`, and `$set` all discard it in silence and report success | **Severe** - the feature appears to work and does nothing |
| 3 | `replaceOne` / `findOneAndReplace` **do delete** undeclared fields, because they send a whole document | High, but rare in this codebase |
| 4 | An ordinary `save()` of a loaded document does **not** delete them - it `$set`s modified paths only | Not a harm. **The old claim was wrong** |
| 5 | `.lean()` and `toObject()` do **not** hide the field - it is present in both | Not a harm. **The old claim was wrong** |
| 6 | But **ordinary property access, `doc.field`, returns `undefined`**, because Mongoose defines getters only for declared paths | **Severe, and the subtlest of the six** - see live bug 2 |

Rows 5 and 6 together are the reason drift survives review for months. A dump of the
document shows the value; the line of code next to it reads `undefined` and quietly takes
the wrong branch. That is exactly how `brandingFiles` disabled hero-image recovery.

Two consequences follow, and both change how the work is done:

- **Drift is a write-side defect first, and a read-side trap second.** A `.lean()` read
  returns the field perfectly while every write through the same model drops it, so a read
  is useless as evidence that two copies agree. Only the guard can tell you.
- **The guard must compare enum VALUES, not just field names.** Row 1 is the worst case and
  a field-name comparison cannot see it at all. `platform-financials.model.ts` was exactly
  this: same `transactionType` field on both sides, but the main app's enum omitted
  `admin_balance_add` and `custom_expense`, so those writes would fail validation.

### Live bug 1, now fixed - failed withdrawals recorded no time and no reason

`withdrawal-request.model.ts` drifted in the direction nobody expected - the **main** app
was the narrower copy. `app/api/nuvei/withdrawal/route.ts` writes `failedAt` and
`failedReason` on **all three** of its failure paths (lines 451, 562, 651). The main app's
schema declared neither, and `failedReason` was declared in **neither** app's copy.

By harm #2 above, that means **every failed withdrawal has been stored with no failure
timestamp and no processor reason**, for as long as the field has been written. Admin
screens showing "failed at" had nothing to show. This is the same class of bug as the
`WalletTransaction.referenceId` mismatch recorded under Defect 1, found the same way, and
it is the strongest available argument for the guard: nobody was looking for this.

### Live bug 2, now fixed - hero images could never be restored after a redeploy

Found by the typecheck, not the guard, and only visible **after** the sync: syncing
`whitelabel.model.ts` removed four pre-existing TypeScript errors in the admin app
(229 errors before, 225 after). All four were the same missing field, `brandingFiles` -
the Map that stores a base64 copy of every uploaded branding image so it survives a deploy
onto ephemeral disk.

The admin schema did not declare it, so in three routes the field read as `undefined`:

| Route | Line | What silently did nothing |
|---|---|---|
| `app/api/assets/hero/[filename]/route.ts` | 52 | Serving a hero image missing from disk. The database restore path never ran, so the image stayed 404 and was never auto-restored |
| `app/api/assets/images/[filename]/route.ts` | 96 | The same, for general branding images |
| `app/api/hero-settings/upload/route.ts` | 186-187 | Deleting a hero image. The disk file went; the database copy stayed forever |

The first two are the more serious: `brandingFiles` **exists precisely to survive a
redeploy**, and the code that reads it could not see it. The backup was being written by
the main app and never read by the admin app.

This one also sharpens *how* drift hides, and the difference is worth stating because it
is counter-intuitive. Reads are not uniformly safe. `.lean()` and `toObject()` return the
undeclared field perfectly, but **ordinary property access returns `undefined`**, because
Mongoose defines getters only for declared paths. So a debug dump of the document shows
the value while the line of code beside it reads nothing and takes the wrong branch. Both
behaviours are pinned in `mirror-drift-behaviour.test.ts`.

## The stale type declarations - DELETED 1 September 2026 (owner approved)

The plan said "two stale `.d.ts` files, update them". Two counts in this document have now
been superseded, and the second correction is the one to trust:

| Count | Where it came from | Status |
|---|---|---|
| 2 | The original 17 Aug write-up | Stale |
| 31 `.d.ts` + 31 `.d.ts.map` | First re-verification, which searched only `database/` | **Also stale** - it missed everything under `lib/` |
| **57 `.d.ts` + 55 `.d.ts.map` = 112 files** | Repo-wide `git ls-files "*.d.ts"` | **Correct. All deleted** |

The lesson is the same one the mirror guard taught: **do not scope a count to the directory
you happen to be looking at.** The first re-verification was checking model mirrors, so it
searched the models directory and reported a models-shaped answer. Twenty-six more files
sat under `lib/services/` and `lib/actions/` the whole time.

They were **orphaned build output**, not hand-maintained declarations:

- Each ends with a `sourceMappingURL` comment, with the `.map` committed beside it.
- `tsconfig.json` sets `noEmit: true`, so nothing regenerates them. They were frozen at
  whatever the code looked like on 1 February 2026 - all 112 came from a single commit.
- They were **inert**: TypeScript resolves `./competition.model` to the `.ts` file, which
  wins over a sibling `.d.ts`.

**Proof of inertness, measured twice.** Before deletion: main app 16 type errors, admin app
225. After deleting all 112: **16 and 225, identical**. 182 tests still pass and the mirror
guard still reports 75 pairs in agreement.

**Two files were deliberately kept**, and the classification rule is worth recording
because "delete every `.d.ts`" would have broken the build:

| Kept | Why |
|---|---|
| `types/global.d.ts` | **Hand-written.** It has no sibling `.ts`, so it is the sole source of its types, not a copy of anything |
| `websocket-server/dist/index.d.ts` | Build output of a **separate** build with its own lifecycle, under `dist/` |

The rule applied was: delete a `.d.ts` only if a sibling `.ts` exists and it is not under
`dist/`. A sibling `.ts` is what proves the file is a redundant copy rather than a
declaration in its own right. Two files - `lib/actions/trading/contest-utils.d.ts` and
`lib/actions/trading/position.actions.d.ts` - had no `.map` and needed a manual look; both
are full of `export declare const`, which is emitted output rather than anything a person
writes, and both came from the same February commit.

A `.gitignore` rule now ignores `*.d.ts` and `*.d.ts.map`, with negations for
`types/global.d.ts`, `next-env.d.ts` and the websocket server's `dist` output, so a stray
`tsc -d` cannot reintroduce them. Verified both ways: a probe file under
`database/models/` is correctly ignored, and neither kept file is.

**Deviation from the plan, recorded deliberately:** updating them by hand was rejected.
Doing so would have created a third copy of every schema to keep in step - the very disease
this defect is about - for files that nothing reads.

## Beyond models - noted, not in scope

The same duplication exists outside models, where a field-comparison script cannot help:
**19 duplicated action files** and **51 duplicated service files**. The money-critical ones
have diverged badly - `competition-end.actions.ts` is 72 KB in the main app and 38 KB in
the admin app; `challenge-finalize.actions.ts` is 70 KB against 42 KB. This is explicitly
**out of Stage 0 scope**, but it is the larger version of the same disease and should be
recorded as a known risk rather than discovered later.

## Why this becomes dangerous the moment games are added

The New Games Plan introduces `gameType` - the field that says whether a contest is trading
or trivia. It is exactly the kind of field that drifts.

If the admin's blueprint lacks `gameType` and an admin edits a Trivia contest, that contest
can silently lose its label. An unlabelled contest is treated as a trading contest. The
finalizer then tries to close forex positions that do not exist, scores every player zero,
ranks them all equal, and **pays prize money to the wrong players - with no error and no
log line.**

That is the single worst failure mode in the entire games project, and this defect is its
most likely cause. Which is precisely why it is fixed and verified before the games work
starts.

## The fix

1. **Add an automatic guard.** Built as four small modules under **`tools/model-mirror/`**:
   `parse-schema.ts` (TypeScript AST extraction), `compare.ts` (pair discovery and diff),
   `allowlist.ts` (intentional differences), `cli.ts` (the build gate).
   - Enumerates the mirrored pairs by walking both directories - no hard-coded list to go
     stale.
   - Extracts field paths **and enum values** from the AST, not with regular expressions.
     A regex over `field: {` misses nested paths, array subdocuments and the
     `type: { ... }` subdocument form, all of which this codebase uses.
   - **Fails the build** with a message naming each file, field and enum value, and which
     side is missing it.
   - Carries an **explicit allowlist**, which in the end needed exactly **one** entry:
     `admin.model.ts`. Every other difference turned out to be a real defect.
   - `npm run check:mirrors` (gate) and `npm run check:mirrors:list` (full report,
     always exits 0).
   - Wired into CI as its own step and into a new `.husky/pre-push` hook. The repo already
     used husky but had only `pre-commit`, running `lint-staged`.

   **Note on location:** this lives in `tools/`, not `scripts/`, because `.cursorignore`
   excludes `scripts/` and the guard is maintained, tested code rather than a one-off
   script.

2. **Sync the drift that already exists** - the 11 pairs above. **Only ever add fields and
   enum values, never remove them.** Removing an enum value to make two sides agree
   orphans every document already storing it.

3. **Handle the `.d.ts` files** - **DONE.** All 112 deleted on owner approval, with a
   `.gitignore` rule. See the section above for the classification rule and the two
   exceptions.

4. **Add a PR checklist item**: "model changed - mirror updated?"

### Why the allowlist has only one entry

`admin.model.ts` differs by 26 staff fields - RBAC role, permissions, lockout, presence,
support-chat availability, credential lifecycle and profile. This is deliberate: the main
app's **only** use of the model is `lib/admin/auth.ts` calling
`findById().select('name').lean()` to put a name in the header. It never creates or saves
an Admin document, so harm #2 and #3 cannot occur.

The entry records that reasoning **and the condition that would invalidate it**: if the
main app ever writes an Admin document, the entry must be deleted and the model synced,
because the lockout and permission fields that gate admin access would then be silently
discarded. An allowlist entry is a claim that two apps *should* disagree; "we have not got
round to it" is not that claim, and the guard's tests prove an entry suppresses only the
fields it names.

### The one thing the guard cannot check

It reports this itself rather than staying quiet about it, which is the important part:

```
1 enum(s) not statically comparable, so not checked
    hero-settings.model.ts:featuresColumns
```

That enum's allowed values are assembled at runtime instead of written out as a literal
list, so they cannot be read from the source text. **74 of the 75 pairs are compared in
full; `featuresColumns` is compared by field name only.** A guard that silently skipped it
would be worse than one that says so, because the silence would be indistinguishable from
a pass.

Two consequences: if that field ever gains a value on one side only, the write will be
rejected and the guard will not warn you; and if anyone rewrites the field as a literal
list, the guard starts checking it automatically with no change needed here.

## Tests that must pass

Delivered as **20 tests across two files**, all passing.

`__tests__/services/model-mirror.test.ts` - 12 tests proving the guard guards:

| # | Test | Asserts |
|---|---|---|
| 1 | Field missing from the admin copy | Reported as `main-only` |
| 2 | Field missing from the main copy | Reported as `admin-only` |
| 3 | **Enum value** missing from one side | Reported, with **no** field drift - the case a name-only check misses |
| 4 | Nested path missing from one side (the `hero-settings` shape) | Reported at its dotted path |
| 5 | Field missing inside an array subdocument | Reported at its dotted path |
| 6 | **Cosmetic differences only** - comments, key order, whitespace, different `default` / `required` / `index` / `trim` / `maxlength`, reordered enum values | Reports **nothing** |
| 7 | `type: { ... }` subdocument form vs the nested-path form | Reports **nothing** - both spell the same document shape |
| 8 | An enum computed at runtime (`Object.values(...)`) | Listed as **not checked**, rather than guessed either way |
| 9 | Allowlisted fields plus one field the entry does not name | Suppresses the two named; **still reports** the third |
| 10 | `[String]` and `{ type: [String] }` | One field each, not an element |
| 11 | Enum declared on an array element | Attached to the array's path |
| 12 | **The real repository** | Zero drift, and at least 70 pairs compared so it cannot pass vacuously |

Tests 1-5 prove it fails on drift that really happened. Tests 6-8 prove it will not cry
wolf, which matters more than it sounds: a guard that blocks a commit for a reordered
enum or a changed default gets bypassed, and then it guards nothing. Test 12 is what CI
enforces, and its lower bound on pair count is deliberate - without it, a broken pair
discovery would make the test pass by comparing nothing.

`__tests__/helpers/mirror-drift-behaviour.test.ts` - 7 tests against a real MongoDB,
establishing the severity table above rather than assuming it. These are the tests that
corrected this document.

## Risks of making this change

| Risk | Why | Mitigation |
|---|---|---|
| **Removing an enum value orphans data** | `platform-financials` drifts both ways; "making them match" by deletion would strand every document already carrying `admin_balance_add` | Add-only rule, stated in the guard's own output and in the allowlist's header comment |
| **Turning the guard on before syncing blocks all commits** | 11 pairs were drifted | Sync first, enable second, prove third - which is the order followed |
| **A guard that flags legitimate differences gets disabled** | `admin.model.ts` has 26 correct admin-only fields | The allowlist is a required feature, not a nice-to-have (tests 6-9) |
| **Fields start being written where they previously were not** | This is the point of the fix, but it *is* a behaviour change: `failedAt`, `failedReason` and `withdrawalMethod` will now persist on failed withdrawals, and admin hero-settings edits will now take effect | Additive only. No existing field changes type, becomes required, or loses an enum value, so no existing document becomes invalid |
| **Defaults differ between the two copies** | The admin copy of `hero-settings` uses `default: []` for the rich array fields, because the main app's defaults live in main-app-only helper files that the admin app must not import | Only matters if the admin app creates the singleton from nothing, which it does not in practice - the document exists. Recorded rather than papered over |

Everything here is additive. The guard can be disabled without touching application code.

## Estimated effort

**3 to 5 working days**, revised up from 2 to 3. The guard is roughly half a day; the rest
is auditing 75 pairs rather than 21, building the allowlist, and syncing 11 drifted pairs
carefully - `hero-settings` alone is 42 fields across a schema and two interfaces.

---

# The test database - RESOLVED AND BUILT, 1 September 2026

**This was the blocker on all of Defect 1. It is cleared.**

MongoDB transactions require a replica set, and every money path in Defect 1 runs inside a
transaction. When this document was written there was no way to run a transaction in a test:
`mongodb-memory-server` was not installed - referenced only in a comment in
`__tests__/helpers/db-mock.ts`, which **mocks** the database rather than running one - and
every existing test was a pure function.

**Owner decision: `mongodb-memory-server` as a single-node replica set**, chosen over a
local replica-set Mongo (does not work in CI) and a throwaway Atlas cluster (costs money and
needs credentials in CI).

Delivered as `__tests__/helpers/mongo-test-server.ts`, with `startTestMongo`,
`stopTestMongo` and `clearTestMongo`. Proven rather than assumed: its own test suite writes
across two collections in one transaction and asserts the commit is atomic and the rollback
leaves nothing behind.

Three practical notes for anyone extending it:

- **CI caches the MongoDB binary** (`~/.cache/mongodb-binaries`). Without that it is a fresh
  ~100 MB download every run, which is slow and makes the suite depend on an external host.
- **Allow ~120 s for `beforeAll`** on a cold machine, since the first run downloads the
  binary. Subsequent runs start in a second or two.
- **`clearTestMongo` in `afterEach`, not `afterAll`.** Money tests assert exact balances, so
  leakage between tests produces failures that look like logic bugs.

The local `chatvolt` database is **not** production - confirmed by the owner - so local
iteration is safe.

**Still outstanding for Defect 1's remaining tests:** the entry paths are server actions
that read the logged-in user, so they need a session/auth mocking harness on top of this.
That is the next piece of work, and it changes no production code.

---

# Optional adjacent fixes (NOT required for sign-off)

These small defects were found in the same areas. They can ride along with Stage 0 if
convenient, or be deferred into the games plan. **They are not part of the sign-off gate**
and should not delay it.

| Item | Description | Where |
|---|---|---|
| Dead Inngest crons | `lib/inngest/functions.ts` still defines competition-finalizing crons that are deliberately **not** registered in `app/api/inngest/route.ts`. If anyone re-registers them, two schedulers finalize contests concurrently - a double-payout risk. Delete them, or fence them with a comment plus a test asserting the served function list. | `lib/inngest/functions.ts` |
| `challenge_refund` never written | The value exists in the wallet transaction enum with no code that ever writes it. Either implement active-challenge cancellation, or comment it as reserved. | `wallet-transaction.model.ts` |
| Missing refund notification | `competition_refunded` is only sent from the **admin** notification service, not from the main automatic cancel path. Users refunded because a competition failed to meet minimum participants may never be told. | `competition-cancel.actions.ts` |
| Silent prize-pool correction | The finalization safeguard that caps the pool to `participants x entryFee` hides drift in the one direction it does cover. Once Defect 1 is fixed, turn it into a logged warning plus an admin alert, and add the missing under-count branch. | `competition-end.actions.ts` |
| `join-batch` has no callers | Either delete it or point it at the new entry service. Leaving a fourth divergent writer in place defeats the purpose of consolidating. | `app/api/simulator/competitions/join-batch/route.ts` |

---

# SIGN-OFF GATE

**The New Games Plan implementation does not start until every box below is ticked by the owner.**

## Owner test checklist - Defect 1 (entry paths)

- [ ] Join a paid competition through the **website UI**. Confirm in admin that the prize pool increased by exactly the entry fee.
- [ ] Join a paid competition through the **API / simulator path**. Confirm the prize pool **also** increased by exactly the entry fee.
- [ ] Confirm the prize pool on a filled competition equals `number of participants x entry fee`.
- [ ] Attempt to join with an **unverified email** through both routes. Both must refuse.
- [ ] Attempt to join with a **restricted account** through both routes. Both must refuse.
- [ ] **Accept a challenge** with a restricted account. It must refuse. (sub-defect 1b)
- [ ] Run a competition to completion. Confirm total prizes paid plus platform fee equals the prize pool exactly.
- [ ] Cancel a competition with participants. Confirm every player is fully refunded and the pool is zero.
- [ ] Open an entry-fee transaction in admin and confirm it names the competition.

## Owner test checklist - Defect 2 (model mirrors)

The guard, the sync and the tests are built. These are the checks that need a human and a
running system.

**Prove the guard guards**

- [ ] Run `npm run check:mirrors`. It reports 75 pairs, 0 drifted, 1 allowlist entry.
- [ ] Ask the developer to add a field to one side of a pair only. Confirm the check **fails** and names the file and field.
- [ ] Ask the developer to remove one enum value from one side only. Confirm the check **fails** - this is the case that rejects writes.
- [ ] Confirm `admin.model.ts`, which is intentionally different, does **not** fail.
- [ ] Confirm a `git push` is blocked while drift exists (the new `.husky/pre-push` hook).

**Prove the sync fixed real behaviour**

- [ ] Open a Game-Master-created competition in the admin panel. Confirm the Game Master is shown correctly.
- [ ] Open a card deposit in the admin transactions view. Confirm the payment provider is shown.
- [ ] **Force a withdrawal to fail.** Confirm the record now stores a failure time and the processor's reason - before this fix it stored neither.
- [ ] **Edit a landing-page section in admin that was previously unwritable** - Game Master showcase, competition types, marketplace, journey and badges, or trust badges. Save, reload, confirm the change persisted. Before this fix the save reported success and changed nothing.
- [ ] Mute challenge, social or messaging notifications as a player. Confirm the admin app now honours it.
- [ ] Record an admin balance addition and a custom expense. Confirm both still work (their enum values were added to the main app's copy).

**Decisions taken 1 September 2026 - no longer outstanding**

- [x] **Delete the orphaned `.d.ts` files.** Approved and done. The count was 112 repo-wide, not 62 - the earlier figure had only counted `database/`. `types/global.d.ts` and the websocket server's `dist` output were deliberately kept. A `.gitignore` rule prevents recurrence. Typecheck identical before and after.
- [x] **Market hours must not block joining.** Approved. Only trading itself is gated. Locked in by test 12.
- [x] **`mongodb-memory-server` as a single-node replica set** for the test database. Built and proven.

Nothing here needs your input again. The only thing left for you on Defect 2 is the test checklist above.

**One thing to be aware of, not a decision:** the mirror guard cannot statically check one enum, `hero-settings.model.ts:featuresColumns`, because its values are built at runtime. It reports this on every run rather than passing quietly. 74 of 75 pairs are fully compared; that one is compared by field name only.

## Owner test checklist - Prerequisite A (already shipped)

- [ ] After deploying `d5d3a328`, confirm `POST /api/simulator/deposit` with only `X-Simulator-Mode: true` returns **403**.
- [ ] Confirm the admin simulator still runs, or accept that it is intentionally disabled until `ENABLE_SIMULATOR=true` is set.
- [ ] Review production for evidence of prior exploitation (see Prerequisite A, "Still open").

## Automated gate

- [ ] All 11 money tests from Defect 1 pass.
- [x] All **20** mirror tests from Defect 2 pass (12 guard tests, 8 drift-behaviour tests).
- [x] Mirror check runs in CI as its own step and as a `pre-push` hook.
- [ ] The 25 simulator-auth tests from Prerequisite A still pass.
- [ ] Full production build succeeds (`next build`), per the project rule that fixes are verified in production build mode, not just dev.
  - **Note, 1 Sep 2026:** the build **compiles** cleanly, but `next build` cannot complete
    on the current machine - it fails exporting `/arena` with `ReplicaSetNoPrimary`
    against MongoDB Atlas, because static export needs a reachable database. This is
    environmental and unrelated to Stage 0, but it means the build gate cannot be
    satisfied locally without database access. Worth resolving before Defect 1, whose
    verification depends on it.

## On sign-off

Once the owner confirms both fixes work in production, proceed to `14-implementation-phases.md` starting at **Phase P1 (Foundation)**.

---

# Stage 0 summary

| | |
|---|---|
| **Scope** | Two pre-existing defects, one sub-defect, their tests, and a permanent CI guard. Plus Prerequisite A, already shipped |
| **Relationship to games plan** | **Prerequisite. Separate delivery. Separate sign-off.** |
| **Total effort** | **6 to 9 working days** (Defect 1: 3-4, plus ~1 for sub-defect 1b; Defect 2: 3-5), after the test-database decision |
| **Recommended order** | Defect 2 first - it is lower risk, self-contained, and puts the mirror guard in place before Defect 1 touches the admin copy of the entry path |
| **User-visible change** | None. This is correctness work. |
| **Rollback** | Each fix reverts independently. The mirror guard can be disabled without touching application code. |
| **Value if the games plan never happens** | Still worth doing: closes a prize-pool accounting defect, closes four bypassed security checks on one entry route and two on the challenge accept route, restores traceability between entry fees and contests, and permanently prevents a recurring class of admin/player data bug. |
