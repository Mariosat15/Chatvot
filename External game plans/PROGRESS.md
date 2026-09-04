# PROGRESS - External Games Plan

> **Read this file first in any new chat about external games.**
>
> The other documents describe **what should be done**. This file records **what has
> actually been done**, what has been decided, and what to pick up next.
>
> **Rule: updated at the end of every phase, before that phase counts as finished.**

---

## CURRENT STATUS

| | |
|---|---|
| **Status** | **SCENARIO DECIDED - EXTERNAL-ONLY** (2 Sep 2026). **First code shipped and owner-tested 2 Sep 2026** - the admin navigation restructure, a slice of X6 taken out of order. No provider selected |
| **Next action** | **Await the owner's go-ahead for X1.** Nothing blocks it; the hold is deliberate. Commercial work can proceed in parallel: find and assess a provider using `08` |
| **Blocked by** | **Nothing technical.** Stage 0 / X0 was the standing gate and it was **signed off 2 Sep 2026**. X1 waits only on the owner saying to start. A signed provider is still needed from X4 onward; X1-X3 and most of the admin work need no provider at all |
| **Owner instruction on record** | **External games only, no in-house game** (2 Sep 2026). **One step at a time, admin first, do not break the running app.** **Do not start X1 until told** (2 Sep 2026) |
| **Last updated** | 2 September 2026 |

### DEFERRED WORK, APPROVED BUT NOT SCHEDULED

Small, self-contained items the owner has agreed to but parked. Kept here so they are not
rediscovered as new findings later.

| Item | Why it is deferred | Where it is specified |
|---|---|---|
| **Eight sections missing from `ADMIN_SECTIONS`** - `journey-map`, `gamification-wizard`, `system-announcements`, `vendors`, `mdb-cluster` and three others | Owner decision 2 Sep 2026: **do later.** It is a pre-existing defect, not caused by any games work, and it is add-only | `12` section 1, "RBAC - do not forget this" |
| **Sidebar clicks do not write the URL** | Pre-existing across all ~60 admin sections. Deep links work *inbound*; the address bar just does not track the current section. Belongs with the X6.5 admin pass | `12` s1.1a, "One pre-existing limitation" |
| **The `tradingEnabled` conditional that hides the Trading destination** | Genuinely blocked - the flag does not exist until X1 introduces it. **"Built" does not include it** | `12` s1, target grouping |

**The first is invisible-by-default, which is why it is worth stating rather than listing.**
`ADMIN_SECTIONS` is what allows a section to be granted to an employee at all, so those
eight screens are currently reachable only by a super admin. Nothing errors and nothing
logs; an operator simply never sees them, and an admin trying to delegate the work finds no
checkbox to tick.

---

**One thing in the application has now been changed by this project** (2 September 2026,
**owner-tested**): the admin navigation restructure from `12` section 1, which separates
contest administration from trading and collapses the six trading screens into one
destination inside a GAMES group. It is a slice of **X6 taken deliberately out of order** - see the
work log entry below for why that was judged safe and what it does *not* license.
Everything else remains planning only.

**But Stage 0 has started** (1 September 2026), and it is the prerequisite for *both*
scenarios. Progress on it is tracked in `New games plan/PROGRESS.md`, not here. Two things
from it change facts stated in this folder:

- A live security defect was found and shipped as **Prerequisite A** (commit `d5d3a328`):
  the `/api/simulator/*` routes accepted a plain request header as authentication in
  production. Recorded here as **R27** in `17-risk-register.md`, because this programme adds
  a provider webhook and the same class of mistake is available there.
- Re-verification corrected four facts this folder restates from the `New games plan`. The
  mirror count is **75 pairs with 11 drifted**, not ~21 with 3; the finalize-time safeguard
  does **not** mask the prize-pool gap; there are **four** competition-entry writers; and the
  challenge *accept* path skips restriction and fraud checks on a route real players use.
  `17-risk-register.md` R1 and R2 and `18-migration-testing-rollout.md` section 2 have been
  updated. **Stage 0 is now 6-9 days, not 5-8.**
- **Stage 0 Defect 2 (model mirrors) is built** as of 1 September 2026, and it changed a
  load-bearing fact this folder repeats. Drift is a **write-side** defect, measured against
  a real MongoDB rather than assumed. An ordinary `save()` does **not** strip undeclared
  fields, and `.lean()` and `toObject()` do **not** hide them - both earlier claims were
  wrong. What actually happens: a **missing enum value rejects the write**, and the
  narrower app **cannot write the field at all**, silently, while reporting success.

  One read *does* break, and it is the one application code uses: **ordinary `doc.field`
  access returns `undefined`**, because Mongoose defines getters only for declared paths.
  So a drifted field survives a debug dump intact while the code beside it reads nothing
  and takes the wrong branch. Assume nothing from a read; run `npm run check:mirrors`.

  **This matters more to this programme than to the in-house one.** Provider integration
  introduces exactly the enum that breaks this way - the four terminal round statuses in
  `01-provider-contract-specification.md` (`completed`, `abandoned`, `expired`, `voided`).
  A copy missing one of them **rejects the result callback** rather than mis-storing it, so
  a finished round is never recorded and the contest never settles. The guard
  (`tools/model-mirror/`) compares enum values for this reason.
- **Stage 0 Defect 1 (entry paths) is built** as of 1 September 2026. All four competition
  entry writers are resolved: two became wrappers over `lib/services/contest-entry.service.ts`,
  the simulator batch route was fixed in place, and the dead admin copy was deleted. R1 in
  `17-risk-register.md` is updated. Three things from it bear on this programme directly:

  **The single entry service is the seam every provider contest will join through.** That was
  the point of doing it first, and it now exists: one place that takes a fee, funds the pool,
  seats the player and runs the fraud controls. A provider adapter adds a caller, not a fifth
  implementation.

  **A constraint on how that seam may refuse anyone, added 2 September 2026.** Prerequisite B
  in `New games plan/00a` fixed an owner-reported live incident: the fraud gate was refusing
  paid entry on a player's **suspicion score alone**, creating no restriction - so the block
  showed on no admin screen, notified nobody, could not be lifted, and happened while
  automatic suspension was switched off. **Scores raise alerts; restrictions block.** When X5
  extends the fraud controls to provider entries, automatic enforcement goes through
  `UserRestriction` and never through a bare refusal inside the gate. This matters more here
  than anywhere it has been tested: a provider contest is cheaper and faster to enter than a
  trading contest, so it will trip a throttle far more often, and the false-positive rate this
  rule protects against is correspondingly higher. R9 and R27 in `17-risk-register.md` are
  updated - R27 because that investigation found a **third** route asserting an authorization
  check it never performed, this time letting any signed-in player raise a rival's fraud score.

  **Two things it fixed are hazards this programme would have re-created.** The prize pool is
  now incremented on every path - a provider contest seeded by an internal route would
  otherwise have repeated the exact defect. And the read-then-insert seat race is handled:
  two entries for one player collide on the unique index and report **duplicate key 11000,
  not a write conflict**, so it sits outside any retry loop. Provider integration multiplies
  concurrent entries; assume this will be hit.

  **The two items previously open here are now closed**, both on 1 September 2026. Challenge
  accept has the restriction and fraud gates, sharing `checkAccountStanding` with the entry
  service so the two paths cannot drift apart again. The `SuspicionScore` races are fixed -
  and **R28 records two corrections worth reading before writing provider code**: there were
  five call sites, not three, and fixing the read-then-create exposed a *second* race in the
  same function, where `totalScore` was read-modify-written and clobbered under concurrency.

  A third defect was found while documenting the first: `challengeId` was declared on
  **neither** `WalletTransaction` copy, so **nine** writers - challenge entry, the decline
  refund, and six finalization payouts across both apps - had it silently discarded. **The
  whole challenge money trail was unattributable.** Fixed add-only in both copies. Two points
  carry directly into provider work: no balance was wrong, so describe it as an audit-trail
  fault rather than a financial one; and **the mirror guard could not have caught it**,
  because both copies were wrong identically. A green `check:mirrors` proves the two apps
  agree with each other, never that either agrees with the code writing to them.

### THE DECISION - EXTERNAL-ONLY (owner, 2 September 2026)

| Scenario | Meaning | Programme | Documents | Status |
|---|---|---|---|---|
| **Add-on** | The `New games plan` is delivered too - foundation, an in-house game, all platform work. External games are an addition | E1-E9, 7.5-8 weeks engineering on top | `01`-`09` | **NOT being pursued** |
| **External-only** | **Provider games are the only new games.** No in-house game | X0-X12, **23-30 weeks** total | `01`-`09` **and** `10`-`20` | **CHOSEN** |

**Read `10`-`20`, not just `01`-`09`.** Chapters `01`-`09` were written assuming the
`New games plan` would deliver the foundation and every platform-wide change. It will
not. That dependency did not disappear - it moved here, and chapters `10`-`20` own it.
Any sentence in `01`-`09` that delegates work to the `New games plan` is now a sentence
that delegates it to a chapter in this folder.

**What this decision does NOT mean.** It is **not** the cheaper route, and it must never
be presented internally as one. Dropping the in-house game saves ~3.5 weeks; a correct
provider integration costs ~7. Every platform-wide change - admin, navigation, wording,
flags, catalogue, scoring, profile - is identical either way. **23-30 weeks against
12-17**, and see the caveat in `10` section 2 - the 12-17 figure was never updated for the
owner's 2 September brief, so the gap is not the price of the decision. What it buys is a
catalogue of many titles and no per-title content burden, at
the price of ~6 extra weeks, a per-round or revenue-share fee, and a single supplier on
the critical path. Full reasoning in `10` sections 2 and 5.

**The consequence that matters most:** there is now **no in-house game to fall back on**.
In the add-on scenario a failed provider left a working Trivia game behind. Here, if the
provider search fails or the pricing does not work, the platform has spent the whole
foundation and admin programme and still has exactly one game. Open question 10 - keeping
a small in-house game on the backlog as a hedge - is therefore no longer optional to
think about, and its risk rating goes up rather than away.

### Sequencing - admin first, one step at a time (owner, 2 September 2026)

The owner's instruction is explicit: **build it in steps that cannot break the running
application, and start with the admin side.** That reorders the programme, and the
reasoning is worth keeping because it is not the obvious order:

1. **Admin first, because admin is where a game becomes addable at all.** Until an
   operator can register a provider, sync a catalogue and create a contest for a game
   that is not trading, every player-facing screen has nothing real to show.
2. **The admin app is the safe place to start.** It is a separate Next.js process with
   no player traffic. A broken admin screen costs an operator an inconvenience; a broken
   player screen costs money and trust.
3. **Player-side second**, once the data it needs exists and is being produced by real
   admin actions rather than fixtures.

This does not change the phase *contents*, and it does not let anything skip **X1**. The
foundation is what makes a second game representable at all, so it still comes first -
the reordering is within X6/X7 and after, not before X1. The revised order is in `10`
section 3.

---

## DOCUMENT SYNC RULE - APPLIES FROM THE MOMENT BUILDING STARTS

> **Documentation is part of the deliverable, not a follow-up task.** A phase is not
> finished until these documents match what was actually built.

Also enforced by `.cursor/rules/games-plan-docs-sync.mdc`, which loads automatically
in every session.

Whenever implementation happens, or any new information changes an assumption:

1. **Update this file** - status table, decisions, open questions, and a work-log entry.
2. **Update the affected chapter.** Data model changed? `04`. Flow changed? `03`.
   Security changed? `06`.
3. **Update both HTML versions**, which drift silently because nothing compiles them:
   - `ChartVolt-External-Games-Plan.html` - internal, illustrated
   - `ChartVolt-Game-API-Requirements.html` - **sent to game providers**
4. **Record deviations explicitly** in the work log, with the reason. Never silently
   rewrite the plan to match the code - the gap between them is the useful information.
5. **Check documents outside this folder**: `New games plan/PROGRESS.md`, the root
   `README.md`, `deploy/README.md`, the admin wiki
   (`apps/admin/components/admin/AdminWikiSection.tsx`), and
   `legal/ChartVolt-Regulatory-Defence-Pack.html` if anything touches the
   skill-versus-chance argument or the money flow.

### The paired documents that must never drift

| Pair | Why it matters |
|---|---|
| `01-provider-contract-specification.md` and `ChartVolt-Game-API-Requirements.html` | Same requirements, different audience. **A provider building against a stale spec is worse than no spec**, because both sides believe they agree |
| Any model change | Every model exists twice - `database/models/` and `apps/admin/database/models/`. Same commit, always |

If a provider negotiates a deviation from the specification, it is recorded in **both**
of those documents and in the decision log below.

---

## THE PLAN IN FIVE LINES

An external company supplies skill games - chess puzzles, trivia, word games. They
run the gameplay and report a **score per player**. ChartVolt does everything else,
exactly as it does for trading today: entry fees, prize pool, ranking, prizes,
points, badges, levels.

**The provider never touches money.** That single boundary is what makes this
project low risk.

---

## START HERE NEXT

This plan has two tracks, and the commercial one is currently the blocker.

### Track A - commercial (blocking, no engineering needed)

1. Identify candidate skill-game providers.
2. Send them Gate 1 from `08-provider-evaluation-checklist.md`. Ten questions,
   answerable in one email, and they eliminate most candidates immediately.
3. Send `01-provider-contract-specification.md` to anyone who passes.
4. Score them with Gate 2. Settle **pricing** before any build - see the per-round
   arithmetic in `08` section 3.

Three more questions belong in the same conversation, because each one changes the
engineering plan:

5. Will the provider supply **game page content** - description, rules, how-to-play,
   artwork, localised? It is contractual in `01` section 3.1. A refusal transfers that
   cost to us per title, forever (risk **X5**).
6. Is there a **committed date for sandbox access**? Nothing after X4 can be built
   without it (risk **X1**).
7. Will a **second provider** be evaluated before launch? The adapter boundary only makes
   replacement cheap if it is exercised (risks **X2** and **X6**).

### Track B - engineering

**The scenario is external-only, so this is the only track that applies.** The add-on
path below is kept for reference only; do not plan against it.

1. **X0** - Stage 0 defect fixes (`New games plan/00a`). Live defects under the contest
   and money layer. **Signed off by the owner 2 September 2026.**
2. **X1** - the foundation, owned by this plan. See `11`. **Code-complete**, ranking gate
   cleared by the historical replay.
3. **X2** - provider abstraction and a mock adapter. **Code-complete.**
4. **X3** - round lifecycle and result ingestion. **Code-complete**, rehearsals 1-6 green
   against the mock.
5. Then the admin programme, per the owner's admin-first sequencing. **Four slices of X6
   are done**: the navigation restructure (owner-tested), provider registration,
   credentials and the per-title switch, and the contest wizard with pre-flight validation.

6. **X5** - contest integration and settlement. **PARTIALLY BUILT, 4 September 2026.**
   Publish, entry and ranking are done; play, settlement and the refund are not.

**Where the next engineer should actually start.** X5's first half landed on 4 September:
a provider contest can be published, entered and ranked. **It still cannot be played and
nobody is paid**, so the remaining X6 screens - health, the round inspector, manual
resolution - would still be built against fixtures, which is the argument that held them
back originally.

The three pieces of X5 that remain, in dependency order:

- **Round launch for players.** The round service is finished (X3) and the contest bridge
  reads its settings off the stored contest. What is missing is the player-facing surface
  that calls it, which is the first thing that needs a player screen at all.
- **Settlement.** `routeToTradingSettlement` correctly refuses a provider contest with
  `no_settle_path`, which is the right answer and a dead end until there is a settle path.
  The work is an extraction, not a wiring job: the trading finalize function's ranking,
  prize-distribution, Game Master and leaderboard-write stages need to be reachable
  **without** its position-closing and P&L-recalculation stages.
- **The `exclude` refund.** Still `refundOwed: true`. Removing a player changes the prize
  pool, so the refund and the re-split must be one transaction, which means it belongs with
  settlement rather than before it.

**X4 still jumps ahead if a provider is signed**, for the unchanged reason: everything
built after that point is guesswork until a real provider has answered a real call.

**Reference only - the add-on path, not being pursued:** Stage 0, then `New games plan`
Phase 1, then **E1** of `09-implementation-phases.md`.

**This gate is now cleared.** Stage 0 / X0 was **signed off by the owner on 2 September
2026** after testing on their own environment. It was the standing block on all Track B
engineering, because X0 fixes live defects under the money layer that every route runs
through. Track B is open, starting at X1.

---

## STATUS TABLE

Legend: `NOT STARTED` / `IN PROGRESS` / `BUILT - AWAITING OWNER TEST` / `SIGNED OFF`

### Add-on scenario - E-phases - NOT BEING PURSUED

Superseded by the 2 September 2026 decision. Kept only so that references to E-phase
numbers in chapters `01`-`09` remain resolvable. **Plan against the X-phases below.**

| Phase | Description | Estimate |
|---|---|---|
| **E1**-**E9** | Provider abstraction, round lifecycle, real adapter, contest integration, admin, player UI, resilience, challenges, launch | 7.5-8 weeks on top of the `New games plan` |

### External-only scenario - X-phases (`10` section 3) - THE ACTIVE PROGRAMME

| Phase | Description | Source | Estimate | Status |
|---|---|---|---|---|
| **X0** | Prerequisite defect fixes, owner sign-off | `New games plan/00a` | 6-9 days | **`SIGNED OFF` 2 Sep 2026** - the gate is open |
| **X1** | Foundation: game label, score, registry, four seams, **GM insert game label** | `11` + `19` s3.1 | 2.5-3.5 weeks | **`CODE-COMPLETE`** 4 Sep 2026. Ranking gate **cleared** (replay: 4/4 reproduced exactly). Backfill written, **not yet `--apply`d** |
| **X2** | Provider abstraction + mock adapter | `09` E1 | 1 week | **`CODE-COMPLETE`** 4 Sep 2026. Nothing player-visible - `externalGamesEnabled` defaults false |
| **X3** | Round lifecycle + result ingestion | `09` E2 | 1 week | **`CODE-COMPLETE`** 4 Sep 2026. **Rehearsals 1-6 of `07` s9 green** against the mock (49 tests, 6 guards probed). 7-10 need X5/X8 |
| **X4** | Real adapter against sandbox | `09` E3 | 1 week | `NOT STARTED` |
| **X5** | Contest integration + settlement | `09` E4 | 1 week | `PARTIALLY BUILT` - publish, entry and ranking done 4 Sep 2026. Play, settlement and the `exclude` refund remain |
| **X6** | Admin: nav restructure incl. **the single Trading section**, RBAC, provider registration, game-aware wizard, analytics, **GM creation API + wizard** | `09` E5 + `12` + `19` | 3-3.5 weeks | `PARTIALLY DONE` - nav restructure and single Trading destination **built and owner-tested 2 Sep 2026**. **Provider registration, credentials and the per-title catalogue switch code-complete 4 Sep 2026** (`12` s4.1a). **Contest wizard from `configSchema` + pre-flight validation code-complete 4 Sep 2026** (`12` s2.1) - creates a **draft only**; nothing publishes or settles it. Still `NOT STARTED`: provider health panel, round inspector, manual resolution, live-contest controls, provider contest **editing**, analytics by provider, GM creation API |
| **X6.5** | **Admin wording pass** - brought forward from X8 so operators never work a games platform labelled "trading" | `14` | 0.5-1 week | `NOT STARTED` |
| **X7** | Player UI + points, leaderboards, badges, levels, **profile and cross-game stats**, **per-game GM analytics** | `09` E6 + `13` + `05` + `19` | 3-4 weeks | `NOT STARTED` |
| **X8** | Player wording, `tradingEnabled`, infrastructure gating | `14` + `15` | 1-1.5 weeks | `NOT STARTED` |
| **X9** | Resilience, reconciliation, monitoring | `09` E7 | 1 week | `NOT STARTED` |
| **X10** | Challenges - **any game, and any opponent** | `09` E8 + `20` s2 | 1-1.5 weeks | `NOT STARTED` |
| **X11** | Games catalogue + games-first navigation | `16` | ~2 weeks | `NOT STARTED` |
| **X11.5** | **Smart onboarding and challenge matchmaking** | `20` | 2-3 weeks | `NOT STARTED` |
| **X12** | Hardening, staged pilot, public launch | `09` E9 + `18` | 3-5 weeks | `NOT STARTED` |
| Later | Per-game marketplace | `16` s2 | ~2 weeks | `NOT SCHEDULED` |

**Three changes were made to this table on 2 September 2026**, all from the owner's brief,
and each one is a real addition rather than a re-label:

- **X6.5 exists because wording was in the wrong place.** The terminology pass sat in X8,
  after the player UI. That would have had operators running a multi-game platform through
  screens labelled "trading" for two phases. Splitting it puts the admin half immediately
  after the admin build and leaves the player half in X8.
- **X10 grew from 0.5-1 week to 1-1.5.** "Challenge any user" was never specified - `03`
  says "invited or matched" and stops. An opponent picker, open challenges and the abuse
  controls that come with letting anyone challenge anyone are new work. See `20` section 2.
- **X11.5 is entirely new.** Smart onboarding and interest-based matchmaking appear nowhere
  in chapters `01`-`19`. New chapter `20`.

**Net effect: 23-30 weeks for X1-X12**, up from 20-26. The increase is ~3 weeks of genuinely
new scope, not a re-estimate of existing scope.

**Game Master work is not a separate phase.** It is distributed: the game label on both
Game Master competition inserts is a **gate inside X1**, the creation API and UI land in
X6, analytics in X7, tier wording in X8. Total ~2.5 weeks, all inside the figures above.
See `19`.

**X1-X12: 23-30 weeks**, plus X0 separately. **The shortest useful path is X0-X5 plus a
minimal slice of X6 - nine to eleven weeks of engineering, 11-14 in calendar terms**
because X4 onward waits on sandbox access. It produces a provider contest a player can pay
for and play, and that is the right place to pause and review against real behaviour.

That shortest path is unchanged by the admin-first decision, and the reason is worth
stating because it looks contradictory: **admin-first orders the work inside X6 and X7, it
does not move X6 in front of X1-X5.** A provider contest still has to exist before there is
anything for an admin screen to administer. What admin-first buys is that when the player
UI is built in X7, the data behind it is being produced by real operator actions rather
than by fixtures.

**Three gates** govern progress: Gate 1 before X1, Gate 2 before X5, Gate 3 before the
X12 pilot. All three are in `17` section 7.

---

## DECISIONS ON RECORD

| Date | Decision | Reasoning |
|---|---|---|
| 18 Aug 2026 | **The provider never handles money** | Removes wallet integration, third-party balance access, and most of the financial risk |
| 18 Aug 2026 | **One game module for all provider games**, with the specific game held as data | A new title from an existing provider needs no code change or release |
| 18 Aug 2026 | **`gameKey` is the statistics key and is immutable** | Historical leaderboards, ratings and badges must never move |
| 18 Aug 2026 | **Launch with independent-play games only** | Head-to-head games need a bracket engine for competitions. Chess puzzles give us chess without one |
| 18 Aug 2026 | **Content seeding is mandatory for competitions** | Without identical content there is no fair ranking, and the regulatory position weakens |
| 18 Aug 2026 | **Default attempts policy is `single`; attempts consumed at creation** | Blocks the abandon-and-peek exploit and caps per-round provider cost |
| 18 Aug 2026 | **Only skill-based games are in scope** | Chance-determined outcomes would supply the missing element of the gambling test and invert the platform's regulatory position |
| 18 Aug 2026 | Plan written **provider-neutral** | No provider chosen. `01` doubles as our requirements document and our evaluation checklist |
| 30 Aug 2026 | Platform becomes **games-first**; trading is one game among several | Owner direction. Recorded in `New games plan/15-platform-transformation-and-gaps.md`. An external provider game becomes a **catalogue entry** with its own game page, so `provider_game` fields feed the catalogue content model |
| 30 Aug 2026 | Marketplace items may **never** affect score or ranking; no random packs | Fairness, the regulatory position, and chargeback exposure. Applies to provider games too, so never buy a provider feature that sells in-game advantage |
| 30 Aug 2026 | **Page content per game is contractual, not optional** - tagline, description, rules summary, how-to-play, banner artwork, localised, unbranded | Each provider title gets its own game page. Writing that copy per title in every language is cheap for the provider and expensive for us. A provider unwilling to supply it is transferring their content cost to us, per title, forever. Raise in commercial discussion, not after signing |
| 30 Aug 2026 | **This folder must stand alone if external games are the only games** | Chapters `01`-`09` delegated the foundation and every platform-wide change to the `New games plan`. If that plan is not delivered, the dependency does not disappear - it moves here. Chapters `10`-`18` added to own it |
| 30 Aug 2026 | **External-only is not the cheaper route; it is the broader one** | Dropping the in-house game saves ~3.5 weeks. A correct provider integration costs ~7. Every platform-wide change is identical either way. 20-26 weeks against 12-17. The prize is a catalogue and no content burden, not a saving - and it must not be presented internally as one |
| 30 Aug 2026 | **Stage 0 is a prerequisite in every scenario** | It fixes live defects under the money layer - divergent join paths and admin mirror drift. No plan can skip it, and no scenario changes that |
| 30 Aug 2026 | **The shortest useful commitment is X0-X5 plus a minimal X6** | Nine to eleven weeks of engineering, 11-14 in calendar terms, and it produces a provider contest a player can pay for and play. Reviewing there against real behaviour is the defence against R24 in a 20-26 week programme |
| 30 Aug 2026 | **No paid format is ever single-player.** Competition means two or more; challenge means exactly two | Owner clarification, after "independent play" was read as "solo contest". `minParticipants` already defaults to 2 and already auto-cancels with refunds below it, so this is reused rather than built. `03` section 0 states it before anything else |
| 30 Aug 2026 | **"Independent play" replaces "solo-scored"**, and "challenge" replaces "duel" throughout | "Solo-scored" describes gameplay but reads as contest size, and it caused exactly that misreading. "Duel" was also wrong against the codebase, which has a `Challenge` model, `/challenges` routes, a `challengesEnabled` flag and `challenge_entry` ledger entries. API field `supportsDuel` became `supportsOneVsOne` - free to change while no provider is signed |
| 30 Aug 2026 | **Game Masters get their own chapter, `19`** | An earlier draft called them "four smaller items, three to four days". The real system is three collections, 28 routes, a tier economy, a referral chain, a renewal worker job and two earning paths. The real figure is ~2.5 weeks, and one item inside it is a gate |
| 30 Aug 2026 | **Game Masters may not create provider contests at launch** - `limits.allowedGameTypes` defaults to `["trading"]` | A provider charges per round; the Game Master share is a percentage of the entry fee taken **before** that cost, and the existing cap is against **gross** platform fee. A popular low-fee contest can therefore be net loss-making while still paying the Game Master. They still **earn** from referred players in provider contests from day one - only creation is gated. Revisit once the share is computed on net fee after provider cost. `19` section 5 |
| **2 Sep 2026** | **EXTERNAL-ONLY. Provider games are the only new games; no in-house game is built** | Owner decision, closing open question 0. Chapters `10`-`20` own every platform-wide change that `01`-`09` had delegated to the `New games plan`. The then-current 20-26 week figure was accepted knowing it is the broader route, not the cheaper one; the same brief that carried the decision added ~3 weeks of scope, taking it to **23-30**. **Consequence to keep visible: there is no in-house fallback if the provider search or the pricing fails**, which raises rather than removes open question 10 |
| **2 Sep 2026** | **Build admin-first, one step at a time, without breaking the running app** | Owner instruction. Admin is where a game becomes addable at all, and the admin app is a separate process with no player traffic - a broken admin screen inconveniences an operator, a broken player screen costs money and trust. Reorders work **inside** X6/X7 and after; **X1 still comes first**, because a second game must be representable before it can be administered |
| **2 Sep 2026** | **Trading becomes one game among several, and all trading administration collapses into a single Trading section with its own internal tabs** | Owner requirement. Today ~60 admin sections interleave trading-specific and generic ones, so trading cannot be hidden or reasoned about as a unit. `12` section 1 gains the internal tab list |
| **2 Sep 2026** | **Games are registered by an operator the way payment providers are** - a provider list, credentials, sandbox/production toggle, test-connection, enable per title | Owner requirement, and the pattern already exists in `PaymentProvidersSection.tsx` + `payment-provider.model.ts`. **Copy the UX, not the storage:** that model embeds `credentials[]` in the readable document and has a `saveToEnv` flag that writes secrets to `.env`. `04` section 3.1 deliberately keeps game credentials out of `game_provider` so admin screens can read it freely. `12` section 4 records the split |
| **2 Sep 2026** | **The engine is a general competition engine, not a trading engine with games bolted on** | Owner framing, and it is a scope statement rather than a slogan: scoring **and its naming**, stat calculation, financial reporting, badges, levels and journeys must all be game-aware, not trading-shaped with special cases. Chapter `05` already designs the scoring layers; what was missing is the explicit statement that **no aggregate may be trading-only**, which is now `05` section 10 and `12` section 5 |
| **2 Sep 2026** | **Games are plug and play in both directions: adding a game must need no new code in any stat, ranking or aggregate, and removing one must break nothing** | Owner requirement, restated. The adding half was already designed - one module, title as data, every aggregate keyed on `gameKey`. **The removing half was not, and it is the half that can corrupt earned progression:** if totals are summed across *enabled* games, disabling a game silently demotes players who earned levels in it. New `05` section 11 makes cross-game totals accumulate on settlement rather than recompute on read, and confines `getEnabledGameTypes()` to creation, discovery and entry. Risk **R29** |
| **2 Sep 2026** | **The engine owns the outcome; the provider only reports it** | Owner restatement, and it already matches the issued provider document verbatim - section 1 of `ChartVolt-Game-API-Requirements.html` tells providers "you send us a signed message containing their score. We take care of the entry fees, the prize pool, the ranking, the payouts, the leaderboards and the player accounts." No re-issue needed |
| **2 Sep 2026** | **Stage 0 / X0 is signed off, and the restructured admin sections are owner-tested** | Two separate owner tests, both passed the same day. X0 was the standing gate on all games engineering, so it is now open |
| **2 Sep 2026** | **X1 does not start until the owner says so** | Owner instruction. Nothing technical blocks it - Stage 0 is signed off and the admin change is tested - so this is a deliberate hold, not a dependency. **Do not begin the foundation unprompted** |
| **2 Sep 2026** | **The eight missing `ADMIN_SECTIONS` ids are deferred** | Owner decision: do later. It is a pre-existing defect unrelated to games work and the fix is add-only. Tracked under "Deferred work" in this file so it is not rediscovered as a new finding |
| **2 Sep 2026** | **`Verif_Setup_help/` is never committed** | Owner decision, now enforced by a `.gitignore` rule rather than a judgement call per file. Setup-help screenshots routinely capture credentials and connection strings, and an image cannot be reviewed by a diff |
| **2 Sep 2026** | **Smart onboarding and interest-based challenge matchmaking are in scope** | Owner requirement, and **entirely new** - it appears nowhere in `01`-`19`. A player declares which games they want to be challenged in; the system matches players by shared interest plus prerequisites; and for a player who declares nothing, interest is **inferred from what they actually play** so the feature works without onboarding. New chapter `20`, phase X11.5, 2-3 weeks |

---

## OPEN QUESTIONS

| # | Question | Owner | Needed by |
|---|---|---|---|
| 0 | ~~Add-on or external-only?~~ **CLOSED 2 Sep 2026 - external-only.** See the decision box at the top | Owner | - |
| 1 | Which provider? | Commercial | Before E3 / X4 |
| 2 | Pricing model, and cost per round? | Commercial | Before E3 / X4 - it decides whether cheap contests are viable |
| 3 | Are practice rounds billed? | Commercial | Before E6 / X7 |
| 4 | Which games first - trivia, chess puzzles, word? | Product | Before E5 / X6 |
| 5 | Default entry fee band for provider contests? | Product | Before E9 / X12 |
| 6 | Who bears the cost of an incorrect payout caused by a provider defect? | Legal | Before contract signature |
| 7 | Data processing agreement terms and hosting locations? | Legal | Before any real player identifier is sent |

### Additional questions raised by the external-only scenario

| # | Question | Owner | Needed by | Risk |
|---|---|---|---|---|
| 8 | Is there a **committed date** for sandbox access, not just a promise? | Commercial | Before X1 starts - five weeks of work is blocked on it | **X1** |
| 9 | Will a **second provider** be evaluated before public launch, even if only one goes live? | Commercial | Before X12 | **X2**, **X6** |
| 10 | **RAISED IN PRIORITY 2 Sep 2026.** Is a small **in-house insurance game** worth keeping on the backlog as a hedge? See `10` section 5. The external-only decision removes the fallback that made this optional - if the provider search or the pricing fails, the platform has funded the entire foundation and admin programme and still has one game | **Owner** | **Before X4** - the last point where the answer is still cheap | **X2** |
| 11 | How is the **Game Master revenue share** calculated when a provider charges per round? | Product | Before Game Masters touch provider games. Default: exclude them | `16` s3 |
| 12 | Does the provider's catalogue justify pulling the **games catalogue (X11)** forward? Ten titles at once changes the answer | Product | After the first catalogue sync | `16` s1 |

### Questions raised by the owner's 2 September 2026 brief

| # | Question | Owner | Needed by | Chapter |
|---|---|---|---|---|
| 13 | **Is a player's cross-game rank one number or several?** A single "overall" ranking needs normalised points to be comparable across games with wildly different score shapes; several per-game ranks are honest but give no headline figure. `05` section 3 designs the normalisation; the product decision about what the leaderboard *leads with* is separate and not made | Product | Before X7 | `05`, `13` |
| 14 | **Does historical trading performance enter the new cross-game aggregates, or do they start at zero?** Backfilling makes trading players instantly dominant on a games platform; starting at zero discards real history and will be read as a bug by existing players. Neither is obviously right, and the migration is written once | Product | Before X7 - `18` needs it to write the backfill | `18` |
| 15 | **Who may be challenged?** Anyone on the platform, only mutuals/friends, or anyone who has opted in per game? The owner asked for "challenge any user", which needs a decline path, a block list and a rate limit or it becomes a harassment vector | **Owner** | Before X10 | `20` s2 |
| 16 | **Is declaring game interests part of registration or a later prompt?** Adding steps to registration measurably costs completions, and `20` is designed so the feature works without it | Product | Before X11.5 | `20` s1 |

---

## FACTS A NEW CHAT WILL NEED

Carried over from the `New games plan` tracker and still current.

| Thing | Value |
|---|---|
| App is live | https://chartvolt.com/ - real users, real money |
| Database | MongoDB Atlas (`mongodb+srv`) |
| Local database | `chatvolt` - development only, confirmed **not** production |
| Deployment | Owner develops locally, pushes to git, fetches on the server. **No staging environment** |
| Test framework | `vitest` `^3.2.4`, tests in `__tests__/services/` |
| Test commands | `npm test`, `npm run test:run`, `npm run test:coverage` |
| CI | `.github/workflows/test.yml` runs `vitest run` on push and PR |
| Pre-commit | `husky` running `eslint --max-warnings=0`. Warnings block commits |
| Transactions | The contest join path uses MongoDB transactions, which **require a replica set** |
| Model mirroring | Every model exists twice - `database/models/` and `apps/admin/database/models/`. **They have already drifted.** Stage 0 adds the guard |
| Settings pattern | Environment variables mapped into whitelabel settings, editable in Admin > Settings > Environment. Follow the `IP_INTELLIGENCE_API_KEY` precedent |

### Things in the codebase that the owner's 2 Sep 2026 brief turned out to depend on

Verified in code on 2 September 2026. Each one changes an estimate or a design, and
several read as "does not exist" until you look.

| Thing | Reality | Where |
|---|---|---|
| **Matchmaking** | **Already exists, and is trading-only.** `getRankedMatches`, `findBestMatch`, `getMatchableTraders`. This is risk **X13** - it will keep working and keep returning trading matches | `lib/services/matchmaking.service.ts`, `GET /api/matchmaking` |
| Challenge opponent | **Always a direct invitation** to a required `challengedId`. No open challenge exists, and the help page says so | `POST /api/challenges` |
| `GET /api/landing/challenges` | **Not** a joinable public list - an anonymised marketing feed. Easy to mistake for the feature | |
| Friends, requests, block list | **Exist**, main app only, not mirrored into admin | `database/models/messaging/friend.model.ts`, `blocked-user.model.ts` |
| Report a user | **Does not exist** for players. Blocking is the only control | - |
| `Friendship.mute` / `.unmute` | Model methods exist; **no HTTP route calls them.** A dead capability | `friend.model.ts` |
| Player user search | **Exists**, and already returns friend/block/pending flags | `GET /api/messaging/search/users` |
| Challenge availability | **A single platform-wide boolean.** Per-game willingness is new | `UserPresence.acceptingChallenges` |
| General player preferences | **No such model.** Only notification prefs, `settings.privacy`, and the presence toggle | - |
| Onboarding | A dismissible checklist, **and one of its five steps is "place your first trade"** | `components/dashboard/GettingStartedCard.tsx` |
| Rate limiting | **Exists** with named presets (deposit, withdrawal, login). Add a preset, do not write a second limiter | `lib/utils/rate-limiter.ts` |
| Payment provider pattern | The model to copy for **game registration UX** - but **not** for storage: it embeds `credentials[]` in the readable document and has a `saveToEnv` flag that writes secrets to `.env` | `apps/admin/components/admin/PaymentProvidersSection.tsx`, `payment-provider.model.ts` |

---

## DOCUMENTS IN THIS FOLDER

| File | Purpose |
|---|---|
| `PROGRESS.md` | **This file.** Status and decisions |
| `00-README.md` | Concept, vocabulary, the two game families, index |
| `01-provider-contract-specification.md` | **The core document.** Our requirements. Send to candidate providers |
| `02-integration-architecture.md` | Components, adapters, sequence diagrams |
| `03-competition-and-challenge-flows.md` | End-to-end flows, timing windows, attempts, settlement |
| `04-data-model.md` | New collections and fields, all additive |
| `05-scoring-points-and-rewards.md` | Score to ranking to points, badges, levels, milestones |
| `06-trust-security-and-disputes.md` | Signing, replay protection, anti-cheat, disputes |
| `07-failure-modes-and-edge-cases.md` | Outages, missing results, refunds, money invariants |
| `08-provider-evaluation-checklist.md` | Gates, scoring matrix, pricing arithmetic, questions to send, pilot stages |
| `09-implementation-phases.md` | E1-E9, testing, rollout controls, definition of done - the **add-on** scenario |
| `10-external-only-programme.md` | **The external-only scenario.** What changes, the X0-X12 plan, the honest cost comparison, six scenario-specific risks |
| `11-foundation-and-seams.md` | The four seams, the game-module contract, the trading regression test. Was `New games plan` P1 |
| `12-admin-panel-plan.md` | Navigation, RBAC, game-aware create wizard, analytics by game and provider, settings |
| `13-user-ui-and-routes.md` | Play dispatcher, provider scoping, dashboard, leaderboard, results, help, navigation |
| `14-terminology-and-wording.md` | Terminology layer, migration passes, identifiers that must never be renamed |
| `15-infrastructure-jobs-and-flags.md` | Flags, trading master switch, price-feed gating, worker jobs, observability |
| `16-games-catalogue-and-marketplace.md` | Catalogue as editable content, the no-pay-to-win rule, Game Master residuals |
| `17-risk-register.md` | R-series platform risks, X-series scenario risks, three gates |
| `18-migration-testing-rollout.md` | Backfills, eight test tiers, rollout sequence, rollback per phase |
| `19-game-masters.md` | Game Masters on provider games: creation, referral earnings, tier limits, the per-round-cost problem |
| `20-onboarding-and-matchmaking.md` | **New 2 Sep 2026.** Declared and inferred game interests, challenge matchmaking, opponent selection, and the abuse controls that "challenge any user" requires |
| `ChartVolt-External-Games-Plan.html` | Illustrated internal version, for reading and sharing |
| `ChartVolt-Game-API-Requirements.html` | **The document we send to game providers.** Same requirements as `01`, written for their engineers. Currently **version 1.1** - bump the version and the document-history table whenever `01` changes |

**If the plan changes, both HTML files must be updated too.** See the document sync
rule near the top of this file.

---

## RELATIONSHIP TO THE `New games plan` FOLDER

**External-only was chosen, so the second diagram below is the live one.** The first is
kept because it explains what the folder was written against, and that context makes the
cross-references in `01`-`09` readable.

### Add-on - complementary, with a one-way dependency - NOT PURSUED

```
Stage 0  - prerequisite defect fixes        (New games plan 00a)
   |
Phase 1  - game module foundation           (New games plan P1)   REQUIRED BY BOTH
   |
   +--> in-house game module (Trivia)       (New games plan P2)
   |
   +--> external provider module            (THIS PLAN, E1-E9)
```

This plan **replaces the first proof game** rather than the architecture. Nothing here
reduces the need for Stage 0 or Phase 1.

### External-only - this folder stands alone - CHOSEN 2 SEP 2026

```
X0  Stage 0 defect fixes         (still required - New games plan 00a)
 |
X1  Foundation, four seams       (THIS FOLDER, ch. 11 - was New games plan P1)
 |
X2..X5  Provider integration     (THIS FOLDER, ch. 09 E1-E4)
 |
X6..X8  Admin, UI, wording,      (THIS FOLDER, ch. 12-15 - was New games plan P3-P5)
        flags, infrastructure
 |
X9..X12 Resilience, challenges,       (THIS FOLDER, ch. 09 E7-E9 + ch. 16 + ch. 18 + ch. 20)
        catalogue, matchmaking, pilot
```

**This is the chosen shape as of 2 September 2026.** Two adjustments came with the
decision: X6 and X6.5 complete before X7 begins (admin-first), and X10 to X11.5 now
include opponent selection and matchmaking from chapter `20`.

The `New games plan` is now **reference material rather than a dependency** - its audit
and architecture chapters remain the fuller treatment of the codebase, and `00a` remains
the authoritative Stage 0 specification. Chapters `10`-`20` here restate what is needed
rather than duplicating the whole thing, and cross-reference the source where the detail
lives.

**Stage 0 comes first and needs owner sign-off.** That was true in both scenarios and is
unaffected by the decision - it is the work currently in flight.

---

## WORK LOG

Newest at the top.

```
### [DATE] - [PHASE] - [STATUS]
**Shipped:** what was actually built and merged
**Files touched:** the significant ones
**Deviated from plan:** what was done differently and why
**Owner tested:** what was verified, and the outcome
**Deferred:** what was consciously left for later
**Next chat should:** the single clearest next action
```

---

### 4 Sep 2026 - X5 FIRST HALF - PUBLISH, ENTRY AND RANKING - PARTIALLY BUILT

**Shipped:** a provider contest can be published, entered and correctly ranked.

- `lib/games/provider/` - the provider game module (`config.ts`, `scoring.ts`,
  `index.ts`), mirrored into the admin app and registered in both registries.
- `lib/services/contest-entry/participant-seat.ts` - the participant row, extracted from
  the inline object it used to be so a test can compare its keys against `schema.paths`.
- `CompetitionParticipant`: the three virtual-capital fields are now conditional on the
  game label. Mirrored.
- `apps/admin/lib/services/game-providers/provider-contest-publish.service.ts` plus
  `POST /api/games/contests/[competitionId]/publish`.
- `RankableParticipant.scoreDirection`, so one provider module can serve titles that rank
  in opposite directions.

**Files touched:** the two participant models, `lib/games/{types,registry}.ts` and both
mirrors, `contest-entry.service.ts` and `contest-entry/types.ts`, the new module and
publish service, `__tests__/services/provider-entry-and-ranking.test.ts` (23 tests),
`tools/probe-provider-entry.ps1` (10 probes), plus two existing tests updated deliberately.

**Two P0 defects found by the audit, neither predicted by the plan:**

1. **A provider participant could not be saved at all.** Three capital fields were
   `required: true` with no default, and a provider contest has no capital to copy. The
   symptom would have been a Mongoose validation error naming a concept the player has
   never heard of.
2. **A provider participant that did save was labelled `trading`**, because entry left
   `gameKey` to its schema default. Nothing crashes, the row looks correct, and `gameKey`
   is immutable - so every provider player would have been filed under trading forever.

**Deviated from plan:** `09` E4 lists `ProviderGameModule` and settlement as one phase.
Only the module shipped. Settlement is an extraction of the trading finalize function's
back half rather than a wiring job, and doing it badly is the one change in this programme
that can pay the wrong people, so it is its own piece of work.

**Owner tested:** not yet. Nothing is player-visible - `externalGamesEnabled` is still
false and no player screen exists for a provider contest.

**Deferred:** round launch for players, provider settlement, and the `exclude` policy's
entry-fee refund (still `refundOwed: true`). No unpublish, deliberately: a visible contest
can be paid into, so cancel-with-refund is the reversible operation.

**Two corrections worth carrying, both from probing rather than from review:**

- A probe of the `|| "trading"` in the new requirement predicate stayed green, because
  **Mongoose applies a schema default before validation** - so an absent `gameKey` never
  reaches the predicate as `undefined`. The test was passing for a reason other than the one
  it claimed. Rewritten to use an empty string, which does reach it, and which is a real
  missing-value shape rather than a contrivance.
- A probe of the `isAtRisk` NaN guard also stayed green, and here **the claim was wrong
  rather than the test weak**: `NaN < 60` is false, exactly as the guard's explicit `false`
  is, so it changes no answer today. Kept for readability, with the comment corrected to say
  so rather than claim a fix.

**Next chat should:** build the player round-launch surface, then settlement. Trading is
pinned by the golden ranking regression - keep it green through both.

---

### 4 Sep 2026 - X6 SLICE - CONTEST WIZARD FROM `configSchema` + PRE-FLIGHT - CODE-COMPLETE

**Shipped:** an operator can now create a competition on a provider game, with the settings
step generated from that game's own schema, validated by the `03` s4.1 pre-flight checklist.
This is the half of E5's "an admin can run a contest without a developer" that concerns
*creating* one. A game picker at `/competitions/new`, a four-step provider wizard, a
schema parser and validator, the checklist, and the bridge that closes X3's
`RoundContestConfig` deferral. 49 tests in
`__tests__/services/provider-contest-create.test.ts`, **all 15 guards probed**. Admin `tsc`
back to the **225-error baseline exactly**, none in the changed files and none disappearing;
main app unchanged at 18. `check:mirrors` clean.

**Files touched:** `lib/services/games/{config-schema,contest-preflight,contest-config}.ts`
(mirrored into `apps/admin`), `apps/admin/lib/services/game-providers/provider-contest.service.ts`,
`apps/admin/app/api/games/contests/route.ts`, `apps/admin/app/competitions/new/page.tsx`,
`apps/admin/components/admin/games/{ProviderContestWizard,ConfigSchemaFields,contest-draft,contest-types}`,
both copies of `competition.model.ts`, `AdminDashboard.tsx` and `CompetitionsListSection.tsx`
(create buttons now point at the picker).

**Deviated from plan - one structural deviation, stated rather than absorbed.** `12` s2
describes **one** wizard whose step four becomes dynamic. **Two were built.**
`/competitions/create` is untouched and a new picker routes to it or to the provider wizard.
The reason: that section sets two acceptance criteria - *no trading field in a provider
contest* and *trading creation unchanged* - which one wizard meets only after refactoring
the 2,892-line form live trading contests depend on. Two paths meet both now, at no risk,
with both behaviours pinned by tests; merging later is then a UI refactor against a green
suite. Recorded in `12` s2.1.

**Deferred:** publishing (X5 - a draft is all that can be created), provider **challenges**
(E8), and **editing** a provider contest, which makes `CompetitionEditorForm.tsx`'s
pre-existing field gap load-bearing rather than cosmetic - provider game settings are
currently uneditable once saved.

**Five things worth carrying.**

- **A checklist item gated on a field nobody populates is an item that never runs.** The
  first draft of the pre-flight read `title.billsPerRound` - **a field that does not exist**
  on `provider_game`. It type-checked, because the checklist declares its own input
  interface rather than importing the model, so the compiler had nothing to disagree with.
  That warning would have been permanently unreachable. Checking the model's real field list
  before putting it on record also found `lastSuccessfulRoundAt`, which *does* exist and is
  now what the sandbox-freshness check reads. **A hand-written input interface is a place
  where an invented field survives a typecheck.**
- **Verify the throwaway sentence, second instance.** A file-header comment claimed the
  player lobby "queries exactly four statuses". It filters `status: { $ne: "draft" }` - an
  explicit exclusion, which is *stronger*, since a status added later is hidden by default
  rather than accidentally exposed. The claim was corrected before it went on record, and
  the line is now pinned by a structural test, because the entire safety argument for
  creating provider contests rests on it.
- **Narrowing a `required` field is a change to the OTHER game's contract.** Making
  `startingCapital` conditional reads as "provider games don't need it". What it actually
  does is move a guarantee trading relies on out of the schema and into a predicate - and
  the `?? "trading"` in that predicate is load-bearing, not defensive, because invariant 5
  resolves an absent label to trading. Written as `this.gameType === "trading"`, an
  unlabelled trading contest saves with no capital and every downstream calculation divides
  by it. Pinned in **both** copies: a conditional requirement that differs between the apps
  is a validation rule that depends on which process saved the document.
- **A schema parser must fail closed, and permissiveness does real harm here.** Unsupported
  keywords (`allOf`, `pattern`, `oneOf`) refuse the whole schema rather than being skipped.
  Skipping renders a form missing half the real constraints and then validates against the
  half it understood - reporting success while accepting settings the provider rejects at
  play time. Same reasoning as the market-hours gate failing closed on an unknown game.
- **Probing lesson, fourth instance, and this time the harness was the liar twice over.**
  One probe reported `PROBE DID NOT APPLY` (4-space indent in the pattern, 2 in the file),
  and **every** probe reported "OTHER test" because `Out-String` wraps at the console width,
  so a long test name arrived split across two lines and the literal match silently missed
  it. Both look exactly like a broken test. Fixes now in `tools/probe-contest-wizard.ps1`:
  collapse all whitespace in the output before matching, and assert the file actually
  changed before believing any outcome. **A probe harness needs its own probe.**

**Next chat should:** X4 - the real adapter against a provider sandbox - or, if no provider
is signed, X5 so a draft contest can actually be published and settled. X5 is the larger
unblocker: without it the wizard produces contests nobody can play.

---

### 4 Sep 2026 - X6 SLICE - PROVIDER REGISTRATION, CREDENTIALS, PER-TITLE SWITCH - CODE-COMPLETE

**Shipped:** the first operator-facing part of X6, taken next because X4 cannot begin without
a signed provider and the owner's "admin first" instruction puts these screens before any
player screen. A `game-providers` admin section under GAMES; five API routes; a
`provider-admin.service.ts` holding the rules; and three dialogs - register, credentials,
catalogue. 26 tests in `__tests__/admin/game-providers-admin.test.ts`, suite now **564 in 32
files**. Admin `tsc` **matches the 225-error baseline exactly**, with none in the changed
files and, equally important, **none disappearing**.

**Files touched:** `apps/admin/database/models/admin-employee.model.ts` (two add-only section
ids); `apps/admin/components/admin/AdminDashboard.tsx`;
`apps/admin/lib/admin/section-route-guard.ts` (new);
`apps/admin/lib/services/game-providers/provider-admin.service.ts` (new);
`apps/admin/app/api/games/providers/**` (five routes, new);
`apps/admin/components/admin/games/**` (four files, new); `eslint.config.mjs`.

**Deviated from plan:** `12` s4 lists five destinations. Only **Providers** and the per-title
**Games** list are built. Provider health, round inspector and manual resolution are left,
deliberately: health wants the `provider_health_check` time series from `04` s3.5, and the
inspector and resolution screens are most useful once X4 has produced real rounds to inspect.
Building them against the mock now would ship screens whose only content is fixtures.

**Six guards probed** by reintroducing each defect and confirming the suite turned red:
leaking a secret value into the provider list, ignoring `providerStatus` on the per-title
switch, enabling a provider with no callback secret, treating a blank secret box as "clear",
creating a provider already enabled, and swapping the section grant for a bare
`requireAdminAuth`. All six went red; none was already covered by accident.

**One live defect found and fixed on the way.** The first time a callback secret was stored
was recorded as a rotation, stamping `rotatedAt` on a provider that had never rotated
anything. Harmless in effect - `previousCallbackSecret` is undefined either way, so no stale
secret became acceptable - but a false fact in the database, and an operator reading that date
would reasonably believe a rotation had happened. Found only because the
presence-booleans test asserted the *whole* credential object rather than the fields it cared
about.

**Deferred:** sidebar clicks still do not write `?activeTab=` to the URL. Pre-existing, affects
all ~60 sections, belongs with X6.5.

**Next chat should:** get the owner to test the screen against the mock provider - register
`mock`, add any callback secret, enable it, sync the catalogue, toggle a title - then either
start X4 if a provider is signed, or take the contest wizard next.

---

### 4 Sep 2026 - X1 STEP 6 - THE THREE GUARDS - BUILT AND PROBED

**Shipped:** the three things that stop the engine quietly assuming trading. `contestGameLabel()`
and `gameNeedsMarketHours()` added to the registry and mirrored; **six** raw-driver contest
inserts now stamp the label; an ESLint `no-restricted-imports` rule enforcing invariant 1;
and the market-hours gate scoped to `capabilities.needsMarketHours` at all three cross-game
call sites. 34 new tests in `__tests__/services/game-guards.test.ts`, suite now **391 in 28
files**.

**Files touched:** `lib/games/registry.ts` + `index.ts` (and mirrors); `eslint.config.mjs`;
`app/api/gamemaster/competitions/route.ts` and its admin twin;
`apps/admin/app/api/admin/trading-tests/run/route.ts`;
`apps/admin/app/api/admin/end-logic-tests/run/route.ts`; `app/api/challenges/route.ts`;
`app/api/challenges/[id]/accept/route.ts`;
`apps/admin/lib/actions/trading/competition.actions.ts`.

**Four findings worth carrying:**

- **There were SIX raw contest inserts, not the one R7 named.** Two Game Master routes,
  two in the admin trading-test harness and two in the end-logic harness. The harness ones
  matter more than they look: **the end-logic harness drives finalization**, which now
  dispatches on `gameType`, so seeding contests unlabelled would have exercised the
  absent-label fallback rather than the path production takes - a harness quietly testing
  something adjacent to the real thing. Same lesson as Defect 1's "four writers, not two":
  **count the writers before fixing the one the plan names.**
- **Nothing was broken in production, and it is worth being precise about why.**
  `resolveGameType` treats an absent label as trading (invariant 5), so every unlabelled
  Game Master contest still settles correctly today. R7 is not a live payout bug; it bites
  the day something **groups by `gameKey`** and the row silently drops out of a total -
  long after the commit that caused it, and **unfixable in place, because `gameKey` is
  immutable once written.**
- **`no-restricted-imports` matches the import STRING, not the resolved path**, and the
  first version of the rule was wrong because of it. `**/lib/games/*` caught
  `@/lib/games/trading`, `@/lib/games/trading/scoring` and `@root/lib/games/trading/config`
  but **missed `../games/trading`**, which has no `lib/` segment. Found by writing a probe
  file with four violations and four legal imports and checking which fired - 3 of 4. The
  rule is also **blocked-by-default with the public surface negated**, so adding a game
  needs no config change while adding a public engine file needs one line; the safe
  default is refusal.
- **The market gate on challenge accept had to MOVE, not just gain a condition.** It ran
  *before* the challenge was loaded, so it could not know the game - there is no way to
  scope a gate to a capability without first reading the document that carries the label.
  It now runs after the lookup and the cheap validations but **before any wallet read**,
  the same ordering rule as `checkAccountStanding` in sub-defect 1b, so a refusal cannot
  leave one of the two debits applied. Side effect and an improvement: a request for a
  challenge that does not exist now returns **404 rather than a market-closed 400**.

**The gate fails CLOSED on an unknown game type**, deliberately. The two mistakes are not
symmetric: wrongly applying it refuses a contest visibly and someone complains, while
wrongly skipping it lets real money trade against a closed market on stale prices. Also,
**neither create path takes the game type from caller input** - a client- or
operator-supplied value would be a way to skip the market gate on a trading contest by
claiming to be a different game. Pinned by its own test.

**Deviated from plan:** the admin competition-create gate was **extracted into
`assertForexMarketOpenForCreate()`** rather than wrapped in place. Sixty lines of live
money code re-indented is an unreviewable diff for a one-line semantic change, and the file
was already **753 lines**, over the 500 guidance. The body is unchanged.

**Verified:** all seven guards probed by reintroducing the defect - dropping the label from
two different raw inserts (2 red each), naming `trading` instead of a wildcard in the
ESLint pattern (1 red), removing the games-layer exemption (1 red), flipping the gate to
fail open (1 red), and making the gate unconditional at two call sites (3 and 1 red).
**Every probe went red; none was a test that only ever passes.** Suite 391/391 in 28 files,
golden baseline byte-identical, main typecheck 18 and admin 225 both exactly at baseline,
`check:mirrors` 75 agree 0 drifted.

**OWNER DECISION, 4 Sep 2026 - the weekend competition-create block is REMOVED.** The admin
action used to refuse an operator creating a **trading** competition while the forex market
was closed. That was a live usability defect on its own terms, and it extends the 1 Sep
decision that **joining** a contest outside market hours is allowed and only trading itself
is gated: setting up Monday's competition on a Sunday is the same kind of legitimate.

Three things make the removal safe rather than merely convenient. **The gate that matters
is untouched** - order placement in `order.actions.ts` still refuses trades against a closed
market, so a competition created at the weekend simply cannot be traded in until it opens.
**The main app never had this check**, so the two apps now agree rather than differing by
accident. And **the market-holiday overlap warning stays** - it informs the operator without
refusing them.

Note this is *not* the capability-scoping treatment the other two gates got. Scoping it to
`needsMarketHours` would have left it refusing trading competitions at the weekend - correct
for games, still wrong for operators. `assertForexMarketOpenForCreate()` was **deleted with
it**, on the `shouldBlockEntry` precedent: a dead guard makes reintroducing the defect look
like using an existing API. Pinned by three tests asserting the refusal is absent from
**both** apps and that the holiday warning survived; probed by reintroducing the throw,
which turned 2 red.

**Invariant 2 was added the same day** (game modules never importing contest models), on the
grounds that it cost five minutes and the alternative was remembering at X4. Nothing violated
it. Two things about it generalise beyond this rule:

- **The scope is one level below the obvious one.** `lib/games/*/**` matches a module folder
  but not the layer's own public files, because **`lib/games/index.ts` legitimately reads
  `WhiteLabel`** for `getEnabledGameTypes()`. Written as `lib/games/**` the rule would ban
  that and look completely correct doing it. It bans **every** model rather than an
  allow-list of contest models - a module needing any document is already the design going
  wrong, and a list silently permits the next model somebody adds.
- **Flat config is last-one-wins per rule, so block order is load-bearing.** The invariant 1
  exemption switches `no-restricted-imports` **off** for all of `lib/games/**`, so the
  invariant 2 block must sit after it or it is **silently dead** - and a dead config block
  still parses and still reads correctly. Pinned by a test asserting the index of one
  against the other; probed by widening invariant 2's scope, which turned 2 red.

Suite now **396**. Probed by importing four contest models and the connection helper from
inside `lib/games/trading/` - all four flagged, including the relative form - while
`lib/games/index.ts` and its mirror stayed clean.

---

### 4 Sep 2026 - X1 STEP 7 - THE BACKFILL - BUILT, NOT YET RUN. X1 IS CODE-COMPLETE

**Shipped:** `tools/games/backfill-game-labels.ts` (backfills 1 and 3 from `18` s1),
`BadgeConfig.gameTypes` added to both app copies, and the structural half of the invariant 9
guard. Suite **445 in 29 files**, up from 396.

**The backfill has NOT been run against production.** It is report-only by default and needs
a deliberate `--apply`.

**Backfill 2 was deferred rather than written, and the reasoning is the deliverable.**
Chapter 18 already said to skip completed contests, because their `finalLeaderboard` is
stored and authoritative. The same reasoning extends to *active* ones once you check what
actually reads the field: **trading ranks on its own six metrics and never reads `score`,
and seam 2 - the thing that would keep it current during play - is not built.** Writing it
now produces a number nothing maintains and nothing reads, which goes stale immediately
while looking authoritative. The schema default of `0` means nothing crashes meanwhile.
Recorded in `18` s1, not silently skipped.

**Four things from building it that generalise:**

- **The most important property of a backfill is what it refuses to touch.** `gameKey` is
  immutable because it is the join key for every historical stat, so a script that *can*
  rewrite it can destroy history silently. "It only sets missing fields" is an assertion
  about a query filter, and query filters are exactly what people get wrong - so it is
  pinned by a test seeding a `provider` / `chess-blitz` contest and asserting it survives
  untouched. Widening the filter turned 3 red.
- **"Missing" has three shapes and only one is obvious.** Absent is the pre-X1 document,
  `null` is what some older writers stored, `""` is what an empty form field produces. A
  filter matching only `$exists: false` leaves the other two behind - **and those are the
  two that look correct in a document dump.** Each clause probed separately; dropping either
  turns 1 red.
- **A schema default is not a stored value, and `.lean()` is where the difference shows.**
  Mongoose applies defaults when it *hydrates*, so an ordinary read of an old contest
  returns "trading" with nothing stored. `.lean()` skips hydration and returns the raw
  document, missing key and all - and much of this codebase reads with `.lean()` for speed.
  This is why the backfill is needed at all despite invariant 5.
- **Do not let a migration carry its own copy of a constant.** The script imports
  `TRADING_GAME_TYPE`, and a test asserts the value it writes equals what
  `contestGameLabel()` produces. With its own literal, a future change to the app's default
  would relabel history to a value nothing else uses - and **every row would look correctly
  labelled.**

**Invariant 9 (R29) is now guarded structurally.** 34 assertions that no stats, leaderboard,
ranking, progression or badge read path calls `getEnabledGameTypes()` **or**
`assertGameEnabled()` - the second matters because it calls the first internally, and it is
the more likely route since it reads as a validity check. Plus a test that the ranking
services import `@/lib/games/registry` and **not** `@/lib/games`, which is the whole reason
those live in separate files. The behavioural half - award progression, disable the game,
assert the level is unchanged - **cannot be written until `UserGameStats` exists at X7**, and
saying so is more useful than a checkbox implying otherwise.

**`BadgeConfig.gameTypes`** defaults to `["trading"]`, and an **empty array means every
game**, not none - a misconfiguration that silently makes a badge unearnable is worse than
one that makes it broad. The backfill therefore leaves an empty array alone. Note this is
**not** the enumeration invariant 8 forbids: invariant 8 bans the *engine* branching on game
type, while scoping one badge to the games it makes sense in is operator content. "100
trades" genuinely cannot be earned at chess.

**Deviation from plan:** the tool is split into `backfill-game-labels.ts` (CLI) and
`backfill-game-labels-core.ts` (logic), because the script calls `main()` at module level
and a test importing it would otherwise try to connect to production.

**Verified:** 445/445 in 29 files, main typecheck 18 and admin 225 exactly at baseline,
`check:mirrors` 75 agree 0 drifted, lint clean on every changed file. Seven probes, all red.
One probe initially reported a false pass - a multi-line PowerShell pattern with CRLF against
an LF file simply did not match, so nothing was modified and the test stayed green
*correctly*. **A probe that does not apply is indistinguishable from a test that does not
work; check the replacement happened before believing either result.**

**X1 IS CODE-COMPLETE.** Two things remain, and both need a real database rather than more
code: `replay-historical-rankings.ts` has still never been run, and the backfill has not been
applied. Both are read-only or report-only by default.

**Next chat should:** run those two against production data with the owner, then start
**X2**. Worth stating plainly for anyone reading this cold: **code-complete on X1 does not
mean external games work.** X1 is the foundation - the engine no longer assumes every contest
is trading. A provider game does not plug in until **X4** (the adapter) and **X5**.

---

### 4 Sep 2026 - X2 - PROVIDER ABSTRACTION AND MOCK ADAPTER - CODE-COMPLETE

**Shipped:** `game_provider` and `provider_game` in both apps, three `WhiteLabel` settings
fields in both apps, `lib/services/game-providers/` (contract, registry, mock adapter,
catalogue sync) mirrored into the admin app. Suite **489 in 30 files**, up from 445.
Mirror guard now **77 pairs**, up from 75. Both typechecks exactly at baseline, lint clean.

**Done-when from `09` E1 is met:** the mock catalogue syncs, appears in the database, and the
registry resolves an adapter by key. **Nothing is player-visible** - `externalGamesEnabled`
defaults to false.

**The X2 gate is now CLEARED** (later the same day - see the entry below). It was built
while the gate was still open, on the grounds that X2 touches no ranking or settlement code,
and that judgement turned out to be safe.

**The plan gave two locations and invariant 2 decided between them.** `11` s3 sketched the
provider code at `lib/games/provider/adapters/`; `02` s9 put it at
`lib/services/game-providers/`. The ESLint rule from X1 step 6 bans anything inside a game
module folder from importing a model - and the registry reads settings while the catalogue
service writes `provider_game`. So the second location is the only one that does not require
weakening the invariant, and the split it forces is the right one anyway:
**`lib/services/game-providers/` does I/O, `lib/games/provider/` (X5) is pure scoring.**
A general rule falls out of this: **when a guard and a plan disagree about where code goes,
the guard is usually describing a real constraint the plan had not met yet.**

**Five findings, and two are defects in work from the previous phase:**

- **My own invariant 1 ESLint rule had a latent false positive, and X2 triggered it.** The
  pattern `**/games/*` matches **any** path with a `games/` segment, so it began rejecting
  `@/database/models/games/provider-game.model` the moment that folder existed. Fixed with
  `!**/models/games/**`. The general lesson: **a blocked-by-default wildcard will eventually
  collide with a directory that merely shares a name, and the collision is indistinguishable
  from a real violation.** Models are already governed by invariant 2, which bans them
  *inside* game modules; importing one from the engine is ordinary.
- **A glob inside a JSDoc comment silently truncated a source file.** `lib/games/*/**`
  written in prose contains `*/`, which **closes the comment**, so the rest of `contract.ts`
  parsed as garbage. What makes this worth recording is the symptom: the main typecheck
  **dropped from 18 errors to 16**, which read as an improvement. **A file that fails to
  parse reports fewer errors, not more** - so treat a typecheck count going *down*
  unexpectedly with the same suspicion as one going up. ESLint caught it; `tsc` did not.
- **A `readonly` field initialised from a `const` infers the literal type and blocks
  subclassing.** `readonly providerKey = MOCK_PROVIDER_KEY` inferred `"mock"`, so the
  second-adapter test failed with TS2416. Annotate `: string` to match the interface. This
  matters beyond neatness: **chapter 09 s7 requires a second adapter skeleton in X9 because
  with one provider the "a second game costs one file" claim is never tested** (risk X6), and
  the type error would have surfaced then instead.
- **"Like payment providers" was right about the UX and wrong about the storage, and the
  model now says so in a comment.** `game_provider` deliberately holds **no secrets** so
  every admin screen, the lobby and the catalogue picker can read it freely; credentials live
  in `WhiteLabel.gameProviderCredentials` with **`select: false`**, so a bare
  `WhiteLabel.findOne()` - which dozens of call sites already do, several returning the result
  to a client - **cannot leak one**. A caller that needs them must write
  `.select("+gameProviderCredentials")`, which is greppable.
- **Two switches, not one, on every title.** `providerStatus` is what the provider says;
  `chartvoltEnabled` is what we say, and it defaults to **false**. Collapsing them would hand
  a third party the ability to put an untested game in front of paying players by changing a
  value in their own database.

**The catalogue sync's three rules are each pinned by a test**, and the reasoning for the
allow-list is the transferable part: it writes a **named list** of provider-owned fields
rather than spreading the payload, because a spread means any field the provider adds - or
any field an operator later edits - is silently overwritten on the next sync, **and that
failure is invisible until someone notices their wording reverted**. It also never enables a
title, and it **reports** titles the provider dropped rather than deleting them, since a
title with historical rounds cannot be removed without orphaning the stats joined to its
`gameKey`, and a provider omitting a game from one response is as likely to be a partial
failure on their side as a withdrawal.

**The mock's job is to be a good liar.** A provider that always works proves nothing, so it
simulates nine named failure modes from `07` - outage, catalogue unavailable, round-create
failure, rate limit, bad credentials, callback never arrives, impossible score, bad
signature, stale timestamp. Two details worth keeping: it is **idempotent on `roundId`**
exactly as the contract requires, because a mock that is not would let a double-click bug
through every test that uses it; and its default catalogue deliberately includes a
**`lower_is_better` / `duration_ms`** title, because **a catalogue of only higher-is-better
games lets a ranking sign error pass every test - and that error pays the slowest player
first.**

**Invariant 6 is guarded structurally**: 11 assertions that no file in the provider layer
imports anything wallet-, prize-, payout- or Stripe-related, that the adapter imports no
model at all, and that the contract declares no money-bearing field. Named explicitly rather
than matched with a loose regex, so a money model added later is a deliberate addition to
that list.

**Verified:** 489/489 in 30 files, main typecheck 18 and admin 225 exactly at baseline,
`check:mirrors` 77 agree 0 drifted, all four mirrored provider files byte-identical, lint
clean. **Seven probes, all red** - provider-enables-a-title, sync-deletes-dropped-titles,
sync-writes-on-failure, allow-list-leaks-presentation, signature-length-guard-removed,
registry-fails-open, `chartvoltEnabled`-defaults-true.

**Two probes initially reported false passes and both are the same lesson as X1 step 7.** One
targeted the create path when the assertion was about the update path - **a probe aimed at
the wrong code path is indistinguishable from a test that does not work.** Two more failed to
match at all because a multi-line PowerShell pattern with CRLF met an LF file, and one
because an emoji in the anchor did not survive the shell. The fix is a probe helper that
escapes the pattern and then relaxes every newline to `\r?\n`, and anchors that avoid
non-ASCII.

---

### 4 Sep 2026 - THE X1 RANKING GATE IS CLEARED

`tools/games/replay-historical-rankings.ts` ran on the server against real history:
**4 competitions read, 4 examined, 4 reproduced exactly, 0 mismatched.** The extraction of
the two trading metric switches into `lib/games/trading/scoring.ts` changed no historical
outcome. Recorded in `11` s4 under "GATE CLEARED".

**No before/after run was needed, and that is worth explaining** so nobody repeats the work.
The script is written to run twice because a mismatch is normally ambiguous - participants
edited after settlement, competitions settled under older ranking rules, and
`emergency_ended` snapshots each diverge for reasons unrelated to the extraction, so the
meaningful figure is the delta between the two runs. **At 100% the delta cannot be anything
but zero.** A perfect score is the one result that needs no baseline.

**Four competitions is a thin sample and the documents now say so.** The gate asked for real
history because real history carries distributions, tie patterns and edge cases nobody would
invent - and four contests carry almost none of that. What the replay proves is narrower but
still exactly what was asked: the extracted path runs against genuinely stored data and
reproduces it identically. **The golden matrix remains the stronger evidence of the two**,
not the weaker, and any summary implying four-for-four is comprehensive is wrong.

**Two findings, and the second one generalises further than this script:**

- **The gate script had never been run, and in fact could not be run.** It read
  `process.env.MONGODB_URI` directly and never loaded dotenv - unlike its sibling
  `backfill-game-labels.ts` - so it refused to start from an ordinary shell even with a
  correct `.env` in the project root. Fixed in `d35544d4`, with `dotenv.config()` placed
  before the other imports because a module reading `process.env` at load time would
  otherwise see nothing, and with the refusal message now naming the path it searched.
  **A tool written as an acceptance gate but never executed is not evidence of anything.**
- **"Is the data real?" was the wrong question.** The owner's first instinct was that the
  replay was pointless because the server holds test data. But the script compares against
  the `finalLeaderboard` **written when each contest settled**, so what matters is not
  whether the users and money were real - it is **which code wrote the value being compared
  against**. These contests settled through the app, so the stored leaderboards came from
  the pre-extraction ranking code and the comparison is a genuine before/after. Had they
  been seeded directly by a script, the same run would have proved nothing while looking
  identical. **Before dismissing a regression check as meaningless on test data, ask what
  produced the expected values.**

**What this unblocks:** X5. The gate was the one hard prerequisite standing in front of
contest integration and settlement. The **backfill** is still unrun (`--apply` never
invoked), and that one genuinely can wait - it only labels historical rows, and with four
contests there is very little to label.

**Next chat should:** X3 - round lifecycle and result ingestion (`09` E2). That is the phase
`09` marks "the heart of the integration, and the part that must be flawless", with an
explicit instruction not to move past it until every rehearsal in `07` s9 is green. The mock
built in X2 is what those rehearsals drive. **Done - see the X3 entry below.**

---

### 4 Sep 2026 - X3 - ROUND LIFECYCLE AND RESULT INGESTION - CODE-COMPLETE

**Shipped:** the five E2 deliverables plus the reconciliation net. `game_round` and
`provider_event` in both apps (**79 mirrored pairs agree**), `RoundService`, the signed
callback route at `POST /api/games/providers/[providerKey]/events`,
`ResultIngestionService` with all eleven gates in chapter 06 s2's order, and
`callback-verification.ts` for raw-body HMAC and constant-time comparison.
**Rehearsals 1-6 of `07` s9 are green against the mock** -
`__tests__/services/round-lifecycle.test.ts`, 49 tests, suite **538/538**, both typechecks
**exactly at baseline** (18 main, 225 admin), lint 0 problems.

**Six guards probed by reintroducing the defect**, each caught by exactly one test: the
partial unique index, `finalizing` counting as closed, event deduplication, the
provider-failure rollback, conflict detection, and the absolute timestamp window.

**Nothing is player-visible.** `externalGamesEnabled` still defaults to false and no route
creates a provider contest.

#### Six findings that generalise

- **"Enforced in the database" is a claim about a specific index, and this one did not
 enforce what it was credited with.** `07` s4 cited
 `{ contestId, userId, attemptNumber }` as the guarantee behind "one live round per player
 per contest". It is not: attempt 1 `launched` beside attempt 2 `launched` satisfies that
 index perfectly, and that is exactly the abandon-and-peek the rule exists to stop. Closed
 with a **partial unique index** filtered to the live statuses. The rule to carry:
 **name the index and work out what it actually excludes** - and note this is the same
 shape as the R7 correction, where a document asserted a protection that was not there.
- **The dangerous window for a late result is `finalizing`, not `completed`** - and the
 obvious check misses it. During `finalizing` ranking is being computed from participant
 scores, so a score written then may or may not be included **depending purely on
 timing**. That is worse than a genuinely late result, because a late result is
 consistently excluded and alerted while this one is a coin flip that leaves no trace.
 Both contest models carry the state; both are treated as closed.
- **An attempt is consumed on creation, which forces the provider-failure path to DELETE
 rather than void.** Consuming on creation is required (`03` s1.3) or a player abandons a
 bad round and retries free forever. But `01` s6a equally requires a provider 5xx to
 consume nothing - and because `{ contestId, userId, attemptNumber }` is unique, **a
 surviving row of any status permanently burns that attempt number.** Marking it `voided`
 reads like the careful choice and silently costs the player an attempt. Nothing was
 played, so there is nothing to audit.
- **A poller with its own scoring path is a second door, and it is the easy mistake here.**
 Stages 2 and 3 of the reconciliation net produce exactly the same normalised result as a
 callback, so `applyResult` is shared and `resultSource` records which path delivered it.
 Writing a separate apply function for polling would look tidier and would be the
 four-writer competition-entry defect again, in a new place.
- **A backoff with no cap silently disables the stage it belongs to.** Poll backoff doubles
 from 30s; uncapped, it eventually exceeds the grace window, so the round sits un-polled
 until stage 3 and stage 2 has effectively been switched off - with no error and no log
 line. Capped at 5 minutes, pinned by a test at 30 attempts.
- **Reaching stage 4 is always critical, even when the contest settles cleanly.** The
 temptation is to alert only on `hold_and_alert`, since `score_zero` settles on time and
 looks handled. But stage 4 means the provider never reported and all three earlier stages
 failed, which is an integration problem regardless of how gracefully it was absorbed.
 And the player is **always** told: a round silently scored zero is indistinguishable,
 from the player's seat, from being cheated.

#### Two deferrals, recorded rather than quietly scoped

- **Contest-level round fields are passed in, not read.** `attemptsPolicy`,
 `unresolvedRoundPolicy`, `resultGracePeriodSeconds` and `playWindowEnd` arrive as
 `RoundContestConfig`, so X3 adds **no field to either contest model**. Reason: reading
 `Competition` here would mean six mirrored fields in this phase for a code path nothing
 calls yet - the same "a number nothing maintains and nothing reads" trap that deferred
 X1's participant score backfill. X5 wires them without touching this service.
- **The `exclude` policy names its refund instead of paying it.**
 `ReconciliationOutcome.refundOwed` is the obligation. Paying it here would put a second
 money writer beside settlement, and removing a player changes the prize pool - so the
 refund and the re-split are one transaction belonging to X5. **Do not let a summary imply
 `exclude` is fully implemented.**

#### Two things about the tooling, both of which cost time

- **The `**/games/*` ESLint wildcard collided for the SECOND time**, now with
 `lib/services/games`. Negated, as `database/models/games` was in X2. The wildcard is kept
 deliberately now that the cost is known: anchoring it to `**/lib/games/*` would end the
 collisions but the rule matches the **import string**, so a nested file writing
 `../../games/trading` would stop being caught. **That trade is the wrong way round for a
 guard** - a false positive is noisy and fixed in a minute, a missed violation is silent.
 Expect a negation each time a new `games/` directory appears.
- **A fixture trimmed to the fields a test reads failed 34 tests at once for one unrelated
 reason.** The `Competition` fixture omitted `slug`, `startTime`, `endTime` and
 `startingCapital` - none of which a round touches - and Mongoose validates the document,
 not the subset. Same lesson already recorded for the finalization fixtures; it keeps
 recurring because trimming a fixture always feels like tidying.

**Next chat should:** X4 - the real adapter against a provider sandbox (`09` E3). That is
the first phase that **cannot proceed without a signed provider**, which is risk X1. If no
provider is signed, X6 admin work (provider registration, the game-aware wizard) is the
productive alternative and needs nothing external.

---

### 4 Sep 2026 - THE PRE-EXISTING LINT WARNINGS ON THE X1 FILES - CLEARED, LINT-ONLY

**Shipped:** the pending X1 commit now passes `lint-staged` without `--no-verify`. All 23
pending `.ts` files lint at **0 problems**, down from 18 warnings, with **no behaviour
change** - the golden baseline is byte-identical and the suite is 357/357.

**Files touched:** `lib/services/competition-ranking.service.ts` and its admin mirror (a
block `eslint-disable security/detect-object-injection` around the rank-assignment loop,
with a `// Reason:` note); `database/models/trading/challenge.model.ts` and its admin
mirror (a misplaced disable directive removed and `(idx: any)` typed as
`{ name?: string }`).

**Three things worth carrying:**

- **The count was 18, not the 14 first reported.** The first count covered only the two
  ranking services and missed the two `challenge.model.ts` copies. **Count warnings over
  the whole pending changeset, not over the files you happen to be thinking about** -
  `lint-staged` runs on everything staged, so a partial count gives false confidence that
  the hook will pass.
- **All 18 were pre-existing, proven rather than assumed.** `git stash push -- <the four
  files>` then re-linting produced the same 18 warnings with the same rules and only
  shifted line numbers, so X1 introduced none. A surgical path-scoped stash is the safe
  way to take a lint baseline mid-change; a bare `git stash` would have swept 23 files and
  9 untracked directories.
- **`security/detect-object-injection` measures syntax, not safety.** `qualified[i]` warns
  while `qualified[i - 1]` two lines below does not - same local array, same provenance,
  different expression shape. There are **28,227** instances of this one rule repo-wide,
  so a zero-warning repo is not a reachable state and the hook is only ever met a dozen at
  a time. All 14 in the ranking services were false positives: local array, loop counters
  bounded by `.length`, no caller-supplied key.

**Deviated from plan:** suppressed rather than refactored, deliberately. Rewriting the
indexing to `.at()` forces a `T | undefined` guard on every access, and the walk-back loop
depends on a **load-bearing `break`** that stops at the first differing rank. A guard that
`continue`d where the original breaks would silently merge tie groups across ranks - no
exception, no log, **the wrong players sharing a pot** - and it would have to be done
identically in two mirrored files. No security content was being removed in exchange.

**One assumption corrected by probing.** The walk-back loop was assumed uncovered, because
the golden fixture's largest tie group is only two players and the loop body cannot run
below three. A `throw` inside it turned `competition-finalize-payout.test.ts` red (2
tests), so it **is** covered - by the real-MongoDB finalization test, not the golden file.
The general rule: **coverage of a specific branch is a claim to probe, not to infer from
the fixture you happen to have in mind.**

**A misplaced disable directive produces two warnings, not zero.** In `challenge.model.ts`
the `eslint-disable-next-line` sat one line above `const hasStaleIndex = indexes.some(`,
which contains no `any`, while the real `(idx: any)` two lines down went unsuppressed - so
it reported both a **stale directive** and an **unsuppressed `any`**. Worth knowing because
the repo has **74 more** unused-directive warnings of the same family.

**Verified:** 0 lint problems across all 23 pending TS files, and critically **no
"unused eslint-disable directive" warning**, which is what proves the new suppressions are
load-bearing rather than decorative. Golden baseline byte-identical (22/22). Suite 357/357
in 27 files. Main typecheck 18, admin 225 - both exactly at baseline. `check:mirrors` 75
agree, 0 drifted.

**Deferred:** the other ~28,200 instances of the rule, and the repo-wide
`no-unused-vars`/`no-explicit-any` debt. Whether `security/detect-object-injection` should
stay enabled at all is a lint-policy decision for the owner, not something to change
quietly inside a games phase.

**A separate lint-only commit was attempted and abandoned, for a reason worth keeping.**
`lint-staged` lints the **staged content**, not the working tree. Staging the X1 seam
changes to the two ranking services without their suppression comments produces a staged
file carrying all 14 warnings, so the hook fails and the split forces the very
`--no-verify` it was meant to avoid. **A lint fix cannot be split from the change it is
unblocking when both touch the same file.** Landed as one commit instead, called out in
the message.

**Next chat should:** start X1 step 6 - the Game Master raw-driver insert stamping the game
label (R7), the ESLint `no-restricted-imports` rule enforcing invariant 1, and scoping the
market-hours gate to `capabilities.needsMarketHours`.

---

### 4 Sep 2026 - X1 STEP 5 - SEAM 3, SETTLEMENT DISPATCH - BUILT AND PROBED

**Shipped:** `lib/games/settlement.ts` (`routeToTradingSettlement`), mirrored into the
admin app, and called from **all four** finalize functions. Plus the deferred step-4 drift
closed and the game label threaded into every ranking call.

**Dispatch is inside the four functions, not at the twelve call sites.** Re-confirmed by
grep: 7 callers of `finalizeCompetition` and 5 of `finalizeChallenge` in the main app
alone, one of them a page component. Four dispatch points make every caller correct by
construction, including ones nobody has written yet.

**Three things the implementation had to get right:**
1. **Gate before the lock, and release it if the gate is reached after.** Three of the four
   paths claim the contest by setting status to `finalizing`. Refusing without restoring
   `active` **strands the contest permanently** - no later attempt can claim it and it
   never pays out at all, which is worse than the bug being guarded against. The main-app
   wrappers gate *before* the retry loop so a refusal touches nothing; the private attempt
   functions carry a second check that restores `active`.
2. **The two refusals are distinct.** `unknown_game` means the data or registry is wrong
   and somebody must look. `no_settle_path` is the **normal** state for a provider contest
   until X5, and must not read as corruption.
3. **The router consults no flags and touches no database.** A contest players paid to
   enter must finish even if an operator disables the game mid-run - chapter 18 s6. A test
   asserts the file never imports `getEnabledGameTypes` or `assertGameEnabled`.

**The admin `finalizeCompetition` is structurally different** and it would have been easy
to paste the wrong shape: it has **no retry wrapper and no optimistic lock**, loading the
competition inside a transaction instead. Its gate therefore sits after the status check
and aborts the transaction. **Read each of the four before editing them** - they are not
four copies of one function.

**A read path was quietly wrong and is now fixed.** `getCompetitionLeaderboard` in both
apps called `calculateRankings` **without** the game label. Being a read path it is
correctly *not* gated - a leaderboard must render for any contest - but without the label
it would rank a provider contest by trading PnL, which every participant has as zero: no
error, no empty state, just a leaderboard that is quietly wrong. **Exactly the
trading-shaped-service failure from X13.** Fixed at all four `calculateRankings` call
sites; the main app's needed `gameType` adding to its `.select()` projection, which `tsc`
caught.

**Money paths swept:** `distributePrizesWithTies` has only the two settlement callers, both
now gated. No fifth settlement path exists.

**Also closed:** the deliberate drift from step 4. `apps/admin/lib/services/competition-ranking.service.ts`
now dispatches through the registry too. Diffing the two copies showed a **66/97-line
difference** that turned out to be **console logging only**, including one extra
`getRankingValue` call that exists purely to log the value - not different ranking logic.
Worth knowing before assuming the copies are interchangeable.

**Files touched:** `lib/games/settlement.ts` (new) and its admin mirror, all four
finalize action files, both `competition.actions.ts` copies, both ranking service copies,
`apps/admin/lib/games/**` (6 files, byte-identical mirror),
`__tests__/services/settlement-dispatch.test.ts` (19 tests).

**Verified:**
- Golden baseline **byte-identical** - seam 3 changed no trading payout
- Full suite **357 tests in 27 files**, up from 338 in 26
- Main typecheck **18**, admin **225** - both exactly the baselines
- Lint **0 problems** on every touched file
- `check:mirrors` green, 75 models
- **Probed:** deleting the admin competition dispatch turned the gate test red. **The
  probe also improved a test** - the "dispatches on the game label" assertion matched the
  bare name, so the leftover *import* satisfied it with no gate present. Now matches
  `routeToTradingSettlement(` with the paren, so only a real call passes
- A test asserts `lib/games` is **byte-identical** in both apps, since `check:mirrors`
  covers models only and would never notice these two copies diverging

**Next chat should:** step 6 - the Game Master raw-driver insert must stamp the game label
(R7), ESLint `no-restricted-imports` to enforce invariant 1, and scope the market-hours
gate to `capabilities.needsMarketHours`.

---

### 4 Sep 2026 - R30 CLOSED - THE PLATFORM FEE UNIT

**Shipped:** `distributePrizesWithTies` takes `platformFeeFraction`, not
`platformFeePercentage`, and range-checks it. Done in both apps, as a standalone change
rather than folded into a test commit, because it is a money path. Owner asked for it
before seam 3.

**What the bug was:** the function computes `grossPrize * (1 - fee)`, so it needs `0.1` for
a 10% fee. Passing `10` made the multiplier `-9` and assigned every winner a **negative
prize** - silently, because a negative payout reads as a credit adjustment in the
platform's favour rather than a crash. **Live payouts were never wrong**; both callers
divided by 100 first. State it as a naming defect that produced a real bug the moment
anyone trusted the name - which is what happened while building the step 2 baseline.

**Why the guard is safe to add at all:** both the competition and challenge schemas cap
`platformFeePercentage` at `max: 50`, so a correctly converted fraction is at most 0.5.
**The guard cannot reject valid data** - anything above 1 is a unit error by construction.
It throws rather than clamps: aborting finalization is retryable, paying negative prizes
is not.

**THE RENAME FOUND A SECOND BUG, and this is the part worth carrying.** The local variable
in both `competition-end.actions.ts` copies was *also* named `platformFeePercentage` while
holding a fraction, and it was read in **two more places** beyond the call -
`actualPlatformFee = prizePool * fee` and `unclaimedNet = prizePool * (1 - fee)`. Both were
correct code wearing the wrong name. Renaming only the declaration left two references
pointing at a name that no longer existed, and `tsc` reported
`TS2304: Cannot find name`. **Sweep for the old name after any rename and read every hit** -
the compiler catches the references that break and says nothing about the ones that still
compile and now mean something different.

**Swept and confirmed unaffected:** challenge finalization uses
`challenge.platformFeeAmount`, an absolute amount, and only renders `platformFeePercentage`
into display strings beside a `%`. No confusion there.

**Files touched:** both `competition-ranking.service.ts` copies (rename + guard), both
`competition-end.actions.ts` copies (local variable and its two other readers),
`__tests__/services/platform-fee-unit.test.ts` (new, 19 tests),
`__tests__/fixtures/ranking-scenarios.ts` and `tools/games/*` (comments and the harness
type).

**Verified:**
- Golden baseline regenerated **byte-identical** - the rename and the guard changed no
  ranking and no payout
- Full suite **338 tests in 26 files**, up from 319 in 25
- Main typecheck **18**, admin typecheck **225** - both exactly the baselines
- Lint 0 errors. The 14 warnings across the two ranking services are **pre-existing**,
  7 identical in each copy, all in the tie-tracking loop that was not touched
- **Probed:** deleting the guard turned 8 of the 19 new tests red

**Still open, deliberately:** the parameter is fixed but the *stored field* is still
`platformFeePercentage` on both contest models, which is correct - it genuinely holds a
percentage. The two names now differ by design, and the conversion sits at the call site
with a comment saying so.

---

### 4 Sep 2026 - X1 STEP 4 - SEAM 1, THE RANKING SWITCH - EXTRACTED

**Shipped:** the two metric switches moved out of
`lib/services/competition-ranking.service.ts` into `lib/games/trading/scoring.ts`, reached
through the registry. The engine keeps everything that is the same whatever the game -
qualification, sorting, tie detection, rank assignment, prize distribution - and no longer
knows what a score means.

**Moved, not rewritten.** Same cases, same order, same `9999` profit-factor sentinel, same
negations for "fewer trades" and "earlier join". Verified against the original line by line
rather than from memory.

**Proof it changed nothing, which is the entire point of step 2 existing:** the golden
baseline stayed green **without regeneration**, and regenerating it after the extraction
produced a **byte-identical file** (SHA-256 `826EE2D9...`). Ranking and payouts are
provably unchanged.

**Three design points:**
1. **`RankableParticipant` makes every game-specific metric optional.** The old
   `ParticipantData` was entirely trading-shaped, so a second game could not be ranked
   without faking trading fields or branching on game type. `ParticipantData` is
   structurally assignable to the new interface, so **nothing on the trading path changed
   to adopt it**. The trading module reads `?? 0`, which cannot alter behaviour because all
   six fields are `required` with numeric defaults on both participant models.
2. **`options.gameType` is optional and absent means trading**, so all pre-X1 callers keep
   their exact behaviour untouched. Invariant 5.
3. **`calculateRankings` THROWS on an unknown game type.** Deliberate, in a function with
   no error channel: the alternative is falling back to trading, which reads every provider
   score as zero, ties the field at rank 1 and splits the pool between players who did not
   win it - silently, with the page still rendering. **Aborting finalization is
   recoverable; paying the wrong people is not.** Callers are server actions that already
   catch and return `{ success: false }`. Note this is not in tension with
   `assertGameEnabled()` never throwing - that one answers a *question*, this one is asked
   to *rank* and cannot decline.

**Files touched:** `lib/games/types.ts` (added `RankableParticipant` and the two scoring
functions to the contract), `lib/games/trading/scoring.ts` (new),
`lib/games/trading/index.ts`, `lib/games/registry.ts` (`getGameModuleOrTrading` moved here
from `index.ts`), `lib/games/index.ts`, `lib/services/competition-ranking.service.ts`.

**Why `getGameModuleOrTrading` sits in `registry.ts` and not `index.ts`:** `index.ts`
reaches for the database to read `enabledGameTypes`, and this is called from inside a sort
comparator. A pure ranking function must not drag a database import in behind it. The
second reason is stronger: **ranking and settlement must never check whether a game is
enabled**, or disabling a game mid-contest would strand entries players had paid for.

**DELIBERATE DRIFT, recorded rather than left silent:** `apps/admin/lib/services/competition-ranking.service.ts`
**still carries the old inline switches.** The two apps are behaviourally identical today
because trading is the only game, so nothing is broken - but they are no longer the same
code, and `check:mirrors` covers models only and will not say so. **Step 5 must mirror
`lib/games/` and this service together**, and until it does, a change to one ranking path
must be made to both.

**Verified:** full suite **319 tests in 25 files**, main typecheck **18** and admin
typecheck **225** - both exactly the baselines. Lint clean on `lib/games`; the 7 warnings
on the ranking service are **pre-existing** in the tie-tracking loop, confirmed by diff
line ranges - my edits stop at line 286.

**Next chat should:** seam 3 - dispatch inside `finalizeCompetition` and `finalizeChallenge`
in both apps, and mirror `lib/games/` into the admin app as part of it.

---

### 4 Sep 2026 - X1 STEP 3 - THE GAME MODULE REGISTRY - BUILT AND PROBED

**Shipped:** `lib/games/` - `types.ts` (the contract), `registry.ts`, `index.ts` (the
public entry point), and `trading/` declaring trading as a module. Plus `enabledGameTypes`
on `WhiteLabel` in **both apps**, which `assertGameEnabled()` needs a real source for.
**Nothing calls any of it yet**, so it remains additive.

**Files touched:** `lib/games/{types,registry,index}.ts`,
`lib/games/trading/{index,config}.ts`, both `whitelabel.model.ts` copies,
`__tests__/services/game-registry.test.ts` (18 tests).

**Three design decisions worth not reversing:**
1. **`getGameModule()` returns `undefined` for an unknown game type and does NOT fall back
   to trading.** A fallback would read as defensive programming and be the opposite:
   settling a provider contest with trading code reads every score as zero, ties the whole
   field at rank 1 and splits the pool between people who did not win it, silently.
   **Absent and unknown are different facts** - `resolveGameType()` maps absent to trading
   (invariant 5, covering pre-X1 documents and the R7 raw-driver insert) while unknown
   stops the caller.
2. **`assertGameEnabled()` returns a result object and never throws**, matching both the
   chapter and the codebase convention. A throw reaches the player as "An error occurred
   in Server Components render" because Next.js strips thrown messages in production.
3. **`getEnabledGameTypes()` treats an empty array as unconfigured, not as "all games
   off"**, and falls back to trading if the settings read fails. A misconfiguration that
   silently disables every contest is worse than one that leaves the platform as it was.
   Its docblock also states where it may **not** be used - any stats or leaderboard read
   path - because that is risk **R29**.

**Deviated from plan:** the chapter says `lib/games/` is mirrored at `apps/admin/lib/games/`.
**Deliberately not done yet.** The admin app needs it when its own `finalizeCompetition`
dispatches, which is step 5; creating an unused second copy now means two copies drifting
through steps 4 and 5 with nothing exercising the second. `check:mirrors` covers models,
not `lib/`, so the mirror would be unguarded in the meantime.

**Verified:**
- 18 new tests; full suite **319 tests in 25 files**, up from 301 in 24
- Main typecheck **18**, admin typecheck **225** - both exactly the measured baselines,
  with nothing new and nothing vanished
- Lint clean on `lib/games`, which caught two real problems: an unused import, and
  **Next.js forbidding a variable named `module`** (`no-assign-module-variable`). The
  result field is therefore `gameModule`, not `module` - worth knowing before writing the
  provider module, since the obvious name is the banned one
- `check:mirrors` green, 75 models, 0 drifted
- **Probed:** making `getGameModule()` fall back to trading turned exactly 2 tests red,
  at both the registry and the gate. Reverted

**Next chat should:** seam 1 - move the ranking switch into `lib/games/trading/scoring.ts`
and generalise `ParticipantData`. The golden baseline from step 2 is the gate; it must
stay green with no regeneration.

---

### 4 Sep 2026 - X1 STEP 2 - THE REGRESSION BASELINE - BUILT AND PROBED

**Shipped:** the acceptance gate from `11` section 4, in two halves, both captured
**before** any extraction. That ordering is the entire value: a baseline recorded after
the move would freeze whatever the new code does, bugs included, and pass for ever.

| Piece | Runs | Size |
|---|---|---|
| `__tests__/services/ranking-regression.test.ts` + `__tests__/fixtures/ranking-golden.json` | CI | 22 tests, 18 scenarios |
| `tools/games/replay-historical-rankings.ts` | Owner, on the server. **Read-only** | Before and after, compared |

The matrix exercises every branch that decides money - six ranking methods, both tiebreak
paths, a true tie, each disqualification reason, the profit-factor divide-by-zero, the
sub-epsilon boundary, unclaimed-position redistribution, all-disqualified, and empty.

**Two assertions are about the matrix rather than the code**, because a broad baseline can
still prove nothing: the six ranking methods must produce **different** orderings, and no
scenario may overpay its pool or pay a negative prize.

**Files touched:** `__tests__/fixtures/ranking-scenarios.ts`,
`__tests__/fixtures/ranking-golden.json`, `__tests__/services/ranking-regression.test.ts`,
`tools/games/generate-ranking-golden.ts`, `tools/games/ranking-golden-shared.ts`,
`tools/games/replay-historical-rankings.ts`.

**Deviated from plan:** the chapter specifies replaying historical competitions. That
cannot run in CI, so it became the owner-run half and a synthetic matrix became the CI
half. The generator is a **script, not part of the test run** - if the tests regenerated
their own baseline they would agree with themselves for ever, and regenerating should show
up in review as a changed golden file, since it means award behaviour is being altered.

**Verified:**
- 22 new tests green; full suite **301 tests in 24 files**, up from 279 in 23
- Typecheck back to exactly **18**, the measured baseline
- Lint **0 errors, 0 warnings** on all new files, including the two
  `security/detect-object-injection` warnings fixed rather than bypassed, because the
  pre-commit hook allows none
- **Probed:** changing `case "roi"` to return `pnl` turned exactly one scenario red,
  naming the scenario and the cause. Reverted, and the service confirmed byte-identical
  to HEAD afterwards

**One real finding, and it came from walking into it rather than from reading the code.**
`distributePrizesWithTies` names its parameter `platformFeePercentage` and then computes
`1 - platformFeePercentage`, so it needs a **fraction**. The first draft of the matrix
passed `10` and every fee-bearing scenario produced **negative prizes** - visible only
because the totals were printed and read. **Live payouts are correct**: both callers
divide by 100 first, so this is a naming defect, not a money defect, and nothing needs
backfilling. It matters because **X5 adds a third caller** written from the signature.
Recorded as **R30**, with the rename deliberately deferred - a money-path rename deserves
its own review rather than riding along in a test commit.

**The general lesson worth carrying:** the harness found this, not the audit. Building a
matrix that must produce *plausible numbers* forces you to read outputs you would
otherwise only assert equality on. **Print the totals in a money baseline and look at
them** - equality against a wrong baseline is silent.

**Next chat should:** create `lib/games/` - `types.ts`, `registry.ts`, `index.ts` with
`getGameModule()`, `assertGameEnabled()` returning a result object and never throwing.
Nothing calls it yet, so it stays additive.

---

### 4 Sep 2026 - X1 STEP 1 - GAME LABEL AND SCORE ON ALL FOUR MODELS - BUILT

**Shipped:** the additive half of seams 1 and 2. `gameType` and `gameKey` on
`Competition` and `Challenge`; `score` and `gameKey` on `CompetitionParticipant` and
`ChallengeParticipant` - **eight files, both apps, one commit.** All default to
`"trading"` / `0`, so every existing document and every current writer stays valid and
**nothing reads the new fields yet.** Zero behaviour change by construction.

**Files touched:** the four models under `database/models/trading/` and their four
mirrors under `apps/admin/database/models/trading/`, plus
`__tests__/services/game-label-and-score.test.ts` (14 tests).

**Deviated from plan:** defaults rather than `required`. Invariant 5 wants a missing
label to mean trading, and during a rolling deploy old code writes contests with no label
at all - `required: true` alone would have rejected those writes outright.

**Verified:**
- `npm run check:mirrors` - 75 mirrored models, **0 drifted**
- Typecheck **18 errors before and 18 after**, measured by stashing the change rather
  than by reasoning about it. None in the touched files, and **none disappeared** - a
  vanishing error marks code that was already reaching for a field its schema denied it
- Full suite **279 tests in 23 files, all green**
- **Both halves probed:** renaming `score` to `scoreTYPO` turned exactly 3 tests red with
  a message naming the cause, then reverted

**Two plan corrections found, and the second changes the design:**
1. **Seam 1 is bigger than "a single function".** The switch near line 95 is not a
   duplicate of the ranking switch - it is `getTieBreakerValue`, a second trading-specific
   switch. And `ParticipantData` is *entirely* trading-shaped, so the seam is the
   interface plus two switches.
2. **Finalization has ten call sites in the main app, not five.** Three were missing from
   the chapter - both `early-end-check` calls, `claim-early-end`, and a **finalize invoked
   from a page component**. `POST /api/finalize-old-competitions` **does not exist.** This
   is Defect 1 repeating: the plan said two entry paths and grep found four. **Count the
   writers.** The consequence: dispatch goes **inside** the two finalize functions rather
   than at each call site, so every caller - including ones not yet written - is correct
   by construction. Four dispatch points instead of ten and rising.

**Deferred:** the backfill of `gameType`/`gameKey` on existing contests. Not needed yet,
because the defaults make a missing value read as trading; it is wanted before any query
filters on game.

**Next chat should:** build the historical regression harness **before touching ranking
or settlement**. It recomputes completed competitions through the new path and compares
against the stored `finalLeaderboard`, and it can only prove the extraction changed
nothing if the baseline is captured while the old code is still in place.

---

### 2 Sep 2026 - PLUG AND PLAY IN BOTH DIRECTIONS - DOCUMENTED, ONE REAL GAP FOUND

**Shipped:** the owner restated the engine vision before X1 starts - provider supplies
games and results, the engine owns entry fees, winner determination, payouts, credits,
stats, status and levelling; trading is one game; players challenge each other; the
leaderboard spans all games; **and a new game must enter every stat and ranking with no
extra code, with the same true in reverse when a game is removed.** Checked every claim
against the documents and the issued provider spec rather than assuming they were covered.

**What was already covered, and verified rather than restated:**
- **The provider's role matches the issued document verbatim.** Section 1 of
  `ChartVolt-Game-API-Requirements.html` already tells providers: *"you send us a signed
  message containing their score. We take care of the entry fees, the prize pool, the
  ranking, the payouts, the leaderboards and the player accounts. You never touch money
  and never see a player's personal details."* It also already names one-against-one
  challenges and cross-game points, ratings, levels, badges and milestones. **No re-issue
  and no version bump needed** - the spec we would hand a provider today is correct.
- **Zero-code addition** - `12` s4 already carries it as an acceptance criterion, `05` s7
  already gives a new `gameKey` its own leaderboard automatically, and the 18 Aug decision
  already holds the title as data behind one module.
- **Enable/disable already exists as a concept** - `enabledGameTypes` on `WhiteLabel`,
  `assertGameEnabled()` in the registry, `chartvoltEnabled` on `provider_game`.

**The gap, and it is the load-bearing part of this entry:** every document described
*adding* a game. **Nothing described removing one**, and the search for it returned a
single unrelated hit about retiring a *metric*. That matters because auto-inclusion and
auto-exclusion are the same mechanism: **if cross-game totals are summed over
currently-enabled games, disabling a game silently subtracts everything earned in it** -
a player who reached level 12 partly through a provider game is demoted to level 9 when an
operator switches it off, with no error, no log and no notification. Its likelihood is
High precisely because summing the enabled set is the *natural* implementation: it reads
correctly, passes review, and is only wrong on the day someone toggles a flag, months
later and far from the author.

**Files touched:**
- `05-scoring-points-and-rewards.md` - new section 11. s11.1 states the boundary of "no
  additional coding" honestly (a new **title** is data-only; a new **provider** needs an
  adapter; a new in-house **game type** needs a module), s11.2 gives the single rule that
  preserves auto-inclusion - **no aggregate may enumerate game types in code** - and s11.3
  gives the three removal rules.
- `17-risk-register.md` - risk **R29** under high *platform* risks, owned by **X1** rather
  than X7, because the decision that prevents it is made when the totals are first
  written. **Filed as R-series after initially writing it as X19** - the X-series is
  defined as risks that exist *only* because a third party is on the critical path, and
  this one applies whoever supplies the games, trading included. R28 was then also wrong,
  being taken by the fraud read-then-create races; **R1-R28 are all in use.**
- `11-foundation-and-seams.md` - **invariants 8 and 9** in section 5, plus a
  done-when criterion. This is the chapter X1 is built from, so it is the placement that
  actually changes what gets written.
- `PROGRESS.md` - two decisions on record.

**Deviated from plan:** nothing built. This was deliberately a documentation pass, because
the owner has not said start and the correction belongs in the plan X1 will be built from.

**Deferred:** the two open questions this touches are unchanged and still not blocking -
whether cross-game rank is one number or several (13), and whether historical trading
performance is backfilled into cross-game aggregates (14). Question 14 now matters
slightly more, since s11.3 makes earned progression an append-only ledger and a backfill
is therefore a one-time write rather than a recomputation.

**Next chat should:** wait for the owner's go-ahead on **X1**, then build it with the two
constraints from `05` s11.4 held from the first commit - totals **accumulate on
settlement**, and `getEnabledGameTypes()` never appears in a stats or leaderboard read
path. Building either the other way turns the fix into a migration over every player's
progression.

---

### 2 Sep 2026 - X6 (partial) - ADMIN NAVIGATION RESTRUCTURED - BUILT, AWAITING OWNER TEST

**Shipped:** the navigation half of `12` section 1 and all of section 1.1. The admin
sidebar no longer has a "Trading" group that mixes contest administration with trading
screens. `competitions`, `challenges` and `analytics` are now a **CONTESTS** group;
the six trading screens are children of a single collapsible **Trading** destination
inside a new **GAMES** group; and a tab strip above every trading screen lets an operator
move between the six without returning to the sidebar.

**Files touched:** `apps/admin/components/admin/AdminDashboard.tsx` (menu configuration
and one render site; +82/-47), new `apps/admin/lib/admin/game-sections.ts`, new
`apps/admin/components/admin/trading/TradingSectionTabs.tsx`, new
`__tests__/admin/trading-section-nav.test.ts` (9 tests).

**Deviated from plan, three times, and the first is the one to argue with:**

1. **This is X6 work done before X1, and — at the time it was written — before Stage 0
   sign-off.** *Resolved the same day: the owner signed Stage 0 off on 2 September 2026,
   so the gate concern below is now historical. It is left on record because the judgement
   was made without it, and the reasoning is what would be reused next time.* The stated gate is
   that Track B engineering waits on X0. The judgement was that *this particular slice* is
   the only part of X6 with **no dependency on the foundation at all** - it reorganises
   screens that already exist and adds no field, model, service, route or server action -
   and that it is confined to the admin process, which has no player traffic. **What it
   does not license:** anything that writes data, anything touching the money layer, and
   anything in X1-X5. If the owner would rather nothing shipped before X0 sign-off, this
   reverts cleanly - it is one component's menu configuration plus two new files.
2. **There is no TRADING group; trading is a destination inside GAMES.** A top-level
   TRADING group beside a GAMES group would have re-stated the thing the restructure
   exists to remove. `12` section 1's table was corrected.
3. **The tab bar is rendered once beside `renderContent()`**, not inside the six cases.
   Zero edits to the six section components, which is what caution 3 asks for.

**Two errors in this folder's own plan, found by reading the menu instead of trusting it.**
`12` named an **Arsenal** tab that is not an admin section - `TradingArsenalContext.tsx` is
chart tooling with no `menuGroups` entry and no `ADMIN_SECTIONS` id - and it **omitted
`market-data`**, which is a real trading screen. Separately, `analytics` was filed under
Trading but renders `CompetitionAnalytics`, so it is contest analytics and moved to
CONTESTS. **Classify a section by the component it renders, never by the group it sits in**
- when the group's name is the thing being corrected, that name is the least reliable
evidence available.

**Both hard requirements needed no new mechanism, which is the finding worth carrying.**
The plan warned that tab state must be addressable and that RBAC must stay per-section.
Both were already true: sections are driven by `?activeTab=<sectionId>`, so reusing
section ids as tab ids preserved every deep link untouched; and `filteredMenuGroups`
already shows a parent only when `children.some(hasAccess)` and filters children
individually, which is exactly per-tab gating, already proven by `settings` and
`dev-zone-menu`. **`ADMIN_SECTIONS` was not edited at all** - all six ids were already
there, and it is a Mongoose enum on stored employee permissions, so it is add-only.
`trading-menu`, the parent, is deliberately **not** a section: a grant that maps to no
screen is where privilege widening starts.

**Owner tested: PASSED, 2 September 2026.** The owner tested the restructured admin
sections and reported them working. This is a separate sign-off from Stage 0's, taken the
same day.

**Verified by build, not by assertion:** `next build` of the admin app succeeded;
`tsc --noEmit` returned **225 errors, matching the documented baseline exactly**, with
none in the changed files and none *disappearing* (a disappearance would mark code that
was reaching for something it could not have); eslint clean on all three files; 9 tests
green. **Both test halves were probed by reintroducing the defect** - restoring
`trading-risk` under Settings turned exactly 1 test red, removing a tab from the shared
list turned 2 red - because a test that has never failed proves nothing.

**Deferred:** making sidebar navigation write the URL. `handleMenuClick` sets state
without touching the address bar, so deep links work inbound but the URL does not track
the current section. That is pre-existing, affects all ~60 sections, and belongs with
X6.5. The `tradingEnabled` conditional that hides the whole destination also waits for
X1, which is where the flag is introduced.

**Next chat should: wait for the owner's go-ahead before starting X1.** Owner instruction,
2 September 2026: they will say when X1 begins. Stage 0 is signed off and this change is
tested, so nothing is *blocking* X1 - the hold is a deliberate one, not a dependency.
**Do not begin the foundation unprompted.**

---

### 2 Sep 2026 - EXTERNAL-ONLY DECIDED, admin-first sequencing, four additions to scope - DOCUMENTED

**The scenario question is closed.** External games only; no in-house game is built. That
was the single blocking decision in this folder, and chapters `10`-`20` are now the
operative plan rather than a contingency.

**Owner brief, in their order:** admin first and one step at a time so the running app is
never broken; an admin area where games are added easily; trading demoted to one game with
all its administration collected into a single section; games registered like payment
providers with rules and credentials; admin wording de-trading-ised; scoring, its naming,
its calculations, finances, badges and journey elements all made to cover every game -
"a general competition engine, not only for trading". Then the player side: naming, stats
and stat calculation, leaderboard, profile; games visible on the dashboard with a full page
per game; per-game competition browsing with filters; challenges against any user in any
game; and smart onboarding that matches players by the games they want to play.

**Four things in that brief were genuinely not in the plan**, and separating them from the
things that only *looked* new is the main value of this pass:

1. **Smart onboarding and interest matchmaking - nothing at all.** Searched the whole
   folder for onboarding, matchmaking, game interest and player preference: no matches.
   New chapter `20`, new phase X11.5, 2-3 weeks.
2. **"Challenge any user" was never specified.** `03` section 2 designs multi-game
   challenge *mechanics* thoroughly, then describes the opponent as "invited or matched"
   and stops. An opponent picker and open challenges are new, and they drag in a decline
   path, a block list and a rate limit - without those, letting anyone challenge anyone is
   a harassment vector. X10 grew from 0.5-1 week to 1-1.5.
3. **A player profile specification.** Dashboard, leaderboard and `UserGameStats` were all
   designed; the profile itself only ever appeared as "terminology pass 6".
4. **The admin wording pass was in the wrong phase.** It sat in X8, after the player UI,
   which would have had operators running a multi-game platform through screens labelled
   "trading" for two whole phases. Split into X6.5 (admin) and X8 (player).

**Everything else in the brief was already designed**, and is now cross-referenced rather
than rewritten: the admin navigation grouping with a TRADING group (`12` s1), provider
registration and credentials (`04` s3.1, `12` s4-s6), the catalogue as editable content
(`16` s1), cross-game scoring in three layers (`05`), financials by game and provider
(`12` s5), game pages and filtered browsing (`16`, `13` s4), and the terminology token
layer (`14`).

**Two corrections made while writing this up**, both from checking a claim rather than
accepting it:

- **"Like payment providers" is right about the UX and wrong about the storage.** The
  existing `payment-provider.model.ts` embeds `credentials[]` directly in the document and
  carries a `saveToEnv` flag with a `regenerate-env` route that writes secrets to `.env`.
  `04` section 3.1 deliberately keeps game credentials *out* of `game_provider` so admin
  screens can read it freely. Copying the pattern wholesale would have undone that on
  purpose-looking grounds. Recorded in `12` section 4.
- **Admin-first does not mean X6 before X1.** It reorders work inside X6/X7 and after. A
  provider contest has to exist before there is anything to administer, so the foundation
  still comes first; what admin-first buys is that the player UI in X7 is built against
  data produced by real operator actions instead of fixtures.

**Files touched:** `PROGRESS.md`, `00-README.md`, `10-external-only-programme.md`,
`12-admin-panel-plan.md`, `13-user-ui-and-routes.md`, `03-competition-and-challenge-flows.md`,
`05-scoring-points-and-rewards.md`, `14-terminology-and-wording.md`, `17-risk-register.md`,
`18-migration-testing-rollout.md`, new `20-onboarding-and-matchmaking.md`, both HTML
versions, plus `New games plan/PROGRESS.md` and `.cursor/rules/games-plan-docs-sync.mdc`.

**Deviated from plan:** the X-phase total moved from 20-26 weeks to **23-30**. That is ~3
weeks of new scope, not a re-estimate. Do not let a summary present it as the same
programme.

**Owner tested:** n/a - documentation only. No code was written.

**Deferred:** four new open questions (13-16) that are product or owner calls and do not
block X1: whether cross-game rank is one number or several, whether trading history enters
the new aggregates, who may be challenged, and whether interests are collected at
registration. Question 10 - an in-house hedge game - is **raised in priority**, because
external-only removes the fallback that made it optional.

**Next chat should:** wait for Stage 0 sign-off, then start X1 (`11`). Nothing in this
folder is blocked on engineering; the blocker is commercial - a provider.

---

### 1 Sep 2026 - X0 started in the other folder; four restated facts corrected - DOCUMENTED

**Trigger:** the owner started Stage 0 / X0. Re-verifying the two defects before touching
code corrected several facts this folder **restates** from the `New games plan`, which the
sync rule requires propagating rather than leaving to diverge.

**Shipped:** nothing from this folder. No provider work has begun and no scenario has been
chosen. One live security fix shipped from the Stage 0 work - commit `d5d3a328`, simulator
route authentication - recorded here only because the class of defect applies to the
provider webhook this plan specifies.

**Facts corrected (all were restatements of `New games plan` sources):**

| Was | Is |
|---|---|
| ~21 mirrored files, 3 drifted | **75 mirrored model files, 11 drifted.** Plus 19 action and 51 service files duplicated. There were also **112 stale committed declaration files** (57 `.d.ts` + 55 `.d.ts.map`) - all deleted 1 Sep 2026, and never a real third copy since TypeScript ignored them |
| Mirror drift means "the admin cannot see the field" | **Wrong as stated, measured 1 Sep 2026.** `.lean()` and `toObject()` do not hide the field, and an ordinary `save()` does not strip it. Drift is **write-side**: a missing *enum value* rejects the write outright, and the narrower app cannot write the field at all - silently, while reporting success. The one exception is real and severe: **ordinary `doc.field` access reads `undefined`**, which is how three admin routes lost the ability to restore branding images after a redeploy |
| The finalize-time safeguard masks the prize-pool gap | It does **not**. It only fires when the pool is too *high*, so an under-counted pool is under-distributed with no correction and no log |
| Two competition join paths | **Four** entry writers, one of which has no callers. Also the challenge *accept* path skips restriction and fraud checks, on a route real players use |
| Stage 0 is 5-8 days | **6-9 days** |

**Files touched:** `17-risk-register.md` - R1 and R2 rewritten, **R27 added** for the
header-as-authentication defect with the two rules it implies for the provider callback
(never accept a request because configuration is missing; test the route, not just the
helper). `18-migration-testing-rollout.md` section 2 - real mirror counts, the enum-value
requirement, the allowlist requirement, the add-only rule, and the fact that the husky
`pre-push` hook does not exist yet. This file - status, both phase tables, this entry.

**Deviated from plan:** X0's estimate rose by a day, and X0 is no longer purely inherited
from the other folder - it now contains a shipped item that was never planned.

**Owner tested:** nothing yet. `d5d3a328` needs deploying first.

**Deferred:** everything in this folder, unchanged. The scenario decision is still open and
is still the thing that gates all of it.

**Next chat should:** ignore this folder and continue X0 in `New games plan/PROGRESS.md`,
starting with the test-database decision and then Defect 2. Come back here only when the
scenario decision is made.

---

### 30 Aug 2026 - Contest formats clarified, Game Masters given a chapter - DOCUMENTED

**Trigger:** the owner read "solo-scored" as "solo contest" and asked for competitions with
two or more players sharing a pool, challenges one against one, and Game Masters working on
the new games exactly as they do for trading.

**The first half was a naming failure, not a design gap.** The plan already had exactly the
two formats asked for. "Solo-scored" described *gameplay* - each player plays their own
round rather than needing a live opponent - and was read as *contest size*. The clearest
demonstration that these are different things: **trading is itself an independent-play
game.** Every trader trades their own account, alone, and they are all ranked against each
other for a share of one pool.

**Renamed throughout, 80 lines across 18 files:**

| Old | New | Why |
|---|---|---|
| `solo_scored` / "solo-scored" | `independent` / "independent play" | "Solo" caused the misreading |
| "duel" | "challenge" | The codebase has a `Challenge` model, `/challenges` routes, `challengesEnabled`, `challenge_entry` and `challenge_refund` ledger entries. "Duel" existed nowhere in the product and `04` even described a non-existent "Duel model" |
| `supportsDuel` | `supportsOneVsOne` | Provider-facing field. Free to change while no provider is signed |
| `03-competition-and-duel-flows.md` | `03-competition-and-challenge-flows.md` | Filename followed |

**New content:**

- **`03` section 0, before anything else** - no paid format is ever single-player.
  Competition means two or more, challenge means exactly two, practice is the only
  one-player mode and it is free and unranked. Cites the existing `minParticipants` default
  of 2 and the existing auto-cancel-and-refund at `competition.actions.ts` lines 71-134, so
  this is **reused rather than built**
- **`03` section 1.4** - separates minimum *players* from minimum *play*, and adds the edge
  case neither covers: three join, one plays. Two policies, both on existing money paths
- **`19-game-masters.md`, new chapter** - see below
- `00-README.md` - an "independent play is about gameplay, not contest size" section

**Game Masters were badly under-scoped.** `16` section 3 called them "four smaller items,
roughly three to four days". Verified against the code, the system is three dedicated
collections, 28 API routes, three subscription tiers, a referral attribution chain, a daily
renewal worker job and **two separate earning paths** at competition and challenge
finalization. `19` replaces that section. Real figure **~2.5 weeks**, distributed through
X1, X6, X7 and X8 rather than being its own phase.

**Three findings from reading the code that the plan did not have:**

1. **A Game Master earns from referred players' entry fees in any contest, not from
   contests they created.** Creating competitions is how they attract referred players; it
   is not the revenue event. A plan built on the opposite assumption would have been wrong
   throughout
2. **`app/api/gamemaster/competitions/route.ts` inserts with the raw MongoDB driver and
   sets no game label** (lines 170-466). This is risk R7, and this is where it bites: an
   unlabelled competition reads as trading and gets settled by trading code, paying the
   wrong players. Promoted to a **gate inside X1**, not a task
3. **`apps/admin/lib/actions/trading/competition-end.actions.ts` has no Game Master
   earnings logic at all** - only `isGmCreated` on platform-fee recording at line 709. A
   competition finalized through the admin app pays **no Game Master earnings**. A live
   defect, unrelated to this project, now recorded

**And one genuinely new commercial problem, `19` section 5.** A provider charges per round;
the Game Master share is a percentage of the **entry fee** taken before that cost exists;
and the existing cap is against **gross** platform fee. Worked example: 20 players at 1.00,
10% tier, 2c per round - platform fee 2.00, Game Master share 2.00, provider cost 0.40,
**platform result -0.40**. Trading never had this because a trading round costs nothing.
Decision recorded: `limits.allowedGameTypes` defaults to `["trading"]`, so Game Masters
**earn** from provider contests immediately but cannot **create** one until the share is
computed on net fee after provider cost.

**Totals revised: 20-26 weeks, from 18-24.** X1 to 2.5-3.5, X6 to 3-3.5, X7 to 3-4. Also
separated engineering from calendar on the shortest useful path - nine to eleven weeks of
engineering, 11-14 in calendar terms, because X4 onward waits on sandbox access. The old
figure conflated the two.

**Files touched:** all 19 chapters plus `PROGRESS.md`, both HTML documents, and
`.cursor/rules/games-plan-docs-sync.mdc`.

**Next chat should:** still answer open question 0 - add-on or external-only. Nothing here
changes that decision; it makes the external-only figure honest.

---

### 30 Aug 2026 - Folder made self-contained for the external-only scenario - DOCUMENTED

**Shipped:** nine new chapters, `10` to `18`. Chapters `01`-`09` were written assuming the
`New games plan` delivers Stage 0, the game-module foundation, an in-house proof game and
every platform-wide change. If provider games are the **only** new games, that assumption
fails and the dependency moves into this folder. It now lives here:

- `10-external-only-programme.md` - scenario definition, what genuinely changes, the
  self-contained **X0-X12** plan (20-26 weeks), the shortest useful path (X0-X5 plus a
  minimal X6, 11-14 weeks), six scenario-specific risks, and what is lost by having no
  in-house game
- `11-foundation-and-seams.md` - the four seams, all five finalization entry points, the
  game-module contract, seven architectural invariants, and the historical-competition
  regression test that proves trading is unchanged. Absorbs `New games plan` P1
- `12-admin-panel-plan.md` - navigation, RBAC (including the 8 existing omissions),
  `configSchema`-driven create wizard, analytics by game **and provider**, the new Game
  Performance screen, settings
- `13-user-ui-and-routes.md` - the `/play` dispatcher, the six trading providers that must
  stay scoped, the component move, dashboard, leaderboard, results, help, navigation
- `14-terminology-and-wording.md` - the terminology layer, eleven migration passes, and the
  ten categories of identifier that must never be renamed
- `15-infrastructure-jobs-and-flags.md` - the flag set, ten enforcement layers for
  `tradingEnabled`, price-feed gating, job changes, the dead Inngest crons, observability
- `16-games-catalogue-and-marketplace.md` - the three-way distinction between module,
  provider game and catalogue entry; sync-must-not-overwrite-admin-content; the
  no-pay-to-win rule and its consequence for provider selection; the Game Master
  provider-cost problem
- `17-risk-register.md` - R-series platform risks and **X-series scenario risks**, with
  three gates
- `18-migration-testing-rollout.md` - four backfills, eight test tiers (including a
  **contract tier** unique to this scenario), thirteen rollout steps, rollback per phase

**The finding worth recording:** external-only is **not cheaper**. Dropping the in-house
game saves ~3.5 weeks; a correct provider integration costs ~7; every platform-wide change
is identical either way. 20-26 weeks against 12-17. It buys breadth and removes the content
burden - and it adds a single supplier to the critical path with no fallback game.

**Also updated:** `00-README.md` gains a scenario-selection section at the top, the
extended index, and revised honest-assessment rows. `09-implementation-phases.md` is now
explicitly labelled as the add-on plan and points at `10` section 3. `PROGRESS.md` gains
the open scenario decision, an X-phase status table, five new decisions, five new open
questions, and the revised relationship diagram.

**Deviated from plan:** `10`-`18` cross-reference the `New games plan` chapters rather than
duplicating them wholesale, so the codebase audit does not exist twice and drift twice.
Where a fact is load-bearing - line numbers, the five finalization entry points, the eight
missing RBAC IDs - it is restated here so this folder is readable on its own.

**Owner tested:** N/A - documentation only. No application code changed.

**Deferred:** the illustrated HTML has a summary of the external-only scenario, not full
diagrams for each of the nine new chapters. If external-only becomes the decision, the HTML
deserves the same diagram treatment `01`-`09` received.

**Next chat should:** get the scenario decision recorded at the top of this file. It changes
the programme from 8 weeks to 24, so nothing else should be planned until it is answered.

---

### 30 Aug 2026 - Games-first direction applied to the provider contract - DOCUMENTED

**Shipped:** the owner's games-first direction (recorded in
`../New games plan/15-platform-transformation-and-gaps.md`) has one concrete
consequence for this plan: every provider title becomes a **catalogue entry with its
own page**, so the provider must supply page-quality content, not just a name and a
thumbnail. Propagated:

- `01-provider-contract-specification.md` - new **section 3.1 "Presentation content"**.
  `tagline`, `description`, `rulesSummary`, `howToPlay` and `bannerUrl` promoted from
  optional to **required**; `iconUrl`, `tags` and `screenshotUrls` added. Three
  constraints stated: localised into every declared locale, no provider branding in
  copy, stable cacheable HTTPS asset URLs. Score-affecting in-game purchases declared
  out of scope entirely
- `ChartVolt-Game-API-Requirements.html` - **bumped to version 1.1** with a document
  history table. Same content fields, artwork minimums, the "why we ask for real page
  content" rationale, the no-pay-to-win rule as a conversation-ender, two new
  conformance items, three new product questions and one new commercial question
  (commercial list renumbered from 21, and the pricing callout updated to match)
- `ChartVolt-External-Games-Plan.html` - new "Where a provider game appears to players"
  block in the architecture section

**Deviated from plan:** none. This tightens the provider contract rather than changing
the architecture.

**Owner tested:** N/A - documentation only.

**Deferred:** nothing.

**Next chat should:** unchanged - Stage 0 and Phase 1 in `New games plan` remain the
gate. On the commercial track, the provider questionnaire is now longer and better;
version 1.1 of the requirements HTML is the file to send out.

---

### 18 Aug 2026 - Planning - COMPLETE

**Shipped:** Ten planning documents plus an illustrated HTML version. No application
code changed.

**Deviated from plan:** Written provider-neutral rather than against any specific
candidate, so that `01-provider-contract-specification.md` serves as both our
requirements document and the checklist we assess candidates against.

**Owner tested:** N/A.

**Deferred:** All implementation, and provider selection.

**Next chat should:** Do nothing in code. If the owner wants to progress this, the
next step is **Track A** - send Gate 1 of `08` to candidate providers. Engineering
cannot usefully start until Stage 0 and Phase 1 of the `New games plan` are done.
