# External Games Plan - Integrating a Third-Party Skill-Game Provider

> **STATUS: PLANNING ONLY. NO CODE WRITTEN. NO PROVIDER SELECTED.**
>
> Date: 18 August 2026, revised 30 August 2026

---

## Which scenario are you reading for?

This folder covers two decisions, and the answer changes what you need to read.

| Scenario | What it means | Read |
|---|---|---|
| **Add-on** | The `New games plan` is also being delivered - Stage 0, the game-module foundation, an in-house game, and all the platform-wide work. External games are an addition | `01`-`09`. The foundation is a prerequisite owned elsewhere |
| **External-only** | **Provider games are the only new games.** No in-house game is built. This folder must stand on its own | `01`-`09` **and** `10`-`18`. This plan owns the foundation and every platform-wide change |

Chapters `01`-`08` are identical in both scenarios: the provider contract, the
architecture, the flows, the data model, scoring, trust and provider evaluation do not
change based on whether an in-house game also exists.

**If external-only is the decision, start at `10-external-only-programme.md`.** It
defines the scenario, absorbs the foundation work this folder used to delegate, gives a
self-contained phase plan, and states the cost honestly.

### The one number to know before deciding

**External-only is not the cheaper route. It is the broader one.** Dropping the in-house
game saves about 3.5 weeks; doing a provider integration properly costs about 7. All the
platform work is the same either way.

| Route | To a second playable, payable game | To a full games platform |
|---|---|---|
| In-house game first | ~8-10 weeks | 12-17 weeks |
| External-only | ~11-14 weeks, gated on a signed contract | **20-26 weeks** |

What the external route buys is **breadth and no content burden** - potentially a whole
catalogue rather than one game, with the questions, artwork and refresh cycle as the
provider's cost, not ours. The full reasoning is in `10` sections 2 and 5.

---

## What this plan is

ChartVolt already runs paid skill competitions end to end: a player buys credits,
pays an entry fee to join a competition or challenge another player, competes,
and the winners share the prize pool. Around that sit points, ranking, levels,
badges, milestones, journeys and the full financial audit trail.

Today the only thing a player can compete *at* is trading.

This plan describes how ChartVolt can offer **games supplied by an external
company** - chess, trivia, puzzles, word games, arcade time-attacks - while keeping
the concept **exactly as it is today**:

```
buy credits -> pay entry fee -> join a competition or challenge -> play -> ranked by score
            -> winners share the pool -> points, badges, levels, milestones awarded
```

The only thing that changes is **who supplies the gameplay**. Everything else -
the money, the ranking, the rewards, the trust - stays ours.

**This plan is deliberately provider-neutral.** No provider has been chosen. The
central document, `01-provider-contract-specification.md`, defines what ChartVolt
*requires* from any provider. It doubles as the specification we hand to candidate
providers and the checklist we evaluate them against.

---

## The single most important architectural point

**The provider never touches money.**

They run games and report scores. That is all. ChartVolt collects the entry fee,
holds the prize pool, decides the ranking and pays the prizes - all in the existing
credit system that already works and is already reconciled.

This one boundary removes almost all of the risk from the project:

| Because the provider never touches money... |
|---|
| No wallet API to host for them, and no provider-initiated debits or credits |
| No third party can move a customer balance, ever |
| Our financial reporting, reconciliation and audit trail are untouched |
| A provider outage cannot corrupt money - only delay a contest |
| Switching provider, or running several at once, does not affect the money layer |
| The regulatory position is unchanged from trading competitions: entry fee in, ranked by skill, fixed prize by finishing position |

Keep this boundary absolute. Any provider proposing to hold balances, take bets,
or pay winnings directly should be rejected on that basis alone - see
`08-provider-evaluation-checklist.md`.

---

## Vocabulary used throughout these documents

Fixed definitions, because the same words mean different things to different
providers.

| Term | Meaning in this plan |
|---|---|
| **Provider** | The external company supplying games via an API |
| **Game** | One specific title from that provider, e.g. "Chess Puzzles", "Trivia Blitz" |
| **Round** | One player playing once, producing **one score**. The atomic unit |
| **Match** | A head-to-head round involving two players simultaneously (chess, checkers) |
| **Contest** | A ChartVolt competition or challenge. Our existing concept, unchanged |
| **Raw score** | The number the provider reports for a round, in the game's own units |
| **Normalised points** | Cross-game currency derived from finishing position, 0-1000 |
| **Result callback** | The signed server-to-server webhook in which the provider reports a score |

**The atomic primitive is the round: one player, one play, one score.**
Everything else - competitions, challenges, leaderboards, prizes - is built from it by
ChartVolt.

---

## The two families of game, and why the distinction matters

This is the most consequential design fact in the plan, and it determines what a
given provider can actually be used for.

### Family A - Independent-play games

Each player plays **independently** and receives a score. Trivia, puzzles, word
games, time-attacks, chess *puzzles*, memory games.

| Contest type | How it works | Difficulty |
|---|---|---|
| **Competition** (many players) | Every player plays the same configuration independently. Rank by score. | **Easy** - identical to a trading competition |
| **Challenge** (1 v 1) | Both players play the same configuration independently. Higher score wins. | **Easy** |

### Family B - Head-to-head games

The game **requires an opponent** and produces a winner, not an independent score.
Full chess, checkers, backgammon.

| Contest type | How it works | Difficulty |
|---|---|---|
| **Challenge** (1 v 1) | Exactly what the game is designed for. | **Easy** |
| **Competition** (many players) | Needs a **bracket, Swiss or round-robin** structure - many matches, pairings between rounds, byes, drop-outs, timeouts. | **Hard - a project in itself** |

### "Independent play" is about gameplay, not contest size

The single most-misread point in these documents, so it is stated plainly here and again
in `03` section 0.

**Independent play means each player plays their own round and gets their own score,
rather than needing a live opponent in the same session. It does not mean playing alone,
and it does not mean a one-player contest.** Every player is still ranked against every
other player, still competing for the same pot.

**Trading is itself an independent-play game.** Every trader in a ChartVolt competition
trades their own account, alone, at their own pace - and they are all ranked against each
other for a share of one prize pool. Nobody would call that a solo activity.

There is **no single-player paid format anywhere in this plan**:

| Format | Players | Prize |
|---|---|---|
| **Competition** | **Two or more**, `minParticipants` default 2, auto-cancelled and refunded below it | Winners share the pool by finishing position |
| **Challenge** | **Exactly two** | Winner takes the pot, less the platform fee |
| Practice | One | **None. Free, unranked, no prize** |

### The recommendation that follows

**Launch with Family A only.**

An independent-play game supports both competitions and challenges with the machinery we
already have. A head-to-head game gives us challenges immediately but competitions only
after building a tournament engine, which is weeks of work with a large surface of
edge cases (what happens when a player abandons mid-bracket, and the pot is real
money?).

If chess is wanted at launch, use **chess puzzles** - an independent-play format - rather
than full chess. It is recognisably chess, it ranks cleanly, and it needs no
bracket engine. Full head-to-head chess can be added later as challenges only, with
competitions deferred until a bracket engine is justified.

This distinction must be captured as a **capability flag** on each game so that the
admin panel cannot offer a contest format the game cannot support. See
`01-provider-contract-specification.md`.

---

## How a contest works, start to finish

```
1.  Admin creates a competition, picks provider + game, sets entry fee,
    prize split, player limits, schedule and game settings
2.  Player pays the entry fee in credits -> fee goes into the prize pool
    (existing ChartVolt code, unchanged)
3.  Player opens the contest and clicks Play
4.  ChartVolt asks the provider to create a ROUND for that player,
    with the contest's game settings
5.  Provider returns a short-lived launch URL
6.  Player plays inside an iframe
7.  Provider sends ChartVolt a SIGNED RESULT CALLBACK with the score
8.  ChartVolt verifies the signature, stores the score, updates the live
    leaderboard
9.  Contest window closes. ChartVolt waits a grace period for outstanding
    results, then settles
10. Ranking -> prizes from the pool -> platform fee -> notifications
    -> points, XP, badges, levels, milestones
    (existing ChartVolt code, unchanged)
```

Steps 2, 9's second half and 10 are **already built**. Steps 4 to 8 are the new
work.

---

## What is new, and what is reused

| Layer | Status |
|---|---|
| Credits, entry fee, prize pool, prize split, platform fee, refunds | **Reused unchanged** |
| Competition and challenge shell, statuses, scheduling, pause, cancel | **Reused unchanged** |
| Eligibility, fraud, KYC, restrictions | **Reused unchanged** |
| Minimum and maximum players, auto-cancel and refund below the minimum | **Reused unchanged** |
| Game Master referral earnings on entry fees | **Reused unchanged** - see `19` |
| Points, ranking, levels, badges, milestones, journeys, notifications | **Reused, extended per game** |
| Game Master contest creation | **Changed** - needs a game picker, and the game label set explicitly. `19` |
| Game module registry, game label, general score field | **From `New games plan` Phase 1 - prerequisite** |
| Provider adapter, round lifecycle, result ingestion | **NEW** |
| Signed result callback endpoint | **NEW** |
| Provider/game catalogue and admin screens | **NEW** |
| Reconciliation of rounds without results | **NEW** |

---

## Reading order

| # | Document | What it covers |
|---|---|---|
| **00** | `00-README.md` | **This file.** Concept, vocabulary, the two game families, index |
| **01** | `01-provider-contract-specification.md` | **The core document.** Exactly what ChartVolt requires from any provider. Send this to candidates |
| **02** | `02-integration-architecture.md` | Our side: components, adapters, sequence diagrams |
| **03** | `03-competition-and-challenge-flows.md` | End-to-end flows, timing windows, attempts policy, settlement |
| **04** | `04-data-model.md` | New collections and fields, all additive |
| **05** | `05-scoring-points-and-rewards.md` | Raw score to ranking to points, badges, levels, milestones |
| **06** | `06-trust-security-and-disputes.md` | Signing, idempotency, replay protection, anti-cheat, dispute handling |
| **07** | `07-failure-modes-and-edge-cases.md` | Provider outage, missing results, late results, refunds |
| **08** | `08-provider-evaluation-checklist.md` | Eliminating questions, scored checklist, pricing arithmetic, questions to send |
| **09** | `09-implementation-phases.md` | Phased plan for the **add-on** scenario - E1 to E9 |

### Only needed for the external-only scenario

These chapters cover what this folder previously delegated to the `New games plan`.
Chapters `01`-`09` above still apply in full; these are additions, not replacements.

| # | Document | What it covers |
|---|---|---|
| **10** | `10-external-only-programme.md` | **Start here for external-only.** Scenario definition, what changes, the self-contained X0-X12 plan, the honest cost comparison, and the six risks that exist only in this scenario |
| **11** | `11-foundation-and-seams.md` | The four seams where trading is welded in, the game-module contract, the trading regression test. Was `New games plan` P1 |
| **12** | `12-admin-panel-plan.md` | Navigation, RBAC, game-aware create wizard, analytics by game and provider, settings |
| **13** | `13-user-ui-and-routes.md` | The play dispatcher, provider scoping, dashboard, leaderboard, results, help, navigation |
| **14** | `14-terminology-and-wording.md` | The terminology layer, migration passes, and the identifiers that must never be renamed |
| **15** | `15-infrastructure-jobs-and-flags.md` | Flags, the trading master switch, price-feed gating, worker jobs, observability |
| **16** | `16-games-catalogue-and-marketplace.md` | The games catalogue as editable content, the no-pay-to-win rule, Game Master residuals |
| **17** | `17-risk-register.md` | Platform risks (R-series) and scenario risks (X-series), with three gates |
| **18** | `18-migration-testing-rollout.md` | Backfills, eight tiers of tests, rollout sequence, rollback per phase |
| **19** | `19-game-masters.md` | Game Masters on provider games: creating contests, referral earnings, tier limits, and the per-round-cost problem that can make a Game Master contest loss-making |

| - | `PROGRESS.md` | Status tracker - read this in any new chat |
| - | `ChartVolt-External-Games-Plan.html` | Illustrated version for reading and sharing |
| - | `ChartVolt-Game-API-Requirements.html` | **Sent to providers.** Same requirements as `01`, written for their engineers |

---

## Relationship to the `New games plan` folder

These plans are **complementary**, and the dependency runs one way.

The `New games plan` builds the **game module architecture**: the game label on a
contest, a general score field on a participant, the game registry, and the four
seams where trading is currently welded into the shared engine. That foundation is
required whether a game is built in-house or supplied externally.

This plan **replaces the first proof game**. Instead of building Trivia in-house to
prove the architecture, an external provider module proves it.

```
Stage 0 - prerequisite defect fixes          (New games plan, 00a)
    |
    v
Phase 1 - game module foundation             (New games plan, P1)
    |                                         REQUIRED BY BOTH PATHS
    +---> in-house game module (Trivia)      (New games plan, P2)
    |
    +---> external provider module           (THIS PLAN)
```

Both can coexist afterwards as two entries in the same registry, which is the
strongest possible proof that the architecture is real.

**Nothing in this plan reduces the need for Stage 0 or Phase 1.**

### If the `New games plan` is not being delivered at all

Then the dependency above does not disappear - **it moves into this folder.** Stage 0 is
still a prerequisite (it fixes live defects under the money layer, which no plan can skip)
and the game-module foundation is still required, because a provider game plugs into
exactly the socket an in-house game would have used.

That is what chapters `10`-`18` exist for. `10` restates the programme as X0 to X12 with
the foundation absorbed, and `11` owns the seam work directly.

---

## Honest assessment

| Aspect | Assessment |
|---|---|
| **Technical feasibility** | **High.** No money crosses the boundary, and the primitive is simple: create a round, receive a score |
| **Effort - add-on scenario** | **7.5-8 weeks** engineering on top of the game-module foundation, 10-12 weeks calendar to launch including the pilot |
| **Effort - external-only scenario** | **20-26 weeks**, because the foundation and every platform-wide change come with it. See `10` section 3 |
| **Is it cheaper than an in-house game?** | **No.** It is broader. Dropping the in-house game saves ~3.5 weeks; the integration costs ~7. The prize is a catalogue and no content burden, not a saving |
| **Hardest part** | Result ingestion done properly: signatures, idempotency, late arrivals, and rounds that never report |
| **Biggest technical risk** | A round that never returns a result while real prize money waits on it. Addressed in `07-failure-modes-and-edge-cases.md` |
| **Biggest commercial risk** | Per-round cost. If a provider charges per session, cheap or free contests can cost more to run than they earn. Modelled in `08-provider-evaluation-checklist.md` |
| **Biggest strategic risk** | Provider lock-in. Mitigated by the adapter boundary and by never letting provider concepts leak into shared code. **In the external-only scenario this becomes severe** - there is no in-house fallback game, so a provider who terminates leaves the platform with trading only. See `17` risk X2 |
| **Biggest scheduling risk (external-only)** | Nothing after X4 can be built without the provider's sandbox. Get a committed date, not a promise. See `17` risk X1 |
| **Regulatory position** | **Unchanged from trading**, provided games are genuinely skill-based. Any game whose outcome is materially determined by chance changes the analysis completely |

---

## The one rule that protects the whole design

> **Provider concepts must never leak past the adapter.**

The shared contest engine must never know a provider exists. It knows only that a
participant has a score. If provider identifiers, session formats or vocabulary
start appearing in the prize logic, leaderboards or admin reports, the abstraction
has failed and switching or adding a provider becomes a rewrite.

The test is the same as in the `New games plan`: **adding a second provider should
touch one folder and one registry entry, and nothing else.**
