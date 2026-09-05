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

## 1.1a What was built - the provider half of the dispatcher (5 Sep 2026)

**Status: the provider branch is code-complete. The trading branch is not, and the redirect
therefore runs the opposite way round from the target above.**

A player who has entered a provider contest can now start a round, play it in the frame, and see a
confirmed result, **by clicking**. Before this the whole play step was reachable by API and by test
only. 42 tests, 20 probes all red on the expected test.

### Files

| File | Role |
|---|---|
| `app/(root)/competitions/[id]/play/page.tsx` | The route. Reads state, renders the host. **Never launches a round.** |
| `components/games/ProviderRoundHost.tsx` | The state machine: preflight, launching, playing, confirming, settled |
| `components/games/ProviderGameFrame.tsx` | The iframe and the three checks on every inbound message |
| `components/games/provider-frame-messages.ts` | The four-message allowlist, the height clamp, the origin derivation. Model-free and framework-free |
| `components/games/RoundPreflight.tsx` | What a player is told before an attempt is spent |
| `components/games/RoundResultPanel.tsx` | The result, including the generic `scoreBreakdown` renderer |
| `components/games/play-state.ts` | The browser's copy of `PlayState`. Pinned field-for-field against the service |
| `lib/services/games/round-status.service.ts` | `getPlayState` - the caller's own attempts and rounds. **Not mirrored** |
| `app/api/competitions/[id]/rounds/route.ts` | Gained a `GET` beside the existing `POST` |

### The route is the one this chapter specifies, and it had to be corrected to get there

`09` E6 called it `/play/[contestId]`; this chapter called it `/competitions/[id]/play`. The build
follows this chapter. Getting it wrong would have meant renaming a URL players had bookmarked, or
running two play routes for ever.

**The redirect currently points outwards, which is the reverse of the target.** A trading contest
reaching `/play` is sent to `/trade`, not rendered here, because the trading branch needs
`TradingPageContent` and its six context providers moved - a change to the live trading path
carrying **R18** and **R19**. When X7 moves them, the redirect flips direction and no URL changes.
**No loop is possible in either arrangement**: the two guards are exact complements of
`isProviderContest`, and a test pins that, because an overlap produces an infinite redirect rather
than a wrong screen.

### Five things worth carrying

- **A GET must never consume an attempt, and a server component is a GET.** An attempt is spent
  when a round is *created*, deliberately, so a page that launched on render would burn a paying
  player's only attempt because **Next.js prefetches `<Link>` targets on hover**. The page renders
  a button; the POST happens on the click. This is the reason the play screen is a state machine
  rather than a redirect through the launch API, and it is easy to lose in a later "simplification".
- **The score has no route through the browser, which is stronger than remembering not to read
  one.** `ProviderFrameMessage` has no score field at all, so a `finished` message carrying
  `score`, `rawScore`, `points`, `prize` and `rank` yields an object with two keys. `finished`
  means "go ask the server", never "the player scored X". Proven behaviourally, not structurally.
- **The sandbox omission is the feature.** `allow-top-navigation` is absent, so a game cannot
  navigate the player's whole page away from ChartVolt - which a provider bug or a compromised game
  would otherwise do mid-contest, looking to the player exactly like our site crashing.
  `allow-popups` is absent for the same reason, matching the spec's "no external links out".
- **Three checks on every message, and the strongest is the one nobody writes first.**
  `event.source === frame.contentWindow` proves the message came from the window we opened and
  cannot be forged by an unrelated page; the origin check catches a frame that has navigated itself
  elsewhere; the allowlist catches the rest. The source check is silent because a page receives
  constant `postMessage` traffic from extensions and dev tools, while an origin mismatch on our own
  frame is logged, because that is a real integration fault.
- **"Resume" and "Play" are different promises.** Relaunching a live round returns the *same* round
  with a fresh launch URL, because `createRound` is idempotent on a live round - so resuming costs
  nothing. Labelling it "Play" would tell a player they were spending an attempt they are not, and
  some would decline and let a round expire instead.

### What it does not do

- **No live leaderboard during play** (section 11's polling recommendation is unimplemented). A
  player sees their standing when they return to the contest page.
- **No practice mode.** Needs `supportsPractice` and a free, unranked path.
- **No game-aware dashboard.** `ActiveCompetitionCard` and `CompetitionsTable` still render PnL,
  positions and recent trades and label the action "Trade Now". The `/trade` route redirects, so
  the *destination* is right, but the card is still trading-shaped. Deferred to the dashboard pass
  in section 5 rather than half-done, because it is a rewrite of components every trading player
  sees daily.
- **No CSP `frame-src` allowlist.** There is no Content-Security-Policy in `next.config.ts` at all,
  so adding one is a platform-wide change that would also have to account for the Nuvei payment
  flow and the tutorial embeds. There is also **nothing to allowlist yet** - `game_provider` stores
  `baseUrl`, the provider's *API* host, and the spec's own example puts play on a different
  subdomain, so the play domain is a fact we collect from a real provider at X4. Until then the
  message origin is derived from the launch URL we actually loaded, which is the check that
  matters. **Do not record this as done.**

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

## 7. Leaderboard, profile and cross-game stats

### 7.1 Leaderboard

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

### 7.2 The profile page

**Added 2 September 2026.** Until now the profile appeared in this plan only as
"terminology pass 6 - profile tabs and headings", which treats a structural change as a
labelling one. The owner's brief lists the profile alongside stats and the leaderboard,
and it is the screen where a player checks whether the platform has understood what they
did.

| Change | Note |
|---|---|
| A **cross-game summary** at the top | Contests entered, contests won, total winnings, level, XP. All defined for every game per `05` section 10 |
| A **per-game breakdown** below it | One row or card per game the player has actually played, with that game's own metrics and skill rating |
| Trading becomes **one entry** in that breakdown | Not the page. Its own metrics - PnL, win rate, trade count - live inside its card, where they are correctly scoped |
| Hide games the player has never played | An external-only platform may carry twenty titles. Twenty empty cards is not a profile |
| Badges and journey progress stay | Generalised per `05` section 10; a trading-only journey is gated on `tradingEnabled` |

**The naming problem is on this page more than anywhere else.** A profile header that reads
"Total Profit" is a trading metric presented as a life-time total. It has to become either
an explicitly trading-scoped figure inside the trading card, or a genuinely cross-game one
such as total winnings. Which of the two is open question 13; what is *not* open is that it
cannot stay ambiguous, because the number will be wrong for every player who plays anything
else - and it will be wrong silently, since the calculation keeps working.

**Two things to check before building it**, both of which decide the layout rather than
following from it:

1. **Open question 14 - does historical trading performance enter the cross-game
   aggregates?** If it does, long-standing traders dominate every rollup on a games
   platform. If it does not, their profile appears to lose history, which reads as a bug
   and generates support load. The answer belongs in `18`'s backfill, and this page is
   where players will see whichever answer was chosen.
2. **The public profile is a different surface.** `GET /api/user/profile/public` already
   exists and exposes a limited field set. Whatever is added to the private profile must
   be decided separately for the public one, or a per-game statistic leaks by default -
   which matters more once matchmaking (`20`) makes other players' profiles worth looking
   at.

### 7.3 Where the stats come from

`UserGameStats` is the single source for both surfaces - per-game rows plus an `"_overall"`
rollup (`04`). Two rules follow, and both exist because the alternative fails quietly:

- **The profile must not compute aggregates of its own.** If the profile derives a total
  its own way, it will disagree with the leaderboard, and the disagreement will be reported
  as a prize bug rather than a display bug.
- **Never present a rollup that only some games contribute to.** Either the rollup covers
  every game or it is labelled as covering one. `05` section 10 is the binding rule.

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
| **Profile: cross-game summary, per-game breakdown, trading demoted to one card** | **3 days** |
| Results page dispatch, replay link, unresolved handling | 3 days |
| Navigation and conditional visibility | 2 days |
| Help restructure and the round-failure article | 4 days |
| Landing and marketing copy | 2 days |
| **Total** | **~33 days (~6.5 weeks)** |

Split across **X7** and **X8**; the provider-specific play and result screens from
`09` E6 are counted separately.

---

## 13. Acceptance criteria

- [ ] A player can browse, join, play and collect prizes for a provider game **without
      seeing a trading screen** — **play and results done** (5 Sep 2026, s1.1a); browsing is
      not, so the contest is still found in the trading-shaped `/competitions` list
- [ ] The six trading providers do **not** mount for a provider contest - verified in the
      browser, not assumed — **structurally true** since `/competitions/[id]/play` is a
      separate route that mounts none of them, but **not yet verified in a browser**, which is
      the half of this criterion that catches a provider hoisted into a shared layout
- [x] `/trade` still resolves for every existing link — it renders trading as before and
      redirects **only** a provider contest, which nothing could previously reach through it
- [ ] A player with no trading history sees no trading panel anywhere
- [ ] `tradingEnabled = false` produces a coherent product with no dead links and no
      empty panels
- [ ] The leaderboard top 100 is unchanged on the day of the switch
- [ ] Help explains play windows, attempts and unresolved rounds before a player meets
      them
- [ ] The profile shows a **cross-game** summary plus a per-game breakdown, with trading
      as one card rather than the page
- [ ] **No figure on the profile is a platform-wide label over a trading-only
      calculation** - `05` section 10
- [ ] The profile and the leaderboard agree, because both read `UserGameStats` and neither
      computes its own aggregate
- [ ] The **public** profile's field set was decided deliberately, not inherited
