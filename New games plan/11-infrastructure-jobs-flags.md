# 11 - Infrastructure, Jobs and Feature Flags

How to make trading switchable and how to keep the background jobs from doing damage once contests are not all trading contests.

---

## 1. The `tradingEnabled` master flag

### Pattern to copy

`arenaEnabled` already implements exactly this, touching 8 files. Follow it precisely rather than inventing a new mechanism:

```ts
// app/arena/layout.tsx - the existing template
const settings = await WhiteLabel.findOne().select("arenaEnabled").lean();
if (settings && settings.arenaEnabled === false) {
  redirect("/dashboard");
}
```

Note the `=== false` comparison: it treats missing/undefined as enabled, which is the correct default for a flag added to existing documents. Reproduce that behaviour for `tradingEnabled`.

### Enforcement points (all of them)

| Layer | Where | Behaviour when off |
|---|---|---|
| **Route guard** | `app/(root)/competitions/[id]/trade/page.tsx`, `challenges/[id]/trade/page.tsx`, new `/play` trading branch | Redirect to the lobby with an explanatory message |
| **Arena** | `app/arena/layout.tsx` | Add `tradingEnabled` to the existing check |
| **Navigation** | `components/UserSidebar.tsx`, `MobileBottomNav.tsx` | Hide Marketplace (Trading Arsenal), Live Arena |
| **Dashboard** | trading section | Hidden entirely (not empty) |
| **Order placement** | `lib/actions/trading/order.actions.ts` `placeOrder` | New guard at the **top** of the chain, returning `{ success: false, error }` |
| **Contest creation** | admin create + GM create routes | `"trading"` filtered out of the game picker; server rejects |
| **Contest entry** | consolidated entry service | Reject entry to trading contests |
| **Price feed** | `websocket-price-streamer.ts` `autoInitialize()` | Skip initialisation |
| **Trading API routes** | `app/api/trading/*` | Return a clear disabled response |
| **Help settings** | `/api/help-settings` | Must not fail when `TradingRiskSettings` is unused |

### The order-placement guard must be first

`placeOrder` has a 16-step guard chain (auth, market open, DB, restriction, contest, participant, risk limits, quantity, symbol, price, limit validation, leverage, SL/TP, margin). The `tradingEnabled` check belongs **before** all of it, so that no price fetch or DB work happens when trading is off.

### Active contests must be allowed to finish

Turning trading off while trading competitions are running must **not** strand them. The flag prevents *new* trading contests and *new* orders; the finalization path continues to run so participants get their prizes and refunds.

This means the finalizer, the position-closing settle step and the price feed **cannot be hard-gated by the flag alone**. Rule:

```
price feed starts if: tradingEnabled === true
                      OR there exists at least one active/finalizing trading contest
```

Implement as an async check inside `autoInitialize()`. Without this, disabling trading mid-contest would leave open positions unpriced and unclosable - which is a money-losing bug, not a cosmetic one.

A simpler and safer operational alternative: the admin UI refuses to disable trading while trading contests are active, offering "disable after current contests complete" (a pending state). Recommended - it turns a subtle runtime condition into an explicit product behaviour.

---

## 2. Gating the price infrastructure

### Current startup

`lib/services/websocket-price-streamer.ts` calls `autoInitialize()` as a **module side-effect** at the bottom of the file (~line 2869). Any import starts the whole pipeline: Massive.com WebSocket, candle aggregation, spread application, `PriceCache` writes, TP/SL checks on every tick, price snapshots every minute, Redis relay, and HTTP broadcast to the websocket server.

It is reached via `instrumentation.ts` -> `candle-aggregator.service.ts` (warm cache at +5s), and via `real-forex-prices.service.ts` and the trading API routes.

Existing skip conditions - the precedent we extend:

```ts
if (isWorkerProcess()) return;
if (isAdminProcess()) return;
// secondary servers (IS_PRIMARY=false) use the Redis relay only
```

### Change

Add one condition:

```ts
if (!(await isTradingInfrastructureNeeded())) {
  console.log("Price streamer idle - trading disabled and no active trading contests");
  return;
}
```

`isTradingInfrastructureNeeded()` returns `tradingEnabled || activeTradingContestCount > 0`, with a short cache to avoid a DB hit on every import.

### Why gate rather than remove

Removing the import chain would break candle history, chart data, price snapshots (used by emergency finalization), the price health monitor and the admin Price Feed Health screen - in ways that only appear at runtime. The streamer is ~2,900 lines with in-memory caches, reconnect logic and multiple consumers. Gating is a one-condition change; removal is a project with a long tail of surprises.

The `PriceProvider` client context is already correctly scoped to the two `/trade` pages, so no client work is needed beyond the route guards.

---

## 3. Background jobs

### Current state (good news)

The active scheduler is the **Agenda worker** (`worker/index.ts`). The Inngest cron definitions in `lib/inngest/functions.ts` still exist but are **not registered** - `app/api/inngest/route.ts` serves only email/invoice functions, with a comment explaining that crons moved to Agenda to stop doubling MongoDB load.

**Trap:** the unregistered Inngest crons are a loaded gun. If anyone re-adds them to the route array, competition finalization runs twice concurrently from two schedulers. Recommendation: delete the dead cron definitions, or add a prominent comment and a test asserting the route's function list. This is cheap insurance against a catastrophic double-payout.

Every trading job already **self-guards and no-ops** when there are no active contests. So switching trading off needs no job changes for safety - only for efficiency.

### Required changes per job

| Job | File | Change needed |
|---|---|---|
| `competition-end` | `worker/jobs/competition-end.job.ts` | **Must become game-aware.** It calls `finalizeCompetition`, which currently closes forex positions. Once it picks up Trivia contests it must dispatch via `module.settleContest()`. **This is the highest-risk job.** |
| `challenge-finalize` | `worker/jobs/challenge-finalize.job.ts` | Same. |
| `early-end-check` | `worker/jobs/early-end-check.job.ts` | Logic is liquidation/equity based. Filter to games where `supportsElimination`, and optionally call the module's `checkEarlyEnd()`. |
| `margin-check` | `worker/jobs/margin-check.job.ts` | Filter its contest query to `gameType: "trading"`. Currently it would query Trivia contests, find no positions and waste cycles - harmless but wrong. |
| `trade-queue` | `worker/jobs/trade-queue.job.ts` | Filter to trading. Add `tradingEnabled` short-circuit. |
| `evaluate-badges` | `worker/jobs/evaluate-badges.job.ts` | Extend to include participants of all game types, otherwise Trivia players never get badges evaluated by the hourly sweep. |
| `market-data-maintenance` | `worker/jobs/market-data-maintenance.job.ts` | Skip when trading disabled and no active trading contests (candle cleanup is pointless then). |
| KYC, GM renewal, Atlas refunds, withdrawals | various | No change - already game-neutral. |

### The critical one

`finalizeCompetition` must dispatch on `gameType` **before** the position-closing block. If a Trivia contest reaches the current code path, it finds no positions, computes zero PnL for everyone, ranks them all equal, and pays prizes by tie-break - i.e. it silently pays the wrong players real money. There is no error, no alert, no log line indicating a problem.

Mitigation beyond the dispatch itself: add an assertion in the trading settle path that the contest's `gameType` is `"trading"`, and log an error + skip if not. Defence in depth on the one path where a silent failure costs money.

Also game-aware: `POST /api/finalize-old-competitions` (admin force-finalize) and the emergency-cancel route, both of which close positions.

---

## 4. Websocket server and other processes

| Process | Trading dependency | Change |
|---|---|---|
| `websocket-server/index.ts` (3003) | Price relay endpoint only; main job is messaging/presence | None. Price relay simply goes quiet. Good reuse candidate for Trivia question push in v2. |
| `api-server/index.ts` (4000) | None (auth/health/docs) | None |
| `worker/index.ts` | Trading jobs above | Job filters + flag short-circuits |
| Admin app | `isAdminProcess()` already skips the streamer | None |

---

## 5. `enabledGameTypes`

Second flag, same mechanism.

```ts
enabledGameTypes: { type: [String], default: ["trading"] }
```

Read through the same `/api/settings` payload that carries `arenaEnabled`. Consumers:

- Admin game picker (filter)
- User nav / games list
- Contest entry (reject disabled game types)
- `/play` dispatcher (friendly unavailable screen)

Derived-state rule from `02`: `tradingEnabled === false` removes `"trading"` from the effective list at read time, so the two settings can never contradict each other. One source of truth beats two settings an admin must keep consistent.

**Disabling a game must not break running contests** - it prevents new ones. Enforce and document; the admin UI should warn and show the count of active contests before disabling.

---

## 6. Redis and caching

- Redis is optional throughout with graceful degradation (`redisDisabled` flag) - no change needed.
- The price relay channel (`chartvolt:price-broadcast`) is trading-only and simply idles.
- **Ranking cache** (`lib/caches/ranking-cache.ts`, 3s TTL) is game-neutral - reuse for Trivia.
- **Leaderboard cache** is a 5-minute in-process Map, per-instance, invalidated by an HTTP call from admin/worker. Replacing the read path with `UserGameStats` (see `04`) removes most of the need for it, which is a real performance improvement and a good argument for doing that work.

---

## 7. Observability

Add before, not after, the rollout:

| Signal | Why |
|---|---|
| Contest finalization outcome by game type (success / warning / failure) | Catches the R3 class of silent failure |
| Settlement duration by game type | Trivia settle recomputes from answers; watch it as contests grow |
| Answer submission rate + rejection reasons | Detects cheating attempts and client bugs |
| Prize payout total vs prize pool per contest | The single best money-integrity check |
| Price streamer state (running / idle / reason) | Confirms gating works as intended |
| Active contests by game type | Operational dashboard |
| Alert: any contest in `finalizing` for more than 10 minutes | Stuck-finalizer detection (there is already a 5-minute reset to `active`) |

The payout-vs-pool check is worth wiring as a hard alert. It is the one invariant that, if violated, means real money moved incorrectly.

---

## 8. Environment and deployment

No new services, no new ports, no new external dependencies for Trivia. It is DB + Next.js routes only. That is a deliberate design choice and one of the reasons Trivia is the right first game.

New env/settings keys: none required. The two flags live in `WhiteLabel` and are admin-editable, following the `arenaEnabled` and `IP_INTELLIGENCE_API_KEY` precedents. If they should also be settable via environment, register them in `lib/services/settings.service.ts` and its admin mirror.

`deploy/env.example` needs no change unless the environment-override route is chosen.
