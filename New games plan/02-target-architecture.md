# 02 - Target Architecture

How ChartVolt becomes a games platform: one contest engine, one money layer, many pluggable game modules.

---

## 1. The shape of the change

```
                        BEFORE                                       AFTER

   Competition / Challenge                          Competition / Challenge
   (trading fields inline)                          + gameType + gameConfig
              |                                                |
              v                                                v
   +----------------------+                        +--------------------------+
   | competition-end      |                        |  Contest Engine (shared) |
   | closes forex pos.    |                        |  lock, rank, prizes,     |
   | ranks by PnL         |                        |  payout, refund, notify  |
   | pays winners         |                        +-----------+--------------+
   +----------------------+                                    |
              |                                     calls the adapter for
              v                                     settle / score / validate
        TradingPosition                                        |
                                            +------------------+------------------+
                                            |                  |                  |
                                     +------v-----+     +------v-----+    +-------v------+
                                     |  trading   |     |   trivia   |    |  chess ...   |
                                     |  module    |     |  module    |    |  module      |
                                     +------------+     +------------+    +--------------+
                                     positions,PnL      questions,        (future)
                                     price feed         answers, score
```

The contest engine stops knowing what a game *is*. It only knows: participants have a **score**, scores produce **ranks**, ranks produce **prizes**.

---

## 2. New directory layout

```
lib/games/
  index.ts                  # registry: getGameModule(), listGameModules(), assertGameEnabled()
  types.ts                  # the GameModule contract + shared types
  registry.ts               # the actual module map
  trading/
    index.ts                # TradingGameModule - wraps ALL existing trading behaviour
    config.ts               # trading gameConfig schema + defaults
    scoring.ts              # maps existing ranking methods onto the score contract
    settle.ts               # extracted from competition-end.actions.ts (close positions, reconcile)
  trivia/
    index.ts                # TriviaGameModule
    config.ts
    scoring.ts
    settle.ts
    content.ts              # question bank access
```

Mirrored under `apps/admin/lib/games/` for the admin app (see `03` for the mirror discipline).

**Rule:** adding a game must mean adding one folder under `lib/games/` plus registering it. If a new game forces edits elsewhere, the contract is incomplete - fix the contract, do not special-case the game.

---

## 3. The Game Module contract

This is the central artefact of the whole plan. Written as TypeScript for precision; this is a design sketch, not final code.

```ts
// lib/games/types.ts

export type GameTypeId = "trading" | "trivia";   // extend as games are added

/** What the shared engine needs to know to run a contest safely. */
export interface GameCapabilities {
  /** Needs the live price feed running. Trading: true. Trivia: false. */
  needsPriceFeed: boolean;
  /** Should forex market-hours / holiday gates apply to entry and play? */
  needsMarketHours: boolean;
  /** Can a participant be eliminated mid-contest (liquidation-style)? */
  supportsElimination: boolean;
  /** Does the score change continuously (live leaderboard polling) or in discrete events? */
  scoreUpdates: "continuous" | "discrete";
  /** Supports 1v1 challenges in addition to multi-player competitions. */
  supportsChallenges: boolean;
  /** Requires scheduled real-time presence (all players play simultaneously). */
  requiresSyncPlay: boolean;
}

/** Describes one way to rank participants in this game. */
export interface RankingMethodDescriptor {
  id: string;                    // e.g. "score", "score_then_time", "pnl"
  label: string;                 // admin-facing, e.g. "Highest Score"
  /** Higher value wins (true) or lower value wins (false, e.g. fastest time). */
  higherIsBetter: boolean;
  /** Pull the comparable number off the participant document. */
  resolve: (participant: ParticipantLike) => number;
  /** Optional formatter for UI display. */
  format?: (value: number) => string;
}

export interface GameModule {
  id: GameTypeId;
  /** Admin + user facing name, e.g. "Trivia Quiz". */
  label: string;
  /** Short description shown in the admin game picker. */
  description: string;
  capabilities: GameCapabilities;

  // ---------- configuration ----------
  /** Validate the admin-supplied gameConfig. Returns errors, never throws. */
  validateConfig(config: unknown): { valid: boolean; errors: string[] };
  /** Defaults used when an admin creates a contest of this type. */
  defaultConfig(): Record<string, unknown>;

  // ---------- lifecycle hooks ----------
  /**
   * Called inside the join transaction after the wallet is debited.
   * Initialise game-specific participant state (trading: capital/margin;
   * trivia: question set assignment, attempt counters).
   */
  onParticipantJoin(ctx: JoinContext): Promise<ParticipantGameState>;

  /**
   * Called when a contest transitions upcoming -> active.
   * Trading: nothing. Trivia: generate/lock the question set.
   */
  onContestStart?(ctx: ContestContext): Promise<void>;

  /**
   * Settle the game before ranking. This REPLACES the trading-specific
   * step 2-4 of competition-end.actions.ts.
   * Trading: close open positions at live/snapshot prices, reconcile PnL.
   * Trivia: finalise unanswered questions as incorrect, compute final score.
   * MUST be idempotent - the finalizer can retry.
   */
  settleContest(ctx: ContestContext): Promise<SettlementResult>;

  /**
   * Optional mid-contest check for early termination
   * (trading: all liquidated; trivia: all players finished).
   */
  checkEarlyEnd?(ctx: ContestContext): Promise<EarlyEndVerdict | null>;

  // ---------- scoring ----------
  /** Ranking methods this game offers the admin. */
  rankingMethods(): RankingMethodDescriptor[];
  /** The default ranking method id for new contests. */
  defaultRankingMethod(): string;
  /**
   * Canonical 0..N score written to participant.score, used for
   * cross-game leaderboards and points. See 04-scoring-points-leaderboards.md.
   */
  computeScore(participant: ParticipantLike): number;
  /** Stat tiles to show for this game (replaces hard-coded PnL cards). */
  statDescriptors(): StatDescriptor[];

  // ---------- presentation ----------
  /** Route segment for gameplay: "trade" for trading, "play" for trivia. */
  playRouteSegment: string;
  /** Terminology overrides for this game (see 09). */
  terminology: Partial<TerminologyPack>;
  /** Icon key for nav/cards. */
  icon: string;
}
```

Supporting context types:

```ts
export interface ContestContext {
  contestId: string;
  contestKind: "competition" | "challenge";
  gameConfig: Record<string, unknown>;
  startTime: Date;
  endTime: Date;
  /** Provided so modules never import the models directly. */
  session?: import("mongoose").ClientSession;
}

export interface JoinContext extends ContestContext {
  userId: string;
  username: string;
}

export interface SettlementResult {
  ok: boolean;
  /** Participants whose score/status changed, for the engine to persist. */
  updated: Array<{ userId: string; score: number; status?: ParticipantStatus }>;
  /** Non-fatal problems worth logging/alerting. */
  warnings: string[];
}
```

---

## 4. How the shared engine uses it

### Join

```
enterContest(contestId, userId)            <- ONE consolidated entry service (STAGE 0)
  1. resolve contest  -> { gameType, gameConfig, entryFee, ... }
  2. module = getGameModule(contest.gameType)
  3. generic gates: auth, email verified, restrictions, fraud gate,
     level requirement, deadline, capacity, duplicate, balance
  4. conditional gate: if (module.capabilities.needsMarketHours) checkMarketHours()
  5. BEGIN TRANSACTION
       debit wallet, write ledger row
       gameState = await module.onParticipantJoin(ctx)
       create participant { ...generic, ...gameState, score: 0 }
       $inc currentParticipants, $inc prizePool          <- always, both paths
     COMMIT
  6. post-commit: notifications, coordination detection, badge eval
```

### Finalize

```
finalizeContest(contestId)
  1. optimistic lock active -> finalizing              (unchanged, generic)
  2. module = getGameModule(contest.gameType)
  3. result = await module.settleContest(ctx)           <- SEAM 3 cut here
  4. persist result.updated onto participants (score, status)
  5. calculateRankings(participants, rules, module)     <- SEAM 1 cut here
  6. distributePrizesWithTies(...)                      (unchanged, generic)
  7. credit winners, platform fee, unclaimed pool, GM share   (unchanged)
  8. status -> completed, write finalLeaderboard         (generic + score field)
```

Steps 1, 4, 6, 7, 8 are the existing code, untouched. Only 3 and 5 become dispatching calls.

### Ranking

`getRankingValue()` becomes:

```ts
function getRankingValue(participant, method, module: GameModule): number {
  const descriptor = module.rankingMethods().find(m => m.id === method);
  if (!descriptor) {
    // Reason: unknown method must not silently rank everyone equal -
    // fall back to the module's canonical score.
    return module.computeScore(participant);
  }
  return descriptor.resolve(participant);
}
```

The trading module's `rankingMethods()` returns exactly today's six descriptors, so **trading behaviour is bit-for-bit identical** after the refactor. That property is what makes this refactor safe and testable: a regression test can assert that the new path produces the same leaderboard as the old path for existing completed competitions.

---

## 5. The two flags

| Flag | Location | Meaning | Pattern to copy |
|---|---|---|---|
| `tradingEnabled` | `WhiteLabel` | Master switch. Hides trading UI, blocks trading actions, prevents creating trading contests, gates the price feed. | `arenaEnabled` (8 files) |
| `enabledGameTypes: string[]` | `WhiteLabel` | Which game modules are live, e.g. `["trading","trivia"]`. Controls the admin game picker and user nav. | new, same mechanism |

Derived rule to avoid contradictory state: `tradingEnabled === false` implies `"trading"` is filtered out of `enabledGameTypes` at read time, rather than requiring the admin to keep two settings consistent. One source of truth, one place to reason about.

Guard helper:

```ts
// lib/games/index.ts
export async function assertGameEnabled(gameType: GameTypeId) {
  const enabled = await getEnabledGameTypes();
  if (!enabled.includes(gameType)) {
    return { success: false, error: "This game is not currently available." };
  }
  return { success: true };
}
```

Returned as a result object, never thrown - per the project rule that server actions do not throw.

---

## 6. What happens to existing trading code

**Nothing is deleted.** Concretely:

| Existing code | Fate |
|---|---|
| `order.actions.ts`, `position.actions.ts`, `liquidation.actions.ts`, `margin-monitor.actions.ts` | Untouched. Called only by the trading module and the `/trade` routes. |
| `pnl-calculator.service.ts`, `risk-manager.service.ts`, `margin-safety.service.ts` | Untouched. |
| `websocket-price-streamer.ts` | One new condition in `autoInitialize()`. |
| Position-closing block inside `competition-end.actions.ts` | **Extracted** (moved, not rewritten) into `lib/games/trading/settle.ts` and called via `settleContest()`. |
| Ranking switch in `competition-ranking.service.ts` | **Moved** into `lib/games/trading/scoring.ts` as descriptors. |
| Duplicated challenge winner logic in `challenge-finalize.actions.ts` | Replaced by a call to the same shared ranking + module settle. Removes a duplication, which is a side benefit. |
| Trading fields on the participant models | Kept. Trivia simply leaves them at their defaults. |
| `/trade` routes and `components/trading/` chart stack | Kept as the trading module's UI. |

The only genuinely destructive-looking change is the extraction of the settle block. It should be done as a **pure move with no logic edits**, verified by the regression test in `13`.

---

## 7. Contest kinds vs game types (two independent axes)

These must not be conflated:

| Axis | Values | Meaning |
|---|---|---|
| **Contest kind** | `competition` (many players), `challenge` (1v1) | Structural: how many players, how prizes split |
| **Game type** | `trading`, `trivia`, ... | What the players actually do |

Today the code has two kinds and one game. The target is two kinds and N games, giving a matrix. Not every cell must be supported - `GameCapabilities.supportsChallenges` lets a module opt out of 1v1 (e.g. a game that only makes sense with many players).

This matters for the admin UI: the game picker must be filtered by both `enabledGameTypes` and, in the challenge creator, by `supportsChallenges`.

---

## 8. Why not the alternatives

Recording the rejected options so this is not relitigated later.

| Alternative | Why rejected |
|---|---|
| **Separate collections per game** (`TriviaCompetition`, etc.) | Would fork the global leaderboard, wallet ledger joins, admin contest lists, GM revenue attribution, refunds, notifications and financial dashboards. Every one of those currently queries one collection. Highest-cost option by far. |
| **Mongoose discriminators** | Attractive on paper, but the codebase reads these models through `.lean()` and raw driver calls in several places (e.g. the GM competition route inserts via raw MongoDB). Discriminator keys are easy to bypass accidentally, producing documents that fail to hydrate. Plain `gameType` + adapter is more robust here. |
| **Fork the app / second deployment per game** | Doubles the operational surface, splits the wallet, and destroys the cross-game identity and single-account premise that makes this a platform. |
| **Delete trading, build games** | Explicitly rejected by the brief, and correctly so: trading is the highest-ARPU vertical and the always-on price infrastructure is the most dangerous code to remove. |
| **Full i18n for wording** | Solves a problem we do not have (no other languages) at the cost of touching thousands of strings. A terminology token layer targets only the shared shell. See `09`. |

---

## 9. Architectural invariants to hold

Write these into the PR checklist:

1. **The contest engine never imports from `lib/games/<specific game>/`.** It only imports the registry and types. Enforceable with an ESLint `no-restricted-imports` rule.
2. **Game modules never import contest models directly.** They receive context and return data. Keeps them testable and prevents circular imports.
3. **`settleContest()` is idempotent.** The finalizer retries after stuck-`finalizing` recovery; double settlement must not double-pay.
4. **Every new participant document gets `score`**, even trading ones, so the leaderboard has one column to sort on.
5. **`gameType` is required on write, defaulted on read.** Existing documents have no `gameType`; readers treat missing as `"trading"`. See migration in `13`.
6. **Money code paths stay single.** One entry service, one payout service. Adding a game must not add a payment path.
