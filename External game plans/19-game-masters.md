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
| **Where it happens** | **Since the X5 extraction, 4 Sep 2026: `lib/services/settlement/game-master-fees/` (`calculate.ts` + `distribute.ts`), mirrored into `apps/admin`.** It was inline at `competition-end.actions.ts` lines 931-1459. **Since 5 Sep 2026 (R26) the admin app's `finalizeCompetition` calls it too**, via `settleFeesAndGameMasters` - before that it called nothing and paid nobody. Challenges are **unchanged and still inline** in both apps: `challenge-finalize.actions.ts` lines 798-1380, and **whether the same referral divergence exists there has not been checked** |
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
| ~~**The admin app does not pay Game Masters**~~ **FIXED 5 Sep 2026 (R26)** | `apps/admin/lib/actions/trading/competition-end.actions.ts` had **no Game Master earnings logic** - only `isGmCreated` on platform-fee recording. It now calls `settleFeesAndGameMasters`, the same shared stage the main app calls, and books the platform fee **net** of the commission. Pinned by `__tests__/services/admin-finalize-gamemaster-parity.test.ts`, which runs *both* apps' finalize functions over identical fixtures and compares every ledger row | A competition finalized through the admin app paid **no Game Master earnings at all** and recorded no `retained_gm_fee` either. Silent revenue loss, and **actively occurring** - both apps run the finalize cron every minute, so payment depended on which cron won the race. **The fix is not retroactive and no backfill was written**; affected contests cannot be found by querying for retained rows, since none exist |
| **`toggleCompetitionCreation` is a dead UI reference** | Called in `GameMasterManagementSection.tsx` lines 164-189; **not implemented** in the `PATCH /api/gamemasters/[id]` handler. `competitionCreationOverride` and `overrideLimits` exist on the schema with no reader or writer | An admin clicks a button that does nothing. Worse once provider games exist and disabling a Game Master's creation rights actually matters |

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
| `limits.allowedGameTypes`, default `["trading"]` | X1 | 0.5 day |
| Admin-app finalization Game Master earnings gap (section 4) | X1 or X5 | 1-2 days |
| Provider-cost treatment decided and implemented | Before enabling provider games for Game Masters | 1-2 days |
| Minimum entry fee for Game Master provider contests | Same | 0.5 day |
| Game Master creation API accepts a game and `gameConfig` | X6 | 2 days |
| Game Master creation UI: game picker plus dynamic settings | X6 | 3 days |
| Per-game analytics, Game Master and admin | X7 | 2 days |
| Implement or remove `toggleCompetitionCreation` | X6 | 0.5 day |
| Tier wording | X8 | Database content, non-developer |
| **Total** | | **~2.5 weeks** |

That is an order of magnitude more than the "roughly four days of residuals" the earlier
draft claimed, and it is why this chapter exists.

---

## 7. Acceptance criteria

- [ ] Every Game Master competition insert sets the game label **explicitly** - verified
      by reading a created document, not by trusting a default
- [ ] A Game Master cannot create a contest for a game outside `limits.allowedGameTypes`
- [ ] A Game Master cannot create a competition with `minParticipants` below 2
- [ ] A Game Master creating a provider contest sees the **same** settings form as an
      admin, generated from `configSchema`
- [ ] No trading field is required to create a provider contest
- [ ] A Game Master earns correctly when a referred player enters a **provider**
      competition, and when they enter a **provider challenge**
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
