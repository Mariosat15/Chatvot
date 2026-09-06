# 05 - Scoring, Points and Rewards

How a provider's raw score becomes a ranking, then cross-game points, then levels,
badges and milestones - reusing what already exists.

---

## 1. The three separate layers

Conflating these is the most common way multi-game platforms end up feeling unfair.

| Layer | Scope | Purpose | Who produces it |
|---|---|---|---|
| **Raw score** | One round, one game | Decides who wins **this** contest | The provider |
| **Normalised points** | Across all games | Cross-game leaderboards and progression | ChartVolt |
| **Skill rating** | Lifetime, per game | Measures how good a player actually is | ChartVolt |

The provider only ever supplies the first one. Everything else is ours, and stays
identical to the design in the `New games plan`.

---

## 2. Raw score - the only thing we take from the provider

```
provider result -> adapter -> NormalisedRoundResult.rawScore -> participant.score
```

### 2.0a BUILT, and the arrow above was missing for a day (5 September 2026)

The last hop is `syncParticipantScore` in `lib/services/games/participant-score.service.ts`,
called from gate 11b of the single ingestion function, **after** the round is saved.

**It did not exist when X5 was declared code-complete.** `applyResult` wrote `game_round` and
stopped, `buildParticipantSeat` seats every player at `score: 0`, and nothing in between. Every
participant in a provider contest would have settled on zero, tied at rank 1, and taken an
**equal share of the prize pool regardless of how well they played**. Real money, and in
production it reads as a prize-distribution bug rather than as a missing score.

Four things about how it hid, each of which generalises:

- **`provider-settlement.service.ts` asserted in a comment that the seam existed.** Fourth
  instance of the class, after `challengeId`, the R7 severity and `billsPerRound`: **an aside
  in a comment is a claim, not a fact.**
- **The settlement tests seed the scores they rank** (900 / 500 / 100), so they proved ranking
  works *given* scores and were structurally silent on whether one ever arrives. Second
  instance after trading finalization's `pnl`, so carry the rule: **a fixture that supplies the
  value under test has tested the consumer, not the producer.** When a value crosses a seam,
  one test must start on the far side of it - that is
  `__tests__/services/participant-score-arrival.test.ts`.
- **Aggregation happens here, not at settlement.** `attemptsPolicy` decides it: `single` and
  `best_of_n` take the best attempt, `sum_of_n` adds them. "Best" consults the direction, so an
  unconditional `Math.max` would rank a time trial by who was slowest.
- **It recomputes from persisted rounds rather than incrementing**, which is what makes it
  idempotent and order-independent. A poll and a callback for one round carry different event
  ids by design, so gate 6 does not dedupe them - and a late result for attempt 1 can arrive
  after attempt 2's. This is also why an operator-triggered re-sync is a safe operation.

### 2.0b The READ path had the same hole, and nobody looked for a day (6 September 2026)

Fixing 2.0a fixed where a score is **written** and where **settlement** reads it. There is a
third consumer, and it renders to players continuously rather than once at the end:
`getCompetitionLeaderboard`, in both apps.

Both copies were written for trading and both dropped the two fields a provider game ranks on.
The main app's projection listed trading metrics, so `score` was never selected at all; neither
app's `participantData` mapping carried `score` or `scoreDirection`. Every provider participant
therefore reached `calculateRankings` with an undefined score, `getProviderRankingValue` read
`score ?? 0`, **the whole field tied on zero, and the board rendered in tie-break or document
order.** Recorded as **R37**.

**Say what it did and did not cost, because the two halves triage differently.** No payout was
affected - settlement resolves both fields itself, so **nothing was backfilled and the fix is
not retroactive.** But the board is a live read, so a lower-is-better contest was **reversed on
screen and correct at the payout**: a player could lead a race-time contest all week and be paid
last, having been shown a ranking that looked deliberate the whole time.

**The fix moved the decision rather than copying it.** `resolveContestScoreDirection` was a
private helper inside `provider-settlement.service.ts` - which is precisely why the leaderboard
had none. It is now `lib/services/games/score-direction.service.ts`, mirrored, and used by
settlement and both leaderboards, so **the board a player reads and the payout that eventually
runs cannot rank a title differently.** Fifth instance of "one rule, two copies", after
`referenceId`, `failedReason`, `challengeId` and the Game Master `||` - and note again that
`check:mirrors` compares models, so it has never had an opinion about any of them.

Two rules from it, both of which apply well beyond scoring:

- **"Count the callers" has a read-side form.** The rule already caught four entry paths, ten
  finalize sites, six raw inserts and seven subscription writers. Here it is a *seam*: the
  producer and the money consumer were both fixed, and a third consumer nobody enumerated stayed
  broken. `rg` for the ranking function finds six call sites; **two are reads and both were
  wrong.**
- **`scoreDirection` still must not be stored per row.** Declaring it on the participant is the
  smaller diff and satisfies every read - and it is ruled out by section 2 for a reason worth
  restating: per-row storage lets two rows in **one** board disagree, so half the leaderboard
  negates and half does not. A uniformly wrong direction is coherent and visibly wrong; an
  incoherent one looks plausible and cannot be explained to a player.

Rules:

- **Ranking uses `rawScore` only.** Never `scoreBreakdown`, which is display detail
- **Honour `scoreDirection`.** For `lower_is_better` games - speedruns, chess-puzzle
  time, golf-style scoring - lower wins. Getting this wrong ranks the whole contest
  backwards and pays the worst player first
- **Never transform the raw score for ranking.** Store exactly what was reported.
  Any transformation makes disputes unanswerable
- **Comparable only within one contest**, because everyone shared a `contentSeed`
  and the same configuration

### 2.1 Applying the attempts policy

| Policy | Counted score |
|---|---|
| `single` | The one round |
| `best_of_n` | Best by `scoreDirection` |
| `sum_of_n` | Sum of all completed rounds; incomplete sets are ranked below complete ones |

The counted round is recorded as `bestRoundId` so a player can always be shown
exactly which attempt earned their position.

### 2.2 How `scoreDirection` actually reaches ranking - BUILT 4 September 2026

"Honour `scoreDirection`" above is a rule with an awkward implementation, and the awkward
part is worth stating because the tidy-looking alternatives are all wrong.

**Direction is a property of the TITLE, not of the module.** One `providerGameModule` serves
every title from every provider - that is the plug-and-play claim - but a puzzle game scores
upward and a time trial scores downward. A module-level direction constant would force one
module per title, which is the opposite of what the architecture is for.

**`participant.score` stores the RAW value, unnegated.** A leaderboard, a profile and a
cross-game aggregate all read that field, and a stored `-92.4` would show a race time as a
negative number in every one of them - and poison any cross-game total that sums it.

So the negation happens **at the moment of comparison, inside the module**, and the
direction reaches it on the participant:

```
provider result -> rawScore -> participant.score          (raw, displayable, stored)
title.scoreDirection -> RankableParticipant.scoreDirection (threaded in at settlement)
getRankingValue() -> lower_is_better ? -score : score      (never persisted)
```

**The engine performs exactly one sort, descending, for every game.** Returning `-92` for a
92-second run is what makes ascending order fall out of that same descending pass, with no
branch added to the engine and no game reaching in to change how sorting works.

Two consequences to keep:

- **`scoreDirection` is threaded in at finalization from the catalogue, not stored on every
  participant row.** It is a ranking input, identical for every player in a contest, and
  duplicating it per row would create a second place for it to be wrong.

  **This chapter was right and the code was wrong, until 5 September 2026.**
  `provider-settlement.service.ts` read `p.scoreDirection` off each participant - a field
  declared on **neither** `CompetitionParticipant` copy. So the read returned `undefined` for
  every player and the "fail-safe" fallback beside it was not a fallback but the only branch:
  **every lower-is-better contest ranked upward and paid the slowest player first.** It now
  reads the title once, via **`resolveScoreDirection` in
  `lib/services/games/score-direction.service.ts`** - a shared, mirrored module rather than the
  private helper it started as. It was made shared on 6 September 2026 when **R37** showed that
  keeping it private to settlement is exactly why both leaderboards had no direction at all; see
  section 2.0b. Any document naming `resolveContestScoreDirection` as a present fact is stale,
  though correct as history.

  Three lessons, and the first two are the reusable ones:

  - **An explicitly-typed `.lean<{...}>()` is a place a field that does not exist looks real.**
    The compiler checked the hand-written generic, not the schema, so neither typecheck ever
    objected - which is why the usual "errors that disappear after a sync" signal was absent.
  - **A raw-driver fixture can prove anything, because it is not bound by the schema the
    application writes through.** The settlement test seeded `scoreDirection` on participants
    through `db.collection(...).insertMany`, which bypasses Mongoose strict mode entirely. The
    test was green and the production path could not work. Seed through the model, or seed the
    thing production actually reads.
  - **The first fix went the wrong way, and this chapter is why it was caught.** Declaring the
    field on the participant would have satisfied the existing read with the smaller diff. The
    reasoning above rules it out, and the failure it prevents is worse than the one it costs:
    per-row storage lets two rows in one leaderboard disagree, so half the board negates and
    half does not. A uniformly wrong direction is coherent and visibly wrong; an incoherent one
    looks plausible and cannot be explained to a player.
- **The provider module ignores `rankingMethod` entirely.** Trading's six methods are six
  different questions you can ask of a trading account; a provider game reports one number.
  Offering an operator a choice here would be six labels for one behaviour - a setting that
  appears to work and changes nothing. Pinned by a test that asserts every method returns
  the same value.

---

## 3. Normalised points - the cross-game currency

Unchanged from the `New games plan`. Points come from **finishing position**, never
from the raw score, which is precisely why they work for a game we did not build and
whose scale we do not control.

```
points = f(finishing position, field size, entry stake)
      -> 0 to 1000 per contest
```

| Input | Effect |
|---|---|
| Finishing position | Primary driver. 1st of 100 is worth far more than 1st of 3 |
| Field size | Bigger fields earn more, with diminishing returns |
| Entry stake | Mild multiplier only, so paid contests matter more without letting money buy rank |

Because the conversion never looks at the raw score, **adding a provider game
requires no change to the points system at all.** A new title works on day one.

### 3.1 Anti-farming rules, restated

| Exploit | Control |
|---|---|
| Tiny private contests farmed for points | Minimum field size before points count |
| Free contests farmed for points | Stake factor, or a separate casual table |
| Repeated challenges against one friend | Steeply reduced points for repeat pairings within a window |
| Multiple accounts | Existing device, IP and identity checks, extended to count all games |
| Grinding a cheap game endlessly | Per-game daily points cap |

That last one matters more with an external provider than it did with trading,
because provider games are short. A game lasting three minutes can be replayed
hundreds of times a day, which trading never allowed.

---

## 4. Skill rating

Per `gameKey`, lifetime, adjusted by results against the field. Displayed as
"Trading 1840 . Trivia Blitz 1610".

- Points reward **playing a lot**; rating rewards **playing well**
- Rating is per game and never aggregated into a single number, because skill at
  chess puzzles says nothing about skill at trading
- New players start at a provisional rating that settles after a set number of contests

---

## 5. Levels, XP and badges

All existing machinery. What changes is that awards must be **attributable to a
game** so a player is never shown goals they cannot reach.

### 5.1 Three badge scopes

| Scope | Example | Applies to |
|---|---|---|
| **Platform** | First deposit, verified account, 10 contests entered, first win | Every player, any game |
| **Per game** | 1000+ in Trivia Blitz, sub-30s chess puzzle | Only players of that game |
| **Cross-game** | Won a contest in three different games | Rewards breadth - a genuinely new category worth adding |

### 5.2 The rules that protect the experience

1. **Never show a player badges for games they do not play.** An achievement list
   that cannot be completed demotivates rather than motivates.
2. **Never rename a badge identifier.** Identifiers are the keys to saved player
   progress; renaming one silently deletes achievements. Labels can change freely.
3. **Free win available immediately.** Many existing badges - contests entered, wins,
   podiums, deposits, verification, social - are already game-neutral in substance.
   Marking them platform-scoped gives provider-game players a full badge set on day
   one at zero content cost.

### 5.3 Per-game badges from provider data

A pleasant side effect of `scoreBreakdown`: badge conditions can use provider-supplied
detail without ChartVolt understanding the game. "Longest streak >= 10" works if the
provider reports `longestStreak`, and the condition is stored as data rather than code.

Requirement: badge conditions must be **declarative**, referencing breakdown keys, so
a new game's badges are configured in admin rather than written in code.

---

## 6. Milestones and journeys

Journey maps are already database-driven with an admin editor, so this is content
work, not engineering.

| Layer | Content |
|---|---|
| **Shared start** | Create account, verify, first deposit, first contest, first win, first withdrawal |
| **Per-game branch** | One branch per `gameKey`, with milestones tuned to that game |

Milestone thresholds should be set **after** real contests have produced data. There
is no way to know what counts as a good Trivia Blitz score before watching real
players attempt it.

---

## 7. Leaderboards

| Table | Ranked on | Notes |
|---|---|---|
| **Contest** | Raw score | Live during play |
| **Per game** | Points and rating for that `gameKey` | "Best Trivia Blitz players" |
| **Overall** | Total normalised points across all games | "Best players on ChartVolt" |
| **Seasonal** | Points earned within a season window | Optional, drives repeat play |

Per-game tables are keyed on `gameKey`, so a new provider game gets its own
leaderboard automatically with no code change.

The running-totals design from the `New games plan` matters more here: provider
games generate far more contests than trading did, so recomputing a global
leaderboard on every read would degrade quickly.

---

## 8. What the player sees after a round

Transparency is what makes an externally-computed score feel fair rather than
arbitrary.

| Element | Source |
|---|---|
| Their score | `rawScore` |
| How it was made up | `scoreBreakdown`, rendered generically as label and value |
| Current position | ChartVolt |
| Attempts remaining | ChartVolt |
| Replay link | `replayUrl`, if provided |
| Points, XP, badges earned | ChartVolt, after settlement |

The breakdown renderer must be **generic** - iterate the keys the provider sent, with
optional friendly labels configured per game. Hard-coding a layout for each game
reintroduces exactly the per-game code the architecture is designed to avoid.

---

## 9. Settlement order

Unchanged from today. Provider games slot in without touching it.

```
1. Collect final scores          <- the only new step
2. Apply minimum participation
3. Rank, resolve ties
4. Calculate prizes from the pool
5. Take the platform fee
6. Credit winners
7. Award normalised points
8. Update ratings
9. Award XP and evaluate levels
10. Evaluate badges and milestones
11. Send notifications
12. Update leaderboards
```

Steps 2 to 12 are existing code. Only step 1 is new, and it is the subject of
`07-failure-modes-and-edge-cases.md`.

### 9.1 What X5 actually did to this list, 4 September 2026

**The order above held**, which is the useful result - the prediction that provider games
slot in without touching it was correct. What changed is *where the steps live*, because
"existing code" turned out to mean "existing code welded to position closing".

Steps 3 to 6 and 12 were **extracted** from `lib/actions/trading/competition-end.actions.ts`
into `lib/services/settlement/` (mirrored into `apps/admin`) so they can run without the
trading-only stages that used to precede them in the same transaction:

| Step | Now lives in |
|---|---|
| 3-4 Rank, resolve ties, calculate prizes | `competition-ranking.service.ts` + `distributePrizesWithTies` (unmoved; now reachable independently) |
| 5 Platform fee, unclaimed pool, Game Master share | `settlement/fees.service.ts`, `settlement/game-master-fees/` |
| 6 Credit winners | `settlement/prize-payout.service.ts` |
| 12 Statuses, final leaderboard, participant ranks | `settlement/contest-completion.service.ts` |

**One correction to make to this list rather than leave implied.** It reads as though step
12 "update leaderboards" merely stores what step 3 computed. It did not: `finalLeaderboard`
declared only trading's numeric fields, so `isTied`, `qualificationStatus` and
`disqualificationReason` were computed by step 3 and **silently discarded** by strict mode at
step 12, on every finalization that has ever run. Fixed and round-tripped by a test. The
general form is the one recorded across these documents already - **a value computed is not
a value stored**, and only a read of real saved data can tell the difference.

**Steps 7 to 11 are still trading-only in practice** and are X7's problem, not X5's. Nothing
in the provider settlement path awards normalised points, XP, ratings or badges yet, so do
not read "prizes paid" as "the cross-game layers are live" - section 10's rule still has to
be applied to them.

---

## 10. No aggregate may be trading-only

**Owner framing, 2 September 2026:** *"this engine now becomes a general competition
engine, not only for trading"* - covering the scoring, **its naming**, the calculations,
the finances, the badges and the journey elements.

Sections 1-9 already design the scoring layers for multiple games. What was never stated
is the rule that makes them binding, so it is stated here as a reviewable constraint:

> **Every number the platform shows a player, an operator or an accountant about
> performance must be defined for every game, or be explicitly labelled as belonging to
> one game.** There is no third option. A figure that silently means "trading only" while
> being labelled as a total is a defect, not a simplification.

### 10.1 Why this needs saying

The failure mode is not a crash. A trading-only aggregate on a multi-game platform keeps
computing, keeps rendering, and keeps being wrong - it reports a total that excludes most
of the player's activity. The player sees a number lower than their experience, the
operator sees revenue that does not reconcile, and nothing in the logs indicates a
problem. **This is the same shape as the mirror-drift and `canEnterChallenges` defects
found in Stage 0: the system reports success while storing or showing the wrong thing.**

### 10.2 The three legitimate outcomes for each existing aggregate

Every performance or money figure gets one of three dispositions, and the disposition is
recorded rather than assumed:

| Disposition | Meaning | Example |
|---|---|---|
| **Generalised** | Redefined to cover all games | Total winnings, contests entered, contests won, level, XP |
| **Per-game** | Kept, but explicitly scoped and labelled | Win rate in chess puzzles; PnL in trading |
| **Retired from the headline** | Still exists on the trading surface, no longer presented as a platform-wide figure | Total PnL, average trade size, Sharpe-style metrics |

**"Total PnL" is the clearest case, and it is a naming problem before it is a
calculation problem.** It is a trading metric. It cannot be generalised, because a chess
puzzle has no profit and loss. It therefore belongs in the third row - and a headline
figure that currently reads "Total Profit" has to become either a trading-scoped figure
or a genuinely cross-game one such as total winnings. Which one is a product decision;
leaving it ambiguous is not an option.

### 10.3 The surfaces this applies to

| Surface | Requirement | Chapter |
|---|---|---|
| Score naming and units | A "score" must state its game and direction. `scoreDirection` and `scoreType` exist per game for this reason | `04` s3.2 |
| Cross-game points | Normalised points are the only comparable currency across games | s3 |
| Skill rating | **Per game.** Never a single platform-wide skill number | s4 |
| Levels and XP | Generalised. XP from any game | s5 |
| Badges | Generalised where the achievement is generic; per-game where it is not. **A badge keyed on `gameKey` must never be silently re-scoped**, because `gameKey` is immutable and historical awards depend on it | s5 |
| Journeys and milestones | Content keyed on `gameKey`. A journey with trading-only steps must be gated on `tradingEnabled` | s6, `15` s2 |
| Leaderboards | Overall, per game, seasonal | s7 |
| Player profile and stats | Cross-game aggregates plus per-game breakdown | `13` |
| Financial reporting | Entry-fee volume, fee revenue, payout ratio and average pot **by game and by provider** - provider cost is per-provider | `12` s5 |
| Fraud thresholds | Entry throttles and detectors must count non-trading entries. Risk **R9** | `17` |

### 10.4 Two open questions this exposes

Neither blocks X1, and both are recorded in `PROGRESS.md` rather than decided here:

- **Is a player's cross-game rank one number or several?** (question 13) A single
  "overall" rank requires normalised points to carry real comparability; several per-game
  ranks are more honest but give no headline. Section 3 makes either possible; what the
  leaderboard *leads with* is a product decision.
- **Does historical trading performance enter the new cross-game aggregates?**
  (question 14) Backfilling makes trading players instantly dominant on a games platform.
  Starting at zero discards real history and will be read as a bug by existing players.
  The migration in `18` is written once, so the answer is needed before it.

---

## 11. Plug and play, in both directions

**Owner requirement, 2 September 2026:** *"when we add a new game it must automatically
be included in the calculation of stats, rankings etc with no additional coding. The
games must be plug and play - when we add one, all functions must work; same when we
remove a game."*

The adding half is already designed. **The removing half was not, and it is the half
that can corrupt data a player has already earned.**

### 11.1 What "no additional coding" actually guarantees, and where it stops

Being precise here matters, because the phrase can be read as a promise the architecture
does not make. Three different things get confused:

| What is being added | Code needed? | Why |
|---|---|---|
| **A new title from a provider we already integrate** | **None.** Data only | One module serves all provider games, with the title held as data - the 18 Aug decision. Proven by `12` s4's acceptance criterion: a new title becomes bookable with no release |
| **A new provider** | **An adapter** | Their API differs. `02` s3 isolates this to `lib/games/provider/adapters/` so nothing else changes |
| **A new in-house game type** | **A module** | Not in scope under the external-only decision, but the seam exists |

So the honest statement is: **adding a game is a data operation; adding a supplier is a
small, isolated code operation.** `12` s4.2 already carries this as "the limit of no
developer needed". Do not let a summary promise more.

### 11.2 The rule that makes auto-inclusion true

Auto-inclusion is not a feature to build, it is a property to preserve, and there is
exactly one way to lose it:

> **No aggregate, leaderboard, stat, ranking, badge rule or report may enumerate game
> types in code.** Anything containing a `switch` on game type, an `if (gameType ===
> "trading")`, or a hard-coded list of games is a place where the next game silently
> fails to appear.

The failure is invisible: the query runs, the page renders, and the new game is simply
absent. This is why invariant 1 in `11` s5 - the contest engine never imports a specific
game folder - is enforced with ESLint rather than left to review, and why every aggregate
must be keyed on `gameKey` (s7) rather than branched on.

### 11.3 Removing a game - "automatically included" implies "automatically excluded"

**This is the dangerous consequence of the requirement above, and it needs stating before
X1 rather than discovered in X7.** If overall points, ranks and levels are computed as
sums across enabled games, then disabling a game *retroactively reduces every affected
player's totals*. A player who reached level 12 partly through Trivia is demoted to
level 9 because an operator switched Trivia off. **No error, no log, no notification -
just a player whose progress went backwards and a support ticket nobody can explain.**

Three rules follow, and they are cheap to honour if adopted now:

1. **Disabling a game affects discoverability and new entry, never history.** It hides
   the game page, stops new contests being created and stops matchmaking suggesting it
   (`20` s4 already checks `assertGameEnabled`). It must not touch a single earned row.
2. **Earned progression is a ledger fact, not a recomputed sum.** Points, XP, levels and
   badges already awarded are immutable once granted. A total that is re-derived from
   currently-enabled games on every read is the defect; a running total that only ever
   moves forward is the fix. `05` s7 already prefers running totals for performance
   reasons - **this is the second, stronger reason for the same design.**
3. **A disabled game's history is retired, not deleted.** Its per-game leaderboard is
   hidden or labelled retired; the rows stay. This is precisely why `gameKey` is
   immutable - it is the join key for historical stats, so removing the key removes the
   ability to explain a player's own past.

**In-flight contests finish normally.** That behaviour already exists for
`tradingEnabled` (`New games plan/07`) and for `externalGamesEnabled` (`18` s6), so
disabling a game follows the established pattern rather than inventing one: let running
contests settle, or cancel with full refunds - never strand paid entries.

### 11.4 What this adds to X1

Nothing structural, which is the point of raising it early. It constrains two decisions
X1 makes anyway:

- Cross-game totals on `UserGameStats` are **accumulated on settlement**, not computed
  on read from the set of enabled games.
- `getEnabledGameTypes()` gates **creation, discovery and entry**. It must not appear in
  any stats or leaderboard read path.

If either is built the other way, the fix later is a migration over every player's
progression - which is exactly the class of change this programme is trying to avoid.
