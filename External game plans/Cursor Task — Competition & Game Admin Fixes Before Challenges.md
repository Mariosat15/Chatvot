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

# STATE OF THE LIST

**Last measured 9 September 2026.** Each "done" row names the sub-section holding the account
of what was actually built, because that section is authoritative and this table is a summary.

**Read this table as a claim about the code, not as evidence about it.** The `PROGRESS.md`
decision log carries the same warning for a reason: *"content seeding is mandatory"* sat on
record from 18 August and was enforced by nothing until 8 September. Check a row against the
code before citing it.

| Task | State |
|---|---|
| **1** — Volts / ⚡ everywhere instead of EUR | **Done.** `1.1`, then `1.2` for the symbol rather than the word |
| **2-7** — Prize eligibility, redistribution, unclaimed pool | **Done, 9 Sep.** See the notes under tasks 2, 5, 6 and 7. Seven raw unclaimed-pool writers were found, not the five task 7 names |
| **8** — Redesign the large game admin screen | Not started |
| **9** — Game type / category field | **Done.** `9.1`. **The field already existed** - what it lacked was a vocabulary. Analytics grouping (21-24) and discovery filtering are explicitly **not** part of it |
| **10** — Competition style / participation mode | **Done.** `10.1`. Turn-based and heat-based are **blocked, not deferred** - see `10.2` |
| **11** — Game-level supported modes | **Done, 9 Sep.** `11.1`, and `22` s10 is the authoritative account. It **reverses** a decision recorded in `22` s8.3 and in `play-shape.ts` itself - the shape is no longer a property of the title alone - and it closed a latent defect where an ordinary edit re-forced a staggered contest's rules from its title. 49 tests, **37 probes red on exactly the expected test**, two of them re-aimed after reporting `DID NOT APPLY` |
| **12** — Required timing / runtime settings | Not started |
| **13** — Data-driven game configuration | Not started |
| **14** — Score configuration | **Done, 9 Sep.** `14.1`. Three operator-owned fields on `provider_game`, their own route and audit line, and a preview pinned **behaviourally** against the gate. 55 tests, **28 probes red on exactly the expected test.** The eligibility *rule* is unchanged - task 2's `> 0` is now the default rather than a constant |
| **15-16** — Image optimizer for game artwork | **Scoped down by owner decision, 9 Sep: on upload only.** Existing files are left alone, so there is no retro-scan to write. See task 15's note - this is a refusal with a reason, not an omission |
| **17** — Remove the legacy game | **Half done.** Circuit Perfect was deprecated 8 Sep and the wizard already filters on `providerStatus: "active"`, so the code is correct. It still needs a **catalogue re-sync** before it leaves the picker, which is an operational step and not a code change |
| **18** — Redesign the other screen | Not started |
| **19** — AI on the game content screen | Not started |
| **20** — AI must be game-agnostic | **Mostly done 8 Sep** for the contest wizard's assistant. Task 19's screen is the remaining gap |
| **21-24** — Game Performance section | Not started |
| **25-27** — Consistency, model review, backward compatibility | Not started |
| **28** — Settlement must be server-side | **Checked and true, for the four payout entry points.** Of the 40 files referencing `distributePrizesWithTies`, `recordUnclaimedPool`, `settleFeesAndGameMasters` or `finalizeCompetition`, **none** declares `"use client"`. Note what that does *not* cover: it names four functions, so a fifth payout path would not appear in it. A standing guard belongs with task 30 |
| **29** — Prevent double settlement | **Done, 9 Sep.** `apps/admin`'s finalize now takes the same optimistic lock the main app does, with the release filtered on `status: "finalizing"` |
| **30** — Tests for the new prize rules | **Done, 9 Sep.** 21 cases in `__tests__/services/prize-rule-matrix.test.ts` (7 game, 7 trading, 4 arithmetic, 1 the reachable divide-by-zero, 2 mirror) plus 5 database-backed idempotency cases in `settlement-retry-idempotency.test.ts`. **24 probes red on exactly the expected test** across `tools/probe-prize-eligibility.ps1` (14) and `tools/probe-prize-redistribution.ps1` (10). Two probes came back green and are recorded in `30.1` with the reason - one was two guards covering each other, the other a mutation that changes no observable and which corrected a wrong comment in the production code |
| **31-35** — Mode logic tests, UI validation, per-game reviews, final audit | Not started |

**The Challenges work named at the top of this document is still gated.** It is not "next";
it is after this list. Two things about it are already decided and worth not rediscovering:
a simultaneous-start title is **not challengeable at all** (`22` s6 answer C, owner decision
8 Sep), and provider challenges inherit **R50** unfixed, because `ChallengeParticipant.score`
still defaults to `0` - so the phantom-score defect reproduces on the first provider challenge.

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

## 1.1 — WHAT WAS BUILT, 9 September 2026

`lib/utils/format-volts.ts`, mirrored byte-for-byte into `apps/admin/lib/utils/`, is the one
way a competition amount is written down. 41 files, 70 tests in
`__tests__/admin/volts-currency.test.ts`, 27 probes in `tools/probe-volts-currency.ps1` red on
exactly the expected test with one failure each, plus one control probe green on purpose.

**Read 1.2 below before trusting any sentence here about WHICH field is read.** This section
rendered `AppSettings.credits.name`; the shipped behaviour renders `credits.symbol`.

**Every amount was already correct and only its unit was a lie**, which is the reason forty
sites survived: there is no error, no log line, and the figure reconciles perfectly against the
ledger. So the guards here are **structural rather than behavioural** — there is no wrong
number to assert on — and a summary calling this a display fix is right about the mechanism
while understating the reach, because the same wrong unit reached players by **email** and
operators in the **settlement logs** they reconcile a contest against.

**Five things are load-bearing and easy to undo by tidying up:**

- **The formatter never converts, and that is a refusal rather than an omission.** Fiat
  conversion has its own stored rate, and while writing this it turned out the platform holds
  **two of those rates and they disagree by a factor of a hundred** —
  `AppSettings.credits.valueInEUR` defaults to 1 credit = EUR 1 and drives the player's
  "approximately EUR x" line, while `CreditConversionSettings.eurToCreditsRate` defaults to 100
  credits = EUR 1 and is what deposits, withdrawals and the admin financial screens move money
  on. A formatter that *could* convert would be one that could quietly pick the wrong one. That
  disagreement is **a separate defect, recorded at the foot of the module and deliberately not
  fixed here** — this work removes the fiat equivalent from competition surfaces rather than
  correcting it, because a contest is denominated in credits and has no business quoting a
  second unit; the wallet and deposit surfaces where it actually bites are untouched.
- **There are TWO units on a trading contest and merging them is the tempting mistake.** A
  prize pool and a reward are credits; a trader's starting capital, equity and P&L are
  *simulated trading capital* in the contest's own quote currency. `LiveRankingPanel` and
  `GameLiveRankingPanel` therefore write Volts and `currSymbol` side by side, and the guard is a
  **count** of `${currSymbol}` interpolations rather than an assertion that it appears — a probe
  relabelling one metric as credits stayed green against the presence check while leaving the
  other one right, which is exactly how half a screen ends up in the wrong unit.
- **An absent amount is a dash, never a zero.** `NaN` is one `parseFloat` away on every admin
  form, and `NaN Volts` in a prize column is worse than a dash because it is a number shaped
  like a payout. Same rule as R45's unheld rank and R50's phantom score: a missing amount and a
  zero amount are different facts.
- **The unit stays configurable and `"Volts"` is only the default.**
  `AppSettings.credits.name` is edited in admin Settings, so a caller with settings loaded
  passes it; the default exists for the server-composed strings — a notification body, a
  settlement log — which have no React context, and putting a settings read on those paths would
  add a database round trip where there is currently none. **A renamed unit therefore reaches
  every screen and not those few strings.** That boundary is recorded rather than implied away,
  and it is a strictly smaller inconsistency than the euro sign it replaces.
- **The assistant's rule is APPENDED to trading's prompt, never written into it.** A test pins
  the historical trading prompt character for character, because it is the only evidence the
  trading wizard still writes what it wrote. So `TRADING_SYSTEM_PROMPT_HISTORICAL` keeps that
  guarantee and `TRADING_SYSTEM_PROMPT` is composed as `HISTORICAL + NO_FIAT_RULE`, shared with
  the provider prompt. The guarantee is now "the historical string **plus one shared rule**",
  which is a real weakening of it and is why the composition itself is asserted — a `toContain`
  on the opening sentence stays green against a prompt somebody has rewritten around it. The
  rule forbids naming a currency **without naming the unit**, since a prompt is the one place
  that cannot read the operator's setting.

**Two carve-outs are correct and must not be "finished off":** deposit, withdrawal and invoice
strings are genuinely fiat, so the notification-service guard is scoped to contest money and a
control probe adding a euro deposit line **must stay green** — a guard that fires on correct
code is one the first person it inconveniences deletes. And the admin analytics screen keeps its
`creditsToEUR` reconciliation figures, which are an operator converting on purpose.

**One defect was introduced by this work and caught before shipping, and the diagnostic is
worth more than the fix.** Five admin challenge-view calls kept the pre-formatting from the
strings they replaced — `formatVolts(challenge.prizePool?.toLocaleString(), { unit })` — so a
**string** reached the formatter, hit the non-number guard, and the prize pool, entry fee and
winner's prize would have rendered as `-`: the absent-amount rule biting from the far side,
and indistinguishable on screen from data that has not loaded. **Neither instrument sufficed
alone.** The typecheck saw **two of the five**, because that page's challenge object is loosely
typed so `?.toLocaleString()` widens to `any`; every structural test here stayed green, because
they ask whether a screen reads the fiat symbol and it does not. **Diffing the typecheck against
a stashed baseline is what found it** — two new entries inside 225 are invisible in a count.
Closed with a **repo-wide scan** rather than a list of the five files, plus a behavioural test
that a pre-formatted string really does return the dash, without which the scan is a rule whose
cost nobody can see. Probe 23 is aimed at one of the three the compiler could **not** see.

**And four typecheck errors disappeared**, which gets the same suspicion as a rise and was real:
`components/dashboard/ContestStatsCards.tsx` read `settings.credits.decimals` and
`settings.credits.symbol` unguarded on a context that can be `null`, so the dashboard's contest
cards would throw while settings loaded. Four latent crash paths went with the unit fix —
incidental, and recorded because the diagnostic generalises.

**Not done, and not a rounding-up:** the two disagreeing conversion rates above, and the
wallet/transaction surfaces outside competitions.

## 1.2 — THE SYMBOL, NOT THE WORD, 9 September 2026

Section 1.1 rendered the credit **name** — `AppSettings.credits.name`, defaulting to the word
`Volts`. The owner's instruction was the **symbol**: `AppSettings.credits.symbol`, edited in
admin **Settings → Currency → Credit Symbol (Emoji)** and defaulting to `⚡`. So an entry fee
reads `50 ⚡`, not `50 Volts`. 1.1 is correct as history and **stale as a present fact** for
every sentence that says which field is read; nothing else in it changed.

**It is one field along, and that is exactly why it is worth its own section.** The task, the
tests and the probes all said "unit" and read the wrong property of the right object, which
typechecks, renders, and is only wrong to somebody who opens the currency screen.

**Five things came out of it:**

- **Singularisation had to be REMOVED, and the two tests that pinned it were inverted rather
  than deleted.** A word has a plural and a glyph does not, so `1 Volt` was right and
  `⚡`.replace(/s$/) is destructive — it strips the last character of whatever the operator
  configured. The comment explaining why an entry fee of 1 is an ordinary amount is the most
  valuable part of those tests, so it survives with the assertion turned round.
- **The two probes for that stayed GREEN, and the cause was the FOURTH one: the mutation
  changed no observable.** Re-adding the singulariser against the default `⚡` produces `⚡`,
  because there is no trailing `s` to strip. The tests only asserted the default. Fixed by
  adding a configured symbol that ends in one — the field is free text, so an operator typing
  a word is the case that exposes it — and the rule the pair now pins is the general one:
  **the configured symbol is rendered verbatim and never edited.**
- **The symbol goes AFTER the number, and a test pins it.** `50 ⚡`, matching the wallet, the
  deposit modal and the currency settings preview. Putting it in front is the fiat convention
  and therefore what a later edit "corrects" it to — and an emoji ahead of a figure reads as an
  icon beside an unlabelled number rather than as a unit.
- **The formatter's default and the schema's default are two definitions with nothing making
  them agree**, so a test compares them. The drift is quiet in the most confusing direction:
  the formatter's copy is on every screen, so the **settings form** is what looks wrong.
- **A codemod did most of the renaming and overreached into four files**, where `creditName`
  was a prose label — a knowledge-base article, a CSV export header — rather than a formatter
  input. Reverted with `git checkout` and the script deleted. The rule: **a rename driven by a
  pattern cannot tell a formatter argument from a sentence**, and the tell was duplicate object
  keys, which the compiler caught. It also converted only some `.select("credits.name")` calls,
  and a missed one is silent — the symbol arrives `undefined` and the default covers for it.

**A measurement error worth recording, because it looked like a live defect for a minute.** A
whole-file regex for the symbol default returned the **euro sign**, which reads as the formatter
and the schema disagreeing. `currency:` sits *before* `credits:` in `app-settings.model.ts`, so
the match was the **fiat** field, where a euro sign is correct. The test slices from `credits:`
first and was right all along. **Scope a probe of a schema to the block you mean**, and check a
finding against the assertion that already passes before believing it.

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

## 9.1 — WHAT WAS BUILT, 9 September 2026

**The field already existed, and that is the first thing to get right about this task.**
`provider_game.category` has been on both model copies since X2: free text, a 40-character
limit, seeded from the provider on the **first sync only** and operator-owned after that,
edited as a plain text box on the game content dialog and rendered raw in two places. So
nothing here adds a field. What did not exist was a **vocabulary**, and its absence is a
specific hazard rather than an untidiness.

**The harm is the one this programme keeps finding, one field along from the last time.**
`category` is the natural grouping key for discovery, for the Game Performance screen and for
analytics, and as free text `Racing`, `racing` and `race` become **three rows that each look
complete**. No error, no log line, and the totals still add up. It is exactly the failure the
analytics slice avoided by grouping on `gameKey` rather than a display name — except here
nobody had made the choice, because the field had no key/label distinction to make it with.

### What it is

`lib/services/games/game-categories.ts`, mirrored into `apps/admin/lib/services/games/`.
Thirteen slug/label pairs — task 9's own list plus `circuit` and `reflex`, which the live and
mock catalogues already declare — with three functions: `isKnownCategorySlug`,
`normaliseCategorySlug` and `resolveGameCategory`.

The task offers two architectures and asks for one of them rather than a hardcoded list. It
was built as the **second** — predefined plus custom — and the reasoning for refusing the
first is worth keeping, because "configurable from admin" sounds strictly better:

> **A `game_category` collection is a deletable grouping key.** Thirteen rows nobody
> administers costs a screen, a route, a model pair and an RBAC decision, and buys the ability
> for an operator to *delete* a category at 2am — orphaning every title and every historical
> figure joined to it. That is the same reasoning that gives providers a disable switch and no
> delete, and that retires a disabled game's rows rather than removing them (R29). **A slug in
> code cannot be deleted.** Adding one is a one-line change; the custom box covers the gap
> until somebody does.

### Five things that drift easily

- **It is deliberately NOT a Mongoose enum, and that is a refusal rather than an omission.**
  A missing enum value **rejects the whole write**, so declaring the vocabulary on the schema
  means a provider shipping a title in a genre we have not thought of **costs us that entire
  catalogue row** — silently, on a scheduled sync, with the row simply absent afterwards. The
  vocabulary is what we *offer*; a stored value we do not recognise is **displayed, never
  refused and never remapped**. Two probes turn red on the enum, one per model copy.
- **An unrecognised slug is shown verbatim.** The mock catalogue's `quiz` is the live example:
  conceptually it is `trivia`, and mapping it would be a silent rewrite of a provider's own
  statement about their game, while dropping it would hide a real grouping key with real
  titles filed under it. It reads "Quiz" and stays the key it already was — the same reason
  the analytics label chain ends at the game code and then the key and **never at "Unknown"**.
- **An absent genre renders nothing, never a placeholder.** `resolveGameCategory` answers
  `undefined` for absent, `null`, `""` and whitespace — the three shapes of missing, plus
  `null` — because a badge reading "Uncategorised" on a player's screen is a genre nobody
  chose, and it makes an unfiled title indistinguishable from a filed one.
- **The validator NORMALISES rather than refusing, which inverts this codebase's usual rule**
  that an unknown value is refused with its name. The difference is what each protects: the
  content dialog submits **every field in one request**, so refusing a legacy free-text
  `category` would block an unrelated edit to a tagline — a title stored as "Racing game"
  before this existed could never have its description fixed. It is accepted as `racing-game`,
  and **the dialog shows the operator the slug before they save**, so nothing is rewritten
  behind their back.
- **Every consumer is handed the LABEL and must not re-derive it.** `listContestableTitles`
  resolves it exactly as it already resolves `playMode`, and the wizard picker, the arena
  badge, the AI prompt and the catalogue list all read the resolved value. A screen that
  re-derives is a second copy of the vocabulary, and two spellings of one genre then depend on
  which screen you are looking at.

### Where it now appears

Task 9 asks for the genre to reach six places. Four are done and two are named as outstanding
rather than implied:

| Destination | State |
|---|---|
| The game content dialog | A dropdown of the vocabulary plus a custom box, showing the slug that will be stored |
| The provider catalogue list | A genre badge beside the game code, dimmed when the slug is not one of ours |
| The contest wizard's game picker | A genre badge, first in the row, because it is the fastest way to tell two titles apart |
| AI-generated content | `describeSubject` composes the prompt from the label |
| The player's arena badge | The label, via `game-presentation.service.ts` |
| **Game Performance widgets and analytics grouping** | **Not built.** Tasks 21–24, and it wants a *group by* rather than a badge |
| **Discovery and filtering, banners** | **Not built.** There is one provider game, so a filter with one value is a control that appears to work |

### Testing

`__tests__/admin/game-categories.test.ts`, 30 tests, and
`tools/probe-game-categories.ps1`, **23 probes, all red on exactly the expected test**.

**Four probes came back green first time and all four are worth recording**, because they are
four different causes and one of them was the harness:

1. **The harness itself.** A probe named a test that did not exist — "genre" where the test
   says "slug" — and vitest treats a `-t` pattern matching nothing as a **passing run over
   zero tests**, so it reported the guard as absent. The harness now refuses any run where no
   test ran. *A probe aimed at a misspelt test name is indistinguishable from a guard that
   does nothing.*
2. **A weak fixture.** The truncation test built its input with the hyphen at index 40, which
   `slice(0, 40)` drops anyway — so the second strip had nothing to do and removing it stayed
   green. The hyphen has to be the **last character kept**, at index 39.
3. **A weak negative assertion.** `not.toMatch(/category:\s*title\.category/)` was satisfied
   by `resolveGameCategory(title.category) ? title.category : undefined`, which calls the
   resolver, **discards its answer and ships the slug**. Fixed by asserting the label
   explicitly and **counting** `title.category` to exactly one mention. Third instance of one
   identifier appearing twice defeating a structural test.
4. **Two guards covering each other**, R42's shape. Both `=== ""` checks in
   `normaliseCategorySlug` answer `null` for an empty input, so removing either leaves the
   other holding the property. Probeable here only because both live in one file, so the
   harness gained a second injection — and the source now says so rather than calling one of
   them dead.

Admin typecheck at **223**, the baseline exactly; main app **194** with and without the
change. `check:mirrors` green — it compares models, so the vocabulary's two copies are held
by a byte-for-byte test instead.

**One existing test was flipped rather than edited.** `game-contest-wizard.test.ts` asserted
the AI prompt received `(puzzle)`, the raw stored value, and it was right about the code on the
day it was written — what it was really recording is that there was nowhere to resolve the
genre. The reason is kept in the test.

**Never verified by eye**: every screen here is behind an admin sign-in the automated browser
has no session for.

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

## 11.1 — WHAT WAS BUILT, 9 September 2026

**`22` section 10 is the authoritative account.** This is the summary.

### What it is

`provider_game.supportedPlayModes` is an operator-owned set. `resolveSupportedPlayModes` unions
the title's own resolved style into it and returns `["scheduled"]` alone for a `head_to_head`
title. The wizard offers a picker built from that set — **only when it holds more than one
entry**, so nothing about the screen moves for the current catalogue — the create service
**refuses** a pick outside it and names what *is* supported, and the chosen mode is **stored on
the contest** as `Competition.playMode`.

### The design reversal, because it must not be discovered by accident

`22` s8.3 and `play-shape.ts`'s own header said the shape is a property of the **title** and
**never** comes from caller input. The create service now takes it from its caller. That rule was
correct for a world where a title had one shape, and the owner's racing-game example — a
synchronised race *and* an async time trial on one title — is what ended that world.

**What survives is the safety, and it is intact.** The pick is validated against a **stored** set,
so a race can be run staggered only if somebody declared that this race has a legitimate
time-trial form; the consequences are still stamped on at **write** time, so no runtime gate reads
a mode; and **no player-facing path supplies a shape at all.**

### The defect this closed on the way

The edit service resolved the shape from the **title**. Correct with one shape per title, and a
live defect the moment a title has two: an ordinary rename would re-force a staggered contest to
one attempt, `until_window_closes` and entry closing at the gun — **under people who had already
paid to enter**, with no error and nothing in a log. Latent, because no title declares a second
shape yet, and **nothing was backfilled** for the same reason. That is why the contest stores its
own `playMode` and why the flipped structural test asserts `resolvePlayShape` is now **absent**
from both services.

### Frozen

`playMode` on the contest is absent from `EditProviderContestInput`, absent from
`toEditRequestBody` and named in `NEVER_EDITABLE_FIELDS` — **three places, because one is a
suggestion.** It decides when entry closes and how many attempts a paying entrant gets, so a
contest that should be the other shape is a new contest. `supportedPlayModes` is on
`NEVER_EDITABLE_CONTENT_FIELDS`, and the play-style route **refuses a request carrying both it and
`playMode`**, so one audit entry can never cover two decisions.

### Testing

49 tests in `__tests__/services/play-shape.test.ts` and **37 probes in
`tools/probe-play-shape.ps1`, every one red on exactly one failure.** Eleven are new; **two
pre-existing ones were re-aimed** after reporting `PROBE DID NOT APPLY`, which reads like a broken
harness rather than a moved target — they had been matching `resolvePlayMode`'s original one-line
body since the operator override replaced it, so two real guards had been sitting unprobed. Full
suite 1,919 green, `check:mirrors` clean, typechecks at baseline (main **194**, admin **223**)
with nothing in a touched file and nothing disappearing.

**Not verified by eye** — both screens are behind an admin sign-in.

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

## 14.1 — WHAT WAS BUILT, 9 September 2026

**The rule did not change. It became a default.** Task 2's owner decision of this morning
shipped as a hard-coded `> 0` inside `providerHasResult`; this replaces that constant with
three fields an operator sets per title, whose absence produces the identical answer. Nothing
settles differently until somebody deliberately turns it on for a game, which is the whole
point - a title synced before these fields existed carries none of them and is unaffected.

**Three of the six things the task lists were already there and were not rebuilt.**
`scoreDirection`, `scoreType` and `scoreRange` have been on `provider_game` since X2 and are
**provider-owned** - they are in `providerOwnedFields` in `catalogue.service.ts`, so a control
writing to them saves, toasts, and is reverted by the next catalogue pull with no error and
nothing in a log. Which is the right split: how a game scores is the provider's fact, whether
a score is worth paying is ours. Display format is `scoreType` plus the new `scoreUnit`.

The three new fields are ours, in no sync list at all:

| Field | Meaning | Absent means |
|---|---|---|
| `zeroIsValidResult` | Does a score of exactly zero count as a result worth paying? | No - the platform rule, and what the constant did |
| `minimumEligibleScore` | An extra bar the score must clear, in the game's own units | No bar |
| `scoreUnit` | Display only. `"points"`, `"ms"`, `"boards"` | No unit shown |

**The live code** is `zeroIsValidResult` / `minimumEligibleScore` / `scoreUnit` on both
`provider-game.model.ts` copies, `resolveScoringRules` in `lib/services/games/score-direction.service.ts`
(mirrored), the read in `lib/games/provider/scoring.ts` (mirrored), the threading in
`provider-settlement.service.ts` (mirrored), and admin-only:
`apps/admin/lib/services/game-providers/game-scoring-rules.service.ts`,
`apps/admin/app/api/games/providers/[providerKey]/games/scoring/route.ts`,
`apps/admin/lib/admin/score-eligibility-copy.ts` and
`apps/admin/components/admin/games/GameScoringDialog.tsx`. Read those, not this prose.

### Seven facts that drift easily

- **`minimumEligibleScore` is DIRECTIONAL, and the word "minimum" is the trap.** The test is
  *at least as good as*, so it reads `score >= bar` upward and `score <= bar` downward.
  Written with `>=` in both directions - which is what the field name invites - it refuses
  every finisher of a race whose time is under the bar, meaning **the better a player did the
  more certainly they are excluded.** That is not a wrong screen; it is the wrong winner paid.
- **A stored `0` and an absent value are different facts, and here they are opposites.** On a
  higher-is-better title a bar of zero *admits* a zero score. So `value || null` at the edge,
  `?? ""` in the dialog, or a truthiness test in the row summary each silently delete the one
  setting an operator is most likely to want on a title where zero is real. R31's
  `referralFeePercentage || 5` in a new place, and four separate probes exist for it because
  the collapse can be reintroduced at four different layers.
- **The three fields are read ONCE per contest and ride on the participant row**, exactly as
  `scoreDirection` has since R32/R33. Not stored per row - per-row storage lets two rows in
  one leaderboard disagree, which is incoherent rather than merely wrong - and not read inside
  the module, because invariant 2 bans a model import there and one provider module serves
  every one of that provider's titles, so a module-level constant would force one module per
  title.
- **The preview is pinned BEHAVIOURALLY against the gate, never against expected strings.** A
  copy test passes for ever while the wording describes the opposite of what settlement does,
  and an operator sets a money rule from that sentence. `describeScoreEligibility` is fed the
  same inputs as `providerHasResult` and the test asserts the sentence agrees with the
  refusal - which is what makes probe 17 possible at all.
- **`zeroIsValidResult` carries NO schema default, deliberately.** `default: false` is the
  obvious spelling and matches today's behaviour exactly, and it is wrong for one reason: it
  writes a real `false` onto every row the sync creates, so an explicit "no" and "nobody has
  said" become indistinguishable and a future reversal of the platform rule cannot tell them
  apart. It was found by a test asserting the sync **invents** nothing, which went red on
  `default: false` alone. `resolveScoringRules` reads `=== true`, so an absent field and a
  stored `false` are the same answer today - and separable tomorrow.
- **All three are on `NEVER_EDITABLE_CONTENT_FIELDS`**, following `playModeOverride`. Two of
  them decide who is paid out of a pot people bought into, so accepting them through the
  content door would let a prize rule change as a side effect of fixing a typo, with the audit
  trail recording a content edit. `scoreUnit` would be harmless there and is barred anyway, so
  that one screen's three fields cannot be written through two doors with two audit lines.
- **The player app RESOLVES these and must never write them.** The service is admin-only and
  unmirrored, matching `game-play-style.service.ts` - a second writer in the app with the
  widest reach and no operator behind it is the door this deliberately does not build.

### Four probing lessons, all of them recurrences

**28 probes, all red on exactly the expected test.** Four were not, and every one is a rule
already on record here in a different costume.

- **Removing a field from the never-editable list stayed GREEN**, because the field is absent
  from the editable allow-list too, so it still fell through to the unknown-field refusal -
  whose message *also* names the field. Identical to `competition-update-fields.ts` and
  `gameKey`. The test now pins **which refusal fired**, not that one did.
- **Deleting the whole `newValue` block stayed GREEN** against `toMatch(/zeroIsValidResult/)`,
  because the human-readable `description` one line above names both fields. Fifth instance
  after `!expectedOrigin`, the fixed-character Edit guard, `canTransitionRound` and
  `MIN_REASON_LENGTH`: **one identifier, two jobs, and a structural test cannot tell which one
  it found.** Now asserted inside the construct, with the slice's length checked first.
- **`-t '$unset'` matches nothing**, because vitest treats the filter as a regex and `$` is an
  anchor. The probe reported the guard absent while the test it named never ran. **A probe
  aimed at nothing is indistinguishable from a test that does not work** - keep filters free
  of regex metacharacters.
- **An em-dash in a probe pattern cannot match the file.** This script is UTF-8 with no BOM,
  PowerShell 5.1 decodes it with the system codepage, and the pattern arrives as mojibake:
  `PROBE DID NOT APPLY`. **Keep probe anchors ASCII**, and anchor on the condition rather than
  the prose whenever the prose is the thing being tested.

**What this does not cover.** Placement scoring and win/loss records - two of the five models
the task lists - need no configuration here and are not built: a provider reporting a placing
or a result reports **a number**, and the platform ranks numbers. If a title ever needs the
platform to understand a ladder, that is a scoring *model* rather than an eligibility rule,
and it belongs with task 13. And nothing here is player-visible: the fields decide settlement
and the sentences are for the operator.

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

## 30.1 — What was built (9 September 2026)

**All 19 cases asked for above are covered, plus two the list did not ask for.** The split is
between what needs a database and what does not, and it is not cosmetic: the arithmetic is
pure, so it is tested in milliseconds, while idempotency is a property of a read-then-write
against a unique index and can only be proven against a real MongoDB.

| File | Cases | Needs a database |
|---|---|---|
| `__tests__/services/prize-rule-matrix.test.ts` | 21 — the 7 game rows, the 7 trading rows, 4 of the settlement rows, the reachable divide-by-zero, and 2 mirror assertions | No |
| `__tests__/services/settlement-retry-idempotency.test.ts` | 5 — duplicate unclaimed pools, the first figure standing, competition-versus-challenge identity, a control that the guard is not refusing everything, and the stored euro rate | Yes |

**24 probes, all red on exactly the expected test**, across `tools/probe-prize-eligibility.ps1`
(14) and `tools/probe-prize-redistribution.ps1` (10).

### Five things from building it, each of which cost a wrong result first

- **A test seeded with the value under test has tested the consumer, not the producer.** The
  settlement suites seed `score` and rank it, which is structurally silent on whether a score
  ever arrives — the same shape as R32/R33. So the matrix asserts eligibility through the
  module seam, and a mirror test asserts the *admin* copy carries the rule, because **vitest
  aliases `@` to the repository root, so no runtime assertion in this suite can see the admin
  file at all.** Two probes on the admin copies were written, both came back green, and both
  were removed with the reason recorded rather than shipped — a green probe left in a harness
  teaches the next reader that the admin copy is decoration.
- **A probe must inject a defect that TERMINATES.** The natural mutation for the rounding
  residue is to delete `residue -= 1`, which reads as "the residue is never consumed" and is
  in fact an infinite loop, because the `i = -1` wrap beneath it restarts the sweep while the
  residue is still positive. The run was killed after 35 minutes and **left `prize-shares.ts`
  mutated on disk**, since a killed PowerShell process never reaches its `finally`. Two rules:
  an injected hang is the one outcome a harness cannot report on unless it owns the clock, so
  it now owns the clock; and after killing a probe run, `git diff` the probed file before
  doing anything else — the restore is the part that did not happen.
- **`Start-Process -FilePath 'npx'` cannot work on Windows, and it fails into the script's
  error stream rather than into a probe result.** `npx` is a shell script with no extension,
  so it is refused with "%1 is not a valid Win32 application" — and written the obvious way,
  **all twelve probes reported nothing at all and the run finished in twenty seconds looking
  like a completed pass.** Launch through `$env:ComSpec /c`, and make the harness say
  `HARNESS BROKEN` when the child never starts.
- **Two guards covering each other cannot be probed separately, and the green probe reads
  identically to a missing guard.** `normalisePrizeShares`'s divide-by-zero guard and
  `allocateWithoutRoundingLoss`'s `Number.isFinite` check both stop a NaN prize, so removing
  either alone leaves the suite green. The harness gained a second edit per probe and the pair
  is now the honest unit of protection. Note this probe was wrong *twice*: aimed first at the
  "nobody is eligible" test, where the guard genuinely changes no answer, because every share
  is `filled: false` and the bad factor is computed and never multiplied. **The one reachable
  shape is a rank that IS held with every held rank configured at 0%**, which is legal, and
  that is what the new case exists for.
- **A green probe corrected the production code rather than the test.** The comment beside
  `targetTotal` claimed deriving it from `configuredTotal` existed "to catch a discrepancy"
  against summing the amounts. Measuring it showed the two agree to within **1e-13** on every
  input the function can construct — `netOf` is linear and the filled shares sum to
  `configuredTotal` by construction — so there is no discrepancy to catch. What the choice
  actually buys is a **cap bounded by the net pot**, and the comment now says so in both
  copies. An overstated comment is a wrong fact, the same duty as correcting R7 and R31
  downward.

**One measurement note.** Every probe on `prize-shares.ts` shows a blast radius one higher
than its honest number, because the mirror test compares the two copies while the harness
mutates only the root one. That is correct behaviour rather than noise, but it is worth
knowing before reading "5 red in suite" as harness damage.

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