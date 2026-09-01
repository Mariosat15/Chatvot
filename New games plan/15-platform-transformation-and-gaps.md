# 15 - Platform Transformation Direction, and What the Plan Was Missing

> **Owner direction recorded 30 August 2026.** This document captures a decision about
> what the platform is becoming, checks it against chapters `01`-`14`, and specifies
> the three things that were genuinely absent.
>
> Read this alongside `PROGRESS.md`. It changes emphasis and adds scope; it does not
> invalidate any earlier chapter.

---

## 1. The direction

ChartVolt becomes a **competition platform for many games**. Trading stops being the
core product and becomes one game among several.

The player journey the owner described:

```
Games page                 all games the admin has listed
    |
    v
Game page                  description . rules . how it works
                           + the competitions available for THIS game
    |
    v
Competition page           details, prize table, participants
    |
    v
Join                       pay entry fee - exactly as trading works today
```

Everything downstream is expected to speak in terms of **competitions and games**,
not trading: scoring, leaderboards, badges, milestones, user pages, fraud controls,
financial reporting, the marketplace, and Game Master packs. Admin needs to list
games and create competitions for any of them.

---

## 2. Honest check against chapters 01-14

Most of this is already planned. Recording it precisely so nothing gets rebuilt and
nothing gets assumed.

| Area named by the owner | Status | Where |
|---|---|---|
| Trading demoted to one game among several | **Covered** | `02` registry, `11` `tradingEnabled` and job gating |
| Scoring generalised | **Covered** | `04` score, normalised points, per-game rating |
| Leaderboards per game and overall | **Covered** | `04` `UserGameStats`, `08` s7 tabs |
| Badges, levels, XP, milestones, journeys | **Covered** | `06`, including three badge scopes |
| Wording moved from trading to competitions | **Covered** | `09` terminology tokens, DB-backed |
| Fraud detection across all games | **Covered** | Risk R9 in `12`, `07` s6, `14` checklist |
| Finances by game | **Covered** | `05` s5, `07` s6 financial dashboard |
| User pages - dashboard, results, lobby | **Covered** | `08` s4, s5, s6 |
| Admin: list games, enable/disable, per-game settings | **Covered** | `07` s4 Game Types section |
| Admin: create a competition for any game | **Covered** | `07` s2 game picker + dynamic config step |
| Game Master works for any game | **Partly** | `05` s4 - see gap 3 below |
| **Marketplace for other games** | **NOT COVERED** | Explicitly deferred in `06` s155 - see gap 2 |
| **Games catalogue as the primary navigation** | **NOT COVERED** | `08` s2 offers it as optional - see gap 1 |

**Nothing in the new direction contradicts the architecture.** The game registry,
the generic `score`, `gameKey`, and the four seams are exactly what a multi-game
platform needs. What changes is emphasis, plus the three additions below.

---

## 3. Gap 1 - the games catalogue is content, not just a registry

### What the plan assumed

`08` s1 keeps a flat `/competitions` list with a game filter and game badges on cards.
A dedicated Games page appears only as an aside: *"Optionally add a Games entry ...
useful once there are 3+ games, unnecessary at 2."*

### What the direction requires

Games become the **primary way players navigate**. That means a game is no longer only
a code module with a label - it is a **page with content that the admin manages**.

### The distinction that matters

There are now two separate concepts, and conflating them will cause pain:

| Concept | What it is | Who owns it | Where |
|---|---|---|---|
| **Game module** | Code. Rules of play, scoring, settlement | Engineering | Game registry, `02` |
| **Game catalogue entry** | Content. The page players read before deciding to enter | Admin, editable live | New model |

**One module can back several catalogue entries.** "Trivia: Sport" and "Trivia: Film"
can be two catalogue entries on one Trivia module with different default configs. That
flexibility is free if the two concepts are separated now, and expensive to retrofit if
a catalogue entry is assumed to equal a module.

### New model - `GameCatalogueEntry`

| Field | Notes |
|---|---|
| `slug` | URL identity, e.g. `chess-puzzles`. Permanent |
| `gameKey` | Which game this entry maps to. **Immutable** - it is the stats join key |
| `gameType` | Which code module handles it |
| `displayName`, `tagline`, `shortDescription` | Cards and listings |
| `longDescription` | Rich text for the game page |
| `howToPlay` | Steps, admin-editable |
| `rulesContent` | Rich text. Scoring, tie-breaks, qualification |
| `heroImage`, `thumbnail`, `iconUrl` | Artwork. Games without artwork get entered noticeably less |
| `category`, `tags` | Grouping and filters |
| `defaultConfig` | Pre-fills the competition wizard for this entry |
| `sortOrder`, `isFeatured`, `isVisible` | Merchandising, without a deploy |
| `seoTitle`, `seoDescription` | Game pages are the platform's best organic landing pages |
| `comingSoon` | List a game before it is playable, to gauge demand |

Mirror into `apps/admin/database/models/` in the same commit, per the mirror rule.

### New routes

| Route | Content |
|---|---|
| `/games` | The catalogue. Cards, categories, featured, coming-soon |
| `/games/[slug]` | The game page: description, how to play, rules, **live and upcoming competitions for this game**, this game's leaderboard, the player's own stats and badges for this game |
| `/competitions` | **Keep.** Still valuable as an "everything open right now" view, with the game filter from `08` |

Keeping `/competitions` matters. Some players browse by game, others browse by what
starts soonest or what has the biggest pot. Removing the flat list to force
game-first navigation would lose the second group.

### New admin section - Game Catalogue

Distinct from the Game Types registry in `07` s4, which stays a technical toggle screen.

- CRUD over catalogue entries, with live preview
- Rich text editing for description, how-to-play and rules
- Artwork upload
- Drag to reorder, feature, hide, mark coming soon
- Shows per entry: live competitions, entries this week, fill rate

### Edge cases that must be designed, not discovered

| Case | Handling |
|---|---|
| Game page with **no live competitions** | Never show an empty page. Show upcoming, a practice option, a "notify me" action, and the game's leaderboard. This will be the normal state early on |
| Catalogue entry hidden while competitions are live | Existing competitions keep working and stay reachable by direct link. Hiding removes it from **discovery**, it does not cancel anything |
| Game disabled at module level but entry visible | The entry must reflect module state automatically, or players click into something they cannot play |
| Coming-soon entry | Must not be joinable, and must not appear in the flat competitions list |

### Effort

**~2 weeks.** Model and admin CRUD 5 days, `/games` and `/games/[slug]` 4 days,
catalogue merchandising and empty states 2 days.

---

## 4. Gap 2 - the marketplace, and a rule that must be set before anyone builds it

### What the plan said

`06` s155 deferred it explicitly: *"Longer term the marketplace could sell per-game
items (question packs, cosmetics), which is a natural revenue extension but out of
scope here."* `08` s58 simply hides the marketplace when trading is off, because today
it is the Trading Arsenal - indicators and bots.

The direction now includes per-game items, so it needs a real plan.

### The structural change

| Change | Notes |
|---|---|
| Item model gains `gameKey` | `null` means platform-wide. Existing indicator and bot items backfill to `trading` |
| Item model gains `itemType` | Drives what the item is allowed to do - see the rule below |
| Store becomes game-scoped | Tabs or a filter per game, plus a platform-wide section |
| Entitlements keyed per game | Owning a trading item must grant nothing in another game |
| Admin CRUD gains a game selector | And a hard warning on competitive item types |
| "Trading Arsenal" becomes a section, not the whole store | Terminology token, per `09` |

### The rule to set now, before the first item exists

> **Nothing sold in the marketplace may improve a player's score or ranking in a paid
> contest.**

Three independent reasons, any one of which is sufficient:

1. **Fairness.** Pay-to-win in a real-money contest destroys trust faster than any
   other product mistake, and the damage is not recoverable by refunding.
2. **Regulatory.** The defence in `legal/ChartVolt-Regulatory-Defence-Pack.html` rests
   on outcomes being determined by **skill**. If spending money measurably improves
   results, the outcome is partly determined by spend. That weakens the central
   argument of the entire position.
3. **Payments.** "I paid for the advantage and still lost" is a chargeback narrative,
   and chargeback ratios are what put a merchant account at risk.

### Safe and unsafe item types

| Safe | Unsafe |
|---|---|
| Cosmetics - avatars, frames, name colours, profile themes | Anything that adds points or score |
| Titles and badges with no scoring effect | Extra time, extra lives, retries, hints, skips |
| Entry-fee vouchers and discounts | Extra attempts in a `single`-attempt contest |
| Extra **practice** rounds, outside ranked play | Easier questions or difficulty selection within a ranked contest |
| Cosmetic profile statistics and history depth | Anything that changes the content a player faces |

### Two things to rule out explicitly

**Random or mystery packs must never be sold.** Paying money for a randomised reward
is the chance element the regulatory position depends on being absent. It does not
matter that the reward is cosmetic - the transaction structure is the problem. If
"packs" are wanted commercially, sell **known contents at a known price**.

**Trading indicators and bots sit closer to the line than they appear.** They are
defensible today because they are analytical tools rather than score modifiers, and
because they are available to everyone. Do not extend that reasoning to new games
without thinking it through, and do not treat it as precedent for score-affecting
items.

### Effort

**~2 weeks** for the game-scoping and admin work. New item content is a product task,
not engineering. **Recommendation: keep this off the critical path entirely** - it
earns nothing until there are several games and a population playing them.

---

## 5. Gap 3 - Game Masters

> **Corrected 30 Aug 2026.** This section previously called Game Masters a residual of
> "roughly three to four days". Verified against the code, that was wrong by an order of
> magnitude. **The figure is ~2.5 weeks**, and one item inside it is a **gate rather than
> a task**.
>
> The full analysis lives in `External game plans/19-game-masters.md`. It is written for
> the external-only scenario, but **sections 1 to 4 apply identically here** - the Game
> Master system does not care whether the second game is built or bought.

`05` s4 already covers the important parts: the revenue share keys on `entryFee` so it
works for any game, plus `limits.allowedGameTypes`, per-game referral percentages, and
the raw-insert defect in the GM competition route (risk R7).

What was not covered, and why the estimate was wrong:

| Item | Notes |
|---|---|
| **The scale of the system** | Three dedicated collections, 28 API routes, three subscription tiers, a referral attribution chain, a daily renewal worker job, and **two** earning paths - competition and challenge finalization |
| **The game label on the GM insert is a gate** | `app/api/gamemaster/competitions/route.ts` inserts with the **raw MongoDB driver** at line 466 and sets no game label. An unlabelled competition reads as trading and is settled by trading code, **paying the wrong players.** Same for the admin twin at `apps/admin/app/api/gamemaster/competitions/route.ts`. Belongs in **P1**, before anything else |
| **The admin app pays no GM earnings at all** | A live defect. `lib/actions/trading/competition-end.actions.ts` has ~500 lines of GM earnings logic at lines 931-1459; `apps/admin/lib/actions/trading/competition-end.actions.ts` has **none of it** - only `isGmCreated` at line 709. A competition finalized through the admin app pays the Game Master nothing, and records no `retained_gm_fee` explaining why |
| **How a GM actually earns** | From the **entry fees of referred players in any contest**, not from contests the GM created. Creating competitions is how they attract referred players; it is not the revenue event. Convenient consequence: **the revenue share works for a Trivia contest with no GM-specific work**, the moment such a contest can be settled |
| **GM subscription tiers are trading-flavoured** | Starter and Pro say "trading community" and "trading battles"; Elite says "scalp battles" and "swing competitions" (`marketplace-seed.service.ts` lines 428, 483, 553-556). **Database content**, editable without a deploy - the cheapest item here |
| **The GM-facing competition creator** | Requires `startingCapital` and writes leverage, symbols, asset classes and PnL ranking. Needs the same game picker and dynamic config step as the admin wizard in `07` s2, **reusing those components** rather than growing a parallel implementation |
| **GM analytics by game** | A GM should see referral revenue split by game, for the same reason the platform does |
| **A dead admin control** | `toggleCompetitionCreation` is called in `GameMasterManagementSection.tsx` lines 164-189 but not implemented in the PATCH handler. `competitionCreationOverride` and `overrideLimits` exist on the schema with no reader or writer |

**~2.5 weeks**, distributed: the game label and `allowedGameTypes` in **P1**, the creation
API and wizard in P4-P5, analytics with the rest of the analytics work, tier wording in the
terminology pass.

### What does not change

Worth stating, because it is most of the system: earning calculation, the cap against
platform fee, referral attribution at signup, subscriptions, tiers, renewal, pause,
cancel, `retained_gm_fee`, the ledger entry types and both dashboards are **game-agnostic
already** and need no work.

---

## 6. Two further things worth deciding

Neither is a gap in the plan so much as a question the new direction raises.

### 6.1 What does a brand-new player see first?

If trading is no longer the core, the logged-in landing page should send a new player
to the **games catalogue**, not to a trading dashboard. `08` s5 restructures the
dashboard well - a player who has never traded sees no trading section - but it does
not say what fills the space for a player who has played **nothing**.

Recommendation: for a player with zero contests, the dashboard leads with the games
catalogue and a first-contest prompt, not with empty statistics tiles.

### 6.2 Demote trading in navigation, do not degrade it in function

Trading is presumably where today's revenue and today's audience are. The plan is
deliberately careful to keep it fully working, and that should not soften as the
framing shifts.

Recommendation: trading loses its **privileged position** - the nav group, the default
landing, the vocabulary - while losing **none of its capability**. A trading player
should notice the platform got broader, not that their game got worse.

---

## 7. Opinion on sequencing - the important part

**The visible parts of this transformation must be built last, not first.**

The instinct when the goal is "become a games platform" is to start with what is
visible: the games page, the new navigation, the wording. That is the wrong order, for
a specific reason.

> **A games catalogue with one non-trading game in it looks worse than no games
> catalogue at all.** It advertises that the platform is nearly empty.

The IA change is also the **cheapest part to do later** and the part with the least
technical risk. The expensive, risky work is underneath: the score abstraction, the
four seams, the settlement dispatch, the per-game statistics. None of that is visible,
and all of it must be right before real money moves through it.

So the order stands as planned, with the catalogue added near the end:

```
Stage 0    fix the two live defects                          (00a)
Phase 1    foundation: registry, score, seams                (P1)
           + GM insert game label - a GATE                   (gap 3)
Phase 2    ONE real second game, end to end                  (P2)
Phase 3-4  admin, scoring, leaderboards, badges              (P3, P4)
           + GM creation wizard and per-game analytics       (gap 3)
Phase 5    terminology, trading master switch                (P5)
--------------------------------------------------------------------
NEW        games catalogue and games-first navigation         (gap 1)
LATER      marketplace per game                              (gap 2)
```

Gap 3 is **not a trailing item.** It is distributed, and its first piece belongs in P1
with the rest of the foundation - because until the Game Master route stamps a game label
on the competitions it creates, a Game Master-created contest is settled by trading code.

### The real risk in this direction is scope, not code

The areas named - scoring, leaderboards, badges, milestones, pages, fraud, finances,
user pages, marketplace, Game Masters, admin - are each individually modest and each
individually planned. **All of them at once, on a live platform holding customer money,
is a six-month programme.** The phasing exists precisely so that value ships
repeatedly instead of everything landing at the end.

Adding gap 1 takes the programme from roughly 10-15 weeks to 12-17. Adding gap 3, now
that it is properly sized at ~2.5 weeks rather than four days, takes it to
**14-19 weeks**. Gap 2 on top of that takes it past 20. That is the honest number, and it
is the reason to sequence rather than to attempt the whole transformation in one release.

---

## 8. Recorded decisions

| Decision | Rationale |
|---|---|
| Platform becomes games-first; trading becomes one game among several | Owner direction, 30 Aug 2026 |
| Games catalogue is **admin-managed content**, separate from the code registry | Lets marketing and merchandising change without a deploy, and allows several catalogue entries per module |
| `/competitions` flat list is **kept** alongside `/games` | Two genuinely different browsing behaviours |
| Marketplace items may **never** affect score or ranking in a paid contest | Fairness, the regulatory position, and chargeback exposure |
| **No random or mystery packs**, ever | Introduces the chance element the regulatory defence depends on being absent |
| Games catalogue is built **after** the first real second game exists | An almost-empty catalogue is worse than none |
| Trading is demoted in navigation, not degraded in function | It is where the current revenue and audience are |
