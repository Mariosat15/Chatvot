# 17 - Risk Register

Two classes of risk. **Platform risks (R-series)** are ways the existing application can
break while being generalised - they apply whoever supplies the games. **Scenario risks
(X-series)** exist only because a third party is on the critical path.

`07-failure-modes-and-edge-cases.md` covers runtime failures during a contest. This
chapter covers risks to the programme and to the application.

---

## 1. Summary

| ID | Risk | Severity | Likelihood | Phase |
|---|---|---|---|---|
| **R1** | Money paths refactored without tests first | Critical | High | **X0** |
| **R2** | Admin mirror drift | Critical | **ALREADY OCCURRED** | **X0** |
| **R3** | Trading settlement runs against a provider contest | Critical | High | X1, X5 - **CLOSED 4 Sep 2026** |
| **R4** | Double finalization pays twice | Critical | Medium | X0, X1 |
| **R5** | Dead Inngest crons re-registered | Critical | Low | X0, X1 |
| **R13** | Ledger enum renamed | Critical | Low | X1, X8 |
| **R26** | Admin-app finalization pays no Game Master earnings | Critical | **ALREADY OCCURRED** | X1 or X5 - **CLOSED 5 Sep 2026**, not retroactive |
| **X1** | Abstraction cannot be proven without the provider | **High** | **High** | X4 |
| **X2** | Single supplier on the critical path | **High** | Medium | All |
| **X3** | No cost floor - per-round fee kills cheap contests | **High** | Medium | Before X4 |
| **X7** | Game Master provider contest is net loss-making | **High** | **High** if ungated | Before X6 |
| **X8** | **No fallback game** now external-only is decided - X2 with its mitigation removed | **High** | Medium | Before X4 - **mitigation approved 5 Sep 2026 (X4a, `21`), STILL OPEN until it ships** |
| **X13** | Trading-only matchmaker silently returns trading matches on a games platform | **High** | **High** | X11.5 |
| **X14** | Inferred game interest read as consent to stranger invitations | **High** | Medium | X11.5 |
| **R29** | **Disabling a game retroactively demotes players** who earned levels, points or ranks in it | **High** | **High** | **X1** - the design decision is made there |
| **R30** | `distributePrizesWithTies` took a **fraction** from a parameter named `platformFeePercentage`; a caller passing `10` paid **negative prizes** | **High** | Medium | **CLOSED 4 Sep 2026** - renamed to `platformFeeFraction` and range-checked in both apps |
| R6 | Price infrastructure broken by gating | High | Medium | X8 |
| **R7** | Raw-driver contest inserts miss the game label | High | High | **CLOSED 4 Sep 2026** - **six** writers found, not one; all stamp `contestGameLabel()`, pinned by a test that counts labels against inserts |
| R8 | Bulk find-and-replace on wording | High | Medium | X8 |
| R9 | Fraud throttle blind to provider entries | High | High | X5 |
| R11 | Legal wording changed without review | High | Medium | X8 |
| R12 | Badge or milestone IDs renamed | High | Medium | X7 |
| R17 | Disabling trading strands active contests | High | Medium | X8 |
| X4 | We cannot fix the provider's game | Medium | High | X12 |
| X5 | Provider will not supply page content | Medium | Medium | Before X4 |
| X6 | Registry gets only one real implementation | Medium | High | X9 |
| R10 | Market-hours settings block provider contests | Medium | High | X1 |
| R14 | Leaderboard migration changes rankings | Medium | High | X7 |
| R18 | Trading providers hoisted to a shared layout | Medium | Medium | X7 |
| R19 | Component move breaks imports | Medium | Medium | X7 |
| R20 | `startingCapital` required blocks provider contests | Medium | Medium | X1 |
| R21 | Dashboard mega-action split | Medium | Medium | X7 |
| R22 | New admin sections invisible - RBAC | Low | High | X6 |
| R23 | Notification links point to `/trade` | Medium | High | X6 |
| R31 | A Game Master rate configured at 0% is treated as unset | Medium | **CLOSED 5 Sep 2026.** Latent, not occurred - the admin UI could not store a 0% rate | Fixed in its own commit |
| R32 | Provider scores never reached `participant.score`, so every player tied at zero and split the pool equally | **High** | **CLOSED 5 Sep 2026.** Latent - no provider contest has ever settled, so nothing to backfill and the fix is **not** retroactive | `lib/services/games/participant-score.service.ts`, gate 11b |
| R33 | `scoreDirection` was read from a field neither participant copy declared, so a lower-is-better game paid the slowest player first | **High** | **CLOSED 5 Sep 2026.** Latent, same reason as R32 | `resolveContestScoreDirection` reads the catalogue title once |
| R34 | **The platform cannot honour the callback authentication its own issued spec promises.** `01` s2.2 and the requirements HTML both promise `Bearer {CALLBACK_TOKEN}`, "a token we issue to you". No such field exists - `gameProviderCredentials` holds `apiKey`, `apiSecret` and `callbackSecret`, the credentials dialog offers three inputs, and `loadProviderSecrets` sets `callbackToken: credentials.apiKey`. So gate 3 expects a provider to authenticate **inbound** with the credential they issued us for **outbound** calls | Medium | **OPEN, found 6 Sep 2026 by X4a.** Latent - no real provider exists and the mock uses its own header. **Not workaroundable by configuration**, because there is nowhere to type the value. A conforming provider is rejected and logged as "either credentials are wrong or someone is probing the endpoint", so a correct integration **reads as an attack** | Additive `callbackToken` on both `whitelabel.model.ts` copies, `callbackToken \|\| apiKey` in `loadProviderSecrets` for backward compatibility, and a fourth credentials input. Blocks the X4a end-to-end rehearsal |
| R24 | Scope creep before anything ships | Medium | **High** | All |
| R25 | Round write contention under load | Medium | Medium | X12 |
| X15 | "Challenge any user" harassment surface - no report-user feature exists | Medium | Medium | X10 |
| X16 | Overall rank used instead of per-game rating when matching | Medium | Medium | X11.5 |
| X17 | Matchmaking creeps into a recommendation engine | Medium | Medium | X11.5 |
| X18 | Empty matchmaking at launch - nobody has declared interests | Medium | High | X11.5 |

---

## 2. Critical platform risks

### R1 - Money paths refactored without tests first - LARGELY CLOSED 1 September 2026

**Four** competition-entry writers existed and **they disagreed about money**.
`enterCompetition` in `lib/actions/trading/competition.actions.ts` incremented both
`currentParticipants` and `prizePool`. `app/api/competitions/[id]/join/route.ts` incremented
only `currentParticipants`. So did `app/api/simulator/competitions/join-batch/route.ts`. The
admin mirror of `enterCompetition` did update the pool but omitted the email check and the
fraud gate.

The API route also skipped **four** checks the action performed: email verification, user
restrictions, the fraud gate, and the level requirement.

**All four are now resolved.** `lib/services/contest-entry.service.ts` is the single entry
path; the two real gates are thin wrappers over it, the simulator batch route was fixed in
place, and the dead admin copy was deleted. The prize pool grows by every fee taken, in the
same transaction that takes it, on every path.

Re-verified 1 September 2026, with two corrections still worth carrying:

- The finalize-time safeguard that caps the pool to `currentParticipants x entryFee`
  **did not mask this**. It only fires when the pool is too *high*
  (`competition-end.actions.ts` 695-718), so an under-counted pool was under-distributed with
  no correction and no log line. **The under-count branch is still missing** - the safeguard
  has not been changed, so this remains true for any future writer that forgets the increment.
- The API route was reached **only by the simulator service**; both real join buttons called
  `enterCompetition`. So no paying customer was affected, which is why the fix needed no
  migration.

**Two things remain open, and neither should be assumed closed by the above.**

A related defect on a path real players **do** use: the challenge *accept* route
(`app/api/challenges/[id]/accept/route.ts`) skips account restrictions and the fraud gate,
and it is where both wallets are debited. **Proven by test on 1 September 2026 and NOT
fixed.** Sub-defect 1b, awaiting a decision on whether it ships inside X0.

A **new** finding of the same class surfaced in the fraud layer rather than the money layer -
read-then-create against a unique index on `SuspicionScore`, losing suspicion scores under
concurrency. It appeared only because coordination detection started running on both entry
paths. **Found and fixed the same day**; recorded as R28, which also corrects the site count
(five, not three) and records a second race the first fix exposed. It matters to this
programme because provider contests will multiply concurrent entries.

Building a new score path on top of the original mess would have meant debugging two problems
at once with real money involved. **Both halves are now done** - the competition gates were
unified first, then challenge accept was given the same restriction and fraud guards via the
shared `checkAccountStanding`. A third defect was found while documenting the second: the
ledger's `challengeId` was declared on **neither** app's `WalletTransaction`, so **nine**
writers spanning challenge entry, refunds and payouts had it silently discarded, leaving the
whole challenge money trail unattributable. Also fixed the same day.

### R2 - Admin mirror drift (a confirmed defect, not a prediction)

Counted on 1 September 2026: **75 model files** exist twice - once in the main app, once in
`apps/admin` - of which 38 are byte-identical and **11 have real schema drift**. The
original figure of "roughly 21" was an undercount. On top of the models, **19 action files
and 51 service files** are duplicated the same way.

| Model | Drift |
|---|---|
| `competition.model.ts` | Admin missing `gameMasterId`, `gameMasterName` |
| `wallet-transaction.model.ts` | Admin missing `provider`, `providerTransactionId` |
| `whitelabel.model.ts` | Admin missing `brandingFiles` |
| `hero-settings.model.ts` | Admin missing **42** marketing / Game Master / journey / enterprise fields |
| `user-bank-account.model.ts` | Admin missing 5 Nuvei UPO fields |
| `platform-financials.model.ts` | **Bidirectional** - each side has fields the other lacks, and the main app rejected two of the admin's enum values |
| `trading/challenge-settings.model.ts` | Admin missing `tiePrizeDistribution` |
| `trading/trading-position.model.ts` | Admin missing `metadata` |
| `user-notification-preferences.model.ts` | Admin missing `categoryPreferences.challenge`, `.social`, `.messaging` |
| `withdrawal-request.model.ts` | **Main** missing `failedAt`, `withdrawalMethod`, `originalCardDetails.userPaymentOptionId` |
| `trading/competition-participant.model.ts` | Fields match; admin lacks 4 compound indexes |

There were also **112 committed declaration files** (57 `.d.ts` + 55 `.d.ts.map`) that
looked like stale third copies. They turned out to be orphaned build output from February
2026 and provably inert - TypeScript resolves the sibling `.ts` first. **All deleted on
1 September 2026**, with a `.gitignore` rule. They are not a third copy to keep in step, and
provider-related models must not acquire one.

#### What drift actually does - measured, and not what these documents used to say

Both plans claimed the main harm was that "the admin app cannot see the field" and that "a
whole-document save strips it". Measured against a real MongoDB on 1 September 2026, both
claims were wrong. Evidence: `__tests__/helpers/mirror-drift-behaviour.test.ts`.

Drift is a **write-side** defect, in descending order of harm:

1. A **missing enum value rejects the entire write.** The record is never created.
2. The narrower app **cannot write the field** - `create`, assignment-then-`save` and `$set`
   all discard it silently while reporting success.
3. `replaceOne` / `findOneAndReplace` **do delete** undeclared fields.
4. An ordinary `save()` does **not** delete them. The old claim was wrong.
5. `.lean()` and `toObject()` do **not** hide them. The old claim was wrong.
6. **But ordinary `doc.field` access returns `undefined`** - Mongoose defines getters only
   for declared paths. Severe, and the subtlest of the six: the field survives a debug dump
   while the code beside it reads nothing. This is how `whitelabel.brandingFiles` disabled
   branding-image recovery in three admin routes without anyone noticing.
7. **A synced schema is not a working feature.** `brandingFiles` had a *second*, independent
   defect underneath the drift: the upload routes key the map by filename, and **Mongoose
   refuses map keys containing a dot**, so no entry had ever been stored in either app. The
   sync merely changed the failure mode - an undeclared field let a plain `Map` accept the key
   and discard the write; a declared one hands the route a `MongooseMap` that validates and
   throws. Both were silent. The guard proves two copies agree, not that either works, so a
   drift fix must be followed by a test that actually round-trips the data.

**Why this matters for a provider integration specifically:** the danger to a game label is
not that "an admin save strips it". It is that **the admin app cannot set it at all**. A
path that must write `gameType` - or a provider's `roundId`, or a score - fails silently and
reports success. An unlabelled contest reads as trading, and trading settlement then runs
against a provider contest: R3, silently, with prizes attached.

Harm 6 has a second edge that is specific to this programme. Callback-handling code will
naturally be written as `if (round.providerRoundId === payload.roundId)` or
`if (!round.contentSeed) { ... }`. If the field is missing from that app's copy, the read is
`undefined` and the branch inverts - a replayed callback passes an idempotency check it
should fail, or a seeded round is treated as unseeded. **Never gate provider logic on a
field without confirming the guard passes on the model that declares it.**

And point 1 is the reason the guard must compare **enum values**, not just field names. When
provider result statuses (`completed`, `abandoned`, `expired`, `voided`) become an enum, a
copy missing one of them will **reject** the result callback rather than mis-store it - so a
finished round is never recorded, and the contest never settles.

Fixed in X0 by **`tools/model-mirror/`** in CI and as a `pre-push` hook, so it cannot recur.
(It lives in `tools/`, not `scripts/`, because `.cursorignore` excludes `scripts/`.) Two
requirements held: it compares **enum values as well as field names**, and it carries an
**allowlist** - `admin.model.ts` legitimately differs by 26 staff fields, and a guard that
cries wolf gets switched off. In the end the allowlist needed exactly **one** entry; every
other difference was a real defect. Syncing is **add-only**; removing an enum value to
force a match orphans every document already carrying it.

### R3 - Trading settlement runs against a provider contest - **CLOSED 4 September 2026**

The highest-consequence risk in the programme.
`lib/actions/trading/competition-end.actions.ts` (~**1,500 lines** when this was written,
**1,174** since the X5 extraction); steps 2-4 close forex positions and recalculate PnL.
Pointed at a provider contest it finds no positions, computes zero for everyone, ranks
everyone equal, and **pays prizes to the wrong players without erroring**.

**Two facts in the original entry were wrong, and both are corrected in `11` section 2
seam 3, which is the authoritative count.** There are **ten** call sites in the main app,
not five - the list below missed both `early-end-check` calls, the `claim-early-end` route
and a finalize invoked from a **page component**, and `POST /api/finalize-old-competitions`
**does not exist at all**. The original list is kept here only so the correction is legible:

1. `worker/jobs/competition-end.job.ts`
2. `worker/jobs/challenge-finalize.job.ts`
3. Lazy auto-finalize inside `getCompetitionById`
4. `POST /api/finalize-old-competitions` - **this route does not exist**
5. The admin emergency-cancel route

**Mitigation as originally written:** dispatch at all five, plus an assertion in the trading
settle path that aborts if the game type is not trading. Loud failure is recoverable.

**What was actually built, and it is deliberately not the above.** Dispatching *at the call
sites* is only correct while the list is complete and stays complete, and this codebase adds
finalize callers. The dispatch went **inside** `finalizeCompetition` and `finalizeChallenge`
instead - four dispatch points across two apps rather than ten and counting - so every
caller is correct by construction, including the ones nobody has written yet. X1 built the
refusal (`routeToTradingSettlement`, 19 tests); **X5 built the provider path it refuses in
favour of** (`resolveSettlementPath` plus `lib/services/settlement/`).

**Why this is closed rather than reduced.** The dangerous outcome was a provider contest
being *paid out by trading logic*. That is now impossible in three independent ways: the
gate refuses before the optimistic lock is taken, a second gate inside the attempt function
refuses after it and restores `active`, and the provider path composes the shared money
stages rather than the trading ones. The five trading payout tests and the golden ranking
regression are byte-identical throughout, which is what makes the extraction credible.

**One related exposure is NOT closed by this and keeps its own entry:** the challenge path was
not extracted (`challenge-finalize.actions.ts`, 1,803 lines in the main app against 1,182 in
admin, its own copy of all three stages in each - X10). **R26 was the second, and it is now
closed** (5 Sep 2026) - the admin cron's finalize copy calls the shared fee-and-referral stage.
Correct as history, stale as a present fact, so say which.

### R4 - Double finalization

A contest stuck in `finalizing` resets to `active` after **5 minutes**, so double
invocation is a real path. `settleContest()` must be **idempotent** and must refuse to
write a second `competition_win` ledger entry for an already-settled contest.

### R5 - Dead Inngest crons

`lib/inngest/functions.ts` defines `updateCompetitionStatuses`, `monitorMarginLevels`,
`updatePriceCache` and `processTradeQueue` on `* * * * *`. They are **not registered** in
`app/api/inngest/route.ts`, so they do not run. Registering them later would start four
unguarded trading crons against contests that may not be trading contests. **Delete or
fence them.**

### R13 - Ledger enum renamed

`competition_entry`, `competition_win`, `challenge_entry` and siblings are stored values
in the financial ledger. Renaming one orphans financial history and breaks reconciliation.
Covered by the never-rename list in `14` section 6.

### R26 - Admin-app finalization pays no Game Master earnings (FIXED 5 Sep 2026)

**A live defect found while writing `19`, not a prediction.** An instance of R2, but severe
enough on its own to have an ID. **Unlike most entries here it was actively losing money**,
not latent: both apps run `checkAndFinalizeCompetitions` on an every-minute cron, so whether
a referrer was paid depended on nothing more than which cron claimed the contest first.

`lib/actions/trading/competition-end.actions.ts` contains roughly 500 lines of Game Master
earnings logic at lines 931-1459. The admin mirror,
`apps/admin/lib/actions/trading/competition-end.actions.ts`, contains **none of it** - only
`isGmCreated` on platform-fee recording at line 709.

A competition finalized through the admin app therefore pays **no Game Master earnings at
all**, and does not record a `retained_gm_fee` either. The money simply stays with the
platform, silently, with no ledger entry explaining why. A Game Master comparing their
dashboard against contests their referred players entered would find a gap they cannot
account for.

**Mitigation:** fix in X1 or X5. It is a prerequisite for the Game Master acceptance
criteria in `19` section 7, and the mirror-drift CI check from X0 should have caught it -
verify the check covers action files, not only models.

**Closed 5 September 2026.** `apps/admin/lib/actions/trading/competition-end.actions.ts` now
calls `settleFeesAndGameMasters` - the same shared stage the main app calls - in place of its
inline fee arithmetic. Pinned by `__tests__/services/admin-finalize-gamemaster-parity.test.ts`
(5 tests, 5 probes, `tools/probe-admin-gm-parity.ps1`), which runs **both apps' finalize
functions over identical fixtures and compares every ledger row**, rather than asserting that
the admin app pays *something*.

**The fix is not retroactive, and this is the part to state plainly rather than let a summary
round up.** Every competition already finalized by the admin cron paid its Game Masters
nothing, and there is no `retained_gm_fee` row marking those either - so the gap cannot be
found by querying for retained rows, only by reconciling referred players' entry fees against
earnings per contest. **No backfill was written.** Doing it correctly needs an owner decision
about which historical contests to compensate, and a script that credits wallets from
inferred history is a money writer nobody has reviewed.

**Two things the fix had to get right, both of which the caution below predicted.**

- **The platform-fee RECORD had to change with it, not just gain a payout beside it.** The
  Game Masters' share is carved *out* of the platform fee, so the figure booked as platform
  income must be net of the commission. Paying a referrer while still recording the gross fee
  counts the same credits twice in two different books - a reconciliation defect that would
  have looked exactly like a correct fix on review, which is why the parity suite asserts the
  net figure explicitly rather than only the earnings row.
- **It is genuinely not four copies of one function.** The admin `finalizeCompetition` has no
  retry wrapper and no optimistic lock, loading the competition inside the transaction
  instead, so its idempotency comes from a `status !== "active"` guard rather than from the
  lock. That matters for the test: the first idempotency probe was aimed at the duplicate
  check inside `distribute.ts` and **stayed green**, because a second finalize refuses at the
  status guard long before the referral stage runs. The probe was re-aimed at the guard that
  actually provides the property. **A probe that stays green is a question, not an answer** -
  here the claim in the test's comment was wrong, and the comment was corrected.

**And one claim this work disproved, recorded because it was written in three files.** The
comments on `PrizePayoutResult.walletMap` and `DistributeGmFeesInput.walletMap` asserted the
map "matters for correctness, not just query count" - that a Game Master who also won a prize
needed it so their commission's `balanceBefore` came out after the prize. The concern is real;
the map is not what answers it. Both stages read the post-credit balance back from
`findOneAndUpdate({ new: true })`, and neither reads a balance out of the map at all - it is
used only to decide whether a wallet must be created. **A control probe passing an empty map
moves identical money and must stay green.** Comments corrected in both copies.

**A note on the size heuristic that found R26 in the first place, because it has just become
much weaker.** The gap was the tell: `competition-end.actions.ts` was 72 KB in the main app
against 38 KB in the admin app, and a 34 KB difference between two files that are supposed to
be copies is worth reading. It is now **45 KB against 37 KB** - and *not* because the admin
copy gained the missing logic. The main app shed ~27 KB into
`lib/services/settlement/`, which both apps share. So the same heuristic applied to the same
pair today would raise no flag, while the identical defect in the **challenge** path is still
there to find: `challenge-finalize.actions.ts` is **70 KB against 42 KB**, and it still holds
its own copy of all three settlement stages in both apps. **Extracting shared code hides
divergence from a size comparison**, which is an argument for the parity test rather than
against the extraction. The duplicated **services and actions** remain the larger version of
R2, and a field-comparison script cannot help with either.

### R27 - Internal routes authenticated by a plain header (FIXED 1 Sep 2026)

**Was a live, exploitable defect in production.** Recorded because the *class* of mistake
will recur in this programme, which adds a provider webhook and internal round endpoints.

The `/api/simulator/*` routes guarded themselves with `if (!isSimulatorMode && !isDev)` - an
`AND` of two negatives that any caller satisfied by sending `X-Simulator-Mode: true`. There
is no `middleware.ts` in the repository, so nothing blocked the path at the edge. An
unauthenticated request to `POST /api/simulator/deposit` credited any wallet by user id and
raised `totalDeposited`, so the balance looked like a genuine funded deposit to withdrawal
eligibility. Two **money** routes - `competitions/[id]/join` and `challenges` - read the same
headers raw and acted as the named user. Three further internal routes fell back to
guessable default secrets (`"simulator-cleanup"`, `"internal-key"`).

Fixed in commit `d5d3a328`: fail-closed authentication requiring the header,
`ENABLE_SIMULATOR=true` and a constant-time `INTERNAL_API_SECRET` match, applied through one
shared guard, with 25 tests of which ten assert the real route handlers return 403.

**Why it stays in the register:** `06-trust-security-and-disputes.md` specifies HMAC signing
for the provider callback, and the same three mistakes are available there - a guard that
fails open when the secret is unset, a check that is never actually called by the route, and
a bypass header trusted because it is convenient in development. Two rules follow, and
X-phase acceptance should hold them: **never let an authentication helper accept a request
because configuration is missing**, and **test the route, not just the helper.**

A third rule, added 1 September 2026 while unifying the entry paths: **do not name a flag
after where the call came from.** The original design for the entry service took a
`source: "web" | "api" | "simulator"` parameter. It was replaced with `trusted`, which says
what it actually permits - skipping three person-level gates that a synthetic user cannot
satisfy, and nothing else. A `source` value is an open invitation for the next change to hang
unrelated behaviour off it, which is precisely how the bypass header above came to exist.

**Third occurrence, 2 September 2026, and it promotes this from an incident to a class.**
`app/api/fraud/suspicion-score/route.ts` in the **player** app carried `// Admin only` on
its GET, POST and DELETE handlers while every one of them checked only that *some* session
existed. Any signed-in player could read the entire high-risk list, **raise a rival's fraud
score to lock them out of a paid competition**, or clear their own. It was deleted rather
than guarded: nothing called it, and the admin app holds a `verifyAdminAuth`-protected copy.

The rule to carry into the X phases is therefore stronger than "test the route": **a comment
asserting an authorization check is not evidence that one runs, and a route nothing calls is
still reachable over HTTP.** Both provider-facing endpoints in `01` and `06` and every new
admin route must be tested by calling them as an ordinary player and asserting 403. Dead
routes get deleted, not left for a future reviewer to assume are guarded.

---

### R28 - Read-then-create races on unique-indexed fraud records (found and FIXED 1 Sep 2026)

**Closed.** Kept in the register because the defect class recurs and this programme
multiplies exactly the conditions that trigger it.

`SuspicionScore` carries a unique index on `userId`, and the code did `findOne` then `create`
against it. **Two corrections to the first record of this risk**, both found by measuring
rather than reading: there were **five** call sites, not three, and **two distinct races**,
not one.

The first race is the read-then-create. Measured with twenty detectors arriving together for
a user with no score yet: **seventeen threw duplicate-key 11000 and their contributions were
lost.** The second was only visible once the first was fixed - `updateScore` did a
read-modify-write of `totalScore`, so concurrent updates clobbered each other and the total
disagreed with the breakdown it was supposedly derived from.

**Fixed** with `findOneAndUpdate` + `upsert` + `$setOnInsert` for creation, and an
aggregation-pipeline update that recomputes `totalScore` and `riskLevel` **server-side** from
the persisted breakdown, so no read-modify-write window exists. The three ad-hoc call sites
now route through `SuspicionScoringService.updateScore` instead of reimplementing it. Proven
by `__tests__/services/suspicion-score-race.test.ts`, written before the fix.

**How it was found still matters more than the bug.** It appeared as duplicate-key noise in
test output only after coordination detection started running on *both* entry paths, which the
unification did. Before that, Gate B skipped the detector entirely - so the race was invisible,
and so was the fact that **a fraud control could be avoided by choosing an entrance.**

**The lesson to carry into provider work:** a read-then-insert behind a unique index is a bug
wherever it appears, and fixing the first race can expose a second in the same function. Do not
stop measuring at the first green test.

---

## 3. The scenario risks

Restated from `10` section 4 for the register, since this is the file a reviewer reads.

### X1 - The abstraction cannot be proven without the provider

**The most important risk in the external-only scenario.** With an in-house game the
registry is validated by code we control. Here, X4 onward is blocked on someone else's
sandbox. A provider slow to grant access stops the programme after roughly five weeks of
investment, with nothing player-visible to show.

**Mitigation:** the mock adapter in X2 is built first precisely so X2, X3 and much of X6
to X8 proceed without a provider. Get a **committed sandbox date** in the commercial
discussion, not a promise.

### X2 - Single supplier on the critical path

If the provider terminates, raises prices or fails commercially, the platform reverts to
trading only and every week of games work is stranded. There is no in-house fallback game.

**Mitigation:** the adapter boundary keeps replacement to one folder - but only if
exercised (X6 below). Evaluate a second provider before public launch even if only one goes
live. Consider the in-house insurance game in `10` section 5.

### X3 - No cost floor

An in-house game costs nothing per contest, so free and low-fee acquisition contests are
always viable. A per-round provider fee can make exactly those contests loss-making.

**Mitigation:** model pricing with `08` section 3 **before X4**, and measure it on the
Game Performance screen in `12` section 5. Launch with a low maximum concurrent contest
count and a maximum entry fee, per `09` section 5.

### X4 - We cannot fix their game

A dull game, a scoring quirk, a mobile defect or a bad translation is a support ticket to a
third party, not a sprint task.

**Mitigation:** the staged pilot in `08` section 5 measures repeat play before commitment.
Per-title enable switches mean one bad game is switched off in seconds.

### X5 - Provider will not supply page content

Each title needs a game page - description, rules, artwork, localised. `01` section 3.1
makes it contractual. A provider who declines is transferring that cost to us per title,
forever.

**Mitigation:** raise it during commercial discussion. It is in the provider-facing
requirements document and in the evaluation questions.

### X6 - The registry gets only one real implementation

The contract's whole promise is that a second game costs one folder. With trading plus one
provider module, that claim is never tested.

**Mitigation:** write a second adapter skeleton during X9 even if unused. It is already in
the definition of done in `09` section 7.

### X7 - A Game Master provider contest is net loss-making

A sharper, specific case of X3, and the one most likely to be missed because every
individual component behaves correctly.

A Game Master's referral share is a percentage of the **entry fee**, computed at
finalization before any provider cost exists, and the existing safety cap is against the
**gross** platform fee. Twenty players at 1.00 with a 10% tier and a 2c per-round provider
fee: platform fee 2.00, Game Master share 2.00, provider cost 0.40, **platform result
-0.40**. `best_of_n` attempts multiply the provider cost while the entry fee stays fixed.

Trading never exposed this because a trading round costs nothing to run.

**Mitigation:** `limits.allowedGameTypes` defaults to `["trading"]`, so Game Masters cannot
create provider contests until the share is computed on **net** platform fee after provider
cost. They still earn from referred players in admin-created provider contests from day
one, because earning follows referred players rather than created contests. Add a minimum
entry fee for Game Master provider contests, and assert non-negative platform margin by
test. Full analysis in `19` section 5.

### X8 - No fallback game now that external-only is decided

**Raised 2 September 2026**, when the scenario was decided. Not a new risk - it is X2 with
its mitigation removed. While the scenario was open, "build a small in-house game as
insurance" was a live option that could be taken at any point. The decision closes the
add-on route, and if the provider search or the pricing fails, the platform will have
funded the entire foundation, admin and player programme and still have exactly one game.

**Mitigation:** open question 10 in `PROGRESS.md` was moved forward to **before X4** -
the last point at which the answer is still cheap, since X4 is where spend starts going
against a specific provider's sandbox. Keeping a two-to-three week in-house game on the
backlog converts X2 and X8 from existential to inconvenient. `10` section 5.

**Mitigation APPROVED 5 September 2026, and the risk STAYS OPEN.** Open question 10 was
answered yes: phase **X4a** (`21`) builds a real in-house game to a player-facing standard,
which also serves as the reference implementation that proves the provider seam. **Do not
downgrade this entry on the strength of that.** Until the game is playable the exposure is
exactly what it was, and the whole failure mode of a risk register is entries marked mitigated
because a plan exists. Close it when a player can pay to enter the in-house game and be paid,
not when the chapter is written.

**Two notes for whoever closes it.** The mitigation is **cheaper than the 2-3 weeks estimated
above for a reason worth knowing**: because the game speaks the provider protocol rather than
being an in-house game *module*, it needs none of `New games plan` P1/P2's module architecture,
and it doubles as the reference implementation - so a single piece of work reduces X8, X1 (the
abstraction cannot be proven without the provider) and X6 (the registry gets only one real
implementation) at once. Against that, it **adds** the burden the external-only decision was
taken to avoid: the platform now owns a game's content, balance and support for ever. And note
what it does *not* touch - **X3, the per-round cost floor, is a commercial unknown about a
provider's pricing**, and a game of our own that costs nothing per round tells us nothing about
it. A summary implying X4a de-risks the commercial question is wrong.

### X13-X18 - onboarding and matchmaking

**Added 2 September 2026** with chapter `20`. Listed in full in `20` section 8; summarised
here because this is the file a reviewer reads.

| # | Risk | Severity |
|---|---|---|
| **X13** | The **existing trading-only matchmaker keeps working** after a second game arrives, silently returning trading matches on a games platform. No error, no empty state, no log line | **High** |
| **X14** | **Inferred interest read as consent** - a player who paid to enter a competition starts receiving stranger challenge invitations they never asked for | **High** |
| **X15** | **"Challenge any user" becomes a harassment surface.** Blocking exists; there is **no player-facing report-user feature** anywhere in the codebase | Medium |
| **X16** | **Overall rank used instead of per-game rating**, pairing mismatched opponents while appearing to work correctly | Medium |
| **X17** | **Scope creep into a recommendation engine.** R24 is already rated High likelihood | Medium |
| **X18** | **Empty matchmaking at launch**, because nobody has declared any interests yet | Medium |

**X13 is the one to read twice.** `lib/services/matchmaking.service.ts` already exists and
ranks opponents by *trading* skill. It will not fail when a second game arrives - it will
keep returning matches, and they will keep being trading matches. This is the same failure
shape as the mirror-drift and `canEnterChallenges` defects found in Stage 0: **the system
reports success while doing the wrong thing.** The only defence is to change the service
rather than call it from a new place, proven by a test that asserts a match in a
non-trading game and fails before the change.

---

## 4. High platform risks

### R29 - Disabling a game retroactively demotes players

**Severity High, likelihood High, and the decision that prevents it is made in X1** - not
in X7 where the symptom would appear. Recorded 2 September 2026 from the owner's
plug-and-play requirement; the full design is `05` section 11.3.

**It is an R-series risk, not an X-series one**, and the distinction is worth stating
because it was initially filed wrongly: this failure applies **whoever supplies the
games**, including an in-house game or trading itself. Nothing about it depends on a third
party being on the critical path.

The requirement is that a new game is included in stats and rankings with no extra code.
The consequence nobody asks about is the inverse: **if cross-game totals are computed as
sums over currently-*enabled* games, then turning a game off subtracts everything earned
in it.** A player who reached level 12 partly through a provider game drops to level 9
because an operator disabled that game for a commercial reason. Their rank falls, badges
tied to thresholds may stop qualifying, and nothing anywhere reports an error - the
queries run, the pages render, the numbers are simply smaller.

**Why the likelihood is High rather than Medium:** computing a total by summing the
enabled set is the *natural* implementation. It reads correctly, it passes review, and it
is only wrong on a day when someone toggles a flag - which is months after the code ships
and far from the person who wrote it.

| Mitigation | Where |
|---|---|
| Cross-game totals **accumulate on settlement**, never recompute from the enabled set on read | `05` s11.3 rule 2, `11` s5 invariant 9 |
| `getEnabledGameTypes()` gates **creation, discovery and entry only** - it must not appear in a stats or leaderboard read path | `05` s11.4 |
| A disabled game's history is **retired, not deleted**; `gameKey` is immutable precisely so a player's past stays explicable | `05` s11.3 rule 3 |
| In-flight contests finish normally, or cancel with full refunds - never strand a paid entry | `18` s6, matching existing `tradingEnabled` behaviour |

**The test that proves it:** award progression in a game, disable that game, and assert
the player's level, XP and total points are **unchanged**. It must fail before the fix.

### R30 - The platform fee parameter takes a fraction but is named a percentage

Found 4 September 2026 while building the X1 regression baseline - by walking into it.

`distributePrizesWithTies` in `lib/services/competition-ranking.service.ts` declares
`platformFeePercentage: number = 0` and computes `grossPrize * (1 - platformFeePercentage)`.
That requires a **fraction**. Pass `10` meaning 10% and the multiplier becomes `-9`, so
every winner is assigned a **negative prize**.

**This is a naming defect, not a live money defect, and the distinction should not be
blurred.** Both production callers - `lib/actions/trading/competition-end.actions.ts` and
its admin mirror - compute `competition.platformFeePercentage / 100` before calling, so
payouts today are correct. Nothing needs backfilling.

Why it is rated Medium likelihood rather than Low:

- The parameter's **own name instructs the mistake**. A caller reading the signature has
  every reason to pass a percentage.
- It **defaults to `0`**, so forgetting the argument is harmless. Only supplying a
  plausible-looking value is dangerous, which removes the usual prompt to check.
- **X5 introduces a third caller** - the provider settle path - and provider fee handling
  is being written fresh by someone who has not read the two existing call sites.
- The failure is loud in a test and silent in production: a negative credit adjustment on
  a payout is an increase in the platform's favour, not a crash.

| Mitigation | Status |
|---|---|
| An assertion in the regression suite that no scenario ever pays a negative prize | **Done** - `ranking-regression.test.ts` |
| Rename the parameter to `platformFeeFraction` in both apps | **Done 4 Sep 2026** |
| Range-check the unit rather than trusting it | **Done 4 Sep 2026** - rejects anything outside 0-1, naming the received value |
| 19 tests covering valid fractions, refused percentages, and the boundaries | **Done** - `__tests__/services/platform-fee-unit.test.ts` |

#### CLOSED 4 September 2026, and the rename found a second bug on its way

Done as a standalone change, not folded into a test commit, because it is a money path.

**The guard cannot reject valid data**, which is what made it safe to add. Both the
competition and challenge schemas cap `platformFeePercentage` at `max: 50`, so a correctly
converted fraction never exceeds 0.5. Anything above 1 is a unit error by construction. It
throws rather than clamping: aborting finalization is retryable, paying negative prizes is
not.

**The rename was not a find-and-replace, and assuming it was would have broken the build.**
The local variable in both `competition-end.actions.ts` copies was *also* called
`platformFeePercentage` while holding a fraction, and it was read in **two further places**
beyond the `distributePrizesWithTies` call - `actualPlatformFee = prizePool * fee` and
`unclaimedNet = prizePool * (1 - fee)`. Both were correct code wearing the wrong name.
Renaming only the declaration left two references pointing at a name that no longer
existed; `tsc` caught it as `TS2304: Cannot find name`. **The lesson is to sweep for the
old name after a rename and read every hit**, because the compiler catches the ones that
break and says nothing about the ones that still compile and now mean something else.

### R31 - A Game Master rate configured at 0% is treated as unset - **CLOSED, 5 September 2026**

**Found 4 September 2026 while extracting the settlement stages, deliberately NOT fixed in
that commit, and fixed on 5 September. The entry below has been rewritten, because checking
the risk against the code before fixing it showed the register had the wrong branch.**

#### What this entry used to claim, and why it was wrong

It said `calculate.ts` resolved the rate as `limits.referralFeePercentage || 5` at three
sites, so **a package configured at 0% was paid 5%**. The first half was true and the
conclusion was not. The function reads the **current package first**, and that branch tested
`!== undefined`:

```ts
if (currentPackage?.gameMasterConfig?.referralFeePercentage !== undefined) {
  return currentPackage.gameMasterConfig.referralFeePercentage;   // 0 returns 0. Correct.
}
```

So a package that exists and says 0 always yielded 0. The three `||` sites were the
**fallbacks onto the cached `subscription.limits`**, reached only when the package has been
**deleted** or the subscription carries **no `packageId`**. Proven by a test before any fix:
of six cases, the three cached-fallback ones failed with `expected 5 to be 0` and the
current-package one passed.

**The general rule, and the reason this correction is recorded rather than quietly fixed: a
risk register entry is a claim, not a fact.** A fix aimed at this entry's sentence would have
changed the one branch that was already right. **Correcting a risk downward while closing it
is the same documentation duty as raising one** - the second time this has been needed, after
R7.

#### The bigger half, which nothing had recorded

**Six writers copied a package's configuration onto a subscription with
`config.referralFeePercentage || 5`, so buying a 0% package STORED 5%.** The purchase route
twice (upgrade and first purchase), the admin `fix-purchases` repair route, `activate`,
`renew`, and `scripts/fix-existing-gm-purchases.ts`. **Count the writers**, again: the
tracked risk named one file and there were seven across two concerns.

That is the worse defect, for two reasons. It is **durable** - the wrong value is persisted,
and a stored 5 is indistinguishable from a deliberate 5. And it **reaches the challenge path
through the data**: `challenge-finalize.actions.ts` resolves the fallback with `??` and was
otherwise correct, so it faithfully paid the 5% that the purchase route had wrongly stored.
The two paths did disagree, as this entry said, but not for the reason it gave.

#### And the reason a 0% package was hard to find in the first place

`apps/admin/components/admin/MarketplaceSection.tsx` declared the input `min={0}` and then
made 0 unreachable: `value={...referralFeePercentage || 5}` rendered a stored 0 as **5**, so
an operator could not see their own configuration, and `onChange` wrote
`parseFloat(e.target.value) || 5`, so **typing 0 was immediately rewritten to 5**. A control
that advertises a value and silently refuses it - the same shape as enabling a provider with
no adapter. **A 0% package could only ever be created by calling the API directly**, which is
why "check whether any exists in production" was the right instinct and would probably have
returned none.

#### The fix

| Layer | Change |
|---|---|
| Settlement read | `lib/services/settlement/game-master-fees/calculate.ts` + admin mirror: the three fallbacks become one `cachedRateOrDefault()` helper |
| Cached-limits write | New `lib/services/gamemaster/subscription-limits.ts` (mirrored) - `buildSubscriptionLimits()` is now the only writer of the limits shape, used by purchase ×2, activate, renew and fix-purchases |
| Admin editor | The value and the handler both keep 0; the `>= 10` warning threshold too |
| Displays | `??` in the marketplace page, the arsenal card, the package summary, and the AI content prompt |
| Stored rows | `tools/gamemaster/report-stale-subscription-limits.ts`, report-only, lists subscriptions whose cache disagrees with their package |

**`Number.isFinite`, not a bare `??`.** These values arrive from `parseFloat` on an admin
form, so `NaN` is one keystroke away, and `??` passes it straight through onto a required
`Number` path. `NaN` percentages are worse than the bug being fixed: every multiplication
downstream becomes `NaN` and nothing checks. **`||` was wrong about 0 and accidentally right
about `NaN`; the fix has to keep the second half.**

**Why it was preserved verbatim through the extraction**, which is still the part worth
carrying forward: the entire value of moving ~900 lines of money code is that the five
trading payout tests and the golden ranking regression staying green *proves* nothing moved.
A behaviour change made in the same commit destroys that proof for the sake of one line.

| | |
|---|---|
| **Severity** | Medium - real money, but narrower on the payout path than this entry claimed and wider on the write path |
| **Likelihood** | **Latent, not an active loss.** The admin UI could not store a 0% rate, so a package configured at 0% was almost certainly never created. Say latent, not occurred |
| **Status** | **CLOSED 5 September 2026.** 14 tests in `__tests__/services/game-master-fee-percentage.test.ts`, 8 probes in `tools/probe-gm-fee.ps1` |
| **Not repaired retroactively** | A code fix changes future writes only. Existing subscriptions still hold whatever `\|\| 5` produced, and the report tool is report-only. Renewal re-copies from the package, so an auto-renewing subscription repairs itself within one period |
| **One writer left** | `scripts/fix-existing-gm-purchases.ts:240` still reads `config.referralFeePercentage \|\| 5`. It is a hand-run repair script with its own local types and no path aliases, so it cannot import the shared builder as written, and it was not editable from the environment this fix was made in. **Named here rather than left silent**, because it is the one path that can reintroduce a stored 5% over a 0% package. Anyone running it should change `\|\|` to `??` on the three limit fields first |

**Three sites deliberately unchanged**, so a later sweep does not "fix" them: `|| 0` in
`UserFullDetailPanel.tsx` (twice) and `GameMasterDetailView.tsx`. A stored 0 renders as 0
through a truthy check, because the fallback and the value are the same number - **the
expression is odd and the behaviour is right**, and changing it would be churn in a diff whose
whole purpose is provable behaviour.

**Swept and confirmed unaffected:** the challenge finalization path uses
`challenge.platformFeeAmount`, an absolute amount, and only ever renders
`platformFeePercentage` into a display string beside a `%` sign. No fraction confusion
exists there.

**Proof the fix changed no payout:** the golden baseline regenerated **byte-identical**
after both the rename and the guard. **Probed:** deleting the guard turned 8 of the 19 new
tests red.

### R7 - Raw-driver contest inserts bypass Mongoose defaults - CLOSED 4 September 2026

Fixed in X1 step 6. All raw-driver contest inserts now spread `contestGameLabel()` from
`lib/games/registry.ts`. This is also why Mongoose discriminators were rejected in `11`
section 6.

**There were six writers, not the one this risk named.** The two Game Master routes, two in
`apps/admin/app/api/admin/trading-tests/run/route.ts` and two in
`apps/admin/app/api/admin/end-logic-tests/run/route.ts`. The harness ones are not cosmetic:
**the end-logic harness drives finalization**, which dispatches on `gameType`, so seeding
contests unlabelled meant the harness exercised the absent-label fallback instead of the
path production takes - a test quietly checking something adjacent to the real thing. Carry
the general rule, which is now the third instance after Defect 1's four entry paths and
seam 3's ten call sites: **count the writers before fixing the one the plan names.**

**Correct the severity claim this entry used to make.** It said an unlabelled competition
"gets settled by trading code and pays the wrong players". That is wrong, and the reason
matters: `resolveGameType` treats an absent label as **trading** (invariant 5), which is
exactly right for these six writers because all six create trading contests. R7 was never a
live payout bug. What it actually breaks is later and quieter - the day an aggregate
**groups by `gameKey`**, an unlabelled row drops silently out of a total, long after the
commit that caused it, and **cannot be corrected in place because `gameKey` is immutable
once written.**

Pinned by `__tests__/services/game-guards.test.ts`, which counts `contestGameLabel()` calls
against raw `insertOne` calls per file rather than checking a hard-coded list - so a
**new** raw writer added to any of these files turns it red. Probed by removing the label
from two different inserts; each turned 2 tests red.

Still open, and deliberately not done here: replacing the raw inserts with the consolidated
creation path used by the admin wizard. Two divergent creation paths for the same object is
the defect class X0 exists to remove from the entry path, and leaving it in the creation
path invites the same bug again - but that is a refactor of Game Master contest creation,
not a label fix.

### R9 - Fraud throttle blind to provider entries

`entry-fraud-gate.service.ts` counts `CompetitionParticipant` documents per hour.
`CoordinationDetectionService` and `BehavioralAnalysisService.recordCompetitionEntry` are
wired only into the competition entry action.

Provider contests will be **cheaper and faster to enter than trading contests**, which
makes them the more attractive target for multi-accounting. Extend the fraud gate to
provider entries in X5, not later.

**Constraint added 2 September 2026, and it governs how that extension may refuse anyone.**
The same gate used to refuse entry on the suspicion score alone, above
`entryBlockThreshold`. That refusal created no `UserRestriction`, so it appeared on no admin
screen, notified nobody, could not be lifted, and **ignored `autoSuspendEnabled` entirely** -
an admin who had deliberately left automatic suspension off still got automatic, permanent
lockouts. It locked a real player out and was reported by the owner as a live incident. See
Prerequisite B in `New games plan/00a-STAGE-0-prerequisite-fixes-DO-FIRST.md`.

So when X5 widens the gate: **automatic enforcement must go through `UserRestriction`, never
through a bare refusal inside the gate.** A refusal a player cannot see and an admin cannot
reverse is worse than no enforcement, because the account is lost and nobody knows why.
Scores raise alerts; restrictions block. Provider entries make this sharper, not softer - a
cheap, fast contest will trip a throttle far more often than a trading contest does, so the
false-positive rate this rule protects against is higher there than anywhere it has been
tested.

### R11 - Legal wording changed without review

`SitePage` holds the terms of service. `legal/ChartVolt-Regulatory-Defence-Pack.html`
depends on specific characterisations of skill and money flow. **Neither is a wording
pass.** Route through legal review.

### R12 - Badge or milestone IDs renamed

Badge and milestone **IDs** are referenced by `UserBadge` and `UserJourneyProgress`.
Renaming one orphans user progress. Change display names, never IDs.

### R17 - Disabling trading strands active contests

Covered in `15` section 2. Preferred behaviour: **refuse to disable trading while active
trading contests exist**, naming them.

---

### R32 and R33 - The score seam and its direction - **BOTH CLOSED, 5 September 2026**

Two defects in the provider payout path, found while mapping the code for the round inspector.
Recorded together because they were one missing seam seen from two ends. Full detail in `05`
section 2.0a and the `PROGRESS.md` work log; the reason they belong in the register is what they
teach about *how* a money defect survives a green test suite.

**R32.** No code path wrote `participant.score`. `applyResult` wrote `game_round` and stopped,
and `buildParticipantSeat` seats every player at zero - so every participant in a provider
contest would have settled tied at rank 1 and taken an **equal share of the prize pool
regardless of how well they played.**

**R33.** Settlement read `scoreDirection` off each participant, a field declared on **neither**
`CompetitionParticipant` copy. The read was always `undefined`, so the fail-safe default beside
it was the only branch and **every lower-is-better contest paid the slowest player first.**

**Both are latent, not occurred**, and saying which matters: no provider contest has ever
settled. There is nothing to backfill and **the fix must not be described as retroactive.**

**Rate the likelihood High, not Medium**, for the same reason R29 is rated High: nothing about
either defect looks wrong on review. The seam's absence is invisible because the file that
consumes it *says* the seam exists, and the direction read is a plausible line of code against a
field name that reads as real.

Four mechanisms let them through, and each is worth carrying:

- **An aside in a comment is a claim, not a fact.** Fourth instance, after `challengeId`, this
  register's own R7 severity, and `billsPerRound`.
- **A fixture that supplies the value under test has tested the consumer, not the producer.**
  The settlement suites seed the scores they rank.
- **A raw-driver fixture is not bound by the schema the application writes through.**
  `db.collection(...).insertMany` bypasses Mongoose strict mode, so the test stored a field no
  production path could.
- **An explicitly-typed `.lean<{...}>()` hides a field that does not exist**, because the
  compiler checks the generic rather than the schema - which is why the usual "errors that
  disappear after a model sync" signal never appeared.

---

## 5. Medium platform risks

| ID | Risk | Mitigation |
|---|---|---|
| R6 | Gating the price streamer breaks charts | Gate, never delete. One condition in `autoInitialize()`. Verify in logs |
| R10 | `blockCompetitionsOnHolidays` blocks a chess contest | Scope holiday gating to `needsMarketHours` |
| R14 | Leaderboard migration changes ranks | Run old and new in parallel; diff the top 100 before switching |
| R18 | Six trading providers hoisted to a shared `/play` layout | Keep them inside the trading branch. Verify in the browser |
| R19 | Moving ~20 components breaks imports | Standalone commit, no logic changes |
| R20 | `startingCapital` is `required: true, min: 100` | Make it conditional on the game, or default it for non-trading contests |
| R21 | Splitting the ~1,700-line dashboard action | Split by section, compare output before and after |
| R22 | New admin sections invisible | Add every ID to `ADMIN_SECTIONS`; fix the 8 existing omissions |
| R23 | Notification templates link to `/trade` | Resolve through the play dispatcher |
| R25 | Round write contention | Use `$inc`; load-test a 500-player contest |

### R24 - Scope creep, and why it is rated High likelihood

This programme is **26.5-35 weeks**, and every chapter contains something reasonable to
want. The failure mode is not a technical one: it is reaching week 20 with a broad,
half-finished platform and no provider contest that has ever taken a real entry fee.

**The rating went up on 2 September 2026, and the reason is instructive rather than
alarming.** The owner's brief added ~3 weeks of real scope - a profile specification, an
opponent picker, onboarding and matchmaking - and every item was individually well
justified. That is exactly what scope creep looks like from the inside: not a bad
decision, but a series of good ones with no stopping rule. The register's job here is to
hold the stopping rule, not to argue against the additions.

**Mitigation:** treat `X0-X5 plus a minimal slice of X6` - roughly 11-14 weeks - as the
first commitment, and review against real player behaviour before funding the rest. The
catalogue, marketplace and Game Master items are explicitly unscheduled for this reason,
and **X11.5 sits deliberately late** - matchmaking across one game is pointless, so it
cannot honestly be pulled forward.

---

## 6. Things that are safer than they look

| Assumption | Reality |
|---|---|
| Worker jobs will break | They already no-op when no active trading contests exist |
| Turning off trading breaks the app | The six trading providers are already scoped to two pages; the admin app already skips the streamer |
| Wording is 5,000 strings | The shared shell is ~150-250 |
| The money layer needs a rewrite | It is rank-based and game-agnostic already. It needs **consolidation**, not redesign |
| Journey maps need rebuilding | Database-driven; the deprecated constants file is not seeded |
| A provider integration needs new infrastructure | Database records and Next.js routes only. One CSP change |

---

## 7. Gates

### Gate 1 - before X1 begins

- [ ] All **8** money tests from `18` passing
- [ ] Exactly **one** contest entry path, and it increments `prizePool`
- [ ] The 4 bypassed security checks restored on that path
- [ ] All **5** drifted mirror fields synced
- [ ] Mirror CI check failing on deliberate divergence
- [ ] Production build succeeds
- [ ] **Owner sign-off recorded**

### Gate 2 - before X5 begins

- [ ] Gate 1 complete
- [ ] Trading regression: historical competitions recompute to **identical** rankings
- [x] Finalization dispatches on game type - **inside** the four finalize functions, not at the **ten** call sites (`11` s2 seam 3 corrects the "5" this line used to claim)
- [ ] Trading settle path asserts and aborts on a non-trading contest
- [ ] Dead Inngest crons deleted or fenced
- [x] Market-hours gating scoped to `needsMarketHours` - **done 4 Sep 2026**, at all three
      cross-game call sites (challenge create, challenge accept, admin competition create),
      failing **closed** on an unknown game type
- [x] **Every raw-driver contest insert sets the game label explicitly** - **done 4 Sep
      2026**. Note this was **six** inserts, not the two this line assumed (R7)
- [x] **Admin-app finalization pays Game Master earnings identically to the main app** (R26) -
      **done 5 Sep 2026**, proven by running *both* finalize functions over identical fixtures
      and comparing every ledger row, not by asserting the admin app pays something. **Existing
      contests were not backfilled**
- [ ] `minParticipants` cannot be set below 2 on any creation path, admin or Game Master
- [ ] Every failure rehearsal in `07` section 9 green **against the mock**

### Gate 3 - before X12 pilot begins

- [ ] Provider pricing modelled and a cost floor set
- [ ] **Game Master provider-cost treatment decided**: either the share is computed on net
      platform fee after provider cost, or `limits.allowedGameTypes` still excludes provider
      games (X7)
- [ ] Fraud gate covering provider entries
- [ ] Reconciliation job and unresolved-round policy live - **the logic is built and probed
      (X3, 4 Sep 2026), but "live" means running on the worker, which is X9.** The four
      stages, the polling schedule and all three policies exist and are tested; nothing
      calls them on a timer yet. Do not tick this until the worker does
- [ ] Every alert in `15` section 7 firing to a real destination
- [ ] Manual round resolution usable by an admin without a developer
- [ ] Rollback rehearsed: disable provider games and confirm the platform behaves exactly
      as it does today
