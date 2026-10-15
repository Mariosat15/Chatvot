# CHARTVOLT — GAME COMPETITION LOBBY MOBILE REDESIGN
## Cursor Implementation Specification — Circuit Sprint / Game Competitions

> **BUILT 15 October 2026.** Code-complete. Dedicated phone tree under 769px:
> `components/games/lobby/mobile/` (`MobileGameCompetitionLobby`, hero, status,
> Your Run, metrics, rounds) wired from `ProviderContestLobby`. Desktop
> `GameCompetitionArenaShell` unchanged. Tabs reuse `MobileLobbyPages`
> (Overview / Leaderboard / Prizes / Rounds / Tips). Same loaders, entry button,
> standings poll, prize table. **Never verified by eye** (behind sign-in).
>
> **AMENDED 15 October 2026 (owner: "too busy, no flow, needs consistency with other
> pages").** The separate hero and status files are gone. The phone lobby now reuses the
> trading phone lobby's hero (`MobileLobbyHero kind="game"`), its 2×2 `MobileLobbyTile`s
> (prize / entry / players / the single countdown), one action card ("Your entry" →
> "Your run") and `MobileLobbyPages`, in the trading order. Empty tabs are not drawn.
> Where this guide's section order differs, the trading-consistent order wins.

### PURPOSE

Rebuild the existing **desktop Game Competition Lobby** into a dedicated **mobile Game Competition Lobby**.

The supplied desktop reference is the correct source for:
- real competition data
- game identity
- competition status
- attempts logic
- round history
- leaderboard
- prize distribution
- timers
- scoring
- entry fee
- player count
- competition CTA state
- game tips / how it works

It is **NOT** the mobile layout.

Do NOT shrink the desktop three-column layout into a phone.

The mobile version must be a new presentation layer that uses the same backend data and business logic.

This guide is specifically for **game competitions such as Circuit Sprint**, but it must remain game-agnostic enough to support Volt Stack, Volt Velocity, future games, and other competition game types.

---

# 1. NON-NEGOTIABLE RULE

Desktop stays unchanged.

Mobile gets a dedicated component tree below 769px.

Example:

```tsx
<>
  <div className="hidden min-[769px]:block">
    <DesktopGameCompetitionLobby />
  </div>

  <div className="min-[769px]:hidden">
    <MobileGameCompetitionLobby />
  </div>
</>
```

Reuse the same:
- competition loader
- user registration state
- attempt state
- scoring state
- leaderboard data
- countdown engine
- prize calculation
- game configuration
- game image
- round history
- CTA derivation
- private / GM eligibility logic
- existing ChartVolt buttons
- existing ChartVolt icon assets

Do not duplicate business logic.

Do not hardcode Circuit Sprint-only values into the mobile UI.

---

# 2. WHAT IS WRONG WITH A DIRECT MOBILE PORT

The desktop lobby currently has:

LEFT:
- leaderboard

CENTER:
- game name
- status / attempt message
- main CTA
- round information
- how it works
- game tips

RIGHT:
- contest info
- timer
- prize distribution

This works on desktop because there is enough horizontal space.

On mobile this must NOT become:

```text
Leaderboard
Game panel
Contest info
Prize panel
```

as a long random stack with equal priority.

That creates:
- too much scrolling before the play action
- no clear information hierarchy
- repeated competition information
- oversized cards
- CTA buried too far down
- leaderboard taking over the page
- prize information detached from entry state
- game tips appearing before important competition information

The mobile lobby must answer these questions immediately:

1. What game am I entering?
2. Is the competition live / upcoming / completed?
3. Can I still play?
4. How many attempts do I have?
5. What is my score and rank?
6. When does it end?
7. What can I win?
8. What do I do next?

---

# 3. TARGET MOBILE PAGE ORDER

Use this exact hierarchy:

1. Existing ChartVolt mobile header
2. Back to Competition
3. Game hero / competition identity
4. Status + countdown
5. Main play / attempt card
6. Your performance summary
7. Contest essentials
8. Quick section navigation
9. Leaderboard preview
10. Prize distribution
11. Your rounds / round history
12. How It Works
13. Game Tips
14. Additional rules / fairness / details
15. Existing mobile bottom navigation if applicable

This order is intentional.

The most important user action must be visible before long content.

---

# 4. MOBILE HERO

Desktop currently uses a wide Circuit Sprint banner.

On mobile use a dedicated hero.

Recommended structure:

```text
┌──────────────────────────────────────┐
│ REAL CIRCUIT SPRINT ART              │
│                                      │
│ [PUZZLE COMPETITION] [LIVE]          │
│                                      │
│ CIRCUIT SPRINT                       │
│ Connect the paths. Beat the clock.   │
│                                      │
│ [Highest score wins]                 │
└──────────────────────────────────────┘
```

Requirements:

- real game artwork
- `object-fit: cover`
- preserve game/logo focal area
- dark fade at bottom
- game title readable
- no stretched image
- no tiny desktop text over the art

Hero height:
- approximately 210–280px

Title:
- 24–30px
- maximum 2 lines

Subtitle:
- 13–15px
- 2 lines maximum

---

# 5. STATUS + COUNTDOWN

Place status immediately below or inside the hero.

Examples:

### Upcoming

```text
STARTING SOON
Starts in 02d 14h 35m
```

### Live

```text
LIVE NOW
Ends in 14d 17h 15m
```

### Completed

```text
COMPLETED
Results are final
```

### Cancelled

```text
CANCELLED
Refunded
```

Do not show multiple countdown widgets in different sections.

Use one shared countdown engine.

---

# 6. MAIN PLAY / ATTEMPT CARD — MOST IMPORTANT SECTION

This replaces the large desktop center panel.

It should appear directly after the hero.

Structure:

```text
┌──────────────────────────────────────┐
│ YOUR RUN                            │
│                                      │
│ Attempts used          1 / 1         │
│ Best score             1,061         │
│ Rank                   #1            │
│ Round limit            10 min        │
│                                      │
│ [        PLAY / START ROUND       ]  │
└──────────────────────────────────────┘
```

The button/state must adapt.

Possible states:

### Attempt available

```text
START ROUND
```

### Multiple attempts remaining

```text
PLAY NEXT ROUND
2 attempts left
```

### Already played but more attempts available

```text
PLAY AGAIN
1 attempt left
```

### No attempts left

```text
NO ATTEMPTS LEFT
Your best score is already locked in.
```

### Competition not started

```text
GET READY
Competition starts in 2h 35m
```

### Competition completed

```text
VIEW RESULTS
```

### Already in active game

```text
RESUME GAME
```

### Private / GM eligibility issue

Use existing:
```text
JOIN GM TO ENTER
```

### Not registered

Use:
```text
JOIN COMPETITION
```

Do NOT show a fake disabled desktop-style giant grey bar.

Use the correct ChartVolt CTA/button asset.

---

# 7. ATTEMPT INFORMATION

The desktop screenshot currently shows:

- used attempt message
- timing notice
- no attempts left
- round summary

On mobile consolidate these.

Example:

```text
YOUR RUN

Attempt
1 of 1 used

Best Score
1,061

Time Limit
10 min

Status
Completed
```

Then one clear state message:

```text
You've used all your attempts.
Your best score stays on the leaderboard.
```

Avoid stacking several alert boxes that repeat the same information.

---

# 8. YOUR PERFORMANCE SUMMARY

Use a compact 2×2 grid.

Example:

```text
[ YOUR SCORE ] [ YOUR RANK ]
[   1,061    ] [    #1     ]

[ ATTEMPTS   ] [ BEST ROUND ]
[   1 / 1    ] [   1,061    ]
```

For games that use time:

```text
Best Time
01:24.880
```

For racing:

```text
Best Lap
00:42.440
```

For Volt Stack:

```text
Lines
42
```

Render only meaningful data for the current game.

---

# 9. CONTEST ESSENTIALS

The desktop right column currently has a compact contest information card.

On mobile convert it into a 2×2 grid.

Recommended Circuit Sprint:

```text
[ PRIZE POOL ] [ ENTRY FEE ]
[ 40 Volts   ] [ 10 Volts  ]

[ PLAYERS    ] [ ROUND TIME ]
[ 4 / 100    ] [ 10 min     ]
```

Optional second row based on game:

```text
[ BOARD SIZE ] [ MODE ]
[ Medium     ] [ Anytime ]
```

Do not force all possible fields onto the first screen.

Use only the most important 4–6 fields.

---

# 10. GAME-AGNOSTIC DYNAMIC METRICS

Use a mapper.

Example:

```ts
getPrimaryGameCompetitionMetrics(competition)
```

Possible fields include:

Circuit Sprint:
- Prize Pool
- Entry Fee
- Players
- Round Time
- Board Size
- Attempts

Volt Stack:
- Prize Pool
- Entry Fee
- Players
- Duration
- Scoring
- Rounds

Volt Velocity:
- Prize Pool
- Entry Fee
- Players
- Laps
- Track
- Mode

Future games:
- use configured competition fields

Do not render empty values.

Do not show irrelevant trading fields.

---

# 11. MOBILE SECTION NAVIGATION

Use a compact horizontal tab row after the important play information.

Recommended:

```text
Overview | Leaderboard | Prizes | Rounds | Tips
```

Optional:
```text
Rules
```

Use:
- scrollable row
- 44px minimum height
- active glow
- no tiny tab text
- no wrapping to two rows

Do not show all tab bodies simultaneously.

Only selected content should be visible.

---

# 12. LEADERBOARD — MOBILE REDESIGN

The desktop leaderboard has a small table.

Do NOT squeeze the table into mobile.

Use ranked player cards.

Example:

```text
LEADERBOARD                     4 players

#1  Martou1983
    Score: 1,061
    You

#2  Player_6AF5CA
    Score: —

#3  Player_16AD30
    Score: —

#4  Player_6AF1C5
    Score: 0

[ View Full Leaderboard ]
```

Each row should show:

- rank
- avatar
- player name
- score/time/points
- optional "You"
- optional rank badge
- optional prize position

Do not show unnecessary desktop columns.

---

# 13. LEADERBOARD VISUAL PRIORITY

Use:

1st:
- gold accent
- stronger glow

2nd:
- silver/cyan

3rd:
- bronze/orange

Current user:
- subtle ChartVolt blue highlight

Do not make every row glow heavily.

---

# 14. LEADERBOARD EMPTY STATE

If no players:

```text
No challengers yet

You're early.
Join now and claim the first spot on the board.
```

Optional CTA:
```text
JOIN COMPETITION
```

Do not render an empty desktop table.

---

# 15. PRIZE DISTRIBUTION

Desktop right panel becomes a full-width mobile card.

Use:

```text
WHO WINS WHAT                     Fee 10%

4 of 5 paid positions filled

1st Place
50%
18 Volts

2nd Place
30%
10.80 Volts

3rd Place
20%
7.20 Volts
```

If more places exist:
- show them below
- collapse after 3 if necessary
- add "Show all prizes"

Preserve real backend prize rules.

Do not hardcode exactly 3 winners.

---

# 16. PRIZE REDISTRIBUTION RULE

Preserve the real rule.

If a prize place is empty:
- redistribute according to existing competition logic
- do not fake a payout
- do not show misleading guaranteed values

Use short wording:

```text
Unclaimed prize shares are redistributed among eligible winners.
```

If all players are invalid / no valid score:
- follow backend unclaimed pool rule

---

# 17. YOUR ROUNDS

The desktop center panel shows round history.

On mobile this becomes a clean list.

Example:

```text
YOUR ROUNDS

Round 1
Completed
Score 1,061
10 min

Round 2
Not played
```

For games with multiple attempts show:
- attempt number
- outcome
- score/time
- duration
- date if useful

Do not use a wide desktop row/table.

---

# 18. HOW IT WORKS

Move this below the leaderboard/prize information.

Use a vertical mobile stepper.

Circuit Sprint example:

```text
HOW IT WORKS

1  Join
   Enter the competition.

2  Start a round
   Play any time before the competition ends.

3  Solve fast
   Complete the board and push your score higher.

4  Climb the leaderboard
   Your best valid score decides your position.

5  Win
   Top eligible players share the prize pool.
```

Do not use three tiny desktop cards side-by-side.

---

# 19. GAME TIPS

Keep Game Tips separate from How It Works.

Example:

```text
GAME TIPS

⚡ Non-stop puzzle action
Keep moving and connect efficiently.

🏆 Competitive play
Every second matters.

⏱ Quick rounds
Fast decisions can make the difference.
```

Use 1-column stacked tips.

Optional:
- collapse after 3 items
- "More tips"

---

# 20. GAME DESCRIPTION

Do not repeat the full hero description again.

Overview can contain:

```text
ABOUT THIS COMPETITION

Race the clock, connect every matching pair,
and finish with the strongest score you can.
Your best valid round counts toward the leaderboard.
```

Keep it short.

Maximum:
- approximately 3–5 lines

---

# 21. MOBILE SCREEN STRUCTURE — TARGET

```text
┌──────────────────────────────────────┐
│ CHARTVOLT MOBILE HEADER              │
├──────────────────────────────────────┤
│ ← Back to Competition                │
├──────────────────────────────────────┤
│                                      │
│ REAL CIRCUIT SPRINT HERO             │
│                                      │
│ [PUZZLE] [LIVE NOW]                  │
│ CIRCUIT SPRINT                       │
│ Connect the paths. Beat the clock.   │
│                                      │
│ Ends in 14d 17h 15m                  │
├──────────────────────────────────────┤
│ YOUR RUN                             │
│ Score     Rank                       │
│ 1,061     #1                         │
│ Attempts  Time Limit                 │
│ 1/1       10 min                     │
│                                      │
│ NO ATTEMPTS LEFT                     │
├──────────────────────────────────────┤
│ PRIZE POOL      ENTRY FEE            │
│ 40 Volts        10 Volts             │
│                                      │
│ PLAYERS         ROUND TIME           │
│ 4/100           10 min               │
├──────────────────────────────────────┤
│ Overview Leaderboard Prizes Rounds → │
├──────────────────────────────────────┤
│ LEADERBOARD                          │
│ #1 Martou1983          1,061          │
│ #2 Player...              -           │
│ #3 Player...              -           │
│ [View Full Leaderboard]              │
├──────────────────────────────────────┤
│ WHO WINS WHAT                        │
│ 1st 50%            18 Volts          │
│ 2nd 30%         10.80 Volts          │
│ 3rd 20%          7.20 Volts          │
├──────────────────────────────────────┤
│ YOUR ROUNDS                          │
│ Round 1 · Completed · 1,061          │
├──────────────────────────────────────┤
│ HOW IT WORKS                         │
│ 1 Join                               │
│ 2 Start                              │
│ 3 Solve                              │
│ 4 Climb                              │
│ 5 Win                                │
├──────────────────────────────────────┤
│ GAME TIPS                            │
│ Fast rounds                          │
│ Competitive play                     │
│ Score efficiently                    │
└──────────────────────────────────────┘
```

---

# 22. PRIMARY CTA RULES

The CTA is game-state driven.

Possible states:

### Upcoming and user not entered
```text
JOIN COMPETITION
```

### Upcoming and already entered
```text
ALREADY IN
```

### Competition live and attempt available
```text
START ROUND
```

### Competition live and attempt remaining
```text
PLAY AGAIN
```

### Competition live and game session active
```text
RESUME GAME
```

### No attempts left
```text
NO ATTEMPTS LEFT
```

### Completed
```text
VIEW RESULTS
```

### Private GM required
```text
JOIN GM TO ENTER
```

### Full
```text
COMPETITION FULL
```

### Cancelled
```text
VIEW DETAILS
```

Use existing ChartVolt buttons.

Do not generate random generic button styles.

---

# 23. STATUS BADGES

Support:

- STARTING SOON
- LIVE NOW
- COMPLETED
- CANCELLED
- REFUNDED
- PRIVATE
- GM ONLY
- ALREADY IN

Game category:
- GAME = yellow ribbon/badge if used

Status and category are separate concepts.

---

# 24. TIMER RULES

Use a single timer source.

Upcoming:
```text
STARTS IN
```

Live:
```text
ENDS IN
```

Completed:
```text
COMPLETED
```

Do not show:
- one timer in hero
- a different timer in contest info
- another timer in action card

Use one countdown component and reference the same data source.

---

# 25. SCORING MESSAGE

For Circuit Sprint:

```text
Highest valid score wins.
```

If actual game scoring changes:
- read from competition/game configuration
- do not hardcode Circuit Sprint wording

Examples:

Volt Stack:
```text
Highest score wins.
```

Volt Velocity:
```text
Best race result wins.
```

Future games:
- render configured scoring rule

---

# 26. MOBILE CARD STYLE

Use ChartVolt dark glass.

Recommended:

```css
background:
  linear-gradient(
    180deg,
    rgba(5, 20, 40, .94),
    rgba(3, 13, 28, .90)
  );

border:
  1px solid rgba(35, 210, 255, .30);

border-radius:
  18px;

box-shadow:
  0 12px 30px rgba(0, 0, 0, .28);
```

Important states can use:
- cyan
- gold
- purple
- green
- red

Do not make every card equally bright.

---

# 27. MOBILE TYPOGRAPHY

Hero title:
- 24–30px

Section title:
- 18–21px

Metric value:
- 18–24px

Body:
- 13–15px

Labels:
- 10–12px

CTA:
- 15–17px

Never shrink text until it barely fits.

---

# 28. MOBILE SPACING

Page gutter:
- 14–16px

Section gap:
- 16–20px

Card padding:
- 14–18px

Metric gap:
- 10–12px

Card radius:
- 16–20px

Touch targets:
- minimum 44px

Primary CTA:
- 50–56px high

---

# 29. MOBILE LEADERBOARD PERFORMANCE

Do not render hundreds of players immediately.

For preview:
- show top 5
- always include current player if outside top 5
- `View Full Leaderboard`

For full leaderboard:
- paginate or virtualize
- load in chunks
- preserve rank order

Do not load a massive desktop table into mobile DOM.

---

# 30. LOADING STATES

Use skeletons matching the final shape.

Skeletons for:

- hero
- run card
- metric grid
- leaderboard rows
- prize rows

Do not use one giant full-page spinner.

---

# 31. ERROR STATES

If leaderboard fails:

```text
Leaderboard unavailable
Retry
```

Do not break the whole page.

If competition cannot load:

```text
We couldn't load this competition.
[Retry]
[Back to Competitions]
```

---

# 32. MOBILE BOTTOM NAV

If the existing ChartVolt mobile shell uses bottom navigation:

- reuse it
- Compete should be active
- add bottom spacing so content is never hidden

Example:

```css
padding-bottom:
  calc(88px + env(safe-area-inset-bottom));
```

---

# 33. GAME-AGNOSTIC ARCHITECTURE

Suggested normalized view model:

```ts
type MobileGameCompetitionLobbyVM = {
  id: string;

  game: {
    id: string;
    name: string;
    artwork: string;
    category?: string;
  };

  title: string;
  description?: string;

  status: string;

  timing: {
    state: "upcoming" | "live" | "completed" | "cancelled";
    startsAt?: Date;
    endsAt?: Date;
    countdownLabel?: string;
    countdownValue?: string;
  };

  entry: {
    joined: boolean;
    eligible: boolean;
    fee: number;
    gmRequired?: boolean;
    gmFunded?: boolean;
  };

  run: {
    attemptsUsed?: number;
    attemptsAllowed?: number;
    attemptsRemaining?: number;
    bestScore?: number;
    bestTime?: number;
    rank?: number;
    activeSession?: boolean;
  };

  metrics: CompetitionMetric[];

  leaderboard: LeaderboardVM;

  prizes: PrizeDistributionVM;

  rounds: RoundHistoryVM[];

  howItWorks: StepVM[];

  tips: TipVM[];

  cta: {
    state: string;
    label: string;
    disabled?: boolean;
  };
};
```

---

# 34. RECOMMENDED MOBILE COMPONENTS

```text
components/competitions/game-lobby/mobile/

  MobileGameCompetitionLobby.tsx
  MobileGameLobbyHero.tsx
  MobileGameLobbyRunCard.tsx
  MobileGameLobbyMetrics.tsx
  MobileGameLobbyTabs.tsx
  MobileGameLobbyLeaderboard.tsx
  MobileGameLobbyPrizes.tsx
  MobileGameLobbyRounds.tsx
  MobileGameLobbyHowItWorks.tsx
  MobileGameLobbyTips.tsx
  MobileGameLobbyCTA.tsx
  MobileGameLobbySkeleton.tsx
  MobileGameLobbyError.tsx
```

Share existing hooks.

Do not create new API services only for mobile.

---

# 35. CIRCUIT SPRINT SPECIFIC EXAMPLE

For the desktop screenshot supplied:

### Hero

```text
CIRCUIT SPRINT
Puzzle Competition
Connect the paths. Beat the clock.
```

### Status

```text
LIVE
Competition ends in 14d 17h 15m
```

### User Run

```text
Your Score
1,061

Rank
#1

Attempts
1 / 1

Round Time
10 min

No attempts left
Your best score remains on the leaderboard.
```

### Contest Essentials

```text
Prize Pool
40 Volts

Entry Fee
10 Volts

Players
4 / 100

Round Time
10 min
```

### Leaderboard

```text
1  Martou1983      1,061
2  Player_6AF5CA   -
3  Player_16AD30   -
4  Player_6AF1C5   0
```

### Prize Distribution

```text
1st Place
50%
18 Volts

2nd Place
30%
10.80 Volts

3rd Place
20%
7.20 Volts
```

Do not hardcode those values. They are only the visual example.

---

# 36. WHAT TO REMOVE FROM MOBILE

Do NOT include:

- desktop left sidebar
- desktop right sidebar
- 3-column composition
- giant empty center space
- wide desktop leaderboard table
- repeated timers
- repeated game explanation
- tiny game tips cards
- tiny desktop table headers
- giant disabled grey bars
- multi-column desktop layouts forced into 360px

---

# 37. WHAT MUST BE ABOVE THE FOLD

On a normal 390×844 mobile screen, the user should see most of:

- hero title
- status
- countdown
- Your Run card
- CTA/state
- at least first row of contest essentials

The leaderboard should NOT appear before the primary play state.

---

# 38. MOBILE TEST SIZES

Test:

- 320×568 stress test
- 360×800
- 375×812
- 390×844
- 393×852
- 412×915
- 430×932
- 768px tablet boundary

Also test:
- Safari toolbar expanded
- Safari toolbar collapsed
- larger text
- very long competition title
- long player name
- 0 players
- 100 players
- 1 attempt
- multiple attempts
- no attempts left
- active session
- completed competition

---

# 39. ACCEPTANCE CHECKLIST

Do not mark complete until:

- desktop Game Competition Lobby unchanged
- dedicated mobile tree exists
- mobile is not desktop scaled down
- real game artwork used
- game title fully readable
- competition status clear
- one countdown only
- play/attempt state appears early
- attempts used/remaining correct
- current score correct
- current rank correct
- CTA matches actual state
- contest essentials readable
- no clipped metric values
- leaderboard is mobile-native
- current player identifiable
- View Full Leaderboard works
- prizes use actual backend distribution
- redistribution rules preserved
- round history works
- How It Works is vertical and readable
- Game Tips are readable
- no horizontal page scrolling
- no clipped text
- no tiny desktop table columns
- no repeated content
- no irrelevant trading fields
- future game types can reuse the structure
- loading states implemented
- error states implemented
- empty states implemented
- bottom nav does not cover content
- touch targets at least 44px
- 360px and 390px screenshots reviewed visually

---

# FINAL CURSOR INSTRUCTION

The desktop Game Competition Lobby is a **content reference**, not the mobile layout.

Do not copy its left / center / right columns and stack them.

Rebuild the phone version around the user's actual decision flow:

1. identify the competition
2. see whether it is live/upcoming/completed
3. see whether the user can still play
4. show attempts / score / rank
5. show the correct CTA
6. show prize / fee / player / timing essentials
7. then show leaderboard
8. then prizes
9. then round history
10. then help / tips / rules

For Circuit Sprint, the **Your Run / Attempt state must be the primary section**, because that is what determines whether the player can act.

The final mobile lobby must feel like a native ChartVolt game competition screen, not a responsive desktop dashboard.

Use the existing ChartVolt:
- neon icons
- glass panels
- button assets
- game artwork
- Volt currency symbol
- status colors
- competition state logic

Do not invent new business rules.

Do not hardcode example numbers.

Do not shrink text to make broken layouts fit.

**Recompose the mobile lobby from the real data and state.**
