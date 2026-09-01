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
