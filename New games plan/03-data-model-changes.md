# 03 - Data Model Changes

Every schema change, field by field. **All changes are additive** - no field is removed or retyped, so existing documents stay valid and rollback is trivial.

---

## 0. The mirror discipline (read first)

The admin app keeps its own copies of the models. A field added in one app and not the other means the app that lacks it **cannot write that field** - the write is discarded silently and the operation reports success. And if an *enum value* is missing rather than a field, the write is **rejected outright**, so the record is never created at all.

Measured 1 September 2026; see `12-risk-register.md` R2 for the full severity table and `__tests__/helpers/mirror-drift-behaviour.test.ts` for the evidence.

**Rule for every task below: change both paths in the same commit.** `npm run check:mirrors` enforces this in CI and on `git push`, so forgetting it fails the build rather than reaching production.

Note on `.d.ts` files: there is nothing to maintain here any more. 112 stale declaration files (57 `.d.ts` + 55 `.d.ts.map`) were committed by accident in February 2026, were orphaned build output that TypeScript ignored in favour of the sibling `.ts`, and were **all deleted on 1 September 2026**. A `.gitignore` rule prevents recurrence. If you ever see one reappear, it is a stray `tsc -d` run, not a file to update - see `00a`.

| Main app | Admin mirror | Extra |
|---|---|---|
| `database/models/trading/competition.model.ts` | `apps/admin/database/models/trading/competition.model.ts` | - |
| `database/models/trading/competition-participant.model.ts` | `apps/admin/database/models/trading/competition-participant.model.ts` | - |
| `database/models/trading/challenge.model.ts` | `apps/admin/database/models/trading/challenge.model.ts` | - |
| `database/models/trading/challenge-participant.model.ts` | `apps/admin/database/models/trading/challenge-participant.model.ts` | - |
| `database/models/whitelabel.model.ts` | `apps/admin/database/models/whitelabel.model.ts` | `database/models/whitelabel.model.d.ts` |
| `database/models/badge-config.model.ts` | `apps/admin/database/models/badge-config.model.ts` | - |
| `database/models/user-level.model.ts` | `apps/admin/database/models/user-level.model.ts` | - |

**This has already gone wrong.** Three mirrored pairs are confirmed out of sync today: the admin copies are missing `gameMasterId` / `gameMasterName` (competition), `provider` / `providerTransactionId` (wallet transaction) and `brandingFiles` (whitelabel).

The fix - syncing the drift and adding a CI script that diffs the mirrored pairs and fails the build on divergence - is **Stage 0**, delivered and signed off before any games work. See `00a-STAGE-0-prerequisite-fixes-DO-FIRST.md`.

---

## 1. Competition model

`database/models/trading/competition.model.ts` + admin mirror

### Add

```ts
/** Which game module runs this contest. Missing => "trading" for legacy docs. */
gameType: {
  type: String,
  enum: ["trading", "trivia"],
  required: true,
  default: "trading",
  index: true,
},

/**
 * Game-specific settings, validated by the module's validateConfig().
 * Trading: mirrors the existing leverage/assetClasses/margin block.
 * Trivia: category, questionCount, secondsPerQuestion, difficulty, etc.
 * Reason: Mixed keeps per-game settings out of the shared schema so adding
 * a game never requires a migration of this collection.
 */
gameConfig: {
  type: mongoose.Schema.Types.Mixed,
  default: {},
},
```

### Loosen (not replace)

`rules.rankingMethod` is currently an enum of six trading values. Trivia needs `score`, `score_then_time`, `accuracy`. Two options:

- **Recommended:** drop the `enum` constraint and validate against `module.rankingMethods()` in the service layer. Keeps the schema game-agnostic forever.
- Alternative: extend the enum with every game's methods. Rejected - the enum grows with each game and the model becomes a registry of things it should not know about.

Same treatment for `rules.tieBreaker1` / `tieBreaker2`.

### Leave alone

All existing trading fields (`startingCapital`, `assetClasses`, `allowedSymbols`, `leverage`, `maxPositionSize`, `maxOpenPositions`, `allowShortSelling`, `marginCallThreshold`, `marginSettings`, `riskLimits`, `rules.minimumTrades`, `rules.disqualifyOnLiquidation`). Trivia contests carry their schema defaults and ignore them.

Note on `startingCapital`: it has `min: 100` and `required: true`. A Trivia contest has no starting capital. Two choices - either keep sending the default (simplest, harmless) or relax `required` and give it a default of 0 guarded by `gameType`. **Recommendation: keep the default and ignore the field**, because relaxing a `required` on a field that trading validation depends on is a bigger change than it looks.

### New index

```ts
CompetitionSchema.index({ gameType: 1, status: 1, startTime: -1 });
```

Existing indexes on `{ status, startTime }` etc. stay. This one serves the "list active Trivia contests" query and the game-filtered admin list.

### Also worth doing while here

`competitionType` / `goalConfig` are dead schema (no server logic; `competitionType` is hard-coded to `time_based` on create). Either implement or mark clearly as unused with a comment. Do **not** build the game abstraction on top of `competitionType` - it is a different concept (time vs goal based) and reusing it for game type would be a modelling error.

---

## 2. Competition participant model

`database/models/trading/competition-participant.model.ts` + admin mirror

### Add

```ts
/**
 * Canonical ranking currency for ALL game types.
 * Trading writes its configured metric here on update/settle;
 * Trivia writes quiz points. Cross-game leaderboards sort on this.
 */
score: { type: Number, required: true, default: 0, index: true },

/** Human-readable breakdown for UI, e.g. { correct: 8, wrong: 2, bonus: 150 }. */
scoreBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },

/**
 * Normalised 0-1000 points for cross-game comparison and platform points.
 * Written at settlement only. See 04-scoring-points-leaderboards.md.
 */
normalizedPoints: { type: Number, default: 0 },

/** Game-specific in-progress state owned by the module. */
gameState: { type: mongoose.Schema.Types.Mixed, default: {} },

/** Denormalised from the contest so participant queries don't need a join. */
gameType: { type: String, default: "trading", index: true },

/** Tie-breaker for speed-based games: ms from contest start to completion. */
completionTimeMs: { type: Number, default: null },
```

### Status enum - extend

Current: `active | liquidated | completed | disqualified | refunded`.

Add `forfeited` for non-trading games where a player abandons (Trivia: never started, or timed out on every question). Do **not** overload `liquidated`, which carries trading meaning throughout the code and drives `disqualifyOnLiquidation`.

### New indexes

```ts
CompetitionParticipantSchema.index({ competitionId: 1, score: -1 });
CompetitionParticipantSchema.index({ userId: 1, gameType: 1, status: 1 });
```

The first replaces the role of `{ competitionId, pnl: -1 }` for non-trading games. Keep the `pnl` index for trading.

---

## 3. Challenge + challenge participant

Same additions as sections 1 and 2, applied to `challenge.model.ts` and `challenge-participant.model.ts` plus their admin mirrors.

Extra consideration: `ChallengeSettings` (`database/models/trading/challenge-settings.model.ts`) is a **singleton of trading-flavoured defaults** (`defaultAssetClasses`, starting capital bounds, `challengesEnabled`). For multi-game challenges this should become per-game-type settings. Recommended minimal change:

```ts
/** Per-game-type challenge defaults keyed by gameType. */
gameTypeDefaults: { type: mongoose.Schema.Types.Mixed, default: {} },
/** Which game types may be used for 1v1 challenges. */
enabledChallengeGameTypes: { type: [String], default: ["trading"] },
```

Leave the existing top-level trading fields as the trading defaults so nothing breaks.

---

## 4. WhiteLabel (feature flags)

`database/models/whitelabel.model.ts` + admin mirror + `whitelabel.model.d.ts`

```ts
/** Master switch for the trading vertical. */
tradingEnabled: { type: Boolean, default: true },

/** Which game modules are available platform-wide. */
enabledGameTypes: { type: [String], default: ["trading"] },

/** Optional wording overrides - see 09-terminology-wording-plan.md. */
terminologyOverrides: { type: mongoose.Schema.Types.Mixed, default: {} },
```

Then follow the `arenaEnabled` trail exactly - these are the same 8 files:

1. `database/models/whitelabel.model.ts` - field
2. `apps/admin/database/models/whitelabel.model.ts` - field
3. `database/models/whitelabel.model.d.ts` - type
4. `app/api/settings/route.ts` - expose to the client
5. `apps/admin/app/api/environment/route.ts` - read/write
6. `apps/admin/components/admin/EnvironmentSection.tsx` - toggle UI
7. `components/UserSidebar.tsx` - nav visibility
8. consumer guards (`app/arena/layout.tsx` is arena's; ours are the trading routes)

Also register the keys in `lib/services/settings.service.ts` and its admin mirror if they should be settable via environment, following the `IP_INTELLIGENCE_API_KEY` precedent.

---

## 5. New models for Trivia

Full spec in `10-trivia-module-spec.md`. Summary of new collections:

| Model | File | Purpose |
|---|---|---|
| `TriviaQuestion` | `database/models/games/trivia/trivia-question.model.ts` | Question bank: prompt, options, correct index, category, difficulty, explanation, media, active flag, usage stats |
| `TriviaCategory` | `database/models/games/trivia/trivia-category.model.ts` | Category/topic taxonomy |
| `TriviaContestSet` | `database/models/games/trivia/trivia-contest-set.model.ts` | The **locked** question list for one contest, generated at start. Critical for fairness and for reproducible settlement. |
| `TriviaAnswer` | `database/models/games/trivia/trivia-answer.model.ts` | One row per participant per question: chosen index, correct, elapsed ms, awarded points, server receive time |

Design notes that matter:

- **Never store the correct answer in any client-facing payload.** The question API returns prompt + options only; grading is server-side against `TriviaQuestion`. This is the direct analogue of not trusting client prices in trading.
- `TriviaAnswer` needs a **unique compound index** on `{ contestId, userId, questionId }` to make answer submission idempotent and prevent double-scoring on retry or double-click.
- Put a `TriviaContestSet` per contest rather than picking questions on the fly, so that (a) all players get the same set, (b) settlement can be recomputed deterministically, (c) an admin can audit a disputed result.
- Consider a TTL or archival policy on `TriviaAnswer` - it grows at participants x questions per contest.

Place these under `database/models/games/<gameType>/` rather than `database/models/trading/` so the directory structure stops implying trading. Mirror to `apps/admin/database/models/games/trivia/` only for the models the admin actually reads (question bank and category - the admin needs CRUD; answers only for dispute investigation).

---

## 6. Badge config - scope badges to games

`database/models/badge-config.model.ts` + admin mirror

```ts
/**
 * Which game types this badge applies to. Empty array = all games.
 * Legacy badges backfill to ["trading"].
 */
gameTypes: { type: [String], default: [] },
```

Rationale: "Trading Machine - 1000 trades" must not be offered to a Trivia-only player as an unreachable goal, and "Perfect Round" must not appear for traders. Without this field the badge list becomes noise for every player as games are added.

Also add to the badge **category** enum: `Knowledge` (Trivia-style), and a neutral `Participation`. Keep all existing categories.

---

## 7. User level / titles

`database/models/user-level.model.ts` + admin mirror

`currentTitle` defaults to `"Novice Trader"`. Two changes:

```ts
/** Per-game-type progression, so a player can be Level 12 in Trivia and 4 in Trading. */
gameLevels: { type: mongoose.Schema.Types.Mixed, default: {} },
// shape: { trading: { xp, level, title }, trivia: { xp, level, title } }
```

Keep `currentXP` / `currentLevel` / `currentTitle` as the **account-wide** level (sum of all games) so nothing that reads them breaks. `gameLevels` is additive detail.

Titles themselves move to the terminology layer / `XPConfig` DB overrides rather than being hard-coded in `lib/constants/levels.ts`. See `06` and `09`.

---

## 8. Wallet transaction - naming

The enum has 22 values including `competition_entry`, `competition_win`, `competition_refund`, `challenge_entry`, `challenge_win`, `challenge_refund`.

**Recommendation: do not rename these.** Reasons:

- They are written into historical rows; renaming requires a data migration of the ledger, which is the one collection where a botched migration is unrecoverable for accounting and possibly for tax/audit purposes.
- The admin financial dashboard, reconciliation service, Atlas refund logic and export routes all filter on these strings.
- They describe the **contest kind** (competition vs challenge), which remains accurate for all games. A Trivia competition still produces `competition_entry`.

Instead, add the game dimension as metadata:

```ts
/** Which game the contest was, for financial reporting by vertical. */
gameType: { type: String, default: null, index: true },
```

Plus, while here, fix an existing inconsistency: the two join paths write the contest reference to **different fields** (`referenceId` vs `competitionId`). The consolidated entry service must write both consistently, or the field must be unified. Decided and done in Stage 0.

Leave `challenge_refund` in the enum. Either implement it (active-challenge cancellation) or add a comment recording that it is reserved - listed as an optional adjacent fix in Stage 0.

Wallet counters (`totalSpentOnCompetitions`, `totalWonFromCompetitions`) likewise stay - they aggregate by contest kind, not game.

---

## 9. Notification templates

`database/models/notification-template.model.ts`, seeded by `lib/services/notification-seed.service.ts`.

The competition/challenge lifecycle templates (`competition_joined`, `competition_started`, `competition_won`, `competition_podium`, `competition_cancelled`, `challenge_*`) are **game-neutral in meaning** but trading-worded in body text.

Plan:
- Keep the type keys.
- Make the bodies use terminology tokens (see `09`) so a Trivia win reads correctly.
- Add per-game-type template overrides: an optional `gameType` field so a template can be specialised, falling back to the generic one. Same pattern as email templates.
- The trading-only types (`order_placed`, `position_opened`, `margin_warning`, `margin_call`, `liquidation`, `stop_loss_triggered`, `take_profit_triggered`) stay trading-only and simply never fire for Trivia.

Note the audit found `competition_refunded` is only sent from the **admin** notification service, not from the main cancel path - worth fixing while in this area.

---

## 10. Journey milestone conditions

`lib/constants/milestone-condition-types.ts` (+ admin mirror) is a vocabulary of ~12 categories, heavily trading (`total_trades`, `open_positions`, `forex_trades`, `max_drawdown`).

Add a `gameType` dimension to condition definitions and a set of generic conditions that work for any game:

- `contests_entered`, `contests_completed`, `contests_won`, `podium_finishes`
- `total_score`, `best_score`, `best_rank`
- `points_earned`, `days_active`, `win_streak_contests`

Plus Trivia-specific: `questions_answered`, `correct_answers`, `accuracy_percent`, `perfect_rounds`, `fastest_answer_ms`, `category_mastery`.

Existing trading conditions keep working unchanged.

---

## 11. Summary table of all schema changes

| Model | Change | Breaking? |
|---|---|---|
| `Competition` | +`gameType`, +`gameConfig`, loosen `rules.rankingMethod` enum, +index | No |
| `CompetitionParticipant` | +`score`, +`scoreBreakdown`, +`normalizedPoints`, +`gameState`, +`gameType`, +`completionTimeMs`, +`forfeited` status, +2 indexes | No |
| `Challenge` | same as Competition | No |
| `ChallengeParticipant` | same as CompetitionParticipant | No |
| `ChallengeSettings` | +`gameTypeDefaults`, +`enabledChallengeGameTypes` | No |
| `WhiteLabel` | +`tradingEnabled`, +`enabledGameTypes`, +`terminologyOverrides` | No |
| `BadgeConfig` | +`gameTypes`, +2 categories | No |
| `UserLevel` | +`gameLevels` | No |
| `WalletTransaction` | +`gameType` metadata only | No |
| `NotificationTemplate` | +optional `gameType` for overrides | No |
| **New** | 4 Trivia collections | No |

**Zero breaking changes.** Every existing document remains valid. The only backfill needed is cosmetic (setting `gameType: "trading"` on existing rows so queries can filter without a `$exists` check) and can be done lazily - see `13`.
