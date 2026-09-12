# 19 - Game Masters on Provider Games

Game Masters must work for provider games exactly as they work for trading today:
create competitions, refer players, and earn a share of the fees those players generate.

Earlier drafts of this plan treated this as a handful of residual tasks. That was wrong.
The Game Master system is substantial - three dedicated collections, 28 API routes, a
subscription and tier economy, a referral attribution chain, its own renewal worker job,
and two separate earning paths keyed to competition and challenge finalization. It needs
its own chapter.

There is also one genuinely new commercial problem that trading never had: **a provider
charges per round, and the Game Master's share is calculated before that cost exists.**
Section 5.

---

## 1. What the system actually is today

Verified against the codebase, because the plan must be built on how it really works
rather than how it is assumed to work.

### Collections

| Collection | Model file | Purpose |
|---|---|---|
| `gamemastersubscriptions` | `database/models/gamemaster/gamemaster-subscription.model.ts` | One subscription per user - tier, limits, referral code, counters |
| `gamemasterearnings` | `database/models/gamemaster/gamemaster-earning.model.ts` | One row per earning event, per referred player |
| `userreferrals` | `database/models/user-referral.model.ts` | Which Game Master referred which player. **The source of truth for attribution** |

**None of these has an `apps/admin/` mirror.** The admin app reaches the same collections
through the raw MongoDB driver instead. That is a different failure mode from the mirror
drift in `17` risk R2, and arguably a safer one - but it means **admin-side Game Master
code gets no schema validation and no Mongoose defaults at all.** Treat every admin write
to these collections as hand-rolled.

### How a Game Master earns

The mechanism is not what the name suggests, and getting this wrong would produce a badly
wrong plan.

> **A Game Master earns from the entry fees of players they referred - in any contest
> those players enter. Not from contests the Game Master created.**

Creating competitions is how a Game Master attracts and retains referred players. It is
not itself the revenue event.

| | |
|---|---|
| **Where it happens** | **Since the X5 extraction, 4 Sep 2026: `lib/services/settlement/game-master-fees/` (`calculate.ts` + `distribute.ts`), mirrored into `apps/admin`.** It was inline at `competition-end.actions.ts` lines 931-1459. **Since 5 Sep 2026 (R26) the admin app's `finalizeCompetition` calls it too**, via `settleFeesAndGameMasters` - before that it called nothing and paid nobody. **Since 12 Sep 2026, challenges call the same shared stage.** `lib/services/settlement/challenge-settlement.service.ts` (mirrored) now determines the winner, resolves the tie, saves the challenge document and calls `payContestPrizes()` then `settleFeesAndGameMasters()` with `contestKind: "challenge"` - the exact question this row used to leave open ("whether the same referral divergence exists there") is answered: **it did, on both apps, and it is closed by the same fix**. Both `challenge-finalize.actions.ts` files are now thin wrappers - the answer determination, tie resolution, prize payout and fee/GM stage all live in shared code; only the position-closing and stats-update steps (which have no competition equivalent) stay inline. `completeContest()` is deliberately **not** reused for challenges - a challenge has no lifecycle stage matching a competition's completion - so it is `payContestPrizes()` and `settleFeesAndGameMasters()` only, never the third stage |
| **Attribution** | `userreferrals` where `isActive: true`, falling back to `user.referredByGameMasterId` |
| **Formula** | `referred_player_count x entryFee x (feePercentage / 100)` |
| **Percentage of** | The **entry fee** - not the platform fee, not the prize pool |
| **Percentage source** | Live from `marketplaceitems.gameMasterConfig.referralFeePercentage`, falling back to `subscription.limits.referralFeePercentage` (default 5). **The fallback is reached only when the package has been deleted or the subscription carries no `packageId`** - the live read is the normal path, and getting that distinction wrong is what made R31's original wording point at the wrong branch |
| **A configured 0% means 0%** | Since **5 Sep 2026** (R31). The fallback used `\|\| 5`, and six routes stored a 0% package as 5%. Both now resolve with a finite-number check, and `lib/services/gamemaster/subscription-limits.ts` is the single writer of the cached limits shape |
| **Hard cap** | Total Game Master earnings **may never exceed the gross platform fee**. Payments are scaled down proportionally if they would. Lines 1228-1245 |
| **If inactive or paused** | No payment. The platform keeps the share, recorded as `retained_gm_fee` on the platform ledger |
| **Ledger entries** | `gamemaster_earning` for competitions, `gamemaster_challenge_referral` for challenges |

### Tiers

Seeded in `lib/services/marketplace-seed.service.ts` lines 424-610:

| Tier | Price | Competitions/day | Max players | Referral % | Challenge earnings |
|---|---|---|---|---|---|
| Starter | 299 credits | 1 | 30 | 5% | No |
| Pro | 599 credits | 3 | 75 | 7.5% | Yes, 5% |
| Elite | 999 credits | 10 | 150 | 10% | Yes, 7% |

Limits live in `MarketplaceItem.gameMasterConfig` and are copied to
`subscription.limits` at purchase - but **runtime checks read the live marketplace item**,
so an admin editing a tier changes behaviour for existing subscribers immediately.

Renewal is handled by `worker/jobs/gamemaster-renewal.job.ts`, scheduled daily in
`worker/index.ts` line 443.

---

## 2. What already works for provider games, unchanged

The good news, and it is most of the system.

| Concern | Why it needs no change |
|---|---|
| **Earning calculation** | Keys on `entryFee` and participant user IDs. Neither is trading-specific |
| **The platform-fee cap** | Fee arithmetic, no game concepts |
| **Referral attribution** | Set at signup from a `GM`-prefixed code. Nothing to do with games |
| **Subscription, tiers, renewal, pause, cancel** | Entirely game-agnostic |
| **`retained_gm_fee` when inactive** | Platform ledger, game-agnostic |
| **Ledger entry types** | `gamemaster_earning` and `gamemaster_challenge_referral` describe the **contest kind**, not the game. They stay as they are - renaming them would orphan financial history (`17` risk R13) |
| **Earnings and referrals dashboards** | Read `gamemasterearnings` and `userreferrals`, which carry no game fields |

So a Game Master whose referred player enters a chess-puzzle competition **already earns
correctly**, the moment that competition can be created and finalized at all. The
finalization dispatch in `11` is what unlocks it.

---

## 3. What must change

### 3.1 Competition creation - the real work

`app/api/gamemaster/competitions/route.ts` is the problem. It requires trading fields and
writes trading defaults with the **raw MongoDB driver**, bypassing Mongoose entirely.

**Required in the POST body today** (lines 156-167): `name`, `entryFee`,
**`startingCapital`**, `maxParticipants`, `startTime`, `endTime`.

**Written on insert** (lines 377-464): `startingCapital`, `leverage` defaulting to 30,
`allowedSymbols`, `assetClasses`, hardcoded forex/crypto/stock symbol lists,
`rules.rankingMethod: "pnl"`, `minimumTrades`, `disqualifyOnLiquidation`, `riskLimits`,
`competitionType`, `maxPositionSize`, `maxOpenPositions`, `allowShortSelling`,
`marginCallThreshold`.

**And no game label at all.** This is `17` risk R7, and here is exactly where it bites: a
Game Master-created competition would be unlabelled, read as trading, and settled by
trading code - paying the wrong players. Section 6 makes this a gate.

Changes:

- Set the **game label explicitly** on the insert object. Not a default, an explicit field
- Make `startingCapital` and every trading field **conditional on the game**
- Accept a game selection and a `gameConfig` validated against the provider's
  `configSchema`
- Reject a game the Game Master's tier does not permit - section 3.2
- Reject a game that is disabled, deprecated, or whose provider is disabled
- Apply the same pre-flight validation as the admin wizard - `03` section 4.1
- **Enforce `minParticipants` of at least 2**, per `03` section 0

The same treatment is needed in the admin-hosted copy at
`apps/admin/app/api/gamemaster/competitions/route.ts`, which follows the same raw-driver
pattern.

> **Consider replacing the raw insert with the same consolidated creation path the admin
> wizard uses.** Two divergent creation paths for the same object is precisely the defect
> class X0 exists to remove from the *entry* path. Leaving it in the *creation* path
> invites the same bug again in a year.

### 3.2 Which games may a Game Master run?

New field, as recommended in `New games plan/05-prizes-money-layer.md` line 103:

```
limits.allowedGameTypes: string[]   // default ["trading"]
```

Default `["trading"]` so no existing Game Master silently gains the ability to create
provider contests. Editable per tier in `MarketplaceItem.gameMasterConfig`, and per Game
Master through the existing admin `update_limits` action.

#### 3.2a What was built - 7 September 2026

**Code-complete.** The field is declared on `gamemaster-subscription.model.ts` - which exists
**only** in the main app, so `check:mirrors` correctly says nothing about it - and on
`marketplace-item.model.ts` in **both** apps, carried onto the cached copy by
`buildSubscriptionLimits`, and enforced on both creation routes. **The admin app reaches
subscriptions with the raw driver** (`db.collection("gamemastersubscriptions")`) rather than
through a model, which is why there is no second copy to keep in step - and it is also why the
schema's own `min`/`max` never ran on the admin edit path, which is half of why `update_limits`
mattered. `59` tests in
`__tests__/services/gamemaster-creation-permissions.test.ts`, `19` probes in
`tools/probe-gamemaster-creation.ps1`.

**One existing guard had to be loosened, and that is worth recording rather than absorbing.**
R7's test in `__tests__/services/game-guards.test.ts` matched `...contestGameLabel()` with **no
argument**, which was stricter than its own purpose - the guard is about the label being stamped,
not about it being trading - so it turned red on correct code the moment these routes started
passing a resolved game type. A guard that fails on correct code is the fastest kind to have
deleted. It now accepts an argument, and the teeth the old pattern provided by accident are
restored deliberately: a second assertion refuses a label derived from **caller input**, since
deriving it from the request body is a way to mislabel a contest against an immutable field. Four
tests added, probed with `body.gameType`, which compiles and reads entirely plausibly.

**The rule lives in one place**, `lib/services/gamemaster/game-permissions.ts`, mirrored
into `apps/admin`. That is the deliverable rather than the field, and the reason is that
the two creation routes disagreed about **every** question it answers. `check:mirrors`
compares models, so it has never had an opinion about this file - a test compares the two
copies byte for byte instead, and it earned its place immediately by catching the mirror
genuinely stale during the build.

Six things about the build that a summary would flatten:

- **Precedence is override → current package → cached limits → default**, and the function
  reports **which** decided in `creationDecidedBy`. That is not diagnostics: "your package
  does not allow competition creation" is wrong and unactionable when an administrator
  denied it by hand, and it sends the Game Master to buy an upgrade that cannot help.
- **An admin override does not widen the games.** It decides `canCreateCompetitions` only.
  Letting `enabled` mean "allowed everything" would carry section 5's economic constraint
  through a switch labelled something else, and an operator enabling creation for one
  person has decided nothing about provider pricing.
- **An empty stored array reads as the default, not as "no games".** An empty array is what
  a bad edit or a half-run migration leaves behind, and taking it literally locks a Game
  Master out of the thing they pay for.
- **Route capability is a separate check from permission**, `checkRouteCanCreateGameType`.
  The routes can build trading only, so granting `provider` today gets a refusal that names
  the missing capability. Without it the route would stamp `gameKey: "provider"` instead of
  `provider:<providerKey>:<gameCode>` - and `gameKey` is immutable, so that is the
  difference between a visible refusal and unrecoverable data. **Widening the allow-list is
  necessary and not sufficient**, and this is what says so.
- **Both routes label the contest from the verdict**, not from the request body. Checking
  permission against a resolved value while labelling from raw input lets the two disagree.
- **The admin route was bypassing package limits entirely** - it read only the cached
  `subscription.limits` and never checked `canCreateCompetitions`, so a Game Master whose
  package withdrew creation could still create through it. Both routes now resolve
  identically.

Optionally, per-game referral rates:

```
limits.referralFeePercentageByGame: Record<string, number>
```

Worth having, because a provider game with a per-round cost cannot support the same
percentage as trading - section 5.

### 3.3 The creation UI

`app/(root)/gamemaster/create-competition/page.tsx` is heavily trading-shaped: it fetches
`/api/settings/trading-risk`, holds `leverageAllowed`, `assetClasses`,
`startingTradingPoints`, trading ranking methods, `minimumTrades`,
`disqualifyOnLiquidation`, and has an "Assets and leverage" step with a leverage slider.

It needs the **same game picker and dynamic settings step as the admin wizard** in `12`
section 2 - and it should reuse those components rather than growing a parallel
implementation. If the admin wizard renders a form from `configSchema`, the Game Master
wizard must render the identical form.

Only games in `limits.allowedGameTypes` appear in the picker.

### 3.4 Tier limits that need a per-game dimension

| Limit | Today | Change |
|---|---|---|
| `maxCompetitionsPerDay` | Global count | Fine as-is, or per game if tiers should differ |
| `maxUsersPerCompetition` | 30 / 75 / 150 | Fine as-is. Note a provider may cap concurrent rounds lower - validate against both |
| `referralFeePercentage` | Global | Per game, per 3.2, if provider cost demands it |
| `canEarnFromChallenges` | Boolean | Unchanged |
| **Maximum entry fee** | **Does not exist** | **Should.** See section 5 - without it, a Game Master can create a low-fee provider contest that costs the platform more than it earns |

### 3.5 Analytics

- Game Master dashboard: earnings and competitions broken down **by game**, so a Game
  Master can see which games their audience actually plays
- Admin `GameMasterManagementSection.tsx` and `GameMasterDetailView.tsx`: same breakdown
- `apps/admin/app/api/financial-dashboard/route.ts` lines 90-131 sums
  `gamemaster_earning` and `gamemaster_challenge_referral` into `totalGameMasterFees`.
  That total must become sliceable by game, and set against **provider cost by game** -
  otherwise there is no way to see a game where Game Master payouts exceed net margin

### 3.6 Wording

Tier descriptions are trading-flavoured and are **database content**, editable without a
deploy - the cheapest item in this chapter:

| Location | Current wording |
|---|---|
| `marketplace-seed.service.ts` line 428 | "build your **trading community**", "daily **trading battles**" |
| Line 483 | "**trading community**", "attract different **traders**" |
| Lines 553-556 | "Morning **scalp battles**", "Evening **swing competitions**" |
| `apps/admin/components/admin/landing-builder/defaults.ts` line 153 | "Earn from every **trade**" |

Treat as a pass in `14`.

---

## 4. Two defects to fix while in here

Neither is caused by this project, and both are cheap now and awkward later.

| Defect | Evidence | Impact |
|---|---|---|
| ~~**The admin app does not settle provider contests at all**~~ **FIXED 7 Sep 2026 (R42)** | `apps/admin`'s `finalizeCompetition` had no provider dispatch - only `routeToTradingSettlement` - so a provider contest reaching the admin cron was refused and left `active`. It now carries the same dispatch the main app has had since X5, placed before `startSession()` because `finalizeProviderCompetition` opens its own session and lock. Pinned by three more tests in the same parity suite, which now seeds a provider-shaped contest | **Strictly worse than R26 below, and the distinction is the useful part**: R26 skipped the Game Master's commission while the contest still settled and the players were still paid. This paid **nobody** and completed nothing - so a Game Master's referred players in a provider contest earned them nothing either, but as a consequence of the contest never settling rather than of a missing referral stage. Latent, **nothing backfilled**. Note the two copies of the shared services were **already mirrored and imported by nothing**, so `check:mirrors` agreed correctly |
| ~~**The admin app does not pay Game Masters**~~ **FIXED 5 Sep 2026 (R26)** | `apps/admin/lib/actions/trading/competition-end.actions.ts` had **no Game Master earnings logic** - only `isGmCreated` on platform-fee recording. It now calls `settleFeesAndGameMasters`, the same shared stage the main app calls, and books the platform fee **net** of the commission. Pinned by `__tests__/services/admin-finalize-gamemaster-parity.test.ts`, which runs *both* apps' finalize functions over identical fixtures and compares every ledger row | A competition finalized through the admin app paid **no Game Master earnings at all** and recorded no `retained_gm_fee` either. Silent revenue loss, and **actively occurring** - both apps run the finalize cron every minute, so payment depended on which cron won the race. **The fix is not retroactive and no backfill was written**; affected contests cannot be found by querying for retained rows, since none exist |
| ~~**`toggleCompetitionCreation` is a dead UI reference**~~ **FIXED 7 Sep 2026** | Two guards in `GameMasterManagementSection.tsx` special-cased the action string; the `PATCH /api/gamemasters/[id]` handler answered it with "Invalid action". `competitionCreationOverride` and `overrideLimits` sat on the schema with a Mongoose virtual reading them that had never run, because both creation routes read the collection with the raw driver. Now implemented via `validateOverrideUpdate`, with the control in `apps/admin/components/admin/gamemaster/CompetitionCreationControl.tsx` | **This row's impact statement was wrong and the correction matters.** It said "an admin clicks a button that does nothing" - **the button did not exist either**, so implementing the handler alone would have left it unreachable, which is the precedent set by a publish route and a play route that were both complete by API and unreachable by clicking. It was kept rather than deleted (the `shouldBlockEntry` precedent cuts the other way here) because it is the **only per-Game-Master control**: everything else is per-tier, so without it the only ways to stop one Game Master creating contests are to change the package for everyone on that tier, or to suspend the subscription and stop the earnings they are contractually owed |
| ~~**`update_limits` was a mass assignment**~~ **FIXED 7 Sep 2026** | The handler did `limits: { ...subscription.limits, ...limits }` - every key the browser sent, written onto the document that decides a Game Master's daily cap, participant cap, revenue share and now which games they may create. And it writes with the **raw driver**, so no Mongoose validation ran and the schema's own bounds never applied on this path. Now an allow-list in `apps/admin/lib/admin/gamemaster-limits-update.ts` | Not found by looking for it: it surfaced while adding `allowedGameTypes` to the same subdocument, which is the general shape - **generalising code is a better bug-finding instrument than looking for bugs.** An unknown field is **refused with the field named, never dropped**, because dropping means the edit appears to save and the operator concludes they misclicked |
| ~~**`POST /api/gamemasters/sync-referrals` was unauthenticated**~~ **FIXED 7 Sep 2026** | Both handlers had **no guard at all**, while all four of their siblings under `/api/gamemasters` required section access. Found by **counting exported handlers against guards**, not by reading the routes - every neighbour having a guard is precisely what makes reading through them go straight past the file that has none | State it in both directions. The POST takes **no body**, so the mapping comes from `userreferrals` and a caller could **not** redirect commission to themselves; what they could do is apply a pending attribution change an operator had deliberately not applied, and run an unbounded `findOne` + `updateOne` loop over every active referral on demand. The GET returned up to ten real user ids and names to anybody who asked. **There is no way to know whether either was ever called** - a route with no guard writes no attribution. Second unauthenticated route in this programme after Prerequisite A, third counting R40 |
| ~~**Neither app paid a Game Master a share of a challenge's entry fees**~~ **FIXED 12 Sep 2026** | Row 50's open question - "whether the same referral divergence exists there has not been checked" - was checked: the admin app's `challenge-finalize.actions.ts` had **no Game Master fee logic of any kind**, not even the divergent inline copy the main app had. Both files' winner-determination, tie-resolution, challenge-document save and prize/fee logic were rewritten onto the new shared `challenge-settlement.service.ts`, which calls `settleFeesAndGameMasters()` with `contestKind: "challenge"` exactly as competitions do | A Game Master whose referred player entered a challenge earned nothing from it on either app, silently - no error, no log line, because nothing was ever computed to fail. **Latent, not live**: no backfill was written, and none is possible, since no `gamemaster_challenge_referral` rows exist to reconcile against and the affected set cannot be queried for |
| ~~**Three sibling bugs in the pre-unification challenge logic, present in BOTH apps**~~ **FIXED 12 Sep 2026** | Found while reading the code being replaced, not by looking for them. **(1)** The `"join_time"` tiebreaker read `participant.enteredAt`, a field `ChallengeParticipant` has never declared (it is `joinedAt`) - so it always compared `Date.now()` against itself and could never resolve a tie. **(2)** Under the `challenger_wins` tie policy, the challenge document was saved with `isTie: true, winnerId: undefined` moments *before* the challenger was paid the full prize - the stored record permanently disagreed with what was actually paid. **(3)** Under `both_lose`, neither participant's `.status` was ever moved to `"completed"`, so a tied "nobody wins" challenge left both rows stuck at their prior status forever, and no unclaimed-pool row was recorded despite a comment claiming one had been | All three were live on every challenge tie, on both apps, for as long as the inline logic existed. Fixed as a side effect of the unification rather than as separate patches, because all three lived inside the code block being replaced wholesale. **No backfill is possible or attempted** - the join-time bug left no wrong money moved (a tie with no other tiebreaker just stayed a tie), the persistence mismatch is a stored-document defect with no ledger consequence, and the `both_lose` status gap is not money either, so there is nothing to reconcile |

Also worth noting: the renewal worker extends `endDate` by **30 days hardcoded**
(`gamemaster-renewal.job.ts` line 266) regardless of the tier's
`subscriptionDurationDays`, and `gamemaster_subscription_refund` exists in the ledger enum
with no writer anywhere. Neither blocks this project; both belong on a defect list.

---

## 5. The problem trading never had

**A Game Master's share is calculated as a percentage of the entry fee, before any
provider cost is deducted. A trading contest has no per-round cost. A provider contest
does.**

Worked example, using the Elite tier at 10%:

| | Trading contest | Provider contest at 2c/round |
|---|---|---|
| Entry fee | 1.00 | 1.00 |
| Players, all referred by one Game Master | 20 | 20 |
| Prize pool | 20.00 | 20.00 |
| Platform fee at 10% | 2.00 | 2.00 |
| Game Master share, 10% of entry fees | 2.00 | 2.00 |
| Provider cost | 0.00 | 0.40 |
| **Platform result** | **0.00 - break even** | **-0.40 - a loss** |

The existing cap does not save us. It caps the Game Master share at the **gross** platform
fee, and gross fee minus Game Master share minus provider cost is negative. The platform
pays to run the contest, and pays the Game Master for the privilege.

It gets worse with `best_of_n` attempts, where provider cost multiplies while the entry
fee does not.

### Options

| Option | Effect | Verdict |
|---|---|---|
| **Exclude provider games from Game Master creation at launch** | `limits.allowedGameTypes` stays `["trading"]` | **The safe default.** Costs nothing and blocks nothing permanently |
| Deduct provider cost before calculating the share | Correct, and changes the cap from gross to net platform fee | The right long-term answer. Needs provider cost known at settlement time |
| Set a **minimum entry fee** for Game Master provider contests | Simple, understandable, enforceable | Good companion to the above |
| A lower per-game referral percentage | Uses `referralFeePercentageByGame` | Fine, but a percentage cannot fix a fixed per-round cost at low fees |

**Recommendation:** launch with `allowedGameTypes` at `["trading"]`, enable provider games
for Game Masters only once provider pricing is settled and the share is calculated on
**net** platform fee after provider cost. Record the decision in `PROGRESS.md`.

Note this also means a Game Master **still earns from provider contests their referred
players enter** - because earning follows referred players, not created contests. Only
*creation* is gated. That is the right split: the revenue share works from day one, and
only the ability to create a potentially loss-making contest is held back.

---

## 6. Sequencing and effort

| Item | Phase | Effort |
|---|---|---|
| **Set the game label on both Game Master competition inserts** | **X1** | **0.5 day - and it is a gate, not a task** |
| ~~`limits.allowedGameTypes`, default `["trading"]`~~ **BUILT 7 Sep 2026** | X1 | 0.5 day |
| ~~Admin-app finalization Game Master earnings gap (section 4)~~ **BUILT 5 Sep 2026 (R26)** | X1 or X5 | 1-2 days |
| ~~Challenge finalization on the shared payout/fee code, both apps (section 4)~~ **BUILT 12 Sep 2026** | X10 | ~1 day |
| Provider-cost treatment decided and implemented | Before enabling provider games for Game Masters | 1-2 days |
| Minimum entry fee for Game Master provider contests | Same | 0.5 day |
| **Game Master creation API accepts a game and `gameConfig`** | X6 | 2 days - **partly built 7 Sep 2026, see below** |
| Game Master creation UI: game picker plus dynamic settings | X6 | 3 days - **not built, and blocked** |
| Per-game analytics, Game Master and admin | X7 | 2 days |
| ~~Implement or remove `toggleCompetitionCreation`~~ **BUILT 7 Sep 2026** | X6 | 0.5 day |
| Tier wording | X8 | Database content, non-developer |
| **Total** | | **~2.5 weeks** |

That is an order of magnitude more than the "roughly four days of residuals" the earlier
draft claimed, and it is why this chapter exists.

**What "accepts a game" means as built, stated precisely so a summary cannot round it up.**
Both routes now take a `gameType`, resolve what the Game Master is permitted, check it, and
**refuse anything but trading with a message naming the missing capability**. So the
permission half is complete and the *construction* half is not: a provider contest needs a
catalogue title, settings validated against that title's `configSchema`, round settings and
the pre-flight checklist, which is sections 3.1 and 3.3 of this chapter and is not built.
**A Game Master still cannot create a provider contest**, and the reason is now a refusal
rather than a silent trading label.

**The creation UI is deliberately not built, and it is blocked rather than deferred.** A
game picker offering one game is friction on the path Game Masters use daily - the same
reasoning that makes the admin picker redirect straight to trading when no provider game
exists - and section 5's economic constraint means `allowedGameTypes` should stay
`["trading"]` until the revenue share is computed on **net** platform fee. Building the
picker first would produce a control whose only option is the one already there. It unblocks
when section 5 is answered, not when somebody has three days.

---

## 7. Acceptance criteria

- [x] Every Game Master competition insert sets the game label **explicitly** - verified
      by reading a created document, not by trusting a default. **Done in X1**, and since
      7 Sep 2026 the label comes from the permission **verdict** rather than the request
      body, so the game checked and the game stamped cannot differ
- [x] A Game Master cannot create a contest for a game outside `limits.allowedGameTypes` -
      **done 7 Sep 2026**, both routes, `59` tests and `18` probes. Note the field is
      enforced on the API; there is no UI to widen it beyond the `update_limits` action
- [x] A Game Master cannot create a competition with `minParticipants` below 2 - **done
      7 Sep 2026** via `clampMinParticipants`. The main route previously parsed the
      caller's value with a floor of **1**, so a paid single-player contest was reachable;
      the admin route hardcoded 2 and was correct. Both now share the one constant, and
      `validateOverrideUpdate` applies the same floor to a per-Game-Master participant cap
- [ ] A Game Master creating a provider contest sees the **same** settings form as an
      admin, generated from `configSchema`
- [ ] No trading field is required to create a provider contest
- [ ] A Game Master earns correctly when a referred player enters a **provider**
      competition, and when they enter a **provider challenge**. **The mechanism is now
      shared and correct for a trading challenge** - since 12 Sep 2026,
      `settleFeesAndGameMasters()` runs for every challenge exactly as it does for every
      competition - but no provider challenge can be created yet (section 5's economic
      constraint plus the unbuilt provider-challenge creation path), so this box stays
      open until one can be
- [ ] The Game Master share still **never exceeds the platform fee**, asserted by test
- [ ] **Platform margin after provider cost is never negative** on a Game Master-created
      contest, asserted by test
- [x] A competition finalized through the **admin app** pays Game Master earnings
      identically to the main app - **done 5 Sep 2026 (R26)**, proven by a parity suite that
      settles the same fixture through both apps and compares every ledger row, including
      that the platform fee is booked **net** of the commission. **Historical contests
      finalized by the admin cron were not backfilled**
- [ ] Earnings and referrals are reportable by game, for both the Game Master and the
      admin
- [ ] Nothing about trading Game Masters changes - proven by the same historical
      regression approach as `11` section 4
