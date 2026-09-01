# 13 - User UI, Routes and Navigation (part of X7)

`09` section E6 covers the provider-specific player screens: the iframe host page, the
result screen, practice mode. This chapter covers the rest of the user-facing surface -
**37 routes** today, all of it written around trading.

The single most important fact in this chapter: **all trading providers are correctly
scoped to two `/trade` pages already.** That is why this work is tractable.

---

## 1. Routing

### Today

```
/competitions                       list
/competitions/[id]                  lobby
/competitions/[id]/trade            GAMEPLAY  <- trading terminal
/competitions/[id]/results          results
/challenges/[id]/trade              GAMEPLAY  <- trading terminal
```

### Target

```
/competitions/[id]/play             GAMEPLAY DISPATCHER  <- new
/competitions/[id]/trade            redirect to /play
/challenges/[id]/play               GAMEPLAY DISPATCHER  <- new
/games                              catalogue            <- see 16
/games/[slug]                       one game's page      <- see 16
```

**Keep `/trade` as a redirect, permanently.** It is linked from notification templates,
emails, the help centre, and every bookmark a player has made.

### The play dispatcher

`/play/page.tsx` resolves the contest, looks up the module, and renders that module's
gameplay component:

| Game type | Renders |
|---|---|
| `trading` | `<TradingGameplay />` - the existing `TradingPageContent` plus its six providers |
| `provider` | `<ProviderGameplay />` - the iframe host from `09` E6 |

---

## 2. Provider scoping - the mistake that must not be made

Six React context providers are mounted on the two trade pages today:

`PriceProvider`, `SymbolConfigProvider`, `ChartSymbolProvider`,
`TradingArsenalProvider`, `PositionEventsProvider`, `TradingModeProvider`

**They must be mounted inside the trading branch of the dispatcher, never in a shared
`/play` layout.** Hoisting them to a shared layout would open a price-feed subscription
and a position-event stream for every player in a chess contest. This is risk **R18** in
`17`, and it is the most likely way to accidentally make provider contests expensive and
slow.

These stay mounted globally and are unaffected: `AppSettingsProvider`,
`FingerprintProvider`, `GlobalPresenceTracker`, `ChallengePopup`, `AnnouncementBanner`.

---

## 3. Shared components versus trading components

`components/trading/` holds **63 files**. Roughly 40 are genuinely trading-only - charts,
order entry, positions, market watch, indicators. Roughly 20 are the **contest shell**,
which every game needs and which is currently misfiled.

**Move to `components/contest/`:** `CompetitionCard`, `ChallengeCard`,
`CompetitionLeaderboard`, `LiveRankingPanel`, `CompetitionInfoHeader`,
`ChallengeInfoHeader`, `CompetitionEntryButton`, `ChallengeEntryActions`,
`LiveCountdown`, `InlineCountdown`, `UTCClock`, `CompetitionStatusMonitor`,
`ChallengeStatusMonitor`, `ParticipantStatusMonitor`, `CompetitionStatusWrapper`,
`WalletContent`, `DepositModal`, `WithdrawalModal`, `WalletBalanceDisplay`.

Do this as a **standalone commit with no logic changes**, so that if an import breaks it
is obvious what caused it - risk **R19**.

---

## 4. Contest lists, cards and the lobby

| Surface | Change |
|---|---|
| Cards | Game badge, game artwork, provider-neutral labels. No provider branding - the player sees a ChartVolt game |
| List filters | Filter by game; retain sort by start time and pot size |
| Lobby - `app/(root)/competitions/[id]/page.tsx` | Rules from the game's catalogue entry, a **Play** button instead of Enter Terminal, the play window and grace period, attempts used and remaining |
| Ranking labels | `lib/services/ranking-config.service.ts` - per-game labels, so a chess contest does not say "PnL" |

For provider contests the lobby must show three things the trading lobby never needed:
**when the play window opens and closes**, **how many attempts remain**, and **what
happens if a round does not finish**. Players will hit all three, and a lobby that does
not answer them generates support tickets.

---

## 5. Dashboard

`components/dashboard/` is about **15 components** backed by
`comprehensive-dashboard.actions.ts`, a single action of roughly **1,700 lines**.

| Change | Note |
|---|---|
| Split the mega-action into per-section loaders | Risk **R21**. Do it because trading data must not be fetched for a player who has never traded |
| Hide the trading section entirely when `tradingEnabled === false` | Not an empty panel - absent |
| Hide the trading section for a player with no trading history | Their dashboard should be about the games they play |
| Add per-game summary cards | Contests entered, best finish, current rating per game |

**A player who only plays provider games must never see an empty trading panel.** In the
external-only scenario this is the majority of new players, not an edge case.

---

## 6. Results page

`app/(root)/competitions/[id]/results/page.tsx`.

| Change | Note |
|---|---|
| Dispatch the performance breakdown to the module | Trading shows trades and PnL; a provider game shows the generic `scoreBreakdown` from `01` |
| Show the replay link where the provider supplies one | This is what support quotes when a player disputes a prize - `06` |
| Handle unresolved rounds honestly | If a round never reported, say so and say what the policy did. Silence here reads as theft |

---

## 7. Leaderboard

`app/(root)/leaderboard/page.tsx` with `LeaderboardClient.tsx` and
`LeaderboardContent.tsx`. Today the global leaderboard is computed by
`lib/actions/leaderboard/global-leaderboard.actions.ts`: an `overallScore` formula with
**nine terms, five of them trading-specific**, roughly **7 seconds** to rebuild, cached
**5 minutes**, capped at **5,000 users**.

| Change | Note |
|---|---|
| Back it with `UserGameStats` | Per-game rows plus an `"_overall"` rollup - `04` |
| Tabs: Overall, per game, seasonal | Per `05` |
| Per-game rating column | Provider games support a per-game skill rating - `05` |

**Run the new and old leaderboards in parallel and diff the top 100 before switching.**
Players notice rank changes immediately and read them as unfair - risk **R14**.

---

## 8. Arena

`/arena` is a spectator broadcast of live trading, gated on `arenaEnabled` plus
`redirectIfRestricted("trade")`.

**Leave it trading-only.** Add a `tradingEnabled` check so it disappears with the rest of
trading. A spectator broadcast of a provider game is a genuinely good idea and entirely
new work with no dependency on this programme - and in the external-only scenario it
would also depend on the provider exposing live round state, which `01` does not require.

---

## 9. Help and static content

`app/(root)/help/page-content.tsx` is roughly **10,700 lines**.

| Change | Note |
|---|---|
| Restructure into per-game sections | Do **not** rewrite the trading guide - it is correct and valuable |
| Add a games section | How a provider contest works, play windows, attempts, what happens if a round fails |
| `/api/help-settings` | Reads `TradingRiskSettings`. **Must not fail when trading is disabled** |
| Legal pages - `SitePage`, seeded from `lib/constants/default-pages.ts` | Legal review track, not a wording pass - risk **R11** |

The help article on **what happens when a round does not finish** carries real weight
here. With an in-house game, failures are rare and ours. With a provider, they are
someone else's and will happen. Explaining the policy in advance is far cheaper than
arguing it afterwards.

---

## 10. Navigation and landing

| Surface | Change |
|---|---|
| `components/UserSidebar.tsx` | Rename the "Trading" section via a terminology token (`14`). Add **Games**. Gate Marketplace and Live Arena on trading |
| `MobileBottomNav.tsx` - **7 tabs** | Games replaces or joins the trading entry, per `16` |
| `/api/settings` | Already carries `arenaEnabled`. Extend with `tradingEnabled`, `enabledGameTypes`, `externalGamesEnabled` |
| Landing - `HeroSettings`, `LiveCompetitions`, `LiveChallenges`, `LiveStatsBar` | Game-neutral copy; `lib/constants/landing-page-templates-*.ts` has ~**230** trading matches |

---

## 11. Realtime during play

A provider round runs inside an iframe, so ChartVolt does not own the in-round loop. Two
things still need updating live: **the contest leaderboard** and **the player's own
round status**.

| Approach | Verdict |
|---|---|
| Poll a contest state endpoint every 2-5 seconds | **Recommended.** Simple, and provider callbacks arrive at unpredictable intervals anyway |
| Reuse the websocket server on port **3003** | Later, if polling load justifies it |
| Server-sent events, following the `PositionEventsProvider` precedent | Viable middle ground |

Start with polling. Provider scores arrive by webhook, not continuously, so a live
push channel adds infrastructure for very little perceived gain.

---

## 12. Effort

| Task | Estimate |
|---|---|
| `/play` dispatcher, `/trade` redirect, provider scoping | 3 days |
| Move shared components to `components/contest/` | 2 days |
| Game badges and filters on lists and cards | 2 days |
| Lobby game-awareness - windows, attempts, rules | 3 days |
| Dashboard restructure and mega-action split | 5 days |
| Leaderboard tabs on `UserGameStats`, parallel diff | 4 days |
| Results page dispatch, replay link, unresolved handling | 3 days |
| Navigation and conditional visibility | 2 days |
| Help restructure and the round-failure article | 4 days |
| Landing and marketing copy | 2 days |
| **Total** | **~30 days (~6 weeks)** |

Split across **X7** and **X8**; the provider-specific play and result screens from
`09` E6 are counted separately.

---

## 13. Acceptance criteria

- [ ] A player can browse, join, play and collect prizes for a provider game **without
      seeing a trading screen**
- [ ] The six trading providers do **not** mount for a provider contest - verified in the
      browser, not assumed
- [ ] `/trade` still resolves for every existing link
- [ ] A player with no trading history sees no trading panel anywhere
- [ ] `tradingEnabled = false` produces a coherent product with no dead links and no
      empty panels
- [ ] The leaderboard top 100 is unchanged on the day of the switch
- [ ] Help explains play windows, attempts and unresolved rounds before a player meets
      them
