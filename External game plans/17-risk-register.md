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
| **R3** | Trading settlement runs against a provider contest | Critical | High | X1, X5 |
| **R4** | Double finalization pays twice | Critical | Medium | X0, X1 |
| **R5** | Dead Inngest crons re-registered | Critical | Low | X0, X1 |
| **R13** | Ledger enum renamed | Critical | Low | X1, X8 |
| **R26** | Admin-app finalization pays no Game Master earnings | Critical | **ALREADY OCCURRED** | X1 or X5 |
| **X1** | Abstraction cannot be proven without the provider | **High** | **High** | X4 |
| **X2** | Single supplier on the critical path | **High** | Medium | All |
| **X3** | No cost floor - per-round fee kills cheap contests | **High** | Medium | Before X4 |
| **X7** | Game Master provider contest is net loss-making | **High** | **High** if ungated | Before X6 |
| R6 | Price infrastructure broken by gating | High | Medium | X8 |
| R7 | Game Master raw insert misses the game label | High | High | X1 |
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
| R24 | Scope creep before anything ships | Medium | **High** | All |
| R25 | Round write contention under load | Medium | Medium | X12 |

---

## 2. Critical platform risks

### R1 - Money paths refactored without tests first

**Four** competition-entry writers exist and **they disagree about money**.
`enterCompetition` in `lib/actions/trading/competition.actions.ts` lines **584-593**
increments both `currentParticipants` and `prizePool`.
`app/api/competitions/[id]/join/route.ts` lines **252-256** increments only
`currentParticipants`. So does `app/api/simulator/competitions/join-batch/route.ts`, which
has no callers at all. The admin mirror of `enterCompetition` (lines 618-655) does update
the pool but omits the email check and the fraud gate.

The API route also skips **four** checks the action performs: email verification, user
restrictions, the fraud gate, and the level requirement.

Re-verified 1 September 2026, with two corrections worth carrying:

- The finalize-time safeguard that caps the pool to `currentParticipants x entryFee`
  **does not mask this**. It only fires when the pool is too *high*
  (`competition-end.actions.ts` 695-718), so an under-counted pool is under-distributed with
  no correction and no log line.
- The API route is currently reached **only by the simulator service**; both real join
  buttons call `enterCompetition`. So no paying customer is affected *today*. That lowers
  the urgency and not the priority, because this programme adds new callers to exactly this
  path.

A related defect on a path real players **do** use: the challenge *accept* route
(`app/api/challenges/[id]/accept/route.ts`) skips account restrictions and the fraud gate,
and it is where both wallets are debited. Folded into X0 as sub-defect 1b.

Building a new score path on top of this means debugging two problems at once with real
money involved. **Fixed and signed off in X0, before anything else.**

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

### R3 - Trading settlement runs against a provider contest

The highest-consequence risk in the programme.
`lib/actions/trading/competition-end.actions.ts` is ~**1,500 lines**; steps 2-4 close
forex positions and recalculate PnL. Pointed at a provider contest it finds no positions,
computes zero for everyone, ranks everyone equal, and **pays prizes to the wrong players
without erroring**.

**Five** entry points reach finalization and every one must dispatch on game type:

1. `worker/jobs/competition-end.job.ts`
2. `worker/jobs/challenge-finalize.job.ts`
3. Lazy auto-finalize inside `getCompetitionById`
4. `POST /api/finalize-old-competitions`
5. The admin emergency-cancel route

**Mitigation:** dispatch at all five, plus an assertion in the trading settle path that
aborts if the game type is not trading. Loud failure is recoverable.

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

### R26 - Admin-app finalization pays no Game Master earnings

**A live defect found while writing `19`, not a prediction.** An instance of R2, but severe
enough on its own to have an ID.

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

Note the size difference is not subtle and generalises: `competition-end.actions.ts` is
72 KB in the main app against 38 KB in the admin app, and `challenge-finalize.actions.ts`
is 70 KB against 42 KB. The duplicated **services and actions** are the larger version of
R2 and a field-comparison script cannot help with them.

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

---

## 4. High platform risks

### R7 - Game Master route bypasses Mongoose defaults

`app/api/gamemaster/competitions/route.ts` inserts with the **raw MongoDB driver** at line
466, so it will not receive a default game label. Set it explicitly. This is also why
Mongoose discriminators were rejected in `11` section 6.

Combined with R3, this is the sharpest money bug in the programme: an unlabelled
competition reads as trading, gets settled by trading code, and **pays the wrong players**.
Setting the label on both this route and its admin twin at
`apps/admin/app/api/gamemaster/competitions/route.ts` is a **gate inside X1**, not a task -
see `19` section 3.1.

Consider also replacing the raw insert with the consolidated creation path used by the admin
wizard. Two divergent creation paths for the same object is the defect class X0 exists to
remove from the entry path; leaving it in the creation path invites the same bug again.

### R9 - Fraud throttle blind to provider entries

`entry-fraud-gate.service.ts` counts `CompetitionParticipant` documents per hour.
`CoordinationDetectionService` and `BehavioralAnalysisService.recordCompetitionEntry` are
wired only into the competition entry action.

Provider contests will be **cheaper and faster to enter than trading contests**, which
makes them the more attractive target for multi-accounting. Extend the fraud gate to
provider entries in X5, not later.

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

This programme is **20-26 weeks** in the external-only scenario, and every chapter
contains something reasonable to want. The failure mode is not a technical one: it is
reaching week 20 with a broad, half-finished platform and no provider contest that has
ever taken a real entry fee.

**Mitigation:** treat `X0-X5 plus a minimal slice of X6` - roughly 11-14 weeks - as the
first commitment, and review against real player behaviour before funding X6 to X12. The
catalogue, marketplace and Game Master items are explicitly unscheduled for this reason.

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
- [ ] Finalization dispatches on game type at all **5** entry points
- [ ] Trading settle path asserts and aborts on a non-trading contest
- [ ] Dead Inngest crons deleted or fenced
- [ ] Market-hours gating scoped to `needsMarketHours`
- [ ] **Both Game Master competition inserts set the game label explicitly** - verified by
      reading a created document, not by trusting a default (R7)
- [ ] **Admin-app finalization pays Game Master earnings identically to the main app** (R26)
- [ ] `minParticipants` cannot be set below 2 on any creation path, admin or Game Master
- [ ] Every failure rehearsal in `07` section 9 green **against the mock**

### Gate 3 - before X12 pilot begins

- [ ] Provider pricing modelled and a cost floor set
- [ ] **Game Master provider-cost treatment decided**: either the share is computed on net
      platform fee after provider cost, or `limits.allowedGameTypes` still excludes provider
      games (X7)
- [ ] Fraud gate covering provider entries
- [ ] Reconciliation job and unresolved-round policy live
- [ ] Every alert in `15` section 7 firing to a real destination
- [ ] Manual round resolution usable by an admin without a developer
- [ ] Rollback rehearsed: disable provider games and confirm the platform behaves exactly
      as it does today
