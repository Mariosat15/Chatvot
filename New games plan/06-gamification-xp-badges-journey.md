# 06 - Gamification: XP, Levels, Badges, Achievements, Journey

The gamification **infrastructure** is good and reusable. The **content** is trading-only. This document separates the two and plans the generalisation.

---

## 1. What exists and what it costs to generalise

| System | Infrastructure | Content | Verdict |
|---|---|---|---|
| XP ledger + level-up | `lib/services/xp-level.service.ts`, `UserLevel` model, `XPConfig` DB overrides | 20 titles, all "Trader" themed | Keep infra, replace titles |
| Badges | `BadgeConfig` DB + `UserBadge` + rarity tiers + XP award on unlock | ~100 badges, 40+ condition types, nearly all trading | Keep infra, scope + extend content |
| Achievement engine | `lib/services/badge-evaluation.service.ts` (`gatherUserStats` ~50 fields, `checkBadgeCondition` switch) | Trading conditions | Needs a per-game stats provider |
| Journey maps | `JourneyMapConfig`, `JourneyMilestone`, `UserJourneyProgress`, admin editor + wizard | 10-map trading sequence, trading condition vocabulary | Keep infra (already DB-driven), add conditions + maps |
| Rating / ELO | **Does not exist** | - | New, see `04` |

The single most important structural fact: **badges and journey maps are already database-driven with an admin editor.** That means most of the content work is data entry in the admin panel, not code. The code work is adding the *conditions* those systems can evaluate.

---

## 2. XP - making awards game-aware

### Current

`awardActivityXP()` awards for: trade completed (2), winning trade (+3), competition completed (25), podium 1st/2nd/3rd (50/35/20), challenge completed (15), challenge won (30). Daily cap of 100 XP applies to trade activity only.

### Target

Keep the contest-level events - they are already game-neutral. Replace only the trade-specific ones with module-declared events.

Add to the Game Module contract:

```ts
/** XP events this game can emit, with amounts and daily caps. */
xpEvents(): Array<{
  id: string;              // "trivia_question_correct"
  label: string;
  amount: number;
  dailyCap?: number;       // per-user per-day ceiling for this event
}>;
```

Trading declares `trade_completed` and `trade_won` (today's values, today's 100/day cap). Trivia declares `question_correct` (1 XP, cap 60/day), `perfect_round` (25), `category_cleared` (15).

The contest-level awards (`contest_completed`, `podium_1/2/3`, `challenge_won`) move to the **shared engine** and fire for every game, so a Trivia win progresses the account level exactly as a trading win does. This is what makes it feel like one platform.

### Per-game levels

Per `03`, `UserLevel` gains `gameLevels: { [gameType]: { xp, level, title } }` while `currentXP/currentLevel/currentTitle` remain the **account-wide** rollup so all existing readers keep working.

Display: account level is the headline ("Level 14"); per-game levels appear on the profile as a breakdown. A player can be "Trivia Level 9, Trading Level 3".

**Daily cap warning:** with multiple games each having its own cap, total daily XP rises with each game added. Either give the account an overall daily XP ceiling or scale per-game caps down as games are added, otherwise level progression inflates and the 20-level ladder is exhausted too quickly.

---

## 3. Level titles - the most visible wording change

All 20 titles are trader-named: "Novice Trader" -> "Junior Trader" -> ... -> "Trading God". Stored in `lib/constants/levels.ts` with `XPConfig` DB overrides and seeded from `data/defaults/xp_config.json`.

Since `XPConfig` **already** overrides the constants, this is a **data change, not a code change**. Recommended neutral ladder:

| Tier | Levels | Neutral titles |
|---|---|---|
| Beginner | 1-5 | Rookie, Challenger, Contender, Competitor, Rising Star |
| Intermediate | 6-10 | Skilled Player, Specialist, Veteran, Strategist, Elite Competitor |
| Advanced | 11-15 | Master, Grandmaster, Champion, Prodigy, Virtuoso |
| Elite | 16-20 | Legend, Titan, Icon, Immortal, ChartVolt Legend |

Optionally, per-game title flavour via `gameLevels[gameType].title` - "Trivia Grandmaster", "Trading Master" - while the account title stays neutral. This gives back the flavour that made "Trading God" fun without locking the platform to one vertical.

Do the swap through the admin XP config so it is reversible without a deploy.

---

## 4. Badges - scope, then extend

### Step 1: scope existing badges (prevents noise)

Add `gameTypes: string[]` to `BadgeConfig` (see `03`), backfill all existing badges to `["trading"]`, and treat `[]` as "all games".

Without this, every player sees ~100 trading badges regardless of what they play, most permanently unreachable. That actively de-motivates - an achievement list you cannot complete is worse than no list.

### Step 2: reclassify the genuinely generic ones

Some existing badges are already game-neutral in substance and should be moved to `gameTypes: []`:

- Competition-count badges ("Competition Legend - 50 entries")
- Podium/win-count badges
- Social badges
- Deposit/KYC/account badges
- Streak badges expressed in **contests** rather than trades

This immediately gives Trivia players a meaningful badge set on day one at zero content cost - a good example of the abstraction paying for itself.

### Step 3: extend the condition engine

`checkBadgeCondition()` is a switch over 40+ trading condition types fed by `gatherUserStats()`. Rather than growing one giant switch per game, invert it:

```ts
// The engine asks each module for its stats contribution.
interface GameModule {
  gatherStats?(userId: string): Promise<Record<string, number>>;
  badgeConditions?(): Array<{ id: string; label: string; evaluate: (stats) => boolean }>;
}
```

The engine composes: generic stats (contests, wins, podiums, points, rating, deposits, KYC, social) + per-module stats, then evaluates generic conditions + the conditions of whichever modules the user has played. Existing trading conditions move into the trading module unchanged.

This keeps `badge-evaluation.service.ts` from growing without bound as games are added - it is already large, and one switch per game would make it unmaintainable.

### Step 4: new categories

Add `Knowledge` and `Participation` to the category enum (keep all existing). Trivia badges: Perfect Round, Speed Demon (avg answer under Xs), Category Master, Comeback (win from last place at halfway), Streak Keeper, No Skips.

### Rarity gates

`RARITY_MIN_REQUIREMENTS` currently gates rare badges behind minimum trades/competitions. Generalise to minimum **contests** so a Trivia player can earn rare badges. Otherwise the rarity system is trading-only by accident.

---

## 5. Journey maps

### Good news

Already fully DB-driven: `JourneyMapConfig` (zones, themes, 10-map sequence), `JourneyMilestone`, `UserJourneyProgress`, with an admin **Journey Map Editor** and **Gamification Wizard**. The trading content in `lib/constants/journey-map-template.ts` and `journey-maps-sequence.ts` is **deprecated and not seeded** - the DB is the source of truth.

So the journey work is mostly: author new maps in the admin, plus add condition types.

### Condition vocabulary

`lib/constants/milestone-condition-types.ts` (+ admin mirror) needs the generic and Trivia conditions listed in `03` section 10. Existing trading conditions keep working.

### Recommended map structure for multi-game

- **Map 1 - Onboarding (game-neutral):** verify email, complete KYC, first deposit, join first contest, first podium. Works for everyone.
- **Maps 2+ - per game:** a trading branch and a trivia branch, unlocked by playing that game. `JourneyMapConfig` gains an optional `gameType` so the sequence service can present the right branch.
- Keep the existing 10-map trading sequence intact as the trading branch so current users lose no progress. This is important: users who are mid-journey must not be reset.

Also rename the default journey name from "Trader's Journey" to something neutral (the DB default and the help copy both say it), with per-branch names like "The Trading Path" and "The Knowledge Path".

### Migration caution

`UserJourneyProgress` holds live user progress. Any change to map structure must preserve completed milestone IDs. Adding maps and conditions is safe; **renumbering or renaming existing milestone IDs is not** - it would orphan completions and appear to users as lost progress. Treat milestone IDs as immutable, exactly like ledger enum values.

---

## 6. Achievements shown in the UI

Profile has tabs: Overview, Journey, Badges, Arsenal, Verification, Notifications, Settings (`ModernProfileTabs.tsx`).

Changes:
- **Badges tab:** group by game with a game filter; show locked badges only for games the user can play (respecting `enabledGameTypes`).
- **Overview tab:** replace hard-coded trading stat tiles with module-declared `statDescriptors()` per `04`.
- **Arsenal tab:** this is the "Trading Arsenal" marketplace (indicators, bots). It is genuinely trading-specific - keep it, but hide it when the user has no trading access or trading is disabled. Longer term the marketplace could sell per-game items (question packs, cosmetics), which is a natural revenue extension but out of scope here.
- **Journey tab:** show the branch for the game(s) played.

---

## 7. Notifications and level-ups

`notificationService.notifyLevelUp()` and badge-unlock notifications are game-neutral in mechanism. Their **copy** goes through the terminology layer (`09`). A Trivia player levelling up should not be congratulated as a trader.

---

## 8. Ordering within the project

Gamification is **P4**, deliberately after the Trivia module works end to end. Reasons:

1. Badges and journey milestones need real Trivia data to be authored meaningfully - you cannot sensibly set a "good accuracy" threshold before seeing what real players score.
2. None of it blocks a playable, payable contest. A Trivia contest can launch awarding contest-level XP only, with game-specific badges following.
3. It is the most content-heavy and least risky work, so it is the right thing to do while the core stabilises in production.

The one exception: **add `gameTypes` to `BadgeConfig` early** (in P1, with the other schema changes). It is a one-line schema change, and doing it late means a second backfill pass over badge data.

---

## 9. Acceptance criteria for this workstream

- A Trivia-only player sees a coherent profile: level, XP, points, rating, badges they can actually earn, and a journey with reachable milestones.
- A trading-only player sees **exactly** what they see today - no regressions, no new empty tiles, no lost journey progress.
- A player of both sees per-game breakdowns plus one account-level identity.
- Adding a third game requires: authoring badges/milestones in admin + implementing two optional module methods (`gatherStats`, `badgeConditions`). No edits to the evaluation engine.
