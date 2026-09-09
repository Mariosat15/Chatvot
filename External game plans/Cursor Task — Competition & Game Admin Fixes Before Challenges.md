# PRIORITY TASK — COMPLETE ALL ITEMS BELOW BEFORE WORKING ON CHALLENGES

Do **not** start the previously planned Challenges work:

> “Challenges side — picking trading-or-game, then a title, then adapting the setup page to that title's shape.”

First complete every task in this specification.

Work through the tasks **one by one**, in order.

For every task:
1. Inspect the existing implementation.
2. Fix the frontend.
3. Fix the backend/business logic where applicable.
4. Check all related APIs/types/models.
5. Check admin + user-facing pages.
6. Test edge cases.
7. Confirm the task is complete before proceeding to the next one.
8. Do not leave temporary hardcoded game-specific logic.

The implementation must remain generic enough to support many different game types in the future.

---

# TASK 1 — USE VOLTS EVERYWHERE INSTEAD OF EUR FOR COMPETITIONS

We must stop displaying competition-related values in EUR.

For both:

- Trading Competitions
- Game Competitions

all platform competition monetary/value amounts must be displayed as:

**Volts**

Not:
- EUR
- €
- Euro
- USD unless there is an unrelated external payment/deposit screen where fiat is genuinely required.

Review the complete platform and identify every place related to competitions where EUR/€ is still shown.

Examples include but are not limited to:

- Entry Fee
- Buy-in
- Entry Cost
- Prize Pool
- Total Prize
- Prize Distribution
- Player Prize
- Winner Prize
- Current Pool
- Guaranteed Pool
- Added Prize
- Rewards
- Competition cards
- Competition lobby
- Competition details
- Competition setup
- Admin competition setup
- Admin game configuration
- Leaderboards
- Results screen
- Completed competition screen
- Wallet values relating to competition participation
- Competition transaction descriptions
- Confirmation dialogs
- Registration confirmation
- Modals
- Tables
- Tooltips
- Game pages
- Trading pages
- Admin preview
- AI-generated competition content if it mentions currency

For example:

Wrong:
`Entry Fee: €50`

Correct:
`Entry Fee: 50 Volts`

Wrong:
`Prize Pool: €1,000`

Correct:
`Prize Pool: 1,000 Volts`

Do not just visually replace the symbol in one component.

Create/use a consistent formatter where appropriate so competition-related credit values always render as Volts.

Example concept:

`formatVolts(500) -> "500 Volts"`

or according to the UI design:

`500 V`

if a compact Volts format is already officially used.

Keep formatting consistent across the platform.

---

# TASK 2 — FIX PRIZE ELIGIBILITY RULES

The current completed competition result shown in the referenced image is wrong.

Example problem:

There are 3 players.

Player 1 has a valid positive score.
Player 2 has a valid positive score.
Player 3 has a score of `0`.

Currently all 3 can receive a prize.

This must change.

A participant should only be included in prize distribution if they are an **eligible winner**.

## GAME COMPETITION ELIGIBILITY

A game competition participant is NOT prize-eligible if:

- score = 0
- no valid score was submitted
- participant was disqualified
- participant otherwise failed the competition's eligibility requirements

A player with score `0` must NOT receive prize money merely because their leaderboard position happens to fall inside a prize position.

Example:

Prize distribution configured:

1st = 50%
2nd = 30%
3rd = 20%

Players:

1. John — 5,000 score
2. Anna — 3,000 score
3. Peter — 0 score

Peter is NOT eligible.

Therefore the prize pool must be redistributed between the eligible winners according to the platform's redistribution logic.

Do NOT give Peter the 20%.

---

# TASK 3 — APPLY THE SAME RULE TO TRADING COMPETITIONS

Trading competitions need the equivalent eligibility rules.

A trading competition participant must NOT receive a prize if they are:

- Disqualified
- Liquidated
- Invalid according to competition eligibility rules

These players must be excluded from the winning/prize calculation even if their leaderboard position originally falls inside a prize-paying position.

For example:

Configured:

1st = 50%
2nd = 30%
3rd = 20%

Results:

1. Trader A — valid
2. Trader B — valid
3. Trader C — liquidated

Trader C receives:

`0 Volts`

The pool that would have been assigned to Trader C must be redistributed between the eligible winners.

---

# TASK 4 — CREATE A GENERIC ELIGIBLE PARTICIPANT / WINNER SYSTEM

Do not duplicate completely separate prize logic for every game.

Create a clean generic concept such as:

`isPrizeEligible`

or an equivalent competition result state.

The competition engine should first determine:

`eligibleParticipants`

Then rank/distribute prizes only among those eligible participants.

Game competitions may use:

- score > 0
- not disqualified
- valid result

Trading competitions may use:

- not disqualified
- not liquidated
- valid result
- any other existing qualification requirements

The core prize engine should therefore operate on eligible winners rather than blindly using the top N leaderboard positions.

This rule must work for **all competition types**.

---

# TASK 5 — PRIZE REDISTRIBUTION RULES

Important:

Prize redistribution should happen ONLY when at least **one eligible participant exists**.

Examples:

## Scenario A

3 prize positions.

Results:

1. Valid
2. Valid
3. Score 0

There are eligible players.

Redistribute the total prize pool between Player 1 and Player 2.

## Scenario B

Trading:

1. Valid
2. Liquidated
3. Disqualified

There is one eligible player.

The competition's distributable prize pool should go to the valid winner according to the normalized prize distribution.

## Scenario C

Games:

1. Score 0
2. Score 0
3. Score 0

There are **no eligible winners**.

Do NOT distribute the prize.

## Scenario D

Trading:

1. Liquidated
2. Disqualified
3. Liquidated

There are **no eligible winners**.

Do NOT distribute the prize.

---

# TASK 6 — NORMALIZE PRIZE PERCENTAGES WHEN WINNERS ARE REMOVED

When some prize positions become invalid because players are ineligible, normalize the configured prize percentages across the remaining eligible winners.

Example configured payout:

1st = 50%
2nd = 30%
3rd = 20%

Player 3 is invalid.

Remaining configured percentage:

50 + 30 = 80

Normalize:

Player 1:

50 / 80 = 62.5%

Player 2:

30 / 80 = 37.5%

Therefore, for a 1,000 Volt prize pool:

Player 1 = 625 Volts
Player 2 = 375 Volts

Total:

1,000 Volts

Nothing should disappear from the distributable pool when there are eligible winners.

Use proper decimal/rounding handling so we never accidentally create or lose Volts due to rounding.

---

# TASK 7 — UNCLAIMED POOL

If there are **zero eligible winners**, move the competition prize pool into the platform's:

**Unclaimed Pool**

Do NOT:

- pay disqualified players
- pay liquidated players
- pay zero-score players
- automatically return it to invalid players
- silently destroy the prize amount

The amount must be recorded as unclaimed platform competition funds.

Create/reuse proper backend accounting for:

`Unclaimed Pool`

We need to be able to identify:

- Competition ID
- Competition type
- Game if applicable
- Original prize pool
- Amount moved to Unclaimed Pool
- Reason
- Timestamp
- Number of participants
- Number of eligible winners
- Relevant status

Possible reason examples:

- `NO_ELIGIBLE_WINNERS`
- `ALL_PLAYERS_DISQUALIFIED`
- `ALL_PLAYERS_LIQUIDATED`
- `NO_VALID_GAME_SCORES`
- equivalent clean enum implementation

Do not create duplicate pool entries if competition settlement is called twice.

Competition settlement must be idempotent.

---

# TASK 8 — FIX THE LARGE GAME ADMIN/SETUP SCREEN FROM THE REFERENCED IMAGE

The screen shown in the referenced image needs redesigning.

It currently does not match the rest of the modern admin theme.

Update it so it uses the same overall design system as our newer admin pages.

The page should be:

- larger
- wider
- primarily horizontal/desktop optimized
- less cramped
- modern
- clean
- consistent
- easier to scan

Use the same visual language as the rest of the updated platform:

- cards
- spacing
- borders
- rounded corners
- typography
- input styling
- dropdown styling
- buttons
- tabs
- page width
- section headings
- status badges
- background
- accent styling

Do not create a separate visual design language for games.

---

# TASK 9 — ADD GAME TYPE / CATEGORY

On the game configuration screen we need a way to assign the type/category of game.

Add a field such as:

**Game Type**

Examples could include:

- Racing
- Circuit
- Puzzle
- Arcade
- Strategy
- Sports
- Shooter
- Survival
- Card
- Board
- Trivia
- Reflex
- Other

The exact architecture should support adding more types later.

Prefer either:

- controlled configurable categories from admin

or a combination of:

- predefined category
- custom category

rather than hardcoding a tiny permanent list.

This game type must be available to the rest of the platform because it can influence:

- competition formats
- game performance widgets
- AI-generated content
- UI labels
- game discovery/filtering
- banners
- analytics

---

# TASK 10 — ADD COMPETITION STYLE / PARTICIPATION MODE

Different games require different competition structures.

This is extremely important.

We cannot assume that every game competition works the same way.

For example:

## Circuit Sprint

Players do NOT necessarily need to start at exactly the same time.

A competition could be open for a defined period.

Player A enters at 10:00.
Player B enters at 12:30.
Player C enters at 16:00.

Each participant completes their attempt/session and their score/time is recorded.

At competition close, valid scores are compared.

This is an:

**Asynchronous / Flexible Entry Competition**

But imagine a racing game where players race each other directly.

Everyone may need to enter and start at the same time.

This is:

**Synchronous / Live Competition**

We therefore need a configurable competition style.

At minimum support concepts similar to:

### 1. Asynchronous / Flexible Entry

Players can join/play at different times during the competition window.

Suitable for:

- Circuit Sprint style scoring
- Tetris
- high-score games
- puzzle games
- time trials
- trivia attempts
- many arcade games

### 2. Synchronous / Live Start

Players must be present and start together.

Suitable for:

- multiplayer racing
- PvP games
- battle games
- direct multiplayer matches

### 3. Turn-Based

Players take turns.

Suitable for:

- board games
- card games
- strategy games

### 4. Round / Heat Based

Competition consists of multiple heats or rounds.

Suitable for:

- racing tournaments
- elimination formats
- tournament games

The architecture should be extensible.

Do not simply write:

`if game === "Circuit Sprint"`

This should be configured through metadata.

Something similar to:

`competitionMode`

or:

`participationMode`

Possible values:

- `ASYNC`
- `SYNCHRONOUS`
- `TURN_BASED`
- `ROUND_BASED`

Use names that fit the existing architecture.

## 10.1 — WHAT WAS BUILT, 9 September 2026

**Two of the four modes were already built and enforced before this task was written.** That
is the most important fact here, and a summary that reads Task 10 as unstarted is wrong. The
axis exists as `provider_game.playMode`, resolved once in `lib/services/games/play-shape.ts`,
with `anytime` for asynchronous entry and `scheduled` for a live start. Everything the task
asks the mode to *do* was already derived from it at write time — entry closing at the gun,
one attempt only, the round-start control withheld, the schedule step relabelled — and no
runtime gate anywhere switches on a game code, which is the requirement that mattered.

**What was missing was any way to say so from a screen.** `playMode` arrives with the
provider's catalogue, which is right for a third party — they know whether their title is a
race — and wrong for ChartVolt Games, where the declaration is a TypeScript literal in
`games-service/src/games/titles.ts` that only changes on a rebuild and a redeploy. So the
answer to "how does the admin specify this per game" was: they could not.

Two things closed that, and they are treated as the whole of Task 10 for now:

1. **A Play style control on the Games list**, per title, writing a new
   `provider_game.playModeOverride` through its own section-guarded route
   (`PATCH /api/games/providers/[providerKey]/games/play-style`) with its own audit line. It
   is deliberately **not** part of the title-and-logo content editor: that dialog writes copy
   an operator can get wrong harmlessly, whereas this decides when entry closes and how many
   attempts a player gets on a contest people have paid into. `playModeOverride` is in
   `NEVER_EDITABLE_CONTENT_FIELDS` for the same reason `chartvoltEnabled` is.
2. **The style shown where it is chosen and where it is used** — on every row of the Games
   list, and as a badge on the contest wizard's game picker, because it changes the rest of
   the wizard more than any other property of the title.

**Three details are load-bearing and easy to undo by tidying up:**

- **It is a SECOND field, not an edit to `playMode`.** `playMode` is a member of
  `providerOwnedFields` in `catalogue.service.ts`, so a control writing there saves, toasts,
  and is reverted by the next catalogue sync with no error and nothing in a log. That is the
  "control that appears to work and does nothing" shape already on record for a provider
  enabled with no adapter, a `rankingMethod` a provider game ignores and `isPaused` on a
  provider contest. `playModeOverride` is in no sync list, and because that is a property of
  an allow-list elsewhere rather than of the field itself, it is pinned by a test that runs a
  real sync and asserts the provider's own field **was** rewritten in the same pass.
- **`head_to_head` beats the override, not the other way round.** Two people cannot play each
  other at different times, so a value stored against such a title would be read by nothing —
  the class of declared, written, dead field found four times in this programme. The service
  refuses it and the control withholds itself with the reason, both from `canOverridePlayMode`.
- **The names are the codebase's, not the task's.** `anytime` and `scheduled` on `playMode`,
  not `ASYNC` / `SYNCHRONOUS` on a new `competitionMode` — which is what "use names that fit
  the existing architecture" asks for, and renaming would be a mirrored migration of a stored
  field for a cosmetic gain.

## 10.2 — Turn-based and heat-based: BLOCKED, not deferred

`TURN_BASED` and `ROUND_BASED` join the **per-round provider cost** on the blocked list, and
the reason is the same in both cases: **there is no real thing to build against.**

A turn-based contest needs a game that takes turns and a provider protocol that can carry
them; a heat-based one needs a bracket, and a bracket needs opponents. Nothing in the
catalogue works either way, no provider has been signed, and `01`'s issued contract describes
one round producing one score. Designing either now means inventing a protocol, a schedule and
a UI against no counterparty, then discovering on the first real integration which half of it
was wrong — while carrying two more values through every gate, every wizard step and every
migration in the meantime.

**What that costs us is nothing, because the refusal is already expressible.**
`supportsOneVsOne` says a title cannot be challenged, and `playMode` covers the two shapes we
can actually run. A provider offering a turn-based title is an X4 conversation, and the honest
sequence is: sign one, read what they support, then design.

---

# TASK 11 — GAME-LEVEL SUPPORTED COMPETITION MODES

Each game should define which competition modes it supports.

Example:

Circuit Sprint:

- Async: YES
- Synchronous: possibly YES if supported later
- Turn Based: NO
- Round Based: possibly YES

A multiplayer racing game may support:

- Synchronous: YES
- Async time trial: YES

The admin should therefore be able to configure:

**Supported Competition Modes**

Then, when creating a competition for that game, only compatible modes should be selectable.

The system should not allow an administrator to accidentally create an unsupported competition structure.

---

# TASK 12 — ADD REQUIRED TIMING/RUNTIME SETTINGS

The competition configuration should adapt according to the selected participation mode.

For example:

## ASYNC

Show fields such as:

- Registration Opens
- Registration Closes
- Play Window Opens
- Play Window Closes
- Attempts Allowed
- Maximum Session Duration
- Late Entry Allowed
- Score Submission Deadline

## SYNCHRONOUS

Show fields such as:

- Registration Opens
- Registration Closes
- Required Start Time
- Player Check-In Window
- Lobby Opens
- Countdown
- Grace Period
- Minimum Players
- Maximum Players
- What happens to players who fail to connect
- Match/session duration

## TURN BASED

Potentially:

- Turn duration
- Turn order rules
- Inactivity timeout
- Maximum rounds

## ROUND BASED

Potentially:

- Number of rounds
- Qualification rules
- Heat size
- Advancement rules
- Round duration

Do not show irrelevant configuration fields for a competition style.

---

# TASK 13 — GAME CONFIGURATION MUST BE DATA-DRIVEN

The game configuration page needs to describe the game's capabilities.

Consider a schema similar conceptually to:

```ts
game: {
  name,
  slug,
  type,
  description,
  logo,
  banner,
  thumbnail,

  supportedCompetitionModes: [],

  scoring: {
    type,
    direction,
    allowZero,
    ...
  },

  capabilities: {
    multiplayer,
    synchronous,
    asynchronous,
    rounds,
    attempts,
    ...
  }
}
```

This is only an architectural example.

Adapt it correctly to the project's current models.

Do NOT blindly copy this if the existing architecture has a better model.

The objective is to remove game-specific assumptions from UI and business logic.

---

# TASK 14 — SCORE CONFIGURATION

Different games do not always use the same scoring logic.

Game configuration should be able to describe its scoring model.

Examples:

### High score wins

Tetris:

`8,500` beats `6,200`

### Lowest time wins

Circuit Sprint:

`00:48.2` beats `00:51.7`

### Highest points wins

Arcade games.

### Placement wins

Racing:

1st / 2nd / 3rd.

### Wins / losses

PvP games.

Therefore add a generic scoring definition such as:

- score type
- score unit
- higher-is-better / lower-is-better
- display format
- whether zero is a valid result
- minimum eligible score if required

Important:

For the prize rule mentioned earlier, we said score `0` is normally invalid.

But architect this properly because some future games could theoretically use zero as a valid result.

Therefore make eligibility game-configurable while setting the correct defaults for our existing games.

For Circuit Sprint, a player with no completed valid result must not receive a prize.

---

# TASK 15 — ADD GAME LOGO / BANNER / IMAGE ASSETS TO IMAGE OPTIMIZER

We already have an **Image Optimizer** inside Admin.

The images used for games are currently heavy.

Extend the Image Optimizer so it also includes all game-related image assets.

This includes at least:

- Game Logo
- Game Thumbnail
- Game Card Image
- Game Banner
- Competition Banner
- Hero/game artwork
- Any game background images
- Existing images already uploaded for games
- New game images uploaded from the game configuration page

Administrators should be able to:

- see the image
- see original size
- see optimized size
- optimize/compress
- know optimization status
- identify which game uses the image

Use sensible modern formats where supported, such as WebP/AVIF, without breaking compatibility.

Avoid visibly degrading logos/artwork.

Do not optimize the same image repeatedly if it is already optimized.

---

# TASK 16 — OPTIMIZE UPLOADS AUTOMATICALLY WHERE APPROPRIATE

Inspect how the current image optimizer works.

If possible within the existing architecture, game image uploads should pass through the optimization pipeline automatically or clearly expose an optimization action immediately after upload.

Prevent unnecessarily huge images from being delivered to users.

Also ensure appropriate dimensions are generated where useful for:

- thumbnails
- cards
- banners
- logos

Do not load a huge banner-sized source image just to display a 100px thumbnail.

---

# TASK 17 — REMOVE LEGACY GAME

Remove the:

**Legacy Game**

We do not need to see it anymore.

Remove it from the relevant:

- game list
- selectors
- admin page
- competition setup
- previews
- filters
- default values
- seed data where appropriate

Be careful not to break old database records.

If historical competitions reference the legacy game, preserve historical data safely but prevent it from appearing as an active/selectable game.

Use inactive/archived behavior if required rather than deleting data that historical competition records depend on.

---

# TASK 18 — FIX THE OTHER SCREEN SHOWN IN THE LAST IMAGE

The screen shown in the last referenced image also needs to be redesigned.

It must match the general updated admin theme.

Problems to fix:

- it is too cramped
- page width is inconsistent
- layout is inconsistent
- it does not visually match the newer pages

Update it to use a larger horizontal desktop layout similar to the rest of the platform.

Use the same:

- page container width
- cards
- spacing
- titles
- sections
- tabs
- inputs
- buttons
- borders
- typography
- component styling

Do not just stretch the existing content.

Actually reorganize the content so the larger width is useful.

---

# TASK 19 — ADD AI CONTENT GENERATION TO GAME CONTENT

The game configuration/content screen needs AI assistance as well.

Add AI content generation/editing similar to the other areas of the platform.

AI should assist with content such as:

- Game Title if required
- Short Description
- Full Description
- Competition Introduction
- Rules
- How to Play
- Scoring Explanation
- Player Instructions
- Banner copy
- Marketing text
- SEO/meta description where applicable
- Competition description
- Result/leaderboard explanatory content where relevant

But the AI must **adapt to the selected game**.

Do not generate generic text that assumes every game is a racing game.

---

# TASK 20 — AI MUST BE GAME-AGNOSTIC AND CONTEXT-AWARE

When generating content, send relevant structured game information to the AI.

Examples:

- game name
- game type
- game description
- competition style
- scoring method
- scoring direction
- supported competition modes
- rules
- attempts allowed
- game capabilities
- selected competition structure

Example:

If selected game is Circuit Sprint:

AI understands that it is based around circuit/time/performance.

If selected game is Tetris:

AI should not talk about race laps.

If selected game is a trivia game:

AI should talk about questions/points.

The AI feature must therefore be data-driven.

Do NOT implement:

```ts
if (gameName === "Circuit Sprint") {
  ...
}
```

for every game.

---

# TASK 21 — FIX GAME PERFORMANCE SECTION

The **Game Performance** area currently appears to contain hardcoded assumptions.

This must be fixed.

The Game Performance section must be **game-agnostic**.

It should identify which game is associated with the competition/player/result.

Then render performance information that is actually supported by that game.

Example problem:

We currently do not have the Circuit Sprint performance implementation/data in a particular place, but the UI still shows Circuit-specific performance content.

That is wrong.

Do not show performance widgets simply because they were previously hardcoded.

---

# TASK 22 — PERFORMANCE MODULES MUST BE CAPABILITY-DRIVEN

Create a generic performance system.

Possible performance metrics depend on game type.

Examples:

## Circuit / Racing

Could include:

- Best Time
- Average Time
- Laps
- Position
- Completion %
- Best Lap
- Attempts

## Tetris

Could include:

- Score
- Lines
- Level
- Combo
- Blocks
- Duration

## Trivia

Could include:

- Correct Answers
- Incorrect Answers
- Accuracy
- Response Time
- Score

## Puzzle

Could include:

- Completion Time
- Moves
- Score
- Hints
- Accuracy

But only show values actually supported by the game.

Game metadata/API should declare or provide its performance schema/capabilities.

The frontend then renders what exists.

---

# TASK 23 — DO NOT SHOW A PERFORMANCE SECTION IF THERE IS NO DATA

If the selected game does not provide detailed performance data, do not show fake/empty/hardcoded Circuit performance.

Either:

1. Hide the Game Performance component entirely

or

2. Show an intentional empty state such as:

`Detailed performance metrics are not available for this game.`

depending on what best fits the design.

Do not show irrelevant metrics.

---

# TASK 24 — IDENTIFY THE GAME AUTOMATICALLY

The result/performance page should determine the game from the competition itself.

It should not require hardcoded assumptions.

Flow:

Competition
→ Game ID
→ Game configuration
→ Performance schema/capabilities
→ Render relevant metrics

If game information is missing, handle it gracefully.

---

# TASK 25 — MAINTAIN CONSISTENCY ACROSS ALL UPDATED GAME ADMIN PAGES

After fixing these screens, review all related game admin pages together.

They should feel like one system.

Check:

- Page headers
- Breadcrumbs
- Back buttons
- Save buttons
- Publish/active state
- Tabs
- Card widths
- Page width
- Forms
- Field labels
- Help text
- Tooltips
- Status badges
- Empty states
- Loading states
- Error states
- Mobile fallback
- Desktop layout

Desktop can be the primary design for admin, but it must still degrade reasonably on smaller screens.

---

# TASK 26 — REVIEW DATABASE / API MODELS

Inspect the existing game and competition models.

Add the required fields cleanly rather than storing important logic only in frontend state.

We will likely need support for concepts such as:

- Game Type
- Competition/Participation Mode
- Supported Competition Modes
- Scoring Configuration
- Score Eligibility
- Game Capabilities
- Performance Metric Definitions
- Image Assets
- AI Context
- Archived/Active State

Use migrations/default values/backward-compatible handling where required.

Do not make existing games crash because a newly introduced field is undefined.

---

# TASK 27 — BACKWARD COMPATIBILITY

Existing games and competitions must continue loading.

For existing records that do not yet contain new metadata:

Use sensible defaults.

Do not produce:

- undefined labels
- broken forms
- crashes
- blank selectors
- invalid performance cards

Legacy data should be handled safely.

---

# TASK 28 — COMPETITION SETTLEMENT MUST BE SERVER-SIDE

Prize eligibility and prize redistribution rules must be enforced by the backend.

Do NOT rely only on frontend filtering.

The backend must be authoritative for:

- eligibility
- ranking
- prize calculation
- prize redistribution
- disqualification
- liquidation
- zero/invalid score
- unclaimed pool
- settlement status

The frontend should display the backend result.

---

# TASK 29 — PREVENT DOUBLE SETTLEMENT / DOUBLE PAYMENT

Check competition finalization.

A competition must never pay prizes twice if:

- webhook repeats
- game sends final event twice
- worker retries
- admin accidentally triggers completion twice
- server restarts during settlement

Settlement needs to be idempotent.

Use the existing transaction/accounting system correctly.

---

# TASK 30 — ADD TESTS FOR THE NEW PRIZE RULES

Add tests covering at minimum:

### Game

- 3 valid positive scores
- 2 valid + 1 zero
- 1 valid + 2 zero
- all zero
- valid + disqualified
- all disqualified
- no submitted scores

### Trading

- all valid
- valid + liquidated
- valid + disqualified
- valid + liquidated + disqualified
- all liquidated
- all disqualified
- mixture of liquidation/disqualification

### Settlement

- prize percentages normalize correctly
- total paid always equals distributable pool when at least one eligible winner exists
- no eligible winners → entire amount goes to Unclaimed Pool
- settlement retry does not create duplicate payments
- settlement retry does not create duplicate Unclaimed Pool records

---

# TASK 31 — TEST COMPETITION MODE LOGIC

Test:

### ASYNC

Players can start at different times within the allowed play window.

### SYNCHRONOUS

Players must obey start/check-in timing.

### Unsupported mode

Admin cannot select a mode the selected game does not support.

### Changing selected game

If administrator changes the selected game while creating a competition:

- supported modes refresh
- incompatible previously selected mode is cleared
- scoring context refreshes
- game-specific fields refresh
- performance expectations refresh

There must be no stale settings from the previously selected game.

---

# TASK 32 — UI VALIDATION

The admin form must explain configuration clearly.

Examples:

**Game Type**
`Racing`

**Competition Style**
`Asynchronous / Flexible Entry`

Help text:

`Players may enter and complete their attempt at different times during the competition play window.`

For synchronous:

`All participants must join and begin the game during the scheduled live start window.`

Administrators should understand the difference without needing developer knowledge.

---

# TASK 33 — REVIEW CIRCUIT SPRINT USING THE NEW SYSTEM

After creating the generic architecture, configure Circuit Sprint through it.

Do not special-case Circuit Sprint in code.

Configure it through game metadata.

Verify:

- correct game type
- correct competition mode(s)
- scoring method
- lower/higher result logic as applicable
- zero/no-result eligibility
- performance data
- logo
- banner
- optimized images
- AI context
- admin appearance
- competition creation flow

If Circuit Sprint does not currently provide a certain performance metric, DO NOT display the metric.

---

# TASK 34 — REVIEW ALL OTHER EXISTING GAMES

Run the same validation on every existing active game.

Make sure no game inherited Circuit Sprint-specific labels such as:

- laps
- race
- circuit
- lap time
- position

unless that game genuinely supports them.

Likewise do not give racing games Tetris-specific metrics.

---

# TASK 35 — FINAL CONSISTENCY AUDIT

Before calling this work finished, search the codebase for:

- `EUR`
- `€`
- hardcoded game names
- `Circuit Sprint`
- `legacy game`
- hardcoded performance labels
- hardcoded competition-mode assumptions
- duplicated prize calculation logic

Determine whether each occurrence is valid.

Competition-facing values must use Volts.

Remove obsolete hardcoded assumptions.

---

# REQUIRED FINAL BEHAVIOR

The final system should work like this:

## GAME CONFIGURATION

Admin creates/selects a game.

Defines:

Game
→ Game Type
→ Assets
→ Supported Competition Modes
→ Scoring Model
→ Eligibility Rules
→ Performance Capabilities
→ AI Context

## COMPETITION CREATION

Admin chooses a game.

System reads that game's capabilities.

Then only shows:

→ supported competition styles
→ appropriate timing settings
→ appropriate score/rule settings

## PLAYER PARTICIPATION

The competition engine follows the selected competition style:

Async / Synchronous / Turn Based / Round Based / future modes.

## RESULTS

Game/trading engine submits final result.

Platform evaluates participant eligibility.

## PRIZE SETTLEMENT

Eligible winners exist:

→ remove invalid participants  
→ normalize prize percentages  
→ distribute full prize pool among eligible winners  

No eligible winners:

→ distribute nothing  
→ move full prize pool to Unclaimed Pool  

## PERFORMANCE

Competition identifies the game.

Game tells UI what performance information exists.

UI renders only relevant information.

No fake Circuit Sprint metrics.

## CURRENCY

All competition entry/prize/reward values:

**VOLTS**

---

# DO NOT START CHALLENGES YET

Only after every task above has been implemented, tested, and visually checked should you proceed to:

**Challenges — choosing Trading or Games, then selecting the title/game and dynamically adapting the challenge setup page to that title/game's configuration.**

Do not start that work before this foundation is complete.

---

# IMPLEMENTATION ORDER

Execute in this exact order:

1. Audit and replace competition EUR/€ presentation with Volts.
2. Implement universal participant prize eligibility.
3. Fix zero-score game prize behavior.
4. Fix trading disqualification/liquidation prize behavior.
5. Implement prize percentage normalization.
6. Implement Unclaimed Pool handling.
7. Make settlement idempotent.
8. Add settlement tests.
9. Add Game Type.
10. Add Competition/Participation Modes.
11. Add per-game Supported Competition Modes.
12. Add adaptive timing/runtime configuration.
13. Add generic scoring configuration.
14. Add game performance capabilities/schema.
15. Make Game Performance completely game-agnostic.
16. Fix/hide unsupported performance data.
17. Redesign the first referenced admin/game page to the wider consistent theme.
18. Redesign the last referenced page to the wider consistent theme.
19. Add adaptive AI content generation.
20. Extend Image Optimizer to game logos, banners and game assets.
21. Optimize game asset delivery/sizing.
22. Remove/archive Legacy Game from active UI.
23. Configure Circuit Sprint through the generic architecture.
24. Validate every other existing game.
25. Run full UI/API/database consistency audit.
26. Run complete regression tests.
27. Only then begin the separate Challenges task.