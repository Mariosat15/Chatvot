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
present and unfixed. The re-verification also corrected four claims and found four
additional defects, all recorded below.

| Date | Finding |
|---|---|
| 17 Aug 2026 | Defects 1 and 2 documented from a code audit |
| 1 Sep 2026 | Both re-confirmed present. **Corrections:** the finalize-time safeguard does **not** mask the prize-pool gap; Gate B is reached only by the simulator, not by real players; there are **four** competition-entry writers, not two; the mirror count is **75 pairs, not ~21**, of which **10** have real field drift, not three |
| 1 Sep 2026 | **New:** an unauthenticated caller could credit any wallet in production. Fixed and shipped the same day as Prerequisite A below |
| 1 Sep 2026 | **New:** the challenge *accept* path skips account restrictions and the fraud gate, on a route real players use |
| 1 Sep 2026 | **New:** Gate A writes a ledger field that is not in the schema, so production entry-fee rows carry no competition reference |
| 1 Sep 2026 | **New:** `platform-financials.model.ts` has *bidirectional* enum drift, which fails writes rather than merely hiding fields |

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
- **Production entry-fee ledger rows have no competition reference.** Gate A writes
  `referenceId: competitionId`, but `referenceId` **is not in the `WalletTransaction`
  schema** - the schema defines `competitionId` at line 129. Mongoose strict mode drops
  unknown fields, so the reference is silently discarded on every write. Nothing queries
  it today, so nothing is visibly broken, but an entry fee currently cannot be traced back
  to the contest it paid for.
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
| 9 | Entry fee ledger row | Carries a resolvable competition reference in a field the schema defines |
| 10 | Retries exhausted under sustained write conflict | Returns 409, no participant created, no debit |
| 11 | Accept a challenge while restricted / fraud-flagged | Refused (sub-defect 1b) |

Test 8 matters because there is an existing recovery process that resets a stuck
competition back to `active` after 5 minutes - so a slow finalization really can be run
twice.

## Risks of making this change

Ordered by how much they should worry you.

| Risk | Why | Mitigation |
|---|---|---|
| **Double debit via the retry loop** | The unified service wraps a wallet debit in a retry loop. A wrong re-read double-charges | Copy Gate B's structure verbatim; assert zero wallet drift across 20 concurrent joins (test 1) |
| **The union of checks is stricter than either gate** | Applying market hours to Gate A would stop players joining an *upcoming* competition at the weekend | Product decision, made deliberately before coding. Recommendation: allow joining upcoming contests outside market hours |
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
copy, the admin app becomes **blind to that field** - it cannot see it, cannot display it,
and in whole-document save operations it can strip it out.

This is not a theoretical risk. **It has already happened.**

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
| **Pairs with real schema field drift** | **10** |

The four originally documented claims are **all still true**:

| Blueprint file | Fields missing from the admin app's copy |
|---|---|
| `database/models/trading/competition.model.ts` | `gameMasterId`, `gameMasterName` |
| `database/models/trading/wallet-transaction.model.ts` | `provider`, `providerTransactionId` |
| `database/models/whitelabel.model.ts` | `brandingFiles` |
| `database/models/trading/competition-participant.model.ts` | Field sets match; the main app has 4 compound indexes the admin copy lacks |

And six more pairs drift that were not previously recorded:

| Blueprint file | Drift |
|---|---|
| `platform-financials.model.ts` | **Bidirectional.** Main has `retainedGmFeeDetails`; admin has `balanceAddDetails`, `expenseDetails` |
| `hero-settings.model.ts` | 26 marketing / Game Master / journey fields missing from admin |
| `user-bank-account.model.ts` | 5 Nuvei UPO fields missing from admin |
| `trading/challenge-settings.model.ts` | `tiePrizeDistribution` missing from admin |
| `trading/trading-position.model.ts` | `metadata` missing from admin |
| `withdrawal-request.model.ts` | Admin-only: `failedAt`, `withdrawalMethod`, `userPaymentOptionId` |

`admin.model.ts` also differs by 24 admin-only RBAC fields. **That difference is correct
and must stay** - see the allowlist risk below.

## Two severities, and one that is worse than invisibility

- **Always: invisibility.** The admin app cannot see drifted fields through its own
  models. Any admin screen that appears to show this data must be querying the raw
  database to work around the gap.
- **Only on whole-document writes: data loss.** Mongoose strips unknown fields when a
  document is replaced wholesale. Targeted `$set` updates do **not** strip other fields.
  So the realistic present-day symptom is "the admin does not show this", not "money
  disappeared".
- **New, and worse: write rejection.** `platform-financials.model.ts` drifts in *both*
  directions. The admin schema's `transactionType` enum includes `admin_balance_add` and
  `custom_expense`; the main app's does not. A missing enum value is a **validation
  failure at write time**, not merely a field you cannot read.

## The stale type declarations

`database/models/whitelabel.model.d.ts` is a hand-maintained third file and has fallen
**eleven fields** behind: `brandingFiles`, `favicon`, `seoTitle`, `seoDescription`,
`ogImageUrl`, `siteUrl`, `redisHost`, `redisPort`, `redisPassword`, `pexelsApiKey`,
`ipIntelligenceApiKey`. There is no admin equivalent.
`database/models/trading/wallet-transaction.model.d.ts` is stale too, missing several
`transactionType` values including `chargeback_clawback` and the `gamemaster_*` family.

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

1. **Add an automatic guard** - `scripts/check-model-mirrors.ts`:
   - Enumerates the 75 mirrored pairs (do not hard-code a stale list - derive it).
   - Extracts schema field names and enum values from each side and compares them.
   - **Fails the build** with a readable diff when they diverge.
   - Carries an **explicit allowlist of intentional differences**, starting with
     `admin.model.ts`'s 24 RBAC fields and `withdrawal-request.model.ts`'s admin-only
     fields.
   - Runs in CI and as a pre-push hook. The repo already uses husky, but currently only
     `pre-commit` exists and it only runs `lint-staged` - there is no `pre-push` hook yet.
2. **Sync the drift that already exists** - the 10 pairs above. **Only ever add fields and
   enum values, never remove them.**
3. **Include the special cases** - the two stale `.d.ts` files.
4. **Add a PR checklist item**: "model changed - mirror updated?"

## Tests that must pass

| # | Test | Asserts |
|---|---|---|
| 1 | Run the mirror check on the repo as-is, after syncing | Passes cleanly |
| 2 | Deliberately add a field to one side of a pair only, then build | **Build fails** with a clear message naming the file and field |
| 3 | Deliberately add an enum value to one side only | **Build fails** |
| 4 | Write a competition in the player app, edit it in the admin app, re-read it | Every field survives, including `gameMasterId` |
| 5 | Read a Game-Master-created competition through the admin model | `gameMasterId` and `gameMasterName` are visible |
| 6 | Read a deposit transaction through the admin model | `provider` and `providerTransactionId` are visible |
| 7 | Write a `PlatformTransaction` with `admin_balance_add` from **both** apps | Both accept it |
| 8 | An intentionally-different pair (`admin.model.ts`) | Does **not** fail the check |

Tests 2 and 3 are the important ones - they prove the guard actually guards, rather than
being a script that always passes. Test 8 proves it will not cry wolf.

## Risks of making this change

| Risk | Why | Mitigation |
|---|---|---|
| **Removing an enum value orphans data** | `platform-financials` drifts both ways; "making them match" by deletion would strand every document already carrying `admin_balance_add` | Add-only rule, stated in the script's own comments |
| **Turning the guard on before syncing blocks all commits** | 10 pairs are drifted today | Sync first, enable second, prove third |
| **A guard that flags legitimate differences gets disabled** | `admin.model.ts` has 24 correct admin-only fields | The allowlist is a required feature, not a nice-to-have (test 8) |
| **Admin whole-document saves change behaviour** | After the fix the admin preserves fields it used to strip - that is the point, but it is a behaviour change | Covered by test 4 |

Everything else here is additive. Adding a field to an admin schema stops it stripping
that field; the guard can be disabled without touching application code.

## Estimated effort

**3 to 5 working days**, revised up from 2 to 3. The script is roughly half a day; the
rest is auditing 75 pairs rather than 21, building the allowlist, and syncing 10 drifted
pairs carefully.

---

# BLOCKER - the test database (resolve before writing any code)

MongoDB transactions require a replica set, and every money path in Defect 1 runs inside a
transaction. There is currently **no way to run a transaction in a test**:

- `mongodb-memory-server` is **not installed**. It is referenced only in a comment in
  `__tests__/helpers/db-mock.ts`, which **mocks** the database rather than running one.
- All existing tests are pure functions. Vitest is configured (`vitest.config.ts`,
  `npm test`), CI runs `npx vitest run` on push to `main`, and `apps/admin` has no test
  setup at all.

The eight-to-eleven money tests Defect 1 depends on cannot be written until this is
decided. The options:

| Option | Notes |
|---|---|
| `mongodb-memory-server` as a single-node replica set | Self-contained, no external dependency, works in CI. Adds a dev dependency and some start-up time |
| A separate database on a local replica-set Mongo | Fast, but does not work in CI without the same setup |
| A throwaway Atlas cluster | Closest to production; costs money and needs credentials in CI |

**Recommendation:** `mongodb-memory-server` configured as a single-node replica set, since
it is the only option that also works in GitHub Actions.

The local `chatvolt` database is **not** production - confirmed by the owner - so local
iteration is safe.

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

- [ ] Open a Game-Master-created competition in the admin panel. Confirm the Game Master is shown correctly.
- [ ] Open a card deposit in the admin transactions view. Confirm the payment provider is shown.
- [ ] Edit a competition in the admin panel, save, then re-open it. Confirm no information was lost.
- [ ] Ask the developer to demonstrate the build **failing** when a field is added to only one side of a mirrored pair.
- [ ] Ask the developer to demonstrate the build **passing** for `admin.model.ts`, which is intentionally different.

## Owner test checklist - Prerequisite A (already shipped)

- [ ] After deploying `d5d3a328`, confirm `POST /api/simulator/deposit` with only `X-Simulator-Mode: true` returns **403**.
- [ ] Confirm the admin simulator still runs, or accept that it is intentionally disabled until `ENABLE_SIMULATOR=true` is set.
- [ ] Review production for evidence of prior exploitation (see Prerequisite A, "Still open").

## Automated gate

- [ ] All 11 money tests from Defect 1 pass.
- [ ] All 8 mirror tests from Defect 2 pass.
- [ ] Mirror check runs in CI and blocks merges on drift.
- [ ] The 25 simulator-auth tests from Prerequisite A still pass.
- [ ] Full production build succeeds (`next build`), per the project rule that fixes are verified in production build mode, not just dev.

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
