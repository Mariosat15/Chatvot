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
   and money layer. Built, awaiting owner test.
2. **X1** - the foundation, owned by this plan. See `11`. No provider needed.
3. **X2** - provider abstraction and a mock adapter. No provider needed.
4. Then the admin programme, per the owner's admin-first sequencing.

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
| **X1** | Foundation: game label, score, registry, four seams, **GM insert game label** | `11` + `19` s3.1 | 2.5-3.5 weeks | `NOT STARTED` |
| **X2** | Provider abstraction + mock adapter | `09` E1 | 1 week | `NOT STARTED` |
| **X3** | Round lifecycle + result ingestion | `09` E2 | 1 week | `NOT STARTED` |
| **X4** | Real adapter against sandbox | `09` E3 | 1 week | `NOT STARTED` |
| **X5** | Contest integration + settlement | `09` E4 | 1 week | `NOT STARTED` |
| **X6** | Admin: nav restructure incl. **the single Trading section**, RBAC, provider registration, game-aware wizard, analytics, **GM creation API + wizard** | `09` E5 + `12` + `19` | 3-3.5 weeks | `PARTIALLY DONE` - nav restructure and single Trading destination **built and owner-tested 2 Sep 2026**. Everything else `NOT STARTED` |
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
