# 08 - User UI, Routes and Navigation

The user-facing surface is 37 routes with all trading providers correctly scoped to two `/trade` pages. That scoping is the reason this part is more tractable than the string counts suggest.

> **Extended by chapter 15 - read both.** This chapter plans a single `/competitions`
> list with a game filter and a game badge per card. The owner direction of 30 August
> 2026 goes further: players will browse **games first**, via a `/games` catalogue and a
> `/games/[slug]` page per game, with that game's contests shown on its own page.
> Everything in this chapter is still built - `15-platform-transformation-and-gaps.md`
> section 3.1 adds the discovery layer on top of it, in **P7, deliberately last**.
> `/competitions` is retained unchanged as the cross-game "what is open now" view.

---

## 1. Routing strategy

### Current

```
/competitions                       list
/competitions/[id]                  lobby
/competitions/[id]/trade            GAMEPLAY  <- trading terminal
/competitions/[id]/results          results
/challenges/[id]/trade              GAMEPLAY  <- trading terminal
```

### Target

Introduce a game-dispatching gameplay route and keep `/trade` working.

```
/competitions                       list (game filter, game badges on cards)
/competitions/[id]                  lobby (game-aware: rules, how-to-play, prize table)
/competitions/[id]/play             GAMEPLAY DISPATCHER  <- new
/competitions/[id]/trade            kept: redirects to /play for trading contests
/competitions/[id]/results          results (game-aware columns)
```

`/play/page.tsx` resolves the contest, reads `gameType`, and renders the module's gameplay component:

```
play/page.tsx
  contest = getContest(id)
  module  = getGameModule(contest.gameType)
  if (!enabled(contest.gameType)) -> friendly "unavailable" screen
  switch (contest.gameType)
    "trading" -> <TradingGameplay />   (existing TradingPageContent + its 6 providers)
    "trivia"  -> <TriviaGameplay />    (no price providers mounted)
```

**Why keep `/trade` as a redirect rather than deleting it:** it is linked from notification templates, emails, help content, bookmarks and possibly external marketing. Deleting it produces 404s in places nobody will think to check. A redirect costs nothing.

**Critical detail:** the trading providers (`PriceProvider`, `SymbolConfigProvider`, `ChartSymbolProvider`, `TradingArsenalProvider`, `PositionEventsProvider`, `TradingModeProvider`) must be mounted **inside** the trading branch, not in the `/play` layout. If they were hoisted to the shared layout, every Trivia player would start polling prices every 2 seconds - a pointless load increase and, in the client, an error risk. This is the single most important implementation note in this document.

---

## 2. Navigation

`components/UserSidebar.tsx`:

| Current | Change |
|---|---|
| Section header **"Trading"** | Rename to "Compete" or "Games" (via terminology token) |
| Competitions | Keep; label unchanged |
| 1v1 Challenges | Keep |
| Marketplace | Keep, but hide when trading disabled (it is the "Trading Arsenal") |
| Leaderboard | Keep; leads to game-tabbed leaderboard |
| Live Arena | Keep, gated by `arenaEnabled` **and** trading enabled (it is a trading broadcast) |
| Messages | Keep |
| Default user name fallback **"Trader"** | Change to "Player" |
| Level title from `/api/user/level`, default **"Trader"** | Use neutral titles per `06` |

Optionally add a **Games** entry listing available game types with an explanation of each - useful once there are 3+ games, unnecessary at 2.

`MobileBottomNav.tsx` (7 tabs) needs the same treatment: hide Market when trading is off.

Conditional visibility should read the same `/api/settings` payload that already carries `arenaEnabled`, extended with `tradingEnabled` and `enabledGameTypes`. One fetch, one source of truth.

---

## 3. Contest list and cards

`components/trading/CompetitionCard.tsx`, `ChallengeCard.tsx`:

- Add a **game badge** (icon + label) so users immediately see what kind of contest it is. Without this, a mixed list is confusing.
- Make the summary line module-declared: a trading card shows "Starting capital, max leverage"; a Trivia card shows "20 questions, General Knowledge, 15s each".
- Add a **game filter** on `/competitions` and `/challenges`.

`components/trading/` currently holds these shared shell components. As part of this work, move the game-agnostic ones to `components/contest/`:

Reusable (move): `CompetitionCard`, `ChallengeCard`, `CompetitionLeaderboard`, `LiveRankingPanel`, `CompetitionInfoHeader`, `ChallengeInfoHeader`, `CompetitionEntryButton`, `ChallengeEntryActions`, `LiveCountdown`, `InlineCountdown`, `UTCClock`, `CompetitionStatusMonitor`, `ChallengeStatusMonitor`, `ParticipantStatusMonitor`, `CompetitionStatusWrapper`, plus the wallet components (`WalletContent`, `DepositModal`, `WithdrawalModal`, `WalletBalanceDisplay`) which do not belong under `trading/` at all.

Trading-only (stay): the ~40 chart/order/position/market-watch/indicator components.

This is a **file move plus import updates**, mechanical but touching many files. Do it as its own commit with no logic changes so review is easy and `git log --follow` still works.

---

## 4. Lobby page

`app/(root)/competitions/[id]/page.tsx` shows rules, countdown, leaderboard and the entry button. Make it game-aware:

- **How to play** section rendered from the module (a Trivia player needs different instructions than a trader).
- Rules summary from `gameConfig` rather than hard-coded trading fields.
- Ranking method explained in game terms - the existing `lib/services/ranking-config.service.ts` already centralises ranking labels ("Highest P&L"), so extend that rather than adding a new mechanism.
- Prize table, countdown, participant list: unchanged, already generic.

---

## 5. Dashboard

`components/dashboard/` has ~15 components hard-coding trading metrics, fed by the ~1,700-line `comprehensive-dashboard.actions.ts`.

Target layout:

```
[ Header: credits balance | total points | overall rating | active contests ]   <- game-agnostic
[ Active contests: one card per contest, game-badged, with game-appropriate progress ]
[ Per-game sections, one per game the user has played:
    Trading:  today's tiles (PnL, equity curve, open positions, win rate, profit factor)
    Trivia:   contests played, best score, accuracy, correct answers, rating
]
[ Journey progress | recent badges | leaderboard position ]                    <- game-agnostic
```

Rules that keep this honest:
- A user who has never traded sees **no** trading section - not an empty one. Empty trading tiles on a Trivia player's dashboard is the most visible symptom of a half-done abstraction.
- When trading is disabled platform-wide, the trading section is hidden for everyone.
- Split `comprehensive-dashboard.actions.ts` per `04` section 6.

---

## 6. Results page

`app/(root)/competitions/[id]/results/page.tsx` shows final standings plus personal trade history.

- Standings columns from `module.statDescriptors()`.
- Personal detail section from the module: trading shows the trade list; Trivia shows a question-by-question review (your answer, correct answer, points, time taken) if `reviewAnswersAfterContest` is enabled.

The Trivia answer review is worth building properly - it is the main learning/engagement loop for a quiz game and cheap to add once `TriviaAnswer` rows exist.

---

## 7. Leaderboard page

`app/(root)/leaderboard/page.tsx` + `LeaderboardClient.tsx` + `LeaderboardContent.tsx` show columns P&L, ROI, Win Rate, Profit Factor, Competitions, Badges, Score.

Target: **tabbed by scope**.

```
[ Overall ] [ Trading ] [ Trivia ]        [ Season | All-time ]
```

- Overall tab: rank, player, level, total points, rating, contests, wins, badges - no trading columns.
- Per-game tabs: that game's declared columns (trading keeps exactly today's columns).
- Backed by `UserGameStats` per `04`, so it paginates instead of rebuilding.

`MatchmakingCards.tsx` uses trading stats to suggest opponents - extend to suggest per game, using per-game rating. Matchmaking on trading skill for a trivia challenge would be meaningless.

---

## 8. Arena

`/arena` is a spectator broadcast of live trading (price ticker, equity race, positions as chart bubbles), gated by `arenaEnabled` + `redirectIfRestricted("trade")`.

Recommendation: **leave Arena trading-only for now.** Gate it behind `tradingEnabled` as well as `arenaEnabled`. Building a Trivia broadcast view is a genuinely good product idea (live question, answer distribution, score race) but it is net-new UI with no dependency on the rest of this plan, so it should be its own project after Trivia proves out. Scope discipline matters more here than completeness.

Note the existing `redirectIfRestricted("trade")` call - once contests are multi-game, the restriction checked for a spectator page should arguably be a generic one. Minor, but worth fixing while in the file.

---

## 9. Help and static content

The largest single wording surface: `app/(root)/help/page-content.tsx` is ~10,700 lines of hard-coded JSX, plus a dedicated `/help/competitions` trading guide.

Strategy - **restructure rather than rewrite**:

1. Split help into a game-agnostic core (account, wallet, deposits, withdrawals, KYC, levels, badges, journey, fair play, support) and per-game guides.
2. Keep the existing trading content **verbatim** as the trading guide. It is good content; rewriting it risks introducing errors and burns time for no user benefit.
3. Add a Trivia guide as a new page.
4. Only the game-agnostic core needs de-trading, and it is a small fraction of the total.

Also: the help page pulls dynamic values from `/api/help-settings` (XP levels, margin/leverage limits, KYC flags). That endpoint reads `TradingRiskSettings` - it must not break when trading is disabled. Guard it.

Legal pages (`SitePage`, seeded from `lib/constants/default-pages.ts`) describe a "trading competition platform" in the Terms of Service. These are **contractual** and must go through legal review, not a text swap. Flagged in `12` as R11.

---

## 10. Landing and marketing

Already DB-composed from `HeroSettings` with a section registry, and section visibility toggles exist for competitions/challenges/leaderboard/marketplace. So this is largely **admin data entry**, not code.

Code-side changes:
- `LiveCompetitions` / `LiveChallenges` landing sections should show game badges and not assume trading.
- `LiveStatsBar` says "Traders" - terminology token.
- Landing template constants (`lib/constants/landing-page-templates-*.ts`, ~230 trading matches) are **fallback templates**. Add a neutral template set; leave the trading ones for the trading-focused campaign pages, which remain useful.
- Enterprise page ("Launch Your Own Trading Platform") is white-label sales copy - update to lead with the platform story. This aligns with the strategic review's B2B2C positioning, so it has value beyond this project.

---

## 11. Realtime providers - the load question

Confirmed current state: trading providers mount **only** on the two `/trade` pages. Globally mounted providers are `AppSettingsProvider`, `FingerprintProvider`, `GlobalPresenceTracker`, `ChallengePopup`, `AnnouncementBanner` - all game-neutral.

For Trivia gameplay, what is needed is a **timer and answer submission**, not a price stream. Options:

| Approach | Verdict |
|---|---|
| Polling `GET /api/games/trivia/[contestId]/state` every 1-2s | Simple, consistent with how the app already polls prices and rankings. **Recommended for v1.** |
| Reuse the existing websocket server (port 3003) for question push | Better UX for synchronised play, and the infrastructure already exists with JWT auth and subscribe patterns. Recommended for v2 or if synchronised contests are launched. |
| Server-Sent Events (there is a precedent - `PositionEventsProvider`) | Viable middle ground |

Start with polling. It is enough for asynchronous-play Trivia (each player plays their own timer within the contest window), which is also the easier product to launch and the easier one to keep fair.

---

## 12. Effort estimate

| Task | Estimate |
|---|---|
| `/play` dispatcher + `/trade` redirect + provider scoping | 3 days |
| Move shared components to `components/contest/` | 2 days |
| Game badges, filters on lists and cards | 2 days |
| Lobby game-awareness (how-to-play, rules from config) | 3 days |
| Dashboard restructure + split mega-action | 5 days |
| Leaderboard tabs on `UserGameStats` | 4 days |
| Results page game-awareness + Trivia answer review | 3 days |
| Nav + conditional visibility | 2 days |
| Help restructure (split, not rewrite) | 4 days |
| Landing/marketing adjustments | 2 days |
| **Total** | **~30 days (6 weeks)** across P2, P4 and P5 |
