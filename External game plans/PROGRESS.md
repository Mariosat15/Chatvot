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
| **Status** | **SCENARIO DECIDED - EXTERNAL-ONLY** (2 Sep 2026). **X1, X2, X3 and X5 are code-complete; X6 is partially done.** A provider contest can be created, **published from the admin screen** (5 Sep 2026), entered, played and paid - and since 5 Sep 2026 it is paid **correctly**, which it was not before: two P0 defects meant every player tied on a score of zero and split the pool equally, and a lower-is-better game ranked backwards. A stuck round can now be **inspected and ended by an operator** (5 Sep 2026). **The whole lifecycle is now reachable by clicking** - the player round launch screen landed 5 Sep 2026 at `/competitions/[id]/play`, which also fixed a live defect: a provider-contest player was being sent to the forex trading workspace by a button labelled "Start Trading". **No provider selected**, which is what X4 needs |
| **Player screens** | **R37 closed 6 Sep 2026, and it is the one to read first if a provider board looks odd.** Neither app's `getCompetitionLeaderboard` passed `score` or `scoreDirection` to the ranking engine, so **every provider participant tied on zero and the board rendered in tie-break order** - and a lower-is-better title was *reversed on screen while correct at settlement*, so a player could lead all week and be paid last. **Latent for money, live for players:** settlement resolves both fields itself, so no payout was ever wrong and **nothing was backfilled**. Fixed by moving `resolveScoreDirection` out of settlement into a shared mirrored module used by all three consumers. Same day, `RoundPreflight` stopped offering an enabled **Play** button on a contest that had not started. **The lobby page itself is still trading-shaped** - see `13` s4.1a for exactly what is and is not built |
| **Next action** | **Technically: finish X4a** - pull and rebuild on the server, start `chartvolt-games`, register it through the admin screens, and drive one round end to end. **No DNS, nginx or certificate work is needed** since the play surface is proxied through the platform app (owner's choice, 6 Sep 2026). The game is **playable by a human in a browser**, **R34 is closed**, and the service is now **deployable** - PM2 entry, nginx block, `env.example` and a runbook in `deploy/README.md` (all 6 Sep 2026) - so nothing technical stands between the two halves. **Owner decided 6 Sep 2026 to deploy first and rehearse against the live site**, rather than complete the local rehearsal. After X4a: provider **health** (the last of X6's five admin destinations) and the game-aware **contest list and dashboard** (`13` s4/s5), where the remaining trading-shaped player screens live. **Commercially, in parallel: find and assess a provider using `08`** - X4 cannot start without one, and nothing in the programme is blocked on that search |
| **Money defects closed** | **R26 closed 5 Sep 2026** - the admin cron's finalize copy paid **no** Game Master earnings and recorded no `retained_gm_fee` either, so the commission silently stayed with the platform. This one was **actively losing money rather than latent**: both apps run `checkAndFinalizeCompetitions` on an every-minute cron, so payment depended on which cron won the race. **Not retroactive - no backfill**, and past contests cannot be found by querying for retained rows because none were written. Also **R31** (a 0% Game Master rate paid 5%) and the two P0 score defects, same day |
| **Blocked by** | **Nothing technical below X4.** Stage 0 / X0 was signed off 2 Sep 2026. **X4 is blocked on a signed provider**; X6's remaining admin work is not |
| **Phase in progress** | **X4a - STARTED 6 Sep 2026.** `games-service/` (the provider) and the `chartvolt-games` adapter (the platform) are both **code-complete and not yet connected** - no round has travelled between them, and the provider has never been registered through the admin screens. **The game is playable by a human**: the launch URL serves a real board, verified in a browser on both titles, which also fixed a live defect - an unstarted round reported itself as `finished`, so the first screen a paying player saw was a result screen for a round they had not played. It also **found and then closed a defect in the platform's own published auth scheme** (**R34**): there was no `callbackToken` field anywhere, so a provider implementing `Bearer {CALLBACK_TOKEN}` exactly was rejected and logged as a probable attack. Latent throughout, so nothing was backfilled. **Nothing technical now stands between the two halves** - what remains is deploying the service and registering it. It is now **deployable**: a PM2 entry, an nginx block for a `games.` subdomain, `env.example` and a `deploy/README.md` runbook, plus **two production-only boot guards** for the play origin and the frame allowlist, both of which previously failed invisibly. Writing the runbook also found that the admin panel **could not register a loopback provider at all**. See the three 6 Sep work-log entries |
| **Next phase, scope decided** | **X4a - ChartVolt as a first-party provider, with a real playable game** (`21`), **3.5-5 weeks**, starting before the provider health panel. It exists because **the review gate the programme is sequenced around cannot currently be held**: `mock.adapter.ts` returns a hostname that does not resolve, so the play screen's iframe fails to load and the final step has never been performed by a person. **Owner decided 5 Sep 2026 that it is both** the reference implementation *and* open question 10's hedge game - which **modifies the 2 Sep "no in-house game is built" decision** and is recorded in the decision log rather than by editing that entry. **No commercial dependency.** Two things not to misread: **risk X8 is reduced when it ships, not now**, and X4a **shrinks X4 without replacing it** - a provider we control cannot rehearse a real partner's auth, error shapes, latency or pricing |
| **Owner instruction on record** | **External games only, no in-house game** (2 Sep 2026). **One step at a time, admin first, do not break the running app.** |
| **Not owner-tested** | Everything after the 2 Sep navigation restructure. X1-X3, X5, the provider admin slice and the contest wizard are all **code-complete, awaiting owner test** - and "code-complete" here excludes the replay script and the label backfill, neither of which has been run against production |
| **Last updated** | 6 September 2026 |

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
| **External-first** | Provider games are the route. **One in-house game is built as a hedge** - X4a, 5 Sep 2026, speaking the provider protocol rather than as a game module | X0-X12 incl. **X4a**, **26.5-35 weeks** total | `01`-`09` **and** `10`-`21` | **CHOSEN** |

**Read `10`-`20`, not just `01`-`09`.** Chapters `01`-`09` were written assuming the
`New games plan` would deliver the foundation and every platform-wide change. It will
not. That dependency did not disappear - it moved here, and chapters `10`-`20` own it.
Any sentence in `01`-`09` that delegates work to the `New games plan` is now a sentence
that delegates it to a chapter in this folder.

**What this decision does NOT mean.** It is **not** the cheaper route, and it must never
be presented internally as one. Dropping the in-house game saves ~3.5 weeks; a correct
provider integration costs ~7. Every platform-wide change - admin, navigation, wording,
flags, catalogue, scoring, profile - is identical either way. **26.5-35 weeks against
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

6. **X5** - contest integration and settlement. **CODE-COMPLETE, 4 September 2026.**
   Publish, entry, ranking, round launch, settlement and all three unresolved-round
   policies.

**Where the next engineer should actually start.** X5 landed in three pieces on 4 September,
and the end of it is the milestone the programme has been working towards: **a provider
contest can now be published, entered, played, paid, and settled correctly when a result
never arrives.** The pilot no longer depends on anything unbuilt in the engine.

The last piece closed two gaps rather than the one that was tracked:

- **The `exclude` refund** is paid and the prize pool re-split inside the settlement
  transaction, so the pool can never be paid out while still counting a removed player.
- **`hold_and_alert` now actually blocks settlement.** Nothing consumed `blocksSettlement`
  either - a held contest settled on time and paid out while the policy promised the
  opposite. Only `score_zero` had ever worked, and it worked because it asks settlement to
  do nothing. That gap was invisible because it had never been written down, whereas
  `refundOwed` was recorded in four documents. **An obligation recorded in four places is
  no more likely to be complete than one recorded nowhere.**

**What this unblocks, and it is the more useful way to read it.** The remaining X6 screens -
provider health, the round inspector, manual resolution - no longer have to be built against
fixtures, which was the argument that held them back. There is now a real round to inspect
and a real settled contest to show. **X4 still jumps the queue the moment a provider is
signed**, unchanged: everything after that point is guesswork until a real provider has
answered a real call.

**Three things `X5 code-complete` does not mean**, and the first two are the ones that would
embarrass a demo:

- **No player screen calls the launch endpoint.** The route exists and is tested; the UI
  is X7.
- **No admin button calls the publish route.** Checked rather than assumed - nothing under
  `apps/admin/components/` fetches it. So the whole lifecycle is reachable **by API and by
  test, not by clicking**, and finishing that is X6's remaining slice. Do not read "a
  provider contest can be published" as "an operator can publish one".
- **The challenge path was not touched.** `lib/actions/trading/challenge-finalize.actions.ts`
  still carries its own copy of the payout, fee and completion logic, so a provider
  *challenge* is X10 work and not a by-product of this phase.
- **The unresolved-round policies apply to provider settlement only.** Trading has no rounds
  that can go unresolved, so there is nothing to honour there - correct, not a gap, but a
  summary saying "settlement honours the policies" should say *provider* settlement.

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
| **X4a** | **ChartVolt as a first-party provider + a real playable game** - registered through the real admin screens, served from its own origin, reporting through the real signed callback. **Doubles as the in-house hedge game** | `21` | **3.5-5 weeks** | `IN PROGRESS` since 6 Sep 2026. **Built:** the standalone `games-service` (seeded puzzle engine, two titles, all four spec endpoints, signed auth, retrying callback, reconciliation sweeper), the platform-side `chartvolt-games` adapter, mirrored, and **the playable board** - a human can start, drag, solve, submit and see a result, verified in a browser on both titles, **167 tests** in the service. Also **deployable**: PM2 entry, `env.example`, a `deploy/README.md` runbook, and the service proven to run from its production `dist` build. **Two exposure routes** - proxied through the platform app at `/play` (owner's choice, 6 Sep 2026: no DNS, no nginx, no certificate) or its own `games.` subdomain (nginx block kept). The proxy makes the frame same-origin, which costs the cross-origin rehearsal and nothing in the protocol - `21` s4.1c. **Not built:** provider registration through the admin screens, and any end-to-end round - **the two halves have never spoken.** Four defects found and all four **fixed**: the missing `callbackToken` field (**R34**), an https-only base-URL rule that made a loopback provider unregisterable, and two invisible configuration defaults (a localhost play origin, an absent frame allowlist). Original scope **decided 5 Sep 2026: it is both** the reference implementation and open question 10's hedge game, which is why the estimate is not 1-1.5 weeks. **No commercial dependency** - the only remaining work on the shortest useful path that does not wait on a contract. Exists because **the review gate `10` s4 is sequenced around cannot currently be held**: `mock.adapter.ts` returns `https://mock.provider.test/...`, which does not resolve, so the play screen's iframe fails to load and the last step of the lifecycle has never been performed by a person. **Runs before the provider health panel**, so health can be proven by watching it go red |
| **X4** | Real adapter against sandbox | `09` E3 | 1 week | `NOT STARTED` - **blocked on a signed provider**. X4a shrinks it but **does not replace it**: a harness we control cannot rehearse a real partner's auth, error shapes, latency or pricing |
| **X5** | Contest integration + settlement | `09` E4 | 1 week | **`CODE-COMPLETE`** 4 Sep 2026, **with two P0 payout defects found and fixed 5 Sep 2026** - publish, entry, ranking, round launch, settlement and **all three unresolved-round policies**. **A provider contest can be published, entered, played and paid. Publishing became clickable on 5 Sep 2026 (X6 slice), and the player round launch on the same day (`13` s1.1a) - the lifecycle is no longer API-only anywhere.** Settlement was an **extraction**: the payout, fee/GM and completion stages moved to `lib/services/settlement/` and trading was rewired onto them. Closing `exclude` also closed **`hold_and_alert`**, which nothing had ever consumed. **The two P0s are why "code-complete" must never be read as "correct":** no code path wrote `participant.score`, so every player settled on zero and split the pool equally; and settlement read `scoreDirection` off a field neither participant copy declared, so a lower-is-better game paid the slowest player first |
| **X6** | Admin: nav restructure incl. **the single Trading section**, RBAC, provider registration, game-aware wizard, analytics, **GM creation API + wizard** | `09` E5 + `12` + `19` | 3-3.5 weeks | `PARTIALLY DONE` - nav restructure and single Trading destination **built and owner-tested 2 Sep 2026**. **Provider registration, credentials and the per-title catalogue switch code-complete 4 Sep 2026** (`12` s4.1a). **Contest wizard from `configSchema` + pre-flight validation code-complete 4 Sep 2026** (`12` s2.1) - creates a **draft**. **The publish control is code-complete 5 Sep 2026** (`12` s3.1a), which also made the competitions list game-aware: `draft` admitted as a status, its own badge, a Drafts count, a provider game badge, and the trading Edit button **withheld** from provider contests because `PUT /api/competitions/[id]` blind-assigns that form's body. **The round inspector and manual resolution are code-complete 5 Sep 2026** (`12` s4.2a) - read-only inspection plus **ending** a stuck round (void/abandoned/expired) with a mandatory reason; it deliberately **cannot enter a score**. Still `NOT STARTED`: provider health panel, live-contest controls, provider contest **editing**, analytics by provider, GM creation API |
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

**Net effect of the 2 September brief: 23-30 weeks for X1-X12**, up from 20-26. The increase
is ~3 weeks of genuinely new scope, not a re-estimate of existing scope.

**Superseded on 5 September 2026: the live figure is 26.5-35**, after X4a added the in-house
hedge game. The 23-30 above is kept because this section is specifically about what the
2 September brief changed, and rewriting it would erase the itemisation that makes the
increase believable. **Read it as history, not as the current total.**

**Game Master work is not a separate phase.** It is distributed: the game label on both
Game Master competition inserts is a **gate inside X1**, the creation API and UI land in
X6, analytics in X7, tier wording in X8. Total ~2.5 weeks, all inside the figures above.
See `19`.

**X1-X12: 26.5-35 weeks**, plus X0 separately. **The shortest useful path is X0-X5 plus a
minimal slice of X6 - nine to eleven weeks of engineering, 11-14 in calendar terms**
because X4 onward waits on sandbox access. It produces a provider contest a player can pay
for and play, and that is the right place to pause and review against real behaviour.

**Revised 5 September 2026 to 26.5-35 weeks, and the 23-30 figure is now stale.** X4a adds
**3.5-5 weeks** because the owner decided it is both the reference implementation and the
in-house hedge game (`21` s8) rather than the 1-1.5 week harness first proposed. **This is
real new scope, not a re-estimate** - it is a second game the platform now owns, chosen
deliberately to buy down risk X8, and any summary presenting 26.5-35 as the same programme
re-scored is wrong. In practice some of X4a overlaps X4, so the delivered increase may be
smaller; **X4's own 1-week estimate is left untouched** rather than optimistically reduced
before the overlap is real.

**Any figure of 23-30 is now stale, as are 20-26 and 18-24.** The figure appears in four
places - this table, `10` section 3, `00-README.md` and section 16 of the internal HTML, whose
**diagram 10 is drawn to scale, so rescale the bars rather than relabelling them.**

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
| **5 Sep 2026** | **AN IN-HOUSE GAME IS BEING BUILT AFTER ALL, as the hedge - closing open question 10 in the affirmative.** Phase **X4a**, chapter `21`. It doubles as the reference implementation that proves the provider seam | Owner decision. **This modifies the 2 Sep external-only decision, whose wording "no in-house game is built" is now false**, and it is recorded here rather than by quietly editing that entry. What survives is the important part: the programme is still external-**first**, and `New games plan` P2's in-house Trivia game is still not being built. What changed is that the platform will fund **one** game of its own as insurance against the provider search or the pricing failing - the exposure risk **X8** describes, which the 2 Sep decision raised rather than removed and which no amount of test tooling touches. **Three consequences that are design, not estimate:** the provider row must represent **ChartVolt as first-party**, never a placeholder company, because a provider joined to contest history can never be deleted or renamed away from it; the game speaks the **provider protocol**, so the hedge costs none of P1/P2's in-house module architecture; and the **arm's-length rules become more important, not less** - every shortcut that integrates it deeply destroys both purposes at once. Estimate 1-1.5 weeks becomes **3.5-5**. **X8 is reduced when it ships, not now** |
| **5 Sep 2026** | **X4a runs BEFORE the provider health panel** | Owner decision, and the reason generalises: a health panel wired to a mock that always answers "fine" **renders green for ever** and cannot be shown to work. Building the thing that can genuinely be switched off first means health is provable by observing it go red. Same failure shape as the trading-shaped services - the screen reports success while telling you nothing |
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
| ~~10~~ | **ANSWERED YES, 5 Sep 2026 - the hedge game is being built**, as phase **X4a** (`21`), where it doubles as the reference implementation for the provider seam. The question was: is a small in-house insurance game worth keeping on the backlog, given the external-only decision left no fallback if the provider search or the pricing fails? It is no longer on the backlog - it is scheduled, before X4, at **3.5-5 weeks**. **It modifies the 2 Sep decision's "no in-house game is built"** - see the decision log. **Risk X8 is reduced when it ships, not now** | **Owner** | **ANSWERED** | `21` |
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
| `21-reference-provider-and-mock-game.md` | **New 5 Sep 2026.** Phase **X4a** - a fake game company built strictly from the issued provider spec, with a real playable skill game on its own origin, so the lifecycle can be driven by a human before a real provider exists. **Carries an outstanding owner decision** (s8) on whether it doubles as open question 10's hedge game |
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

### 6 Sep 2026 - R37 - THE PROVIDER LEADERBOARD RANKED ON NOTHING, AND THE PRE-FLIGHT OFFERED A BUTTON THAT COULD ONLY FAIL

**Shipped:**

1. **R37, a P0 read-path defect.** `getCompetitionLeaderboard` in **both** apps was written for
   trading and dropped the two fields a provider game ranks on. The main app's projection listed
   only trading metrics, so `score` was never selected; neither app's `participantData` mapping
   carried `score` or `scoreDirection`. Every provider participant therefore reached
   `calculateRankings` with an undefined score, `getProviderRankingValue` read `score ?? 0`, and
   **the whole field tied on zero** - the board rendered in tie-break or document order.
2. **`resolveScoreDirection` moved out of settlement into a shared module.**
   `lib/services/games/score-direction.service.ts`, mirrored, now used by settlement and both
   leaderboards, so the live board and the eventual payout cannot rank a title differently.
3. **`RoundPreflight` reads `contestStatus`.** It previously offered a fully enabled **Play**
   button on a contest that had not started; the launch service refused it and the player got a
   red error box on the first screen they see. Five refusals, five wordings, and resume is
   blocked too because the status gate runs before the idempotent resume path.
4. **A reproduction harness for the lobby's data shape**, which is the thing that found all of
   this - `__tests__/services/provider-contest-lobby-shape.test.ts`, plus
   `tools/games/inspect-provider-contest.ts` for reading a real contest's stored document.

**Files touched:** `lib/services/games/score-direction.service.ts` (new, mirrored),
`lib/actions/trading/competition.actions.ts` and its admin copy,
`lib/services/settlement/provider-settlement.service.ts` and its admin copy (private helper
replaced by the shared import), `components/games/RoundPreflight.tsx`,
`__tests__/services/provider-contest-lobby-shape.test.ts` (new, 11 tests),
`__tests__/games/provider-play-ui.test.ts` (+8 tests, one pinned expression updated),
`tools/probe-leaderboard-score.ps1` and `tools/probe-preflight-status.ps1` (new, 5 + 7 probes,
all red), `tools/games/inspect-provider-contest.ts` (new).

**Deviated from plan:** nothing was planned. This began as a reproduction of the owner's generic
error page after entering a provider contest, and **that hypothesis was wrong** - see below.

**Owner tested:** no. The owner's original report (a "Something went wrong" page) is **not
explained by either fix** and remains open; see the next-chat note.

**Deferred:** the lobby page itself, which still renders trading panels and PnL labels for a
provider contest. Scoped and split in `13` s4.1a rather than half-done, because the page is a
server component with a great many trading reads and making it game-aware is a branch at the
top, not a field-by-field guard. Also deferred: per-game ranking labels
(`ranking-config.service.ts`), and a game filter on the list - the latter deliberately, since one
provider game makes a one-option filter pure friction.

**Gates:** 895 tests pass (50 files), `check:mirrors` clean, ESLint clean on every touched file,
and **both typechecks diff to zero lines** against a `git stash --include-untracked` baseline.

**Seven things worth carrying:**

- **"Count the callers" has a read-side form, and this is it.** The rule has caught four entry
  paths, ten finalize sites, six raw inserts and seven subscription writers. R32/R33 fixed where
  a score is produced and where money consumes it; **a third consumer nobody enumerated stayed
  broken for a day.** `rg` for the ranking function returns six call sites - two are reads, and
  both were wrong. Fix a seam, then grep for everyone standing on it.
- **A private helper is where a shared decision goes to be duplicated - or worse, forgotten.**
  `resolveContestScoreDirection` lived inside `provider-settlement.service.ts`, which is exactly
  why both leaderboards had no direction at all. Fifth "one rule, two copies" instance after
  `referenceId`, `failedReason`, `challengeId` and the Game Master `||`, and `check:mirrors`
  compares models so it has never had an opinion about any of them.
- **A green probe has a FOURTH cause: the property is held redundantly.** After weak test, wrong
  claim and missing test - an unrecognised stored direction cannot invert a board, and two
  separate single-site probes both stayed green, because the resolver narrows the value *and*
  `getProviderRankingValue` independently tests equality against the one downward value. **Either
  alone is sufficient, so no single-site change can express the property's absence.** The probe
  now breaks both files at once. Both guards were kept, and the resolver's comment - which had
  implied it was *the* guard - was corrected in place rather than quietly reworded.
- **A reproduction that disproves its own hypothesis is still what finds the defect.** Every
  lobby read was exercised and none crashed; the fields a provider contest lacks turned out to be
  absent-but-guarded or filled by schema defaults, verified against a real MongoDB rather than
  reasoned about. The leaderboard test written on the way failed for a completely different
  reason. **Do not abandon a harness because the hypothesis was wrong.**
- **A fixture must be able to distinguish the branches, or the probe is meaningless.** The
  lower-is-better test needed its catalogue row's `gameKey` to match the contest's exactly -
  otherwise the resolver finds no title, warns, returns the upward default, and the test passes
  for the wrong reason while looking like a correct higher-is-better assertion.
- **Assert the aggregate, not the list of terms.** The button's `disabled` test now pins
  `launching || blocked` rather than the three original reasons. A test naming the terms silently
  permits a fourth reason being computed and ignored - which is how this defect existed at all.
- **Two lint warnings were worth fixing rather than suppressing.** `detect-object-injection` on
  indexing a record by a key from a local constant is a false positive *as a security finding*,
  but `Object.hasOwn` is genuinely more correct here: a bare index walks the prototype chain, so
  a field named like something on `Object.prototype` would report as **stored** on a document
  that stores nothing - and "is this field stored" is the only question the tool answers.

**Next chat should:** either take the lobby page (`13` s4.1a, the largest remaining player
surface) or **get the owner's exact reproduction for the "Something went wrong" page**, which is
still unexplained. Two facts to carry into that: every lobby read was exercised against a real
provider contest without throwing, and `getCompetitionLeaderboard` **rethrows a generic error**,
so a failure inside it surfaces as exactly that page with the real cause only in the server log.

---

### 6 Sep 2026 - R36 - A LIVE DEPLOYMENT WOULD HAVE GIVEN THE PROVIDER AN UNUSABLE CALLBACK

**Closed.** `publicBaseUrl()` in `lib/services/games/round-launch.service.ts` now refuses plain
http and loopback hosts under `NODE_ENV=production`, failing closed on anything `URL` cannot
parse. Five tests added to `__tests__/services/provider-round-launch.test.ts` (20 total),
`tools/probe-launch-base-url.ps1` (7 probes, all red on the expected test).

**Found on the owner's live server, and not by looking for it.** They ran the new
`setup:env` on the real deployment and its origin check refused
`NEXT_PUBLIC_BASE_URL=http://chartvolt.com/` against an https site. That variable is what
`round-launch.service.ts:273` builds `resultCallbackUrl` from, so it is the address the provider
POSTs every score to.

**Why plain http is not a cosmetic problem.** Certbot installs an http → https redirect as a
matter of course, and **the fetch specification converts a POST following a 301 into a GET** - so
the result arrives at our route as a GET, is rejected, and the round is written off as unresolved
days later. The visible symptom is players reporting vanished scores, and the natural first
suspicion is the provider. The token would also have travelled unencrypted.

**Latent, never occurred.** No provider round has ever launched in production. Nothing was
backfilled and there is nothing to backfill.

**Four things that generalise.**

- **A guard that refuses an ABSENT value while accepting a WRONG one is the same defect reached
  by a value that looks configured.** The function already refused an unset base URL, with a
  comment explaining at length that a localhost fallback would launch rounds whose results can
  never arrive - and then accepted an explicitly-set `http://localhost:3000` without comment. The
  reasoning was written down and applied to only one of the two ways in. Same shape as
  `entryBlockThreshold`: **a stored value and an absent one are different facts**, and here the
  stored one was the dangerous one.
- **A tool's validation caught a defect in the thing it was configuring.** The check exists to
  stop the games service booting on a bad origin; it found the *platform* misconfigured. Worth
  generalising: **a guard placed at a seam sees both sides of it**, so the value of validating
  input is not only the refusal but what the refusal reveals about the caller.
- **Pin a development carve-out as firmly as the refusal it exempts.** Every local rehearsal and
  every test here legitimately serves plain http on loopback, so a guard that fired in
  development would be switched off rather than fixed. The probe that **inverts** the environment
  test is the one the pair exists for - it reads almost identically and leaves production wide
  open. Its blast radius is 4 rather than 1, which is correct rather than tolerated: a smaller
  number would mean the two halves were not independent.
- **Count the writers, fifth instance.** `resultCallbackUrl` appears at five call sites; only one
  constructs it and the rest pass it through, so a single guard covers every path. Verified with
  `rg` rather than assumed - which is also how the earlier counts went wrong in the other
  direction (four entry paths, ten finalize sites, six raw inserts, seven subscription writers).

**Also flagged to the owner, not fixed:** `NEXT_PUBLIC_ADMIN_URL` and `BETTER_AUTH_URL` are read
by email verification, payment return and auth redirect paths. If either is http on that
deployment, the same class of problem applies outside games - but changing them is a platform-wide
decision and belongs to the owner, not to this phase.

**Owner tested:** not yet. They must set `NEXT_PUBLIC_BASE_URL=https://chartvolt.com` and rebuild
before any provider round can launch, and **the rebuild is required rather than a restart**
because `NEXT_PUBLIC_` values are baked into the build.

---

### 6 Sep 2026 - X4a - ONE COMMAND WRITES THE SERVICE'S .env

**Shipped:** `games-service/tools/setup-env.ts` (`npm run setup:env`). It generates the four
credentials, takes the database string and the site address from the platform's `.env` one
directory up, writes the file at mode 600, and prints the two credential pairs that have to be
typed into the admin panel. Proven by running it: three refusals fire with their reasons, both
happy paths write the right origins, and **the service boots on a fully generated file**.

**Why it exists:** the manual version was four `openssl` runs and eleven hand-edited lines where a
single typo produces `signature_invalid` on every result - an error that reads like an attack
rather than like a typo. Every value is either random or already known to the machine, so there
was nothing for a person to decide.

**Three things that generalise.**

- **A setup script's most important behaviour is what it refuses.** It will not overwrite an
  existing `.env`, and the reason is asymmetric in a way that is easy to miss: the admin panel
  **cannot show a stored secret back**, so regenerating leaves the operator with four new values,
  four unrecoverable old ones, and every result failing its signature check. `--force` exists;
  the default does not. Same shape as the backfill that refuses to touch a correctly-labelled row.
- **Validate in the tool, not only at the boot it precedes.** The script applies the same https
  and non-loopback rules as `assertPlayableOrigin`, duplicated rather than imported because
  `loadConfig` needs the very file being written. Eight lines buys an error naming the offending
  value instead of a PM2 restart loop at 3am.
- **A development carve-out belongs in the artifact, never in the enforcement.** `--dev` writes a
  loopback origin, which is exactly what the boot guard forbids - and that is safe because the
  guard still fires under `NODE_ENV=production`, so a `--dev` file copied to a server fails loudly
  on first start. **A flag that relaxed the guard instead would have been the same feature with
  none of the safety.**

**One claim verified rather than repeated:** several documents said a shared Atlas cluster is safe
because the database name is applied explicitly. Checked - `src/store/db.ts` passes
`dbName: config.dbName` to `mongoose.connect`, which overrides the URI's own path. True, and now
cited to the line rather than asserted.

**Isolation intact:** 35 source files, no platform imports. Reading the platform's `.env` at setup
time is not a code dependency and `check:isolation` correctly says nothing about it - stated in
both READMEs so nobody "fixes" it later.

**Owner tested:** not yet.

---

### 6 Sep 2026 - X4a - THE PLAY SURFACE IS PROXIED THROUGH THE PLATFORM, ON OWNER'S INSTRUCTION

**Shipped:** three rewrites in `next.config.ts` mounting the game's play surface on the
platform's own origin at `/play`, plus `__tests__/services/games-play-proxy.test.ts` (7 tests).
**Deploying the game now needs no DNS record, no nginx change and no certificate** - it is the
same `git pull` and rebuild as any other change. Proven locally: the page, its stylesheet, its
script and a catalogue thumbnail all serve through port 3000, and the platform's own `/` and
`/assets/icons/logo.svg` still serve unchanged.

**Owner decision, and the reason matters more than the choice.** The subdomain route was rejected
on deployment risk - a DNS record, an nginx server block and a certbot run against a live server
they were not willing to touch. **The service still runs as its own process, its own port, its own
database, sharing no code with the platform.** Only the browser's route to it changed.

**The cost, stated rather than buried: the game frame is now same-origin.** The provider protocol
is untouched - signed outbound calls, the round lifecycle, the signed callback, score ingestion
and settlement never involve a browser. What is no longer rehearsed is the browser half: the play
screen's `event.origin` check **passes trivially** rather than being tested against a genuinely
different origin, and `frame-ancestors` is not what permits the embed (the platform's existing
`X-Frame-Options: SAMEORIGIN` allows it). All of it closes at X4 against a real provider, which is
cross-origin by construction. Recorded in `21` s4.1c, not glossed.

**And the answer to the owner's question, which is the reassuring part: an external provider needs
neither a rewrite nor an nginx change nor a DNS record.** They host their own play surface on
their own domain; the platform stores its address. This work is a one-time cost of being our own
provider, not a per-provider cost.

**Four things that generalise.**

- **Check what the app already owns before claiming a URL prefix.** Artwork was going to be
  mounted at `/assets/`, and the platform has a `public/assets` directory. Under Next.js's
  `afterFiles` semantics that prefix is **shadowed by the real folder for any file that exists and
  shadows the game for any that does not** - a half-working prefix, worse than either outcome
  alone, and it would have passed any test that happened to request a missing file. One `Test-Path`
  before writing the rule avoided it.
- **A configuration shape can be the safety guarantee.** Returning a bare array makes Next.js
  treat these as `afterFiles`, so real pages and `public/` files always win and the rules
  **cannot** change any existing route's behaviour. The `beforeFiles` object form inverts exactly
  that. It reads like a shorthand, so it is commented as a guarantee - "tidying" it into the
  object form would silently remove the one property that makes this safe to add to a live app.
- **Rewrite order is behaviour, so the test asserts position, not contents.** `/play/:path*` placed
  before the artwork rule swallows it and forwards to a path the service does not serve. Both rules
  stay present and individually correct, so a contents assertion passes while every thumbnail
  404s. Same class as the fixed-character Edit-guard lesson: **assert position within the
  construct.**
- **A coupling between two deliberately isolated codebases lives only in prose, so write it on
  both sides.** The proxy works only because `index.html` uses absolute `/play/...` paths and the
  platform mounts it at `/play`. `check:isolation` guarantees neither repository can see the other,
  so nothing mechanical can enforce this. Stated in `games-service/README.md` and `21` s4.1c.

**Deviated from plan:** `21` and the runbook described a `games.` subdomain as the route. Both now
carry two routes with the proxy as the default; **the nginx block and its instructions are kept,
not deleted**, and switching is two environment variables and a restart with no code change.

**Owner tested:** not yet. Nothing is deployed.

**Deferred:** unchanged from the entry below, plus the cross-origin rehearsal and the platform CSP
`frame-src` allowlist, both of which now wait for X4 rather than being available at X4a.

**Next chat should:** walk the owner through the pull-and-rebuild, then register and enable
`chartvolt-games` and drive one round end to end by clicking.

---

### 6 Sep 2026 - X4a - THE GAME SERVICE IS DEPLOYABLE, AND WRITING THE RUNBOOK FOUND THREE DEFECTS

**Shipped:** everything needed to put `games-service` on a server, and nothing that puts it
there. A PM2 app `chartvolt-games` running `dist/index.js` with `cwd: games-service`; the service
added to `post-deploy`'s install-and-build chain; an nginx server block for a `games.` subdomain;
`games-service/env.example`; and a **ChartVolt Games** section in `deploy/README.md` covering DNS,
certbot, the four credentials, and the admin clicks that register and enable it. Proven to run
**from its production `dist` build**, not only under `tsx` - the play page and its three assets
serve correctly from there, so the two-depth `resolvePlayRoot` needs no copy step. Owner decided
to deploy first and rehearse against the live site rather than finish the local rehearsal.

**Three defects found, all fixed, and the mechanism is the finding.** Writing a runbook means
stating exactly what an operator must type, and three of those statements were false.
**Writing down what somebody must do is a test of whether they can do it** - the same mechanism as
R34 one level up, where building against the issued document tested the document.

- **The admin panel could not register a loopback provider at all.** `isHttpsUrl` demanded
  `https://` unconditionally. The refusal *looks* right - an external provider certainly must be
  https - and it misses that a first-party provider shares the machine, so **loopback is the
  safest base URL available**, not a relaxed one: the traffic never touches a network. Now
  `isAcceptableProviderUrl`, plain http on `localhost` / `127.0.0.1` / `[::1]` only. The case
  worth naming is `http://10.0.0.5`, which looks internal, is **not** loopback, and is still
  refused - widening the carve-out to "any http" is the natural way to break this, so a probe
  pins it. 4 tests, 7 probes (`tools/probe-provider-base-url.ps1`).
- **`GAMES_PUBLIC_URL` was optional and defaulted to localhost**, and **launch URLs are built from
  it**. A deployment that forgot it would boot cleanly, sync a catalogue, publish a contest, and
  send every player's iframe to *their own machine*. No error, no log line, no failed request -
  a blank rectangle for the player and a healthy service for the operator.
- **`GAMES_FRAME_ANCESTORS` was documented rather than enforced**, so the game shipped embeddable
  by any site. An attacker who can frame a live round can overlay it and the player cannot tell.

**Both configuration defects are now boot refusals in production only**, with the play origin
additionally required to be non-loopback https. `tools/test-config.ts`, 15 tests,
`probe:config`, 12 probes, all red on the expected test.

**Four things that generalise.**

- **A correct reason can support a wrong conclusion, and this is how to spot it.** `app.ts` said
  the frame check belonged in the README "because a service that refused to boot without it could
  not be smoke-tested". That is entirely true of *unconditional* enforcement - and the smoke tools
  and all 167 service tests run without `NODE_ENV=production`, so the two cases were separable and
  the trade-off was never necessary. **When a comment justifies not enforcing something, check
  whether the objection applies to every case or only to one**, and leave the correction visible
  rather than quietly editing the tense: the next reader needs to know the sentence was believed.
- **A guard that fires in the wrong environment gets reverted, not fixed - so the carve-out needs
  probing as hard as the refusal.** Five of the 15 tests assert that **nothing** is refused in
  development, and a probe widens `isProduction()` to `return true` to prove they catch it. Two
  more check the carve-out has not leaked onto the credentials, where a production-only secret
  would restore the exact "absent configuration is permission to proceed" class the config module
  exists to remove. **Half a guard's tests should be about where it must stay silent.**
- **Nothing from the platform's `.env` is passed to the provider's PM2 entry, and that needed
  saying in the file.** The websocket entry above it forwards `MONGODB_URI`, so copying the
  pattern is the obvious move - and a provider holding the platform's connection string is no
  longer a provider. Every guarantee the integration rests on (never touches money, scores only
  through the signed callback) is only genuinely true if it *cannot* read that data by accident.
- **The nginx block's differences from its neighbours are the point, so they are commented as
  such.** It sets **no `X-Frame-Options`**, because the play page exists to be framed and
  `SAMEORIGIN` would blank the game for every player; framing is restricted by `frame-ancestors`
  instead, which is a real restriction rather than a relaxation. It adds no other header, because
  `add_header` **replaces** the inherited set rather than adding to it - which is how the
  service's own `Referrer-Policy: no-referrer` would silently disappear and start leaking launch
  tokens. And everything except `/play`, `/assets` and `/health` returns **404**, because the
  platform reaches the API over loopback and an endpoint nobody needs to reach cannot be attacked.
  The sandbox controls, which can force a score, sit under that refused prefix as a second
  independent reason they cannot bite in production.

**Deviated from plan:** `env.example` has **no leading dot**, matching `deploy/env.example`.
`.env.example` would have been silently deleted from the repository - the root `.gitignore`
ignores `.env*`, so the file would just stop being committed and the next deployment would have
no record of the variables it needs. Recorded in `games-service/.gitignore` so nobody renames it
back for convention's sake.

**Owner tested:** not yet. Nothing is deployed.

**Deferred:** the deployment itself; provider registration through the admin screens; the
end-to-end round; the failure rehearsals; resolving `AMBIGUITY-LOG.md` back into `01` and the
requirements HTML with a version bump. Also **no CSP `frame-src` allowlist on the platform side** -
`next.config.ts` still has no Content-Security-Policy at all, so adding one is a platform-wide
change that must account for the Nuvei payment flow and the tutorial embeds.

**Next chat should:** deploy to `games.chartvolt.com` following `deploy/README.md`, then register
and enable `chartvolt-games` through the admin screens and drive one round end to end by clicking.

---

### 6 Sep 2026 - R34 CLOSED - THE PLATFORM CAN NOW HONOUR ITS OWN ISSUED SPECIFICATION

**Shipped:** the `callbackToken` credential, so a provider implementing
`Authorization: Bearer {CALLBACK_TOKEN}` - which `01` s2.2 and the requirements HTML have promised
all along - is accepted rather than refused and logged as a suspected attack. Additive on both
`whitelabel.model.ts` copies, read first in `loadProviderSecrets`, and enterable through the
credentials dialog as a fourth box.

**Files touched:** `database/models/whitelabel.model.ts` + the admin mirror,
`lib/services/games/callback-verification.ts`,
`apps/admin/lib/services/game-providers/provider-admin.service.ts`,
`apps/admin/app/api/games/providers/[providerKey]/credentials/route.ts`,
`apps/admin/components/admin/games/{ProviderCredentialsDialog.tsx,provider-types.ts}`,
`__tests__/services/provider-callback-token.test.ts` (new, 8 tests),
`__tests__/admin/game-providers-admin.test.ts` (+3 tests, several updated),
`__tests__/services/round-lifecycle.test.ts`, `tools/probe-callback-token.ps1` (14 probes, all
red on the expected test). `check:mirrors` green, both typechecks **identical error for error**
(18 main, 223 admin) after diffing the lists rather than the counts.

**THE SPEC WAS RIGHT AND THE CODE WAS WRONG, SO THE CODE MOVED.** The cheaper diff was to amend
`01` and re-issue the requirements HTML to describe what the platform actually did - and it is the
wrong direction. Providers may already be building against the issued version, and a document that
changes to match a defect teaches everyone that the document is not the contract. **No version
bump**, because nothing provider-facing changed.

**A SIBLING HOLE THAT WAS ALREADY REACHABLE, FOUND BY ASKING WHAT ELSE GATE 3 NEEDS.** A provider
could be enabled with a callback secret and no token at all, so the screen could turn a switch on
into a configuration where **every** result fails at gate 3 and is recorded as an attack. That is
exactly what the adapter and callback-secret refusals on the same screen exist to prevent - the
third check was simply missing. `setProviderEnabled` now refuses, naming the missing thing, and it
demands the **explicit** field rather than accepting the compatibility fallback: **a transitional
path that new integrations may keep using is one nobody ever removes.**

**Three implementation details worth carrying forward.**

- **`||` rather than `??`, and the reason is a live hole rather than style.** For a credential
  string every falsy value means absent, and `??` would hand gate 3 an empty token - where
  `safeEqual("", "")` is **true**, so a request carrying no `Authorization` header at all would
  authenticate. Gate 3 guards this separately, which is exactly why it must not be the only place
  it is handled. Both halves are pinned by their own test.
- **A precedence test needs its two sources to DISAGREE.** Seeding the token and the key to the
  same value cannot tell the branches apart - the wrong branch produces the right answer - which
  is the trap that made R31's first probe useless. The fixture names them
  `the-token-WE-issued-them` and `the-key-THEY-issued-us`, and `loadProviderSecrets` returns a
  `callbackTokenSource` discriminator so a test can assert **which field was read** rather than
  only the outcome.
- **The refusal test asserts WHICH GATE refused.** Gates 3 and 5 both return `signature_invalid`,
  so a test checking only the result code passes just as happily when the HMAC fails for an
  unrelated reason. It reads the error text recorded by gate 1's stored event. The same collision
  cost real time while writing this: the mock adapter's gate 5b uses its own header name, and
  omitting it produced a `signature_invalid` that looked exactly like the bug being fixed.

**One probe stayed green, and it was the third cause rather than a weak test or a wrong claim:
the fixture could not distinguish the branches.** Replacing the presence badge with a hardcoded
`true` changed nothing, because the test that checked presence booleans stores every credential.
The test written to close it asserts that a **missing** credential reads `false` - which is also
the case that matters operationally, since a badge saying "set" for a token that was never stored
leaves an operator no way to discover why enabling refuses them.

**Owner tested:** nothing. Latent throughout - no real provider has ever existed, the mock uses
its own header, so **nothing was refused in production and there is nothing to backfill.**

**Deferred:** nothing from R34. `chartvolt-games` still has to be registered through the admin
screens and no round has yet travelled between the two halves.

**Next chat should:** register `chartvolt-games` as a provider through the real admin screens,
issue it a callback token, point `games-service` at the platform with a real `.env`, and drive one
round end to end by clicking - the first time the two halves will have spoken.

---

### 6 Sep 2026 - X4a - THE GAME IS PLAYABLE BY A HUMAN

**Shipped:** the play surface the launch URL points at. `GET /play?t={token}` now serves a real
game - drag between matching numbers with a finger, fill every square, submit, and the round
advances or settles into a signed result. Verified in a browser on **both** titles: heading, rules,
clock, progress wording, a full solve, the board-to-board advance, and the result screen, with **no
console errors**. Served from `games-service/public/play/` (4 files, no build step, no framework -
the target is a phone on a bad connection) behind `src/http/play-page.ts`.

**Files touched:** `games-service/public/play/{index.html,app.css,app.js,board.js}`,
`src/http/play-page.ts`, `src/app.ts`, `src/rounds/play.ts`, `tools/test-board.ts` (11 tests),
`tools/probe-board.ps1` (13 probes, all red on the expected test), `tools/smoke-play.ts`,
`tools/test-play.ts` (38 tests, 7 new), `tools/api-harness.ts`, `package.json`, `.gitignore`,
`README.md`, `AMBIGUITY-LOG.md`. **Full suite: 152 tests.** Nothing in the platform changed, so
`check:mirrors` has no opinion on any of it.

**A LIVE DEFECT IN THE SERVICE, FOUND BY HAVING A CLIENT AT ALL.** `stateFor` derived `finished`
from **"there is no board to show"** - and a round nobody has started has no board either, so
`GET /play/api/state` on a fresh round answered `finished: { status: "created" }`. The first
screen a paying player would ever see was a **result screen for a round they had not played.**
Nothing caught it because every previous caller reached that function *after* starting; it became
reachable the moment a client existed that reads state before offering a Start button. It now
derives from the terminal status, or from the **owed** status where the deadline has passed but no
writer has recorded it yet - taking the stored value there would leave a live board running
against a dead clock for up to a sweeper interval. Pinned by its own test, and the probe removing
the fix turns exactly that test red.

**Two more gaps in the issued specification, both found by building the client rather than reading
the document.** **A13: the provider is never told the origin it is embedded in**, so `postMessage`
has no target origin. The strict-looking guess - derive it from `returnUrl` - fails **silently**:
the browser drops the message, the platform never receives `ready`, and a spinner sits over a game
that is running perfectly, with no log line on either side. Posting to `*` discloses nothing here,
because the message type carries no score, rank or player field and `height` is the only number
that crosses; the check that matters is the platform's, and it already compares `event.origin`
against the launch URL **and** `event.source` against the frame's own window. The fix is one field
on create-round, and it is the same fact a CSP `frame-src` allowlist needs. **A14: `replayUrl` is
required on every result and entirely undefined** - this service builds one and **no route serves
it**, so the platform is handed a URL that answers `NOT_FOUND`. Latent, since nothing follows the
field yet, but it is a promise made inside a signed payload. It needs an owner decision rather than
a guess: a replay showing *the puzzle* is a content leak, because a contest's boards are shared, so
a losing player could read a live contest's content out of their own finished round.

**Deviated from plan:** `21` s4 lists mobile support as a deliverable of its own. It was built here
instead of separately, because the board is the only screen where it is a design constraint rather
than a stylesheet - `touch-action: none` is the single rule that decides whether a drag draws a
path or scrolls the page, and a game that fails that is not playable at all on the device most
players use.

**Two probes that were structurally unable to fail**, which is the more useful half of the day.
Removing the "every cell must be used" guard and the "walk a fast drag one cell at a time" guard
both left the suite **green** - not because the tests were weak in the usual sense, but because
they ran against a *generated* puzzle whose own shape made each guard redundant. Rewritten against
hand-built boards where the guard's absence cannot help but change the answer. This is the third
cause of a green probe, after "weak test" and "wrong claim": **the fixture cannot distinguish the
branches**, and only running the probe separates the three.

**Owner tested:** nothing on the platform. The game itself was played through in a browser on both
titles, against the service's own smoke tool - never launched from a ChartVolt contest, because
that still needs the provider registered and **R34** fixed.

**Deferred:** registering `chartvolt-games` through the admin screens; the end-to-end click-through;
the failure rehearsals; the content set and localisation (both titles declare `en` only,
deliberately - declaring a locale and shipping English strings for it renders confident English
copy on a Greek game page with nothing raising an error); the runbook; and resolving the 14
`AMBIGUITY-LOG.md` entries back into `01` and the requirements HTML with a version bump.

**Next chat should:** fix **R34** - the additive `callbackToken` on both model copies, `callbackToken || apiKey`
in `loadProviderSecrets`, and a fourth credentials input - because it is the one thing standing
between the two halves, and then register the provider and drive one round end to end by clicking.

---

### 6 Sep 2026 - X4a - THE GAME SERVICE AND THE PLATFORM ADAPTER - CODE-COMPLETE BUT NOT YET CONNECTED

**Shipped:** two halves that have not yet met. `games-service/` is a standalone provider - its own
process, origin, database and `node_modules`, sharing **no code** with this repository and holding
a deterministic seeded puzzle engine, two titles, the four specification endpoints, signed
inbound auth, a retrying result callback and a reconciliation sweeper. In the platform,
`chartvolt-games` is now a registered adapter. **Nothing player-visible, and no round has ever
travelled between the two.**

**Files touched:** `games-service/**` (24 source files, 4 test suites, 3 probe harnesses, an
`AMBIGUITY-LOG.md` and a `README.md`), and in the platform
`lib/services/game-providers/adapters/chartvolt-games.adapter.ts` plus
`adapters/chartvolt-games/{connection,transport,normalise}.ts`,
`lib/services/game-providers/callback-headers.ts`, `registry.ts`,
`lib/services/games/callback-verification.ts`, and
`__tests__/services/chartvolt-games-adapter.test.ts` (49 tests) with
`tools/probe-chartvolt-games-adapter.ps1` (24 probes, all red on the expected test).
Everything under `lib/services/game-providers/` is mirrored into `apps/admin` and verified
byte-identical.

**Deviated from plan:** three times, each recorded rather than absorbed.

- `21` describes one provider adapter file. There are **four**, because the connection loader
  touches the database, the transport signs and maps errors, and the normaliser is shared by the
  callback and the fetch. The 500-line limit forces the split, and the split is the better shape.
- The transport-header helpers **moved** out of `lib/services/games/callback-verification.ts`
  into `lib/services/game-providers/callback-headers.ts`. That folder is mirrored into
  `apps/admin` and the other is not, and the adapter needs the five-minute window. The
  alternatives were both worse: mirroring `callback-verification.ts` wholesale would put
  `loadProviderSecrets` into the admin app with nothing calling it - a dead helper that hands out
  callback secrets, which is the `shouldBlockEntry` shape - and a second copy of the window in
  the adapter is the "one rule, two copies" failure this codebase has had four times.
- `verifyCallback` **cannot** verify a signature, and this is a finding rather than a shortcut.
  The interface declares it **synchronous** and this provider's secret lives behind
  `select: false` in the database, so there is no way to recompute an HMAC there. The mock can
  only do it because its secret is a field on the instance. Gate 5 already verifies the HMAC with
  the stored secret, so nothing is unchecked - but since the ingestion service says an adapter
  returning `{ valid: true }` unchecked "turns this gate into a formality", the adapter instead
  checks everything possible without a secret: all three headers present, the signature shaped as
  `sha256=` plus 64 hex characters, and the timestamp window via the shared helper.

**A DEFECT FOUND, NOT FIXED: THE PLATFORM CANNOT HONOUR ITS OWN ISSUED SPECIFICATION.**
`01` section 2.2 and the requirements HTML sent to providers both promise
`Authorization: Bearer {CALLBACK_TOKEN}` - "a token we issue to you", distinct from the
`API_KEY` the provider issues to us. There is **no such field**:
`gameProviderCredentials` stores `apiKey`, `apiSecret` and `callbackSecret` only, the credentials
dialog offers three inputs, and `loadProviderSecrets` sets `callbackToken: credentials.apiKey`.
So gate 3 expects a provider to authenticate **inbound** using the credential they issued us for
**outbound** calls. A provider implementing the document exactly is rejected - and the log line
says "either credentials are wrong or someone is probing the endpoint", so a correct integration
reads as an attack. Two things make this worth stating carefully: it is **latent**, because no
real provider exists and the mock uses its own header, and it is **not** fixable by configuration,
because there is nowhere to type the value. Needs an additive `callbackToken` on both model
copies, `callbackToken || apiKey` in the loader for backward compatibility, and a fourth
credentials input. **Not done here** - it is a mirrored model change plus an admin UI change, and
it belongs with the end-to-end rehearsal it blocks.

**Owner tested:** nothing. Both halves are code-complete and unconnected.

**Deferred:** the playable frame UI (the launch URL serves no board yet, so the round lifecycle is
still API-only on the provider's side); registering the provider through the real admin screens;
the end-to-end click-through; the failure rehearsals; and resolving the `AMBIGUITY-LOG.md`
entries back into `01` and the requirements HTML with a version bump.

**Two things not to misread.** `games-service` has **no `.env`**, so it has never been started
against the platform - "code-complete" here means its own tests pass in-process against
`mongodb-memory-server`. And the adapter's 49 tests run against a **stubbed `fetch`**: they prove
the adapter's half of the protocol, not that the two sides agree. A stub returns what it is told,
and a fixture that supplies the value under test has tested the consumer rather than the
producer. The one assertion that does span both sides recomputes the HMAC from the stored secret
over the exact bytes passed to `fetch`, which is the same construction the service's inbound guard
uses.

**Next chat should:** build the play surface the launch URL points at, then register
`chartvolt-games` through the admin screens and drive one round end to end - at which point the
callback-token defect above stops being latent and must be fixed.

---

### 5 Sep 2026 - X4a PLANNED - AN IN-HOUSE GAME AFTER ALL, AND THE REVIEW GATE THAT CANNOT BE HELD

**Shipped:** documentation only. No code. New chapter
`21-reference-provider-and-mock-game.md`, phase **X4a** added to the programme, and two owner
decisions recorded.

**What X4a is:** ChartVolt registered as a **first-party provider** through the real admin
screens, serving a **real playable skill game from its own origin**, reporting through the
**real signed callback**. It is simultaneously the reference implementation that proves the
provider seam and - after the owner's decision below - the platform's in-house hedge game.

**Why it earns a phase, and this is the part worth keeping.** The programme is sequenced around
a review gate (`10` s4): build the shortest useful path, then watch a real player pay for and
play a non-trading game before committing to the rest. **That review is currently impossible to
hold, and nobody had noticed.** Every part of the path is built except X4, X4 is blocked on a
contract, and `mock.adapter.ts` returns `https://mock.provider.test/play/<roundId>` - a hostname
that does not resolve. So the play screen shipped earlier today renders an iframe that fails to
load. Everything up to the last step is proven by tests, and **the step a player actually cares
about has never been performed by a person.** The general form, which is this project's
recurring shape in a new place: **a green suite tells you the parts work, never that the whole
thing has been done once.**

**Owner decision 1 - it is BOTH, so an in-house game is being built.** The recommendation in
this chapter's first draft was the harness alone; it was **overruled**, and the reasoning for
the choice made is better than the recommendation it replaced. Harness-only leaves risk **X8**
untouched - the whole foundation and admin programme funded and still exactly one game if the
provider search or the pricing fails - and no amount of test tooling touches that. **This
modifies the 2 September external-only decision, whose wording "no in-house game is built" is
now false**, and it is recorded in the decision log rather than by editing that entry, because
a change of direction is the fact a future reader needs.

**Three consequences that are design rather than estimate:**

- **The provider row must represent ChartVolt as first-party, never a placeholder company.** A
  provider joined to contest history can never be deleted, and `gameKey` is immutable, so
  whatever name is on that row when the first contest settles is in production data, financial
  reports and audit trails for ever. **Get the name right before the first settlement, because
  there is no cleanup path.**
- **The game speaks the provider protocol, so the hedge costs none of P1/P2's in-house module
  architecture.** It is a provider game that happens to be ours. That is why 3.5-5 weeks buys
  something the dropped in-house plan would have charged much more for, and it is why "no
  in-house game *module*" is still true while "no in-house game" is not.
- **The arm's-length rules matter more, not less.** As a product there will be pressure to
  share types, call internal services, skip the signature. Every such shortcut destroys both
  purposes at once - it stops being a valid reference implementation *and* stops proving the
  seam can carry a real game. **Zero imports from this repo, asserted by a check rather than by
  review.**

**Owner decision 2 - X4a runs before the provider health panel**, and the reason generalises: a
health panel wired to a mock that always answers "fine" **renders green for ever and cannot be
shown to work.** Building the thing that can genuinely be switched off first makes health
provable by watching it go red. Same failure shape as the trading-shaped services - the screen
reports success while telling you nothing.

**Files touched:** `21` (new), `10` s3 table + effort paragraph + hard-ordering diagram + s4,
`17` risk X8 + summary row, `00-README.md` (five places), `09` header note, `PROGRESS.md`
(status block, X-phase table, decision log, open question 10, documents list, three totals, the
2 Sep work-log entry), `ChartVolt-External-Games-Plan.html` (**diagram 10 rescaled**, figcaption,
s14 sub-heading, s16 shortest-path, FAQ row), `New games plan` PROGRESS / `00-README` / `14` /
both HTMLs, and the sync rule's opening scenario statement plus two new paired-document rows.

**Deviated from plan:** the estimate rose from the 1-1.5 weeks first proposed to **3.5-5**, and
the programme total from **23-30 to 26.5-35 weeks**. Recorded as real new scope, never a
re-estimate - it is a second game the platform now owns.

**Two things found while syncing, both of which are the reason the sync rule exists.** The
internal HTML's FAQ row still said **"twenty to twenty-six weeks"** - two revisions behind, stale
before today's change and missed by the 2 September pass. And **diagram 10 needed a genuine
rescale**, not a relabel: the axis went from 28 to 32 weeks and every bar in both routes was
recomputed, verified by script (route A 376px = 16.5 weeks, route B 678px = 29.7, and **the two
pale blue platform bars still exactly equal at 171px**, which is the entire argument of the
figure). **X4a is deliberately drawn in the same mid-blue as the in-house route's game
segment** - the external-only route now visibly contains the thing it was defined by not
containing, and that is the honest reading rather than a mistake.

**Deferred, deliberately:** whether to tell prospective licensing partners we are also building
our own title. The partner HTML got the timeline figure and an internal note only. It cuts both
ways - it shows we can run a game properly, and it tells them we are a potential competitor -
so it is a commercial call, and **it must not be resolved by consistency with the internal
documents.**

**Owner tested:** nothing to test; no code shipped.

**Next chat should:** wait for the owner to say start. Then **X4a**, beginning with the game
concept itself, since everything else depends on it - it must be **skill-based** (chance
inverts the regulatory position), needs a **lower-is-better** sibling title to make
`scoreDirection` observable, and must be a **paid multi-player format**, never paid
single-player. Then provider health, then the game-aware contest list and dashboard. **Do not
let any summary claim risk X8 is mitigated** - it is reduced when the game ships, not when the
plan is written.

---

### 5 Sep 2026 - R26 CLOSED - THE ADMIN CRON PAID NO GAME MASTERS

**Shipped:** `apps/admin/lib/actions/trading/competition-end.actions.ts` now calls
`settleFeesAndGameMasters` - the shared stage X5 extracted - in place of its own inline fee
arithmetic. Before this, a competition finalized by the **admin** cron paid its Game Masters
nothing and wrote no `retained_gm_fee` row either, so the commission stayed with the platform
with nothing in the ledger explaining why.

**This one was actively losing money, not latent, and that distinction is the whole reason it
was picked next.** Both apps register `checkAndFinalizeCompetitions` on an every-minute
Inngest cron, so whether a referrer was paid for any given contest depended on nothing but
which cron claimed it first. There is no configuration that turns this on or off and no error
raised either way.

**Not retroactive, and stated plainly because a summary would round it up.** Contests already
finalized by the admin path are not repaired, and **no backfill was written**. Two reasons:
the affected contests cannot be found by querying for retained rows, because none were
written - only a reconciliation of referred players' entry fees against earnings per contest
will find them - and crediting wallets from inferred history is a money writer that needs an
owner decision before it needs code.

**Verification:** 802 tests pass (46 files), up from 797. **5 probes, all behaving as
designed.** Typecheck **list-diffed, not counted**, against a `git stash push
--include-untracked` baseline: main 17 -> 17 and admin 223 -> 223, both lists **identical**,
nothing appearing and nothing disappearing. Lint clean. `check:mirrors` 79 agree / 0 drifted.

**Four things worth carrying forward.**

- **The platform-fee record had to change with the payout, not gain a line beside it.** The
  Game Masters' share is carved *out* of the platform fee, so the figure booked as platform
  income has to be net of the commission. Adding the referral payout while still recording
  the gross fee would count the same credits twice in two different books - and it would have
  reviewed as a correct fix, which is why the parity suite asserts the net figure explicitly.
- **The four finalize functions really are not four copies of one function**, as X1 warned.
  The admin path has no retry wrapper and no optimistic lock, loading the competition inside
  the transaction, so its idempotency comes from a `status !== "active"` guard. The first
  idempotency probe was aimed at the duplicate check inside `distribute.ts` and **stayed
  green**, because a second finalize refuses at the status guard long before the referral
  stage runs. The check is not dead, it is unreachable *here*. The claim in the test comment
  was wrong and was corrected, and the probe re-aimed at the guard that actually holds.
- **A comment asserting correctness was wrong in three files, and a control probe is what
  proved it.** The `walletMap` handed from the prize stage to the fee stage was documented as
  mattering "for correctness, not just query count". It does not: both stages read the
  post-credit balance back from `findOneAndUpdate({ new: true })`, and neither reads a balance
  out of the map - it decides only whether a wallet must be created. A probe passing an empty
  map moves identical money and **must stay green**. Fifth instance of the aside-verification
  rule, so carry the class: **a comment claiming a property is a claim, not a fact.**
- **Extracting shared code hid this defect from the heuristic that found it.** R26 was spotted
  because `competition-end.actions.ts` was 72 KB in the main app against 38 KB in admin. It is
  now 45 KB against 37 KB - not because admin gained the logic, but because the main app shed
  ~27 KB into the shared services. The same size comparison today raises nothing, while the
  identical divergence in `challenge-finalize.actions.ts` (70 KB against 42 KB, its own copy of
  all three stages in each app) is still there to find. That is an argument for parity tests,
  not against extraction.

**Two harness bugs fixed on the way, both of which had produced false results.** The probe
script read and wrote with `Get-Content -Raw` / UTF-8, and Windows PowerShell decodes with the
system ANSI codepage - so every emoji in the touched services came back as mojibake and was
written back that way. The probes passed, the files were quietly mangled, and it surfaced two
steps later as unexplained typecheck errors. Both directions now pin UTF-8 **without a BOM**,
with an `Assert-RoundTrip` check before any probe runs. Separately, the harness judged a probe
by searching whole-suite output for the expected test's **name**, which vitest prints for a
passing test as readily as a failing one - every probe reported RED beside "failing tests: 0".
It now runs the expected test alone with `-t` and reads the summary counts, then runs the suite
again purely to measure blast radius.

**And a self-inflicted one worth recording, because it wasted ten minutes and looked like a
hang.** The harness reports through `Write-Host`, which writes to the host rather than the
pipeline, so piping the script to `Select-String` filtered a stream that was nearly empty and
showed no progress at all. Redirect a child PowerShell process's output to a file instead.
**Silence from a filtered pipeline is not evidence of a hung process.**

**Deferred:** the **challenge** path still holds its own copy of all three settlement stages
in both apps, and the same referral divergence has not been checked there - it is the obvious
next place to look, and it is X10. No backfill for historical admin-finalized contests.

**Next chat should:** commercially, find and assess a provider (`08`) - X4 is blocked on it.
Technically, either provider **health** (X6's last admin destination) or the game-aware
contest list and dashboard (`13` s4/s5).

---

### 5 Sep 2026 - X7/E6 SLICE - THE PLAYER PLAY SCREEN - CODE-COMPLETE

**Shipped:** a player who has entered a provider contest can now start a round, play it, and see a
confirmed result **by clicking**. That was the last part of the provider lifecycle reachable only
by API and by test. 42 tests, 20 probes, every one red on the expected test.

**And it closed a live defect nobody had filed.** No player screen read `gameType` at all, so a
provider contest rendered the trading lobby and its CTA said **"Start Trading"**, linking to
`/competitions/[id]/trade` - the forex workspace, with charts, an order form, positions and margin.
A player who had paid to enter a puzzle contest arrived at a trading terminal for a game with no
market, and **nothing errored**. Same shape as the trading-shaped services in
`matchmaking.service.ts` and the admin list rendering drafts in the grey it uses for finished
contests: the screen keeps working and keeps being wrong.

**Files touched:** `app/(root)/competitions/[id]/play/page.tsx` (new),
`components/games/` (new - `ProviderRoundHost`, `ProviderGameFrame`, `provider-frame-messages`,
`RoundPreflight`, `RoundResultPanel`, `play-state`),
`lib/services/games/round-status.service.ts` (new),
`app/api/competitions/[id]/rounds/route.ts` (gained a `GET`),
`components/trading/CompetitionEntryButton.tsx`,
`app/(root)/competitions/[id]/trade/page.tsx`, `eslint.config.mjs`,
`__tests__/games/` (three suites), `tools/probe-player-play.ps1`.

**Deviated from plan - the route was corrected before shipping, not after.** `09` E6 called it
`/play/[contestId]`; `13` section 1 called it `/competitions/[id]/play`. **Two chapters disagreed
about a URL players bookmark**, and the paired-document rule is written as though a restatement
drifts from its source - here the source drifted from the chapter that owns routing. `13` won.
Building at the wrong path would have meant renaming a live URL or running two play routes for
ever, and checking cost one search.

**Deviated - only the provider branch of the dispatcher was built.** `13` describes `/play` as a
dispatcher rendering trading gameplay too, with `/trade` reduced to a permanent redirect *inwards*.
That needs `TradingPageContent` and its six context providers moved, which is a change to the live
trading path carrying **R18** (a price feed opened for a chess player) and **R19**. So the redirect
currently runs **outwards**: a trading contest reaching `/play` goes to `/trade`. When X7 moves
them it flips direction and no URL changes. **No loop is possible either way** - the two guards are
exact complements of `isProviderContest`, pinned by a test, because an overlap gives an infinite
redirect rather than a wrong screen.

**Five things worth carrying:**

- **A GET must never consume an attempt, and a server component is a GET.** An attempt is spent
  when a round is *created*, deliberately, so launching from the page's render would burn a paying
  player's only attempt because **Next.js prefetches `<Link>` targets on hover**. Nothing errors and
  nothing logs. The page renders a button and the POST happens on the click - which is why the play
  screen is a state machine rather than a redirect through the launch API, and why that is not a
  complication to simplify away later.
- **The score has no route through the browser, which is stronger than remembering not to read
  one.** The frame message type has no score field, so a `finished` carrying `score`, `rawScore`,
  `points`, `prize` and `rank` parses to an object with two keys. Proven behaviourally rather than
  structurally, and asserted on the **whole** object, because a field you did not think to check is
  the only way to notice one you did not expect.
- **The sandbox omission is the feature.** `allow-top-navigation` is absent, so a game cannot
  navigate the player's entire page away from ChartVolt - which a provider bug or a compromised
  game would do mid-contest, looking to the player exactly like our site crashing.
- **`!expectedOrigin` appeared twice, and the first test could not tell the two apart.** One copy
  skips attaching the listener, one refuses the render. A probe that killed the **render** guard
  left the suite green, because the listener's copy satisfied a bare `/if \(!expectedOrigin\)/`.
  Fourth instance of the weak-structural-test class: **assert position within the construct and
  count the occurrences**, never a bare identifier.
- **The `**/games/*` ESLint wildcard collided for the FOURTH time**, on `components/games`, after
  `database/models/games`, `lib/services/games` and `components/admin/games`. One negation, as
  expected. Written as a separate exception rather than a blanket `!**/components/**`, because a
  components folder is exactly where somebody would eventually put a game module's own logic "to
  keep it near the screen".

**Owner tested:** not yet. Verified here: 797 tests pass (up from 796), `tsc --noEmit` at **17
errors, byte-identical to baseline** with none in the changed files and none disappearing, lint
clean on every new file, `check:mirrors` green. `next build` **compiles successfully** but fails at
static export on `/arena` with `ReplicaSetNoPrimary` - **confirmed pre-existing by stashing and
rebuilding**, so it is Atlas being unreachable from this machine, not this change.

**Deferred, and none of it is silent:** no live leaderboard during play (`13` s11's polling
recommendation); no practice mode; **no game-aware dashboard** - `ActiveCompetitionCard` and
`CompetitionsTable` still render PnL, positions and recent trades and label the action "Trade Now",
so the destination is right but the card is still trading-shaped, and making it game-aware is a
rewrite of components every trading player sees daily; and **no CSP `frame-src` allowlist**, because
there is no Content-Security-Policy in `next.config.ts` at all and **nothing to allowlist yet** -
`game_provider` stores the provider's *API* host and the play domain is a fact X4 collects from a
real provider.

**Next chat should:** stop building and **find a provider** (`08`). Nothing in the programme is
blocked on engineering now; X4 is blocked on a commercial decision.

---

### 5 Sep 2026 - TWO P0 PAYOUT DEFECTS - THE SCORE SEAM WAS NEVER BUILT

**Shipped:** provider contests now pay the players who actually won. Two defects, both in the
money path, both found while mapping the code for the round inspector rather than by a test.

**Defect 1 - nothing wrote `participant.score`.** `applyResult` wrote `game_round` and stopped;
`buildParticipantSeat` seats every player at `score: 0`. So **every participant in a provider
contest would have settled on zero, tied at rank 1, and taken an equal share of the prize pool
regardless of how well they played.** Not a crash - in production it reads as a
prize-distribution bug, which is the same disguise the trading `pnl` defect wore.

Fixed by `lib/services/games/participant-score.service.ts`, called from **gate 11b** of the
single ingestion function, after the round is saved. It **recomputes from persisted rounds
rather than incrementing**, which makes it idempotent and independent of arrival order - a poll
and a callback for one round carry different event ids by design, so gate 6 does not dedupe
them, and a late attempt-1 result can land after attempt 2. Aggregation follows
`attemptsPolicy`: `single` and `best_of_n` take the best attempt, `sum_of_n` adds them.

**Defect 2 - `scoreDirection` was read off a field that does not exist.** Settlement narrowed
`p.scoreDirection` from each participant; the field is declared on **neither**
`CompetitionParticipant` copy. So the read was `undefined` for every player and the fail-safe
default beside it was the *only* branch: **every lower-is-better contest - a race, a time
trial, golf-style scoring - ranked upward and paid the slowest player first.** Fixed by
`resolveContestScoreDirection`, which reads the catalogue title once per contest.

**Files touched:** `lib/services/games/participant-score.service.ts` (new),
`lib/services/games/result-ingestion.service.ts` (gate 11b + `participantScore` on the
outcome), `lib/services/settlement/provider-settlement.service.ts` **and its admin mirror**
(direction from the catalogue; the false comment corrected in place),
`__tests__/services/participant-score-sync.test.ts` (new, 9),
`__tests__/services/participant-score-arrival.test.ts` (new, 9),
`__tests__/services/provider-settlement.test.ts` (fixture corrected),
`tools/probe-score-seam.ps1` (new, 11 probes), `External game plans/05` s2.0a and s2.

**Deviated from plan:** the first fix declared `scoreDirection` on both participant copies,
which is the smaller diff and satisfies the read that already existed. **Reverted** - chapter
`05` s2 says direction is threaded in from the catalogue so that duplicating it per row cannot
create a second place for it to be wrong, and the failure that prevents is worse than the one
it costs: per-row storage lets two rows in one leaderboard disagree, so half the board negates
and half does not. A uniformly wrong direction is coherent and visibly wrong; an incoherent one
looks plausible and cannot be explained to a player. **The chapter was right and the code was
wrong** - the opposite of the usual drift direction.

**Owner tested:** not yet. **736 tests pass** (41 files, 18 new). All **11 probes red**,
including the one that matters most - removing the seam entirely, restoring the exact code that
shipped as "X5 code-complete", turns 5 tests red. Both typechecks back to baseline (**main 17,
admin 223**) after the diff caught a real assumption: `gameKey` is optional on the contest
document, so the direction resolver handles an absent label rather than asserting it away.
`check:mirrors` 79 agree, 0 drifted. ESLint clean on every changed file.

**Five things that generalise, and the last two are about how tests lie:**

- **An aside in a comment is a claim, not a fact.** `provider-settlement.service.ts` opened by
  asserting the seam existed. Fourth instance after `challengeId`, the R7 severity and
  `billsPerRound`, so carry the class, not the cases. The correction is left visible in the file
  rather than the tense quietly fixed.
- **"Code-complete" is not "correct", and a phase summary must not imply it is.** X5 was
  declared code-complete with both defects in it, verified by a green suite.
- **A fixture that supplies the value under test has tested the consumer, not the producer.**
  The settlement suites seed `score: 900 / 500 / 100` and rank them, which is silent on whether
  a score ever arrives. Second instance after trading's `pnl`. When a value crosses a seam, one
  test must start on the far side of it.
- **A raw-driver fixture can prove anything, because it is not bound by the schema the
  application writes through.** The settlement test seeded `scoreDirection` on participants via
  `db.collection(...).insertMany`, which bypasses Mongoose strict mode - so the test was green
  while no production path could write that field. It also guessed the collection name
  (`providergames`; the schema sets `provider_game`), and **writing to a collection nothing
  reads has the same symptom as writing the wrong value.**
- **An explicitly-typed `.lean<{...}>()` is a place a field that does not exist looks real.**
  The compiler checked the hand-written generic rather than the schema, which is why neither
  typecheck ever objected and the usual "errors that disappear after a model sync" signal was
  absent.

**Deferred:** nothing from this fix. Historical rows are unaffected - no provider contest has
ever settled, so there is nothing to backfill and **the fix must not be described as
retroactive**.

**Next chat should:** build the round inspector and manual resolution screen (X6), which is what
this work interrupted. Note the manual-resolution half needs an architectural decision recorded
first: the single ingestion function lives in the **main app only** and mirroring it would
create the second door for scores that chapter `02` s10 rule 3 forbids, so an admin-triggered
resolution cannot simply call it in-process. **(Built later the same day - see the round
inspector entry below, where that decision was taken: resolution ends a round, it does not
score one.)**

---

### 5 Sep 2026 - X6 SLICE - THE PUBLISH CONTROL, AND A TRADING-SHAPED LIST

**Shipped:** an operator can now publish a draft provider contest by clicking. Until today the
publish route had **zero callers anywhere in the repository** - the whole provider lifecycle was
reachable by API and by test only.

- `apps/admin/components/admin/games/PublishContestButton.tsx` - new. Posts to the publish
  route, renders the **accumulated** refusal list, raises warnings separately after the
  success message.
- `apps/admin/lib/admin/contest-game-label.ts` - new, admin-only, **not mirrored**.
  `hasProviderGameLabel()` and `resolveContestGameType()`.
- `apps/admin/components/admin/CompetitionsListSection.tsx` - `draft` in the status union, its
  own amber badge and icon, a **Drafts** summary card, a provider game badge, the publish
  control, and the trading Edit button **withheld** from provider contests.
- `__tests__/admin/provider-contest-publish-ui.test.ts` - 21 tests.
  `tools/probe-publish-ui.ps1` - 21 probes, all red.

**Deviated from plan:** `12` s3 described this as "game column, game filter, provider column".
Built the **game badge** and no filter, because the Drafts count plus the badge already answer
the question an operator has after the wizard redirects them here, and a filter control is
worth building once there is more than one provider game to filter by. Recorded in `12` s3.1a
rather than rewriting s3.

**The finding, and it is the reason this was more than a button.**
`CompetitionsListSection.tsx` was **already rendering provider drafts, wrongly, and silently.**
`GET /api/competitions` applies no filter, so drafts have appeared there since the wizard
shipped - and the screen's `Competition` interface did not admit `"draft"`, so it fell through
`getStatusColor`'s default into **the same grey the screen uses for a completed contest.** An
unpublished contest looked finished. Nothing errored, nothing logged. The trading-shaped
service failure in its UI form: **the screen kept working and kept being wrong.** Adding a
Publish button on top of that would have made the wrong control the easiest to press.

**Three further things that generalise.**

- **A helper's name is part of its contract, and reusing this one would have failed silently
  in the worst direction.** `isProviderContest` already exists in `contest-config.ts` and
  answers a **stricter** question - label *and* provider key *and* game code, because a
  labelled contest with no keys cannot launch a round. A screen asks *what kind of row is
  this*, and a half-built provider contest is still one for badging and for keeping out of the
  trading editor. Importing the strict helper would have compiled, read correctly, and
  rendered a keyless provider contest as a **trading** one - with the Edit button.
- **A control that would corrupt data must be withheld with its reason, not greyed out.**
  `/competitions/edit/[id]` renders the trading editor and `PUT /api/competitions/[id]` does a
  blind `Object.assign` of that form's body. Same reasoning as a provider switch that cannot
  work refusing with a reason.
- **A probe that stays green has a third cause: the test does not exist.** Blanking the game
  badge's condition left the suite green - the probe was aimed at a test asserting the strict
  helper is not *imported*, which the other two call sites keep satisfying. Not a weak test and
  not a wrong claim: **a missing one.** Added, re-aimed, red. And the first version of the
  Edit-guard test scanned 300 characters backwards, began mid-identifier, and reported a guard
  missing that was present - **a window whose size is a guess fails for reasons unrelated to
  the code under test.**

**Verified:** 718 tests green (21 new), all 21 probes red, admin `next build` clean, mirrors
79/0, lint clean on the changed files. Both typechecks **byte-identical to baseline by list
diff**, admin 223 and main **17**.

**A stale baseline figure corrected while measuring, because a count that nobody can reproduce
is worse than no count.** The main app is **17**, not the 16 recorded on 1 Sep - and the
difference is not a regression. Two of the 17 are `.next/**/validator.ts` entries pointing at
`app/api/fraud/suspicion-score/route.js`, the unprotected route **deleted** under Prerequisite
B; they are generated build residue that a clean build clears, so the real figure is 15 plus 2
artifacts. The 1 Sep row in the sync rule stays as written, because it is accurate as a
statement about 1 Sep. **Diff the lists, never the counts** - the count rose while the list was
identical.

**Deferred:** the round inspector, manual resolution and live-contest controls; a game filter
on the list; and provider contest **editing**, which the publish control makes more visible
rather than less.

**Not done, said plainly:** **no player screen starts a round**, so the play step is still
API-only and X7/E6 owns it. **(Built the same day - see the play-screen entry below.)** There is
deliberately **no unpublish** - a visible contest can already have been paid into, and
cancel-with-refund is the reversible operation.

**Next chat should:** build the round inspector (`12` s4) - round status, score, the raw
provider event and a manual resolution action with a mandatory reason and an audit entry.
**(Built the same day - see the entry below.)**

---

### 5 Sep 2026 - X6 SLICE - THE ROUND INSPECTOR AND MANUAL RESOLUTION

**Shipped:** an operator can see every round that needs a decision, read the raw provider
deliveries for it, and **end** it with a mandatory reason. Until today the only answer to a
stuck round was to wait for the four-stage reconciliation net and hope.

- `apps/admin/lib/admin/round-resolution-actions.ts` - new, model-free. The three actions,
  their target statuses, their operator-facing consequences, `MIN_REASON_LENGTH`, and a
  `Map`-based `isResolutionAction` guard. **Imported by both the service and the dialog.**
- `apps/admin/lib/services/games/round-resolution.service.ts` - new.
  `listRoundsNeedingAttention`, `getRoundDetail`, `resolveRoundManually`.
- `apps/admin/app/api/games/rounds/` - list, `[roundId]` detail, `[roundId]/resolve`.
- `RoundInspectorSection.tsx`, `RoundDetailPanel.tsx`, `ResolveRoundDialog.tsx` - new.
- `admin-employee.model.ts` - `round-inspector` added to `ADMIN_SECTIONS` (**add-only**).
- `AdminDashboard.tsx` - menu entry beside Game Providers inside GAMES, plus the render case.

**The architectural decision the previous entry said had to be taken first, taken: manual
resolution ends a round, it does not score one.** `applyResult` is the single ingestion door
and it lives in the **main app only**; mirroring it into admin to offer a score box would build
the second door chapter `02` s10 rule 3 forbids, in the app with the widest privileges and the
least traffic. So the operator writes a **status** - void, abandoned or expired - never a
number. That is sufficient rather than a compromise, because `assessUnresolvedRounds` derives
both of its answers from `round.status === "unresolved"`, so a round moved off that status
releases whatever it was holding.

**Files touched:** the eight above. **Verification:** 21 new tests
(`__tests__/admin/round-inspector.test.ts`), full suite green, **12 probes all red**, admin
`next build` clean, `check:mirrors` clean, lint clean on the changed files. `round-resolution-*`
and the admin API routes are **admin-only and not mirrored**, so `check:mirrors` says nothing
about them.

**Five findings, and the first is about the tooling rather than the code.**

- **The probe harness destroyed the file it was probing, and reported success.** Next.js dynamic
  routes contain `[roundId]`, which **PowerShell reads as a wildcard character class**, so
  `Get-Content $File` matched nothing and returned `$null` - while `Set-Content -LiteralPath`
  wrote it back perfectly well. The route was emptied and then "restored" to nothing. Every
  probe against it went red **on the expected test**, for entirely the wrong reason. The tell
  was the *failure count*: 5-7 tests red for a one-line change where the honest number is 1 or
  2. **A probe that reports more damage than it caused is not reporting on your guard.** Fixed
  with `-LiteralPath` on the read and a refusal to write when the read came back empty.
- **An import is not a use, and it defeated three assertions in one file.**
  `toContain("canTransitionRound")` stayed true when the call was replaced by a hand-rolled
  status check, because the name is still in the import line;
  `toContain("MIN_REASON_LENGTH")` stayed true when the check became `if (false)`, because the
  constant is still named in the error message; and `indexOf("resolveRoundManually")` found the
  **import on line 8** and compared an ordering against that. **Match the call with its
  arguments, and assert the operator rather than the operand.**
- **A shared list beats a duplicated one even when the duplication has a good excuse.** The
  action ids and their consequences were first written twice, because the service imports
  Mongoose models and a client component must not pull those into the browser. Real constraint,
  wrong answer - it is the **"one rule, two copies"** shape behind four defects here already
  (`referenceId`, `failedReason`, `challengeId`, the GM `||`), none of which `check:mirrors` can
  see. A model-free module both sides import removes the drift, whose symptom would have been a
  button offering an id the server had renamed, failing with a 400 that reads like a permissions
  problem.
- **An object lookup on a request-supplied key is not safe because it is guarded.** Both `in`
  and object indexing reach the prototype chain, so `"toString"` and `"__proto__"` pass the
  check - and `ACTIONS["__proto__"]` returns `Object.prototype`, which is **truthy**, survives a
  `!target` test and only fails later on a missing `.status`. **Safe by accident is not safe.** A
  `Map` has no prototype chain, so the lookup is total and the guard is the same object the
  server switches on.
- **Only `hold_and_alert` actually stops a contest settling**, so only those rounds carry the
  "holding settlement" badge. Badging every unresolved round would make it meaningless exactly
  where it must be trusted, since the other two policies settle on time. Same reasoning makes the
  dialog report whether settlement was **actually** released: a contest can be held by several
  rounds, and an operator told "settlement unblocked" while three others still hold it stops
  believing the message.

**Deferred:** provider **health** (the last of `12` s4's five destinations), live-contest
pause/extend/cancel controls, and provider contest **editing**. The inspector lists only rounds
needing a decision - unresolved, or live and past expiry - because including completed rounds
buries the handful that matter; completed rounds are reachable by id.

**Not done, said plainly:** an operator **cannot enter a score**, by design. Voiding a player's
only attempt means they finish on zero - `score_zero` applied by hand - and the dialog says so
**above** the confirm button, because that is a decision about a paying player's contest rather
than a cleanup task.

**Next chat should:** build the player-facing round launch screen (`09` E6). It is the last
piece of the provider lifecycle reachable only by API, and until it exists no player can play a
provider game by clicking.

---

### 4 Sep 2026 - X5 THIRD PIECE - THE UNRESOLVED-ROUND POLICIES - X5 CODE-COMPLETE

**Shipped:** all three of chapter `07`'s answers to a round that never reports. **X5 is
code-complete.**

- `lib/services/settlement/unresolved-rounds.ts` - reads which rounds are sitting at
  `unresolved` and turns the contest's policy into an instruction for this settlement run.
- `lib/services/settlement/exclusion-refund.ts` - returns the entry fee, writes a ledger
  row attributed to the competition, marks the participant `refunded`.
- `provider-settlement.service.ts` - refund before ranking, players filtered out of
  ranking, pool and participant count reduced, all in the settlement transaction.
- `provider-finalize.ts` - the `hold_and_alert` gate **before** the optimistic lock, and
  the lock release on a returned refusal.

**Files touched:** the four above plus their admin mirrors;
`lib/services/games/contest-preflight.ts` (the operator warning, which had become false);
`lib/services/games/reconciliation.service.ts` (comment); both copies of
`competition-cancel.actions.ts` (a wrong comment about the prize pool);
`__tests__/services/provider-settlement.test.ts` (+15),
`__tests__/services/provider-settlement-late-hold.test.ts` (new, 2),
`__tests__/services/provider-contest-create.test.ts` (one test flipped);
`tools/probe-provider-entry.ps1`, `tools/probe-reprobe.ps1`.

**Deviated from plan:** three ways, all worth keeping.

- **The tracked gap was one of two.** Every document presented the `exclude` refund as the
  last item. Nothing consumed `blocksSettlement` either, so a `hold_and_alert` contest
  **settled on time and paid out** while promising to be held. Both were closed together
  because they are the same read and the same insertion point.
- **Settlement does not consume `refundOwed` / `blocksSettlement`, as `09` E2 implied it
  would.** They are return values in a worker that has exited by the time a contest
  settles. Settlement re-derives both from `round.status = "unresolved"`, which is the only
  thing stage 4 persists - and that is also what makes a contest finalized by a path the
  net never drove honour the policy anyway.
- **Two pre-existing defects were fixed on the way**, both worse than the gap being closed.
  `exclude` did not merely fail to refund: `calculateRankings` never filters on participant
  status, so an excluded player stayed ranked and could be **paid a prize as well as being
  owed their fee back**. And `provider-finalize.ts` committed a `success: false` return
  without releasing the claim, so its first ever refusal would have parked the contest at
  `finalizing` permanently - unclaimable by any caller, cron or human. The file's own
  warning about the release being "easy to leave out and impossible to notice in a test
  that only checks the happy path" applied to itself, because **a `catch` block is not a
  refusal handler.**

**Verified:** full suite **683 green** (37 files), mirrors **79 agree / 0 drifted**, lint
clean, main typecheck **17** and admin **223** - both exactly at baseline, with no errors in
the changed files and none disappearing. 17 new probes: 14 red first time, and the three
that stayed green were resolved individually rather than waved through.

- **The pool reduction** was masked by the integrity cap, which recomputes the same figure
  from the already-reduced participant count. Needed a new test seeding a pool *below* the
  fees collected, where the cap has headroom and cannot cover for it.
- **The lock release and the in-transaction hold check** were unreachable, not useless: the
  pre-lock gate catches every refusal the ordinary suite can produce. Reached with a mocked
  assessment that answers differently with and without a session - which is exactly the
  race the second gate exists for.
- **Passing `contestId` as a string** stayed green because **the claim was wrong**:
  Mongoose casts a string to ObjectId when the query executes, verified directly. The
  comment was corrected. The raw MongoDB driver does *not* cast, which is why the test
  helper needs a real ObjectId - the two halves are genuinely different, and conflating
  them is what produced the false comment.

**Owner tested:** not yet.

**Deferred:** ~~the GM referral fee `|| 5` (R31)~~ **fixed 5 September 2026, see the entry
below.** Also still open at the time: ~~no admin button publishes a contest~~ (**built 5 Sep
2026**), ~~no player screen launches a round~~ (**built 5 Sep 2026**), the challenge path keeps
its own copy of settlement, and ~~R26 (the admin cron pays no Game Masters)~~ (**closed 5 Sep
2026**).

**Next chat should:** close the two X6 slices that make the lifecycle clickable - a publish
button and the round inspector.

---

### 5 Sep 2026 - R31 - A CONFIGURED 0% REFERRAL RATE - FIXED

**Shipped:** a Game Master rate configured at 0% now means 0% everywhere it is stored, read
or displayed. Not an X-phase - a defect carried out of the X5 extraction, fixed in its own
commit as that extraction promised.

**The register had the wrong branch, and checking before fixing is the whole story here.**
R31 said a 0% *package* was paid 5%. It was not: `resolveFeePercentage` reads the current
package first and that branch already tested `!== undefined`, so a package that exists and
says 0 returned 0. The three `||` sites were the **fallbacks onto the cached
`subscription.limits`**, reached only when the package has been deleted or the subscription
carries no `packageId`. Proven before any code changed - three of six new tests failed with
`expected 5 to be 0`, and the current-package one passed. **A fix aimed at the register's
sentence would have changed the one branch that was already right.**

**The larger half nothing had recorded.** Six writers copied a package's config onto a
subscription with `config.referralFeePercentage || 5`, so **buying a 0% package stored 5%** -
purchase ×2, `activate`, `renew`, the admin `fix-purchases` repair route, and a hand-run
script. That is the durable defect: the wrong value is persisted, a stored 5 is
indistinguishable from a deliberate 5, and it reached the **challenge** path through the data
rather than the code, since `challenge-finalize` resolves with `??` and faithfully paid the
5% that purchase had wrongly stored.

**And why a 0% package was almost certainly never created.** The admin editor declared the
input `min={0}` and then made 0 unreachable - a stored 0 rendered as 5, and `onChange` wrote
`parseFloat(e.target.value) || 5`, so **typing 0 was rewritten to 5 on the keystroke.** A
control that advertises a value and silently refuses it. This is what makes R31 **latent
rather than an active loss**, and the entry now says so.

**Files:**

- `lib/services/gamemaster/subscription-limits.ts` (**new**, mirrored) -
  `buildSubscriptionLimits()`, now the only writer of the cached limits shape. Used by
  purchase ×2, `activate`, `renew`, `fix-purchases`.
- `lib/services/settlement/game-master-fees/calculate.ts` (+ mirror) - three fallback
  expressions become one `cachedRateOrDefault()`.
- `apps/admin/components/admin/MarketplaceSection.tsx` - the input keeps 0, in the value, the
  handler and the `>= 10` warning threshold.
- Displays: the marketplace page, the arsenal card, the package summary, the AI content
  prompt, and `GET /api/gamemaster/competitions`.
- `tools/gamemaster/report-stale-subscription-limits.ts` (**new**) - report-only, lists
  subscriptions whose cached limits disagree with their package.

**`Number.isFinite`, not a bare `??`, and this is the part a one-character fix gets wrong.**
These values arrive from `parseFloat` on an admin form, so `NaN` is one keystroke away, and
`??` passes it onto a required `Number` path. A `NaN` percentage is worse than the bug being
fixed: every multiplication downstream becomes `NaN` and nothing checks. **`||` was wrong
about 0 and accidentally right about `NaN`; the fix has to keep the second half.**

**Not repaired retroactively.** A code fix changes future writes only, so existing
subscriptions still hold whatever `|| 5` produced. The tool is report-only. Renewal re-copies
from the package, so an auto-renewing subscription repairs itself within one period - which is
why this is a report worth reading before deciding to write anything, not a migration to run
blind.

**Deferred, and named rather than left silent:** `scripts/fix-existing-gm-purchases.ts:240`
is the seventh writer and still holds `|| 5`. It is hand-run, carries its own local types and
no path aliases so it cannot import the shared builder as written, and it was not editable
from this environment. It is the one path that can reintroduce a stored 5% over a 0% package.
Three `|| 0` display sites were left **deliberately** - a stored 0 renders as 0 when the
fallback is the same number, so the expression is odd and the behaviour is right.

**Verification:** 697 tests pass (14 new); **8 probes all red**, including one that required
strengthening a test - see below. `check:mirrors` 79 agree / 0 drifted. Typecheck error lists
**diffed, not counted**, against a stashed baseline: main identical at 17, admin identical at
223 with three errors merely shifted one line by an added import. The one new lint warning was
also a line shift, the same pre-existing unescaped apostrophe 12 lines lower.

**One probe stayed green, and it was a weak test of mine.** Removing the `!== undefined` check
left the suite green because the test seeded the package at 0% *and* the cache at 0%, so the
wrong branch produced the right answer. Fixed by seeding the cache at 5, which makes the
assertion say which source was read. **Two sources have to disagree before a test can prove
which one is used** - the general form of the same trap that made the pre-lock hold gate
unprovable by status alone.

**Owner tested:** not yet.

---

### 4 Sep 2026 - X5 SECOND HALF - ROUND LAUNCH AND SETTLEMENT - CODE-COMPLETE

**Shipped:** a provider contest can now be **played and paid**. With the first half, that
completes the lifecycle end to end apart from the `exclude` refund.

- `lib/services/games/round-launch.service.ts` and
  `POST /api/competitions/[id]/rounds` - the player-facing surface over X3's round service.
- `lib/services/settlement/` (mirrored into the admin app) - the three stages that are
  about money rather than about trades, **extracted** from `finalizeCompetition`:
  `prize-payout.service.ts`, `fees.service.ts` (platform fee, unclaimed pool, Game Master
  share), `contest-completion.service.ts`, plus `game-master-fees/` split into
  `calculate.ts` and `distribute.ts` to stay under the 500-line limit.
- `lib/services/settlement/provider-settlement.service.ts` composes those three behind
  `provider-finalize.ts`, which owns the optimistic lock, the transaction and the
  transient-error retry - the same wrapper shape as the trading path.
- `resolveSettlementPath` in `lib/games/settlement.ts` extends X1's seam-3 gate from
  "trading or refuse" to "trading, provider, or refuse".
- `lib/actions/trading/competition-end.actions.ts` **1885 -> 1174 lines**, rewired onto
  the three shared services.

**Deviated from plan:** none on the design. `11` seam 3 called for exactly this extraction
and it is what was built. Two facts in that chapter were **stale rather than wrong** and are
corrected there: the file is no longer ~1,500 lines, and the sweep is no longer at line
1807. The **ten** call sites it counts are confirmed accurate - 6 `finalizeCompetition`
plus 4 `finalizeChallenge`, re-counted rather than assumed.

**Four latent defects found and fixed on the way, three of which affected TRADING already.**
The point of recording them together: they were all found by *generalising* code, not by
looking for bugs, which is the recurring argument for doing the extraction rather than
writing a second copy.

- **`Competition.finalLeaderboard` declared only trading's numeric fields**, so strict mode
  silently discarded `isTied`, `qualificationStatus` and `disqualificationReason` on **every
  finalization that has ever run**. Trading computes all three and stored none of them.
  Declared in both copies, and round-tripped through a real save by a test - because
  declaring a field is not evidence it stores.
- **`split_weighted` tie distribution divided by the sum of participants' capital with no
  guard.** A tie between wiped-out accounts produced `NaN` prizes. Latent since before X5.
- **`worker/jobs/early-end-check.job.ts` logged `finalizeResult?.message`** on failure, but
  failures carry `error` - so every failed finalization was recorded as the bare string
  "Failed to finalize" with no reason, at two sites. X5 adds a refusal this would have
  swallowed, which is why it was fixed here rather than noted.
- **`ParticipantData` required trading's fields**, so the ranking service could not be
  handed a participant that has a score and no capital.

**One defect was deliberately NOT fixed, and the reason matters more than the defect.** The
Game Master referral fee resolves as `limits.referralFeePercentage || 5`, so a package
configured at **0%** is falsy and the platform pays 5% commission nobody agreed to. Writing
`??` fixes it in one character. It was preserved verbatim through the extraction anyway,
because the entire value of moving 900 lines of money code is that the payout tests staying
green *means* something - a behaviour change smuggled in alongside would have destroyed that
guarantee for one line. **New evidence found while documenting it**, which upgrades it from
"looks wrong" to "the two money paths disagree": `challenge-finalize.actions.ts` lines 994
and 1000 use `??` for the same lookup. Recorded as its own task.

**Deferred:**

- **The `exclude` refund.** Unblocked now - the transaction it must join exists.
- **The challenge path.** `challenge-finalize.actions.ts` (1,803 lines) still holds its own
  copy of all three stages. Not touched, on purpose: a challenge is its own money flow and
  the second extraction is X10, not a free by-product of this one.
- **The admin cron's finalize copy** still does not pay Game Masters at all (R26). The
  shared services now exist in `apps/admin`, so the fix is smaller than it was, but it is
  a money-path change with its own test burden. **Closed 5 September 2026** - see the R26
  entry at the top of this log.
- **No player screen** calls the launch route. That is X7.

**Verification:** 666 tests pass (36 files). **27 probes, all red** - including the five
trading payout tests and the golden ranking regression, which are the proof the money path
is unchanged. `check:mirrors` 79 agree / 0 drifted. Lint clean. Main typecheck 17, of which
2 are stale `.next` generated validators referencing the route deleted in Prerequisite B and
15 are the pre-existing set, none in changed files. Admin typecheck **225 -> 223**, and the
drop was chased down rather than accepted: six errors merely moved line numbers when the
file shrank, and the two that genuinely vanished are the worker logging bug above - real
code reaching for a field its own type denied it.

**One probing lesson, and it found a weak test rather than weak code.** The probe that
deletes the pre-lock game gate **stayed green**. The reason is that the older post-lock X1
gate refuses an unknown game too, so the contest ends up back at `active` either way and a
status-only assertion cannot tell the two apart - the difference is only that the pre-lock
gate never *claims* the contest, so a crash between the two writes cannot strand it in
`finalizing`. Fixed by asserting `updatedAt` never moved, which is the only surviving
evidence. **When a probe stays green, decide whether the test is weak or the claim is wrong
before assuming either** - this is the second time that question has had different answers
on the same day.

**Next chat should:** close the `exclude` refund, then fix the GM `||` as its own commit.

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
false and no player screen exists for a provider contest. **(A play screen was built 5 Sep 2026 -
correct as history, stale as a present fact.)**

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
**(The inspector and manual resolution were built on 5 Sep 2026 after all - the reconciliation
net turned out to be the only answer to a stuck round, which is not an answer an operator can
give. Health remains outstanding for the reason above.)**

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
 **Both deferrals closed 4 Sep 2026** (see the X5 third-piece entry). Kept as written
 because it is an accurate record of what X3 decided - but note X5 did **not** consume
 `refundOwed`, since a return value cannot cross a process boundary; it re-derives the
 obligation from `round.status = "unresolved"`.

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

**Amended 5 September 2026, and only the second sentence changed: one in-house game IS being
built**, as a hedge (X4a, `21`). The scenario question itself stays closed - the route is still
external-first, and this folder is still the operative plan. **Correct as a record of what was
decided on 2 September; stale as a description of today.**

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
