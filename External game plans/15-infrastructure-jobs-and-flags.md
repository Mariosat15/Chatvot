# 15 - Infrastructure, Jobs and Feature Flags (part of X8)

Two pieces of work sit here. First, the flags that let provider games be switched on and
off and trading be switched off. Second, making the always-on trading infrastructure and
the background jobs safe in a world where a contest may have no positions at all.

**The governing rule: gate infrastructure, never delete it.** The price streamer,
websocket server and worker are the highest-risk code to remove and the cheapest to leave
idle.

---

## 1. The flags

| Flag | Location | Meaning |
|---|---|---|
| `tradingEnabled` | `WhiteLabel` | Master switch for trading as an activity |
| `enabledGameTypes` | `WhiteLabel` | `{ type: [String], default: ["trading"] }` - which modules are live |
| `externalGamesEnabled` | `WhiteLabel` | Master switch for all provider games |
| Per-provider enabled | `game_provider` | One provider off, others unaffected |
| Per-game enabled | `provider_game` | One title off, **independent of the provider's own status** |
| Contest pause | contest document | One contest |

All of them must work **without a deployment**. Deliver them through `/api/settings`,
which already carries `arenaEnabled`, and surface them in
`apps/admin/components/admin/EnvironmentSection.tsx`.

### Copy the `arenaEnabled` pattern exactly

`arenaEnabled` lives in exactly **8 files**: the two `whitelabel.model.ts` copies plus
`whitelabel.model.d.ts`, `app/api/settings/route.ts`,
`apps/admin/app/api/environment/route.ts`, `EnvironmentSection.tsx`,
`components/UserSidebar.tsx`, `app/arena/layout.tsx`.

`app/arena/layout.tsx` is the template. Note the comparison style:

```ts
const settings = await WhiteLabel.findOne().select("arenaEnabled").lean();
if (settings?.arenaEnabled === false) redirect("/");
```

**Compare against `false` explicitly.** A missing or undefined flag must mean *enabled*,
so that a rolling deploy or an un-migrated settings document never switches a live
feature off.

**Derived rule:** when `tradingEnabled === false`, `"trading"` is filtered out of the
effective `enabledGameTypes` at read time. One source of truth, no chance of the two
disagreeing.

---

## 2. Enforcing `tradingEnabled === false`

Every one of these, or the product is incoherent rather than merely reduced.

| Layer | Where | Behaviour |
|---|---|---|
| Route guard | trade pages, and the trading branch of `/play` | Redirect to the lobby |
| Arena | `app/arena/layout.tsx` | Add the check alongside `arenaEnabled` |
| Navigation | `UserSidebar.tsx`, `MobileBottomNav.tsx` | Hide Marketplace and Live Arena |
| Dashboard | trading section | Hidden entirely, not empty |
| **Order placement** | `lib/actions/trading/order.actions.ts` - `placeOrder` | Guard **first**, before all 16 existing steps |
| Contest creation | admin and Game Master routes | Filter or reject `"trading"` |
| Contest entry | the consolidated entry service from X0 | Reject trading contests |
| Price feed | `websocket-price-streamer.ts` | Skip initialisation, with the exception in section 3 |
| Trading API | `app/api/trading/*` | Return a disabled response, not a 500 |
| Help settings | `/api/help-settings` | Reads `TradingRiskSettings`; **must not fail** |

### The order-placement guard must be first

`placeOrder` runs a **16-step** guard chain - market hours, restrictions, margin,
contest status and more. The `tradingEnabled` check belongs at the very top. Placed
lower, an order can pass an expensive chain and then be rejected, or worse, partially
recorded.

### Active contests must be allowed to finish

Turning trading off while a trading competition is running must not strand entered,
paid players. Two options, and the second is better:

1. Let active trading contests continue to completion while blocking new ones.
2. **Refuse to disable trading while active trading contests exist**, and tell the admin
   which ones. Same protection, and the operator understands why.

This is risk **R17** in `17`.

---

## 3. Gating the price infrastructure

| | |
|---|---|
| **File** | `lib/services/websocket-price-streamer.ts` - roughly **2,900 lines** |
| **Startup** | `autoInitialize()` at the bottom, around **line 2869**, as a module side effect |
| **Also** | `instrumentation.ts` triggers `candle-aggregator.service.ts` after 5 seconds; `real-forex-prices.service.ts` and trading API routes also import it |
| **Already skips** | Worker (`isWorkerProcess()`), admin (`isAdminProcess()`), and secondary servers where `IS_PRIMARY=false` (Redis relay only) |

Add one condition, not a removal:

```
isTradingInfrastructureNeeded() =
    tradingEnabled === true  OR  an active/finalizing trading contest exists
```

The second clause is what keeps a live contest from freezing when someone toggles the
flag mid-contest.

**Why gate rather than remove.** Startup is an implicit module side effect reached from
several import paths. Removing it means finding every path and being certain none is
needed - and being wrong means either a dead chart for real traders or a silent failure
to aggregate candles. Leaving it idle costs almost nothing. This is risk **R6**.

Client-side, `contexts/PriceProvider.tsx` is already scoped to the two `/trade` pages, so
no provider-game player subscribes to prices - provided section 2 of `13` is respected.

---

## 4. Background jobs

Scheduled by Agenda in `worker/index.ts`.

**Good news first:** the trading jobs already no-op when there are no active trading
contests. Switching trading off is far safer than expected.

| Job | File | Change |
|---|---|---|
| `competition-end` | `worker/jobs/competition-end.job.ts` | **Game-aware. Dispatch to `module.settleContest()`. Highest risk in the programme** |
| `challenge-finalize` | `worker/jobs/challenge-finalize.job.ts` | Same |
| `early-end-check` | `worker/jobs/early-end-check.job.ts` | Filter to modules declaring `supportsElimination` |
| `margin-check` | `worker/jobs/margin-check.job.ts` | Filter to trading contests |
| `trade-queue` | `worker/jobs/trade-queue.job.ts` | Filter to trading; short-circuit on the flag |
| `evaluate-badges` | `worker/jobs/evaluate-badges.job.ts` | Include every game type |
| `market-data-maintenance` | `worker/jobs/market-data-maintenance.job.ts` | Skip when trading is off and no trading contest is active |
| KYC, Game Master renewal, Atlas refunds, withdrawals | various | No change |
| **New: round reconciliation** | new | `09` E7 - the safety net for rounds that never report |
| **New: provider health check** | new | Writes `provider_health_check`, drives degradation |

### The critical one

`finalizeCompetition` must dispatch on game type **before** any position-closing code
runs. The **ten** call sites listed in `11` section 2 reach it - that section re-counted
them on 4 September 2026 and the "five" this line used to claim was wrong. Add an assertion
in the trading settle path: **abort if the game type is not trading.** A loud failure is
recoverable; paying the wrong winners is not. This is risk **R3**, **closed 4 September
2026** - and the dispatch went *inside* the four finalize functions rather than at the call
sites, precisely because a list of ten that keeps growing is not a thing to depend on.

`settleContest()` must also be idempotent - refuse to write a second `competition_win`
ledger entry for a contest already settled. A stuck `finalizing` state resets to `active`
after 5 minutes, which means double invocation is a real path, not a theoretical one -
risk **R4**.

### The loaded gun in Inngest

`lib/inngest/functions.ts` defines four cron functions on `* * * * *`:
`updateCompetitionStatuses`, `monitorMarginLevels`, `updatePriceCache`,
`processTradeQueue`. **They are not registered** in `app/api/inngest/route.ts`, so they do
not run today.

If someone registers them later, four unguarded trading crons start firing every minute
against contests that may not be trading contests. **Delete them, or fence them behind
the flag.** Do not leave them as they are - risk **R5**.

---

## 5. Other processes

| Process | Port | Change |
|---|---|---|
| `websocket-server/index.ts` | 3003 | None. Messaging is its main job |
| `api-server/index.ts` | 4000 | None |
| `worker/index.ts` | - | Job filters and flag short-circuits per section 4 |
| Admin app | - | Already skips the streamer via `isAdminProcess()` |

**No new service, port or environment variable is required for provider games.** The
integration is database records plus Next.js routes. The one infrastructure change is a
CSP adjustment to allow the provider's iframe origin - `09` E3.

---

## 6. Redis and caching

Redis is **optional** and degrades gracefully via the `redisDisabled` flag in
`lib/services/redis.service.ts`. The price relay channel is
`chartvolt:price-broadcast`.

| Cache | TTL | Provider-game impact |
|---|---|---|
| `lib/caches/ranking-cache.ts` | 3 seconds | Works unchanged - it caches ranking values, not trading values |
| Leaderboard in-process Map | 5 minutes | Unchanged |
| Provider catalogue | new | Cache `provider_game`; re-sync on a schedule, not per request |

Never cache a **round result**. Results are money-relevant and must be read from
`game_round`.

---

## 7. Observability

| Signal | Purpose |
|---|---|
| Finalization outcome **by game type** | Catches **R3** - the wrong settlement path |
| **Rounds started versus rounds completed, per game** | The single most useful number in the integration - detects outages, broken games and cheating |
| Unresolved rounds, count and age | Money is waiting on each one |
| Provider callback latency and error rate | SLA enforcement, and early warning |
| Invalid signature attempts | `06` - either an attack or a rotated secret |
| **Prize payout versus prize pool** | Hard alert. The primary money-integrity invariant |
| Price streamer state | Confirms gating actually worked |
| Active contests by game type | Operations dashboard |
| Alert: contest in `finalizing` for over 10 minutes | Stuck finalizer |

Every alert must fire to a **real destination** before launch. An alert nobody receives is
worse than no alert, because it creates false confidence.

---

## 8. Environment and deployment

`deploy/env.example` needs provider credentials added - base URL, API key, signing secret,
per environment. **Sandbox and production credentials must be separate**, and the sandbox
secret must never be able to authenticate a production callback.

Everything else deploys exactly as today: commit, push, fetch on the server. No new
process to supervise.

---

## 9. Acceptance criteria

- [ ] Every flag in section 1 toggles without a deploy
- [ ] `tradingEnabled = false` produces a coherent product across every layer in section 2
- [ ] The price streamer does not initialise when trading is off and no trading contest is
      active - **verified in logs**
- [ ] A trading contest running when the flag is flipped still finalises correctly
- [x] Finalization dispatches on game type inside the four finalize functions, covering all **ten** main-app call sites (not "five" - see `11` s2 seam 3)
- [ ] The trading settle path aborts loudly on a non-trading contest
- [ ] The dead Inngest crons are deleted or fenced
- [ ] The reconciliation and provider health jobs run on the worker
- [ ] Every signal in section 7 reaches a real destination
