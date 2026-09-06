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

### 1.1b The pre-flight now refuses what the server would refuse (6 September 2026)

`RoundPreflight` read attempts and the play window and **ignored the contest's own state**, so a
contest that had not started rendered a fully enabled **Play** button. Pressing it lost nothing -
the launch service refuses anything but `active` and consumes no attempt - but the player got a
red error box where they should have got an explanation, on the first screen a new entrant sees.
**A control that appears to work and does nothing** is the same failure as a provider enabled
with no adapter, or a `rankingMethod` a provider game ignores.

It mirrors `PLAYABLE_STATUSES` rather than inventing a rule, and `draft` is grouped with
`upcoming` because an unpublished contest is reachable by URL. Five refusals get five distinct
wordings, for the reason `LaunchRefusal` learned in X5: a generic message forces the player to
guess which of "come back later", "it's over" and "you're out of attempts" applies.

Three things about it are load-bearing and easy to undo:

- **Resume is blocked too.** `exhausted` deliberately excludes a live round, so resume survives a
  spent allowance - but the status gate in the launch service runs **before** the idempotent
  resume path, so a round in a finished contest cannot be reopened however harmless that looks.
  `blocked` is therefore independent of `resuming`, and a test asserts that appending
  `&& !resuming` to it turns red.
- **Not-yet-started is not an error, and must not be red.** The red panel reports a *rejected
  action*. Having just joined a contest that opens tomorrow is the normal case, and colouring it
  as a failure teaches a player something is broken. The test counts the red containers so a
  second one cannot appear unnoticed.
- **The attempt-cost hint is hidden while blocked.** "Starting uses one attempt" beside a
  disabled button reads as a warning about something the player cannot do.

`__tests__/games/provider-play-ui.test.ts` (28 tests) and `tools/probe-preflight-status.ps1`
(7 probes, all red).

### What it does not do

- **No live leaderboard during play** (section 11's polling recommendation is unimplemented). A
  player sees their standing when they return to the contest page. When they do, **the board is
  now ranked correctly** - it was not until 6 September 2026, when **R37** found that neither
  app's `getCompetitionLeaderboard` passed `score` or `scoreDirection` to the ranking engine, so
  every provider participant tied on zero. See `05` section 2.0b; a document implying the
  provider board has always ranked on score is wrong.
- **No practice mode.** Needs `supportsPractice` and a free, unranked path.
- ~~**No game-aware dashboard.**~~ **Built 6 September 2026 - see section 5.1a.** The sentence
  this replaced named `ActiveCompetitionCard` and `CompetitionsTable` as the screens at fault,
  and **both are orphaned** - nothing renders either. The live one is `ContestsSidebar`. Correct
  as a description of what the plan believed, wrong as a description of the platform.
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

### 4.1a What is built of this row, and what is not (6 September 2026)

Three parts done, the lobby itself outstanding. Stating the split matters because "the play
screen works" has been read as "the lobby is game-aware", and it is not.

| Part | State |
|---|---|
| The CTA's destination | **Built.** `CompetitionEntryButton` sends a provider contest to `/play` and a trading contest to `/trade`, using the strict `isProviderContest` because a destination needs the keys, not just the label. Both trade-history links are withheld and **counted** in a test, so a third unguarded one cannot hide behind them |
| The play window, attempts and refusals | **Built, on the play screen** - section 1.1b. The pre-flight now reads `contestStatus` as well, so it refuses what the server would refuse instead of offering a button that errors |
| The leaderboard's ranking metric | **Built.** R37, `05` s2.0b |
| The lobby page itself | **Built 6 Sep 2026** - see 4.1b |
| Ranking labels per game | **Partly built.** The score column's heading comes from the title's `scoreType`, so a time trial says "Time" rather than "Score". The full `ranking-config.service.ts` pass is still outstanding |
| Filter by game | **NOT built**, and deliberately deferred: there is one provider game, so a filter with one option is friction on a page players use daily. Revisit when the catalogue has a second title |

### 4.1b The lobby, built as a branch rather than as guards (6 September 2026)

`app/(root)/competitions/[id]/page.tsx` renders `ProviderContestLobby` and returns, and the
trading path below it is **byte-identical**. Everything below the branch is the forex lobby -
difficulty computed from leverage and starting capital, an asset-class list, a margin explainer,
"Enter Terminal", and a leaderboard whose columns are profit and loss - and for a puzzle contest
it rendered all of it **without an error.** Nothing crashed because the fields a provider contest
lacks are either guarded or filled by schema defaults, which was **measured against a real
MongoDB** (`__tests__/services/provider-contest-lobby-shape.test.ts`) rather than assumed. A
paying player simply read a trading screen for a game with no market.

**Why one branch and not conditionals.** Threading guards through 1,100 lines of trading layout
touches every line the live trading lobby depends on, to serve a contest type that has never had
a player. Branching once leaves the trading path unchanged, and that is the only thing which
makes the existing lobby behaviour trustworthy evidence that nothing moved - the same argument
that kept a known one-character defect verbatim while the settlement stages were extracted.

Six facts about it drift easily:

- **It branches on the LABEL, via `hasProviderGameLabel`, not on the strict
  `isProviderContest`.** A contest labelled provider but missing its provider key cannot launch a
  round, so the strict helper is right to refuse it - and it is **still not a trading contest**,
  so showing it the trading lobby would hand a puzzle player an Enter Terminal button. The lobby
  answers *what kind of screen is this*; whether Play can work is a separate question the
  component asks with the strict helper and **refuses with a stated reason**. Reusing the strict
  helper here compiles and reviews as correct.
- **The branch must sit ABOVE the trading computation**, and a test asserts its position rather
  than its presence. Placed after `getDifficultyData()` it would still render the right screen
  while computing leverage and starting capital for a contest that has neither.
- **The leaderboard is a different component, not a restyled one.**
  `CompetitionLeaderboard`'s row type declares `currentCapital`, `pnl`, `pnlPercentage` and the
  trade counts, and its props demand a `prizeDistribution` and a `minimumTrades`. Rendering it
  would put zeroed profit and loss, and a "minimum trades" qualification note, in front of a
  player who has never traded - `05` section 10's binding rule broken in the most visible place
  available. `ProviderLeaderboard` shows rank, player and one score.
- **An absent score is not zero.** A player mid-contest has no score, and rendering that as 0
  puts them level with someone who genuinely scored nothing. This is the read-side form of the
  `score ?? 0` that made every provider participant tie in R37.
- **The board must not decide the ranking direction.** Rows arrive already ordered by
  `calculateRankings`, which resolves the direction once from the catalogue. A `.sort()` here
  would be a second place for the direction to be decided, which **is** R37.
- **`isRegistrationClosed` was extracted, not copied.** The trading lobby held it inline with a
  clamp against `startTime` that exists for documents an old bug wrote with a deadline an hour
  *before* the start. A second copy forgetting the clamp would silently refuse entry to those
  contests, with the contest visibly upcoming. Sixth "one rule, two copies" avoided.

`__tests__/games/provider-play-ui.test.ts` (**43 tests**, up from 28) and
`tools/probe-provider-lobby.ps1` (11 probes, all red). The figure was written as 54 before being
checked - **run the suite rather than adding up the diff**, which is the same duty as verifying a
throwaway aside.

**A harness lesson came with it, and it produced a false result first.** One probe reported GREEN
because its `Test` string was missing an apostrophe, so vitest's `-t` matched nothing, ran zero
tests, and the absence of a failure line read as "the guard did not fire". **A `-t` filter
matching no test is a fault in the probe, never in the code**, and all three harnesses now report
it as `PROBE BROKEN` in its own colour rather than as a green.

### 4.1c The theme pass - one product, two games (owner requirement, 6 September 2026)

> **SUPERSEDED THE SAME DAY BY 4.1d, AND KEPT AS HISTORY RATHER THAN REWRITTEN.** Read 4.1d for
> what is built now. Four claims below are stale as *present* facts and each one is worth knowing
> was once true: `components/games/lobby-ui.tsx` **no longer exists**; the 3D `GameIcon` set and
> the rank medals are **no longer used on either lobby**; the trading page is **no longer
> byte-identical**, because the owner decided it should be restyled too; and the class-string
> comparison tests described here **have been replaced**, for the reason given in 4.1d. What
> survives intact is the *argument* - why a game lobby wearing a stranger's chrome is a trust
> problem rather than a taste problem - and the rule that sharing the chrome must never become
> sharing the content.

The lobby built in 4.1b was **correct and looked like a different application.** It answered all
three of section 4's questions, showed no trading figure, and used flat lucide glyphs, its own
narrower container, its own small plain headings and its own card shells. The owner's instruction
is short and worth quoting as the acceptance criterion: *"make the games lobby identical like the
trading lobby theme we need consistency, the game lobby however will not show any trading related
content or stats but the theme must be the same."*

**Why this is not a cosmetic ticket.** A player reaches both lobbies from the same
`/competitions` list, one click apart. A different corner radius, border tone, heading size or
icon style is not read as *a different game* - it is read as *a different website*, and on a
platform that takes entry fees that is a trust problem rather than a taste problem. It is also
the mirror image of the defect this whole chapter exists for: 4.1b stopped a game contest wearing
trading **content**, and this stops it wearing a **stranger's chrome**.

**What is shared, and what is emphatically not.** The chrome is shared: the page shell, the
back-button-and-UTC-clock header, the gradient hero with an icon watermark behind it, the
uppercase hero figures, the two-thirds/one-third grid, the panel shells, the 3D `GameIcon` set,
the rank medals, the tinted row cards and the blue "You" chip. The content is not, and `05`
section 10 makes that binding rather than stylistic: no capital, no margin, no leverage, no asset
classes, no profit and loss, no trade counts.

Five facts drift easily:

- **The live code is `components/games/lobby-ui.tsx`** (`HeroFigure`, `SidePanel`, `PanelRow`,
  `PanelNote`, `StatusBadge`), plus the rebuilt `ProviderContestLobby.tsx` and
  `ProviderLeaderboard.tsx`. None of the three is mirrored, so `check:mirrors` says nothing about
  any of them. Read those, not this prose.
- **`lobby-ui.tsx` is NOT an abstraction over the trading lobby and must not become one.** The
  trading page keeps its own copies of every class string and is still byte-identical.
  Refactoring it to import from here would destroy the guarantee that makes the trading lobby's
  behaviour trustworthy evidence that nothing moved - the same trade that kept a known
  one-character fee defect verbatim during the settlement extraction. A document describing this
  file as shared UI *between* the two lobbies is describing a change that has not happened and
  should not.
- **The consistency is pinned by tests that read BOTH lobbies and compare them**, not by
  hard-coded class strings. Seven `it.each` cases assert the same string appears in the trading
  page *and* in the game lobby, so restyling the trading hero turns them red and points at the
  game lobby that has to follow. A snapshot of today's design would have stayed green while the
  two screens drifted apart, which is the failure the guard exists for. **The paired-document
  drift rule, applied to code.**
- **The hero keeps trading's GOLD gradient**, with the game identity carried by a `joystick1`
  watermark and a violet catalogue-name pill. The style sheet below is drawn in violet, and a
  violet hero would have been the mock-accurate choice and the inconsistent one. Consistency was
  the instruction; the mock is the future direction.
- **The count pill says "players", never "traders".** The trading lobby's identical pill says
  traders, and copying the shell wholesale is the trading-shaped-label problem in the one place
  on the page a player is certain to read. Same class as `matchmaking.service.ts`: **the label
  agrees with the old world and keeps agreeing after it ends.**

**The accent lookup is a `Map`, and the comment beside it is load-bearing.** Tailwind compiles
the classes it can *see* in the source, so `border-${accent}-500/30` names a class that exists in
the TypeScript and in no stylesheet - the panel renders completely unstyled, which reads as a
broken CSS build rather than as a bug in that file. A test asserts no partial class is ever built
by interpolation. It is a `Map` rather than an object for the reason the round-resolution action
list is one: object indexing walks the prototype chain, and *safe by accident is not safe*.

`__tests__/games/provider-play-ui.test.ts` is now **55 tests**, up from 43, and
`tools/probe-lobby-theme.ps1` is **15 probes, every one red on the expected test with a blast
radius of exactly 1**. Full suite 966 tests green, typecheck at the 15-error baseline, lint clean.

**Not verified by eye, and saying so is part of the deliverable.** The automated browser has no
session and the page is behind sign-in, so this was proven by comparison against the trading
lobby's own source and by the suite - **not by a screenshot.** Owner review is the remaining step.

#### The saved design reference

`External game plans/design-reference/` holds the two images the owner supplied, deliberately
committed rather than left in a chat. **There are now seven, catalogued in that folder's own
`README.md`, which is the file to read** - the table below is left as it was written, with one
correction inline because it is a wrong *fact* rather than a superseded *decision*:

| File | What it is |
|---|---|
| ~~`trading-lobby-as-built.png`~~ → `trading-lobby-target.png` | Described here as "the live trading lobby, the theme being matched". **It was a mock, not a capture, and the filename was wrong.** Proven when the owner re-supplied the same picture as a *target* and the two files came back **byte-identical**. Renamed, and the folder's `README.md` now labels every image mock or capture so the mistake cannot repeat |
| `game-lobby-target-and-style-sheet.png` | A game lobby mock-up (*Circuit Perfect*) beside a **ChartVolt style sheet** - background and header art, an icon set, stat cards, four status cards, four button styles, a leaderboard row, avatars, panels and glow elements |

The owner's framing: *"see the image how the app will have the theme in the future, just save
that for reference, modify as needed, the images data are just examples."* So the numbers,
names and artwork in them are illustrative, and **the style sheet is a direction of travel, not
an acceptance criterion for this slice.** Three things in it are genuinely not built and must not
be summarised as done: the **hero artwork** per game (the mock's car; we render an icon
watermark), the **four stat cards as bordered tiles** (the trading lobby renders plain figures on
the gradient, and trading is the reference the instruction named), and the **footer help strip
with a View Rules button** - a rules surface for a provider title is real outstanding work, since
the trading lobby's rules accordion is entirely trading content and a game has nothing to put in
it yet.

### 4.1d Both lobbies rebuilt on one design kit (owner requirement, 6 September 2026)

**The instruction reversed the direction of 4.1c.** That slice made the game lobby match the
trading lobby, because consistency was the ask and the trading lobby was the thing to be
consistent with. The owner then supplied a full component sheet and five screen mocks and said:
*"remake the lobby for all games and trading to match the images exactly with the icons images
colours etc, we will start making the app look more game themed."* So the reference moved. The
trading lobby is no longer the standard - **the sheet is**, and the trading lobby is one of the
two screens that had to change to meet it.

Saying that plainly matters because 4.1c's central engineering decision - keep the trading page
byte-identical, so its unchanged behaviour is evidence nothing moved - **is exactly what this
slice had to give up.** That guarantee was not traded away casually and section 4.1e below says
what replaced it.

#### What was built

| Piece | Files | Notes |
|---|---|---|
| The kit | `components/neon/tokens.ts`, `Cards.tsx`, `Hero.tsx`, `Buttons.tsx`, `Accordion.tsx`, `LeaderboardRow.tsx`, `banners.ts` | **None of it is mirrored.** `check:mirrors` says nothing about any of it |
| The artwork | `public/assets/neon/banner-{circuit-sprint,circuit-perfect,trading,championship}.webp` | Generated, then converted PNG → WebP: **8.0 MB → 564 KB** |
| The game lobby | `components/games/ProviderContestLobby.tsx`, `ProviderLeaderboard.tsx` | Rebuilt on the kit. `lobby-ui.tsx` **deleted** |
| The trading lobby | `app/(root)/competitions/[id]/page.tsx` plus `components/trading/lobby/{TradingLobbyHero,TradingLobbySidebar,TradingPrizeTable,trading-lobby-accordions}.tsx` | The page went from **1,224 lines to 377** |
| The trading board | `components/trading/CompetitionLeaderboard.tsx` | Row shell and column headings now come from the kit; its columns are unchanged |

#### Six facts that drift easily

- **`components/neon/` is not `components/arena/`, and the near-miss is worth recording.** The
  kit was first written into `components/arena/`, which already holds the **Live Arena broadcast
  dashboard** - an unrelated, existing feature. Nothing collided at build time; the two would
  simply have shared a folder and a naming prefix for ever, and the next reader would have had no
  way to tell which `Arena*` component belonged to which feature. **Check what a plausible folder
  name already means before taking it.**
- **The accordion is the only `"use client"` file in the kit, so it is the only boundary - and it
  took the trading lobby down in production.** It accepted `icon: LucideIcon` and built the tile
  itself; a React component is a *function*, which cannot cross a server/client boundary, so
  every request to a trading contest's lobby rendered the error boundary. It is now handed the
  icon **already rendered**, exactly as the sibling `content` prop always was. Three things
  nothing in the pipeline could catch, all worth carrying: **a green `next build` is not evidence
  that a dynamic page renders**, because `ƒ` routes are never prerendered; the typecheck is happy
  because **no type in this codebase means "serialisable"**; and the guard written for it was
  itself green on the reintroduced bug, because `typeof !== "function"` and "has `$$typeof`" are
  **both satisfied by a lucide icon** - a `forwardRef` is an object carrying
  `Symbol.for("react.forward_ref")`. `isValidElement` is the check. Recorded as **R39**.
- **An asset path is unverifiable by the compiler, so a test asserts every banner file exists.**
  The artwork was first committed to `public/assets/arena/` while the kit had moved to
  `components/neon/` - four string literals pointing at nothing. Nothing would have failed: no
  type error, no build error, no log line, just a broken image on every lobby on the platform.
  `allNeonBanners()` exists so the test exhausts the map rather than sampling it, and a probe
  restoring the wrong path turns it red. **Any string that names a file rather than a symbol needs
  an assertion, because the compiler has no opinion about it.**
- **The icon set is a deliberate REVERSAL, not a drift.** 4.1c required the 3D `GameIcon` PNGs
  and banned lucide glyphs; this slice requires the opposite on both lobbies. The sheet specifies
  flat line glyphs in tinted rounded tiles, and since the trading lobby moved too, the platform
  moved rather than one screen diverging. A document citing 4.1c's icon rule as current is stale.
- **The hero is violet-family now, not trading's gold.** 4.1c's reasoning - consistency beats
  mock-accuracy - was correct *while the mock was the future*. The owner has made the mock the
  present, so the gold hero is gone from both screens.
- **Each contest type gets its own hero banner, resolved from `banners.ts`, and a game we have no
  art for falls through to a generic trophy.** A visibly generic fallback is acceptable here in a
  way it never is for a number: an operator sees a wrong-looking banner immediately, whereas a
  defaulted figure is believed. The map is local rather than a `provider_game` field because
  artwork per title is a catalogue-content question that belongs with the game pages, and adding
  a field now would put a URL nothing maintains in front of players.
- **The trading sidebar's nine always-open cards became four open items and six accordions**, and
  which stayed open is pinned by a test rather than left to judgement. Open: the entry control,
  the countdown, the schedule, the prize table - everything a trader *decides* on. Collapsed:
  eligible assets, trading rules, scoring, risk management, disqualification, prizes detail -
  reference material. Burying a decision would be the same class of error as an aggregate that
  quietly means trading only: correct-looking, and wrong exactly where it matters.
- **The count pill wording is still per-screen on purpose.** `NeonCountPill` exists because both
  lobbies had hand-written the same seven-class string - the "one rule, two copies" shape behind
  `referenceId`, `failedReason`, `challengeId` and the Game Master `||`. But the *words* stay
  with the caller: a game has **players**, a trading contest has **traders**, and a shared label
  would be wrong on one of the two screens.

#### What is still not built, and must not be summarised as done

- **A rules surface for a provider title.** The sheet's footer strip has a **View Rules** button;
  the game lobby renders a link to `/help/competitions` instead, because the catalogue stores a
  `description` and no rules summary or how-to-play. A button that opens nothing is worse than an
  honest destination.
- **The equity chart on the trading hero** is unchanged from the existing dashboard component;
  the sheet's styling of it was not applied.
- **The announcements panel and the "Share Event" button** in `trading-lobby-target.png` are not
  features that exist.
- **The four `future-*.png` mocks** - dashboard, competitions hub, game arena, leaderboards - are
  a later phase by owner decision, and most of what they show is missing **data**, not styling.
  See `design-reference/README.md`.
- **Never verified by eye.** Both pages are behind sign-in and the automated browser has no
  session, so this was proven by the suite and by reading the source. **Owner review is the
  remaining step**, and any claim of visual sign-off before that is wrong.

### 4.1e What replaced the byte-identical guarantee

4.1c kept the trading page untouched so that its behaviour was evidence nothing had moved. Once
the owner asked for it to be restyled, that evidence was unavailable, so three things were put in
its place - and the reasoning generalises to any restyle of a screen that computes money.

- **The money computation was extracted whole and is asserted character for character.**
  `TradingPrizeTable.tsx` carries the unclaimed-position redistribution, the bonus split and the
  platform-fee deduction exactly as the page had them. A test pins four expressions verbatim,
  and two probes - changing the denominator, and dropping the fee - go red. **Extracting and
  restyling in one commit is normally forbidden**; where it is unavoidable, the calculation needs
  an assertion that cannot pass a rewrite.
- **The consistency guard changed shape, because the old one could not survive this.** Comparing
  class strings between two files works for two files. The sheet covers **seven** screens, and
  pairwise comparison of seven is twenty-one comparisons, the first missing one of which is
  silent. The property is now **one definition, and no screen has chrome of its own**: the
  kit-owned literals are asserted to appear in the token file and in *no* consumer, so
  re-introducing a bespoke panel to either lobby turns a test red and names the file. **This is a
  stronger claim than the old one and it does not grow with the number of screens.**
- **The negative assertion is the one that matters.** "Both lobbies import the kit" is trivially
  satisfiable - a file can import the kit and hand-roll a panel beside it, which is precisely how
  the drift starts.

`__tests__/games/provider-play-ui.test.ts` is **56 tests**; `tools/probe-lobby-theme.ps1` is
**23 probes**. Two of them exposed defects in the guards rather than in the code, both from
families already recorded here: a `/<NeonHero/` match **passed while the component had been
swapped for `<NeonHeroReplacement`**, because a prefix match cannot distinguish a component from
one whose name starts the same way; and `/neonRowClasses\(/` was satisfiable by the **import
line** alone. Assert the call with an argument, and put a boundary character after a tag name.

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

### 5.1a The contest cards, made game-aware - BUILT 6 September 2026

`lib/actions/comprehensive-dashboard.actions.ts`, `components/dashboard/ContestsSidebar.tsx`,
`components/dashboard/ActiveCompetitionCard.tsx` and `components/dashboard/CompetitionsTable.tsx`.
18 tests in `__tests__/games/provider-dashboard-cards.test.ts`, 17 probes in
`tools/probe-dashboard-cards.ps1`, all red on the expected test. **None of it is mirrored.**

**The first thing to get right is that the plan named the wrong components.** Section 1's
deferral note - and every summary built on it - said the offending screens were
`ActiveCompetitionCard` and `CompetitionsTable`. Both are **orphaned**: `rg` finds no importer
for either. The component the dashboard actually renders is **`ContestsSidebar`**, which nothing
in this chapter mentioned. Fixing only what the plan named would have produced a green suite, a
closed to-do item and a dashboard still showing "P&L" against a puzzle score. The two orphans
were made game-aware anyway, because the plan names them and a future reader restoring one would
otherwise restore the defect - but **the live fix is the one the plan did not ask for.** General
form, and it is the counting rule in a new shape: **before fixing the component a document names,
grep for its importer.**

- **The data layer was the real defect; the components could only render what they were given.**
  `comprehensive-dashboard.actions.ts` selected neither `gameType` nor `score`, so no card could
  have branched even if it wanted to, and `getDashboardRankingValue` computed a **trading**
  ranking value for every contest. That is the trading-shaped-service failure again: it returned
  a number, the sort ran, the page rendered, and provider participants were ordered by a PnL
  none of them has. Fixed by dispatching to the game registry and resolving the direction through
  the shared `resolveScoreDirection`, so the dashboard, the contest leaderboard and settlement
  now answer the direction question from one place.
- **A score of zero and no score at all must render differently.** The action previously read
  `participation.score || 0`, which is the read-side twin of the write-side hole behind R37 - a
  player whose round has not reported yet is shown a hard `0`, indistinguishable from having
  played and scored nothing. The value is passed through undefined and the card renders `–`.
- **Three parallel switches on game type is three chances to add a game and update two of them.**
  `ContestsSidebar` had `formatCompMetric`, `getCompMetricLabel` and `isCompMetricPositive`, each
  switching separately, so the next game could easily be formatted as a score, labelled "P&L" and
  coloured red for a good result. Collapsed into one `describeCompMetric` returning value, label
  and tone together. The tone needed a third state: **a score is neither profit nor loss**, and
  without a `neutral` case every provider score inherits green-or-red, which reads as a judgement
  the platform has not made.
- **The provider card must not link at `/play`.** Launching a round consumes an attempt and
  Next.js prefetches `<Link>` targets on hover, so a dashboard card pointed at the play route
  could spend a paying player's only attempt without them clicking. Both provider cards link at
  the contest page, which is the safe landing - the same reasoning that made the play screen a
  state machine rather than a redirect.
- **Type the new component to the fields it actually reads.** The provider card's props are a
  narrow structural type rather than the outer component's `any`, so a future edit reaching for
  `pnl` fails to compile. It earned that immediately: the narrow type caught an unguarded
  `currentRank > 0` comparison that `any` had been hiding.

**Still trading-shaped, and deliberately not touched:** the trading panels themselves, the
per-game summary cards, and the mega-action split (R21). Those are the rest of this section.

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
