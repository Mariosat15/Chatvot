# PROGRESS - New Games Plan

> **Read this file first in any new chat about the games plan.**
>
> The other documents in this folder describe **what should be done**.
> This file records **what has actually been done**, what the owner has tested and
> accepted, and what to pick up next.
>
> **Rule: this file is updated at the end of every phase, before the phase is
> considered finished.** A phase with no entry in the log below has not shipped.

---

## CURRENT STATUS

| | |
|---|---|
| **Status** | **STAGE 0 IN PROGRESS.** Prerequisite A shipped. **Defect 2 built, awaiting owner test.** Defect 1 not started |
| **Next action** | Owner runs the Defect 2 test checklist in `00a`, and decides the `.d.ts` question. Then **Defect 1** |
| **Owner instruction on record** | "I will need to start today" (1 Sep 2026), superseding "don't start anything" (17 Aug 2026) |
| **Last updated** | 1 September 2026 |

Stage 0 began on 1 September 2026. The games plan itself (P1-P7) remains untouched and
does not start until the owner ticks the Stage 0 sign-off gate.

**One thing has shipped to production:** commit `d5d3a328`, **Prerequisite A** - simulator
route authentication. It was found while re-verifying Defect 1, not planned. It is a live
security fix, unrelated to games, and is recorded in
`00a-STAGE-0-prerequisite-fixes-DO-FIRST.md`.

**Order agreed with the owner (1 Sep 2026):** Defect 2 before Defect 1. Defect 2 is lower
risk and self-contained, and it puts the mirror guard in place before Defect 1 edits the
admin copy of the entry path.

**Defect 2 is now built.** The guard, the sync of all 11 drifted pairs and 20 tests are
in place; `npm run check:mirrors` reports zero drift. Three things it turned up are worth
reading before anything else, because they contradict what the plan said:

1. **Drift is a write-side defect, not a read-side one.** Measured, not assumed. An
   ordinary `save()` does not strip undeclared fields and `.lean()` does not hide them -
   the plan claimed both. What actually happens is that a missing enum value **rejects
   the write**, and the narrower app **cannot write the field at all**, silently, while
   reporting success.
2. **The one read that DOES break is the one code actually uses.** `.lean()` and
   `toObject()` return an undeclared field perfectly, but ordinary `doc.field` access
   returns `undefined`, because Mongoose defines getters only for declared paths. So a
   debug dump shows the value while the line beside it reads nothing. This is the single
   best explanation of why drift survives review, and it is now pinned by a test.
3. **It found three live production bugs nobody was looking for.** Failed withdrawals
   stored with no failure time and no processor reason; six landing-page sections that
   could not be edited at all; and hero and branding images that could never be restored
   after a redeploy, because the admin app could not see the database backup that exists
   for exactly that purpose. The third was found by the typecheck, not the guard - syncing
   `whitelabel.model.ts` removed four standing TypeScript errors (229 to 225).

**No decisions are outstanding.** Three were taken on 1 September 2026:

| Decision | Outcome |
|---|---|
| Test database | `mongodb-memory-server` as a single-node replica set. Built and proven with a real two-collection transaction |
| The orphaned `.d.ts` files | **Delete.** All 112 removed, plus a `.gitignore` rule. The count was 112 repo-wide, not the 62 previously recorded - the earlier figure counted only `database/` and missed 26 files under `lib/` |
| Market hours vs joining | **Joining is allowed at any time; only trading is gated.** Taking the union of the two gates blindly would have blocked weekend sign-ups for Monday contests - a revenue regression introduced by a bug fix. Locked in by Defect 1 test 12 |

The only thing left for the owner is the **Defect 2 test checklist** in `00a`.

---

## DOCUMENT SYNC RULE - APPLIES FROM THE MOMENT BUILDING STARTS

> **Documentation is part of the deliverable, not a follow-up task.** A phase is not
> finished until these documents match what was actually built.

Also enforced by `.cursor/rules/games-plan-docs-sync.mdc`, which loads automatically
in every session.

Whenever implementation happens, or any new information changes an assumption:

1. **Update this file** - status table, sign-off record, and a work-log entry.
2. **Update the affected chapter** among `00a` and `01`-`14`.
3. **Update both HTML versions**, which drift silently because nothing compiles them:
   - `ChartVolt-New-Games-Plan.html` - internal, includes Stage 0
   - `ChartVolt-New-Games-Plan-Partners.html` - partner-facing. **Must never gain any
     reference to Stage 0, the two join paths, the model mirror drift, or any other
     current defect**
4. **Record deviations explicitly** in the work log, with the reason. Never silently
   rewrite the plan to match the code.
5. **Check documents outside this folder**: `External game plans/PROGRESS.md` (the
   external-provider path depends on Phase 1 here), the root `README.md`,
   `deploy/README.md`, the admin wiki
   (`apps/admin/components/admin/AdminWikiSection.tsx`), and
   `legal/ChartVolt-Regulatory-Defence-Pack.html` if anything touches the
   skill-versus-chance argument or the money flow.

**Every model change exists twice** - `database/models/` and
`apps/admin/database/models/`. Same commit, always. That is Defect 2 below.

---

## START HERE NEXT

When the owner says to begin, the next thing to do is **Stage 0**, not Phase 1.

1. Read `00a-STAGE-0-prerequisite-fixes-DO-FIRST.md` in full.
2. Follow it in the order it gives, which begins with **writing the money tests
   against current behaviour** - before changing any code.
3. Stage 0 is a **separate delivery with its own owner sign-off**. Phase 1 does
   not start until the owner has ticked the sign-off gate at the end of that
   document.

Do not skip ahead to Phase 1 even if it looks more interesting. Stage 0 exists
because the games work adds new ways to join a contest and a new critical field,
and both would sit on top of the defects Stage 0 fixes.

---

## STATUS TABLE

Legend: `NOT STARTED` / `IN PROGRESS` / `BUILT - AWAITING OWNER TEST` / `SIGNED OFF`

| Stage | Description | Estimate | Status | Signed off |
|---|---|---|---|---|
| **Prereq A** | Simulator route authentication (unplanned; live security fix, commit `d5d3a328`) | 1 day | `BUILT - AWAITING OWNER TEST` | - |
| **Stage 0 / Defect 2** | Model mirror sync (**11** drifted pairs of 75) + CI guard with allowlist + test-database harness | 3-5 days | `BUILT - AWAITING OWNER TEST` | - |
| **Stage 0 / Defect 1** | Single contest-entry path across all four writers, plus challenge accept (1b) | 3-4 days, +1 for 1b | `NOT STARTED` | - |
| **Phase 1** | Foundation: game label, general score, game registry, ranking seam, trading module, **Game Master insert game label (a gate)** | 2.5-3.5 weeks | `NOT STARTED` | - |
| **Phase 2** | The Trivia game: question bank, gameplay, scoring, settlement, player screens | 2-3 weeks | `NOT STARTED` | - |
| **Phase 3** | Admin: menu restructure, game picker, dynamic settings, question bank, reporting by game | 1.5-2 weeks | `NOT STARTED` | - |
| **Phase 4** | Points, leaderboards, rating, badges, levels, journey, **Game Master creation API and per-game earnings analytics** | 3-4 weeks | `NOT STARTED` | - |
| **Phase 5** | Terminology dictionary, help restructure, trading master switch, job gating, **Game Master wizard finish and tier wording** | 2-2.5 weeks | `NOT STARTED` | - |
| **Phase 6** | Hardening, monitoring, load testing, internal paid contests, launch | 1 week | `NOT STARTED` | - |
| **Phase 7** | Games catalogue + games-first navigation (`/games`, `/games/[slug]`, admin catalogue CRUD) | 2 weeks | `NOT STARTED` | - |
| **Later** | Marketplace per game (see `15` gap 2 - **off the critical path**) | 2 weeks | `NOT STARTED` | - |

**Hard ordering:** Stage 0 (signed off) -> Phase 1 -> Phase 2. Everything after
that has some flexibility; see `14-implementation-phases.md`.

**Phase 7 comes after Phase 2 deliberately.** A games catalogue containing one
non-trading game advertises that the platform is nearly empty. See `15` section 7.

**Game Master work is no longer a "Later" row.** It was listed at 3-4 days; sized against
the code it is **~2.5 weeks**, and its first piece is a **gate inside Phase 1** - until the
Game Master competition route stamps a game label, a Game Master-created contest is settled
by trading code. Distributed through P1, P4 and P5 above. See `15` section 5, and
`External game plans/19-game-masters.md` sections 1-4 for the full analysis, which applies
to this plan identically.

**Revised total: 14-19 weeks**, up from 12-17 for that reason. Adding the marketplace takes
it past 20. That is the honest number.

---

## STAGE 0 SIGN-OFF RECORD

Copy of the gate from `00a-STAGE-0-prerequisite-fixes-DO-FIRST.md`. Tick here as
the owner confirms each item, with the date.

### Prerequisite A - simulator authentication (shipped, awaiting owner verification)

- [ ] After deploying `d5d3a328`, `POST /api/simulator/deposit` with only `X-Simulator-Mode: true` returns **403**
- [ ] Admin simulator either still runs, or is accepted as intentionally off until `ENABLE_SIMULATOR=true` is set **in both apps**
- [ ] Production reviewed for evidence of prior exploitation (wallet transactions with `description: "Simulator deposit"` or `metadata.simulatorMode: true`, reconciled against Nuvei / Atlas)

### Defect 1 - entry paths

- [ ] Joined a paid competition via the **website**; prize pool rose by exactly the entry fee
- [ ] Joined a paid competition via the **API / simulator**; prize pool **also** rose by exactly the entry fee
- [ ] Prize pool on a filled competition equals participants x entry fee
- [ ] **Unverified email** refused via both routes
- [ ] **Restricted account** refused via both routes
- [ ] **Challenge accepted** with a restricted account is refused (sub-defect 1b)
- [ ] Competition run to completion; prizes paid + platform fee equals the prize pool exactly
- [ ] Competition cancelled with participants; everyone refunded, pool zeroed
- [ ] An entry-fee transaction opened in admin **names the competition** it paid for

### Defect 2 - model mirrors

- [ ] `npm run check:mirrors` reports 75 pairs, 0 drifted
- [ ] Check **demonstrated failing** when a field is added to one side of a mirrored pair only
- [ ] Check **demonstrated failing** when an *enum value* is removed from one side only
- [ ] Check **demonstrated passing** for `admin.model.ts`, which is intentionally different
- [ ] `git push` **demonstrated blocked** by the new `pre-push` hook while drift exists
- [ ] Game Master shown correctly on a GM-created competition in admin
- [ ] Payment provider shown on a card deposit in admin transactions
- [ ] A **forced withdrawal failure** now records a failure time and processor reason
- [ ] A **landing-page section that was previously unwritable** (Game Master, competition types, marketplace, journey and badges, or trust badges) saves and persists
- [ ] A player muting challenge / social / messaging notifications is honoured by the admin app
- [ ] Admin balance addition and custom expense still record correctly
- [x] **Decision given** on deleting the orphaned declaration files. Approved, and done: **112 files** repo-wide (57 `.d.ts` + 55 `.d.ts.map`), not the 62 previously recorded, plus a `.gitignore` rule. `types/global.d.ts` and the websocket server's `dist` output kept deliberately

### Automated gate

- [ ] All 11 money tests pass
- [x] All **20** mirror tests pass (12 guard, 8 drift-behaviour)
- [x] Mirror check runs in CI and as a `pre-push` hook
- [ ] The 25 simulator-auth tests from Prerequisite A still pass
- [ ] Full production build succeeds (`next build`) - not just dev mode.
      **Currently blocked by environment**, not by Stage 0: the build compiles but fails
      exporting `/arena` because MongoDB Atlas is unreachable from this machine.

**Owner sign-off date:** _not yet given_

---

## ENVIRONMENT AND DEPLOYMENT

Confirmed by the owner and by inspection on 17 August 2026.

| Thing | Value |
|---|---|
| **The app is LIVE** | https://chartvolt.com/ - real users, real money |
| Database | **MongoDB Atlas** (`mongodb+srv`) |
| Local database | `chatvolt` - **a development database, confirmed by the owner as NOT the live one** |
| Production database | A **different** connection string / database, held on the server. Not present in the local `.env` |
| Development model | Owner works **locally**, commits and pushes to git, then **fetches the update on the server** |
| Git remote | `github.com/Mariosat15/Chatvot.git`, working branch `main` |
| Staging environment | **None identified.** Local development and production only |

### Test database - DECIDED AND BUILT (1 September 2026)

**Decision: `mongodb-memory-server` configured as a single-node `MongoMemoryReplSet`.**
Chosen by the owner over the two Atlas options because it needs no cloud dependency, runs
in GitHub Actions where CI already runs `npx vitest run`, and cannot touch any real data.

Built and proven:

| | |
|---|---|
| Harness | `__tests__/helpers/mongo-test-server.ts` - start, stop, clear, plus `waitForPrimary` so a transaction is never attempted before the replica set has elected one |
| Proof | `__tests__/helpers/mongo-test-server.test.ts` - a two-collection transaction that commits atomically, the same transaction aborting and rolling back atomically, and no data leaking between tests |
| First real use | `__tests__/helpers/mirror-drift-behaviour.test.ts`, which measured what model drift actually does and corrected the plan |

**Install note worth keeping:** `npm install mongodb-memory-server` failed at first on a
**pre-existing** peer-dependency conflict - `vitest@3.2.4` against
`@vitest/coverage-v8@4.0.18`. The versions were aligned to `3.2.4` and all existing tests
were re-run to confirm nothing regressed. This was latent before Stage 0 and would have
broken the next person to add a test dependency.

**CI note:** `mongodb-memory-server` downloads a MongoDB binary on first use, so
`.github/workflows/test.yml` now caches `~/.cache/mongodb-binaries`. Without it every CI
run re-downloads roughly 100 MB and the suite depends on an external host being up.

For historical reference, the options that were considered:

| Option | Notes |
|---|---|
| Separate database name in the same Atlas cluster (`MONGODB_URI_TEST`) | Cheapest. Still a replica set, so transactions work |
| Separate free Atlas cluster | Strongest isolation |
| `mongodb-memory-server` locally | **Chosen.** No cloud dependency, fastest. **Must use `MongoMemoryReplSet`, not the standalone default** - see the transaction note below |

### CRITICAL TECHNICAL NOTE - transactions need a replica set

The contest join path already uses MongoDB **sessions and transactions**
(`{ session: mongoSession }`), and the Stage 0 fix deliberately wraps the wallet
debit and the `prizePool` increment in a single transaction.

MongoDB multi-document transactions **only work on a replica set**. Atlas is one,
so production is fine. But `mongodb-memory-server` in its default **standalone**
mode does not support transactions, and the tests would fail for the wrong
reason. If that route is chosen, it must be `MongoMemoryReplSet`.

### Deployment caution for Stage 0

Stage 0 changes the **live competition join path**. Because there is no staging
environment, deploy it when **no competitions are active**, and verify the owner
checklist immediately afterwards on a low-value test competition.

---

## REPO FACTS A NEW CHAT WILL NEED

Verified on 17 August 2026. Saves rediscovering them.

| Thing | Value |
|---|---|
| Test framework | **vitest** `^3.2.4` (already installed) |
| Test commands | `npm test` (watch), `npm run test:run` (once), `npm run test:coverage` |
| Existing tests live in | `__tests__/services/` - 5 files, including `reconciliation-math.test.ts` |
| Style of existing tests | Pure-function unit tests on extracted logic, with a file-header comment explaining what financial rule is being locked. **Follow this style.** |
| Config | `vitest.config.ts` at the repo root |
| **CI already exists** | `.github/workflows/test.yml` - GitHub Actions runs `vitest run` on every push to `main`, every PR, weekly, and on demand. **This is where the mirror-check guard belongs.** |
| Pre-commit hook | **husky** `^9.1.7`, `.husky/pre-commit` running `eslint --max-warnings=0`. There is **no pre-push hook yet** - one can be added for the mirror check |
| No in-memory database | `mongodb-memory-server` is **not** installed. See the open safety question above |
| Script runner | `tsx` is available, so `scripts/*.ts` can be run directly |
| Lint gate | `eslint --max-warnings=0` - warnings block commits, so new code must be warning-clean |
| Production build check | `npm run build` (main), `npm run build:admin`, `npm run build:all` |

---

## DOCUMENTS IN THIS FOLDER

| File | Purpose |
|---|---|
| `PROGRESS.md` | **This file.** Status of the work. |
| `00-README.md` | Executive summary and index. Read after this file. |
| `00a-STAGE-0-prerequisite-fixes-DO-FIRST.md` | The prerequisite fixes. **Do first.** |
| `01`-`14` | The plan chapters: audit, architecture, data model, scoring, money, gamification, admin, UI, wording, trivia spec, infrastructure, risks, rollout, phases |
| `15-platform-transformation-and-gaps.md` | **Owner direction, 30 Aug 2026.** Games-first platform. The three gaps chapters `01`-`14` did not cover, and the sequencing opinion |
| `ChartVolt-New-Games-Plan.html` | Internal illustrated version, **includes Stage 0** |
| `ChartVolt-New-Games-Plan-Partners.html` | Partner-facing version, **Stage 0 and all current-defect detail removed** |

**If the plan changes, both HTML files must be updated.** The partner version must
never gain any reference to Stage 0, the two join paths, the model mirror drift,
or any other current defect.

---

## WORK LOG

Append one entry per phase as it completes. Newest at the top.
Keep each entry short enough to be read quickly, and specific enough to be acted on.

Template:

```
### [DATE] - [STAGE/PHASE] - [STATUS]
**Shipped:** what was actually built and merged
**Files touched:** the significant ones
**Deviated from plan:** what was done differently and why
**Owner tested:** what the owner verified, and the outcome
**Deferred:** what was consciously left for later
**Next chat should:** the single clearest next action
```

---

### 1 Sep 2026 - Sub-defect 1b measured, and test 12 closed in both directions

`__tests__/services/challenge-accept-guards.test.ts`, 5 tests, plus one more in the gate
parity file. Suite now **217 tests**, from 211. **No production code changed.**

**Sub-defect 1b is proven, not inferred.** Accepting a challenge debits both players, so it
is a money path, and it checks seven guards but **not account restriction and not the fraud
gate**. A suspended account that cannot join a competition **can enter a paid 1v1 and be
debited**. So can a fraud-flagged one. Three of the five tests pin the guards that *are*
present, so a fix cannot quietly drop one while adding the missing two.

The fraud case deserves the emphasis: a challenge is the **easiest** shape for coordinated
entry, being exactly two players with the pot returning to the pair minus the platform fee.
It is the one paid path where that gate is absent. Note the challenge *create* route does
check both - only accept is missing them, which is why reading a single route would never
have found this.

**Test 12 is now complete in both directions.** With the market closed: Gate A admits, Gate B
refuses cleanly, and `placeOrder` refuses with no order and no position created. Both halves
live in one file deliberately - split apart, each reads as an arbitrary rule, and the
decision only means something as a pair. The order half needs almost no fixture because
`placeOrder` checks the market immediately after the session and before it connects to the
database.

**Test 10 also landed, and found live bug 6.** Suite **218**. The plan expected a 409 when
Gate B exhausts its five retries. The route returns **500** and puts `error.message` in the
body verbatim, so the caller gets a raw MongoDB string. Two problems: a 500 stops a browser
retrying and can pull an instance out of a load balancer, so a busy competition looks like an
outage; and returning driver text to an unauthenticated caller names the storage engine and
its configuration. Grep for `error instanceof Error ? error.message` in route responses - the
same shape is likely elsewhere. The clean-refusal half holds and is asserted, so it stays
pinned once the status is corrected.

The test forces the conflict rather than racing for it: a second transaction holds a write
lock on the competition document, WiredTiger fails each attempt immediately, and the retry
budget drains at the speed of its own backoff. Deterministic, where a throughput-based
version would not be.

**Tests 6 and 8 also landed. All twelve Defect 1 tests are now written.** Suite **223**.
`competition-finalize-payout.test.ts`, 5 tests, and unlike almost everything else in Stage 0
this path records **no defect**.

Payout exactness holds in three shapes - ranked, tied, and an uneven 33/33/34 split. The
assertion is `prizes + platform fee == pool` rather than per-winner, because the distribution
may legitimately change and what must never change is that the two sides balance. The dust
case earns its place: prizes are floored to two decimals, and the fee is computed as
`prizePool - totalDistributed`, so the remainder lands in the fee instead of vanishing. A
"tidier" fee calculation that multiplied the percentage directly would silently start losing
it, which is exactly the kind of change the unified service invites.

Double finalize passes, because an optimistic `active` -> `finalizing` lock already exists.
**That makes it the control for live bug 5**: the refund path's double-pay is a missing guard
rather than a property of the money layer, and this test shows what shape the fix takes.

**One fixture trap to know before touching finalization**, because it cost an hour and reads
as a production bug. Finalization **recomputes every participant's stats from positions and
trade history** before ranking, so seeding `pnl` on the participant document does nothing -
it is overwritten with zero, all players tie at rank 1, and the resulting equal payout looks
like a prize-distribution defect. To rank participants you must seed a **closed
`TradingPosition` and a matching `TradeHistory` row**, since the realized amount is read from
the history by `positionId`. Use **USD-quoted symbols** or finalization fetches conversion
rates over the network, and satisfy the **whole** competition schema, because finalization
saves the document.

---

### 1 Sep 2026 - all three live bugs FIXED (owner approved all three)

Suite **225**, mirror guard clean, main typecheck **15 errors from a 16 baseline**, admin at
its 225 baseline, no new lint warnings. **Every test that recorded a defect now proves its
fix**, rather than being deleted - which keeps the reachability argument on record.

**Live bug 5, the double refund.** `cancelCompetitionAndRefund` now claims the competition in
the same `findOneAndUpdate` that sets its final status, in **both apps**. Two details worth
keeping: **no new enum value was needed**, because setting the *final* status up front is the
lock and a transaction abort rolls it back for a retry; and a duplicate request returns
`{ success: true, refundedCount: 0 }` rather than an error, because a retried cron delivery
has done nothing wrong and a failure would invite a third attempt.

**One adjacent hazard is measured but deliberately left open.** The guard is
`status !== "cancelled"`, so a **completed** competition is still refundable - handing back
entry fees on top of prizes already paid. A test records the current behaviour rather than
failing. Closing it means deciding which statuses an admin may cancel, which is policy and
belongs with the unified service, not smuggled into a bug fix.

**Live bug 6, the 500 and the leak.** The join route answers **409** with a message a player
can act on. Fixing it surfaced a second problem the compiler found: the retry loop had **no
return after it at all**, so the function could fall through and return `undefined`, which
Next turns into an opaque 500. Now explicit.

**The sweep result matters more than the fix.** `error instanceof Error ? error.message`
appears **166 times across 119 API route files**. It was deliberately **not** mass-edited - the
change would be unreviewable and many of those messages are legitimate user-facing validation
text. The harm is specific to messages originating in the driver or the framework rather than
in our own `throw`. Recommended when tackled: a helper mapping known-safe errors to their
message and everything else to a generic string, introduced route by route. Now known debt
rather than a future discovery.

**Live bug 4, brandingFiles.** A shared `branding-file-key.ts` helper (mirrored into
`apps/admin`) encodes `.` as `__DOT__`, wired through **two writers, four readers and one
delete** across both apps. `__DOT__` over base64 so the keys stay readable in the document,
which matters for a field whose whole purpose is disaster recovery. Nothing to migrate - no
entry was ever stored. The test asserts a **round trip through the real helper** rather than a
hard-coded string, because the writers and readers only work if they agree, and separately
pins that encoding a dot-free name is a no-op, since the readers encode unconditionally.

---

### 1 Sep 2026 - scope correction before building the unified service: FOUR writers, not two

Verified while mapping the gates. Every description of Defect 1 says "duplicate join paths".
There are **four** places that create a `CompetitionParticipant` and move entry-fee money, and
**two were never on record**:

| # | Path | Reachable by | `prizePool` |
|---|---|---|---|
| 1 | Gate A, `enterCompetition` | The production UI | Yes |
| 2 | Gate B, `POST /api/competitions/[id]/join` | Simulator and tests only | **No** |
| 3 | `app/api/simulator/competitions/join-batch` | Simulator only, guarded | **No** |
| 4 | `apps/admin/.../competition.actions.ts:452` | **Nothing. Dead code.** | Yes |

Also worth recording: **no React component calls Gate B.** It is reached by the simulator and
the tests. That does not reduce the defect - it explains why it has never produced a customer
complaint, and it means the fix can be made without a migration.

**Path 3 repeats Gate B's money defect** and additionally bulk-inserts participants using field
names the schema does not declare (`pnlPercent`, `tradesCount`, `joinedAt`), which Mongoose
drops silently - the same class of bug as the entry-fee ledger.

**Path 4 is dead code, which is what makes it dangerous.** It increments `prizePool`, so it is
not the money defect, but it is missing **email verification and the fraud gate** and it
**throws instead of returning `{ success: false }`**. Wiring it into a future admin feature
would silently adopt the weaker guard set and crash the render.

**This needs an owner decision before the service is built**, because "route both gates through
it" is now four decisions and two of them are policy. Put to the owner; not started.

---

### 1 Sep 2026 - Defect 1: the prize-pool gap proven, and a fifth live bug (double refund)

Two new files, 8 tests, all passing. Suite now **211 tests**, from 203. **No production code
changed.**

**`__tests__/services/competition-join-gate-parity.test.ts`** (4 tests) drives both join
gates side by side in one file, so the disagreement is *measured* rather than restated. This
is the clearest money statement in Defect 1:

- Gate A takes the fee and the prize pool rises by it.
- **Gate B takes the fee, gives the seat, and the pool stays at zero.** There is no
  `prizePool` increment anywhere in the route - it debits the wallet at lines 190-199 and
  `$inc`s only `currentParticipants` at lines 260-264.
- A mixed field of six players, three per gate, collects `6 x entryFee` and leaves the pot
  holding `3 x entryFee`. **Quote the mixed case, not the single-player one** - one player
  reads like a rounding curiosity, and a live competition is reachable from both gates at
  the same time.
- The finalize-time safeguard cannot catch it, and the reason is worth stating precisely: it
  caps the pool when it is too **high**. Too low passes the check and is distributed as
  though correct. **Under-payment is silent; over-payment is not.**

Also covers the join half of test 12: with the market closed, Gate A admits and Gate B
refuses cleanly - no seat, no fee. The order half is still to write.

**`__tests__/services/competition-cancel-refund.test.ts`** (4 tests) covers test 7 and found
**live bug 5: cancelling a competition twice refunds every player twice.**
`cancelCompetitionAndRefund` queries participants with **no status filter** and never checks
whether the competition is already cancelled. Three players starting at 500 who paid a 25 fee
hold **525** after two calls. **The transaction does not help - it makes each pass atomic,
not unique.** Reachable: the Inngest cron sets `status: "cancelled"` and *then* calls the
refund, and the lazy check in `getCompetitionById` cancels and refunds too, so a retried
delivery or an admin cancel racing the cron pays twice. The remedy already exists in this
codebase - finalization locks `active` -> `finalizing` in one `findOneAndUpdate` and bails if
it loses.

**Correction on record:** the "five finalization entry points" claim in
`External game plans/11-foundation-and-seams.md` lines 67-74 is wrong. Two of the five do not
finalize at all (`finalize-old-competitions` closes positions; emergency-cancel refunds), and
three production callers are missing (Inngest `checkAndFinalizeCompetitions`,
`claim-early-end`, `early-end-check`). Corrected list is in `00a`.

**One testing lesson, cheap this time.** A mocked `canJoinCompetition` returned `allowed`
where the real signature returns **`canJoin`**, so the route saw `undefined`, refused, and
returned `error: "Market is open"` - an open-market reason string attached to a 400. Mock the
real signature, not a plausible one; and note that the tell was only visible because the
assertion prints the body. `expect(status).toBe(200)` would have said "expected 400 to be
200" and sent the reader to a debugger.

**Next chat should:** write tests 6 and 8 (payout exactness, double-finalize idempotency),
which both need a fully seeded finished competition, then 10, 11 and the order half of 12.

---

### 1 Sep 2026 - Defect 2 owner checklist cut from eleven items to three, and a fourth live bug found

`__tests__/services/mirror-sync-behaviour.test.ts`, 10 tests, passing. Suite now at **203
tests**, from 193. **No production code changed.**

**Shipped:** eight of the eleven manual checks on the Defect 2 owner checklist are now
automated. Each test writes a field one of the two apps previously could not persist and
reads it back through the raw driver - which is exactly what drift broke. The three
remaining manual checks are the ones a schema test genuinely cannot make: whether a `git
push` is blocked, and whether the admin *forms* are wired to the fields they now store.
Stated in the document so the distinction is not lost: a passing schema test does not prove
a form sends the value.

**Live bug 4, and the sync does NOT fix it.** `brandingFiles` - the base64 backup that
restores hero and branding images after a redeploy - **has never stored a single entry and
still cannot.** The upload route uses the filename as the map key, and **Mongoose refuses
map keys containing a dot.** The sync changed the failure mode without removing it: before,
the undeclared field meant the route fell back to a plain JavaScript `Map` (any key
accepted) and the write was silently discarded; after, the declared field with `default: new
Map()` hands the route a `MongooseMap`, which validates the key and throws. Line 108 of
`apps/admin/app/api/hero-settings/upload/route.ts` catches it and warns, and the upload
still reports success because the file reached the disk. **Nothing to migrate when fixed -
no entry has ever been stored.** Needs a shared key-encoding helper across one writer and
four readers in both apps. **Awaiting owner decision.**

This corrects the claim in the previous entry that the sync fixed image recovery. It made
recovery *possible*; it did not make it work.

**Two testing findings, both of which cost a wrong conclusion.**

The first: `apps/admin` has **its own `node_modules/mongoose`**, so admin models run on a
separate Mongoose instance that the test's `mongoose.connect` never touches. The symptom is
`Operation "x.insertOne()" buffering timed out after 10000ms`, which reads like a slow
database rather than an unconnected one. Reached via `Model.base` rather than a guessed
path, because that IS the instance the model registered on and it survives npm hoisting.
Also: **never import both copies of the same model into one test.** Both register under the
same name via `models.X || model(...)`, so the second import silently returns the first, and
the test then examines the wrong schema while looking correct.

The second: **pre-creating collections fixed only half of the catalog-changes artifact.**
Mongoose builds a model's indexes on first use, and an index build is itself a catalog
change. The residue was rarer and therefore worse - the sequential control test passed alone
and failed **about one full-suite run in three**. `settleIndexes()` now awaits `Model.init()`
for every registered model. The concurrency measurement is now **self-auditing**: it
classifies each failure and asserts the artifact and unknown buckets are empty, so noise
fails the test instead of inflating the finding. Six consecutive full runs: `1/20 admitted,
19 write conflicts, 0 artifacts`.

One near-miss worth keeping, because it would have erased the finding rather than inflating
it: a genuine write conflict reads `Write conflict during plan execution **and yielding is
disabled**`. Treating "yielding is disabled" as an infrastructure marker - tempting, since
the in-memory engine does say it - would have filed all 19 real failures as noise.

**Next chat should:** write Defect 1 tests 6, 7, 8 (payout exactness, cancel and refund,
double-finalize idempotency), then 10, 11, 12.

---

### 1 Sep 2026 - Defect 1 tests 1 and 2: Gate A admits one join in twenty under contention

`__tests__/services/competition-entry-concurrency.test.ts`, 5 tests, passing. **No
production code changed.** Suite now at **193 tests**, from 154 this morning.

Run 20 joins **sequentially**: all 20 succeed, and `prizePool`, `currentParticipants`, the
participant documents and the wallet debits agree exactly. **The accounting is correct** -
that test exists so the next result cannot be misread as broken arithmetic.

Run the same 20 **simultaneously**: **one succeeds.** The other 19 fail with
`Write conflict during plan execution ... Please retry your operation or multi-document
transaction`. Gate A wraps entry in a transaction with **no retry**; Gate B retries five
times for exactly this reason. The plan inferred this from the code. It is now measured.

Two caveats, because the number will get quoted. The ratio is **not** a production
prediction - a single-node in-memory replica set has tighter lock timeouts and reports
`yielding is disabled`, so production loses fewer. And the test pins the *mechanism*, not
the ratio: assertions are written against the observed success count rather than against 20,
so they keep passing once the retry is added.

**A false finding was nearly recorded, and this is the part worth remembering.** The first
run also said 1 in 20 - but most failures were `Unable to write to collection ... due to
catalog changes`, which is **MongoDB refusing to create a collection inside a transaction**.
That is a property of a fresh test database, and it is indistinguishable from a contention
failure at a glance. Had it gone unnoticed, "the entry path collapses under load" would have
been written down as a production fact on the strength of a test-server artifact.

`ensureCollections()` was added to the Mongo helper to pre-create every collection the code
under test writes, the finding was re-measured, and the real write conflicts remained. Any
future concurrency test must call it **before** drawing a conclusion. Two smaller mock gaps
were fixed the same way - a partial mock of `user-restriction.service` was throwing
"No export is defined", and the noise buried the real failure.

Also fixed a fidelity bug in the harness: the default test user id was `"test-user-1"`,
which is not ObjectId-shaped. Most models type `userId` as `String` and accept it, but the
fraud models declare `Schema.Types.ObjectId`, so the coordinated-entry detection threw a
`CastError` that the entry path catches and logs. The tests still passed while **a whole
branch of the code under test silently never ran.** Better Auth uses the MongoDB adapter, so
real ids are ObjectId strings; the fixture now matches. A fixture that cannot reach the code
under test is worse than none, because it looks like coverage.

### 1 Sep 2026 - The other half of the same emit: 113 stale `.js` files, and they were NOT inert

**This is the most important finding of the day, and it was found by accident.** Building the
server-action test harness failed with `Cannot find module '@/database/mongoose'`, and the
stack named `lib/services/xp-level.service.js` - a **compiled JavaScript file** beside the
TypeScript source.

**57 stale `.js` plus 56 `.js.map`, from 22 December 2025** - a *different and earlier*
accident than the `.d.ts` files deleted hours before, which were from 1 February 2026. Same
57 modules. The declaration cleanup had removed one half of a `tsc` emit and left the other.

**The declarations were inert. The JavaScript was not.** That distinction is the whole
lesson, and "it is only build output" does not settle it - what settles it is which file wins
in a given resolver.

Measured with a deliberately chosen probe: `xp-level.service.js` lacks four exports the
current `.ts` has, including `awardXP`, so asking whether `awardXP` is a function reveals
which file loaded.

| Toolchain | Resolved | Verdict |
|---|---|---|
| **vitest** | the stale `.js` | **Broken**, then failed outright - 18 of the 57 use `require("@/...")`, which Vite will not resolve for an externalised CommonJS file |
| `tsx` (worker, dev) | the `.ts` | Correct |
| esbuild (`worker:build`) | the `.ts` | Correct |
| `next build` | the `.ts` | Correct, `✓ Compiled successfully` |

**Production was never running the stale code**, which is why nobody noticed for seven
months. But **all 57 modules - every model plus the money-critical services - were
unimportable in any test**, so the Defect 1 money tests could not have been written at all.
A blocker on the entire defect, sitting in files everyone assumed were harmless junk.

Owner approved deletion. Verified after: typecheck identical (16 main, 225 admin), 188 tests
passing, worker bundle builds, `next build` compiles. The only build failure is Atlas being
unreachable from this machine during static generation, which pre-dates all of this work.

The `.gitignore` rule for `.js` is **scoped to `/database/**` and `/lib/**`**, not a blanket
`*.js`, because `ecosystem.config.js`, `scripts/*.js`, `worker/build.mjs` and the
`api-server` build are hand-written and a blanket rule would swallow them.

**A mistake of mine, recorded rather than hidden:** the earlier `.d.ts` rule negated
`next-env.d.ts`, which Next auto-generates and which was already correctly ignored further up
the file. Later rules win in `.gitignore`, so my negation silently undid a correct earlier
rule and added two untracked files to every checkout. Removed, and both directions are now
probe-verified.

**Two rules worth carrying:** when deleting emitted output, **look for the other half of the
emit** - a `tsc` run that produced `.d.ts` produced `.js` too. And **prove which file a
resolver picks** rather than reasoning about it; a missing export makes a perfect probe.

### 1 Sep 2026 - Server-action test harness built, and Gate A's guards locked in

`__tests__/helpers/server-action-context.ts` plus
`__tests__/services/competition-entry-guards.test.ts` (6 tests, passing). Defect 1 tests 3,
4 and 5 for Gate A. **No production code changed.**

Server actions read the caller from ambient request state that does not exist in a test, so
the session, headers, restriction service and fraud gate are all replaced. The context is a
*module* rather than a fixture object because `vi.mock` factories are hoisted above the
imports and cannot close over local variables - but they can import a module.

**One detail cost real time and would cost it again.** These actions convert errors into
`{ success: false, error }` and re-throw only errors whose `digest` starts with `NEXT_`.
A `redirect()` mock without a `digest` gets swallowed into a result object, so the redirect
appears never to fire and **the production code looks broken when it is correct.** The mock
now sets a realistic digest, and there is a test asserting the re-throw - because if that
check is ever "simplified" away, an unauthenticated visitor silently gets an error object
instead of the sign-in page.

Every refusal test asserts **no participant, no debit, no prize-pool change**, not just the
error message. A guard that refuses after taking the money is worse than no guard, and
half-completed entry is precisely what unifying two divergent paths risks. The positive case
is included deliberately: without it, a guard that refused *everyone* would pass every other
test in the file.

### 1 Sep 2026 - Orphaned `.d.ts` files deleted, and two decisions recorded

**112 files deleted** (57 `.d.ts` + 55 `.d.ts.map`), on owner approval. No production code
changed.

**The count in this document was wrong twice, and the second correction is the lesson.**
The original write-up said two files. The first re-verification said 31 + 31, because it was
investigating model mirrors and therefore searched `database/`. A repo-wide
`git ls-files "*.d.ts"` found **57**, the rest under `lib/services/` and `lib/actions/`.
The same mistake the mirror audit made: *scoping a count to the directory you happen to be
looking at, then reporting it as a total.*

**Two files were kept, and the rule matters more than the list.** Delete a `.d.ts` only if
a sibling `.ts` exists and it is not under `dist/` - a sibling `.ts` is what proves the file
is a redundant copy rather than a declaration in its own right. That rule kept
`types/global.d.ts` (hand-written, no sibling, sole source of its types) and
`websocket-server/dist/index.d.ts` (separate build, own lifecycle) automatically. Two files
had no `.map` and needed a manual look; both are `export declare const` throughout, which is
emitted output, and both came from the same 1 February commit as the rest.

**Proof of inertness, measured before and after:** main app 16 type errors, admin app 225 -
identical. 182 tests still pass, mirror guard still reports 75 pairs in agreement.

A `.gitignore` rule now ignores `*.d.ts` / `*.d.ts.map` with negations for the two keepers
and `next-env.d.ts`. Verified in both directions: a probe file under `database/models/` is
ignored, and neither keeper is.

**Owner decision on market hours, recorded because it changes the Defect 1 design.**
Unifying the two entry gates forced a product question, since Gate B blocks joining outside
market hours and Gate A does not. Taking the union blindly would have adopted Gate B's
behaviour and **blocked weekend sign-ups for Monday contests** - a revenue regression
introduced by a bug fix, which is the sort of thing "apply every check from both sides"
quietly produces.

Decision: **joining is allowed at any time; only trading itself is gated by market hours.**
Joining moves credits into a prize pool - no position is opened and no price is needed, so a
closed market makes nothing unsafe. The existing check stays exactly where it is, on order
placement in `order.actions.ts`.

Consequence for the build: the unified `contest-entry.service.ts` takes the union of the
*security* checks only and does **not** carry the market-hours check. That removes the one
differing behaviour the `source` parameter existed to express, so `source` should be kept
for audit and rate limiting but should no longer gate a check. Added as **test 12**: join an
`upcoming` competition outside market hours, then try to place an order in it - the join must
succeed and the order must be refused. It fails a fix that blocks the join *and* a fix that
lets the order through.

### 1 Sep 2026 - Stage 0 Defect 1, test 9 written first (no production change)

Defect 2 is committed as `0798a935` and awaiting the owner test. Rather than idle, the
first of Defect 1's eleven required tests is written. **No production code was touched** -
this is the "tests-first" step the plan calls for, and it is safe to do before sign-off
because it adds nothing to the runtime.

`__tests__/services/entry-fee-ledger.test.ts`, 4 tests, passing.

**It converted an inference into a proven defect.** The plan said Gate A writes
`referenceId` into a schema that does not declare it, and reasoned that the reference must
therefore be lost. That is now measured against a real MongoDB: write the exact row
`competition.actions.ts:548` writes, read it back through the driver, and the `referenceId`
property is absent while `competitionId` is `undefined`. **Every competition entry fee ever
collected is unattributable to its competition.**

**The scope was checked, not assumed, and it is narrower than it sounds.** Nothing computes
money from `WalletTransaction.competitionId` - `withdrawal-validator.service.ts` reads that
field from `CompetitionParticipant`, and `platform-financials.service.ts` uses its own
`sourceId`. So this is a broken **audit trail**, not a wrong balance. Worth stating plainly
because "money ledger bug" invites a panic the evidence does not support.

Two further findings worth keeping:

- **Only two places write `referenceId`**, and they agree: Gate A and its admin mirror at
  `apps/admin/lib/actions/trading/competition.actions.ts:610`. This is one bug duplicated,
  **not** mirror drift - so the new guard does not catch it, and cannot. A test must.
- **The guard cannot check one enum**, and says so rather than passing quietly:
  `hero-settings.model.ts:featuresColumns` builds its allowed values at runtime instead of
  as a literal list. 74 of 75 pairs are compared in full; that one is compared by field
  name only. Recorded in `00a` under "The one thing the guard cannot check".

Also included a fourth test that fails if anyone "fixes" this by loosening the schema: a
typo'd `transactionType` must still be rejected, because every total that groups by that
field depends on it.

### 1 Sep 2026 - Stage 0 Defect 2 (model mirrors) - BUILT, AWAITING OWNER TEST

**Shipped:** the mirror guard, the sync of every drifted pair, and the test database the
rest of Stage 0 depends on. `npm run check:mirrors` reports **75 pairs, 0 drifted, 1
allowlist entry**. Nothing is deployed - this is code and tests only.

**Files touched:**
- `tools/model-mirror/{parse-schema,compare,allowlist,cli}.ts` - the guard, four small
  modules so the comparison logic is importable by tests
- `__tests__/helpers/mongo-test-server.ts` + `.test.ts` - real in-process MongoDB replica
  set, with a proof that a two-collection transaction commits and rolls back atomically
- `__tests__/helpers/mirror-drift-behaviour.test.ts` - 8 tests measuring what drift does
- `__tests__/services/model-mirror.test.ts` - 12 tests proving the guard guards
- 11 model pairs synced across `database/models/` and `apps/admin/database/models/`
- `.husky/pre-push`, `.github/workflows/test.yml`, `package.json`

**Three corrections to the plan, all measured rather than argued:**

1. **Drift is a write-side defect.** The plan said a whole-document `save()` strips fields
   the schema lacks, and that the admin app "cannot see" drifted fields. Both are wrong.
   An ordinary `save()` `$set`s modified paths only and preserves the rest; `.lean()` and
   `toObject()` return the field intact. What actually happens is worse in one way and
   narrower in another: a **missing enum value rejects the whole write**, and the
   narrower app **cannot write the field at all** - silently, while reporting success.
   This is why the guard compares enum *values* and not just field names.
2. **But `doc.field` DOES read as `undefined`** - the one read that breaks is the one
   application code actually uses, because Mongoose defines getters only for declared
   paths. This was not understood when correction 1 was first written and it matters
   more: it is how a drifted field passes a debug inspection and still takes the wrong
   branch at runtime. It is what made live bug 3 below invisible.
3. **Eleven pairs were drifted, not ten.** The new one is
   `user-notification-preferences.model.ts`: the admin app cannot represent a player
   muting challenge, social or messaging notifications, so it ignores that choice.

**Three live production bugs found while syncing:**

- **Failed withdrawals record neither a time nor a reason.**
  `app/api/nuvei/withdrawal/route.ts` writes `failedAt` and `failedReason` on all three of
  its failure paths. The main app's schema declared neither, and `failedReason` was
  declared in **neither** app's copy. Both have been added to both copies. Same class of
  bug as the `WalletTransaction.referenceId` mismatch under Defect 1, and found the same
  way - which is the strongest argument for the guard, since nobody was looking for it.
- **Six landing-page sections were not administrable.** `hero-settings.model.ts` was
  missing **42** fields from the admin copy, not 26 - the Game Master showcase,
  competition types, marketplace, journey and badges, trust badges and enterprise case
  studies. The admin app is the editor for this content and saves it with
  `Object.assign(settings, body)` then `save()`, so an admin posting any of those fields
  got a success response and no change.
- **Hero and branding images could never be restored after a redeploy.**
  `whitelabel.brandingFiles` is a Map holding a base64 copy of every uploaded branding
  image, kept for exactly the case where the container comes back with an empty disk. The
  admin schema did not declare it, so `settings?.brandingFiles?.get(name)` read
  `undefined` in `app/api/assets/hero/[filename]/route.ts:52` and
  `app/api/assets/images/[filename]/route.ts:96` - the restore path never ran and the
  image stayed 404. The delete path,
  `app/api/hero-settings/upload/route.ts:186-187`, had the mirror-image fault: the disk
  file was removed and the database copy left behind permanently. **Found by the
  typecheck, not the guard** - syncing `whitelabel.model.ts` took the admin app from 229
  standing TypeScript errors to 225, and all four were this field. Worth noting as a
  method: after syncing, diff the typecheck against the pre-sync baseline, because errors
  that *disappear* mark code that was already reaching for a field its schema denied it.

**Deviated from plan, three times, each recorded deliberately:**

1. **The guard lives in `tools/model-mirror/`, not `scripts/`.** `.cursorignore` excludes
   `scripts/`, which makes the guard unreadable and unwritable to AI sessions - a poor
   home for maintained, tested code that future sessions must extend.
2. **The 31 stale `.d.ts` files will be deleted, not updated.** The plan said "two stale
   `.d.ts` files, update them". There are **31 `.d.ts` plus 31 `.d.ts.map`**, all
   committed in February 2026, all stale, and all **orphaned build output** - each carries
   a `sourceMappingURL`, and `tsconfig.json` is `noEmit`, so nothing regenerates them.
   They are also **inert**: TypeScript resolves the sibling `.ts` first. Proven by moving
   all 62 out of the repository, which produced a byte-identical set of 16 pre-existing
   type errors and a clean compile. Updating them by hand would create a *third* copy of
   every schema to keep in step - exactly the disease this defect is about.
   *(Superseded the same day: the owner approved deletion, and the count was wrong here
   too - **112 files repo-wide**, not 62. This entry counted only `database/`. See the
   `.d.ts` work-log entry above.)*
3. **The allowlist has one entry, not the several anticipated.** `withdrawal-request.model.ts`
   was expected to need one; it turned out to be a real bug instead. Only `admin.model.ts`
   is genuinely deliberate, and the entry records both why and the condition that would
   invalidate it - if the main app ever writes an Admin document, the lockout and
   permission fields would be silently discarded.

**Owner tested:** not yet. The checklist is in `00a`, "Owner test checklist - Defect 2".

**Deferred:**
- The `.d.ts` deletion, pending the decision above.
- The 19 duplicated action files and 51 duplicated service files. Explicitly out of Stage
  0 scope, and a field-comparison guard cannot help with them.
- Index drift. `competition-participant.model.ts` has matching fields but the main app has
  four compound indexes the admin copy lacks. The guard does not compare indexes; this is
  a performance difference, not a correctness one.

**Blocker found, unrelated to Stage 0 but it obstructs the sign-off gate:** `next build`
**compiles** cleanly but cannot complete on this machine. It fails exporting `/arena` with
`ReplicaSetNoPrimary` against MongoDB Atlas, because static export needs a reachable
database. The gate requires a passing production build, and Defect 1's verification will
need the same. Worth resolving before Defect 1 starts.

**Next chat should:** run the Defect 2 owner checklist in `00a`, settle the `.d.ts`
question, then start **Defect 1** - the four competition-entry writers - beginning with
the money tests now that the transaction harness exists.

---

### 1 Sep 2026 - Stage 0 started; Prerequisite A shipped - PARTIALLY SHIPPED

**Trigger:** owner said "I will need to start today" and asked what the two defects were
and what the risks of fixing them are. Re-verifying both against the codebase before
answering turned up a live security hole and corrected four claims in the plan.

**Shipped:** commit `d5d3a328`, 20 files, pushed to `main`. **Prerequisite A - simulator
route authentication.** The `/api/simulator/*` routes guarded themselves with
`if (!isSimulatorMode && !isDev)`, an `AND` of two negatives that any caller satisfied by
sending `X-Simulator-Mode: true`. There is no `middleware.ts` in the repository, so nothing
blocked the path in production. `POST /api/simulator/deposit` therefore credited any wallet
by user id, unauthenticated, and raised `totalDeposited` too, so the balance looked like a
genuine funded deposit to withdrawal eligibility downstream. A correct helper already
existed but was called by one route, and it accepted the header alone when
`INTERNAL_API_SECRET` was unset.

- `lib/services/simulator/simulator-mode.ts` now fails closed: header **and**
  `ENABLE_SIMULATOR=true` **and** a constant-time match on `INTERNAL_API_SECRET`
- `guardSimulatorRoute()` adopted by all ten previously unguarded routes. The ten
  `/api/simulator/attack/*` routes already had a stronger guard and were left alone
- `competitions/[id]/join` and `challenges` no longer read the headers raw, closing an
  impersonation branch on two **money** routes. `positions/tpsl` had accepted
  `X-Simulator-User-Id` without `X-Simulator-Mode` at all
- Same fail-open pattern fixed in `leaderboard/invalidate`,
  `internal/symbol-config-refresh`, `internal/price-health`, which fell back to the
  literals `"simulator-cleanup"` and `"internal-key"`. New shared `lib/utils/internal-auth.ts`
- `__tests__/services/simulator-auth.test.ts` - 25 tests. Ten import the real route
  handlers and assert 403, so they prove the routes call the guard rather than testing the
  guard in isolation

**Four corrections to the plan, all found by re-verification:**

1. **The finalize-time safeguard does not mask the prize-pool gap.** The plan said it did.
   `competition-end.actions.ts` 695-718 only fires when the pool is too **high**. An
   under-counted pool is under-distributed with no correction and no log. Worse than
   documented, not better
2. **Gate B is not on the customer path.** Both real join buttons call `enterCompetition`;
   the API route is called only by the simulator service. The defect is a loaded gun, not a
   live wound - which lowers the urgency but not the priority, since games work adds callers
3. **There are four competition-entry writers, not two.** Including an admin mirror missing
   the email check and fraud gate, and a `join-batch` route with no callers at all
4. **75 mirrored model pairs, not ~21; 10 drifted, not 3.** Plus `platform-financials.model.ts`
   drifting in *both* directions, which fails writes rather than hiding fields, and 19
   action + 51 service files duplicated the same way (out of scope, now recorded).
   *(Superseded the same day by the Defect 2 entry above: the count is **11** drifted, and
   the mechanism of harm was measured and turned out to be write-side, not read-side.)*

**Three new defects found:**

- **Sub-defect 1b:** the challenge *accept* path skips account restrictions and the fraud
  gate. Unlike Gate B this is a route **real players use**, and it is where the money moves.
  Folded into Defect 1
- Gate A writes `referenceId` on the entry-fee ledger row, but that field **is not in the
  `WalletTransaction` schema**, so Mongoose drops it. Production entry fees cannot be traced
  to the contest they paid for
- Gate B's retry loop has no `return` after it, so five write conflicts return `undefined`

**Files touched:** `00a-STAGE-0-prerequisite-fixes-DO-FIRST.md` substantially revised (a
verification log, Prerequisite A, corrected impact, sub-defect 1b, 11 money tests, 8 mirror
tests, test-database blocker); `00-README.md`, `01-current-state-audit.md`,
`05-prizes-money-layer.md`, `12-risk-register.md`, `14-implementation-phases.md`;
`External game plans/18-migration-testing-rollout.md` and `17-risk-register.md`; both
`PROGRESS.md` files; `ChartVolt-New-Games-Plan.html` Stage 0 section. Partner HTML
deliberately untouched.

**Deviated from plan:** Prerequisite A was not in the plan at all. It was fixed immediately
rather than queued, because it was exploitable in production. Stage 0 effort revised from
**5-8 to 6-9 days**.

**Owner tested:** nothing yet. `d5d3a328` needs deploying, and the three Prerequisite A
checks in the sign-off record run after that.

**Deferred:** the five optional adjacent fixes listed at the end of `00a` (dead Inngest
crons, `challenge_refund` never written, missing refund notification, the silent pool
correction, `join-batch` with no callers). None gate sign-off.

**Next chat should:** settle the test-database decision (`mongodb-memory-server` as
`MongoMemoryReplSet` is the recommendation - it is currently **not installed**), then start
**Defect 2**, which is the agreed first fix.

---

### 30 Aug 2026 - Game Masters re-sized from four days to 2.5 weeks - DOCUMENTED

**Trigger:** while writing `External game plans/19-game-masters.md` the Game Master system
was read properly against the code for the first time. `15` section 5 had called it
"residuals, roughly three to four days". That was wrong by an order of magnitude, and the
error mattered because one item inside it is a **gate**.

**What the system actually is:** three dedicated collections
(`gamemastersubscriptions`, `gamemasterearnings`, `userreferrals`), 28 API routes, three
marketplace-seeded subscription tiers, a referral attribution chain set at signup, a daily
renewal worker job, and **two** earning paths - competition finalization and challenge
finalization.

**Three findings the plan did not have:**

1. **A Game Master earns from the entry fees of players they referred, in any contest those
   players enter** - not from contests the Game Master created. Creating competitions is
   how they attract referred players; it is not the revenue event. The convenient
   consequence is that **the revenue share works for a Trivia contest with no Game
   Master-specific work at all**, from the first settlement
2. **`app/api/gamemaster/competitions/route.ts` inserts with the raw MongoDB driver and
   sets no game label** (line 466). This is risk R7, and this is where it bites: an
   unlabelled competition reads as trading, is settled by trading code, and **pays the
   wrong players.** Same for the admin twin. Promoted to a **gate inside P1**
3. **`apps/admin/lib/actions/trading/competition-end.actions.ts` contains no Game Master
   earnings logic at all** - the main app has ~500 lines of it at lines 931-1459, the
   mirror has only `isGmCreated` at line 709. A competition finalized through the admin app
   pays the Game Master **nothing** and records no `retained_gm_fee` explaining why. A live
   defect, unrelated to this project, now recorded

**Files touched:** `15-platform-transformation-and-gaps.md` section 5 rewritten with a
correction notice, section 7 sequencing block and honest-total updated;
`14-implementation-phases.md` deferred table and Total revised; this file's phase table,
totals and work log; both HTML roadmaps.

**Totals revised: 14-19 weeks for P1-P7**, up from 12-17. P1 to 2.5-3.5 weeks, P4 to 3-4,
P5 to 2-2.5. Game Masters are **no longer a deferred item** - only the per-game marketplace
remains unscheduled.

**Deviated from plan:** nothing built differently; an estimate was corrected upward. Worth
recording that it was found by reading code rather than by planning, which is the argument
for verifying every remaining estimate the same way before any of them is committed to.

**Owner tested:** N/A - documentation only.

**Next chat should:** still Stage 0. This changes no sequencing before it, but P1 now has
one extra must-do item.

---

### 30 Aug 2026 - Owner direction: games-first platform - DOCUMENTED

**Shipped:** the owner's direction that ChartVolt becomes a games-first competition
platform with trading as one game among several. Captured in
`15-platform-transformation-and-gaps.md`, then propagated:

- `14-implementation-phases.md` - new **P7 games-first navigation (~2 weeks)**, deferred
  items table (marketplace, Game Master residuals), totals revised to **12-17 weeks**
  for P1-P7, plus an explicit note that the whole programme is close to six months
  and that P1-P3 is a legitimate stopping point
- `ChartVolt-New-Games-Plan.html` - new **chapter 15 "Games-first navigation"** with a
  before/after journey diagram, the game-module vs catalogue-entry distinction, the
  four states that must be designed rather than discovered, the marketplace
  no-pay-to-win and no-random-packs rules, and the Game Master residuals. Roadmap
  renumbered to 16, Phase 7 and a LATER row added, hero and Stage-0-vs-Games diagram
  figures updated, forward pointer added to chapter 9
- `ChartVolt-New-Games-Plan-Partners.html` - end-state statement in section 1, "How
  players find a game" with its own diagram in section 9, the marketplace rule with
  sell/never-sell cards in section 6, Phase 7 in the roadmap, timeline SVG rescaled to
  seven phases with a second milestone for the games-platform relaunch. **No Stage 0
  or defect detail introduced** - checked
- `.cursor/rules/games-plan-docs-sync.mdc` - created, so the sync obligation survives
  a new chat

**Deviated from plan:** the catalogue is sequenced **last** rather than first, against
the instinct to build the visible part early. Reason: a games page holding one
non-trading game advertises an empty platform, and it is the cheapest, lowest-risk
piece to add once there is something to list.

**Owner tested:** N/A - documentation only, no code.

**Deferred:** per-game marketplace (~2 weeks) and Game Master residuals (~4 days) are
recorded but deliberately unscheduled.

**Next chat should:** still Stage 0. This entry changed no sequencing before it.

---

### 17 Aug 2026 - Planning - COMPLETE

**Shipped:** 15 planning documents plus two illustrated HTML versions (internal
and partner-facing). No application code changed.

**Deviated from plan:** N/A - this was the planning stage.

**Owner tested:** N/A.

**Deferred:** All implementation. Owner explicitly instructed that nothing is to
be started until they say so.

**Next chat should:** Wait for the owner's go-ahead, then start **Stage 0** by
reading `00a-STAGE-0-prerequisite-fixes-DO-FIRST.md` and writing the money tests
first.

**First decision at kickoff:** pick where the money tests run - see "Test database"
above. Local and production are separate databases, so this is about keeping the
development database clean, not about protecting live data.

**Second thing to remember:** the tests must run on a **replica set**, because the
join path uses MongoDB transactions. See the transaction note above.
