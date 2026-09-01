# 12 - Risk Register: How This Can Break the App

Every risk identified during the audit, rated and mitigated. Severity is about **impact if it happens**; likelihood is **without** the mitigation in place.

Rating scale: Critical = real money moves wrongly or the platform is down; High = a core feature is broken for many users; Medium = degraded experience or wrong data; Low = cosmetic or contained.

---

## Summary table

> **R1 and R2 are handled in STAGE 0**, a separate delivery that must be completed and signed off by the owner before Phase P1 begins. See `00a-STAGE-0-prerequisite-fixes-DO-FIRST.md`.
>
> **R2 is not a prediction - it is a confirmed present-day defect.** Three mirrored model pairs are already out of sync. Evidence below.

| ID | Risk | Severity | Likelihood | Phase |
|---|---|---|---|---|
| R1 | Money paths refactored without tests | **Critical** | High | **STAGE 0** |
| R2 | Admin mirror files out of sync | **Critical** | **ALREADY OCCURRED** | **STAGE 0** |
| R3 | Trading settlement runs against non-trading contests | **Critical** | High | P1/P2 |
| R4 | Double finalization pays winners twice | **Critical** | Medium | STAGE 0 / P1 |
| R5 | Dead Inngest crons re-registered alongside Agenda | **Critical** | Low | STAGE 0 (optional) / P1 |
| R6 | Price infrastructure broken by gating or removal | High | Medium | P5 |
| R7 | GM raw-MongoDB insert produces documents without `gameType` | High | **High** | P1 |
| R8 | Bulk find-and-replace on wording breaks identifiers | High | Medium | P5 |
| R9 | Fraud throttle counts only competition participants | High | **High** | P2 |
| R10 | Market-hours settings block non-trading games | Medium | **High** | P1 |
| R11 | Legal/ToS wording changed without review | High | Medium | P5 |
| R12 | Badge/milestone ID renames orphan user progress | High | Medium | P4 |
| R13 | Ledger enum renamed, breaking financial reporting | **Critical** | Low | P1 |
| R14 | Leaderboard migration produces different rankings | Medium | High | P4 |
| R15 | Trivia scoring exploitable (client timing, replay) | High | High | P2 |
| R16 | Insufficient question bank at contest start | Medium | High | P2 |
| R17 | Disabling trading strands active trading contests | High | Medium | P5 |
| R18 | Trading providers hoisted into shared layout | Medium | Medium | P2 |
| R19 | Component move breaks imports at scale | Medium | Medium | P2 |
| R20 | `startingCapital` required-field validation on Trivia | Medium | Medium | P1 |
| R21 | Dashboard mega-action split introduces regressions | Medium | Medium | P4 |
| R22 | New admin sections invisible to employees (RBAC) | Low | **High** | P3 |
| R23 | Notification links point to `/trade` for Trivia | Medium | High | P3 |
| R24 | Scope creep into chess/esports before Trivia ships | Medium | High | All |
| R25 | Performance: answer writes and participant contention | Medium | Medium | P2 |

---

## Critical risks in detail

### R1 - Money paths refactored without tests first

**What breaks:** double charges, unpaid winners, prize pools that do not match entry fees collected.

**Why likely:** there are already **two divergent competition join paths** that disagree on security checks *and* on whether `prizePool` is incremented. Confirmed: `competition.actions.ts` lines 587-590 increments both `currentParticipants` and `prizePool`; `join/route.ts` lines 252-256 increments only `currentParticipants`. We are about to add more callers. Refactoring an already-inconsistent money path with no test coverage is the highest-risk activity in this project.

**Mitigation:** **Stage 0** exists solely for this and is delivered separately with owner sign-off. Write the eight money tests **first**, then consolidate to one entry service, then build games on top. Do not reorder these.

**Detection:** the payout-vs-pool invariant alert in `11` section 7.

---

### R2 - Admin mirror drift (CONFIRMED DEFECT, NOT A PREDICTION)

**Status: this has already happened, and it is now fixed.** All 75 mirrored pairs were compared automatically on 1 September 2026. **Eleven** had real schema drift - absent from both the TypeScript interface **and** the Mongoose schema:

| Mirrored model | Drift |
|---|---|
| `platform-financials.model.ts` | **Bidirectional**, including two enum values the main app rejected |
| `hero-settings.model.ts` | 42 fields missing from admin |
| `admin.model.ts` | 26 admin-only fields - **deliberate**, and the one allowlist entry |
| `withdrawal-request.model.ts` | `failedAt`, `withdrawalMethod`, `originalCardDetails.userPaymentOptionId` missing from **main** |
| `user-bank-account.model.ts` | 5 Nuvei UPO fields missing from admin |
| `user-notification-preferences.model.ts` | `categoryPreferences.challenge`, `.social`, `.messaging` missing from admin |
| `whitelabel.model.ts` | `brandingFiles` missing from admin |
| `trading/competition.model.ts` | `gameMasterId`, `gameMasterName` missing from admin |
| `trading/wallet-transaction.model.ts` | `provider`, `providerTransactionId` missing from admin |
| `trading/challenge-settings.model.ts` | `tiePrizeDistribution` missing from admin |
| `trading/trading-position.model.ts` | `metadata` missing from admin |

**What it causes today, stated precisely.** This was **measured** against a real MongoDB on 1 September 2026, and the result corrected two earlier claims in this register. Evidence: `__tests__/helpers/mirror-drift-behaviour.test.ts`.

Drift is a **write-side** defect, in descending order of harm:

| What happens | Severity |
|---|---|
| A **missing enum value rejects the entire write** | **Severe.** The record is never created. `platform-financials.model.ts` was exactly this |
| The narrower app **cannot write the field.** `create`, assignment-then-`save` and `$set` all discard it silently and report success | **Severe.** The feature appears to work and does nothing |
| `replaceOne` / `findOneAndReplace` **do delete** undeclared fields | High, but rare here |
| An ordinary `save()` of a loaded document | **Harmless.** It `$set`s modified paths only. **This register previously claimed the opposite** |
| Reads, hydrated or `.lean()` | **Harmless.** The field survives both. **This register previously claimed the opposite** |

The practical consequence: a read is worthless as evidence that two copies agree, because a `.lean()` read returns the field perfectly while every write through the same model drops it. Only the guard can tell you.

**Why it becomes critical when games are added:** `gameType` is exactly this kind of field. If the admin's copy lacks it, the admin app **cannot set it** - so a Trivia contest created or edited through a path that must write the label ends up unlabelled. An unlabelled contest is treated as trading, so the finalizer attempts to close forex positions that do not exist, scores everyone zero, ranks them equal, and pays prizes to the wrong players - **silently** (see R3).

**Why very likely to recur:** 75 duplicated model files, plus 19 action and 51 service files. **11** model pairs were drifted. There were also 112 committed declaration files that *looked* like stale third copies but were inert, since TypeScript resolves the sibling `.ts` first - all deleted 1 Sep 2026 with a `.gitignore` rule, so they are no longer a maintenance surface or a source of confusion.

**Mitigation (Stage 0) - BUILT 1 September 2026:**
- `tools/model-mirror/` - a **CI check plus pre-push hook** comparing field paths **and enum values** across every mirrored pair, extracted from the TypeScript AST rather than by regex. Fails the build with a message naming each file, field and side. Cheapest fix in the whole programme; permanently eliminates the class of bug.
- All 11 drifted pairs synced, **add-only**. Removing an enum value to make two sides agree would orphan every document already storing it.
- An **allowlist** for deliberate differences, which needed exactly one entry (`admin.model.ts`). Every other difference proved to be a real defect.
- 20 tests: 12 proving the guard fails on real drift and does not cry wolf on cosmetic differences, 8 establishing the severity table above.
- PR checklist item: "model changed - mirror updated?"
- Every task in `03` lists both paths explicitly.

**What the fix uncovered:** three live production bugs.
1. Failed withdrawals were storing no failure time and no processor reason, because the main app wrote `failedAt` and `failedReason` into a schema declaring neither.
2. Six landing-page sections - Game Master, competition types, marketplace, journey and badges, trust badges, enterprise case studies - were **not administrable at all**, because 42 fields were missing from the admin copy of `hero-settings.model.ts`.
3. **Hero and branding images could never be recovered after a redeploy.** `whitelabel.brandingFiles` holds a base64 backup of every uploaded image for exactly that purpose, and the admin schema did not declare it, so the three routes that read it saw `undefined`. Deleting an image also left the database copy behind forever. Found by the typecheck rather than the guard: syncing the model removed four standing TypeScript errors (229 to 225).

That third one is also the clearest illustration of *why* drift hides so well. `.lean()` and `toObject()` return an undeclared field perfectly, but **ordinary `doc.field` access returns `undefined`**, because Mongoose only defines getters for declared paths. A debug dump shows the value; the code beside it reads nothing.

**Detection:** the guard runs in CI and blocks pushes. A test asserts the real repository has zero drift, with a lower bound on the number of pairs compared so it cannot pass vacuously.

---

### R3 - Trading settlement runs against a non-trading contest

**What breaks:** `competition-end.actions.ts` closes positions, recalculates PnL from `TradeHistory`, then ranks. Against a Trivia contest it finds no positions, computes **zero PnL for everyone**, ranks them all equal, and distributes prizes by tie-break. Real money is paid to the wrong players, with **no error and no log line**.

**Entry points that can trigger it:** the `competition-end` worker job, the `challenge-finalize` job, the lazy auto-finalize inside `getCompetitionById`, `POST /api/finalize-old-competitions`, and the emergency-cancel route.

**Mitigation:**
- Dispatch on `gameType` at the **top** of the finalizer, before any position work.
- Defence in depth: an assertion in the trading settle path that logs an error and aborts if `gameType !== "trading"`.
- Audit **all five** trigger paths, not just the worker job. The lazy auto-finalize inside a read path is the easiest one to miss.

**Detection:** finalization-outcome-by-game-type metric; the payout-vs-pool alert.

---

### R4 - Double finalization

**What breaks:** winners credited twice.

**Why plausible:** there is a stuck-`finalizing` recovery that resets a contest to `active` after 5 minutes. If the original finalization was slow rather than dead, two finalizations can overlap.

**Mitigation:** `settleContest()` is contractually idempotent; Trivia settlement recomputes from `TriviaAnswer` rows rather than incrementing. Add an idempotency guard on the payout step itself (e.g. refuse to create a `competition_win` row that already exists for that contest+user). Test 7 in `05` covers this.

---

### R5 - Dead Inngest crons re-registered

**What breaks:** two schedulers (Inngest + Agenda) finalizing the same contests concurrently.

**Why it exists:** `lib/inngest/functions.ts` still defines `updateCompetitionStatuses`, `monitorMarginLevels`, `updatePriceCache`, `processTradeQueue` on `* * * * *`, but `app/api/inngest/route.ts` deliberately does not serve them. A well-meaning developer "fixing" the missing crons would cause concurrent double-finalization.

**Mitigation:** delete the dead definitions, or add a loud comment plus a test asserting the served function list contains only the email/invoice functions.

---

### R13 - Ledger enum renamed

**What breaks:** financial reporting, reconciliation, Atlas refund logic, transaction exports, and the historical record. Potentially an audit/tax problem, and not cleanly reversible.

**Mitigation:** `03` section 8 and `09` section 7 both explicitly forbid renaming `competition_entry` etc. Add them to the "must not rename" list in the PR template. The game dimension is added as a separate `gameType` field.

---

## High risks in detail

### R7 - GM route bypasses Mongoose defaults

`app/api/gamemaster/competitions/route.ts` inserts competitions via the **raw MongoDB driver**, so schema defaults do not apply. A `gameType` default on the schema will **not** be set for GM-created competitions, producing documents with no game type that then fall into ambiguous handling.

**Mitigation:** explicitly set `gameType` in that route. Additionally, make readers treat missing `gameType` as `"trading"` so such documents degrade safely rather than crashing. Grep for other raw-driver inserts on these collections.

---

### R9 - Fraud throttle blind to new game types

`entry-fraud-gate.service.ts` enforces `maxEntriesPerHour` by counting **`CompetitionParticipant` documents created in the last hour**. If Trivia uses the same collection this still works; if it ever gets its own participant collection, the throttle silently stops working for it.

Related: `CoordinationDetectionService` and `BehavioralAnalysisService.recordCompetitionEntry` are wired only into the competition entry action.

**Mitigation:** keep Trivia in the same participant collections (which the `03` design does), and extend the throttle to count across contest kinds. Wire coordination/behavioural analysis into the consolidated entry service so **every** game gets it automatically - a structural fix rather than a per-game one.

---

### R10 - Market-hours settings block non-trading games

`blockCompetitionsOnHolidays` / `blockChallengesOnHolidays` currently gate entry via **forex** market checks (`canJoinCompetition`, `canJoinChallenge`). Left as-is, Trivia contests become unjoinable on forex holidays and outside market hours - a baffling bug that would look like a broken feature.

**Mitigation:** gate market-hours checks on `module.capabilities.needsMarketHours`. Add a test that a Trivia contest is joinable while the forex market is closed.

---

### R8 - Bulk find-and-replace

Covered in detail in `09`. A regex cannot distinguish a user-visible label from an API route, a DB enum value, a model name or a CSS class. TypeScript catches some of it; DB enums and route strings fail only at runtime.

**Mitigation:** no bulk replace, ever. Terminology layer plus screen-by-screen review, with the explicit "must not rename" list.

---

### R12 - Badge/milestone ID renames

Badge and milestone **IDs** are the keys of user progress (`UserBadge`, `UserJourneyProgress`). Renaming an ID orphans every completion, appearing to users as deleted achievements - highly visible and hard to reverse once new rows exist.

**Mitigation:** treat IDs as immutable, like ledger enums. Change **labels** only. State this in the admin editor UI so content editors do not do it either.

---

### R15 - Trivia scoring exploitable

Client-reported elapsed time forges the speed bonus; replayed submissions double-score; sub-human answer times indicate automation.

**Mitigation:** server-side `servedAt`/`answeredAt` only; unique compound index on `{contestId, userId, questionId}`; expected-index guard; minimum plausible answer time; per-participant option shuffling. All specified in `10`.

---

### R17 - Disabling trading strands active contests

If `tradingEnabled = false` hard-gates the price feed while trading contests are live, open positions cannot be priced or closed - participants cannot exit and finalization cannot settle correctly. This is a money-losing failure mode created by a well-intentioned kill switch.

**Mitigation:** the price feed condition is `tradingEnabled || activeTradingContests > 0` (see `11` section 1). Preferred additional safeguard: the admin refuses to disable trading while trading contests are active, offering a pending "disable after completion" state - turning a subtle runtime condition into explicit product behaviour.

---

### R11 - Legal wording changed without review

`SitePage` documents (Terms of Service, risk disclaimer) describe a "trading competition platform". These are contractual, and the platform maintains a specific regulatory position (`performance -> score -> rank -> fixed prize`).

**Mitigation:** legal review track, separate from the UI wording passes. Do not let a content editor "tidy up" the ToS. Note that broadening the platform description may actually **strengthen** the regulatory position (see `05` section 6), so this is worth doing properly rather than avoiding.

---

## Medium risks in detail

### R14 - Leaderboard migration changes rankings

Moving from computed `overallScore` to `UserGameStats` will produce different ordering. Users notice leaderboard changes immediately and interpret them as bugs or unfairness.

**Mitigation:** backfill, then run both in parallel behind a flag and diff the top 100; publish a changelog explaining the new points/rating model before switching; consider starting a new season at the switch so the change has a natural narrative rather than looking like a reset.

### R16 - Insufficient question bank

A Trivia contest that starts and cannot fill its question set must be cancelled and refunded - a bad first impression.

**Mitigation:** validate availability at **creation** time in `validateConfig()`; re-check at start; if it still fails, use the existing cancel-and-refund path (already correct). Operational rule: bank at least 10x `questionCount` per category.

### R18 - Trading providers hoisted

If the six trading providers are placed in the shared `/play` layout rather than the trading branch, every Trivia player polls prices every 2 seconds. Wasted load and client errors.

**Mitigation:** explicit code-review item; a test asserting no price request is made during a Trivia session.

### R19 - Component move breaks imports

Moving ~20 components from `components/trading/` to `components/contest/` touches many import sites.

**Mitigation:** do it as a **standalone commit with no logic changes**; rely on TypeScript to find every site; verify with a clean build; keep it out of any commit that also changes behaviour so review and bisecting stay easy.

### R20 - `startingCapital` required validation

It is `required: true, min: 100`. A Trivia contest has no starting capital.

**Mitigation:** keep sending the schema default and ignore the field (recommended), rather than relaxing a `required` that trading validation depends on. Decide explicitly; do not discover it at runtime.

### R21 - Dashboard mega-action split

`comprehensive-dashboard.actions.ts` is ~1,700 lines feeding ~15 components. Splitting it risks regressions in a highly visible screen.

**Mitigation:** split by extraction with identical output, verified by snapshotting the action's response for a set of test users before and after.

### R23 - Notification links to `/trade`

Several notification templates link to `/competitions/.../trade`. For a Trivia contest that is a broken link - a functional bug, not a wording issue.

**Mitigation:** templates use a game-aware URL helper resolving to the module's `playRouteSegment`. Keeping `/trade` as a redirect (per `08`) also limits the damage.

### R25 - Performance under load

Every Trivia answer writes a `TriviaAnswer` row and updates the participant document. With many concurrent players in one contest, participant updates could contend.

**Mitigation:** use `$inc` on participant counters rather than read-modify-write; the answer row is the source of truth so the counter is an optimisation; load-test a 500-player contest. The platform already has a Performance Simulator admin section that can be reused for this.

---

## R24 - Scope creep

The strategic review lists chess, trivia, esports, fantasy sports, coding competitions. The temptation is to build the abstraction for all of them at once.

**Mitigation:** build the contract with exactly **two** implementations (trading + trivia). Two is the minimum number that forces a real abstraction; more than two before either is in production means designing against imagined requirements. Ship Trivia, learn from real players, then add the third game - which is also the honest test of whether the contract works.

---

## Things that are safer than they look

Worth recording, because fear of these could distort the plan:

| Assumption | Reality |
|---|---|
| "The worker jobs will break" | They already self-guard and no-op when no active contests exist |
| "Turning off trading will break the app" | Price providers are already scoped to two pages; the admin app already skips the streamer; secondary servers already run relay-only |
| "The wording is 5,000 strings" | The shared-shell user-visible subset is ~150-250; the rest is identifiers, logs, or content that should stay trading-flavoured |
| "The money layer needs rewriting" | It is already rank-based and game-neutral; it needs consolidation, not redesign |
| "Journey maps need rebuilding" | Already DB-driven with an admin editor; the deprecated trading constants are not even seeded |
| "We need a new service for Trivia" | DB + Next.js routes only; no new process, port or dependency |

---

## Gate 1 - before Phase P1 begins (owner sign-off on Stage 0)

Stage 0 is a separate delivery. **No games work starts until the owner has tested and confirmed:**

1. The eight money tests pass.
2. There is exactly **one** contest entry path, and it increments `prizePool` on every route.
3. All four bypassed security checks now apply to both entry routes.
4. The five already-missing mirror fields are synced.
5. The mirror-drift CI check is in place **and demonstrably fails** when one side of a pair is changed.
6. The production build succeeds.

Full owner checklist in `00a-STAGE-0-prerequisite-fixes-DO-FIRST.md`.

## Gate 2 - before Phase P2 (Trivia) begins

1. Gate 1 signed off.
2. The trading module wraps existing behaviour, and a regression test proves rankings for historical completed competitions are **identical** to before.
3. Finalization dispatches on `gameType`, with the defence-in-depth assertion in the trading settle path.
4. All five finalization trigger paths audited (worker job, lazy read auto-finalize, force-finalize route, emergency-cancel, challenge job).
5. The dead Inngest crons are deleted or fenced.
6. Market-hours checks are gated on `capabilities.needsMarketHours`.

If any item at either gate is false, the foundation is not safe to build on and every subsequent phase inherits the risk.
