# 11 - Foundation and Seams (X1)

Chapters `01`-`09` treated this work as a prerequisite owned by the `New games plan`.
In the external-only scenario it is **owned by this plan**, and it is the phase that
must be done most carefully. Everything after it is additive and individually
shippable; this is the phase that can break trading.

The audit facts below were verified directly against the codebase, not assumed.

---

## 1. What already works, and does not need touching

The contest and money engines are already game-agnostic. This is why the programme is
an extension rather than a rebuild.

| Layer | Status |
|---|---|
| Contest shell, status machine, scheduling, pause, cancel | Generic |
| Credit wallet, ledger, entry fee, prize pool, prize maths, platform fee | Generic |
| Refund loop, unclaimed pool, Game Master revenue share | Generic |
| Entry gates - eligibility, fraud, KYC, restrictions | Generic |
| Badge, XP and journey infrastructure | Generic, database-driven |
| Wallet, messaging, notifications | Generic |

`distributePrizesWithTies()` in `lib/services/competition-ranking.service.ts` needs no
change at all. A provider game's prizes are paid by exactly the code that pays a
trading competition's prizes today.

---

## 2. The four seams

These are the only places where trading is welded into the shared engine. Each needs a
dispatch point so a provider game can plug in.

### Seam 1 - Ranking

| | |
|---|---|
| **File** | `lib/services/competition-ranking.service.ts` |
| **Function** | `getRankingValue` at **line 64**, with a duplicate switch around **line 99** |
| **Also** | `lib/actions/trading/challenge-finalize.actions.ts` lines ~**491-628** duplicate the winner logic |
| **Today** | A `switch` over six trading metrics: `pnl`, `roi`, `total_capital`, `win_rate`, `total_wins`, `profit_factor` |
| **Change** | Dispatch to the game module. For a provider game the ranking value is the stored `score`, ordered by the game's declared `scoreDirection` |

This is the cheapest seam in the codebase - a single function - and the most valuable.

### Seam 2 - Participant performance record

| | |
|---|---|
| **Files** | `database/models/trading/competition-participant.model.ts` and `challenge-participant.model.ts` |
| **Today** | Trading fields only - capital, PnL, margin. **No general `score` field** |
| **Change** | Add `score: number`, plus the provider fields in `04-data-model.md`. **Additive only** - no trading field is removed |
| **Mirror** | Both files exist twice. `apps/admin/database/models/` must change in the same commit |

### Seam 3 - Settlement and finalization

| | |
|---|---|
| **File** | `lib/actions/trading/competition-end.actions.ts`, ~**1,500 lines**. Steps 2-4 are trading-specific |
| **Also** | `challenge-finalize.actions.ts` repeats the logic |
| **Change** | Extract the position-closing block to a trading game module, and dispatch on the game label before it runs |
| **Danger** | This is the highest-risk change in the whole programme. See risk **R3** in `17` |

**Five entry points reach finalization, and every one must dispatch:**

1. The `competition-end` worker job - `worker/jobs/competition-end.job.ts`
2. The `challenge-finalize` worker job - `worker/jobs/challenge-finalize.job.ts`
3. Lazy auto-finalize inside `getCompetitionById`
4. `POST /api/finalize-old-competitions`
5. The admin emergency-cancel route

Missing one of these means a provider contest is settled by trading code: every score
read as zero, every rank equal, and prizes paid to the wrong players. **Silently.**

### Seam 4 - In-progress gameplay writes

| | |
|---|---|
| **Files** | `order.actions.ts` (`placeOrder`, a **16-step** guard chain), `position.actions.ts`, `liquidation.actions.ts`, `margin-monitor.actions.ts` |
| **Today** | Keyed on `TradingPosition.competitionId`, which holds either a competition or a challenge ID |
| **Change** | **None.** These stay trading-only |
| **Hard rule** | A provider game must never write to `TradingPosition`. Round state lives in `game_round` - see `04-data-model.md` |

---

## 3. The game module contract

New directory `lib/games/`, mirrored at `apps/admin/lib/games/`:

```
lib/games/
  index.ts      getGameModule(), assertGameEnabled(), getEnabledGameTypes()
  types.ts      the contract
  registry.ts   listGameModules()
  trading/      index.ts, config.ts, scoring.ts, settle.ts
  provider/     index.ts, config.ts, scoring.ts, settle.ts, adapters/
```

The provider module is described in `02-integration-architecture.md`. **One provider
module serves every game from every provider**; which company and which title are data
on the contest, not code.

### Capability flags

Each module declares what it can do, so the admin panel cannot offer an impossible
contest format:

`needsPriceFeed`, `needsMarketHours`, `supportsElimination`, `scoreUpdates`,
`supportsChallenges`, `requiresSyncPlay`

For provider games these are derived from the catalogue response in `01` section 3 -
`family`, `supportsCompetition`, `supportsOneVsOne`, `supportsContentSeed`.

### Two independent axes

Do not conflate them:

| Axis | Values |
|---|---|
| **Contest kind** | `competition`, `challenge` |
| **Game type** | `trading`, `provider` |

---

## 4. The trading module must change nothing

X1 succeeds only if trading behaves **identically** afterwards. The trading module is a
wrapper around existing behaviour, not a rewrite.

**Left completely untouched:** `order.actions.ts`, `position.actions.ts`,
`liquidation.actions.ts`, `margin-monitor.actions.ts`, `pnl-calculator.service.ts`,
`risk-manager.service.ts`, `margin-safety.service.ts`, the `/trade` routes and the
whole `components/trading/` chart stack.

**Moved, not rewritten:** the settle block out of `competition-end.actions.ts`, and the
ranking switch out of `competition-ranking.service.ts`.

### The regression test that proves it

Recompute a sample of **historical completed competitions** through the new module path
and compare against the stored `finalLeaderboard`. Identical order, identical values.
If they differ, the extraction is wrong. **Do not proceed to X2 until this is green.**

---

## 5. Architectural invariants

Enforce these in review, and the first two with ESLint `no-restricted-imports`.

1. The contest engine **never** imports a specific game folder.
2. Game modules **never** import contest models directly.
3. `settleContest()` is **idempotent**. Called twice, it pays once.
4. Every participant gets a `score`, whatever the game.
5. The game label is **required on write**; a missing label on read means `"trading"`.
6. Money paths stay single - one entry path, one payout path.
7. **Provider concepts never leak past the adapter.**

Invariant 5 matters during a rolling deploy: old code writing a contest without a game
label must not produce an unlabelled contest that later settles as the wrong game type.

### The trap that has already caused a production defect

`app/api/gamemaster/competitions/route.ts` inserts with the **raw MongoDB driver**,
bypassing Mongoose defaults. It will not get a default game label. This is risk **R7**
in `17`, and it is the reason Mongoose discriminators were rejected as an approach.

---

## 6. Why the alternatives were rejected

| Alternative | Why not |
|---|---|
| A separate collection per game | Forks the leaderboard, ledger, admin lists, Game Master revenue and refunds - every one of them |
| Mongoose discriminators | Bypassed by `.lean()` reads and by the raw-driver Game Master insert above |
| A separate app per game | Splits wallet and identity, which are the platform's actual assets |
| Delete trading | Highest revenue per user today, and the regulatory brief rests on it |

---

## 7. Done when

- [ ] `score` present on both participant models, in **both** apps, same commit
- [ ] Game label on both contest models, in **both** apps, same commit
- [ ] Registry resolves a module by game type; `assertGameEnabled()` returns a result
      object and never throws
- [ ] Trading wrapped as a module with **no behaviour change**, proven by the historical
      regression test in section 4
- [ ] All **five** finalization entry points dispatch on game type
- [ ] The trading settle path **asserts** the game type and aborts if it is not trading
- [ ] Market-hours gating scoped to `needsMarketHours`, so it cannot block a provider
      contest - `MarketSettings.blockCompetitionsOnHolidays` /
      `blockChallengesOnHolidays`
- [ ] The Game Master raw-driver insert sets the game label explicitly
- [ ] ESLint import restrictions in place for invariants 1 and 2
- [ ] Mirror CI check from X0 passing

**Effort: 2-3 weeks.** Roughly a third of it is the regression test in section 4, and
that third is the part that makes the rest safe.
