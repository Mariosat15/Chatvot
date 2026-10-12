# ChartVolt Competition Detail Pages — Desktop Cursor Build Specification

> **BUILT 12 Oct 2026 (eng), amended the same day.** Shared shell `components/competitions/detail/CompetitionDetailShell.tsx` (hero → summary KPIs → 2fr/0.9fr main + sidebar, on the competitions hub's `COMPETITIONS_ARENA_BG` backdrop). Trading: the reference sections (Eligible Assets, Trading Rules, Scoring, Risk Management, Disqualification, Prizes) are the **top tab bar** under the leaderboard (`TradingDetailTabs`), with Overview = an "About this competition" card (description plus four centred icon tiles: assets, seats, how to win, pot) beside a "Battle plan" numbered timeline (`TradingOverview.tsx`, amended twice 12 Oct 2026), rule cards full width with an odd last card spanning both columns, and the Leaderboard paged five rows at a time with drag instead of a scrollbar; the sidebar keeps only the decisions (entry, countdown, schedule, difficulty, prizes). Game lobby on the same shell with its own blocks. **Never verified by eye.** **12 Oct 2026:** summary strip sized to the dashboard KPI row; Overview tiles carry two fact rows each; all trading-lobby wording simplified and made playful. Never verified by eye. **12 Oct 2026 (later):** prize card pages 7 rows with drag/swipe and no scroll bar; wizard leverage now stored and shown; Game Master equity check mandatory, max 50%; overview tiles 2x2; captions under Prize pool and Entry fee. Never verified by eye. **12 Oct 2026:** the Prize pool KPI shows the maximum pool (current pool + entry fee x empty seats) with an amber fill bar, and the Battle plan card shows trader-to-trophy artwork in its spare space. Never verified by eye. **12 Oct 2026 (later):** the trading About card shows two tiles (market, how you win); seats and pot removed as duplicates of the summary. The competitions list defaults to newest-created first among open contests. Never verified by eye. **12 Oct 2026 (later still):** Overview About/Battle plan cards shortened to content (no stretch, no Battle plan art). Trading Rules/Scoring/Disqualification explanations use InfoTooltip (?) instead of under-row info boxes. Never verified by eye. **12 Oct 2026 (risk tips):** Risk Management and Margin levels use InfoTooltip with gamer-plain explanations. Never verified by eye. **12 Oct 2026 (rules merge):** Disqualification rows live inside Trading Rules; Practice cash renamed Simulated funds; Eligible Assets tips added. Never verified by eye.
>
> **Amended again 12 Oct 2026:**
> - The trading tab bar now sits **above** the leaderboard. You drag it sideways; it shows no scrollbar.
> - The Overview is written from the contest's own data (`buildTradingOverviewCopy`), so how you climb follows `rankingMethod`.
> - "Your Competition Dashboard" follows the Menuitems "Round Complete" panel: a trophy header, a hero card with the ranked figure and `#rank / total`, five coloured tiles, Run summary and Score breakdown rows, and back + gold actions (`components/trading/competition-dashboard/`).
> - Career stats and the All-Time tab moved behind the Full Performance link, and the equity chart became the hero's sparkline.
>
> **Amended a third time 12 Oct 2026 (trading page, six owner images):**
> - The server clock left the top bar and sits inside the "Starts in" / "Time remaining" KPI card (`UTCClock variant="inline"`).
> - Scoring and Disqualification are sub-groups of the **Trading Rules** tab; there are no separate tabs for them any more.
> - Leaderboard rows: gold frame on #1, blue glow on You, medal plate, chips (GM, title, You, tie), bigger figures and a prize line under each paid row. The # column is gone; the rank sits in the plate.
> - Prize distribution: `PrizeTable size="lg"` (gift banner, one large card per place, cyan glow when filled, muted when not, info card). The maths is untouched (`lib/utils/prize-projection.ts`).
> - Sidebar: the countdown uses `CountdownPanel size="showcase"` (arena trophy backdrop, big cells, gold seconds); Schedule rows have coloured dots and dates in pills; Difficulty has a gradient bar with the label in its own colour.
> - KPI row uses `StatCard size="showcase"` (large glowing image, lit rim). The game lobby keeps `lg`.
>
> **Amended a fourth time 12 Oct 2026 (icons, rule cards, arrows, Overview):**
> - Icons on the trading page now come from the owner's Menuitems set (`public/assets/neon/icons/*.webp` via `NEON_ICON`): the tab icons, the sidebar panels (`NeonPanel iconSrc`, a new opt-in prop), the leaderboard panel, the large prize branch and the showcase countdown headings. Small inline glyphs inside rows stay lucide.
> - The tab contents are image-2 cards (`components/trading/lobby/TradingRuleCard.tsx`): lit frame, large picture tile, title + subtitle, dark rows with a coloured value, info notes, a red warning row for liquidation and a margin ladder with dots. Trading Rules shows three cards (Trading Rules, Scoring, Disqualification). Every value, fallback and condition is unchanged.
> - **Prizes is no longer a tab** - the sidebar's prize distribution already shows the pool, the paid places, the fee and the unfilled-share rule. Left and right arrow buttons step through the tabs and scroll the chosen one into view.
> - The Overview is two lit cards: "About this **competition**" with four glowing picture tiles, and "Battle **plan**" with glowing numbered circles in a colour per step (`ContestHowItWorks` embedded variant only; the game lobby's grid is unchanged).
>
> **Never verified by eye.**

## Scope

Build and refine **two desktop competition detail experiences** using the same ChartVolt visual system and the same shared data architecture:

1. **Desktop Game Competition Detail Page**
2. **Desktop Trading Competition Detail Page**

This is a **desktop-only specification**.

The goal is not to rebuild everything from scratch. Reuse the existing ChartVolt components, competition logic, game artwork, icons, buttons, badges, Volt symbol, GM logic, eligibility rules, countdown logic, leaderboard logic, and backend data wherever possible.

The current implementation must be improved because it is too flat, too technical, too compressed, and too close to an admin interface. The target is a premium, cinematic, structured ChartVolt competition experience.

---

# 1. Core Design Goal

Both pages must feel like two variants of the **same ChartVolt product**.

They must share:

- the same page shell
- the same hero treatment
- the same stat card system
- the same CTA system
- the same button family
- the same section spacing
- the same card radii
- the same neon/glass styling
- the same icon language
- the same typography scale
- the same Volt currency treatment
- the same competition state logic
- the same countdown logic
- the same leaderboard styling
- the same right-side information rail structure

What changes between competition types is the **content**, not the design language.

---

# 2. What Is Wrong With the Current Result

The current Cursor implementation is incorrect because:

- it uses too many thin horizontal rows
- it gives every field equal visual importance
- the text is too small
- information density is high but clarity is low
- large areas of the page feel empty while important information is compressed
- the right sidebar becomes a long stack of technical panels
- it feels like an admin/configuration screen rather than a user-facing competition page
- the target hero hierarchy is missing
- competition identity is weak
- buttons do not consistently reuse the existing ChartVolt button system
- monetary values are not consistently using the Volt visual treatment
- the game page and trading page do not feel like one coherent design system
- irrelevant fields can appear even when they do not apply
- some sections are visually disconnected from the competition state
- information is technically present but difficult to scan

Do not continue polishing the existing row-based layout. Reorganize the page structure.

---

# 3. Desktop Layout System

Use a centered responsive desktop container.

Recommended:

```css
max-width: 1600px;
margin: 0 auto;
padding: 24px 28px 40px;
```

At large desktop widths use:

```text
┌──────────────────────────────────────────────────────────────┐
│ Hero                                                         │
├──────────────────────────────────────────────────────────────┤
│ Summary Stat Cards                                           │
├───────────────────────────────────┬──────────────────────────┤
│ MAIN CONTENT                      │ RIGHT SIDEBAR            │
│ ~66–70%                           │ ~30–34%                  │
│                                   │                          │
│ Leaderboard / Overview / Tabs     │ CTA / Countdown / Info   │
│                                   │                          │
└───────────────────────────────────┴──────────────────────────┘
```

Recommended CSS:

```css
grid-template-columns: minmax(0, 2fr) minmax(340px, 0.9fr);
gap: 20px;
```

Do not create very wide single-column rows across the entire page.

---

# 4. Shared ChartVolt Visual Language

## Background
Use the existing ChartVolt dark arena background system:

- deep navy / black base
- subtle blue atmospheric glow
- low-opacity neon lines
- competition-specific hero artwork
- restrained purple / cyan / gold accents

Do not use a plain black background with isolated thin cards.

## Panels
Use:

- dark navy glass surfaces
- subtle gradient fill
- 1px–2px neon edge
- soft inner shadow
- restrained outer glow
- rounded corners around 16–22px

## Accent usage

### Cyan / electric blue
Use for:
- information
- navigation
- neutral action
- time
- player count
- live data

### Gold / yellow
Use for:
- prizes
- rewards
- ranking
- competition importance
- upcoming/start state

### Purple / magenta
Use for:
- game mode
- special states
- secondary feature emphasis

### Green
Use for:
- eligible
- joined
- active success
- positive P&L
- ready state

### Red
Use for:
- negative P&L
- warnings
- disqualification
- cancelled state
- urgent countdown state

---

# 5. Typography

Do not shrink typography to fit more information.

Recommended desktop scale:

```text
Hero title:          34–44px
Section title:       20–24px
Card title:          16–20px
Large metric:        26–36px
Standard value:      16–20px
Body:                14–16px
Secondary text:      12–14px
Micro label:         10–12px uppercase
Button text:         15–17px bold
```

Use strong contrast.

Avoid long uppercase paragraphs.

---

# 6. Shared Hero Section

Both competition types use the same hero structure.

```text
┌────────────────────────────────────────────────────────────┐
│ [Back to Competitions]                                    │
│                                                            │
│ [STATUS] [TYPE]                                            │
│                                                            │
│ COMPETITION TITLE                                          │
│ Short player-friendly description                          │
│                                                            │
│                                        contextual timer    │
│                                        or event identifier │
└────────────────────────────────────────────────────────────┘
```

## Hero requirements

Use real competition artwork.

### Game competition
Use:
- game environment
- race arena
- board artwork
- game logo
- competition gameplay imagery

### Trading competition
Use:
- neon candlestick market visuals
- trading arena
- ChartVolt trophy
- market screens
- trading-specific artwork

Apply a dark gradient overlay so title text remains readable.

Do not use the game artwork as a low-opacity wallpaper with giant unreadable text behind the content.

---

# 7. Shared Hero Status

Possible badges:

- LIVE NOW
- STARTING SOON
- COMPLETED
- CANCELLED
- PRIVATE
- GM ONLY
- INVITE ONLY
- GM FUNDED
- TRADING
- GAME

Status badges must be visually secondary to the competition title.

Use the existing ChartVolt badge/ribbon assets where already available.

---

# 8. Shared Summary Metric Row

Directly below the hero use 4 large summary metric cards.

Each card includes:

- large neon icon
- small label
- strong main value
- optional secondary text
- subtle accent glow

Do not use tiny icons aligned with tiny text.

Example component:

```tsx
<CompetitionSummaryStat
  icon="trophy"
  label="Prize Pool"
  value="20"
  unit="Volts"
/>
```

---

# 9. Shared State-Based CTA System

The primary CTA must come from existing competition/user state.

Do not hardcode CTA text by page type.

Possible states:

```ts
type CompetitionCTAState =
  | "join"
  | "reserve"
  | "join_now"
  | "already_in"
  | "join_gm"
  | "view_results"
  | "view_details"
  | "competition_full"
  | "registration_closed"
  | "add_volts"
  | "not_eligible";
```

Labels:

```text
Join Competition
Reserve Spot
Join Now
Already In
Join GM to Enter
View Results
View Details
Competition Full
Registration Closed
Add Volts
Not Eligible
```

Reuse the existing ChartVolt CTA button graphics/components.

Do not replace them with generic browser buttons.

---

# 10. Shared Countdown Logic

Use one timing model:

```ts
type CompetitionTimingState =
  | "scheduled"
  | "starting_soon"
  | "live"
  | "ending_soon"
  | "completed"
  | "cancelled";
```

Output:

```ts
{
  timingState,
  startsAt,
  endsAt,
  countdownLabel,
  countdownValue,
  urgency
}
```

Examples:

```text
Starts in 4d 10h 20m 21s
Ends in 02:14:36
Starts Today at 18:00 UTC
Live Now
Completed
```

Use one shared clock/ticker for the page.

Do not create one interval per widget.

---

# 11. Shared Right Sidebar Structure

Both competition types use this hierarchy:

```text
1. Registration / CTA
2. Countdown
3. Schedule
4. Competition-specific key detail
5. Rewards / Prize information
6. Rules / Fair Play
7. Optional advanced information
```

Do not put 10–15 equally sized accordion boxes one after another without hierarchy.

---

# 12. Shared Data-Agnostic Competition Model

Use one normalized view model.

```ts
type CompetitionDetailVM = {
  id: string;
  title: string;
  description?: string;

  type: "game" | "trading";

  game?: {
    id: string;
    name: string;
    artwork?: string;
    accent?: string;
  };

  status: string;

  access: {
    type: "public" | "private" | "gm" | "invite";
    gmName?: string;
    eligible: boolean;
  };

  funding?: {
    type: "player" | "gm";
    entryFee: number;
  };

  timing: {
    state: CompetitionTimingState;
    startsAt?: Date;
    endsAt?: Date;
    countdownLabel?: string;
    countdownValue?: string;
  };

  summaryStats: CompetitionStat[];

  leaderboard: LeaderboardData;

  sections: CompetitionDetailSection[];

  cta: {
    state: CompetitionCTAState;
    label: string;
    disabled?: boolean;
  };
};
```

Do not build separate hardcoded page logic for every future game.

---

# PART A — DESKTOP GAME COMPETITION PAGE

# 13. Game Competition Page Goal

The Game Competition page should feel like:

- a premium game event page
- visually exciting
- easy to understand
- competition-first
- not overloaded
- immediately clear how to join, play, rank, and win

Use the supplied target game competition image as the visual benchmark.

---

# 14. Game Hero

Recommended hero content:

```text
[LIVE NOW] [BATTLE ROYALE]

Power-Up Pursuit: High-Score Showdown!

Push your skills, make your moves, and climb the leaderboard.
Compete for epic rewards and prove you're the ultimate champion!
```

This tone is correct:
- playful
- energetic
- easy to understand

Avoid formal wording.

---

# 15. Game Summary Cards

Recommended default cards:

```text
Prize Pool
Entry Fee
Players Joined
Mode
```

Possible alternatives based on game:

```text
Board Size
Rounds
Duration
Track
Laps
Scoring
Difficulty
```

Use the most important 4 in the top row.

Do not force irrelevant fields.

---

# 16. Game Main Content — Competition Overview

Use a large Overview card.

Structure:

```text
┌────────────────────────────────────────────────────┐
│ Competition Overview                               │
│                                                    │
│ Short, friendly competition explanation            │
│                                                    │
│ ------------------ | Key Features                  │
│                    | • Leaderboard rewards         │
│                    | • Real-time rankings          │
│                    | • Skill-based scoring         │
│                    | • Fair play                   │
│                    | • Rewards for top players     │
│                                                    │
│                    | [small game preview artwork]  │
└────────────────────────────────────────────────────┘
```

Use short sentences.

---

# 17. Game Main Content — How It Works

Use 4 visual steps.

```text
1. Join
   Secure your spot.

2. Compete
   Play by the event rules.

3. Climb the Leaderboard
   Push your best score.

4. Win Rewards
   Top players share the prize pool.
```

Use large numbered circles or neon step icons.

---

# 18. Game Leaderboard

Use a dedicated large section.

Columns should adapt to the game.

Examples:

### Score-based game

```text
Rank
Player
Score
Reward
```

### Racing

```text
Rank
Player
Best Time
Points
Reward
```

### Puzzle

```text
Rank
Player
Score
Time
Reward
```

Never assume one universal score field.

---

# 19. Game Leaderboard Empty State

Do not show a tiny trophy icon in a huge empty panel.

Use:

```text
No challengers yet.

Be the first to jump in and claim the top spot.
```

Include:
- larger icon/artwork
- centered text
- optional CTA if user is eligible

---

# 20. Game Sidebar — Join Card

Top sidebar card.

Possible message:

```text
You're Not Registered Yet
Jump in now and compete for the rewards.
```

Primary CTA:

```text
Join Competition
```

For upcoming:

```text
Save Your Spot
Reserve Spot
```

For private GM:

```text
Join this Gamemaster to unlock the competition.
Join GM to Enter
```

For joined:

```text
You're In!
Your place in the competition is secured.
Already In
```

---

# 21. Game Sidebar — Countdown

Use large countdown cells:

```text
12      09      48      18
DAYS    HOURS   MINS    SECS
```

Below:

```text
Starts
Ends
```

If live:

```text
Time Remaining
LIVE NOW
```

---

# 22. Game Sidebar — Prize Breakdown

Use:

```text
Rewards Breakdown

1st Place      10 Volts
2nd Place       5 Volts
3rd Place       2 Volts
```

Use:
- gold
- silver
- bronze

If prize rules are percentage-based, show percentages.

---

# 23. Game Sidebar — Event Details

Only show relevant data.

Possible:

```text
Format
Scoring
Mode
Board Size
Rounds
Track
Laps
Difficulty
Game Version
```

Do not show empty labels.

---

# 24. Game Sidebar — Rules & Fair Play

Compact final card:

```text
Rules & Fair Play

Play fair, follow the competition rules, and let skill decide the winner.

[View Rules]
```

---

# PART B — DESKTOP TRADING COMPETITION PAGE

# 25. Trading Competition Page Goal

The Trading Competition page should feel like:

- a competitive market arena
- premium but easy to understand
- data-rich without becoming an analytics admin page
- focused on participants, leaderboard, entry rules, scoring, and rewards

Use the supplied trading target image as the visual benchmark.

---

# 26. Trading Hero

Recommended content:

```text
[STARTING SOON] [TRADING]

Arena of Trading Titans: Clash for Glory!

Battle traders from around the world in this high-stakes trading competition.
Show your strategy, climb the leaderboard, and compete for rewards.
```

Keep the tone energetic but professional.

Avoid complex finance jargon in the main hero.

---

# 27. Trading Summary Cards

Default top cards:

```text
Prize Pool
Entry Fee
Participants
Starts In / Time Left
```

Do not put all technical trading configuration at the top.

---

# 28. Trading Main Content — Leaderboard First

The Leaderboard is the most important main content section for trading.

Use a large card directly under the summary metrics.

Header:

```text
Leaderboard
See how you rank against other traders in real time.
```

Optional top-right toggles:

```text
Prize Pool
Min Trades
```

---

# 29. Trading Leaderboard Columns

Recommended:

```text
Rank
Trader
Capital / Equity
P&L
ROI %
Win Rate
Trades
Score
```

Only show fields required by the scoring model.

Do not show every available account field.

---

# 30. Trading Leaderboard Empty State

Use:

```text
No traders in yet.

Be the first to enter and claim the top spot.
```

Avoid technical wording like:
- “No participants”
- “0 records”

---

# 31. Trading Tabs

Under leaderboard use tabs:

```text
Overview
Rules
Scoring
Assets
```

Optional future tabs:

```text
Risk
Prizes
History
```

Use a large active-tab state.

Reuse the ChartVolt navigation/tab style.

---

# 32. Trading Overview Tab

Split into two columns.

## Left
### About This Competition

Example:

```text
A global trading competition where skill, strategy, and discipline meet.
Trade across the allowed markets under real competition rules and climb the ranks.
```

Below, feature cards:

```text
Trade Live Markets
Compete Globally
Climb the Ranks
Prove Your Skills
```

## Right
### How It Works

```text
1. Join the Competition
   Meet the entry rules and secure your spot.

2. Trade During the Event
   Trade the allowed markets during the competition window.

3. Climb the Leaderboard
   Your performance is ranked using the competition scoring rules.

4. Win Rewards
   Top traders share the prize pool.
```

---

# 33. Trading Sidebar — Entry Requirements

This is the top and most important sidebar card.

Show:

```text
Entry Fee
Your Balance
Eligibility
Minimum Trades
Access Type
```

Only show relevant fields.

Player-friendly messages:

### Eligible

```text
You're ready to compete.
Hit Enter Competition to lock in your spot.
```

### Insufficient Volts

```text
You need 10 more Volts to enter.
Top up your balance and come back ready to compete.
```

### Private GM

```text
This competition is for players under GM [Name].
Join the GM first to unlock entry.
```

Primary CTA must come from shared CTA logic.

---

# 34. Trading Sidebar — Countdown

Use same component as Game page.

Title changes based on state:

```text
Competition Starts In
Competition Ends In
Time Remaining
```

Do not create a trading-only countdown component.

---

# 35. Trading Sidebar — Schedule

Show:

```text
Schedule (UTC)

Start Time
End Time
```

Use UTC consistently if that is the backend standard.

If local time is also shown, label it clearly.

---

# 36. Trading Sidebar — Difficulty

Use a clear horizontal difficulty visual.

Example:

```text
Beginner      Intermediate      Skilled      Expert
```

Highlight the configured level.

Do not use an overly thin progress line.

---

# 37. Trading Sidebar — Rewards Breakdown

Use the same visual reward component as the Game page where possible.

Example:

```text
1st Place     50%
2nd Place     30%
3rd Place     20%
```

or Volts if fixed-value.

---

# 38. Trading Rules Tab

Group trading rules into readable cards.

Possible groups:

### Trading Setup
- Starting Capital
- Leverage
- Allowed Assets

### Participation Rules
- Minimum Trades
- Trade Window
- Position Rules

### Risk Rules
- Daily Loss Limit
- Maximum Drawdown
- Disqualification Conditions

Do not expose these as a long stack of single-line rows.

---

# 39. Trading Scoring Tab

Show the scoring model in plain language first.

Example:

```text
How Your Score Is Calculated

Your ranking is based on:
• P&L performance
• risk-adjusted return
• minimum trade requirements
• competition-specific scoring rules
```

Then show technical fields below if needed.

Use progressive disclosure.

---

# 40. Trading Assets Tab

Display allowed assets with recognizable chips/cards.

Examples:

```text
EUR/USD
GBP/USD
BTC/USD
ETH/USD
XAU/USD
```

If many assets:
- searchable
- grouped
- scrollable within the section

Do not display a giant unstructured list.

---

# 41. Trading Risk Management Section

Use compact readable summary cards.

Possible:

```text
Daily Loss Limit
Max Drawdown
Leverage
Exposure Limit
Stop-Out Rule
```

Use strong warning colors only when relevant.

Do not make the whole section red.

---

# 42. Trading Disqualification Section

Use an alert-style expandable section.

Example:

```text
Disqualification Rules

You may be disqualified if:
• maximum drawdown is exceeded
• prohibited assets are traded
• competition rules are violated
```

Keep this separate from normal stats.

---

# 43. Shared Data Rendering Rules

Create helper functions.

```ts
getCompetitionSummaryStats(competition)
getCompetitionDetailSections(competition)
getCompetitionLeaderboardColumns(competition)
getCompetitionSidebarSections(competition)
getCompetitionCTA(competition, user)
```

Rendering must be driven by data.

Do not use:

```ts
if (game === "VoltStack") ...
if (game === "CircuitSprint") ...
```

for page layout.

Use metadata/configuration.

---

# 44. Competition Section Schema

Recommended:

```ts
type CompetitionDetailSection = {
  id: string;
  title: string;
  icon?: string;
  type:
    | "stats"
    | "list"
    | "steps"
    | "table"
    | "progress"
    | "alert"
    | "accordion"
    | "chips";
  items: CompetitionDetailItem[];
  priority: number;
};
```

This makes the page future-proof.

---

# 45. Monetary Display Rules

Use the existing ChartVolt Volt symbol everywhere.

Do not use:

```text
$
€
USD
```

for platform entry fees or platform prizes unless a separate fiat equivalent is intentionally displayed.

Examples:

```text
20 ⚡
10 Volts
Prize Pool: 250 Volts
```

Use the actual ChartVolt Volt asset, not a generic lightning emoji, in production UI.

---

# 46. Buttons and Menu Items

Reuse:

- existing ChartVolt CTA buttons
- existing Menuitems style
- existing leaderboard button style
- existing navigation button style
- existing state buttons

Do not draw new generic button systems for these pages.

---

# 47. Playful Wording Guide

Use short, encouraging wording.

## Prefer

```text
Jump in and secure your spot.
The top spot is wide open.
Climb the ranks.
Prove your strategy.
Push your best score.
Trade smart.
Race the clock.
Win your share.
You're ready to compete.
You're already in.
```

## Avoid

```text
Participant registration required.
No participant records.
Competition eligibility requirements not satisfied.
User account has insufficient available balance.
```

---

# 48. Empty State Components

Create reusable:

```tsx
<CompetitionEmptyState
  icon={...}
  title="No challengers yet"
  description="Be the first to jump in and claim the top spot."
/>
```

Trading version:

```text
No traders in yet
The top spot is yours for the taking.
```

---

# 49. Loading States

Use skeleton loading matching the target layout.

Skeletons:

- hero
- 4 summary cards
- leaderboard
- sidebar CTA
- sidebar countdown

Do not show a blank page with one spinner.

---

# 50. Error States

If a section fails:

- keep the rest of the page
- show inline retry card
- do not destroy the full page

Example:

```text
We couldn't load the leaderboard.
[Retry]
```

---

# 51. Suggested Shared Component Structure

```text
components/
  competition-detail/
    shared/
      CompetitionDetailShell.tsx
      CompetitionHero.tsx
      CompetitionStatusBadges.tsx
      CompetitionSummaryStats.tsx
      CompetitionSummaryStat.tsx
      CompetitionLeaderboard.tsx
      CompetitionEmptyState.tsx
      CompetitionCTA.tsx
      CompetitionCountdown.tsx
      CompetitionSchedule.tsx
      CompetitionPrizeBreakdown.tsx
      CompetitionDifficulty.tsx
      CompetitionRulesCard.tsx
      CompetitionInfoCard.tsx
      CompetitionTabs.tsx

    game/
      GameCompetitionDetail.tsx
      GameCompetitionOverview.tsx
      GameHowItWorks.tsx
      GameEventDetails.tsx

    trading/
      TradingCompetitionDetail.tsx
      TradingOverview.tsx
      TradingHowItWorks.tsx
      TradingRules.tsx
      TradingScoring.tsx
      TradingAssets.tsx
      TradingRisk.tsx
```

---

# 52. Responsive Desktop Behavior

Desktop only for this specification, but still support:

```text
1024px
1280px
1440px
1600px
1920px+
```

At narrower desktop widths:

- reduce gaps
- keep sidebar readable
- never shrink text below minimum
- allow summary stat cards to wrap 2x2 if required

Do not make the page miniature.

---

# 53. Accessibility

Ensure:

- text contrast passes
- buttons have accessible names
- status does not rely only on color
- countdown has readable labels
- tab state uses ARIA
- accordion states are accessible
- keyboard focus is visible

---

# 54. Performance

Reuse already loaded artwork where possible.

Use:
- optimized images
- lazy-loading below the fold
- memoized derived competition data
- shared countdown ticker

Do not continuously rerender the full page every second.

Only countdown values should update on tick.

---

# 55. Game Page Acceptance Criteria

Do not mark complete until:

- game hero matches the target visual hierarchy
- game artwork is clear and readable
- status and mode are obvious
- four top summary cards are readable
- overview card is structured
- key features are easy to scan
- How It Works uses four clear steps
- leaderboard is prominent
- leaderboard columns adapt to game scoring
- no-player state is polished
- CTA is the first sidebar section
- countdown is large and readable
- prize breakdown is visually strong
- game-specific data appears only when relevant
- Volt symbol is used correctly
- existing ChartVolt buttons are reused
- page does not look like an admin screen

---

# 56. Trading Page Acceptance Criteria

Do not mark complete until:

- trading hero matches the target layout
- hero feels like a competitive trading arena
- four top summary cards are readable
- leaderboard is the first major main content block
- leaderboard columns reflect the actual scoring model
- empty leaderboard state is polished
- tabs are clear and reusable
- overview explains the competition simply
- How It Works is easy to understand
- Entry Requirements is the first sidebar block
- entry logic uses real eligibility
- countdown is prominent
- schedule is easy to read
- difficulty is visually understandable
- prize distribution is easy to scan
- assets/rules/scoring are grouped, not raw rows
- risk information is readable
- disqualification rules are separated clearly
- Volt symbol is used correctly
- existing ChartVolt buttons are reused
- page does not feel like an admin configuration screen

---

# 57. Final Instruction to Cursor

The supplied target images are the visual benchmark.

Do not simply restyle the current implementation.

Rebuild the information hierarchy so the final desktop pages have:

- a strong cinematic hero
- large readable summary metrics
- clear main-content / sidebar hierarchy
- premium ChartVolt graphics
- strong competition identity
- short player-friendly wording
- consistent existing buttons
- Volt currency treatment
- reusable sections
- game/trading-specific data without hardcoding layout
- enough information for advanced users without overwhelming new users

The result should feel like a polished competition product page, not a database dump or admin dashboard.
