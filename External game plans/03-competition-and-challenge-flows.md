# 03 - Competition and Challenge Flows

The two contest formats end to end, the timing rules that make them fair, and the
decisions that must be made per contest.

---

## 0. No contest is ever a solo activity

Stated first because the phrase "independent play" elsewhere in these documents
describes **how the gameplay works, not how many people are competing**, and the two
have been confused.

| Format | Players | Prize | Existing equivalent |
|---|---|---|---|
| **Competition** | **Two or more.** Many is the normal case | Winners share the pool by finishing position | A trading competition, exactly |
| **Challenge** | **Exactly two.** One player challenges another | Winner takes the pot, minus the platform fee | A trading challenge, exactly |

**There is no single-player paid format, and none is proposed.** A player alone is
practising, not competing, and practice is free and unranked - see section 5.1.

### Why "independent play" does not mean "playing alone"

An independent-play game is one where each player plays **their own round** and receives
their own score, rather than needing a live opponent in the same session. Every one of
those players is still ranked against every other player in the contest, and they are
still competing for the same pot.

**Trading is itself an independent-play game.** Every trader in a ChartVolt competition
trades their own account, on their own, at their own pace - and they are all ranked
against each other for a share of the same prize pool. Nobody would call a trading
competition a solo activity, and the same reasoning applies to a trivia or chess-puzzle
competition.

The distinction only exists because it decides **which contest formats a game can
support**. It has nothing to do with contest size:

| | Independent play | Head-to-head |
|---|---|---|
| Competition of 100 players | **Works today** | Needs a bracket engine |
| Challenge, 1 v 1 | **Works today** | **Works today** |
| Example | Trading, trivia, chess puzzles, word games, time-attacks | Full chess, checkers, backgammon |

### The minimum-players rule already exists and is reused unchanged

This is not new work. `Competition.minParticipants` is already on the model
(`database/models/trading/competition.model.ts` line 12), and
`lib/actions/trading/competition.actions.ts` already enforces it:

- `minParticipants` **defaults to 2** at creation (line 290) and again at evaluation
  (line 71)
- If fewer than the minimum have joined when the competition should start, it is
  **auto-cancelled and every entry fee refunded** (lines 79-92)
- A competition that somehow became `active` below the minimum is cancelled and
  refunded as well (lines 123-134)

A provider-game competition inherits all of this, because it is the same competition
model and the same code path. **Nothing in this plan may weaken it.**

---

## 1. Competition - many players, ranked

The direct equivalent of a trading competition, and the primary format.

### 1.1 Lifecycle

| Phase | What happens | Who owns it |
|---|---|---|
| **Draft** | Admin picks provider, game, settings, entry fee, prize split, player limits, schedule | ChartVolt |
| **Upcoming** | Players see it and pay to join. Entry fee goes to the prize pool | ChartVolt (existing) |
| **Live** | Players open the contest and play their round(s). Scores arrive and the leaderboard updates | Provider plays, ChartVolt scores |
| **Settling** | New rounds blocked. Outstanding results collected within the grace period | ChartVolt |
| **Completed** | Ranked, prizes paid, fee taken, rewards awarded | ChartVolt (existing) |

### 1.2 The three windows

Getting these right is what stops most of the disputes.

```
   registration          play window                grace
 |---------------|--------------------------|------------------|
 opens        closes /                    closes            settle
              play opens
```

| Window | Rule | Why |
|---|---|---|
| **Registration** | Closes at or before the play window opens | Late joiners must not see others' scores before choosing to enter |
| **Play** | Rounds may only be **started** inside it | A round started at the last second must not run past settlement |
| **Grace** | No new rounds. Only outstanding results collected. Default **10 minutes**, and at least `maxDurationSeconds` + 5 minutes | A player finishing on the buzzer must still be scored |

**A round must be startable only if `now + maxDurationSeconds <= playWindowEnd`.**
Without that rule a player starts a ten-minute game with thirty seconds left and
either loses their attempt unfairly or delays everyone's prizes.

### 1.3 Attempts policy - a required per-contest setting

| Policy | Behaviour | Best for |
|---|---|---|
| `single` | One round only | Highest tension, cheapest to run, easiest to explain |
| `best_of_n` | Up to N rounds, best score counts | Rewards persistence, reduces bad luck. Costs N times as much if the provider charges per round |
| `sum_of_n` | Exactly N rounds, scores summed | Endurance formats |
| `unlimited_in_window` | Play as often as you like, best counts | **Not recommended** - favours whoever has the most free time, and costs are unbounded |

Default: **`single`**, unless the game is very short.

Two things must be enforced regardless of policy:

- **Attempt consumption.** An attempt is consumed when the round is *created*, not
  when it completes. Otherwise a player quits any bad round and retries forever.
- **One live round at a time**, per player per contest. Two open rounds is how
  duplicate scores and race conditions appear.

### 1.4 Minimum participation

Two separate rules, often conflated. Both are needed.

**Minimum players, to run at all.** `minParticipants`, default 2, enforced already -
see section 0. Below it the competition is cancelled and everyone refunded. No
provider-specific behaviour.

**Minimum play, to win a prize.** Mirrors the minimum-trades rule in trading
competitions: a player who joins and never plays must not take a prize on a tie-break.
Players with no completed round are **excluded from prizes** but still count toward the
prize pool, exactly as disqualified traders are handled today.

The second rule creates an edge case the first does not cover: **three players join,
only one actually plays.** The competition met its minimum and ran legitimately, but
only one participant is prize-eligible. Options, to be decided per contest:

| Policy | Behaviour | When to use |
|---|---|---|
| `award_anyway` | The single qualified player takes the winning share | Default. They did what was asked |
| `refund_all` | Cancel and refund everyone | Very small contests where one player winning a pot funded by non-players reads badly |

Whichever is chosen, the remainder of the pool follows the existing rules - it is
either distributed by the prize split or moved to the unclaimed pool. **No new money
path.**

### 1.5 Ranking

1. Rank by `rawScore`, respecting the game's `scoreDirection`
2. Tie-break by shorter `durationMs`
3. Then by earlier `completedAt` - first to achieve the score
4. Any remaining tie: **share the combined prize for those positions equally**

Ties will be common in games with small integer score ranges, so shared positions
are the default rather than an edge case.

---

## 2. Challenge - one against one

### 2.1 Independent-play games (Family A)

Both players play the **same content** independently, higher score wins.

```
Challenger picks game + stake -> pays entry
        |
Opponent invited or matched -> accepts, pays entry
        |
Both entries form the pot; both get the SAME contentSeed
        |
Each plays their round within the challenge window
        |
Both resolved -> compare -> winner takes the pot minus platform fee
```

**Both players must receive the same `contentSeed`.** A challenge where each player faced
different questions is not a contest, it is two unrelated scores compared.

| Situation | Resolution |
|---|---|
| Both complete | Higher score wins; standard tie-breaks |
| One plays, one does not | The player who played wins |
| Neither plays | Void - both fully refunded |
| Exact tie after all tie-breaks | Pot split evenly, platform fee still applies |
| One abandons mid-round | Scored as reported. Counts as played |

### 2.2 Head-to-head games (Family B)

Requires provider support for a match with two players. Both join a provider-hosted
match; the provider reports a winner and per-player scores.

Additional cases to handle:

| Situation | Resolution |
|---|---|
| One player never joins the match | No-show forfeits after a countdown; opponent wins |
| Both disconnect | Void and refund |
| Provider reports a draw | Split the pot |
| Match never reports | Reconciliation, then void and refund - see `07` |

### 2.3 Challenge windows

Challenges need an acceptance window as well as a play window:

- **Acceptance window** - the challenge expires if unaccepted, e.g. 24 hours, and the
  challenger's entry fee is refunded automatically
- **Play window** - once accepted, both must play within it, e.g. 24 hours

Without an expiry, credits sit locked in unaccepted challenges indefinitely and
generate support tickets.

### 2.4 Who the opponent is

**Added 2 September 2026.** The flow above says "opponent invited or matched" and stops
there. That single phrase was carrying the whole of opponent selection, and the owner's
brief asks for something specific: *"challenges must be able to challenge any user and
pick a game to create a challenge - now only for trading."*

Two halves, and only one of them was designed.

| Half | Status |
|---|---|
| **Pick a game** | Designed. Sections 2.1-2.3 above, plus `04` adding `gameKey` to `Challenge` |
| **Challenge any user** | **Not designed.** Today `POST /api/challenges` requires a `challengedId` - every challenge is a direct invitation to one named player. There is no open challenge, and `GET /api/landing/challenges` is an anonymised marketing feed that nothing can be joined from |

The full design, including opponent search, open challenges, interest-based matchmaking
and the abuse controls that letting anyone challenge anyone requires, is **chapter `20`**.
It is kept there rather than here because it is a player-preferences and matchmaking
feature that happens to terminate in a challenge, not a change to the challenge flow -
the money path, the windows and the resolution table above are all unaffected.

**Three things to carry from `20` into any work on this flow**, because they constrain it:

1. **`Challenge.challengedId` should stay required.** An open challenge has no opponent
   until accepted, which tempts a nullable field on a model that sits on the money path
   and is mirrored across both apps. `20` section 6 recommends a separate `OpenChallenge`
   collection that materialises a `Challenge` on acceptance instead.
2. **Willingness to be challenged is per game, not global.** `UserPresence.acceptingChallenges`
   exists and is a single platform-wide boolean. It is kept as a master switch; per-game
   opt-in is new.
3. **Open question 15 is unanswered:** may anyone challenge anyone, only friends, or only
   players who opted in for that game? It is an owner decision and it changes this flow's
   entry conditions.

---

## 3. Where the money moves

Unchanged from today, and worth restating because it is what keeps this project low
risk.

| Event | Money |
|---|---|
| Player joins | Entry fee debited from credits, added to the prize pool, ledger entry written |
| Player plays | **Nothing.** No money moves during gameplay, ever |
| Contest settles | Platform fee taken, prizes credited by finishing position, ledger entries written |
| Contest cancelled | Every entry fee refunded, pool zeroed |
| Challenge expires unaccepted | Challenger refunded in full |
| Round voided by provider | **No money moves.** The attempt is returned, not the fee |

The provider never appears in this table. That is the whole point.

---

## 4. Per-contest settings the admin must choose

Rendered dynamically from the provider's `configSchema`, plus these ChartVolt-level
settings:

| Setting | Default | Notes |
|---|---|---|
| Provider and game | - | Locked once anyone has joined |
| Game settings | From `configSchema` defaults | Validated against the schema before saving |
| **Minimum players** | **2** | Existing `minParticipants`. Below it, auto-cancel and refund |
| **Maximum players** | Game Master tier limit, or admin choice | Existing `maxParticipants` |
| Attempts policy | `single` | See 1.3 |
| Content seed strategy | `per_contest` | `per_contest` = everyone identical (required for fairness). `per_player` only for casual, unranked modes |
| Registration close | Play window start | Cannot be later |
| Play window | - | Must be at least `maxDurationSeconds` long |
| Grace period | 10 minutes | Minimum `maxDurationSeconds` + 5 min |
| Minimum participation | 1 completed round | Below this, no prize |
| Unresolved-round policy | `score_zero` | See `07-failure-modes-and-edge-cases.md` |

### 4.1 Validation before a contest can be created

These checks prevent the most common operator mistakes:

- The chosen game supports the chosen format (`supportsCompetition` / `supportsOneVsOne`)
- **`minParticipants` is at least 2** for a competition, and exactly 2 for a challenge
- The game is `active`, not `deprecated` or in `maintenance`
- Settings validate against the current `configSchema`
- Play window >= `maxDurationSeconds`
- Grace period >= `maxDurationSeconds` + 5 minutes
- `attemptsPolicy` other than `single` has an explicit cost acknowledgement if the
  provider bills per round
- A **live sandbox round** succeeded for this game and configuration in the last 24
  hours

That last check is worth the effort. It catches a broken or withdrawn game *before*
players pay to enter, rather than after.

---

## 5. What the player sees

| Screen | Content |
|---|---|
| **Browse** | Contest cards showing the game thumbnail, name, entry fee, pot, players, time left |
| **Lobby** | Rules, how scoring works, attempts allowed, play window, prize split, current leaderboard, Play button |
| **Play** | The iframe, plus a slim ChartVolt header with attempts remaining and time left |
| **Result** | Their score with breakdown, current position, attempts left, replay link |
| **Final** | Final standings, prize won, credits added, points/XP/badges earned |

Everything except the Play screen is shared with trading contests. Only the middle
step differs - the same principle as the `New games plan`.

### 5.1 Practice

If the provider supports it, offer a free practice round from the lobby. Players
will not pay to enter a game they have never seen, and a practice round costs
nothing but a provider call.

Practice rounds are marked `mode: practice`, are never scored, never counted as
attempts, and never appear on a leaderboard.
