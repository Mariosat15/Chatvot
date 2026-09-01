# 14 - Implementation Phases and Checklist

The build order for the **New Games Plan**. Each phase is independently shippable and reversible.

---

## STAGE 0 - Prerequisite fixes (SEPARATE DELIVERY - NOT PART OF THIS PLAN)

Stage 0 is specified in full in **`00a-STAGE-0-prerequisite-fixes-DO-FIRST.md`**. It is a standalone piece of work covering two pre-existing defects:

1. **Four competition entry paths that disagree** on security checks and on whether the entry fee is added to the prize pool - plus the challenge *accept* path, which skips account restrictions and the fraud gate on a route real players use.
2. **Admin/player model mirrors that have already drifted** - 10 of 75 mirrored pairs confirmed out of sync today, one of them bidirectionally.

**Estimate: 6 to 9 working days, after the test-database decision. No user-visible change.**

A third item, **Prerequisite A**, was found while re-verifying the above on 1 September 2026 and **shipped the same day** (commit `d5d3a328`): the `/api/simulator/*` routes accepted a plain request header as authentication in production, allowing an unauthenticated caller to credit any wallet. See the Stage 0 document.

**Recommended order: Defect 2 first.** It is lower risk and self-contained, and it puts the mirror guard in place before Defect 1 edits the admin copy of the entry path.

### The gate

```
STAGE 0 built  ->  deployed  ->  OWNER TESTS IT  ->  OWNER SIGNS OFF  ->  then P1 begins
```

**Phase P1 below does not start until the owner has confirmed both Stage 0 fixes work in production.** The sign-off checklist is at the end of the Stage 0 document.

Why the gate exists: P1 introduces `gameType`, the field that decides whether a contest gets trading settlement or trivia settlement. If the model mirrors can still drift, that field can be silently erased by an admin save, and an unlabelled contest gets trading settlement - which pays prize money to the wrong players with no error. And P1 onwards adds new ways to join a contest, which must not be built on top of a join path that already disagrees with itself about money.

---

## P1 - Foundation (2 to 3 weeks)

**Goal:** the game abstraction exists and trading runs through it with identical behaviour.

### Schema (both apps, same commit each)
- [ ] `Competition` + `Challenge`: `gameType`, `gameConfig`, loosen `rankingMethod` enum, new index
- [ ] `CompetitionParticipant` + `ChallengeParticipant`: `score`, `scoreBreakdown`, `normalizedPoints`, `gameState`, `gameType`, `completionTimeMs`, `forfeited` status, indexes
- [ ] `WhiteLabel`: `tradingEnabled`, `enabledGameTypes`, `terminologyOverrides` (+ `.d.ts`)
- [ ] `BadgeConfig`: `gameTypes` (early, to avoid a second backfill later)
- [ ] `UserLevel`: `gameLevels`
- [ ] `WalletTransaction`: `gameType` metadata
- [ ] `ChallengeSettings`: `gameTypeDefaults`, `enabledChallengeGameTypes`
- [ ] Run backfills 1 and 3

### Registry and contract
- [ ] `lib/games/types.ts` - the `GameModule` contract
- [ ] `lib/games/registry.ts` + `index.ts` - `getGameModule`, `listGameModules`, `assertGameEnabled`
- [ ] Mirror to `apps/admin/lib/games/`
- [ ] ESLint `no-restricted-imports` enforcing invariant 1 from `02` section 9

### Trading module (behaviour-preserving)
- [ ] `lib/games/trading/scoring.ts` - the six ranking descriptors, moved not rewritten
- [ ] `lib/games/trading/settle.ts` - **pure move** of the position-closing/reconciliation block out of `competition-end.actions.ts`
- [ ] `lib/games/trading/config.ts` - trading `gameConfig` schema + defaults
- [ ] `lib/games/trading/index.ts` - the module

### Seams
- [ ] `getRankingValue()` delegates to the module (seam 1)
- [ ] `contest-utils.ts` returns `gameType` + `gameConfig` (seam 5)
- [ ] Finalizer dispatches `module.settleContest()` before ranking (seam 3)
- [ ] Defence-in-depth assertion: trading settle refuses non-trading contests
- [ ] Entry service calls `module.onParticipantJoin()` (seam 4)
- [ ] Market-hours checks gated on `capabilities.needsMarketHours` (risk R10)
- [ ] Remove the duplicated challenge winner logic; use the shared path
- [ ] GM route explicitly sets `gameType` (risk R7)
- [ ] Audit **all five** finalization trigger paths (worker, lazy read, force-finalize, emergency-cancel, challenge job)
- [ ] Delete or fence the dead Inngest cron definitions, if not already done as an optional adjacent fix in Stage 0 (risk R5)

**Exit criteria:** Stage 0 signed off by the owner; Tier 2 regression test proves historical competition rankings are byte-identical; all Stage 0 money tests still green; the go/no-go gate in `12` is satisfied.

---

## P2 - Trivia module (2 to 3 weeks)

- [ ] Four Trivia models + indexes (unique `{contestId,userId,questionId}`) + admin mirrors
- [ ] `lib/games/trivia/*` implementing the contract
- [ ] Question selection with difficulty mix + `timesServed` rotation
- [ ] `TriviaContestSet` generation in `onContestStart`, with cancel-and-refund on insufficient bank
- [ ] `validateConfig()` checks bank availability at **creation** time
- [ ] Gameplay API: `state`, `start`, `answer` with all guards
- [ ] Server-side timing only (`servedAt` / `answeredAt`)
- [ ] Idempotent settlement recomputing from `TriviaAnswer`
- [ ] `checkEarlyEnd` when all participants finished
- [ ] Gameplay UI components under `components/games/trivia/`
- [ ] `/play` dispatcher; `/trade` kept as a redirect
- [ ] Providers mounted **inside** the trading branch only (risk R18)
- [ ] Move shared shell components to `components/contest/` (standalone commit, risk R19)
- [ ] Extend fraud throttle + coordination/behavioural analysis to all game types (risk R9)
- [ ] Game-aware notification URLs (risk R23)
- [ ] Tier 4 tests

**Exit criteria:** a Trivia contest can be created, played, finalized and paid in staging, with no trading code executed and no price request made.

---

## P3 - Admin (1.5 to 2 weeks)

- [ ] Nav restructure: COMPETITIONS / TRADING / TRIVIA groups with conditional visibility
- [ ] Add all new section IDs to `ADMIN_SECTIONS`; fix the eight existing omissions (risk R22)
- [ ] Game type picker as step 1 of the create wizard
- [ ] Dynamic game-config step (per-module admin components)
- [ ] `gameType` immutable after participants exist (UI + server)
- [ ] Edit-form parity with create
- [ ] Game column + filter on contest lists; module-declared detail columns
- [ ] Game Types registry section with per-game metrics and a safe-disable warning
- [ ] Trivia Question Bank: CRUD, bulk import, duplicate detection, per-question stats, AI review queue
- [ ] Trivia Categories + Trivia Settings
- [ ] Emergency-cancel and adjust-results made game-aware
- [ ] `PointsSettings` admin section for the `04` constants
- [ ] Market-hours settings scoped to games needing them

**Exit criteria:** a Trivia contest can be created and managed entirely through the admin UI by a non-super-admin employee with the right role.

---

## P4 - Points, leaderboards, gamification (2 to 3 weeks)

- [ ] `UserGameStats` model + indexes
- [ ] `normalizedPoints` formula (constants from settings) written at settlement
- [ ] Per-game Elo rating update at settlement
- [ ] Backfill 4 (offline, idempotent, chronological)
- [ ] Leaderboard reads from `UserGameStats`; run in parallel and diff top 100 (risk R14)
- [ ] Leaderboard UI tabs: Overall / per game, Season / All-time
- [ ] Optional: `Season` model and reset
- [ ] `liveScore()` optional contract method; live-ranking route uses it
- [ ] Module `statDescriptors()`; dashboard renders per-game sections
- [ ] Split `comprehensive-dashboard.actions.ts` (risk R21)
- [ ] Results page game-aware + Trivia answer review
- [ ] XP: module-declared `xpEvents()`; contest-level awards moved to the shared engine
- [ ] Reclassify generic badges to `gameTypes: []`; add Trivia badges; new categories
- [ ] Invert badge evaluation to compose per-module stats and conditions
- [ ] Generalise rarity gates from trades to contests
- [ ] Neutral level titles via `XPConfig` (data change)
- [ ] Journey: generic + Trivia condition types; game-neutral onboarding map; per-game branches
- [ ] Matchmaking per game using per-game rating
- [ ] Badge worker job extended to all game types

**Exit criteria:** a Trivia-only player has a coherent profile, leaderboard position, badges, XP and journey; a trading-only player sees no change.

---

## P5 - Terminology, UI shell, flags (1.5 to 2 weeks)

- [ ] `lib/constants/terminology.ts` + resolution (module -> DB -> default)
- [ ] `getTerms()` / `useTerms()` via the existing `AppSettingsProvider`
- [ ] Admin UI for `terminologyOverrides`
- [ ] Wording passes 1, 3, 4, 5, 6 (code, ~145 strings)
- [ ] Wording passes 2, 7, 8, 9 (admin data entry)
- [ ] Help centre restructure: game-agnostic core + per-game guides (keep trading content verbatim)
- [ ] Guard `/api/help-settings` against trading being disabled
- [ ] Landing/hero copy + neutral template set
- [ ] `tradingEnabled` enforcement at all points in `11` section 1
- [ ] Price streamer gating: `tradingEnabled || activeTradingContests > 0` (risk R17)
- [ ] Admin refuses to disable trading while trading contests are active
- [ ] Worker job game filters + flag short-circuits
- [ ] Arena gated on `tradingEnabled`
- [ ] Lint rule keeping the shared shell neutral
- [ ] Legal review track for ToS/risk disclaimer (risk R11) - **start early, runs in parallel**
- [ ] Tier 5 tests

**Exit criteria:** toggling `tradingEnabled` off in staging yields a coherent games-only platform; toggling it back restores trading fully.

---

## P6 - Hardening and launch (1 week)

- [ ] Tier 6 cross-app integrity tests
- [ ] Tier 7 load test (500-player Trivia contest)
- [ ] Observability signals from `11` section 7, including the payout-vs-pool alert
- [ ] Rollback rehearsal for each phase
- [ ] Internal Trivia contests with real small entry fees (rollout step 6)
- [ ] Public launch: free or low-fee first contest
- [ ] Update `README.md` and the admin wiki (there is an existing `AdminWikiSection` pattern to follow)

---

## P7 - Games-first navigation (~2 weeks)

Added 30 August 2026. Full detail in `15-platform-transformation-and-gaps.md` section 3.1. Deliberately last: a games catalogue containing one non-trading game advertises an empty platform.

- [ ] `GameCatalogueEntry` model, both apps, same commit (slug, gameType, gameKey, name, tagline, description, rulesSummary, howToPlay, artwork, category, defaultConfig, sortOrder, isFeatured, isVisible, isComingSoon, SEO fields)
- [ ] Seed one entry per shipped game type (trading, trivia)
- [ ] Admin catalogue section: CRUD, artwork upload, drag-reorder, feature/hide/coming-soon toggles, live preview. Kept **separate** from the technical Game Types screen in `07`
- [ ] `/games` route - catalogue grid, categories, featured, coming-soon
- [ ] `/games/[slug]` route - description, how to play, rules, live and upcoming contests for that game, per-game leaderboard, player's own record
- [ ] `/competitions` retained unchanged as the cross-game "what is open now" view
- [ ] Empty-state design for a game page with no live contests (upcoming, practice, notify-me, leaderboard) - this is the **normal** early state
- [ ] Visibility rules: hiding an entry removes it from discovery only; live contests keep running and stay reachable by direct link
- [ ] A disabled game module must automatically suppress its catalogue entries
- [ ] Coming-soon entries cannot be joined and must not leak into `/competitions`
- [ ] Tests: catalogue entry with no contests renders; hidden game does not cancel contests; disabled module hides entry; coming-soon cannot be joined

### Deferred, not scheduled

| Item | Estimate | Note |
|---|---|---|
| Per-game marketplace | ~2 weeks | Under the no-pay-to-win and no-random-packs rules in `15` section 3.2. Earns nothing until several games have a population |

**Game Masters were previously listed here at ~4 days. That was wrong and they are no
longer deferred** - see `15` section 5, corrected 30 Aug 2026. The real figure is
**~2.5 weeks**, distributed:

| Piece | Phase | Note |
|---|---|---|
| **Game label on both Game Master competition inserts** | **P1** | **A gate, not a task.** The route inserts with the raw MongoDB driver and stamps no game label, so the contest reads as trading and is settled by trading code - paying the wrong players. Risk R7 |
| `limits.allowedGameTypes`, default `["trading"]` | P1 | So no existing Game Master silently gains the ability to create contests for a game they have never seen |
| Admin-app finalization pays no Game Master earnings | P1 | A live defect, not caused by this project. `15` section 5 |
| Game Master creation API accepts a game and config | P4 | No trading field may be required |
| Game Master creation wizard: game picker plus dynamic settings | P4-P5 | **Reuse** the admin wizard components |
| Per-game earnings analytics, Game Master and admin | P4 | Alongside the rest of the analytics work |
| Tier wording | P5 | Database content, non-developer |

---

## Sequencing notes

**Can run in parallel:** the legal review (P5) should start at P1. Question bank content authoring can start as soon as the Trivia models exist (P2), by someone who is not a developer. Badge and journey content authoring (P4) likewise.

**Hard dependencies:** Stage 0 (signed off) -> P1 -> P2. Nothing else is order-critical. P3 can overlap P2 once the contract is stable. P4 and P5 can overlap each other.

**If time is short**, the minimum viable multi-game platform is **P1 + P2 + P3** (after Stage 0): a Trivia contest that can be created, played and paid. P4 (points/leaderboards/gamification) and P5 (wording/flags) improve the product but are not required for a first paid Trivia contest. Shipping in that order also means the riskiest work is done and validated earliest, which is the right risk profile.

**What not to do:** do not start P4's leaderboard migration before Trivia has produced real contest data - the points constants need real numbers to tune against, and migrating the leaderboard twice is wasteful.

---

## Total

| | Estimate |
|---|---|
| **Stage 0** (separate delivery, owner sign-off) | **5 - 8 working days** |
| **New Games Plan P1-P7, including Game Master work** | **14 - 19 weeks** |
| Minimum viable path (P1-P3, after Stage 0) | 8 - 10 weeks |
| Deferred: per-game marketplace | ~2 weeks, unscheduled |

For one experienced developer on this codebase, including testing.

**Revised 30 Aug 2026 from 12-17 weeks.** Game Master work was previously deferred at
~4 days; sized properly it is ~2.5 weeks and part of the programme, with its first piece a
gate inside P1. See `15` section 5.

**Be honest about the total.** Stage 0 plus P1-P7 plus the deferred marketplace is close to six months of one developer. That is the real cost of the full games-first platform. It does not have to be committed in one block - P1-P3 delivers a second game that can be played and paid for, which is a legitimate place to stop and check whether players actually play it before funding the rest. **Scope, not technical difficulty, is the main risk to this programme.**
