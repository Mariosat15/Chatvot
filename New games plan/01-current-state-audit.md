# 01 - Current State Audit: Where Trading Is Welded In

Evidence map produced by reading the codebase. Every claim below has a file path. This is the baseline the rest of the plan is designed against.

---

## 1. The good news first: what is already game-agnostic

These layers need **no structural change** to support Trivia. They are the reason this project is feasible.

| Layer | Files | Why it is reusable |
|---|---|---|
| **Contest shell** | `database/models/trading/competition.model.ts` | name, slug, description, `entryFee`, `minParticipants`, `maxParticipants`, `startTime`, `endTime`, `registrationDeadline`, `status`, `prizePool`, `platformFeePercentage`, `prizeDistribution[]`, `isPaused`, pause history, tags, image, `createdBy`, `gameMasterId` are all game-neutral |
| **Status state machine** | same | `draft -> upcoming -> active -> finalizing -> completed`, plus `cancelled` / `emergency_ended`, works for any game |
| **Credit wallet** | `database/models/trading/credit-wallet.model.ts` | Atomic `$inc` on `creditBalance` is game-neutral |
| **Ledger** | `database/models/trading/wallet-transaction.model.ts` | Full audit trail with `balanceBefore` / `balanceAfter` |
| **Prize distribution maths** | `lib/services/competition-ranking.service.ts` -> `distributePrizesWithTies()` | Purely rank-based: takes ranks + percentages, handles ties and unclaimed ranks. Knows nothing about trading. |
| **Platform ledger** | `database/models/platform-financials.model.ts`, `lib/services/platform-financials.service.ts` | `platform_fee`, `unclaimed_pool`, fee/refund categories are activity-neutral |
| **Refund loop** | `lib/actions/trading/competition-cancel.actions.ts` | Full entry-fee reversal per participant |
| **Entry gates (most)** | `lib/services/fraud/entry-fraud-gate.service.ts`, `lib/services/user-restriction.service.ts` | Auth, email verification, restrictions, IP risk, device fingerprint, suspicion score contain no trading assumptions |
| **Game Master revenue** | `database/models/gamemaster/gamemaster-subscription.model.ts` | Referral share is a percentage of **entry fees** - works for any paid contest |
| **Badge/XP infrastructure** | `database/models/badge-config.model.ts`, `user-badge.model.ts`, `user-level.model.ts`, `lib/services/xp-level.service.ts` | The award pipeline, rarity tiers and XP ledger are generic; only the *conditions* and *titles* are trading-flavoured |
| **Wallet, messaging, KYC, notifications infra** | various | Already game-neutral |

**Implication:** the contest engine and the money engine are sound. We are adding a dimension to them, not replacing them.

---

## 2. The four hard seams (where the work actually is)

These are the only four places where the shared engine reaches directly into trading. Cutting these four seams is the core of the project.

### Seam 1 - Ranking

`lib/services/competition-ranking.service.ts:64`

```
function getRankingValue(participant, method) {
  switch (method) {
    case "pnl":            return participant.pnl;
    case "roi":            return participant.pnlPercentage;
    case "total_capital":  return participant.currentCapital;
    case "win_rate":       return participant.winRate;
    case "total_wins":     return participant.winningTrades;
    case "profit_factor":  // winningTrades / losingTrades
  }
}
```

Every ranking method reads a trading field. A second near-duplicate switch exists in the same file (around line 99) for tie-breakers, and the whole winner-selection logic is **duplicated inline** for challenges in `lib/actions/trading/challenge-finalize.actions.ts` (approx. lines 491-628).

**Why this is the best seam:** it is one small pure function. Redirect it to a per-game score resolver and every leaderboard, live ranking and finalization inherits multi-game support at once.

### Seam 2 - Participant performance record

`database/models/trading/competition-participant.model.ts`

Stores `startingCapital`, `currentCapital`, `availableCapital`, `usedMargin`, `pnl`, `pnlPercentage`, `realizedPnl`, `unrealizedPnl`, `totalTrades`, `winningTrades`, `losingTrades`, `winRate`, `averageWin`, `averageLoss`, `largestWin`, `largestLoss`, `currentOpenPositions`, `maxDrawdown`, `maxDrawdownPercentage`. There is **no generic `score`**.

Mirrored in `challenge-participant.model.ts` with `role` and `isWinner` added.

### Seam 3 - Settlement / finalization

`lib/actions/trading/competition-end.actions.ts` (approx. 1,500 lines) does, in order:
1. optimistic lock `active -> finalizing`
2. **close every open `TradingPosition` at live forex prices** (imports `fetchRealForexPrices`, `calculateUnrealizedPnL`, `getQuoteToUsdRate`)
3. reconcile PnL from `TradeHistory`
4. update participant stats
5. rank + distribute prizes
6. credit winners, record platform fee, handle unclaimed pool
7. set `completed` + write `finalLeaderboard`

Steps 1 and 5-7 are generic. Steps 2-4 are pure trading. `challenge-finalize.actions.ts` repeats the same pattern.

**If this runs against a Trivia contest unchanged**, it finds no positions, computes zero PnL, ranks everyone equal and pays prizes by tie-break - i.e. it silently pays the wrong people. This is risk R3 in the register.

### Seam 4 - In-progress gameplay writes

Trading updates participant state through `lib/actions/trading/order.actions.ts` (`placeOrder`, 16-step guard chain), `position.actions.ts`, `liquidation.actions.ts`, `margin-monitor.actions.ts`, all keyed on `TradingPosition.competitionId`.

Note: `TradingPosition.competitionId` holds **either** a competition ID **or** a challenge ID. Any new game must not reuse this field.

---

## 3. Contest resolution helper

`lib/actions/trading/contest-utils.ts` -> `getContestAndParticipant(contestId, userId)` is the shared "which contest am I in" helper. It tries `Competition`, then `Challenge`, and returns a normalised object that exposes **trading-only** fields (`leverage`, `maxPositionSize`, `marginCallThreshold`, `assetClasses`).

This is the natural place to also return `gameType` and `gameConfig`, making it the fifth (easy) seam.

---

## 4. Always-on infrastructure

| Component | File | How it starts | Runs when trading is off? |
|---|---|---|---|
| Massive.com WebSocket price feed, candle aggregation, spread application, PriceCache writes, Redis relay, price snapshots | `lib/services/websocket-price-streamer.ts` | **Module side-effect**: `autoInitialize()` is called at the bottom of the file (~line 2869). Any import of the module starts it. | **Yes - unconditionally** on the primary Next.js server |
| Cache warm that triggers the above | `instrumentation.ts` -> `candle-aggregator.service.ts` at +5s | Next.js instrumentation hook | Yes |
| Client price polling | `contexts/PriceProvider.tsx` | Mounted **only** in the two `/trade` pages | No - correctly scoped |
| Websocket server (messaging + price relay) | `websocket-server/index.ts` (port 3003) | Separate process | Yes, but messaging is its main job |
| API server | `api-server/index.ts` (port 4000) | Separate process | Yes - no trading dependency |

`autoInitialize()` already skips worker and admin processes (`isWorkerProcess()`, `isAdminProcess()`) and secondary servers use Redis relay only. So there is a **precedent for conditional startup** - we add one more condition.

**Key insight:** startup is implicit via import side-effect. This is why the plan says gate it, never delete it - removing the import chain would break candles, charts, snapshots and health monitoring in non-obvious ways.

---

## 5. Background jobs

Active scheduler is the **Agenda worker** (`worker/index.ts`). The Inngest cron definitions in `lib/inngest/functions.ts` still exist but are **not registered** - `app/api/inngest/route.ts` only serves email/invoice functions, with an explicit comment that cron jobs moved to Agenda to stop doubling DB load.

| Job | File | Every | Behaviour with no active trading contests |
|---|---|---|---|
| `margin-check` | `worker/jobs/margin-check.job.ts` | 1 min | No-op (exits if no active contests) |
| `competition-end` | `worker/jobs/competition-end.job.ts` | 1 min | No-op |
| `challenge-finalize` | `worker/jobs/challenge-finalize.job.ts` | 1 min | No-op |
| `early-end-check` | `worker/jobs/early-end-check.job.ts` | 1 min | No-op |
| `trade-queue` | `worker/jobs/trade-queue.job.ts` | 1 min | No-op |
| `evaluate-badges` | `worker/jobs/evaluate-badges.job.ts` | 1 hour | Harmless |
| `market-data-maintenance` | `worker/jobs/market-data-maintenance.job.ts` | 5 min | Runs regardless (candle cleanup) |
| KYC, GM renewal, Atlas refunds, withdrawals | various | hourly/daily | Non-trading |

**This is very good news.** The jobs already guard themselves. Turning trading off does not require disabling them - though `competition-end` and `early-end-check` *do* need `gameType` awareness because they will legitimately pick up Trivia contests (see Seam 3).

---

## 6. Two divergent competition join paths - FIXED 1 September 2026

> **Resolved.** Both gates now call `lib/services/contest-entry.service.ts`, which performs
> the union of their guards. The table below is the record of what was found; the last
> column is what the single implementation now does. Kept rather than deleted because the
> next person to add an entry path needs to see how far two copies drifted.

| Behaviour | `enterCompetition` (server action) | `POST /api/competitions/[id]/join` | Unified |
|---|---|---|---|
| Email verification | Yes | **No** | Yes |
| User restrictions | Yes | **No** | Yes |
| Fraud gate | Yes | **No** | Yes |
| Level requirement | Yes | **No** | Yes |
| Market hours check | No | Yes | **No** - owner decision; only trading is gated |
| **Increments `prizePool`** | **Yes** | **No** | **Yes**, always |
| WriteConflict retry | No | Yes | Yes - concurrent joins went from 1 in 20 to 20 in 20 |
| Duplicate entry | Throws | Success | Success - owner decision |
| Wallet tx field used | `referenceId` | `competitionId` | `competitionId` |
| Coordination detection | Yes | **No** | Yes - it is a fraud control and was avoidable by using the other entrance |

`enterCompetition` lives in `lib/actions/trading/competition.actions.ts`; the route is `app/api/competitions/[id]/join/route.ts`. Both are now thin wrappers - 379 lines became 76, and 361 became 141.

**The `prizePool` divergence was a live bug**, not just a refactor smell: contests joined via the API route accumulated no prize pool, so at finalization the pool was smaller than the entry fees collected.

Two corrections from the 1 September 2026 re-verification, both still worth knowing. First, the safeguard at finalize (`competition-end.actions.ts` lines 695-718) **did not mask this** - it only fires when the stored pool is *higher* than `currentParticipants x entryFee`, so an under-counted pool passed straight through and was under-distributed with no correction and no log line. Second, the API route was reached **only by the simulator**; both real join buttons called `enterCompetition`. So no paying customer was affected, which is why it survived unnoticed - and why the fix needed no migration.

**Consequence for this project:** we are about to add a second, third and fourth way to join a contest. Consolidating to one entry service **before** adding game types was mandatory, not optional, and it is now done. This was **Stage 0**, delivered separately from the games plan and signed off by the owner first - see `00a-STAGE-0-prerequisite-fixes-DO-FIRST.md`.

Related dormant item: `challenge_refund` exists in the `transactionType` enum with **no writer anywhere** in the code.

---

## 7. Ranking, points and stats today

| Concern | Where | Trading coupling |
|---|---|---|
| Per-contest rank | `competition-ranking.service.ts` + `app/api/competitions/[id]/live-ranking/route.ts` | Live rank uses `liveEquity = currentCapital + unrealizedPnl` |
| Global leaderboard | `lib/actions/leaderboard/global-leaderboard.actions.ts` | `overallScore` = `totalPnl*0.3 + totalPnlPercentage*5 + winRate*2 + profitFactor*10 + competitionsWon*50 + podiumFinishes*20 + challengesWon*25 + totalBadges*2 + legendaryBadges*10`. Five of nine terms are trading metrics. Rebuilt on read, ~7s, cached 5 min in-process, capped at 5,000 users. No Redis, no materialised collection. |
| User stats | `lib/services/user-stats.service.ts`, `unified-user-stats.service.ts`, `lib/actions/comprehensive-dashboard.actions.ts` (~1,700 lines) | Source of truth is `TradeHistory` aggregation. There is **no `UserStats` collection** - it is computed per request. |
| XP awards | `lib/services/xp-level.service.ts` -> `awardActivityXP()` | Events are: trade completed, winning trade, competition completed, podium, challenge completed/won. Daily cap 100 XP on trade activity. |
| Levels/titles | `lib/constants/levels.ts` + `XPConfig` DB override | All 20 titles are trader-themed: "Novice Trader" -> "Trading God" |
| Badges | `data/defaults/badges.json` (~100) + `BadgeConfig` DB + `lib/constants/badges.ts` fallback | Categories: Competition, Trading, Profit, Risk, Speed, Consistency, Strategy, Social, Legendary. Conditions include `total_trades`, `win_streak`, `no_liquidations`, `average_roi`, `drawdown_recovery`. |
| Achievement engine | `lib/services/badge-evaluation.service.ts` | `gatherUserStats()` builds a ~50-field stats object from positions/trades/wallet; `checkBadgeCondition()` is a switch with 40+ condition types, nearly all trading |
| Journey / milestones | `JourneyMapConfig`, `JourneyMilestone`, `UserJourneyProgress` models; conditions in `lib/constants/milestone-condition-types.ts` | DB-driven and admin-editable (good), but condition vocabulary is trading (`total_trades`, `open_positions`, `forex_trades`, `max_drawdown`) |
| ELO / skill rating | **Does not exist** | Closest are the weighted `overallScore` and a matchmaking heuristic in `lib/services/matchmaking.service.ts` |

---

## 8. Admin surface

Single-page app: `apps/admin/components/admin/AdminDashboard.tsx` drives everything from a `menuGroups` config (approx. lines 160-726) plus a `renderContent()` switch (approx. 971-1153). Roughly **60 sections**.

Relevant facts:
- There is a nav group literally named **"Trading"** containing Competitions, 1v1 Challenges, Trading History, Analytics, Market Hours, Trading Symbols, Market Data.
- Competition creation is a **7-step wizard** (`CompetitionCreatorForm.tsx`): Basic Info, Financial, Schedule, **Trading** (asset classes, leverage, risk limits), Prizes, Rules (ranking method, tie-breakers, min trades), Launch.
- The **edit** form exposes fewer fields than create (no risk limits, no rules, no ranking method).
- `allowedSymbols` / `blockedSymbols` and `competitionType` / `goalConfig` exist on the model but are **not exposed in admin UI**, and `goalConfig` has **no server logic at all** - `competitionType` is hard-coded to `time_based` on create. Dead schema.
- RBAC: `ADMIN_SECTIONS` in `apps/admin/database/models/admin-employee.model.ts` is the permission registry. Several live menu IDs are **missing** from it (`journey-map`, `gamification-wizard`, `system-announcements`, `vendors`, `mdb-cluster`, `server-fleet`, `data-cleanup`, `data-maintenance`), so employees cannot be granted them. Any new game sections must be added here.
- Analytics that are trading-derived: `CompetitionAnalytics.tsx` (winner PnL, total trades, disqualified), `TradingHistorySection.tsx` (trade-level), `PriceHealthWidget.tsx`, parts of `FinancialDashboard.tsx`.
- Feature flags live on the `WhiteLabel` model, surfaced through `EnvironmentSection.tsx`. `arenaEnabled` is the only true feature toggle there.

---

## 9. User-facing surface

- **37 routes** across layout groups `(root)`, `(auth)`, `arena`, `landing`, plus public CMS `[slug]`.
- The two trading-gameplay routes are `app/(root)/competitions/[id]/trade/page.tsx` and `app/(root)/challenges/[id]/trade/page.tsx`. These mount all six trading providers (`PriceProvider`, `SymbolConfigProvider`, `ChartSymbolProvider`, `TradingArsenalProvider`, `PositionEventsProvider`, `TradingModeProvider`). **Providers are correctly scoped** - they do not mount globally.
- `components/trading/` has **63 files**. Roughly 40 are chart/order/position/market-watch specific (Trivia would not use them); roughly 20 are contest shell (cards, leaderboard, countdown, entry button, status monitors) and are reusable.
- Navigation: `components/UserSidebar.tsx` (section header literally "Trading", default user name fallback "Trader") and `MobileBottomNav.tsx` (7 tabs).
- `/arena` is a spectator broadcast view, gated by `arenaEnabled` + `redirectIfRestricted("trade")`.
- Help centre: `app/(root)/help/page-content.tsx` is around **10,700 lines of hard-coded JSX**, plus a dedicated `/help/competitions` trading guide. This is the single largest wording surface.
- Landing page is DB-composed from `HeroSettings` with a section registry - good, because copy is already data.

---

## 10. Wording inventory

**No i18n layer exists.** Confirmed: no `next-intl`, `react-i18next`, `useTranslation`.

Approximate matches for `trad(e|er|ing)|forex|pip|margin|position|order`:

| Location | Approx. matches | Kind |
|---|---|---|
| `components/trading/` | 2,500+ | JSX labels |
| `lib/` services/actions/constants | 1,800+ | mixed, incl. log strings |
| `app/` pages | 1,200+ | JSX + help content |
| `components/dashboard/` | 600 | JSX labels |
| `components/profile/` | 400 | JSX labels |
| `components/arena/` | 350 | JSX labels |
| `lib/constants/journey-maps-sequence.ts` | 360 | **deprecated constant** |
| `components/leaderboard/` | 230 | JSX labels |
| `lib/constants/landing-page-templates-*.ts` | 230 | template copy |
| `lib/constants/badges.ts` | 103 | badge catalog |
| `lib/constants/default-pages.ts` | 101 | legal copy |
| `lib/constants/milestone-condition-types.ts` | 87 | condition vocabulary |
| `lib/nodemailer/templates.ts` | 125 | email copy |
| `lib/constants/levels.ts` | 20 titles | all "Trader" themed |

Important nuance: a large share of these matches are **not user-visible** - they are variable names, log messages, enum values, API paths (`/api/trading/...`), collection names and CSS classes. The genuinely user-visible shared-shell strings are far fewer, on the order of **150-250**. That distinction is what makes the terminology plan in `09` tractable.

---

## 11. Admin mirror pairs (must stay in sync)

Approximately 21 core files are duplicated between the main app and `apps/admin`. Confirmed pairs relevant to this project:

Models: `competition.model.ts`, `competition-participant.model.ts`, `challenge.model.ts`, `challenge-participant.model.ts`, `challenge-settings.model.ts`, `competition-rules.model.ts`, `trading-position.model.ts`, `trading-order.model.ts`, `trade-history.model.ts`, `whitelabel.model.ts`, `user-level.model.ts`, `badge-config.model.ts`, `user-badge.model.ts`, `xp-config.model.ts`, `user-restriction.model.ts`.

Actions/services: `competition.actions.ts`, `competition-end.actions.ts`, `competition-cancel.actions.ts`, `challenge-finalize.actions.ts`, `contest-utils.ts`, `order.actions.ts`, `position.actions.ts`, `margin-monitor.actions.ts`, `liquidation.actions.ts`, `competition-ranking.service.ts`, `global-leaderboard.actions.ts`, `user-stats.service.ts`, `badge-evaluation.service.ts`, `xp-level.service.ts`, `matchmaking.service.ts`, `journey-progress.service.ts`, `settings.service.ts`, `ip-detection.service.ts`, `notification.service.ts`, `inngest/functions.ts`.

Also note `database/models/whitelabel.model.d.ts` exists as a hand-maintained declaration file - a third place to update for whitelabel fields.

**This duplication is the single most common cause of "works locally, breaks in production" in this codebase.** Every task in `03-data-model-changes.md` therefore lists both paths explicitly.
