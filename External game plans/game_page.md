# Game page rebuild (player `/games/[slug]`)

> **BUILT 21 Sep 2026** — themed player page + admin Page theme / Assets media.
> Live code: `lib/services/games/game-page*.ts`, `components/game-page/*`,
> `app/(root)/games/[slug]/`, admin `GamePageThemeEditor` + content/artwork fields on
> `provider_game`. Themes: circuit-neon (Circuit Sprint mock), racing-heat, strategy-steel,
> arcade-volt, trading-forge, default. Practice is a stub. Never verified by eye.
> **Hotfix 21 Sep 2026:** `gallery` / `howItWorksSteps` / `descriptionTags` are always
> arrays after aggregation (empty `[]` when unset) — an undefined gallery crashed SSR
> with `.slice` after a Page-theme save without assets.
> **Layout pass 21 Sep 2026:** no top Play Now / Ready to Play box; no Leaderboards tab;
> How It Works is a full-width step band; Page Theme editor remounts per `gameKey`.
> **Trading page editor 21 Sep 2026:** Trading → **Trading Page** (`trading-page` grant)
> reuses Page content / Assets / Page theme (no Settings). Store is `game_page_content`
> singleton `gameKey: "trading"` — not a fake `provider_game` row. Player `/games/trading`
> and the catalogue card read it with `TRADING_PAGE_DEFAULTS` fallback.
> The block below is the original Cursor brief kept for history.

---

Copy everything below and give it directly to Cursor:

```text
REBUILD THE PLAYER-FACING GAME DETAIL PAGE FOR CHARTVOLT

Goal:
Rebuild the current Game Detail Page into a premium, modern, neon-futuristic game page like the attached Circuit Sprint reference.

IMPORTANT:
- Do NOT use the screenshot as one background image.
- Build the page with real React/TypeScript components.
- Use real game data from our existing ChartVolt admin settings.
- Keep all current backend logic, APIs, provider settings, competition logic, scoring logic, challenge logic and prize logic.
- This is mainly a UI/UX restructure plus the missing frontend data/functions needed to make the page fully functional.
- The structure must work for Circuit Sprint, Tetris, Penalty Shootout and future games.
- Only the artwork/theme can be game-specific.
- All monetary values must use VOLTS, never EUR.

==================================================
1. ROUTE
==================================================

Use a reusable route such as:

/games/[gameSlug]

Examples:

/games/circuit-sprint
/games/tetris
/games/penalty-shootout

The page must load its content dynamically by game slug.

==================================================
2. MAIN PAGE STRUCTURE
==================================================

Desktop structure:

Top ChartVolt Navigation
↓
Breadcrumb
↓
Large Game Hero Banner
↓
Game Navigation Tabs
↓
Overview Content

Main content layout:

LEFT / CENTER
- Game Description
- Gameplay Preview
- How It Works
- Game Modes
- Live / Upcoming Competitions
- Featured Screenshots / Gallery

RIGHT
- Game Info
- Ready to Play
- Supported Devices

Game tabs:

Overview
How It Works
Leaderboards
Prizes
Challenges
Rules
Gallery

The tabs must switch content inside the same page without a full page reload.

==================================================
3. CREATE REUSABLE COMPONENTS
==================================================

Create a folder similar to:

components/game-page/

Inside create:

GameHero.tsx
GamePageTabs.tsx
GameDescription.tsx
GameplayPreview.tsx
GameInformation.tsx
HowItWorks.tsx
GameModes.tsx
GameContests.tsx
GameLeaderboard.tsx
GamePrizes.tsx
GameChallenges.tsx
GameRules.tsx
GameGallery.tsx
ReadyToPlay.tsx
AvailableDevices.tsx
GameFeatureBadges.tsx
GameEmptyState.tsx

Create graphics components:

components/game-page/graphics/

CircuitSprintHeroGraphic.tsx
CircuitSprintBoardGraphic.tsx
CircuitNode.tsx
ConnectionPath.tsx
PuzzleGrid.tsx
ConnectNumbersGraphic.tsx
NoCrossingGraphic.tsx
CompletedBoardGraphic.tsx

Do not build the entire page in one huge component.

==================================================
4. DESIGN STYLE
==================================================

Use the current ChartVolt dark theme but improve hierarchy and presentation.

Main colors:

Background:
#020817

Panel:
#07152C

Secondary panel:
#081B37

Cyan:
#00D9FF

Blue:
#1677FF

Purple:
#A855F7

Pink:
#FF3CAC

Green:
#15E89D

Gold:
#FFD33D

Muted text:
#8EA9C9

Main text:
#F4F8FF

Use:

- 8–12px rounded corners
- thin blue/cyan borders
- subtle inner glow
- subtle gradients
- purple for primary actions
- cyan for information
- green for live/active states
- gold for prizes
- red only for errors/danger
- consistent card padding
- strong section hierarchy
- no excessive glow everywhere

Do not make the page too busy.

==================================================
5. ICONS
==================================================

Install/use:

npm install lucide-react

Use Lucide icons for generic UI elements such as:

Gamepad2
Trophy
Users
Zap
Clock
BrainCircuit
Medal
Target
Monitor
Smartphone
Tablet
Play
Gift
Swords
GraduationCap
Grid3X3
Link
CircleCheck
CalendarDays
Images
BookOpen
ChevronRight
Info
ExternalLink
Crown
BarChart3

Do not use random emoji for production UI.

==================================================
6. CIRCUIT SPRINT CUSTOM GRAPHICS
==================================================

Generic interface icons can use Lucide.

Circuit Sprint game graphics should be custom SVG/CSS components.

Create:

<CircuitNode number={1} color="cyan" />
<CircuitNode number={2} color="pink" />
<CircuitNode number={3} color="green" />
<CircuitNode number={4} color="gold" />

Create glowing paths:

<ConnectionPath color="cyan" />

Create a puzzle grid:

<PuzzleGrid size={5} />

Create custom How It Works graphics:

<ConnectNumbersGraphic />
<NoCrossingGraphic />
<CompletedBoardGraphic />

Use CSS similar to:

.circuit-node {
  border-radius: 50%;
  box-shadow:
    0 0 8px currentColor,
    0 0 20px currentColor,
    inset 0 0 10px currentColor;
}

Optional subtle animation:

@keyframes circuitPulse {
  0%, 100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.25);
  }
}

Animations must be subtle.

==================================================
7. USE THE EXISTING ADMIN GAME CONTENT
==================================================

Do NOT hardcode the page content separately.

Everything that can come from Admin should come from Admin.

Build a game page data structure similar to:

export interface GamePageData {
  id: string;
  slug: string;

  title: string;
  tagline?: string;
  genre?: string;
  description?: string;

  rulesSummary?: string;
  howToPlay?: string[];

  logoUrl?: string;
  bannerUrl?: string;

  howItWorksImageUrl?: string;
  gameTipsImageUrl?: string;

  highlights?: {
    title: string;
    description: string;
  }[];

  bannerFeatures?: {
    title: string;
    icon?: string;
  }[];

  gallery?: {
    id: string;
    url: string;
    type?: string;
    title?: string;
  }[];

  formats: {
    competition: boolean;
    challenge: boolean;
    practice: boolean;
  };

  playStyle?: string;

  minPlayers?: number;
  maxPlayers?: number;

  supportedDevices?: {
    desktop: boolean;
    tablet: boolean;
    mobile: boolean;
  };

  status: "active" | "inactive" | "deprecated";

  prizeEligibility?: {
    zeroScoreEligible: boolean;
    minimumScore?: number;
    scoreUnit?: string;
  };

  provider?: {
    providerId?: string;
    providerGameId?: string;
    syncStatus?: string;
  };

  gameSettings?: Record<string, unknown>;
}

The existing Admin fields should populate this structure.

For Circuit Sprint load:

- title
- tagline
- genre
- description
- rules summary
- how to play
- logo
- banner
- How It Works image
- Game Tips image
- highlights
- formats
- provider settings
- prize eligibility
- challenge defaults
- game-specific settings

==================================================
8. CREATE ONE SERVER-SIDE GAME PAGE AGGREGATOR
==================================================

Create:

async function getGamePageData(slug: string)

This function should combine all necessary data from:

game
gamePageContent
gameProvider
gameSettings
competitionSettings
prizeEligibility
challengeDefaults
liveCompetitions
leaderboard
gameStats
assets

Do NOT make the React page call many unrelated endpoints separately if it can be avoided.

Return one clean payload.

Example:

const pageData = await getGamePageData("circuit-sprint");

==================================================
9. HERO SECTION
==================================================

Build a large premium hero.

Left side:

Game icon
PUZZLE badge

CIRCUIT SPRINT
FAST AND FUN SPATIAL PUZZLES

Connect the paths, beat the clock!

Under this show game feature items such as:

Strategy
Quick Rounds
All Skill Levels
Multiplayer

These should come from:

bannerFeatures

Right side:

Use either:

game.bannerUrl

or, if missing:

<CircuitSprintHeroGraphic />

Do not bake title/tagline into the image.
Text must remain real HTML so Admin can change it.

==================================================
10. GAME PAGE TABS
==================================================

Create a tab navigation directly below the hero:

Overview
How It Works
Leaderboards
Prizes
Challenges
Rules
Gallery

Use URL state if practical:

/games/circuit-sprint?tab=overview

or:

/games/circuit-sprint#overview

Tabs should not reload the entire application.

On mobile they should scroll horizontally.

==================================================
11. OVERVIEW TAB
==================================================

The Overview tab should contain:

Game Description
Gameplay Preview
Game Info
How It Works
Game Modes
Contests
Ready to Play
Available On
Featured / Gallery

==================================================
12. GAME DESCRIPTION
==================================================

Render the Admin description in a premium content card.

Also show small category tags like:

Logic
Strategy
Fast Paced
All Skill Levels

These can come from Admin highlights or derived game metadata.

Do not hardcode them if equivalent Admin data exists.

==================================================
13. GAMEPLAY PREVIEW
==================================================

Create a large visual gameplay preview card.

Use:

gameplay screenshot if uploaded

otherwise:

<CircuitSprintBoardGraphic />

Add a large Play icon overlay.

Optional button:

Watch Gameplay

Do not show a broken image if no screenshot exists.

==================================================
14. GAME INFO
==================================================

Create a right-side Game Info card.

Display dynamically:

Game Type
Puzzle

Skill Level
All Levels

Players
1–100

Modes
Competition, 1v1, Practice

Average Round Time
5–15 min

Supported Devices
PC, Tablet, Mobile

Create helper functions such as:

function getGameModes(game: GamePageData) {
  const modes: string[] = [];

  if (game.formats.competition) {
    modes.push("Competition");
  }

  if (game.formats.challenge) {
    modes.push("1v1");
  }

  if (game.formats.practice) {
    modes.push("Practice");
  }

  return modes;
}

Only display modes actually enabled in Admin.

==================================================
15. HOW IT WORKS
==================================================

For Circuit Sprint create 3 visual steps.

Step 1:

Connect
Match identical numbers with paths.

Step 2:

No Crossings
Paths cannot cross each other.

Step 3:

Complete & Score
Fill the board and submit your score.

Use custom graphics:

<ConnectNumbersGraphic />
<NoCrossingGraphic />
<CompletedBoardGraphic />

If Admin has uploaded:

howItWorksImageUrl

use it as additional artwork.

==================================================
16. GAME MODES
==================================================

Create large visual cards.

Competition

Description:
Play against multiple players and compete for Volts.

1v1 Challenge

Description:
Challenge another player directly.

Practice

Description:
Play solo and improve your skills.

Only display a mode when enabled in Admin.

Each card must be functional.

Create:

function handlePlayCompetition() {
  router.push(`/competitions?game=${game.slug}`);
}

function handleCreateChallenge() {
  router.push(`/challenges/create?game=${game.slug}`);
}

function handlePractice() {
  router.push(`/games/${game.slug}/practice`);
}

==================================================
17. PLAY NOW BUTTON
==================================================

The main Play Now button must be functional.

Create:

async function handlePlayNow()

Logic:

1. If there is a live or joinable competition:
   open the appropriate competition.

2. Otherwise if Practice is enabled:
   open Practice.

3. Otherwise if Challenge is enabled:
   open Create Challenge.

4. Otherwise:
   show a proper "No session currently available" message.

Example:

if (joinableCompetition) {
  router.push(`/competitions/${joinableCompetition.id}`);
  return;
}

if (game.formats.practice) {
  router.push(`/games/${game.slug}/practice`);
  return;
}

if (game.formats.challenge) {
  router.push(`/challenges/create?game=${game.slug}`);
  return;
}

showNoSessionMessage();

Do not make Play Now decorative.

==================================================
18. CONTESTS SECTION
==================================================

Currently there is an empty state:

NO CONTESTS OPEN YET

Keep an attractive empty state when there are no competitions.

Example:

No Contests Open Yet

There are no live or upcoming contests for Circuit Sprint right now.

Buttons:

Browse All Contests

Create a Challenge

But automatically replace the empty state when competitions exist.

Create:

async function getGameCompetitions(gameId: string)

Competition cards should support:

Live
Upcoming
Starting Soon
Completed if needed

Each card should show:

competition title
entry fee in Volts
player count
max players
prize pool in Volts
start time
end time
status
Join button

NEVER show EUR.

Always use VOLTS.

==================================================
19. READY TO PLAY CARD
==================================================

Create a strong CTA card.

Example:

Ready to Play?

Join a competition, challenge a friend or practice your skills.

Button:

Play Now

This button should call the same:

handlePlayNow()

Do not duplicate different navigation logic.

==================================================
20. SUPPORTED DEVICES
==================================================

Create an Available On card.

Show icons dynamically:

Desktop
Tablet
Mobile

Only show platforms enabled in game.supportedDevices.

Use:

Monitor
Tablet
Smartphone

Do not invent support for platforms not enabled.

==================================================
21. LEADERBOARD TAB
==================================================

Create:

async function getGameLeaderboard(gameId: string)

Structure:

interface GameLeaderboardEntry {
  userId: string;
  username: string;
  avatar?: string;
  score: number;
  rank: number;
  bestTime?: number;
  gamesPlayed?: number;
}

Show columns:

Rank
Player
Best Score
Best Time
Games Played

Filters:

Today
Week
Month
All Time

Highlight the current user.

Use the real game scoring data.

==================================================
22. PRIZES TAB
==================================================

Show real game/competition prize rules.

Display:

Prize rules
Score eligibility
Minimum score
Zero-score rule
Competition payout behavior

IMPORTANT:

Do not create new prize logic here.

Read the result from the existing ChartVolt prize engine.

The platform prize rules remain:

Score = 0:
No prize.

Disqualified:
No prize.

Liquidated trading participant:
No prize.

When a winner becomes invalid:
their prize share is redistributed among remaining valid winners.

Redistribution happens only if at least one participant has a valid result.

If everyone is invalid or has no score:
the prize goes to the Unclaimed Pool.

The frontend should DISPLAY these results/rules.
It must not independently recalculate payouts differently from the backend.

==================================================
23. CHALLENGES TAB
==================================================

If Challenge mode is enabled, show:

Create 1v1 Challenge

Fields:

Opponent
Entry Volts
Duration
Game settings
Create Challenge

Load the initial values from Admin Challenge Defaults.

For Circuit Sprint settings include, where available:

durationSeconds
gridSize

Do not hardcode provider settings.

Read them dynamically from:

gameSettings
challengeDefaults

==================================================
24. RULES TAB
==================================================

Display:

rulesSummary
howToPlay
score rules
qualification rule
tie behavior if available
prize eligibility
provider-specific rules

Use readable cards and ordered steps.

Do not expose internal implementation details.

==================================================
25. GALLERY TAB
==================================================

Use assets uploaded from Admin.

Display:

banner
logo
screenshots
gameplay images
How It Works image
Game Tips image
other gallery assets

Create:

<GameGallery images={game.gallery} />

Add lightbox support when a user clicks an image.

Do not show broken placeholders.

==================================================
26. FEATURED SCREENSHOTS
==================================================

On Overview show up to 3 visual screenshots.

Priority:

1. Uploaded gameplay screenshots
2. Uploaded gallery assets
3. Generated/fallback game-specific SVG graphics

For Circuit Sprint fallback graphics can use:

<CircuitSprintBoardGraphic />

Do not show generic grey placeholders.

==================================================
27. GAME-SPECIFIC DATA
==================================================

Circuit Sprint can use custom graphics and settings.

But the architecture must remain generic.

Example:

if (game.slug === "circuit-sprint") {
  use Circuit Sprint specific graphics;
}

Do NOT create a completely separate frontend page just for Circuit Sprint.

Tetris, Penalty and future games should use the same Game Detail Page components.

==================================================
28. ADMIN INTEGRATION
==================================================

The player-facing page should automatically reflect Admin changes.

Admin fields should map to this page:

Title
→ Hero title

Tagline
→ Hero subtitle/tagline

Genre
→ Hero category badge

Description
→ Overview description

Rules Summary
→ Rules / How You Win

How to Play
→ How It Works / Rules

Logo
→ Game icon

Banner
→ Hero artwork

How It Works picture
→ Overview How It Works image

Game Tips picture
→ Game tips / featured artwork

Highlights
→ Feature cards / badges

Banner Features
→ hero feature icons

Formats
→ Game Modes

Play Style
→ Game information

Prize Eligibility
→ Prize tab

Challenge Defaults
→ Challenges tab

Provider Settings
→ Game mode/settings data

Live status
→ page availability

If Admin changes these values, the player page should update automatically.

==================================================
29. IMAGE / ASSET FALLBACKS
==================================================

Use this fallback priority:

Hero:
game.bannerUrl
→ custom game graphic
→ generic ChartVolt game background

Logo:
game.logoUrl
→ generated initials/game icon

How It Works:
game.howItWorksImageUrl
→ game-specific SVG illustration

Game Tips:
game.gameTipsImageUrl
→ custom game graphic

Gallery:
uploaded gallery
→ fallback game illustrations

Never show a broken image.

==================================================
30. RESPONSIVE DESIGN
==================================================

Desktop:

Hero full width.

Main Overview content:
approximately 70% content / 30% sidebar.

Tablet:

Stack some secondary cards.
Keep hero wide.
Game Info can move below Gameplay Preview.

Mobile order:

Hero
Play Now
Game Info
Description
How It Works
Game Modes
Contests
Ready to Play
Gallery
Available On

Make tabs horizontally scrollable.

Use large touch targets.

Avoid tiny text.

No horizontal page overflow.

==================================================
31. LOADING STATES
==================================================

Add proper loading skeletons for:

hero
description
contests
leaderboard
gallery
stats

Do not show blank white areas.

==================================================
32. EMPTY STATES
==================================================

Create reusable empty states for:

No competitions
No leaderboard entries
No screenshots
No challenges available
No prizes configured

Use proper icons and short messages.

==================================================
33. ERROR STATES
==================================================

Handle:

game not found
provider unavailable
failed assets
failed competition request
failed leaderboard request

Use a ChartVolt styled error panel.

Do not crash the page.

==================================================
34. ACCESSIBILITY
==================================================

Use:

real buttons
labels
aria-labels
keyboard accessible tabs
alt text
visible focus states
sufficient contrast

Do not build clickable divs where buttons should be used.

==================================================
35. PERFORMANCE
==================================================

Use:

Next/Image for images where appropriate
lazy load gallery images
avoid loading all gallery assets immediately
memoize derived data where useful
avoid excessive client-side fetching
avoid large unnecessary animations

==================================================
36. IMPORTANT UI RULE
==================================================

Do NOT merely restyle the existing plain page.

Restructure it into a premium game-detail experience.

It should visually feel like:

a proper game product page
+
competition hub
+
game information center

while staying inside the existing ChartVolt design system.

Use game artwork, neon illustrations, game mode cards, real images, clear hierarchy and strong CTAs.

Do not place every setting inside plain text panels.

==================================================
37. IMPORTANT DATA RULE
==================================================

All content must remain DATA DRIVEN.

Do not hardcode content in the frontend that already exists in Admin.

The only game-specific frontend logic should be optional artwork/visual treatment.

Use:

Admin
→ Database/API
→ getGamePageData()
→ Game Detail Page

==================================================
38. IMPORTANT BACKEND RULE
==================================================

Do not rewrite or duplicate:

competition scoring
prize distribution
wallet logic
Volts logic
player eligibility
provider scoring
challenge settlement

Use the existing backend engine.

The frontend only displays the state and calls the appropriate existing actions.

==================================================
39. VOLTS
==================================================

All game financial values must display in Volts.

Examples:

Entry Fee
10 ⚡

Prize Pool
1,030 ⚡

Winner Prize
11.25 ⚡

Never:

€
EUR
USD

for these competition/game values.

==================================================
40. FINAL RESULT
==================================================

When finished, the Circuit Sprint page should visually follow the supplied reference:

- premium large hero
- real Circuit Sprint artwork
- clear game title/tagline
- game feature badges
- tabs
- large gameplay preview
- attractive game description
- game information sidebar
- illustrated How It Works
- Competition / Challenge / Practice cards
- functional Play Now
- live contest cards or polished empty state
- featured screenshots
- leaderboards
- prizes
- challenges
- rules
- gallery
- responsive mobile experience

Do not create a fake demo page.

Integrate this into the existing ChartVolt frontend and existing APIs.

Preserve current functionality while upgrading the presentation, navigation and player experience.
```
