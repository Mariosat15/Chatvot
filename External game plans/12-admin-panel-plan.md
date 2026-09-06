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
resolution~~ (**also built the same day** - section 4.2a) and the live-contest controls in section
4 are still unbuilt. **Correct as history, stale as a present fact** - only the live-contest
controls and provider health remain.

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

---

## 5. Stats and analytics

| Screen | Change |
|---|---|
| `AdminOverviewDashboard.tsx` | Active contests and participants **per game**. Hide the price-feed panel when trading is off |
| `CompetitionAnalytics.tsx` | Game filter, module-declared columns, participation funnel |
| `FinancialDashboard.tsx` | Entry-fee volume, fee revenue, payout ratio and average pot **by game** - and by provider, since provider cost is per-provider |
| `TradingHistorySection.tsx` | Leave as-is. Hide when trading disabled |
| `PriceHealthWidget.tsx` | Hide when trading disabled |
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
- [ ] `tradingEnabled = false` hides the TRADING group, and running trading contests
      still finish correctly
- [ ] Analytics and financials filter by game **and by provider**
- [ ] An employee can be granted every new section
- [ ] An admin can resolve an unresolved round, with a reason recorded, without a
      developer
- [ ] A forex market holiday does not block a provider contest
