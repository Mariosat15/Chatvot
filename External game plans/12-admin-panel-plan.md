# 12 - Admin Panel Plan (part of X6)

`09` section E5 covers the **provider-specific** admin screens: provider list, health,
catalogue sync, round inspector, manual resolution. This chapter covers everything else
the admin panel needs before it can run a platform with more than one kind of game.

That work exists whether the games come from inside or outside. It was previously
delegated to `New games plan` chapter `07`; in the external-only scenario it belongs
here.

---

## 1. Navigation restructure

`apps/admin/components/admin/AdminDashboard.tsx` holds a `menuGroups` configuration and
a `renderContent()` switch covering roughly **60 sections**. Trading-specific and
generic sections are interleaved, so there is no way to hide trading.

### Target grouping

| Group | Contents | Visibility |
|---|---|---|
| **CONTESTS** | Competitions, challenges, participants, results, refunds | Always |
| **GAMES** | Game catalogue (`16`), game types registry, providers, provider health, round inspector, **and one destination per game — trading is the first** | Always |
| **PLAYERS** | Users, KYC, restrictions, fraud, messaging | Always |
| **MONEY** | Wallet, transactions, financials, payouts, Game Masters | Always |
| **PLATFORM** | Settings, environment, content, wiki, employees | Always |

Use the same conditional-visibility pattern `components/UserSidebar.tsx` already uses
for `arenaEnabled`. Do not invent a second mechanism.

**Deviation, built 2 September 2026: there is no separate TRADING group.** The table used
to carry one, and building it showed that a top-level TRADING group beside a GAMES group
re-states the thing the restructure exists to remove — it keeps trading a category of the
admin panel rather than an entry in one. Trading is now a collapsible destination *inside*
GAMES, so the second game arrives as its **sibling** rather than as a new group, and the
diff that adds it touches one array element. Everything section 1.1 requires is unchanged;
only the container moved.

### 1.1 TRADING becomes one destination with internal tabs

**Owner requirement, 2 September 2026:** *"all trading aspects must be in a separate tab
with all the tabs inside, so the admin can navigate all the related trading from there."*

The grouping above is necessary but not sufficient. A menu **group** still presents six
top-level entries; the requirement is a single **destination** whose internals are tabs.
That distinction matters for the reason the whole restructure exists: trading has to stop
being the shape of the admin panel and become one item in it.

| | Before | After |
|---|---|---|
| Top-level entries for trading | ~6, interleaved with generic sections | **1** - "Trading" |
| Navigating between trading screens | Back out to the sidebar each time | Tabs within the section |
| Hiding trading entirely | Impossible | One conditional on `tradingEnabled` |

**Internal tabs, as built:** Symbols · Market Hours · Market Data · Risk & Margin ·
Price Health · Trading History.

**Two corrections to the list this chapter used to carry, and the direction they came from
is the lesson.** It named an **Arsenal** tab, which is not an admin section at all —
`apps/admin/contexts/TradingArsenalContext.tsx` is chart tooling with no entry in
`menuGroups` and no `ADMIN_SECTIONS` id, so a tab for it could not have been built as
described. And it **omitted `market-data`**, which is a real trading screen
(`MarketDataSection`).

**`New games plan/07` section "Target structure" had both right.** It listed Market Data,
never mentioned Arsenal, and correctly put Contest Analytics under COMPETITIONS. The error
entered *here*, in the restatement, and survived because it read plausibly. That is the
exact failure the paired-document rule exists to catch, running in the direction people do
not check: **a restatement can be wrong while its source is right, so verifying the source
is not the same as verifying the chapter you are building from.** The practical rule:
**a plan's list of screens is a hypothesis until checked against `menuGroups` and
`ADMIN_SECTIONS` together** — presence in one but not the other is the interesting case,
because the section can then either not be granted or not be reached.

**One section that looked like trading and is not.** `analytics` sat in the old Trading
group and renders `CompetitionAnalytics` — contest analytics, not trading analytics. It
moved to CONTESTS along with `competitions` and `challenges`. Classify by the component a
section renders, never by the group it was filed under; when the group's name is the thing
being corrected, that name is the least reliable evidence available.

Three things to get right, each of which is a way this goes wrong quietly:

1. **Deep links must keep working.** Existing admin URLs and any bookmark or wiki link
   pointing at a trading section must resolve, which means the tab state has to be
   addressable rather than local component state. Collapsing six routes into one
   component with `useState` silently breaks every existing link and every screenshot in
   the admin wiki.
2. **RBAC is per-section, not per-tab.** `ADMIN_SECTIONS` grants access to a *section*.
   Merging six sections into one either widens permissions for everyone who had access to
   any of them, or has to keep the six IDs and gate the tabs individually. **Keep the six
   IDs and gate the tabs** - collapsing them is a silent privilege escalation, and it
   would be invisible on review because the screen still looks correct.
3. **This is a navigation change, not a rewrite.** The six screens keep their existing
   components. Anything more is scope creep into the one part of the admin panel that
   currently works.

### 1.1a How it was built, and why both hard requirements needed no new code

**Built and verified 2 September 2026.** All three cautions above survived, and the first
two turned out to be **already satisfied by mechanisms the admin panel had**, which is the
most useful finding in this section: the risk was real, but the fix was to *reuse*, not to
build.

- **Deep links were already addressable, so nothing had to be invented.** Section state is
  driven by `?activeTab=<sectionId>` — read in `getInitialSection()` and re-applied by an
  effect on `urlActiveTab`. Because each tab **is** an existing section id, `?activeTab=symbols`
  still resolves exactly as before. The `useState` trap in caution 1 is only reachable by
  introducing a *second*, tab-local state; the correct move was to reuse the parameter that
  already existed. The four hard-coded admin deep links (`competitions` ×4, `challenges`,
  `gamemaster-management`, `users`) were checked and all point at ids that did not change.
- **Per-tab RBAC gating already existed as a pattern.** `filteredMenuGroups` shows a parent
  with `children` only when `children.some(hasAccess)` and filters the children
  individually — the exact behaviour caution 2 demands, already used by `settings` and
  `dev-zone-menu`. Trading reuses it, so the six ids stay six independent grants.
- **`ADMIN_SECTIONS` is add-only, and needed no change at all.** It is a **Mongoose enum**
  on `allowedSections` and `customPermissions`, so removing a value orphans every employee
  document already storing it. All six trading ids were already present, so this file was
  not touched. Worth recording: `admin-employee.model.ts` exists **only** in `apps/admin`
  and is *not* a mirrored model, so `check:mirrors` has nothing to say about it.
- **The trading parent grants nothing.** `trading-menu` is deliberately **absent** from
  `ADMIN_SECTIONS`, because it opens a submenu and renders no screen. A permission that
  maps to no screen is the seed of the privilege widening caution 2 warns about.

**One pre-existing limitation, unchanged and worth knowing.** `handleMenuClick` calls
`setActiveSection` without writing the URL, so deep links work *inbound* but the address
bar does not track the current section. The in-page tab bar deliberately behaves the same
way rather than adding history entries only trading screens would produce. Making
navigation write the URL is a whole-panel change and belongs with X6.5, not here.

**What was added:** `apps/admin/lib/admin/game-sections.ts` as the single list of which
sections belong to trading — the sidebar and the tab bar both read it, so they cannot
drift — and `apps/admin/components/admin/trading/TradingSectionTabs.tsx`. The tab bar is
rendered **once**, beside `renderContent()`, so none of the six section components were
edited. It hides itself when fewer than two tabs are permitted, so an employee granted one
trading section does not learn the names of the five they cannot open.

**Pinned by `__tests__/admin/trading-section-nav.test.ts`, 9 tests**, which assert the
six ids are real `ADMIN_SECTIONS` values, that the sidebar still gates each separately,
that the parent grants nothing, that contest sections are not filed under trading, and
that `trading-risk` and `price-health` left their old homes. **Both halves were probed by
reintroducing the defect** — putting `trading-risk` back under Settings turned exactly 1
test red, and dropping a tab from the shared list turned 2 red — because a test that only
ever passes proves nothing. Verified further by a full `next build` of the admin app and a
`tsc --noEmit` that matched the **225-error baseline exactly**, with no error appearing in
the changed files and none disappearing.

### 1.2 Why the admin side goes first

**Owner sequencing decision, 2 September 2026:** admin first, one step at a time, without
breaking the running application. Two reasons, and the second is the operational one:

- **Admin is where a game becomes addable at all.** Until an operator can register a
  provider, sync a catalogue and create a non-trading contest, every player-facing screen
  has nothing real to render.
- **The admin app is the safe place to be wrong.** It is a separate Next.js process with
  no player traffic. A broken admin screen costs an operator an inconvenience; a broken
  player screen costs money and trust.

**This does not move X6 in front of X1.** A second game must be *representable* before it
can be administered, so the foundation still comes first. What admin-first buys is that
when the player UI is built in X7, it is built against data produced by real operator
actions rather than fixtures.

### RBAC - do not forget this

`ADMIN_SECTIONS` in `apps/admin/database/models/admin-employee.model.ts` is the
permission registry. A section not listed there **cannot be granted to an employee**,
so a new screen is invisible to everyone but a super-admin.

**Eight existing sections are already missing** and should be fixed in the same pass:
`journey-map`, `gamification-wizard`, `system-announcements`, `vendors`, `mdb-cluster`,
`server-fleet`, `data-cleanup`, `data-maintenance`.

**New IDs to add:** `game-catalogue`, `game-types`, `game-providers`,
`provider-health`, `round-inspector`.

This is risk **R22** in `17` - low severity, high likelihood, and trivial to prevent.

---

## 2. Competition create and edit - the biggest UI change

`CompetitionCreatorForm.tsx` is a seven-step wizard: Basic Info, Financial, Schedule,
**Trading**, Prizes, Rules, Launch. Step four is hard-coded trading configuration.

### Target

1. **Basic Info** - now includes a **game picker**, populated from
   `listGameModules()` filtered by what is enabled
2. Financial
3. Schedule - plus the **play window** and **grace period** for provider games (`03`)
4. **Game settings** - dynamic, replacing the fixed Trading step
5. Prizes - ranking methods from `module.rankingMethods()`
6. Rules
7. Launch - plus **pre-flight validation** from `03` section 4.1

### How the dynamic step works for provider games

This is where `configSchema` from `01` section 3 pays for itself. The provider declares
each game's settings as JSON Schema; the admin form is **generated from it**. A new
title from an existing provider becomes bookable by ticking a box, with no release.

For trading, keep a hand-written config component registered in
`apps/admin/lib/games/registry.tsx`. Trading's settings are too specific to be worth
schematising, and there is exactly one of them.

### Game type is immutable after creation

The UI must disable the picker on edit, and **the server must reject a change** unless
the contest is still `draft` with zero participants. Changing the game type of a live
contest means participants hold scores in units the settlement code will not understand.

`CompetitionEditorForm.tsx` currently exposes fewer fields than the create form - no
risk limits, no rules, no ranking method. Close that gap or the game settings will be
uneditable after creation.

### 2.1 What was built, 4 September 2026

**Code-complete, and it deviates from the target above in one structural way that needs
stating plainly rather than absorbing.**

**The plan describes one wizard whose step four becomes dynamic. Two wizards were built
instead.** `/competitions/create` — the 2,892-line trading form — is **untouched**, and a
new `/competitions/new` game picker routes to either it or a four-step provider wizard.

The reason is that this section sets two acceptance criteria which a single wizard satisfies
only after a large refactor of the screen live trading contests already depend on: *a
provider contest is creatable without a single trading field appearing*, and *trading
contest creation is unchanged*. Two paths satisfy both immediately and at no risk. The
shared entry point is the picker, which is where the plan's "one way in" actually mattered.
Merging them later is a UI refactor with both behaviours already pinned by tests; doing it
first would have meant editing that file with nothing pinning it.

**The picker redirects straight to trading when no provider game is available.** Until a
provider is live, a "choose your game" screen with one choice is pure friction on the path
operators use daily, and friction there is how a new screen gets worked around.

| Built | Where |
|---|---|
| Game picker, routing to either wizard | `apps/admin/app/competitions/new/page.tsx` |
| Four-step provider wizard: Game, Settings, Timing & prizes, Review | `components/admin/games/ProviderContestWizard.tsx` |
| Settings form generated from `configSchema` | `components/admin/games/ConfigSchemaFields.tsx` |
| Schema parser and validator | `lib/services/games/config-schema.ts` (mirrored) |
| Pre-flight checklist from `03` s4.1 | `lib/services/games/contest-preflight.ts` (mirrored) |
| Round settings read off a stored contest | `lib/services/games/contest-config.ts` (mirrored) |
| Create service and API | `lib/services/game-providers/provider-contest.service.ts`, `app/api/games/contests/route.ts` |

49 tests in `__tests__/services/provider-contest-create.test.ts`, **all 15 guards probed by
reintroducing the defect.**

**It creates a `draft`, and that is required rather than cautious.** The player lobby
filters `status: { $ne: "draft" }`, so a draft is invisible. That matters because the
player-facing side of a provider contest is **X7**: every screen would render trading
furniture, and the join path still copies trading starting capital onto the participant.
The publishing *service* belongs to **X5**; the control that calls it was built 5 September
2026 and is recorded in **s3.1a**. Note the exclusion is `$ne`, not an inclusion list — a
stronger guarantee, because a status added later is hidden by default rather than
accidentally exposed. A structural test pins that line, since the whole safety argument for
creating provider contests now rests on it.

**Six findings worth carrying beyond this section.**

- **A "no developer needed" claim has exactly one failure mode: an aggregate or a form that
  enumerates games.** `ConfigSchemaFields` branches on the declared field *type* and never
  on a game, provider or game code, and a test asserts the file contains none of those three
  identifiers. Without it, the first title needing a special case makes the acceptance
  criterion quietly false while every test still passes.
- **A schema parser must fail closed, and this is where a permissive one does real harm.**
  `allOf`, `pattern`, `oneOf` and the rest are *not* ignored — they refuse the whole schema.
  Silently skipping an unsupported keyword renders a form missing half the real constraints
  and then validates against the half it understood, which is worse than refusing: it
  reports success while accepting settings the provider will reject at play time. Same
  reasoning as the market-hours gate failing closed on an unknown game.
- **A contest missing round settings is refused, never defaulted.** Falling back to
  single-attempt with a grace period is the tidy-looking option and it is wrong: the contest
  runs, players play, and the settings governing their money are ones no operator chose.
  This is what closes X3's `RoundContestConfig` deferral.
- **Warnings and refusals must stay separate, or the whole checklist gets bypassed.** Three
  checklist items are advisory — the platform master switch being off (scheduling ahead of a
  launch is legitimate), no recent sandbox round, and the per-round cost acknowledgement.
  Turning any of them into a refusal would push an operator to flip the platform switch on
  just to draft a contest. Conversely the eleven hard refusals accumulate rather than
  stopping at the first: an operator fixing one per submission gives up by the fourth.
- **The per-round cost warning fires for every multi-attempt policy, because nothing records
  whether a provider bills per round.** `provider_game` has no billing field. A first draft
  of the checklist read `title.billsPerRound` — a field that does not exist — which
  type-checked against a hand-written interface and would have made that warning permanently
  unreachable. **A checklist item gated on a field nobody populates is an item that never
  runs.** Verified against the model's real field list before it went on record; the same
  pass found `lastSuccessfulRoundAt`, which *does* exist and is what the sandbox check reads.
- **The contest API is guarded on `competitions`, not `game-providers`.** Running contests
  and reaching provider API credentials are different jobs, and the per-section grant is the
  only thing keeping them apart. Guarding this route on `game-providers` would have made
  every competition operator a credential holder — and it would have reviewed as consistent.

### 2.2 Editing - BUILT 7 September 2026, and the trading route was a mass-assignment hole

**A provider contest is now editable, and the reason Edit was withheld from it turned out to
be a live defect in the trading path rather than a gap in the provider one.**

`PUT /api/competitions/[id]` did `Object.assign(competition, body)` on the parsed request
body. Every field on `Competition` was therefore writable by anyone holding an admin JWT,
including `gameKey` (immutable, the join key for all historical stats), `gameType`, `status`,
`prizePool`, `currentParticipants`, `contentSeed` and `createdBy`. **`12` s3.1a and `09` E5 —
the only two places it was written down — both described this as a corruption risk *for
provider contests*. It was a mass-assignment vulnerability on trading contests too, and had
been since long before this programme.**

Two things about how it was authenticated compound it, and both are instances of classes
already on record here. The route called **`verifyAdminToken`**, which asks only whether the
caller holds a valid admin token — so an employee granted one unrelated section could rewrite
any contest. That is the **fifth** instance of `requireAdminAuth`-shaped authentication being
mistaken for authorization, after Prerequisite A, the internal-secret fallbacks, the
unprotected suspicion-score route and the provider admin routes. And the GET and DELETE
handlers in the same file had the same weakness, which is why the fix **counts exported
handlers against guards** rather than checking the file mentions the right helper once.

| Built | Where |
|---|---|
| Trading allow-list and the never-editable list | `apps/admin/lib/admin/competition-update-fields.ts` |
| Freeze rules, model-free, shared with the UI | `apps/admin/lib/admin/provider-contest-edit-policy.ts` |
| Provider edit service | `apps/admin/lib/services/game-providers/provider-contest-edit.service.ts` |
| Provider edit API | `apps/admin/app/api/games/contests/[competitionId]/route.ts` (GET, PATCH) |
| Provider editor UI | `apps/admin/components/admin/games/ProviderContestEditor.tsx` |
| Page route | `apps/admin/app/competitions/edit-game/[id]/page.tsx` |
| Edit link routes by game | `CompetitionsListSection.tsx` |

34 tests in `__tests__/admin/provider-contest-edit.test.ts`, **16 probes all red on exactly
the expected test** (`tools/probe-contest-edit.ps1`). **None of these files is mirrored** —
`apps/admin/lib/admin/` and the admin API routes are admin-only, so `check:mirrors` says
nothing about any of it.

**Five findings worth carrying beyond this section.**

- **An allow-list must REFUSE an unknown field, not drop it.** Dropping is the tidy-looking
  option and it means an operator's edit silently does nothing: the form posts, the route
  answers 200, the screen re-renders the old value and the operator assumes they misclicked.
  Refusing with the field named is the feature. Same reasoning as the config-schema parser
  failing closed, and as refusing a contest whose round settings are missing.
- **The never-editable list is defence in depth and must be tested by its ERROR TEXT, not by
  whether the field is refused.** A probe removing `gameKey` from `NEVER_EDITABLE_FIELDS`
  stayed green, because `gameKey` is absent from the allow-list too and so still fell through
  to the unknown-field refusal — whose message also contains the words "gameKey". The
  assertion had to pin *which* refusal fired. Without that, a future edit adding a field to
  the allow-list quietly removes its immutability while the test stays green.
- **An allow-list held in a plain object is not an allow-list.** `ALLOWED[key]` walks the
  prototype chain, so `"constructor"` is admitted — truthy, survives a `!allowed` test, and
  only fails later somewhere that reads nothing like the cause. A `Set` has no prototype
  chain, so the check is total. Related and separate: the earlier claim that `for...in` would
  admit inherited keys where `Object.keys` would not was **wrong for a JSON-parsed body** and
  was corrected rather than left as a plausible-sounding aside.
- **The freeze must key on PARTICIPANTS, not on status.** A `draft` with entrants is
  impossible today, but an `upcoming` contest with twenty paid seats is the normal case, and a
  status-keyed freeze lets its entry fee be changed underneath them. The tiers are: nothing
  frozen at zero participants; `name`, `description` and a *raising* `maxParticipants` once
  anyone has entered; nothing at all editable once `finalizing`, `completed`, `cancelled` or
  `emergency_ended`. **`finalizing` is the one that matters most** — a change landing then may
  or may not be counted depending purely on timing, which is the same reason X3 treats it as
  closed for late results.
- **An edit must re-run the pre-flight against the STORED record.** A draft can outlive the
  switches that made it valid: the title can be disabled, the provider can be disabled, the
  adapter can be uninstalled. This is the same rule publishing already follows, and it also
  asks the question the creation-day validation could not — whether the settings persisted at
  all. The settings are re-validated against the **live** `configSchema` for the same reason,
  and the **coerced** values are stored, so `"7"` from an HTML input never reaches the provider
  as a string.

**Two deliberate scope limits.** The trading editor still exposes fewer fields than the
trading create form — the gap this section asks to close is a *trading* UI job with no
provider dependency, and closing it inside a security fix would have destroyed the only
evidence that no trading edit changed behaviour. And there is **no game-type change at any
point**, not even on a zero-participant draft: the target above permits it, but `gameKey` is
immutable and a draft is cheap to delete and recreate, so the permission buys nothing and
costs an immutability guarantee.

### 2.3 One contest clock, and a prize split an operator could reach - BUILT 7 September 2026

Owner-reported, and both halves are the same failure this codebase keeps producing: **a
control that appears to exist and does nothing.**

**The prize split was unreachable.** The wizard's third step has been labelled
"Timing & prizes" since it was built, with a heading reading "Timing, entry and prizes", and
it rendered **no prize control at all**. `contest-draft.ts` seeded a fixed 50/30/20 and
`platformFeePercentage: 10`, and neither could be changed, so **every provider contest ever
created paid those three shares and took that fee** whatever the operator intended.
`provider-contest.service.ts` has accepted and validated `prizeDistribution` and
`platformFeePercentage` since the day it was written - only the operator could not reach
them. **That is worse than an unbuilt step, because the step's own label asserted the
setting was there**, so an operator reasonably concluded they had already chosen it. Same
class as a provider enabled with no adapter, or six `rankingMethod` options a provider game
ignores.

The editor was the other half of the same story and the more misleading one: it exposed the
fee and a percentage-only prize control - **no way to add a rank, remove one, or move a
share to a different position** - so an operator could reweight three winners but never make
it five or two. The setting therefore *appeared* once the contest existed, which reads as a
field they forgot rather than one they were never offered.

`PrizeDistributionEditor.tsx` is now one component used by **both** screens. It is a second
implementation of the trading form's *UI* and deliberately **not** of the rule: the shares
are validated in `provider-contest.service.ts`, which stays the only place that decides
whether a distribution is acceptable, and the component's total is an affordance so the
operator sees the problem before submitting. Extracting the trading form's editor instead
would have put a refactor of a 2,900-line form live trading contests depend on in front of a
provider fix - the same reasoning that produced two wizards in s2.1.

**There were two contest clocks.** `startTime`/`endTime` and
`playWindowStart`/`playWindowEnd` were four separate operator-set dates with nothing keeping
them related, and **the field named "end" gated nothing a player played inside**:
`createRound` clamps a round's `expiresAt` to `playWindowEnd` and the launch service refuses
before `playWindowStart`. So a contest could run to 14:00 with play shutting at 13:20, and a
player who started earlier got a longer run at the same pot. The owner's requirement is one
clock for everybody.

The window is now **derived** from the contest clock by `deriveWindow` in `contest-draft.ts`,
and the two date fields are gone from both screens. Four facts about it are load-bearing:

- **The fields are still stored and still read.** The clamp is exactly the universal cut-off
  the owner asked for, so they earn their keep; what had to go was the operator's ability to
  set them to something *other* than the contest.
- **One function produces the pair, and that is the point.** Two dates that must agree is the
  "one rule, two copies" shape behind five defects here already, none of which
  `check:mirrors` can see.
- **Removing them from the wizard alone would not have been enough.** `toEditRequestBody`
  sends the window too, so an operator moving `endTime` in the editor would have left
  `playWindowEnd` behind and **shortened play without touching any field named "play"**.
- **Entry time is not squeezed by this.** Registration closes at `startTime`, so an operator
  wanting five minutes of sign-up creates the contest five minutes before it starts - which
  is what the trading wizard already does, and what the owner described.

Pinned by `__tests__/admin/provider-contest-schedule-and-prizes.test.ts` (14 tests). The
structural half reads source because these are `"use client"` components with no DOM in this
suite, so **comments are stripped first and every assertion matches a construct** - a JSX
element with its props, or an operator - never a bare identifier that an import line would
satisfy.

### 2.4 The contest VIEW screen, and why the payout looked broken - BUILT 7 September 2026

**R46.** The owner reported that on a contest named `newww` "the prizes, the distribution is a
mess". It was not a payout defect. `/competitions/view/[id]` - the screen an operator opens to
find out what happened - was written for trading and rendered `pnl`, `pnlPercentage` and
`totalTrades` unconditionally.

**The reason this is invisible rather than broken is the important part.** All three of those
fields default to `0` on **every** seat regardless of game (`participant-seat.ts`), so they are
present, they are zero, and they render perfectly. A provider contest therefore showed
`+0.00`, `+0.00%` and `0 trades` against every player - while **`score`, the number the contest
actually ranked on, was on the row and was never displayed.** R37 had already fixed the metric
the board *ranks* by, so the order was correct; there was simply no evidence for it on screen.

What an operator saw: rows in an order nothing on the page explains, every metric identical,
winner badges and prize amounts beside them. **That reads as a broken payout**, which is why a
reporting defect was reported as a money defect. Same class as the trading-shaped services in
X13 and the trading-shaped competitions list in s3.1a - **the label agrees with the old world
and keeps agreeing after it ends.**

Four more things on the same screen, found by reading it once the metric was understood:

- **Edit routed every contest to the trading editor.** The competitions *list* learned to route
  by game in s2.2 on the same day; this page was missed - **"count the writers", one call site
  along.** It is *not* a corruption path, because `PUT /api/competitions/[id]` refuses a
  labelled provider contest outright, and that is exactly what makes it worth fixing: the
  operator was walked through the entire trading form and refused **on submit**. Strictly worse
  than a button that had never been offered.
- **Starting Capital, Max Leverage and Asset Classes rendered as `$0`, `1:1` and an empty
  list.** These are not zero on a game competition, they are **inapplicable**, and printing a
  value makes a claim rather than declining to - an operator reads `$0` starting capital as a
  misconfiguration to go and fix. Now withheld. Platform Fee stays, because it applies to every
  game and decides what winners are actually paid.
- **The per-rank amounts were labelled with the credit name while the Prize Pool stat, the
  per-row "Won:" figure and the player-facing prize table all used the currency symbol.** One
  screen labelling one quantity two ways, so an operator reconciling a rank against a winner's
  actual credit had to work out whether the numbers were even in the same unit.
- **`noWinners` was read by no admin screen anywhere.** It is written at settlement by
  `contest-completion.service.ts`, and the only signal was an empty winners table -
  indistinguishable from a page that failed to load. It matters more here than on trading,
  because on a game competition **nobody scoring is a real and expected outcome**, so the notice
  says where the money went rather than merely that nobody won.

**And the caution the sidebar never carried.** The per-rank figures are what an operator
*typed*, not what settlement pays. Two things move them and both were invisible: an unplaced
rank has its share split among the players who did place, and since R45 a player with no result
holds no rank at all. So the figures are a **floor** - and an operator comparing them against
the wallet credits concludes the payout is wrong. `PrizeDistributionEditor` already said this
where prizes are *edited*; saying it where they are *read* is the half that was missing, and it
is **one exported string** so the two screens cannot drift into describing one payout two ways.

**SUPERSEDED LATER THE SAME DAY BY s2.6, and the caution is now conditional.** The two items
this section filed as deferred - a live redistribution in the sidebar, and `finalLeaderboard`
rendered nowhere - turned out to be **one** item, and the fix filed for the first half was
wrong on its own: projecting onto a finished contest divides by entrants where settlement
divided by placers. The sidebar now projects while the outcome is unknown and reports the
recorded amounts once it is not, so **the floor caution above renders only in the projected
case** - beside a real payment it is a warning that has become false. Read s2.6, not this
paragraph, for what the screen does today.

**The live code is `apps/admin/lib/admin/contest-result-presentation.ts` and
`apps/admin/app/competitions/view/[id]/page.tsx`.** Nothing here is mirrored, and no money
logic changed - every fix is on a read path.

The logic sits in a module rather than in ternaries in the JSX for two reasons, and the second
is load-bearing: the page was already 744 lines and over the 500-line limit, and **a structural
test over JSX can assert the file mentions `score` but cannot assert which branch renders it.**
That weakness is what let four earlier probes pass against injected defects. These functions
take a row and a flag, so a provider row and a trading row go through and get compared.

Pinned by `__tests__/admin/contest-result-presentation.test.ts` (12 tests) and
`tools/probe-admin-contest-view.ps1` (13 probes, **all red with exactly 1 failure each on the
named test**). The Edit routing is probed as a **swap** as well as a deletion, because a test
naming only the game editor stays green when the two destinations are exchanged - and a swap is
precisely what sends a provider contest to the trading form.

**Harness lesson, seventh instance, and the harness lied about all 13 at once.** Every probe
first reported `UNKNOWN`: `vitest -t` files unselected tests as **skipped**, so the summary
reads `1 failed | 11 skipped`, and the parser only matched `failed | N passed`. **A harness that
cannot read its own result is indistinguishable from 13 broken guards.** It now also flags any
probe failing more than one test, since more damage than the probe caused is not a report about
the guard.

### 2.5 The round length and the contest clock, which never referred to each other - BUILT 7 September 2026

**Owner-reported:** "the sprint circuit is confusing, it lets you set the duration like 120
but then you specify also time in the window play, and the two don't obviously relate."

They do relate, and **nothing on any screen said how.** Worth stating up front, because it
changes what the fix is: **the platform was behaving exactly as chapter 03 specifies, and the
whole defect was disclosure.** Nothing was miscalculated and nothing was mispaid.

**The operator meets two numbers that both look like "how long", and the one that decides the
answer is a third they never see.**

| Where | Number | What it actually governs |
|---|---|---|
| Step 2, the game's own settings | `durationSeconds`, 60-300 for Circuit Sprint | How long **one attempt** lasts. Passed to the game; the platform does not gate on it |
| Step 3, timing | `startTime` / `endTime` | When attempts may be **started** - one clock since s2.3, with the play window derived from it |
| Nowhere | `maxDurationSeconds`, 300 | **The gate.** `now + maxDurationSeconds <= playWindowEnd`, from the **catalogue row** |

So an operator set 120, and every part of the platform that reasons about round length
reserved **300**. Three places read the ceiling: `contest-preflight.ts` for the window-length
refusal and the grace-period minimum, `round.service.ts` for `roundFitsInWindow` and
`resolveExpiry`, and `round-status.service.ts` for the figure the play screen gates the Play
button on. The visible consequences were a refusal quoting **300 seconds** to someone who had
just typed 120 into that game's settings, and a Play button going dead **three minutes**
earlier than the configured round needed.

**SUPERSEDED 8 SEPTEMBER 2026 - THE THREE PARAGRAPHS BELOW ARE KEPT AS HISTORY AND THE
FIRST ONE IS NOW WRONG. See s2.9.** The gate reads the **configured** playing time, found
through a `format: "duration-seconds"` keyword the title declares, and falls back to the
ceiling only when a title declares no clock. The test that pinned the gate to the ceiling
was inverted; the test forbidding a *fraction* of an attempt was kept, because that is the
part of the rule below that was always right. The paragraph is left in place rather than
rewritten, because "we deliberately reserve the ceiling" was believed for a day and the
next reader needs to know it, and because everything it says about *why the whole attempt*
is reserved still holds.

~~**The ceiling is right and must not be "fixed" to the configured value.**~~ Chapter 03
section 1.2 specifies it deliberately: the gate fails closed, refusing slightly more than
strictly necessary, so an attempt can never be admitted that the contest end would cut
short. A round stopped mid-play would be scored on a partial game, which is the unfairness
the rule exists to prevent. ~~Reading the configured value would buy an honest-looking
message and reintroduce exactly that. A test pins the gate against this repair, because it
is the obvious one and it reads as a bug fix.~~

**Where that reasoning went wrong, because it is a useful mistake.** It is sound about
reserving a *whole* attempt and it silently assumed the ceiling *was* the attempt. It is
not: the ceiling is the longest attempt the title could ever grant, and the configured
value is the one this contest actually grants, so reserving the ceiling refuses time no
player was ever going to be given. **A gate that fails closed is still wrong if it is
failing closed against the wrong quantity** - and here it refused every attempt in every
contest shorter than the ceiling, which the owner reported.

**What was built is therefore an explanation, and one derived fact.**
`RoundClockNote.tsx` is rendered by the wizard **and** the editor, in two variants - beside the
game's own fields it answers *what are these for*, beside the dates it answers *when can people
actually play*. `describeRoundFit` in `contest-draft.ts` is the only producer of the derived
moment, which is the sentence that makes the two clocks relate: **"the last attempt can start
at 13:55."** A rule stated as a formula is what the owner had already been unable to relate to
their contest; a wall-clock moment is something an operator can act on.

Four things about it are load-bearing.

- **`maxDurationSeconds` is a catalogue field and `durationSeconds` is one game's config key**,
  and the note may read the first and never the second. A special case for the sprint's key
  here would break the "no developer needed for a new title" claim in the same way it would in
  `ConfigSchemaFields`, and it is the obvious way to write this component. **This rule
  survived s2.9 intact and is the reason the fix took the shape it did**: the note now reads
  the *configured* time, but it finds it through the `format` keyword the title declares,
  never by naming `durationSeconds`. The forbidden-identifier test is unchanged.
- **An absent duration states nothing**, matching `RoundPreflight.tsx`, which applies no gate
  when the catalogue declares none. An invented deadline would contradict the server for the
  one class of title where nobody knows the answer.
- **The too-short-contest warning appears beside the dates**, not only on review. The server
  refuses it either way; surfacing it at the point of cause means the operator sees it while
  editing the thing that caused it.
- **The refusal messages were reworded, not renumbered.** They now call the figure "this game's
  longest possible round" and say explicitly that it is the game's maximum rather than the
  length set in its own settings. The number is unchanged. **Superseded by s2.9**: the number
  is now the configured playing time, both messages name it and the contest length together,
  and a test forbids the phrase "longest possible round" - so a document quoting that wording
  as current is stale, though it is correct as an account of 7 September.

Also corrected in the same pass: the review step ended **"Publishing arrives with the
player-facing game screens"**, true when written and false from 5 September. An
operator-facing caution that has become false is worse than none - this one sent an operator
looking for a missing feature instead of pressing a button that already existed.

**17 tests** in `__tests__/admin/contest-round-clock.test.ts`, **13 probes** in
`tools/probe-contest-round-clock.ps1`, all red on exactly the expected test. Admin typecheck at
the **223 baseline exactly**. **Nothing here is mirrored** except the two pre-flight copies,
which were already a mirrored pair.

**Two probing lessons, and both were the probe rather than the guard.** The forbidden-identifier
test first lower-cased both sides, which made `durationSeconds` match inside
`maxDurationSeconds` - **the guard failed on correct code**, the same over-broad shape as the
blanket `GameIcon` ban in `13` s4.1g, and the fastest way to have a guard deleted along with the
half that matters. And the probe for that guard first injected the config key **in a comment**
and reported green: `readCode` strips comments deliberately, because these files explain the
mistakes they forbid. **A mention in a comment is not per-game code**, so the mutation had to
become code. Both are the same rule from opposite directions - *the guard and its probe must
agree on what the property actually is.*

### 2.6 The prize sidebar showed neither what will be paid nor what was - BUILT 7 September 2026

This closes both items s2.4 recorded as deferred, and the useful finding is that **they were
one item, and the thing that was filed for the first half would have been wrong.**

**What was on the screen.** The sidebar mapped `competition.prizeDistribution` and printed each
rank's bare configured percentage of the pool. The player-facing table has redistributed an
unclaimed position's share since long before this programme, so **the two screens quoted
different amounts for the same rank** - and the operator's was the one that then disagreed with
the wallet ledger. On a settled contest both were wrong, because settlement divides by how many
players *placed* and both screens divide by how many *entered*, a different number since R45.

**Why "recompute it live" was the wrong fix on its own.** That is what s2.4 filed, and applied
to a finished contest it produces a second wrong figure sitting beside the right one, with
nothing on the screen to say which is which. A projection is the correct answer only while the
outcome is genuinely unknown. Once settlement has run there is a recorded fact -
`finalLeaderboard` carries each winner's real `prizeAmount` - and **that record was rendered by
no admin screen at all**, which was the *other* deferred item. So the two halves answer each
other: project before settlement, report after it.

| Basis | Source | Caution shown |
|---|---|---|
| `projected` | `lib/utils/prize-projection.ts`, the same module the player's table uses | The figures are a floor |
| `settled` | `finalLeaderboard`, per rank, ties summed | These are the amounts actually paid |

Six things about it are load-bearing.

- **The basis is keyed on the record existing, never on `status === "completed"`.** A contest
  can be completed with no stored leaderboard - it predates the field, it was cancelled, or
  settlement never ran - and reading the basis off the status would caption a column of blanks
  as the amounts paid, which is worse than the projection it replaced.
- **The projection was extracted, not reimplemented.** The admin app cannot import a main-app
  component, so the alternative was a second copy of a payout calculation - the "one rule, two
  copies" shape behind `referenceId`, `failedReason`, `challengeId` and the Game Master `||`.
  The four expressions that decide what a winner is paid moved character for character, along
  with the four text assertions pinning them, **which is the only thing that makes the move
  provably behaviour-free**. The module's parameter is named `competition` for exactly that
  reason: renaming it would have broken the verbatim match and thrown away the proof.
- **The floor caution must not render beside real payments.** Telling an operator that a
  completed payout "can be higher than the amount here" is a warning that has become false -
  the same class as the play screen's play-window note and the wizard's publishing note, both
  of which sent somebody looking for something that no longer existed. One slot, two strings,
  chosen by the basis. The heading changes with it too: "Prize Distribution" above real money
  reads as configuration, so an operator assumes the figures are meant to match the ledger and
  reports a defect when they do not.
- **A rank nobody placed in reports `-`, never `0`.** The read-side form of R45 again, and the
  same choice the score column makes one panel over.
- **A tied rank is summed, not sampled.** `distributePrizesWithTies` splits the combined share
  of the tied positions between the tied players, so both hold their own `prizeAmount`.
  Reporting one understates the rank by half; averaging produces a figure that appears in no
  ledger row at all. A tie is also **inferred from two rows sharing a rank**, because `isTied`
  is add-only and was silently discarded before X5, so historical contests hold tied rows with
  the flag unset.
- **The settled snapshot is a second table, not extra columns.** The board above it is
  recomputed on every request, so it answers "how would this rank today"; the snapshot answers
  "how did it rank when the credits moved". They can legitimately differ - a late score
  rejected, a participant row edited, a disqualification recorded at the time - and merging them
  hides exactly that. The stored `disqualificationReason` is the field that cannot be
  reconstructed afterwards and is the one an operator has to give the player.

`ContestPrizePanel.tsx` and `SettledResultPanel.tsx` are components rather than more JSX
because the page was **744 lines and over the limit before this work**; inline it reached 1,097
and is now **785**. The extraction is also what makes the branch provable: a structural
assertion over a page rendering both can show the file mentions a paid amount and cannot show
which branch produced it.

**26 tests** in `__tests__/admin/contest-prize-basis.test.ts`, **18 probes** in
`tools/probe-contest-prize-basis.ps1`, all red on exactly the expected test. Suite **1218
passed**. Admin typecheck at the **223 baseline**, error lists diffed rather than counted -
the single error in the changed page moved one line and is the pre-existing `db` narrowing.
`lib/utils/prize-projection.ts` is **mirrored and byte-identical**, pinned by a text comparison
because `check:mirrors` compares models; the two panels and `contest-result-presentation.ts`
are admin-only.

**Two probes came back green and the two causes were different, which is the fifth and sixth
instance of that question having three answers.** One was a **weak test**: the
`disqualificationReason` guard was written as a bare `toContain`, and the field is named a
second time *inside* the element it guards, so replacing the condition with `{false && (` left
the suite green. Fifth instance of that class after the fixed-character Edit guard,
`canTransitionRound`, `MIN_REASON_LENGTH` and `expectedOrigin` - assert the condition with its
operator and **count the occurrences**. The other was a **guard that changes no answer**: the
`filledPositions > 0` ternary cannot be reached in a way that alters the output, because
`filledPositions` is zero only when every row is unfilled, so the `Infinity` it would produce
is read by nothing. It is kept - it is one of the four pinned expressions, and the accident
holds only for `>` - but the probe file **records it as unprobeable with the reason** rather
than shipping a green probe, on the same reasoning as R42's second game gate.

---

### 2.7 The gate that refused every round, and the draft nobody published - BUILT 7 September 2026

Two owner reports, and neither was a wording problem. A contest that had just opened said
**"There is not enough time left in this competition to finish a round, so no new round can be
started"** beside a countdown reading fifty-nine minutes; and every contest the wizard produced
went to **draft**, so it sat invisible while its own start time went past.

**The refusal was correct code enforcing a rule nobody had chosen.** Chapter 03 section 1.2
specifies the gate as `now + maxDurationSeconds <= playWindowEnd`, reserving the **catalogue
ceiling** rather than the length the operator configured - deliberately, so an attempt could
never be admitted that the contest end would cut short. Circuit Sprint's ceiling is **300
seconds**, so any contest shorter than five minutes refused every round for its entire
duration. Not intermittently, and not near the end: **from the instant it opened**.

**And its premise had quietly stopped holding.** The rule rests on a cut-short round being
scored on a partial game and therefore unfair. That was the right instinct when a contest was
won by finishing; it is not, now that **partial performance is the basis for winning** - a
player who completes two boards beats one who completes one, exactly as a trading contest ranks
whoever is ahead when the bell goes. So the gate became the **contest's** choice.

| Setting | `RoundStartPolicy` | What it does |
|---|---|---|
| Reserve a full round | `reserve_full_round` | The old rule, unchanged. The last attempt can start one full ~~ceiling~~ **playing time** before the end |
| Players may start at any time | `until_window_closes` | An attempt may start until the contest closes. `resolveExpiry`'s clamp shortens it, and the player is told by how much |

**AMENDED 8 SEPTEMBER 2026, AND THE AMENDMENT REVERSES THE WIZARD DEFAULT BELOW.** The
reservation was never meant to be the ceiling - that was an arithmetic defect, fixed in
**s2.9**, and it is the reason the permissive policy was made the wizard's default here.
With the gate reserving the *configured* playing time, reserving costs a player only the
time they were actually going to be given, so **`reserve_full_round` is now the wizard's
default** and the owner chose it: one fixed play budget, the same for everybody. The
paragraph below is correct as an account of 7 September and stale as a statement of the
current default; the *schema* default it describes is unchanged and still the migration
safety.

~~**The schema defaults to reserving; the wizard defaults a new draft to permissive.**~~
That pair is the thing most likely to be read as a bug and is deliberate: a schema default
fixes future rows only, so every contest created before the field existed must keep the
rule its entrants signed up under, while the setting an operator wants today is the one
that does not refuse them. **Both defaults are now `reserve_full_round`**, and the two
still differ in kind rather than in value - the schema's protects existing rows, the
wizard's is a product decision.

**The same fact is a refusal or a warning depending on the policy, and it has to be.** A
contest shorter than the ceiling is reported by both `describeRoundFit` and both pre-flight
copies either way - reporting it only on the reserving branch would leave an operator creating a
two-minute Circuit Sprint contest with no idea every attempt will be cut off. But left as a hard
refusal for both, an operator could select the setting that exists for short contests and then
be refused for creating one.

**A second-order fix that would have been missed:** the grace period is now asked to cover
`Math.min(ceiling, window)` rather than the ceiling. Under until-close no round can be longer
than the window however high the ceiling is, so demanding grace for the full ceiling refuses a
short contest for a round length it **cannot produce** - the ceiling-versus-reality confusion
again, one field along. **s2.9 went further and finished the thought**: the figure is the
*configured* playing time, and the wizard now **derives** the grace period from it rather than
sending a fixed 900 seconds, because that fixed value would have refused every contest with
more than ten minutes of play - naming a field no screen offers.

**Auto-publish is a checkbox, default on, and the flag never reaches the server.** Publishing
re-runs the pre-flight against the **stored** record, which is the whole point of it - a draft
can outlive the switches that made it valid, and reading the saved document also asks the
question creation could not, which is whether the settings actually persisted. A `publish: true`
on the create call would either bypass that or duplicate it inside the create transaction. So
the checkbox drives a **second request** after the create returns, and **a refused publish
leaves a draft rather than reporting a failure** - the contest exists by then, so an error would
send an operator back to build a second copy of it. The editor's draft defaults the flag to
**false** and offers no control: inheriting the wizard's default would publish a deliberately
unpublished draft as a side effect of fixing a typo.

**What was built.** `ROUND_START_POLICIES` / `ROUND_START_POLICY_COPY` on both `round-types.ts`
copies; the conditional gate in `round.service.ts`; the normaliser in both `contest-config.ts`
copies, which **fails closed** on an unrecognised stored value; `roundStartPolicy` on both
`competition.model.ts` copies; the conditional refusal in both `contest-preflight.ts` copies;
`RoundStartPolicyField.tsx`, shared by the wizard and the editor and frozen once anyone has
entered; a policy-aware `RoundClockNote.tsx` and `describeRoundFit`; the field on `PlayState` in
both the service and the client's own copy; and the shortened-round disclosure in
`RoundPreflight.tsx`, on the panel **and on the button**.

**The disclosure is what makes the permissive branch defensible, not decoration.** An attempt is
consumed when a round is created and cannot be handed back, so a player who starts a four-minute
game with ninety seconds left and is not told has paid for a game they could never finish. It is
derived from the **window**, not from the round length, because that is what the server's clamp
will actually grant.

**48 probes across three harnesses, all red on exactly the expected test** -
`tools/probe-contest-round-clock.ps1` (21, the operator's screens and the mirrored pre-flights),
`tools/probe-play-clock.ps1` (17, the player's), and the new
`tools/probe-round-start-policy.ps1` (10, where it behaves: `createRound` against a real
MongoDB, and the create-then-publish sequence). Whole suite **1350 passed**, main typecheck back
to its pre-existing 198 and admin at the **223 baseline** exactly.

**Two probes came back green and neither was a weak guard.** One was the recurring
one-identifier-two-occurrences trap: deleting the clock note's timing condition left
`fit.reservesFullRound` and `fit.lastAttemptStart` in the file, because the settings variant
branches on the policy too and the second name appears **inside** the paragraph being guarded.
Fourth instance of that class - the test now slices to the construct. The other was the third
cause rather than the first: **no test existed at all.** Reversing the normaliser's comparison
in `contest-config.ts` left the entire round-lifecycle suite green with **zero** red, because
every test there hands `createRound` a hand-built config and none of them goes through the
normaliser. A test for `contestRoundConfig` was written and the probe re-aimed at it and at its
own suite.

**A deviation from chapter 03, recorded rather than absorbed.** Section 1.2 states the gate
unconditionally. It is now conditional, and the chapter's reasoning is preserved as the
**default** rather than deleted - which is the honest reading, because the reserving branch is
still the right answer for a title where a shortened round means nothing.

---

### 2.8 Two wizards that looked like two products - BUILT 8 September 2026

The owner's report was about consistency, not a defect: side by side, the trading wizard and the
game wizard did not look like the same platform. Trading had a seven-step progress rail with
coloured step headers, a Quick Preview panel and an AI content generator; the game wizard had a
plain breadcrumb, no preview and no assistant.

**The chrome was extracted, not copied.** `components/admin/wizard/WizardShell.tsx` holds
`WizardPageHeader`, `WizardShell`, `WizardStepRail`, `WizardPreview`, `WizardPreviewRow` and
`WizardStepCard`, and `AiContentPanel.tsx` holds the AI banner and the per-field Generate
button. A second copy of a progress rail is the "one rule, two copies" shape behind
`referenceId`, `failedReason`, `challengeId` and the Game Master `||`, none of which
`check:mirrors` can see. The guard is a **negative** assertion: the two sidebar headings
("Creation Progress", "Quick Preview") must appear in the shell and in **no** consumer, because
importing the shell is trivially satisfied by a screen that then hand-rolls a panel beside it.

**`WizardPageHeader` takes `icon: ReactNode`, and that is R39's rule, not a preference.** The
page that renders it is a server component, so an icon passed as `LucideIcon` would be a
function crossing a server/client boundary - which is exactly what took the trading lobby down
on 6 September. `WizardStep.icon` stays `LucideIcon` because `STEPS` is defined inside a client
component and never crosses anything.

**Six steps, which is a deviation from the four this chapter asked for.** Recorded rather than
absorbed: four steps on a rail styled like trading's seven still reads as a cut-down form. The
steps mirror trading's grouping one-for-one where the question is the same - basics, money,
clock, prizes, launch - and replace its three trading-only steps with the two a game needs,
which title and that title's own settings. **No trading field appears and there is no market
card**, both of which are section 2's acceptance criteria; a puzzle does not care whether the
forex market is open.

**The assistant's prompt was one hard-coded string saying "trading competition platform".** Left
alone on a game contest it produces fluent, confident copy about traders, markets and profit for
a game that has none of those things - no error, nothing in a log, which is this codebase's
recurring failure shape, and `05` s10's rule one layer out: **no platform-wide text may silently
mean "trading only".** `apps/admin/lib/admin/ai-contest-vocabulary.ts` composes the prompt from
the catalogue row instead.

**The vocabulary is derived server-side from the stored row; `gameKey` in the body is a lookup
key and nothing else.** A caller-supplied game name or genre would be arbitrary text in a system
prompt, and - more mundanely - a way for the wizard's own state to drift from a catalogue an
operator has since edited. Three properties are load-bearing and each is pinned:

- **Trading's prompt is unchanged character for character.** It is the screen operators use
  daily, and the only evidence this change does not alter what it produces is that its prompt
  did not change. Same reasoning that kept the Game Master `||` intact while settlement was
  extracted.
- **An absent key means trading; a key that finds nothing is refused.** Falling back to trading
  copy for a game contest is the exact defect being fixed, and it would be invisible.
- **Nothing enumerates games.** Every sentence is composed from declared fields
  (`displayName`, `category`, `description`, `scoreDirection`, `scoreType`,
  `typicalDurationSeconds`), because a `switch` on game code is the one failure mode of the "no
  additional coding" claim - the first title needing a special case makes it quietly false while
  every existing test still passes.

**`duration_ms` is read together with the direction, not instead of it.** A title reporting
milliseconds and scoring higher-is-better is measuring endurance, not speed, so "the fastest
time wins" would be exactly backwards. And the trading words are **banned by name** in the game
prompt rather than hoped against: a model told it is writing about a puzzle will still reach for
"traders" and "markets", because almost every other sentence on this platform uses them.

**What was built.** `WizardShell.tsx`, `AiContentPanel.tsx`, `ai-contest-vocabulary.ts`, the
`gameKey` lookup in `app/api/ai/generate-competition/route.ts`, `gameKey` / `subjectLabel` on
`AIGeneratorDialog.tsx`, `ProviderContestWizard.tsx` reduced to state plus order plus two
network calls, and six step bodies under `components/admin/games/wizard/` with the shared field
primitives in `fields.tsx`. **25 new tests, 17 probes all red on exactly the expected test**;
the two existing wizard suites were re-pointed at a `readWizardScreen()` helper that
concatenates the orchestrator with every step file, or moving code out of the monolith would
have left them passing vacuously.

**Both items this section left outstanding were closed later the same day** - see 2.8a. Any
document saying the trading form is not on the shell, or that the market block is still there,
is correct as history and stale as a present fact.

### 2.8a The trading form moved onto the shell, and the market refusal went - BUILT 8 September 2026

Two changes to one file, both trading-only, kept out of 2.8's commit so a revert of either
cannot take the game wizard's new look with it.

**The chrome MOVED; it did not get a second copy.** The two-column frame, the seven-item
progress rail, the Quick Preview card and seven hand-written accented step headers are now
`WizardShell`,
`WizardStepRail`, `WizardPreview` and seven `WizardStepCard`s reading the same `steps` array
the rail is built from. That last part is the point rather than a tidy-up - seven headers
written by hand is how a reordered wizard renders one step's body under another step's
heading, and a test therefore asserts seven cards on **seven distinct indices**, because a
copy-paste leaving two on `steps[0]` renders the same heading twice and reviews as correct.

**The rail and the card legitimately say different things, so the shell accommodates that
rather than flattening it.** `WizardStep` gained optional `heading` and `subheading`: the rail
is a narrow column and has always been terse ("Basic Info", "Name and description") while the
card has room for a sentence ("Basic Information", "Give your competition a name and
description"). The alternative was to shorten trading's card copy to fit the rail's labels,
which would have made an extraction whose whole claim is that nothing changed into a wording
edit. Both fields are omitted by the game wizard, which falls back to `title` / `description`.

**The market status card stayed in this file and was passed into the sidebar slot.** It is a
real fact about a trading contest and means nothing to a puzzle, so a shell carrying it would
be precisely the trading-shaped default this programme keeps finding. A test asserts
`marketStatus` appears in the form and in **no** part of the shell.

**The market refusal is gone, which is the owner's 4 September decision reaching the screen an
operator actually uses.** `handleSubmit` returned early on `!marketStatus.isOpen`, so an
operator scheduling Monday's competition on a Saturday was refused outright - the same gate the
owner had already removed server-side, where `assertForexMarketOpenForCreate()` was deleted with
it. The reasoning is unchanged: **creating a contest is scheduling it, not playing it**, and
order placement still refuses trades against a closed market, so nothing is weakened.

Three things about that removal are load-bearing, and each is pinned by its own probe:

- **The wording is half the defect and would have outlived the code.** A card reading
  "Competition creation is BLOCKED" beside a form that now submits happily is worse than the
  refusal was - an operator reads it, believes it, and waits until Sunday. It now says the
  competition can still be scheduled, and says where trading is actually gated.
- **The information is kept.** `/api/market-status` returns warnings against the operator's
  chosen dates, and a window straddling the weekend close is a genuine problem worth flagging.
  Removing the refusal must not turn a wrong screen into a blind one. Asserted in **two** halves
  - the gate and the render - because a probe proved a single `marketStatus.warnings` match is
  green when the render condition alone is destroyed: the field is mentioned twice.
- **A refusal removed from the handler must not reappear on the button.** That is the same
  defect wearing a disabled attribute, and worse, because a disabled button names no reason.

**What was built.** `CompetitionCreatorForm.tsx` on the shell with the refusal removed,
`heading` / `subheading` on `WizardStep`, and `__tests__/admin/trading-wizard-shell.test.ts`
(8 tests) with `tools/probe-trading-wizard-shell.ps1` (**11 probes, all red on exactly the
expected test**). The test file is separate from `game-contest-wizard.test.ts` for the same
reason the commit is: a revert should delete it rather than partially edit a file that has to
survive. Admin typecheck at the **223** baseline exactly, with nothing new in the changed files
and nothing disappearing; the 22 pre-existing `DifficultyLevel` errors moved line numbers only.

**One thing to state precisely: this was never verified by eye.** The screen is behind an admin
sign-in the automated browser has no session for. The class strings were extracted character for
character and the accent map is identical, which is why a visual regression is unlikely - but
unlikely is not checked, and the owner's review is what closes it.

**Three pre-existing lint warnings had to be cleared to commit, and one of them was real.**
The pre-commit hook runs ESLint at `--max-warnings=0` over staged files, so eight warnings this
file had carried for months became blocking the moment it was touched. Five were dead imports
and dead locals. One was `onChange={(newRules: any) => ...}`, now inferred from the prop rather
than annotated away. The last is worth naming: `handlePrizeChange` copied the array and then
wrote `newPrizes[index][field] = value` - **indexing a mutable array with a caller-supplied
number**, the fourth appearance of the object-injection shape after the round-inspector action
map, `competition-update-fields.ts` and the Game Master limits allow-list. Rebuilt with `.map`,
which needs no index write at all. It was not reachable as a defect here (the index comes from
the component's own render, not from a request), which is exactly why it had survived - but a
guard that only fires on the dangerous instances is not a guard.

**And a figure not to overstate: the file is 2,716 lines, down from 2,781.** Deleting 310 lines
of chrome and adding the shell's sidebar composition plus the step list's new copy nets 65. This
form remains far over the 500-line limit, and splitting it is **not** what this commit did - a
document implying the monolith is dealt with is wrong. Section 2's other outstanding item is
unchanged too: the trading **editor** still exposes fewer fields than the trading create form.

---

### 2.9 The gate reserved a ceiling nobody had set - BUILT 8 September 2026

The owner's report was that a contest refused every attempt from the moment it opened:
*"as soon as the competition starts it says there is not enough time left in this
competition to finish a round."* **45 tests in the clock suite, 20 probes red on exactly
the expected test**, 1547 tests across the platform and 204 in `games-service`, both
typechecks at baseline (198 main, 223 admin) with nothing in the changed files and nothing
disappearing.

| File | What changed |
|---|---|
| `lib/services/games/config-schema.ts` (mirrored) | The `format` keyword, `resolvePlayDurationSeconds`, `resolveAttemptSeconds`, `resolveAttemptSecondsFromSchema` |
| `lib/services/games/round.service.ts` | The gate reads `attemptSeconds`; `resolveExpiry` still reads the ceiling |
| `lib/services/games/round-launch.service.ts`, `round-status.service.ts` | Resolve the attempt from the title's schema and pass it on |
| `lib/services/games/contest-preflight.ts` (mirrored) | Compares against the configured time; `RESULT_GRACE_MARGIN_SECONDS` exported |
| `lib/services/games/round-types.ts` (mirrored) | `attemptSeconds` on `RoundContestConfig`; `ROUND_START_POLICY_COPY` rewritten |
| `components/admin/games/contest-draft.ts` | `deriveResultGraceSeconds`; `describeRoundFit` reads the configured time; the default policy flips |
| `components/admin/games/ConfigSchemaFields.tsx` | `DurationControl` - the minutes dropdown, keyed on the declared format |
| `components/admin/games/ProviderContestWizard.tsx` | Blocking validation on the schedule step; the preview names the chosen play time |
| `components/admin/games/RoundClockNote.tsx`, `RoundStartPolicyField.tsx` | Stop describing a ceiling |
| `games-service/src/games/titles.ts`, `scoring.ts` | Circuit Perfect retired (`deprecated`, not deleted); Sprint widened to 1-60 minutes and declares its clock |

#### The defect: correct code enforcing a rule nobody had chosen

Chapter `03` section 1.2 specifies `now + maxDurationSeconds <= playWindowEnd`, and that
is what the gate did. `maxDurationSeconds` is the **catalogue ceiling** - the longest a
round of that title could ever run - and it is not the length the operator configured.
Circuit Sprint's ceiling allowed an hour, so **every contest shorter than an hour refused
every attempt for its entire duration**, whatever playing time was set.

Three things about it are worth stating precisely, because a summary rounds each of them
the wrong way.

- **It was not a late-contest edge case.** The reservation is subtracted from the contest
  *end*, so a 30-minute contest of 10-minute play had a cut-off 30 minutes before it
  opened. It never opened at all. Section 2.7 built the policy that lets an operator opt
  out of the reservation, and recorded the ceiling as the reason `until_window_closes` had
  to be the default; that reason has now gone.
- **The fairness rule is unchanged.** Reserving the *whole* attempt is still the law under
  `reserve_full_round`, and a test forbids reserving a fraction of it. Only the number
  changed. **Reading the configured value is not a relaxation** - it is the number the
  rule was always about.
- **`03` section 1.2 was amended, not overridden.** The chapter now carries both
  amendments and says which part of the original sentence was a specification and which
  was an arithmetic mistake.

#### How the platform learns which setting is the clock

`format: "duration-seconds"` on a property of the title's `configSchema`. **No platform
code learns a field name and nothing enumerates a game**, which is the one failure mode of
the no-developer-needed claim - and it is why naming `durationSeconds` directly was
rejected even though it would have worked, for exactly one title.

The keyword fails closed three ways, each for a different reason:

| Refusal | Why |
|---|---|
| An unrecognised `format` | Same rule as every unimplemented keyword. Ignored, it would leave a declared clock treated as an ordinary integer with nothing anywhere saying so |
| A duration on a non-number field | The value is arithmetic. On a string every reservation is `NaN`, and **every `NaN` comparison is false, so every gate silently OPENS** |
| Two properties both declaring it | The reservation would depend on property order - a coin flip that reads as working and could differ between two titles from the same provider |

**A title declaring nothing falls back to `maxDurationSeconds`**, which is never *shorter*
than the truth, so the fallback over-reserves. That is the visible direction: it refuses
something an operator can see and complain about, rather than admitting an attempt the
contest end will cut short. Chapter `01` section 3.2 carries the provider-facing
requirement, and the issued HTML is at **version 1.3**.

#### The playing time is chosen, not typed in seconds

1, 5, 10, 20, 30 and 60 minutes, plus **Custom**, which reveals a number box in minutes.
Four things about it are load-bearing rather than cosmetic:

- **The presets are filtered against the title's own declared range.** Offering an hour
  that the game then clamps is worse than not offering it: the contest saves with a length
  nobody chose, and the reservation is computed from the clamped value rather than the one
  on screen.
- **A title with no whole-minute option keeps a plain number box.** A dropdown with
  nothing in it is a control that appears to work and offers nothing - the shape this
  programme keeps finding.
- **Seconds go on the wire.** Minutes are presentation. Storing minutes would put a value
  on the wire that disagrees with the schema's own `minimum` and `maximum`, so validation
  would reject a legal choice.
- **Opening Custom writes nothing.** An operator who opens the box to look and changes
  their mind has not edited the contest.

#### The result grace period is derived, and had to be

Nothing offers it, because no operator has a basis for choosing it - and the pre-flight
**refuses** a contest whose grace is shorter than one attempt plus five minutes. Left at
the fixed 900 seconds, every contest with more than ten minutes of play would have been
refused, naming a field that is not on any screen. `deriveResultGraceSeconds` raises it to
cover the chosen time, **only ever raises** (lowering it retroactively is how a result
that was going to be counted stops being counted), and **imports the pre-flight's own
margin** rather than restating it. Two margins would mean the wizard deriving a number the
server then refuses.

#### The wizard blocks rather than warns

A contest shorter than one playing time under the reserving policy cannot be advanced past
the schedule step, and the message **names both durations**. The amber caution was already
there and an operator could read it, agree, and click Next; the contest then saved,
published, sold seats and refused every one of them. "Too short" without the two numbers
sends them to guess which of two fields, three steps apart, to change.

#### `reserve_full_round` becomes the wizard's default, and the schema's does not

The owner chose it: a fixed play budget, the same for everyone, with entry to play closing
that long before the end. **The schema default is deliberately left alone**, because a
schema default fixes future rows only and a contest created before today must keep the
rule its entrants signed up under. Two different defaults in two places is the migration
safety, not an inconsistency - the same shape as `unscoredContestPolicy` in `05` s9.3.

#### Two things that generalise

- **When a gate and the screen beside it agree, and both are wrong, the defect is
  unreportable.** `RoundClockNote` explained the reservation in terms of the ceiling, so
  an operator reading the refusal was *confirmed* in it by the very screen that should
  have exposed the mistake. The disclosure and the arithmetic have to be derived from one
  place or they will agree with each other rather than with the truth.
- **The ceiling still decides `expiresAt`, and merging the two fields is the tempting
  mistake.** The gate asks *how much must I reserve*; expiry asks *how long may this round
  live*. Reading the configured attempt at expiry would cut a player off mid-board with a
  score the provider never sent. A test pins the separation, and a probe that makes expiry
  read the attempt goes red.

#### What was retired

**Circuit Perfect is retired**, per the owner: it was the one title in the catalogue whose
scoring depended on finishing a fixed set of boards, which is the model the owner's
instruction replaced. Circuit Sprint already worked the way the instruction describes -
solve as many boards as you can inside a time budget, scored on count and speed - so
widening its play time to 1-60 minutes and declaring its clock is the whole of the change
on the game's side. **Nothing about ties, unclaimed shares or disqualification changed**,
because none of it was ever per-title: those rules live in `05` s9.2, s9.3 and the ranking
engine.

**It is `status: "deprecated"`, not removed from the catalogue**, and the distinction
matters to this chapter specifically: `gameKey` is immutable and is what every historical
figure on the analytics and Game Performance screens joins on, so deleting the row would
leave those screens rendering a key they cannot resolve. `contest-preflight.ts` already
refuses a non-`active` title, so **the deprecation is the enforcement** - an operator
cannot create a new contest on it, and the ones already played still report correctly.
Same reasoning as a provider having a disable switch and no delete, and as R29 retiring a
disabled game's rows rather than removing them.

---

### 2.10 Entry closed the instant the contest opened - BUILT 8 September 2026

The owner's instruction, given with 2.9: *"the player can join the competition any time
before the competition ends."* A provider contest was doing the exact opposite.
`createProviderContest` wrote **`registrationDeadline: new Date(input.startTime)`**, so a
player arriving one minute into a one-hour contest could not join it at all. **17 tests in
`__tests__/services/contest-entry-deadline.test.ts`, 18 probes red on exactly the expected
test with exactly one failure each**, 1564 tests across the platform, both typechecks at
baseline (198 main, 223 admin) with nothing in the changed files and nothing disappearing.

| File | What changed |
|---|---|
| `lib/services/games/entry-deadline.ts` (**new**, mirrored) | `resolveContestEntryDeadline` and `entryDeadlineMs` - the one producer |
| `apps/admin/lib/services/game-providers/provider-contest.service.ts` | Derives the deadline; resolves the policy fallback **once** |
| `apps/admin/lib/services/game-providers/provider-contest-edit.service.ts` | Recomputes the deadline last, from the document; loads the title unconditionally |
| `components/games/round-window.ts` | `fullRoundCutoffMs` forwards to the producer |
| `apps/admin/components/admin/games/contest-draft.ts` | `describeRoundFit` forwards to the producer |

#### Taken literally the instruction sells a seat that cannot play

This is the part a summary will flatten, and it is the whole design. Under
`reserve_full_round` - which 2.9 made the wizard's default - the gate in `round.service.ts`
refuses an attempt that would not fit in what remains. Entry open to the final second
therefore means a player pays an entry fee, is **refused every attempt**, ranks on
nothing, and since **R50** is not even eligible for the redistribution. Nothing errors and
nothing logs.

So the deadline is **the last moment playing is still possible**: the window end under
`until_window_closes`, and one whole attempt before it under `reserve_full_round`. Three
further rules, each of which was a decision rather than an implementation detail.

- **A fraction of an attempt is not admissible.** Reserving half would let in a player the
  gate then refuses, which is the original defect wearing different clothes. A test forbids
  it.
- **No attempt length at all means no reservation**, matching the gate's own
  `attemptSeconds ?? maxDurationSeconds ?? 0`. Guessing a length here would close entry
  against a rule nothing enforces.
- **The start is a floor.** A contest exactly as long as one attempt subtracts to its own
  start; a longer attempt than window subtracts to a moment already past. A deadline before
  the start is not a short entry window, it is a contest nobody can enter.

#### One producer, three consumers, and it is a net reduction

Three places were already deriving this instant independently - the play screen's
pre-flight, the wizard's clock note, and now the stored deadline. **The two a player sees
sit either side of a decision to travel to another screen**, so a disagreement of even a
rounding is a player told they have time and then refused on arrival. That is the "one
rule, two copies" shape behind `referenceId`, `failedReason`, `challengeId`, the Game
Master `||` and the score direction R37 closed - **none of which `check:mirrors` can see,
because it compares models.** The guarantee here is a byte-for-byte test plus a negative
assertion per consumer, and the negative half is the load-bearing one: importing the module
is trivially satisfied by a file that imports it and does the sum again five lines later,
which is exactly what `RoundPreflight` did before `round-window.ts` was extracted.

**The module stays importable by a client component**, which is what makes one producer
possible at all: `RoundPreflight` is `"use client"` and the provider lobby is a server
component, so a value import of a model here would fail the client build one screen away
with an error naming Mongoose. The guard permits `import type` and forbids runtime imports,
rather than forbidding imports outright - a blanket ban would forbid exactly the
de-duplication that removes the second copy.

#### Four things that generalise

- **An edit must RECOMPUTE the deadline, last, from the document.** Four values feed it and
  an operator may move any subset, so the old placement - inside the start-time branch - is
  wrong the moment the play window or the settings move instead. Reading `input` rather than
  the merged document is the same bug from the other direction: stale for every field the
  operator did not touch. Both are pinned by **position**, not by presence.
- **A fallback written twice is a contest that stores one policy and closes entry under the
  other.** The create service briefly had `input.roundStartPolicy ?? "reserve_full_round"`
  in two places, and a probe changing either one **stayed green** because the assertion
  found the other. It is now resolved once and the test **counts** the occurrences. Sixth
  "probe stayed green" instance; answer: weak test.
- **The edit service loaded the title only when settings changed**, so an edit moving just
  the end time recomputed the deadline against no play clock and left entry open to the last
  second. It is now loaded unconditionally. **A conditional read feeding an unconditional
  write is a silent hole**, and the condition reads perfectly sensibly.
- **A test that asserted the defect was flipped, not deleted, and the mutation matters.**
  `provider-contest-edit.test.ts` asserted `deadline === startTime`, which *was* the rule.
  The reason it was written still holds - leaving the old deadline behind after moving the
  schedule is silently wrong - so it now asserts the derived instant plus, as the
  load-bearing half, that entry **survives the start**. Deriving the expected value the way
  the service does would have been tautological.

#### What did NOT change

**The registration clamp in `lib/utils/registration-deadline.ts` is a floor, not a
ceiling**, so the later deadline reaches the player's gate and countdown untouched. Worth
checking rather than assuming: written as a ceiling it would have clamped every new deadline
back to `startTime` and the whole change would have been invisible on the only screen that
matters, with every test still green.

**Trading is untouched.** Its `registrationDeadline` is operator-chosen and may legitimately
be absent, which `resolveRegistrationDeadline` already reads as "limited only by status".

---

### 2.11 The wizard follows the title's play shape - BUILT 8 September 2026

**`External game plans/22` section 8 is the authoritative account.** This section records only
what the admin panel does, because that is what drifts.

A title now declares `playMode: "anytime" | "scheduled"`. The wizard reads the **resolved**
shape - `listContestableTitles` returns `resolvePlayMode(title)`, not the stored field - and
changes its **defaults, wording and which controls it offers**. It does not change which
*fields* exist, and a test forbids `gameCode`, `gameKey`, `providerKey` and any game name from
every file that decides a shape.

| Control | `anytime` | `scheduled` |
|---|---|---|
| Start / end date wording | "Contest starts" / "Contest ends" | "Everyone starts at" / "Everyone finishes by" |
| Attempts | Offered | **Withheld**, with the reason. Stored as `single` |
| How late a player may start | Offered | **Withheld**, with the reason. Stored as `until_window_closes` |
| Entry closes | Last playable moment (s2.10) | **`startTime`** |

**Five facts about it drift easily.**

- **The withheld controls and the forced values come from ONE object.** `playShapeRules`
  carries both the rule and the operator-facing sentence, for the same reason
  `UNSCORED_CONTEST_POLICY_COPY` is one map: a wizard offering "best of three" on a contest the
  server is about to store as one attempt is worse than either being wrong alone, because the
  operator cannot tell which one is lying. That is not hypothetical here - the start-date hint
  said "Registration closes at this moment" for a month after s2.10 moved the deadline, because
  the sentence lived in the component and the rule lived in `entry-deadline.ts`.
- **A withheld control states why it is absent.** An empty space teaches an operator the
  setting does not exist; the reason is the feature, the same rule as refusing to enable a
  provider with no adapter.
- **The wizard patches the forced values into its own draft when a title is selected.**
  Without it the review step shows the operator's answers and the database stores different
  ones - the create service overrides them either way, so the screen would simply be wrong.
- **The forcing on EDIT sits outside the "did the operator send this field" branch.** Inside
  it, an ordinary edit that sends only `name` leaves a contest whose title has *since* become
  scheduled carrying a policy the shape forbids. That is the probe that matters in
  `tools/probe-play-shape.ps1`.
- **`playMode` is on `NEVER_EDITABLE_CONTENT_FIELDS`**, so it cannot be typed into the game
  content editor. It was refused before that only by the unknown-field branch, which is one
  allow-list entry away from letting an operator turn a puzzle into a race from a screen
  labelled "title and description".

**Not built, deliberately:** the contest end is **not** defaulted to start plus one attempt
plus grace, which `22` s4.2 asks for. The operator sets it and `describeRoundFit` already
refuses a window too short for a round, so it is a convenience rather than a hole. And **no
title declares `scheduled`**, so this path is exercised only by tests until X4.

---

## 3. Contest list and detail screens

| Screen | Change |
|---|---|
| `CompetitionsListSection.tsx` | Game column, game filter, provider column for provider contests |
| `ChallengesAdminSection.tsx` | Same |
| `apps/admin/app/competitions/view/[id]/page.tsx` | Leaderboard columns from `module.statDescriptors()` instead of hard-coded PnL and trade count. For provider contests: score, attempts used, round status, replay link |

### Lifecycle actions that must become game-aware

| Action | Route | Requirement |
|---|---|---|
| Emergency cancel | `.../emergency-cancel` | Dispatch to `module.settleContest()`, or skip position closing entirely |
| Adjust results | `.../adjust-results` | Write `score` and recompute normalised points, not trading metrics |
| Force-finalize old | `/api/finalize-old-competitions` | Must dispatch on game type - this is one of the five entry points in `11` section 2, and risk **R3** |

### 3.1a What was built - 5 September 2026, the publish control

**The list is now game-aware enough to publish a draft, and the reason that is a bigger
change than a button is that `CompetitionsListSection.tsx` was a trading-shaped screen
already rendering provider contests wrongly.** `GET /api/competitions` applies no filter, so
provider drafts had been appearing there since the wizard shipped - and the screen's
`Competition` interface did not admit `"draft"` as a status, so it fell through
`getStatusColor`'s default into the **same grey it uses for a completed contest.** Nothing
errored. An unpublished contest simply looked finished.

That is the failure shape this programme keeps meeting, in its UI form: **the screen kept
working and kept being wrong.** Adding a Publish button without fixing it would have made the
wrong control the easiest one to press.

| Built | Detail |
|---|---|
| `PublishContestButton.tsx` | New, in `components/admin/games/`. Its own file because the list is already 617 lines, over the limit, and this control carries real behaviour |
| The refusal list | `runPreflight` **accumulates** hard refusals rather than stopping at the first. The button renders all of them; a `toast.error` alone would have thrown that away and reintroduced one-problem-per-submission |
| Warnings | Surfaced with `toast.warning` **after** the success message, so the three advisory items cannot be mistaken for failures |
| `draft` in the status union, with its own amber badge and icon | It was a state the type denied while the screen rendered it |
| A **Drafts** card in the summary | That summary counts by status, so it is an aggregate that enumerates its cases - a draft used to land in `Total` and in none of the others |
| A provider game badge | Shown only for provider contests. Every other cue on the row is trading's: the trophy, the entry fee, the pool |
| `lib/admin/contest-game-label.ts` | New, admin-only, **not mirrored**. `hasProviderGameLabel()` asks about the **label alone** |

**Two decisions in there are load-bearing.**

**The new helper is deliberately not `isProviderContest`, and reusing that name would have
been the natural mistake.** `lib/services/games/contest-config.ts` already exports one, and
it answers a stricter question: label **and** provider key **and** game code, because a
labelled contest with no keys cannot launch a round. A screen is asking something else -
*what kind of row is this* - and a half-built provider contest is still a provider contest for
badging and for keeping out of the trading editor. Using the strict helper here would have
rendered a keyless provider contest as a **trading** one, with a trading Edit button and no
badge to suggest otherwise. Silent, and in the worst direction.

**Edit is withheld from provider contests with the reason shown, not greyed out.**
`/competitions/edit/[id]` renders the trading editor and `PUT /api/competitions/[id]` does a
blind `Object.assign` of that form's body, so this link is a **corruption path**, not merely a
confusing screen. Same reasoning as a provider switch that cannot work refusing with a reason
rather than being disabled. Until a provider editor exists, cancel and recreate is the honest
instruction.

> **SUPERSEDED 7 September 2026 by s2.2, and correct as history only.** A provider contest is
> now editable through its own editor and the Edit link **routes by game** instead of being
> withheld. The blind assign is gone — and the paragraph above understates what it was: the
> route authenticated on token validity rather than section access, so **every field on
> `Competition` was writable by any admin-token holder, on trading contests too.** The
> requirement did not change, only the remedy, which is why the test that pinned the
> withholding was flipped rather than deleted.

**Also worth recording: `startingCapital` was declared `number` and is never read here.** It
was a lie in the type for every provider contest, which has none, and the honest fix was to
mark it optional rather than to render a zero.

Pinned by `__tests__/admin/provider-contest-publish-ui.test.ts` (21 tests, **21 probes all
red**, `tools/probe-publish-ui.ps1`). The structural half **strips comments before matching**,
which is not optional here: these files explain the anti-patterns in prose, and a test that
reads prose flags a correct file for discussing the mistake while passing a broken one whose
only mention of the right thing is in a comment.

**One probe stayed green and it found a missing test, not a broken one.** Blanking the game
badge's condition left the suite green, because the probe had been aimed at a test asserting
that the *strict* helper is not imported - a different claim, which the other two call sites
keep satisfying. The badge had no test at all. **A probe aimed at the wrong test is
indistinguishable from a test that does not work.**

**What this does not include:** ~~no player screen starts a round~~ (**built the same day** -
`13` s1.1a); there is no unpublish, deliberately, because a visible contest can already have been
paid into and cancel-with-refund is the reversible operation; and ~~the round inspector, manual
resolution~~ (**also built the same day** - section 4.2a) and ~~the live-contest controls in
section 4~~ (**built 7 September 2026** - section 3.2a) are still unbuilt. **Correct as history,
stale as a present fact** - nothing in this list remains outstanding.

### 3.2a What was built - 7 September 2026, the live-contest controls

**The lifecycle actions table above asked for three routes to become game-aware. Mapping them
found six, an authorization sweep, and two defects that had nothing to do with games.** The
count is the recurring lesson: after four entry paths, ten finalize sites, six raw inserts,
seven subscription writers and one field with zero writers, a plan naming three routes is an
assumption until `rg` says so.

**Every route in the sweep, and what each one actually needed.**

| Route | Found | Done |
|---|---|---|
| `GET /api/competitions` | Its **own inline copy** of the JWT verification - cookie read, `jwt.verify`, nothing else asked | `guardSection("competitions")`, local helper and `jsonwebtoken` import deleted |
| `PUT/GET/DELETE /api/competitions/[id]` | Token validity only, on all three handlers | Guarded per handler (s2.2) |
| `POST /api/competitions/[id]/pause` | `verifyAdminAuth` on POST and GET; **`isPaused` enforced nowhere for a provider game** | Guarded, plus the gate below |
| `POST /api/competitions/[id]/cancel` | `requireAdminAuth` - admin-at-all, not section access | Guarded; live rounds now voided |
| `POST /api/competitions/[id]/emergency-cancel` | `verifyAdminAuth`; closes positions and left rounds `launched` | Guarded; live rounds voided; reports the count |
| `POST /api/competitions/[id]/adjust-results` | `verifyAdminAuth` | Guarded. **Still has no UI caller at all** - API-only, and recorded rather than hidden |
| `POST /api/finalize-old-competitions` | **No authentication of any kind.** Risk **R40** | Guarded **before `connectToDatabase()`**; provider contests skipped explicitly |

**`requireAdminAuth`, `verifyAdminAuth` and `verifyAdminToken` all answer "is this an admin at
all", and none is an authorization check** - an employee granted one unrelated section passes
every one of them. `requireSectionAccess`, which `guardSection` wraps, is the grant. That is now
the **sixth** instance of this class after Prerequisite A, the internal-secret fallbacks, the
unprotected suspicion-score route, the provider admin routes and `PUT` on the CRUD file, so it is
asserted across the whole set with an `it.each` rather than case by case.

**The unauthenticated one is different in kind and is R40.** The rule it produces: **the routes
with no guard are not found by reading the ones with weak guards.** Every sibling had *something*,
so a review pass over them would have missed this entirely. It was found by enumerating the
lifecycle routes and **counting exported handlers against guards** - which also catches the
subtler shape, a file whose `POST` is guarded and whose `GET` is not, passing any mention-based
check while leaving a mutation open.

**Pausing a provider contest did nothing at all, and that is R41.** The gate is now in
`round-launch.service.ts`, before any seat lookup or round creation, with three deliberate
properties:

- **Its own `contest_paused` refusal, not `contest_not_open`.** The contest *is* open and the
  player will be able to play, so the UI needs a different sentence and a different affordance -
  come back shortly, not "you cannot play this". The same reasoning that kept three other
  lifecycle refusals out of `contest_not_open` when `LaunchRefusal` was first written. Mapped to
  **409**, grouped with the other lifecycle refusals rather than the retryable 503s.
- **It blocks a resume as well as a start.** `blocked` is deliberately independent of `resuming`
  in `RoundPreflight.tsx`: an operator pauses to stop play, so letting a player continue inside a
  round they already have open defeats the control while appearing to honour it.
- **A pause is not rendered as an error.** The red panel is for a rejected action; a pause is the
  contest's normal state for a moment. Same distinction as the not-yet-started case in `13` s1.1b,
  and the test counts the red containers so a second cannot be added.

**Resume was compensating the wrong field, and the field it extended is the one called "end".**
`createRound` gates on `playWindowEnd`; the launch service gates on `playWindowStart`; `endTime`
gates neither. So extending only `endTime` gave the fairness compensation to trading and silently
withheld it from every provider game - the contest ran longer while the window players actually
play inside stayed exactly as short. Resume now extends `playWindowEnd`, and `playWindowStart`
**only while it is still in the future**, because shifting a window that has already opened would
re-close it and refuse play that was legitimately available a moment earlier.

**Cancelling reached into the rounds, and the sequence it replaces is the argument for it.**
Cancelling a trading contest closes its positions, because a position is all a trading contest
leaves running. A provider contest leaves a **round**, and nothing was closing it: the player kept
playing a contest that no longer existed, the provider's result was refused and audited as a late
result, and the reconciliation net then polled the round, backed off, and after the grace window
wrote it `unresolved` and raised a **critical** alert. **The operator got a critical alert for the
consequence of their own deliberate action**, which is the fastest way to teach a team to ignore
critical alerts.

`lib/services/games/contest-round-cleanup.ts` (mirrored) voids them, and three things about it are
load-bearing. It is **not a second ingestion door** - it writes a status, never a score, the same
argument that lets `resolveRoundManually` exist in admin. It uses **`voided` with
`resultSource: "manual"`**, because `abandoned` and `expired` describe something the player or the
clock did, and this was a platform decision. And it is called **inside the refund transaction**,
asserted by position against `commitTransaction()`, because a call after the commit would still
"call the function" and would void rounds for a refund that never happened.

**The operator's control panel described a different game, in seven places.** The worst read "All
positions will be closed at current prices" above the emergency-cancel confirm button, on a
contest with no positions, and listed "Calculate and record all P&L". Pausing reported "Trading is
now frozen" - doubly wrong, since the pause was not being enforced. The wording now comes from
`apps/admin/lib/admin/contest-control-copy.ts`, and two decisions there are worth keeping:

- **A shared model-free module, not a ternary per string.** The panel is `"use client"` and cannot
  import a service that reaches a Mongoose model, which is a real constraint with a real cost -
  the same one behind `components/games/play-state.ts` and the round-resolution action list. Both
  of those were first written as a second copy. This one is shared from the start.
- **The consequence lists genuinely differ; they are not a renamed noun.** Pausing a trading
  contest stops orders and closes nothing; pausing a provider contest stops rounds being started
  *or resumed*. Emergency-cancelling a trading contest closes positions and records P&L; a
  provider contest has its live rounds voided. **A wording pass that only swapped the noun would
  have left the operator reading a list of things that do not happen** - which is worse than the
  trading wording, because it reads as though somebody checked.

The flag is **derived server-side by `hasProviderGameLabel`** and passed in. The panel contains no
game check of its own, deliberately: what an operator is told about a money-adjacent action must
not be decidable in the browser, and there would otherwise be two answers in the admin app to "is
this a provider contest" - with the untested one in front of the operator. It is the **label**
helper, not the strict `isProviderContest`, for the same reason as the list: a keyless provider
contest must not be handed the dialog promising to close positions it does not have.

**Force-finalize now skips provider contests explicitly, and it was already a no-op.** The loop
closes `TradingPosition` rows at forex prices, so a provider contest fell through the
empty-positions branch and reported "No open positions found" - a healthy-looking result about a
puzzle. The skip says so instead. There is nothing to dispatch *to*: a provider contest that
reached `completed` has already been through `provider-settlement.service.ts`.

Pinned by `__tests__/admin/live-contest-controls.test.ts` (**63 tests**) and
`tools/probe-live-controls.ps1` (**31 probes, all red on the expected test**). Admin typecheck at
**223, the baseline exactly**, with no error in a changed file and - equally important - none
disappearing; the one apparent new entry was a **line shift** of a pre-existing error, which is
why the lists are diffed by message text rather than counted.

**Three probes came back green and each had a different cause, which is the whole value of running
them.** All three were **weak tests**, and in each case the injected defect satisfied the
assertion with a *different string*: restoring "All positions will be closed at current prices"
passed a guard written against the phrase "open positions"; deleting the mid-round resume line
passed a bare `/resum/i`, because "extend the play window and the end time when resumed" contains
it too; and replacing the pause list's mention of positions passed an assertion over the whole
copy object, because the emergency list still said "positions". **A vocabulary guard must match
the word, and a per-list claim must be asserted per list** - one list covering for the other is
indistinguishable from the guard working.

**And one claim was wrong rather than weak, in the same pass.** "No trading wording anywhere in
the panel" is false and must not be restored: the emergency toast keeps "N positions closed" in
its **trading** branch, because an operator running a trading contest still needs to be told what
happened to their positions. The honest claim is narrower - no *unconditional* trading wording -
and it is asserted over the JSX with the branched strings living in the handlers.

**Two things are recorded rather than fixed.** `adjust-results` has **no UI caller** and is
reachable only by API, so it is guarded but not usable by clicking; and the panel's
`emergency_ended` status is read while `emergencyCancelActiveCompetition` writes `"cancelled"`
with an `emergencyEndedAt` alongside, so **`emergency_ended` is a state the model declares and
nothing ever stores.** Both belong with X6.5's admin pass rather than here - the first needs a
screen, the second is a mirrored status decision - and neither is closed.

---

## 4. Provider-specific sections

Cross-reference only; the detail is in `09` E5 and `07`.

| Section | Purpose |
|---|---|
| Providers | List, credentials, enable/disable, catalogue sync, SLA notes |
| Provider health | Availability, callback latency, error rates, `provider_health_check` history. **Built 6 September 2026 - see s4.2b, and note it derives its verdict rather than reading a stored one** |
| Games | Per-title enable switch **independent of the provider's own status** |
| Round inspector | Round status, score, raw inbound event, replay link, resolution history |
| Manual resolution | Resolve an unresolved round with a **mandatory reason** and an audit entry |

Every model touched here exists twice. Update `apps/admin/database/models/` in the same
commit - see risk **R2**.

### 4.1 Adding a game must feel like adding a payment provider

**Owner requirement, 2 September 2026:** *"like we have payment providers, that also needs
to be with the games"* - an operator adds a game by entering rules, credentials and API
details, without a developer and without a release.

That pattern already exists in the admin app and should be followed rather than
reinvented:

| Reference | File |
|---|---|
| The screen | `apps/admin/components/admin/PaymentProvidersSection.tsx` |
| The model | `apps/admin/database/models/payment-provider.model.ts` |
| The routes | `apps/admin/app/api/payment-providers/route.ts`, `.../[id]/route.ts` |

**Copy the interaction model.** It is already the right shape: a list of providers, a
built-in versus custom distinction (`isBuiltIn`), an active toggle (`isActive`), a
sandbox/production switch (`testMode`), an ordering field (`priority`), a generic
credential bag rather than a fixed set of columns, and a per-credential secret flag so
values can be masked in the UI.

**Do not copy the storage.** This is the part to get right, and it is easy to get wrong
by being consistent:

| `PaymentProvider` does this | Game providers must not, because |
|---|---|
| Embeds `credentials[]` **inside the provider document** | `04` section 3.1 deliberately keeps credentials **out of** `game_provider`, so admin screens, the contest lobby and the catalogue picker can all read that document freely without a secret ever entering scope. Embedding them would undo that on consistency grounds |
| Carries `saveToEnv`, with a `regenerate-env` route that **writes credentials into `.env`** | A file write to reconfigure a running service is a deployment mechanism, not a settings mechanism. Game credentials are read at request time from settings - see `06` section 8 |

So: **the UX is the payment-providers screen; the persistence is `04` section 3.1 plus
settings.** Say so in the implementation, because a reviewer comparing the two features
will otherwise reasonably ask why they differ.

### 4.1a What was built - 4 September 2026

**`CODE-COMPLETE`, awaiting owner test.** Two of the five destinations in the table above:
**Providers** and the per-title **Games** list. Health is not built; the **round inspector and
manual resolution were built on 5 September 2026** - see section 4.2a.

| Piece | File |
|---|---|
| RBAC ids (add-only) | `game-providers`, `provider-health` in `apps/admin/database/models/admin-employee.model.ts` |
| Menu entry + render case | `apps/admin/components/admin/AdminDashboard.tsx`, beside Trading inside GAMES |
| Rules | `apps/admin/lib/services/game-providers/provider-admin.service.ts` |
| Routes | `apps/admin/app/api/games/providers/**` - list/register, patch, credentials, sync, games |
| Shared route guard | `apps/admin/lib/admin/section-route-guard.ts` |
| UI | `apps/admin/components/admin/games/**` - section plus register, credentials and catalogue dialogs |
| Tests | `__tests__/admin/game-providers-admin.test.ts`, 26 tests, six guards probed |

**Findings that generalise, all of them about a correct-looking thing that is wrong.**

- **A structural test that reads source code must strip comments first, and this one had to
  learn that the hard way.** The assertion "no route mentions `requireAdminAuth`" failed - on
  a comment in the route explaining why `requireAdminAuth` is the wrong helper. A test that
  reads prose fails in both directions: it flags a correct file that discusses the
  anti-pattern, and it passes a broken one whose only mention of the right helper is in a
  comment. `readCode()` strips block and line comments before matching.
- **`requireAdminAuth` is not an authorization check, and reaching for it here would have
  widened access invisibly.** It asks only whether the caller is an admin at all, so an
  employee granted one unrelated section passes it. These routes reach provider credentials,
  so the guard is `requireSectionAccess("game-providers")`. Two tests, not one: the first
  pins the helper, the second **counts the exported handlers and counts the guards**, because
  a file whose `GET` is guarded and whose `PATCH` is not passes the first check while leaving
  the mutation open.
- **"Blank means keep" is the only safe reading of an empty secret box, and the alternative
  fails silently.** Because the UI can never display a stored secret, an operator editing the
  environment submits four empty boxes. If empty meant "clear", that harmless edit would
  break every inbound callback with no error raised anywhere. There is no clear-by-blank path;
  removal is explicit.
- **Enabling has to refuse when it cannot work, or the switch lies.** Without an installed
  adapter, `resolveEnabledProvider` refuses every round with a message no operator can act on -
  a switch that appears to work and silently does nothing, the same shape as the trading-shaped
  services in `matchmaking.service.ts`. Without a callback secret, every inbound result fails
  signature verification, which is indistinguishable from an attack in the logs. Without a
  **callback token** (added 6 Sep 2026 with R34) every result fails one gate earlier, at the
  bearer check, and is logged as a suspected attack for the same reason. All three are
  refused at the admin layer with the reason shown on the card, not merely by disabling
  the control. **The third refusal closed a hole that was already reachable** - the screen
  could turn a provider on into a configuration where nothing could ever work, which is
  precisely what the other two exist to prevent.
- **Four credential boxes are two pairs, and the screen has to say which side issued each.**
  `apiKey`/`apiSecret` come from the provider and travel outbound; `callbackToken`/
  `callbackSecret` are ours and travel inbound. Four unlabelled boxes named "key", "secret",
  "token", "secret" invite an operator to paste one value into two of them, and the resulting
  failure is logged as an attack rather than a typo. **R34 was this same confusion made in
  code**, so the grouping is defect prevention rather than decoration.
- **There is deliberately no delete.** A provider that has run a contest is joined to
  historical rounds by `providerKey`, and `gameKey` is immutable, so deleting the row orphans
  that history while every screen still renders a key it cannot resolve. Same reasoning as the
  catalogue sync reporting missing titles rather than removing them.
- **The base URL rule is "https, except loopback" - and the exception is the secure case, not
  a relaxation.** Added 6 Sep 2026 after `isHttpsUrl` made it **impossible to register a
  first-party provider at all**: `http://127.0.0.1:4010` was refused, and the refusal looked
  entirely correct because an external provider certainly must be https. What it missed is that
  a first-party provider shares the machine, so loopback traffic **never touches a network** -
  it is safer than routing the same calls out through a public subdomain and back. Now
  `isAcceptableProviderUrl` (with `PROVIDER_URL_ERROR` shared by the register and edit paths,
  so the two cannot drift): plain http on `localhost`, `127.0.0.1` and `[::1]` only.
  **The case that pins it is `http://10.0.0.5`** - a private LAN address, which looks internal,
  is **not** loopback, and is still refused. Widening the carve-out to "any http" is the
  natural way to break this and reads as a tidy simplification, so a probe covers exactly that.
  Note the player is unaffected either way: the launch URL is built from the provider's own
  public play origin, which the specification treats as a separate fact from the API host.

**And one live defect the tests found:** the first time a callback secret was stored counted
as a rotation, stamping `rotatedAt` on a provider that had never rotated anything. It was
found only because the presence-booleans test asserted the **whole** credential object rather
than the three fields it cared about - the extra field was the evidence.

**A second one, found by a probe rather than a test, and the mechanism is the lesson.** The
presence badge was replaced with a hardcoded `true` and the suite stayed **green**: the fixture
stores every credential, so the wrong branch produced the right answer and nothing could tell
the two apart. The test that had to be written asserts a **missing** credential reads `false` -
which is also the case that matters, because a badge saying "set" for a token that was never
stored leaves the operator no way to discover why enabling refuses them.

### 4.2 The rules an operator enters, and the limit of "no developer needed"

Two different things get called "rules", and conflating them causes a promise that cannot
be kept:

1. **Contest rules** - entry fee, schedule, prize split, ranking method, attempts. These
   are ChartVolt's, live on the contest, and are set in the create wizard (section 2).
2. **Game settings** - a title's own parameters, such as question count or difficulty.
   These are the **provider's**, and are declared by the provider as JSON Schema in
   `configSchema` (`01` section 3). The admin form is generated from it, which is what
   makes a new title from a contracted provider bookable **by ticking a box, with no
   release**.

**Where the promise stops, stated plainly:** a new title from an **existing** provider
needs no code. A **new provider** needs an adapter, because it has a different API. The
adapter boundary in `02` is what keeps that cost to one bounded piece of work, but it is
not zero, and no admin screen can make it zero. A summary that says "admins can add any
game from the panel" is wrong in a way that will be discovered at the worst moment.

Trading keeps a **hand-written** config component registered in
`apps/admin/lib/games/registry.tsx`. Its settings are too specific to schematise and
there is exactly one of them.

---

### 4.2a The round inspector and manual resolution - BUILT 5 September 2026

**`CODE-COMPLETE`, awaiting owner test.** The third and fourth of the five destinations. An
operator can now see a stuck round, read every delivery the provider attempted for it, and end
it - rather than waiting on the reconciliation net and hoping.

| Piece | File |
|---|---|
| RBAC id (add-only) | `round-inspector` in `apps/admin/database/models/admin-employee.model.ts` |
| Menu entry + render case | `apps/admin/components/admin/AdminDashboard.tsx`, beside Game Providers inside GAMES |
| Action list, shared by client and server | `apps/admin/lib/admin/round-resolution-actions.ts` |
| Rules | `apps/admin/lib/services/games/round-resolution.service.ts` |
| Routes | `apps/admin/app/api/games/rounds/` - list, detail, `[roundId]/resolve` |
| UI | `RoundInspectorSection.tsx`, `RoundDetailPanel.tsx`, `ResolveRoundDialog.tsx` |
| Tests | `__tests__/admin/round-inspector.test.ts`, 21 tests, 12 probes all red |

**The scoping decision, which is the load-bearing part: manual resolution deliberately cannot
enter a score.** Chapter `02` s10 rule 3 puts every score through one function, and that
function - `applyResult` - lives in the **main app only**. Mirroring it into admin to offer a
score box would create the second door the rule exists to prevent, in the app with the widest
privileges and the least traffic. So the operator's power is to **end** the round: void,
abandoned or expired. That writes a status, never a score.

**Ending a round is enough to release a held contest**, which is what makes the narrower scope
sufficient rather than a compromise. `assessUnresolvedRounds` derives both of its answers from
`round.status === "unresolved"`, so a round moved off that status holds nothing. It also needs
no participant-score re-sync, because only `completed` rounds contribute and a voided round
never counted.

**What the UI must say, and does: a voided round scores nothing for that player.** If it was
their only attempt they finish on zero - the `score_zero` outcome applied by hand. That is a
decision about a paying player's contest, not a cleanup task, so the consequence is shown above
the confirm button rather than after it, and the reason is mandatory at 10 characters following
the manual-deposit and emergency-cancel precedent.

**Five findings, and the first is about the tooling rather than the code.**

- **A probe harness destroyed the file it was testing, and reported success.** These are Next.js
  dynamic routes, so the path contains `[roundId]` - which **PowerShell parses as a wildcard
  character class**. `Get-Content $File` matched nothing and returned `$null` while
  `Set-Content -LiteralPath` wrote perfectly well, so the harness emptied the route and then
  "restored" it to nothing. Every probe against that file went red **on the expected test**, for
  entirely the wrong reason. Two rules: **`-LiteralPath` on the read as well as the write**, and
  **refuse to write when the read came back empty.** The tell was the failure count - 5 to 7
  tests red for a one-line change, where the honest number is 1 or 2. **A probe that reports more
  damage than it caused is not reporting on your guard.**
- **An import is not a use, and it defeated three assertions in one file.** `toContain
  ("canTransitionRound")` stayed true when the call was replaced by a hand-rolled status check,
  because the name was still in the import line; `toContain("MIN_REASON_LENGTH")` stayed true
  when the check became `if (false)`, because the constant is still named in the error message;
  and `indexOf("resolveRoundManually")` found the import on line 8 and compared an ordering
  against that. **Match the call, with its arguments, and assert the operator rather than the
  operand.**
- **A shared list beats a duplicated one even when the duplication has a good excuse.** The
  action ids and their operator-facing consequences were first written twice, because the service
  imports Mongoose models and a client component cannot pull those into the browser. That is a
  real constraint and the wrong answer - it is the **"one rule, two copies"** shape behind four
  defects here already, none of which `check:mirrors` can see. The fix is a model-free module
  both sides import. The drift it prevents: a button offering an id the server has renamed,
  failing with a 400 that reads like a permissions problem.
- **An object lookup on a request-supplied key is not safe just because it is guarded.** `in`
  and object indexing both reach the prototype chain, so `"toString"` and `"__proto__"` pass -
  and `ACTIONS["__proto__"]` returns `Object.prototype`, which is truthy, survives a `!target`
  check and only fails later on a missing `.status`. **Safe by accident is not safe.** A `Map`
  has no prototype chain, so the lookup is total.
- **Only `hold_and_alert` actually stops a contest settling**, so only those rounds carry the
  "holding settlement" badge. Flagging every unresolved round would make the badge meaningless
  exactly where it needs to be trusted, since the other two policies settle on time. For the
  same reason the dialog reports whether settlement was *actually* released - a contest can be
  held by several rounds, and an operator told "settlement unblocked" while three others still
  hold it would stop looking.

**Still not built from the five destinations:** nothing, since 6 September 2026 - see s4.2b.
The inspector lists only rounds needing a decision - unresolved, or live and past expiry -
because a list including completed rounds buries the handful that matter. Completed rounds are
reachable by id.

---

### 4.2b Provider health - BUILT 6 September 2026

The fifth and last of s4's destinations. `apps/admin/lib/services/games/provider-health.service.ts`,
`apps/admin/app/api/games/provider-health/route.ts` and
`apps/admin/components/admin/games/ProviderHealthSection.tsx`, wired into `AdminDashboard.tsx`'s
GAMES group. 18 tests in `__tests__/admin/provider-health.test.ts`, 18 probes in
`tools/probe-provider-health.ps1`, all red on the expected test. **None of it is mirrored** -
`apps/admin/lib/services/`, `apps/admin/app/api/` and the admin components are admin-only, so
`check:mirrors` says nothing about any of it.

**The deviation from the plan, and it is the whole design.** This section describes health as
`provider_health_check` history - a stored record written by something that polls. It is built
as a **derivation instead**, computed on request from the rounds and the inbound events that
already exist. The reason is what the stored version already did to this platform:
`game_provider` has declared `healthStatus` and `lastHealthCheckAt` since X2, **nothing has ever
written either**, and `healthStatus` defaults to `"down"` - so the provider list was already
able to render a working first-party provider as down, with no error and no log line. A poller
would have replaced that with a subtler version of the same failure: a verdict that is correct
at the moment it is written and silently ageing from then on. **A derived verdict cannot go
stale, because there is nothing to be stale.** The two unwritten fields were stripped from the
admin DTOs (`provider-types.ts`, `provider-admin.service.ts`) rather than left for a future
screen to find and believe; they stay on the model, because a Mongoose field is add-only in
practice and removing them is a mirrored migration for no gain.

**Five things from building it that generalise.**

- **A field that is declared, read and never written is worse than an absent one, and it reads
  as finished on review.** `lastSuccessfulRoundAt` was exactly this - declared on `provider_game`,
  read by the contest pre-flight's sandbox-freshness warning, written by nothing - so **every
  operator creating or publishing a provider contest saw a stale-sandbox caution that could
  never clear.** A warning that is always on is a warning nobody reads, which is the same harm
  as the badge that flags every unresolved round. Recorded as **R38** and fixed in the same
  piece of work, at gate 11b's sibling in `result-ingestion.service.ts`: the single ingestion
  door is the only place that knows a round scored. **Before building a screen on a field,
  grep for its writer** - the fourth time counting writers has changed a design here.
- **Only a status that scored may stamp a success.** `abandoned`, `expired` and `voided` are all
  terminal, and stamping them would make the freshness signal mean "a round ended recently",
  which is true of a provider that is failing every round. The stamp is also wrapped so a
  failure to write it cannot fail the ingestion - the score is the money-bearing fact and a
  cosmetic timestamp must never be able to reject it.
- **Configuration must outrank traffic, or a deliberate switch reads as an outage.** A provider
  an operator has disabled has no rounds, which is indistinguishable from a provider that is
  broken if you only count rounds. `not_configured` is therefore checked first and names the
  missing thing - master switch, provider switch, adapter, or the `callbackToken`/`callbackSecret`
  pair - because "down" with no reason is the message that made the stored field useless. Same
  reasoning as refusing to enable a provider with no adapter rather than greying the control out.
- **Judge unresolved rounds as a share, never as a count.** A flat threshold calls a busy
  healthy provider sick and a quiet broken one well. And **a duplicate delivery is not a
  failure** - a retried callback has done nothing wrong, so it is excluded from the error count
  for the same reason a duplicate contest entry returns idempotent success. **Signature failures
  are counted separately**, because they are the one class an operator must act on differently:
  a rotated secret and an attack look identical in a general error total.
- **"No traffic" is its own verdict and must not be either of the other two.** A configured
  provider that has simply never run is not healthy - nothing has been proven - and it is not
  down either. Reporting it as healthy is how a launch-day integration passes its own health
  check while being completely untested.

**Deliberately not built:** no round list, because the round inspector is that screen and a
second one drifts from it. `07`'s `provider_health_check` model was **not** created, for the
staleness reason above - if a stored history is ever wanted it should be an append-only log of
what the derivation observed, never the current verdict.

### 4.2c A third per-title control: the play style - BUILT 9 September 2026

The Games list carried two switches per title (s4.1a) and a content editor. It now carries a
**third control**, the play style, and the separation from the content editor is the design
rather than a layout preference. `apps/admin/components/admin/games/GamePlayStyleControl.tsx`,
`apps/admin/lib/services/game-providers/game-play-style.service.ts` and
`PATCH /api/games/providers/[providerKey]/games/play-style`, with the resolved style also
badged on the contest wizard's game picker. 37 tests in
`__tests__/admin/game-play-style.test.ts`, 19 probes in `tools/probe-game-play-style.ps1`.
**Chapter `22` section 9 is the authoritative account**; what follows is the admin-surface half.

**Why it is not in the content dialog.** That dialog writes the title, the description, the
thumbnail and the banner - copy an operator can get wrong and fix, with no consequence beyond
how a page reads. The play style decides **when entry closes and how many attempts a player
gets** (`22` s8.2), on contests people pay to enter. It is the same distinction as
`chartvoltEnabled`, which is also a switch on the card rather than a field in the form, and
`playModeOverride` is on `NEVER_EDITABLE_CONTENT_FIELDS` so the two cannot be conflated by a
later allow-list edit.

**Three things about the surface specifically.**

- **The control writes a SECOND field.** The provider's `playMode` is rewritten by every
  catalogue sync, so a control editing it would save, toast and be silently reverted - the
  "appears to work and does nothing" shape this chapter has now recorded for a provider enabled
  with no adapter, a `rankingMethod` a provider game ignores, `isPaused` on a provider contest
  and the Edit link on the competitions list. The card shows the effective style and, when we
  have overridden the provider, says so.
- **It withholds itself on a `head_to_head` title, with the reason.** Two people cannot play
  each other at different times, so there is nothing to choose; the card says that rather than
  greying a select box. Same rule as refusing to enable a provider with no adapter. The
  component and the service both ask `canOverridePlayMode` - a probe giving the component its
  own copy of the test is red, because a control offering a choice the server refuses reads to
  an operator like a broken permission.
- **The wizard's picker badges the style because it changes the wizard.** More of step 4 and
  step 5 depend on this one property than on anything else about the title (`12` s2.11), so an
  operator choosing a game is choosing a schedule shape at the same moment. The badge reads the
  **resolved** value `listContestableTitles` already returns; a probe making it re-derive from
  the raw fields is red.

**Not built:** no bulk edit.

> **SUPERSEDED LATER THE SAME DAY - see s2.12 and `22` s10.** This paragraph used to continue
> "and no per-contest override. The shape is a property of the title, resolved from the stored
> catalogue row and never from caller input - a per-contest control is precisely the way to turn
> off whichever half of the rule is inconvenient." **That is now false.** A title may declare it
> supports both shapes and the operator picks one per contest. The reasoning was sound and the
> mechanism it feared is not what shipped: the pick is validated against a **stored** supported
> set, so a race is only runnable as a time trial if somebody declared that this race has a
> legitimate time-trial form - the operator cannot invent a shape, only choose a declared one.
> Kept rather than rewritten, because the paragraph names the hazard the supported set exists to
> close.

### 2.12 The operator picks one of the title's supported shapes - BUILT 9 September 2026

**`External game plans/22` section 10 is the authoritative account**, including the design
reversal. This section records the admin surface only.

Two controls, on two screens, answering two questions.

- **On the Games list**, beside Play style: **Supported styles**, writing
  `provider_game.supportedPlayModes`. It is what a title *can* be run as. The title's own
  effective style is **always ticked and locked**, because that is what the Play style control
  says the game is and what every contest already created on it was created as - narrowing the
  set is therefore done by changing the play style, not by unticking it here. `head_to_head`
  withholds the control entirely, for the same reason it withholds Play style.
- **In the contest wizard's schedule step**: `ContestPlayModeField`, which is what *this*
  contest is run as. **It renders only when the title supports more than one shape**, so the
  step is byte-for-byte unchanged for the entire live catalogue, and its options are the
  server's `resolveSupportedPlayModes` output rather than anything the component derives - a
  select offering a shape the create service refuses produces a 400 that reads to an operator
  like a permissions problem.

**Three things about the surface specifically.**

- **The route takes one decision per request.** `PATCH .../play-style` refuses a body carrying
  both `playMode` and `supportedPlayModes`, because the two write different audit lines and one
  entry covering both cannot answer which decision somebody made.
- **The wizard's forced values move with the picker, not with the title.** Choosing `scheduled`
  re-derives `attemptsPolicy` and `roundStartPolicy` from the *chosen* shape immediately, so the
  step can never display "3 attempts" on a contest about to be stored as one - the same rule
  that made step 4 and step 5 read the resolved shape in s2.11.
- **The scheduled option carries a warning, not a note.** Both consequences - entry closing at
  the gun and one attempt each - are irreversible on that contest once it exists, because
  `Competition.playMode` is frozen. An operator picking it to get "everybody races together"
  does not expect sign-ups to stop at the start time.

**Not built:** no bulk edit of supported styles, and **no way to change a contest's shape after
creation** - deliberately, and not for effort. It decides when entry closes and how many
attempts a paying entrant gets, so a contest that should be the other shape is a new contest.
Same answer as refusing a game-type change on a zero-participant draft (s2.2).

---

## 5. Stats and analytics

| Screen | Change |
|---|---|
| `AdminOverviewDashboard.tsx` | Active contests and participants **per game**. Hide the price-feed panel when trading is off. **BUILT - s5.1b**, with the price-feed rule narrowed for the reason recorded there |
| `CompetitionAnalytics.tsx` | Game filter, module-declared columns, participation funnel |
| `FinancialDashboard.tsx` | Entry-fee volume, fee revenue, payout ratio and average pot **by game** - and by provider, since provider cost is per-provider |
| `TradingHistorySection.tsx` | Leave as-is. Hide when trading disabled. **BUILT - s5.1c**, by withholding the destination they live in rather than the two components |
| `PriceHealthWidget.tsx` | Hide when trading disabled. **BUILT - s5.1c**, same change |
| Fraud monitoring | Extend to non-trading entries - risk **R9** |
| **New: Game Performance** | Per-game operational metrics: rounds started versus completed, abandonment rate, unresolved-round count, average round duration, provider callback latency |

The Game Performance screen is the one that does not exist in the in-house plan, and it
is the one that will be looked at daily. **Rounds started versus rounds completed is the
single most useful number in the whole integration** - it detects a broken game, a
provider outage and a cheating pattern, all before players complain.

### The commercial question this must answer

Per-round provider cost against entry-fee revenue, per game. Without it there is no way
to tell whether a title is profitable or merely popular. Model it against `08` section 3
before launch, then measure it here.

### The binding rule for every figure on these screens

**No operator-facing aggregate may silently mean "trading only".** Each figure is either
generalised across games, explicitly scoped and labelled to one game, or removed from the
platform-wide view. `05` section 10 states the rule and lists the dispositions; this
screen set is where an operator would first notice it being broken - and the failure is
silent, because a trading-only total keeps computing and keeps rendering.

### 5.1a What was built - 7 September 2026, analytics and game performance

Two of the seven rows in the table above, plus the whole of **New: Game Performance**.
`CompetitionAnalytics.tsx` became game-aware and grew a by-game and by-provider financial
breakdown, which is `FinancialDashboard.tsx`'s row satisfied on the analytics screen rather
than on the financial one - see the deviation at the end. **50 tests, 39 probes.** Still
outstanding in this section: `AdminOverviewDashboard.tsx` (**closed by s5.1b**, 8 September
2026 - stale as a present fact, correct as history), the hide-when-trading-off rows,
the participation funnel on the analytics screen itself (it is on Game Performance instead),
and the per-round provider cost the commercial question needs, which has no data source until
X4 supplies a real contract.

**The live code:**

| File | What it is |
|---|---|
| `apps/admin/lib/admin/contest-analytics-presentation.ts` | Pure, model-free. Game badges, the per-player metric, share of pool, the by-game and by-provider arithmetic, the filter, the scope note |
| `apps/admin/components/admin/competitions/GameRevenueBreakdown.tsx` | The two summary tables |
| `apps/admin/components/admin/CompetitionAnalytics.tsx` | Filter, badges, game-aware columns, scope note |
| `apps/admin/app/api/competition-analytics/route.ts` | Now section-guarded, and sends the catalogue names and `finalScore` |
| `apps/admin/lib/services/games/game-performance.service.ts` | Derived per-title operational metrics |
| `apps/admin/app/api/games/performance/route.ts` | `GET`, guarded on the new `game-performance` section |
| `apps/admin/components/admin/games/GamePerformanceSection.tsx` | The screen |

**Nothing here is mirrored.** `apps/admin/lib/admin/`, `apps/admin/lib/services/games/` and
the admin API routes are admin-only, so `check:mirrors` says nothing about any of it.

#### Four defects found on the analytics screen, and only one of them was the game gap

The screen was opened to add a game filter. Three of the four things wrong with it had
nothing to do with games, and **the same instrument found them: generalising code is a better
bug-finding tool than looking for bugs**, which is the fifth instance of that after X5's
second half turned up three pre-existing trading defects.

- **The route authenticated with `verifyAdminToken`, which is token validity and not section
  access.** Any employee holding an admin token could read every competition's entry-fee
  volume, platform fee and payout list regardless of their grants. **Sixth instance of that
  class**, after Prerequisite A, the internal-secret fallbacks, the unprotected
  suspicion-score route, the provider admin routes and `PUT /api/competitions/[id]` - so carry
  the rule and not the instances. Now `guardSection("analytics")`, pinned by a test that
  **counts exported handlers against guards** rather than merely finding the helper named.
- **"Prize %" had never worked, for any game, ever.** Nothing writes `metadata.percentage` on
  a `competition_win` row - checked with `rg` across both apps and both copies of the payout
  stage - so `metadata?.percentage || 0` rendered **0%** against every winner of every
  competition ever settled. Replaced by the share of the pool the payment actually represents,
  derived from two figures that do exist. That is not merely a substitute: **after
  redistribution and ties the share paid at a rank is routinely not the share configured for
  it** (R45), so the derived figure is the one an operator actually wants.
- **"Final P&L" was rendered unconditionally, and it is R46 one screen along.**
  `prize-payout.service.ts` writes `finalScore` for a provider contest and deliberately no
  `finalPnl`, so the column read `+0.00` in green for every game winner while the number the
  contest ranked on sat unread in the same document. Same read-side confusion of an absent
  fact with a measured zero, one screen further out - and the fix reuses
  `resolveResultMetric` from `12` s2.4 rather than restating the rule, because **two screens
  disagreeing about whether an absent score is `0` or `-` is the defect, not the styling.**
- **Every headline card was captioned as an all-time total and covered the last 50
  competitions.** The route reads the 50 most recently finished and every card is a reduction
  over that list, so "Total Platform Fees Earned" has always meant "of the last 50". That is
  the binding rule above failing along the **window** axis rather than the game axis, and it
  is equally unusable. **The arithmetic was deliberately not widened**: a behaviour change
  made in the same edit as a labelling fix destroys the only evidence the labelling fix was
  safe, which is the reasoning that kept the Game Master `||` defect verbatim while
  settlement was being extracted. The limit is now **sent by the route** rather than
  duplicated in the caption, so raising it cannot leave the caption naming the old one.

#### Five things about the two summaries that drift easily

- **Grouping is on `gameKey` and never on the display name.** The key is immutable and is the
  join key for every historical figure; a display name is catalogue content an operator can
  edit. Group by the name and renaming a title **silently splits one game's revenue into two
  rows that each look complete**, with no error and totals that still add up.
- **By game and by provider are two questions, not one with a redundancy.** Provider cost is
  **per provider, not per title**, so the figure a commercial decision is made against is the
  provider-level one while the figure an operator schedules against is the title-level one.
- **Trading is a group in the provider comparison, not an exclusion.** A comparison with one
  side missing is what made every earlier version of this screen misleading. It is the binding
  rule read backwards: a total that silently means "all games added together" is as unusable
  as one that silently means trading only, because the economics differ.
- **A retired title keeps its row, labelled.** The fallback chain ends at the game code and
  then at the key, **never at "Unknown"** - a row captioned "Unknown game" holding real
  revenue is a row an operator cannot investigate. Same reason the filter is built from the
  contests present rather than from the catalogue: a catalogue-built filter leaves a retired
  title's rows in the list and unreachable by any selection, which reads as data loss.
- **A non-finite figure in one contest is treated as absent, not added.** One bad row would
  otherwise turn a whole game's revenue line into `NaN` along with every ratio derived from
  it - a total that reads as a rendering bug rather than as a data problem in one row, so the
  actual cause is invisible. Same instinct as `Number.isFinite` replacing `||` in R31.

#### Game Performance, and why it carries no money

- **It answers a different question from the analytics screen, and one of them can be healthy
  while the other is not.** Analytics answers "what did we earn from each game"; this answers
  "is the game working for the people playing it". **A title whose rounds are abandoned half
  the time still books its entry fees**, so the money screen shows a profitable game and
  nothing anywhere shows the problem. That is why `12` s5 calls rounds started versus
  completed the single most useful number in the integration.
- **No money on the screen, and that is an RBAC decision rather than a layout one.** It is
  granted by a games section; entry-fee volume and platform revenue are granted today by
  `analytics` and `financial`. Adding a revenue figure here would widen who can read it while
  reviewing as a helpful addition - the same shape as the section merge s1.1 warns about.
  Pinned by asserting **every field the component reads off a row**, not by forbidding the
  word: the description deliberately names fee revenue in order to send an operator to the
  screen that carries it, and a check on the word alone would forbid the signpost that makes
  the omission a boundary rather than a gap.
- **It is not a summary of provider health and must not be merged with it.** Health is per
  **provider** over 24 hours and answers "who do I ring"; this is per **title** over weeks and
  answers "which game should we keep running". Two questions, two granularities, two windows.
- **The window is an allow-list, never a number from the query string.** An arbitrary `days`
  is a full-collection scan anybody holding the grant can trigger by editing a URL, and it
  looks like a legitimate request in the logs. Same rule as deriving the market-hours gate's
  game type from the stored label rather than from caller input. The component reads the
  window **back from the response** rather than trusting what it asked for, so an unrecognised
  value cannot caption the figures with a window they were not measured over.
- **Result latency is the number R44's grace window exists for, and nothing was measuring
  it.** A latency approaching the window means results are about to start being refused as
  late, and a player who finished inside the contest is then ranked on nothing. It is the
  earliest warning available for that.
- **Clock skew is held apart from latency rather than averaged in.** `completedAt` is the
  provider's clock and `resultReceivedAt` is ours, so this is the only cross-clock figure on
  the screen. A negative delay means the two disagree, which is a different problem from a
  slow provider - and averaging a negative into the mean **hides both**, reporting a healthy
  latency on a provider whose clock is minutes ahead.
- **Abandonment is a share of finished rounds, never a bare count and never over all rounds.**
  Two abandoned out of four is a game people cannot get on with and two out of four hundred is
  nothing, so a count calls the first fine. And live rounds are excluded from the denominator,
  or the rate improves every time somebody starts playing.
- **A retired title keeps its row here too, badged.** A screen that dropped it would make the
  abandonment its rounds recorded disappear the moment an operator switched the game off -
  the read-side form of the retroactive subtraction R29 exists to prevent.
- **`no_traffic` is its own verdict**, grey rather than green, for the reason
  `ProviderHealthSection` records about its own: a title with no play is neither healthy nor
  broken, and a green badge there is a guess presented as a measurement.
- **The verdict and its sentence are returned together from the service**, so a badge reading
  "problem" beside a sentence describing healthy traffic is unreachable. That combination is
  worse than either being wrong alone, because it destroys an operator's confidence in the
  whole screen.

#### Two things about the funnel that were wrong in the first draft

Both are recorded because both produced a plausible number rather than an error.

- **The seat count was scoped to `gameKey` alone**, so the "never played" shortfall was every
  seat the title had ever sold against the players of one window - a figure that grows for
  ever. It is now scoped to the contests actually played in the window.
- **The played set was taken from all ranked rounds, which includes challenges.** The
  denominator is competition seats, so a challenge player counted as having played a
  competition produces a shortfall that is wrong on any game and **negative** on a busy one.
  Both sets now come from competition rounds only, and the difference is computed as a **set
  difference rather than a subtraction of two counts** - the two sets come from different
  collections, so a user in one and not the other is exactly the fact being measured, and a
  plain subtraction silently improves whenever anyone appears in the round set who is not a
  seat.

And the boundary that has now caught a fixture and a query: **`game_round.contestId` is an
ObjectId while `competition_participant.competitionId` is declared `String`, and the raw
driver does no casting.** An unconverted `$in` matches nothing, logs nothing, and reports
every entrant as having played - a number that is always reassuring and always wrong. Same
trap as the R42 fixture, and it is pinned by its own test.

#### Two deviations, recorded rather than absorbed

- **The by-game and by-provider financial breakdown was built on the analytics screen, not on
  `FinancialDashboard.tsx`** as the table above says. Reason: the figures are derived from the
  contest list the analytics route already assembles, and the financial dashboard reads a
  different set of sources entirely - putting it there means either a second aggregation that
  can disagree with this one, or moving the analytics route's work under a different grant.
  **Two screens disagreeing about one game's revenue is worse than the breakdown being on the
  neighbouring screen.** A cross-link from the financial dashboard belongs with X6.5.
- **The participation funnel asked for on `CompetitionAnalytics.tsx` is on Game Performance
  instead.** It is a rounds-versus-seats figure, so it needs the round collection the
  performance service already aggregates and the analytics route does not touch. Putting it on
  the money screen would mean a second round aggregation behind the `analytics` grant.

#### What is deliberately not fixed, and must not be summarised as done

- **`_totalEntryFees` is computed from the ledger and unused.** `totalCollected` is derived as
  `participants x entryFee` instead, so the two can disagree - a partially refunded contest is
  the obvious case. The route now **flags `platformFeeEstimated`** when a fee figure was
  inferred from settings rather than read from a ledger row, and the summary counts how many
  of its figures are estimates, so the discrepancy is visible. **Changing the arithmetic is a
  behaviour change and was kept out of a labelling fix**, for the reason given above.
- **`finalLeaderboard` is still rendered by no admin screen**, so `isTied`, `prizeAmount` and
  the stored `qualificationStatus` snapshot remain invisible outside the contest view screen
  added in s2.6. That is X6.5.
- **`AdminOverviewDashboard.tsx` is untouched**, so the platform's front page still counts
  active contests and participants with no game dimension at all. **Closed by s5.1b on
  8 September 2026** - and the sentence above is wrong in a way worth keeping, because it
  says "with no game dimension" where the truth was that it counted no contests at all.

### 5.1b What was built - 8 September 2026, the overview's live-competition figures

The first row of the table in section 5. `getLiveContestOverview()` groups every `active` and
`upcoming` contest by game, `/api/dashboard/stats` carries it, and the front page renders a
**Live competitions** card beside System Status. **14 tests, 8 probes red on exactly the
expected test.**

**The live code:**

| File | What it is |
|---|---|
| `apps/admin/lib/services/games/live-contest-overview.service.ts` | The aggregation, plus `shouldShowPriceFeed` |
| `apps/admin/app/api/dashboard/stats/route.ts` | Carries the figures - and is now granted by `overview` rather than by admin-at-all |
| `apps/admin/components/admin/AdminOverviewDashboard.tsx` | The Live competitions card, and the conditional price-feed tile |

**Nothing here is mirrored.** `apps/admin/lib/services/games/` and the admin API routes are
admin-only, so `check:mirrors` says nothing about any of it.

#### The five things worth knowing

- **The row reads as a trading-shaped aggregate needing a game dimension added, and that is
  not what was there.** No competition model, no participant model and no game field appeared
  anywhere in `AdminOverviewDashboard.tsx` or `/api/dashboard/stats`. **The overview counted no
  contests at all, of any game.** So this is additive, and none of the "a trading-shaped
  aggregate keeps computing and keeps being wrong" hazard applies - there was no wrong number
  on the screen, there was no number. Worth stating rather than letting a summary imply a
  defect was fixed.
- **Seats are attributed to the CONTEST's game, never to the seat's own label** - and the
  obvious one-query version does the opposite. `competition_participant.gameKey` is
  denormalised onto the seat with a schema default of `trading`, the Game Master route inserts
  with the raw driver and bypasses defaults entirely (**R7**), and the X1 backfill has never
  been applied to production. So a provider contest's seats can be stored labelled `trading`,
  and grouping on them files real game entrants under trading **while every total still adds
  up.** The contest is the authority on its own game.
- **`competition_participant.competitionId` is declared `String` while `Competition._id` is an
  ObjectId**, and an aggregation pipeline does no casting, so an unconverted `$in` matches
  nothing and reports every contest as empty. Third instance after the R42 fixture and the
  analytics participation funnel.
- **The screen carries no money, and that is an RBAC decision rather than a layout one.** The
  overview is granted by `overview` while revenue lives behind `analytics` and `financial`, so
  a prize-pool figure here is a **silent widening of who can read the platform's earnings** -
  and it reviews as a helpful addition. The guard asserts the field names the service could
  select, not the word "revenue". Same reasoning that keeps Game Performance free of revenue.
- **The route was granted by `verifyAdminAuth`**, which asks only whether the caller is an
  admin at all, so an employee granted one unrelated section passed it. Now `guardSection`
  with the `overview` id. **Eighth instance of that class** after Prerequisite A, the
  internal-secret fallbacks, the suspicion-score route, the provider admin routes, the
  contest-edit route, the seven lifecycle routes and the analytics route - so carry the rule
  rather than the instances.

#### The deviation, recorded rather than absorbed

**The price-feed panel is not hidden on `tradingEnabled` alone**, which is what the table
asks for. Switching trading off stops new trading contests being created and entered; it does
not close the ones already running, and every open position in them is still priced, marked to
market and settled from the same feed. **A health indicator that disappears exactly when
somebody needs it is worse than one shown needlessly.** So `shouldShowPriceFeed` withholds it
only when trading is off **and** has nothing live - which is the state the row is actually
describing, a platform that has moved on from trading.

The same reasoning keeps `getEnabledGameTypes()` out of the counts: it decides whether one
status tile is drawn and nothing else. **The contests are grouped by whatever `gameKey` values
the data holds**, so a game an operator has just switched off with a contest still running is
still counted and still shown - which is R29 and invariant 9, and is the case where hiding it
would be most harmful.

#### A probing lesson, the fourth cause of a green probe

The probe adding `draft` to the live status list came back **green, and the test was not
weak, the claim was not wrong, and the guard was not unreachable** - the mutation changed no
observable. A draft increments neither counter, so the totals stayed 1 and 1 while the draft
was now being fetched. **The observable is the ROW**: an unpublished contest appears on the
operator's front page as a game with something on, every figure beside it reading zero. A
second test asserts the row set, and the probe names it.

#### What is still outstanding in section 5

- The per-round provider cost the commercial question needs, which has **no data source until
  X4** supplies a real contract.
- The participation funnel on the analytics screen itself - it is on Game Performance instead,
  for the reason recorded in s5.1a.
- `finalLeaderboard` rendered outside the contest view screen. That is X6.5.

---

### 5.1c What was built - 8 September 2026, withholding trading's screens

The last two rows of section 5's table, and **section 9's `tradingEnabled = false` acceptance
criterion**, which turned out to be the same item. **18 tests, 11 probes red on exactly the
expected test**, admin typecheck at the 223 baseline with nothing in the changed files and
nothing disappearing.

| File | What it does |
|---|---|
| `lib/admin/trading-surface.ts` | The rule and the fail-open default. Model-free, admin-only, **new** |
| `lib/services/games/live-contest-overview.service.ts` | `getTradingSurfaceVisibility()` resolves the two facts; `shouldShowPriceFeed` becomes a delegation |
| `lib/admin/game-sections.ts` | `TRADING_MENU_ID`, so the sidebar's filter does not spell the id as a literal |
| `app/dashboard/page.tsx` | Resolves the facts server-side and passes one boolean in |
| `components/admin/AdminDashboard.tsx` | Withholds the `trading-menu` parent from `filteredMenuGroups` |

**The three rows are one change, and that is the finding worth keeping.** Section 5 names two
components; section 9 names the group. `TradingHistorySection.tsx` and `PriceHealthWidget.tsx`
are reached **only** through the TRADING destination - grep says they have no other caller
anywhere in `apps/admin` - so withholding the destination satisfies both rows and the four
screens neither of them named. Two components were never going to learn a flag.

#### The deviation, and it is the same one as s5.1b

**The rule is not `tradingEnabled` alone**, which is what both entries literally say. Switching
trading off gates creation and entry; it does not close the contests already running, and an
operator running one still needs symbols, market hours, risk limits and price health. Section 9's
own criterion says as much in its second half - "and running trading contests still finish
correctly" - so hiding those screens contradicts half the criterion while satisfying the other.
The surfaces are withheld only once trading is off **and** has nothing live.

**It is one rule with two consumers, not two conditions.** The overview's status tile and the
sidebar ask the same question, and two copies of it is the "one rule, two copies" shape behind
`referenceId`, `failedReason`, `challengeId` and the Game Master `||`. Worse than usual here,
because the copies would disagree only in the state nobody tests. The guard is **behavioural**:
a test compares `shouldShowPriceFeed` against the shared rule in all four combinations, because
an assertion that the wrapper merely *imports* the rule is satisfied by one that imports it and
then decides for itself.

#### Four things that generalise

- **Hiding is not revoking, and the negative assertion is the only half that can see the
  difference.** The six section grants are untouched, so `?activeTab=price-health` still opens
  the screen and the tab strip inside it still works. Gating the render on the same flag reads
  as completing the job and locks an operator with a bookmark out of the screens that run a
  contest still being played - the exact harm the OR exists to prevent, reintroduced one layer
  down. The test counts the flag's occurrences (three: the prop, its default, the filter),
  because a fourth is a gate somewhere it does not belong.
- **A visibility default must fail OPEN, which is the opposite of a permission's.** The flag
  travels through a prop and is derived from two database reads. Fail closed and an operator
  loses six screens because a settings read timed out, silently, with nothing to click. Fail
  open and the menu is untidy on a platform that has stopped trading. Same direction as
  `getEnabledGameTypes()` answering trading when its own read throws.
- **A liveness query must be written as "not the other game", never as "this game".**
  `gameType: { $ne: "provider" }` matches a document with no label, and **invariant 5 resolves
  an absent label to trading**. Written `gameKey: "trading"`, every contest predating X1 - and
  any the backfill has not reached, since it has never been applied - stops counting, and the
  screens vanish while one is still being played.
- **Withholding a menu parent is safe precisely because it is not a permission.**
  `trading-menu` is deliberately absent from `ADMIN_SECTIONS`, so there is nothing to revoke by
  accident. A test asserts that absence, because the day somebody adds it is the day hiding the
  parent starts widening or narrowing real access.

#### A probing note

The price-feed probe in `tools/probe-live-contest-overview.ps1` **had to be re-aimed** when the
rule moved out of the service: mutating a one-line delegation proves only that a wrapper
forwards. It now mutates the shared rule, which is the property that matters once there are two
consumers. Left un-updated it would have reported `DID NOT APPLY`, which reads like a broken
harness rather than a moved target.

---

## 6. Settings that need a game dimension

| Setting | Model | Change |
|---|---|---|
| Competition rules defaults | `CompetitionRules` | Per-game defaults come from the module |
| Challenge settings | `ChallengeSettings` | Add `gameTypeDefaults`, `enabledChallengeGameTypes` |
| Market hours | `MarketSettings` | **Scope `blockCompetitionsOnHolidays` and `blockChallengesOnHolidays` to games with `needsMarketHours`.** A forex holiday must never block a chess contest - risk **R10** |
| Trading risk | `TradingRiskSettings` | Unchanged; move under the TRADING group |
| Points normalisation | new `PointsSettings` | Per-game normalisation constants - `05` |
| Provider credentials | `WhiteLabel.gameProviders` | Per provider, with sandbox and production separated - `04` |
| Environment | `WhiteLabel` | Surface `tradingEnabled`, `enabledGameTypes`, `externalGamesEnabled` in `EnvironmentSection.tsx` |

**Disabling a game prevents new contests only.** Active contests must be allowed to
finish. The same rule applies to disabling a provider, and the admin UI should say so
explicitly rather than leaving an operator to guess.

---

## 7. Content and copy inside admin

| Item | Change |
|---|---|
| Email and notification templates | `competition_starting`, `competition_ended`, `challenge_received` need game-neutral wording. `margin_warning` stays trading-only |
| Template deep links | Several link to `/trade`. **For a provider contest that is a broken link** - risk **R23**. They must resolve through the play dispatcher in `13` |
| `SitePage` terms of service | Legal review, not find-and-replace - risk **R11** |
| Admin wiki | `AdminWikiSection.tsx` needs articles on running a provider contest, reading the round inspector, and resolving an unresolved round |

The wiki article on unresolved rounds is not optional. It is the runbook support will
need at the worst possible moment, and writing it after the first incident is too late.

---

## 8. Effort

| Task | Estimate |
|---|---|
| Navigation restructure, conditional groups, RBAC registry (including the 8 omissions) | 2 days |
| Game picker plus dynamic `configSchema`-driven settings step | 4 days |
| Edit form parity and immutable game type enforcement | 2 days |
| List and detail game columns, filters, module-declared leaderboard | 2 days |
| Provider, health, catalogue, round inspector, manual resolution (`09` E5) | 5 days |
| Analytics by game and provider, Game Performance screen | 4 days |
| Financial dashboard by game and provider, cost-versus-revenue | 3 days |
| Settings adjustments - market-hours scoping, points, credentials | 2 days |
| Notification and email template rework, admin wiki articles | 2 days |
| **Total** | **~26 days (~5 weeks)** |

Roughly half falls in **X6**; the analytics and financial parts can slip into **X7**
without blocking anything.

---

## 9. Acceptance criteria

- [ ] A provider contest is creatable end to end **without a single trading field
      appearing**
- [ ] A new provider title becomes bookable **with no code change** - the proof that
      `configSchema` works
- [ ] Trading contest creation is unchanged
- [x] `tradingEnabled = false` hides the TRADING group, and running trading contests
      still finish correctly - **s5.1c**. Note the second half made the first conditional:
      it is hidden once trading is off **and** has nothing live, because the screens that
      operate a running trading contest are needed for as long as it runs
- [ ] Analytics and financials filter by game **and by provider**
- [ ] An employee can be granted every new section
- [ ] An admin can resolve an unresolved round, with a reason recorded, without a
      developer
- [ ] A forex market holiday does not block a provider contest
