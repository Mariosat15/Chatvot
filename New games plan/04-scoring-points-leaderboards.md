# 04 - Scoring, Points, Leaderboards and Stats

The hardest *conceptual* problem in the project: how a forex PnL of +4,382.51 and a trivia score of 87 can live in the same leaderboard fairly.

---

## 1. Three distinct concepts, currently conflated

Today "score" means whatever the trading metric is. Going multi-game, three separate things must be named and kept apart:

| Concept | Scope | Purpose | Where stored |
|---|---|---|---|
| **Raw score** | One contest, one game | Decides who wins *this* contest | `participant.score` + `scoreBreakdown` |
| **Normalised points** | One contest, comparable across games | Feeds cross-game leaderboards and progression | `participant.normalizedPoints` |
| **Platform points / rating** | Lifetime, per game and overall | The "ChartVolt Rating" - a player's standing | new `UserGameStats` collection |

Conflating raw score with cross-game points is the mistake that makes multi-game leaderboards unfair. Trading PnL scales with entry fee and leverage; trivia score scales with question count. They are not comparable numbers and must never be summed.

---

## 2. Raw score - per contest, per game

Each module writes `participant.score` using its own units, and declares its ranking methods.

### Trading module

`rankingMethods()` returns exactly today's six descriptors, so behaviour is unchanged:

| id | resolve | higherIsBetter |
|---|---|---|
| `pnl` | `participant.pnl` | true |
| `roi` | `participant.pnlPercentage` | true |
| `total_capital` | `participant.currentCapital` | true |
| `win_rate` | `participant.winRate` | true |
| `total_wins` | `participant.winningTrades` | true |
| `profit_factor` | `winningTrades / losingTrades` | true |

`computeScore()` for trading returns `pnlPercentage` (ROI). Rationale: ROI is entry-fee-independent and leverage-normalised in a way absolute PnL is not, so it is the fairest single number to carry into cross-game comparison.

`participant.score` is kept in sync with the contest's configured `rankingMethod` on every stats update, so the generic leaderboard column is always meaningful.

### Trivia module

| id | resolve | higherIsBetter |
|---|---|---|
| `score` | `participant.score` | true |
| `score_then_time` | score, tie-broken by `completionTimeMs` | true |
| `accuracy` | `scoreBreakdown.correct / answered * 100` | true |

Trivia raw score formula (full detail in `10`):

```
questionPoints = basePoints (correct only)
              + speedBonus(remainingMs / allowedMs)     [0 .. maxSpeedBonus]
              + streakBonus(consecutiveCorrect)         [capped]
score = sum(questionPoints)
```

**Speed bonus must be computed server-side from server receive time**, not from a client-reported elapsed time - otherwise it is trivially cheatable. This is the same trust principle as server-side price locking in trading.

---

## 3. Normalised points - the cross-game currency

Written **once, at settlement**, per participant. The formula deliberately uses **rank and field size**, not raw score, because rank is the only thing that means the same in every game.

```
placementFactor = (participants - rank + 1) / participants        // 1.0 for winner, ~0 for last
difficultyFactor = clamp(log10(participants) / log10(50), 0.4, 1.5)
stakeFactor      = clamp(log10(1 + entryFee) / log10(101), 0.5, 1.5)

normalizedPoints = round(1000 * placementFactor * difficultyFactor * stakeFactor)
```

Properties this gives us, and why each matters:

- **Winning a 100-player contest beats winning a 3-player contest.** Prevents farming points in tiny self-organised contests, which is the obvious exploit.
- **A high-stake contest is worth more than a free one**, but only logarithmically, so a whale cannot buy the leaderboard.
- **Bounded** - one contest can never award more than ~2,250 points, so a single event cannot dominate a season.
- **Game-blind** - it never reads a trading or trivia field, so it needs no change when a game is added.
- Participation in a contest you lose still yields a small positive number, which is deliberate: it rewards showing up without rewarding losing.

Disqualified / forfeited participants get `normalizedPoints = 0`. Refunded (cancelled contest) participants get `0` and the contest is excluded from stats entirely - a cancelled contest must not appear in anyone's record.

**These constants belong in DB settings, not code**, so they can be tuned without a deploy. Put them under a `PointsSettings` singleton or in `AppSettings`, and expose them in the admin (see `07`).

---

## 4. Platform points / ChartVolt Rating

The audit confirmed **no ELO or rating system exists** today. This is the opportunity to add the thing that makes a multi-game platform feel like one product - a per-vertical rating, which is also exactly what the strategic review asked for ("ChartVolt Rating per vertical").

### New collection: `UserGameStats`

One document per user per game type. This is a **materialised** aggregate, updated at settlement - not computed on read.

```ts
{
  userId: string,
  gameType: string,               // "trading" | "trivia" | "_overall"
  contestsEntered: number,
  contestsCompleted: number,
  wins: number,
  podiums: number,
  totalPoints: number,            // lifetime sum of normalizedPoints
  seasonPoints: number,           // resets per season
  rating: number,                 // 1200 start, Elo-style, see below
  bestRank: number,
  bestScore: number,
  currentStreak: number,          // consecutive contests with a podium
  lastPlayedAt: Date,
  // per-game extras live here, e.g. trivia accuracy, trading profit factor
  extra: Record<string, unknown>,
}
```

Unique index on `{ userId, gameType }`; secondary indexes on `{ gameType, totalPoints: -1 }` and `{ gameType, rating: -1 }` to serve leaderboard reads directly from an index.

### Rating update

Use a simple multiplayer Elo adaptation at settlement:

```
expectedRank  = (participants + 1) / 2
actualRank    = participant.rank
k             = 24 (tune per game; lower for high-variance games)
ratingDelta   = k * (expectedRank - actualRank) / (participants - 1) * 2
rating       += round(ratingDelta)
```

Clamp rating to `[100, 3000]`. Keep it **per game type** - a strong trader is not automatically a strong trivia player, and pretending otherwise would make the rating meaningless. Display as "Trading 1840 / Trivia 1610".

Why Elo rather than just cumulative points: points reward volume, rating rewards skill. A platform that only shows points is farmable by playing constantly; one that shows both tells an honest story. Show points for season/prizes and rating for skill.

---

## 5. Fixing the global leaderboard

### Current problems

`lib/actions/leaderboard/global-leaderboard.actions.ts`:

- `overallScore` is a hard-coded weighted sum where 5 of 9 terms are trading metrics (`totalPnl*0.3`, `totalPnlPercentage*5`, `winRate*2`, `profitFactor*10`, plus wins/podiums/badges).
- Rebuilt **on read** by aggregating `TradeHistory` and participants - roughly 7 seconds.
- Cached 5 minutes in an **in-process Map**, so every Next.js instance has its own copy and they disagree.
- Capped at 5,000 users.
- Invalidated cross-process by an HTTP call from admin/worker to the main app.

Adding games to this design multiplies the aggregation cost per game and makes the score formula progressively more arbitrary.

### Target design

**Read from `UserGameStats`, not from raw history.**

```
GET /api/leaderboard?gameType=trivia&scope=season&page=1
  -> UserGameStats.find({ gameType: "trivia" })
       .sort({ seasonPoints: -1 })
       .skip(...).limit(...)
```

That is an index-covered query: milliseconds instead of seconds, no cap needed, and it paginates properly.

Three leaderboard scopes to expose:

| Scope | Sort key | Answers |
|---|---|---|
| Per game | `UserGameStats.totalPoints` / `rating` for that `gameType` | "Best trivia players" |
| Overall | `gameType: "_overall"` rollup document | "Best players on ChartVolt" |
| Per contest | existing `participant.score` sort | "Who is winning this event" |

Keep the existing trading leaderboard reachable as `?gameType=trading` so nothing that currently links to it breaks.

**Migration path:** build `UserGameStats` by backfilling from completed participants (script in `13`), then run both leaderboards in parallel behind a flag and compare the top 100 before switching. Do not delete the old code path until the new one has been correct for a full season.

### Live in-contest ranking

`app/api/competitions/[id]/live-ranking/route.ts` currently computes `liveEquity = currentCapital + unrealizedPnl`. This must become a module call:

```ts
const module = getGameModule(contest.gameType);
const value  = module.liveScore ? module.liveScore(p) : p.score;
```

Add an optional `liveScore(participant)` to the contract for games with continuous scoring (`capabilities.scoreUpdates === "continuous"`). Trading implements it as today's live equity. Trivia does not implement it - its score is already current because it is written on every answer, so the default `p.score` is correct.

The 3-second `ranking-cache.ts` TTL stays and applies to all games.

---

## 6. Stats and dashboard tiles

### The problem

`components/dashboard/DashboardStats.tsx` and friends hard-code "Total Capital", "Total P&L", "Open Positions", "Total Trades", "Win Rate", "Profit Factor". `lib/actions/comprehensive-dashboard.actions.ts` is a ~1,700-line mega-action feeding them. A Trivia-only player would see six empty or nonsensical tiles.

### The fix: declared stat descriptors

Each module declares what to show:

```ts
interface StatDescriptor {
  key: string;
  label: string;                       // via terminology token
  value: (stats: UserGameStats) => number | string;
  format: "currency" | "percent" | "number" | "duration" | "rating";
  tooltip?: string;
  emphasis?: "primary" | "secondary";
}
```

Trading returns roughly today's tiles. Trivia returns: Contests Played, Best Score, Accuracy, Correct Answers, Best Rank, Rating.

The dashboard then renders, per enabled game the user has played, a **section** of that game's tiles, plus a game-agnostic header (credits balance, total points, overall rating, active contests). A player who has only played Trivia never sees a margin metric.

`comprehensive-dashboard.actions.ts` should be **split** as part of this work - it is already well over the 500-line project guideline. Suggested split: `dashboard/overview.ts` (game-agnostic), `dashboard/trading.ts`, `dashboard/trivia.ts`, orchestrated by a thin composer that loops enabled modules. This is a refactor with real value beyond the games project.

### User stats services

`lib/services/user-stats.service.ts` and `unified-user-stats.service.ts` aggregate `TradeHistory` on every call. Keep them for trading detail, but the **dashboard header and leaderboard should read `UserGameStats`** instead. That removes the heaviest repeated aggregation in the app - a measurable performance win, which is the justification for touching this code at all.

---

## 7. Prize distribution - unchanged

Worth stating explicitly because it is the reassuring part: `distributePrizesWithTies()` takes ranks and percentages and knows nothing about games. Once ranking is game-aware, **prize distribution needs no change at all**.

The only related change: `finalLeaderboard` on the contest document currently stores `{ rank, userId, username, finalCapital, pnl, pnlPercentage, totalTrades, winRate, prizeAmount }`. Add `score` and `normalizedPoints`, and treat the trading fields as optional. Since it is a display snapshot, old entries render fine and new Trivia entries simply have no `finalCapital`.

---

## 8. Tie-breaking across games

Current tie-breakers are trading (`trades_count`, `win_rate`, `total_capital`, `roi`, `join_time`, `split_prize`).

Make tie-breakers module-declared too, with two **universal** fallbacks available to every game:

1. `completion_time` - earlier finisher wins (needs `completionTimeMs`)
2. `join_time` - earlier entrant wins (already exists, uses `enteredAt`)
3. `split_prize` - split equally (already exists, and is the safest default)

Recommendation: for Trivia default to `score_then_time` with `split_prize` as the final fallback. Ties on a 10-question quiz are common, so this matters more than it does in trading where exact PnL ties are rare.

---

## 9. Season concept (optional but recommended)

Cumulative lifetime points mean a player who joined last year is permanently ahead of a new player, which kills leaderboard motivation - the reason `seasonPoints` is in the schema above.

Minimal implementation: a `Season` singleton/collection with `startsAt`, `endsAt`, `name`; `seasonPoints` resets when a new season starts; the leaderboard defaults to season scope with an all-time toggle. This also creates a natural marketing rhythm and a reason to re-engage.

Flagged as optional because it is not required for Trivia to launch - but it is much cheaper to add the field now (it is already in the schema above) than to migrate later.

---

## 10. Anti-abuse considerations for scoring

Multi-game scoring opens exploits that do not exist in trading. Design for them now:

| Exploit | Mitigation |
|---|---|
| Self-organised 3-player contests farmed for points | `difficultyFactor` from field size; minimum participants for points to count at all (e.g. 5) |
| Free contests farmed for points | `stakeFactor`; consider zero points for `entryFee === 0` contests, or a separate casual leaderboard |
| Collusion in 1v1 challenges (trade wins back and forth) | Cap points from challenges against the same opponent per period; existing `CoordinationDetectionService` should be extended to non-trading contests |
| Multi-accounting | Existing fraud gate + device fingerprint + `maxEntriesPerHour`. Note the throttle currently counts only `CompetitionParticipant` - it must count all game types (see `12`, R9) |
| Answer sharing in Trivia | Per-participant question order shuffling, per-contest locked set, tight `secondsPerQuestion`, and simultaneous-start contests |
| Client clock manipulation for speed bonus | Server receive time only |

These are not hypothetical - the platform already has a fraud subsystem precisely because contest money attracts this behaviour.
