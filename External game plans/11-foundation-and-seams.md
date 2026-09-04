# 11 - Foundation and Seams (X1)

Chapters `01`-`09` treated this work as a prerequisite owned by the `New games plan`.
In the external-only scenario it is **owned by this plan**, and it is the phase that
must be done most carefully. Everything after it is additive and individually
shippable; this is the phase that can break trading.

The audit facts below were verified directly against the codebase, not assumed.

---

## 1. What already works, and does not need touching

The contest and money engines are already game-agnostic. This is why the programme is
an extension rather than a rebuild.

| Layer | Status |
|---|---|
| Contest shell, status machine, scheduling, pause, cancel | Generic |
| Credit wallet, ledger, entry fee, prize pool, prize maths, platform fee | Generic |
| Refund loop, unclaimed pool, Game Master revenue share | Generic |
| Entry gates - eligibility, fraud, KYC, restrictions | Generic |
| Badge, XP and journey infrastructure | Generic, database-driven |
| Wallet, messaging, notifications | Generic |

`distributePrizesWithTies()` in `lib/services/competition-ranking.service.ts` needs no
change at all. A provider game's prizes are paid by exactly the code that pays a
trading competition's prizes today.

---

## 2. The four seams

These are the only places where trading is welded into the shared engine. Each needs a
dispatch point so a provider game can plug in.

### Seam 1 - Ranking

| | |
|---|---|
| **File** | `lib/services/competition-ranking.service.ts` |
| **Function** | `getRankingValue` at **line 64**. Verified 4 Sep 2026 |
| **Correction** | The switch near line 95 is **not a duplicate** - it is `getTieBreakerValue`, a second trading-specific switch over `trades_count`, `win_rate`, `total_capital`, `roi`, `join_time`. It needs generalising too |
| **Bigger than one function** | The `ParticipantData` interface itself is entirely trading-shaped - `currentCapital`, `pnl`, `totalTrades`, `winningTrades`, `winRate`. The seam is the interface plus two switches, not a single function |
| **Also** | `lib/actions/trading/challenge-finalize.actions.ts` lines ~**491-628** duplicate the winner logic |
| **Today** | A `switch` over six trading metrics: `pnl`, `roi`, `total_capital`, `win_rate`, `total_wins`, `profit_factor` |
| **Change** | Dispatch to the game module. For a provider game the ranking value is the stored `score`, ordered by the game's declared `scoreDirection` |

Still among the cheapest seams in the codebase, and the most valuable - but "a single
function" understated it.

### Seam 2 - Participant performance record

| | |
|---|---|
| **Files** | `database/models/trading/competition-participant.model.ts` and `challenge-participant.model.ts` |
| **Today** | Trading fields only - capital, PnL, margin. **No general `score` field** |
| **Change** | Add `score: number`, plus the provider fields in `04-data-model.md`. **Additive only** - no trading field is removed |
| **Mirror** | Both files exist twice. `apps/admin/database/models/` must change in the same commit |

### Seam 3 - Settlement and finalization

| | |
|---|---|
| **File** | `lib/actions/trading/competition-end.actions.ts`, ~**1,500 lines**. Steps 2-4 are trading-specific |
| **Also** | `challenge-finalize.actions.ts` repeats the logic |
| **Change** | Extract the position-closing block to a trading game module, and dispatch on the game label before it runs |
| **Danger** | This is the highest-risk change in the whole programme. See risk **R3** in `17` |

**The entry-point count in this chapter was wrong. Re-measured 4 September 2026** at the
start of X1, by grepping for calls rather than trusting the list:

| Caller | Function |
|---|---|
| `worker/jobs/competition-end.job.ts:80` | `finalizeCompetition` |
| `worker/jobs/early-end-check.job.ts:182` **and `:664`** | `finalizeCompetition` |
| `app/api/competitions/[id]/claim-early-end/route.ts:100` | `finalizeCompetition` |
| `lib/actions/trading/competition.actions.ts:158` - the lazy auto-finalize | `finalizeCompetition` |
| `checkAndFinalizeCompetitions()` sweep, `competition-end.actions.ts:1807` | `finalizeCompetition` |
| `worker/jobs/challenge-finalize.job.ts:153` | `finalizeChallenge` |
| `app/api/challenges/[id]/route.ts:50` | `finalizeChallenge` |
| **`app/(root)/challenges/[id]/page.tsx:109`** - a page render | `finalizeChallenge` |
| `finalizeEndedChallenges()` sweep, `challenge-finalize.actions.ts:1653` | `finalizeChallenge` |
| `apps/admin` copies of both sweeps, plus 3 calls in `end-logic-tests/run` | both |

That is **ten call sites in the main app alone**, not five. Three were missing from the
list entirely - both `early-end-check` calls, the `claim-early-end` route, and a
**finalize invoked from a page component**. `POST /api/finalize-old-competitions` **does
not exist**; the sweep is the two in-file functions above.

**This is the Stage 0 lesson repeating:** Defect 1's plan said two entry paths and grep
found four. *Count the writers before unifying anything.*

**The design consequence, and it is the important part.** The original instruction -
"every one must dispatch" - puts a dispatch at each call site, which is only correct
while the list is complete and stays complete. It will not: this codebase adds finalize
callers, and a page component was already one of them. **Dispatch goes *inside*
`finalizeCompetition` and `finalizeChallenge` instead**, which makes every caller correct
by construction, including the ones nobody has written yet. That is four dispatch points
- two functions across two apps - rather than ten-plus and counting.

Missing one means a provider contest is settled by trading code: every score read as
zero, every rank equal, and prizes paid to the wrong players. **Silently.**

#### Seam 3 BUILT 4 September 2026

`lib/games/settlement.ts` holds `routeToTradingSettlement`, mirrored into the admin app and
called from all four finalize functions. The golden baseline stayed **byte-identical**, so
no trading payout moved. Pinned by `__tests__/services/settlement-dispatch.test.ts`
(19 tests), including a structural check that all four functions call it and that each
gates *before* closing positions.

Four things learned building it:

- **A gate reached after the optimistic lock must release it.** Three of the four paths set
  status to `finalizing` first. Refusing without restoring `active` strands the contest
  permanently and it never pays out - worse than the bug being guarded against. The
  wrappers therefore gate before the retry loop; the private attempt functions carry a
  second check that restores `active`.
- **The admin `finalizeCompetition` has no retry wrapper and no lock**, loading the
  competition inside a transaction instead. **The four functions are not four copies of
  one function** - read each before editing it.
- **`getCompetitionLeaderboard` was ranking without the game label** in both apps. It is
  correctly *not* gated, being a read path, but without the label it would rank a provider
  contest by trading PnL - zero for every participant, no error, no empty state. Fixed at
  all four `calculateRankings` call sites.
- **Distinguish `unknown_game` from `no_settle_path`.** The first means the data or registry
  is wrong; the second is the normal state for a provider contest until X5 exists.

### Seam 4 - In-progress gameplay writes

| | |
|---|---|
| **Files** | `order.actions.ts` (`placeOrder`, a **16-step** guard chain), `position.actions.ts`, `liquidation.actions.ts`, `margin-monitor.actions.ts` |
| **Today** | Keyed on `TradingPosition.competitionId`, which holds either a competition or a challenge ID |
| **Change** | **None.** These stay trading-only |
| **Hard rule** | A provider game must never write to `TradingPosition`. Round state lives in `game_round` - see `04-data-model.md` |

---

## 3. The game module contract

New directory `lib/games/`, mirrored at `apps/admin/lib/games/`:

```
lib/games/
  index.ts      getGameModule(), assertGameEnabled(), getEnabledGameTypes()
  types.ts      the contract
  registry.ts   listGameModules()
  trading/      index.ts, config.ts, scoring.ts, settle.ts
  provider/     index.ts, config.ts, scoring.ts, settle.ts, adapters/
```

The provider module is described in `02-integration-architecture.md`. **One provider
module serves every game from every provider**; which company and which title are data
on the contest, not code.

### Capability flags

Each module declares what it can do, so the admin panel cannot offer an impossible
contest format:

`needsPriceFeed`, `needsMarketHours`, `supportsElimination`, `scoreUpdates`,
`supportsChallenges`, `requiresSyncPlay`

For provider games these are derived from the catalogue response in `01` section 3 -
`family`, `supportsCompetition`, `supportsOneVsOne`, `supportsContentSeed`.

**`needsMarketHours` is live as of 4 September 2026** (X1 step 6), read through
`gameNeedsMarketHours()` in the registry at three cross-game call sites: challenge create,
challenge accept, and admin competition create. Four things about it are worth keeping.

It **fails closed**. An unknown game type keeps the gate rather than dropping it, because
the mistakes are not symmetric: wrongly applying it refuses a contest visibly and someone
complains, while wrongly skipping it lets real money trade against a closed market on stale
prices.

Neither create path takes the game type **from caller input**. A client- or
operator-supplied value would be a way to skip the market gate on a trading contest by
claiming to be a different game. Both derive it from `contestGameLabel()`, the same helper
that stamps the stored label, so the gate and the label cannot disagree.

On **challenge accept the gate had to move, not just gain a condition.** It ran before the
challenge was loaded, and there is no way to scope a gate to a capability without first
reading the document carrying the label. It now runs after the lookup and the cheap
validations but **before any wallet read**, the same ordering rule as `checkAccountStanding`
in sub-defect 1b, so a refusal cannot leave one of the two debits applied.

**The admin competition-create gate was REMOVED rather than scoped** (owner decision, 4 Sep
2026). It refused an operator creating a **trading** competition at the weekend, which was a
live usability defect and inconsistent with the 1 Sep decision that *joining* outside market
hours is allowed and only trading itself is gated.

The distinction is worth keeping, because it is the one case where capability-scoping was
the wrong tool: **scoping it to `needsMarketHours` would have left it refusing trading
competitions at the weekend** - correct for games, still wrong for operators. Creating a
contest is scheduling it, not playing it. Order placement still refuses trades against a
closed market, so nothing is weakened; the main app never had the check, so the apps now
agree; and the market-holiday overlap warning stays, because it informs rather than refuses.
`assertForexMarketOpenForCreate()` was deleted with it, on the `shouldBlockEntry` precedent.

### Two independent axes

Do not conflate them:

| Axis | Values |
|---|---|
| **Contest kind** | `competition`, `challenge` |
| **Game type** | `trading`, `provider` |

---

## 4. The trading module must change nothing

X1 succeeds only if trading behaves **identically** afterwards. The trading module is a
wrapper around existing behaviour, not a rewrite.

**Left completely untouched:** `order.actions.ts`, `position.actions.ts`,
`liquidation.actions.ts`, `margin-monitor.actions.ts`, `pnl-calculator.service.ts`,
`risk-manager.service.ts`, `margin-safety.service.ts`, the `/trade` routes and the
whole `components/trading/` chart stack.

**Moved, not rewritten:** the settle block out of `competition-end.actions.ts`, and the
ranking switch out of `competition-ranking.service.ts`.

### The regression test that proves it

Recompute a sample of **historical completed competitions** through the new module path
and compare against the stored `finalLeaderboard`. Identical order, identical values.
If they differ, the extraction is wrong. **Do not proceed to X2 until this is green.**

#### GATE CLEARED 4 September 2026 - the replay ran against real history

`tools/games/replay-historical-rankings.ts`, run on the server:

```
competitions read        4
examined                 4
reproduced exactly       4
mismatched               0
```

**No before/after comparison was needed.** The script is written to run twice, because a
mismatch is not automatically a regression - participants edited after settlement, older
ranking rules and `emergency_ended` snapshots all diverge for their own reasons, so the
number that normally matters is the delta. At **100% the delta cannot be anything but
zero**, which is why one run settled it.

**State the sample honestly: four competitions is thin.** It proves the extracted path runs
against real stored data and reproduces it exactly, which is the specific thing the gate
asks. It does **not** carry the distributions, tie patterns and awkward edge cases the
chapter hoped real history would supply - the platform simply has not run enough contests
yet. **The golden matrix in `__tests__/services/ranking-regression.test.ts` is what covers
those**, and with a sample this small it is the stronger of the two pieces of evidence, not
the weaker one. Do not let a summary present four-for-four as comprehensive.

**Two incidental findings:**

- **The script had never been run, and could not have been.** It read
  `process.env.MONGODB_URI` directly and never loaded dotenv, unlike its sibling backfill,
  so it refused to start from a normal shell with a perfectly good `.env` present. Fixed in
  `d35544d4`. The general point: **a tool written as an acceptance gate but never executed
  is not evidence of anything**, and the first attempt to use it is when you find out.
- **The owner confirmed these contests genuinely settled through the app** rather than being
  seeded, which is the fact that makes the replay meaningful at all. The stored
  `finalLeaderboard` was written by the pre-extraction ranking code, so the comparison is a
  real before/after even though the users and money were test data. **Whether the data is
  "real" is the wrong question; the question is which code wrote the value being compared
  against.**

#### Seam 1 EXTRACTED 4 September 2026, and the gate held

The two metric switches now live in `lib/games/trading/scoring.ts` and are reached through
the registry. The engine retains qualification, sorting, tie detection, rank assignment and
prize distribution - the game-independent parts.

**The baseline did its job.** It stayed green with no regeneration, and regenerating after
the extraction produced a **byte-identical** golden file. That is the difference between
believing an extraction was safe and knowing it.

`RankableParticipant` in `lib/games/types.ts` replaces the trading-shaped interface by
making every game metric **optional**, so a provider participant can be ranked with a
`score` alone. `ParticipantData` remains structurally assignable to it, which is why no
trading code had to change.

`calculateRankings` takes an optional `options.gameType`; absent means trading, so every
pre-X1 caller is untouched. It **throws** on an unknown game type rather than falling back
to trading - see the work log for why that is the safe direction.

**One deliberate drift:** the admin app's copy of the ranking service still has the old
inline switches. Behaviourally identical while trading is the only game, but `check:mirrors`
does not cover `lib/`, so **seam 3 must mirror `lib/games/` and this service together.**

#### BUILT 4 September 2026, in two halves

Historical replay cannot run in CI - it needs the production database - so the gate was
built as two complementary pieces, and the **ordering is the load-bearing part**. Both
were captured **before** any extraction. A baseline recorded afterwards would freeze
whatever the new code does, bugs included, and then pass for ever while proving nothing.

| Piece | What it is | Runs |
|---|---|---|
| `__tests__/services/ranking-regression.test.ts` (22 tests) | Golden file: the frozen output of `calculateRankings` and `distributePrizesWithTies` over an 18-scenario matrix | **CI** |
| `tools/games/replay-historical-rankings.ts` | Read-only replay of completed competitions against their stored `finalLeaderboard` | **Owner, on the server**. Run before and after; compare the two reports |

The matrix covers every branch that decides money: all six ranking methods, both tiebreak
paths, a true tie, each disqualification reason, the profit-factor divide-by-zero, the
sub-epsilon boundary, unclaimed-position redistribution, an all-disqualified field and an
empty one. It is **append-only** - editing a scenario rewrites the history the golden file
exists to protect.

Two properties are asserted about the matrix itself, not just the outcomes, because a
baseline can be broad and still prove nothing: the six ranking methods must produce
**different orderings** (otherwise the scenarios would pass with the ranking metric
ignored entirely), and no scenario may pay out more than its pool or pay a negative prize.

**Probed:** changing `case "roi"` to return `pnl` turned exactly one scenario red, naming
the competition and the cause. Reverted.

**Read the replay report as a delta, not a pass rate.** Participant rows are read as they
are now, competitions settled under older rules will not reproduce, and `emergency_ended`
contests took a different path. What matters is a competition that reproduced *before*
the extraction and does not after.

#### The trap this work walked into - FIXED 4 September 2026

**Now closed.** The parameter is `platformFeeFraction`, it rejects anything outside 0-1
naming the value it received, and 19 tests in
`__tests__/services/platform-fee-unit.test.ts` pin both the valid range and the refusals.
The golden baseline regenerated byte-identical, so no payout changed. Full detail, and the
second bug the rename uncovered, in risk **R30**. The description below is kept as the
record of what was found and why it mattered.



`distributePrizesWithTies` took a parameter named **`platformFeePercentage`** and then
computed `grossPrize * (1 - platformFeePercentage)`. It therefore required a **fraction**:
`0.1`, not `10`. Both production callers divided by 100 first, so live payouts were correct
and **this was a naming defect, not a money defect** - state it that way. But building the
matrix passed `10` and every fee-bearing scenario produced a **negative prize**, silently,
with the parameter's own name inviting the mistake. It defaults to `0`, so an omitted
argument was safe and only a *plausible* argument was dangerous.

It mattered because **X5 adds a third caller** - the provider settle path - written by
someone reading the signature rather than the two existing call sites. Risk **R30**.

---

## 5. Architectural invariants

Enforce these in review, and the first two with ESLint `no-restricted-imports`.

> **Invariant 1 is enforced in CI as of 4 September 2026** (X1 step 6), in
> `eslint.config.mjs`. Two things about how it is written are load-bearing.
>
> It is **blocked by default with the public surface negated** - the pattern is
> `**/games/*` and `**/games/*/**`, with `!**/games/index`, `!**/games/registry`,
> `!**/games/types` and `!**/games/settlement` allowed back through. Written the other way
> round, naming each game folder, every future game would be unprotected until somebody
> remembered to add it, and forgetting is silent. Adding a game now needs no ESLint change;
> adding a public engine file needs one line, which is the decision that deserves review.
>
> And the rule matches the **import string, not the resolved path**. The first version used
> `**/lib/games/*`, which caught `@/lib/games/trading`, `@/lib/games/trading/scoring` and
> `@root/lib/games/trading/config` but **missed `../games/trading`** - no `lib/` segment in
> the string. Found by writing a probe file with four violations and four legal imports and
> checking which fired: three of four. **Write the probe before trusting the pattern.**
> `lib/games/**`, `apps/admin/lib/games/**`, `__tests__/**` and `tools/games/**` are exempt.
>
> **Invariant 2 is enforced too, as of the same day**, and its scope is the whole trick:
> `lib/games/*/**`, one level *below* the layer. That matches a module folder
> (`lib/games/trading/…`) but not the layer's own public files - `lib/games/index.ts`
> legitimately reads `WhiteLabel` for `getEnabledGameTypes()` and must keep being allowed
> to. Written as `lib/games/**` it would ban that and look entirely correct doing it. It
> bans **every** model and the connection helper, not an allow-list of contest models: a
> module needing any document at all is already the design going wrong, and a list would
> silently permit the next model somebody adds.
>
> One ordering trap, pinned by its own test. Flat config is **last-one-wins per rule**, and
> the invariant 1 block above switches `no-restricted-imports` **off** for all of
> `lib/games/**`. The invariant 2 block must come **after** it, or it is silently dead -
> and a dead config block still parses and still reads correctly.

1. The contest engine **never** imports a specific game folder.
2. Game modules **never** import contest models directly.
3. `settleContest()` is **idempotent**. Called twice, it pays once.
4. Every participant gets a `score`, whatever the game.
5. The game label is **required on write**; a missing label on read means `"trading"`.
6. Money paths stay single - one entry path, one payout path.
7. **Provider concepts never leak past the adapter.**
8. **No aggregate, leaderboard, stat, ranking, badge rule or report enumerates game
   types.** No `switch` on game type, no `if (gameType === "trading")`, no hard-coded
   list of games. Key on `gameKey` instead.
9. **Cross-game totals accumulate on settlement; they are never recomputed on read from
   the set of enabled games.** `getEnabledGameTypes()` gates creation, discovery and
   entry - it must never appear in a stats or leaderboard read path.

Invariants 8 and 9 are the two halves of the owner's plug-and-play requirement, and both
fail silently. **Invariant 8 is how a new game gets included automatically** - anything
that enumerates game types is a place the next game simply does not appear, with no error
and a page that still renders. **Invariant 9 is the inverse, and it is the one that
damages stored data:** if a player's total points are summed over currently-enabled games,
disabling a game retroactively demotes everyone who earned levels in it. That is risk
**R29**, the design is `05` section 11, and the cost of getting it wrong is a migration
over every player's progression rather than a code fix.

Invariant 5 matters during a rolling deploy: old code writing a contest without a game
label must not produce an unlabelled contest that later settles as the wrong game type.

### The trap that has already caused a production defect - CLOSED 4 September 2026

`app/api/gamemaster/competitions/route.ts` inserts with the **raw MongoDB driver**,
bypassing Mongoose defaults. This is risk **R7** in `17`, and it is the reason Mongoose
discriminators were rejected as an approach.

**Fixed in X1 step 6, and the count was wrong here too: six raw writers, not one.** The two
Game Master routes plus two inserts each in the admin trading-test and end-logic-test
harnesses. All six now spread `contestGameLabel()` from `lib/games/registry.ts`, a helper
rather than two literals because **setting `gameType` and forgetting `gameKey` is
invisible** - the contest settles, every current query matches it, and the row only
disappears once something groups by key.

**Be accurate about the severity, because this chapter overstated it.** An unlabelled
contest does **not** settle as the wrong game: invariant 5 resolves an absent label to
trading, which is correct for all six of these writers. The real harm is later and quieter,
and `gameKey` being immutable means it cannot be corrected in place afterwards.

---

## 6. Why the alternatives were rejected

| Alternative | Why not |
|---|---|
| A separate collection per game | Forks the leaderboard, ledger, admin lists, Game Master revenue and refunds - every one of them |
| Mongoose discriminators | Bypassed by `.lean()` reads and by the raw-driver Game Master insert above |
| A separate app per game | Splits wallet and identity, which are the platform's actual assets |
| Delete trading | Highest revenue per user today, and the regulatory brief rests on it |

---

## 7. Done when

- [x] `score` present on both participant models, in **both** apps, same commit
- [x] Game label on both contest models, in **both** apps, same commit
- [x] Registry resolves a module by game type; `assertGameEnabled()` returns a result
      object and never throws
- [x] Trading wrapped as a module with **no behaviour change**, proven by the historical
      regression test in section 4
- [x] Dispatch lives **inside** `finalizeCompetition` and `finalizeChallenge` in both
      apps, so all ten-plus callers are correct by construction (see seam 3)
- [x] The trading settle path **asserts** the game type and aborts if it is not trading
- [x] Cross-game totals **accumulate on settlement** - **partially done 4 Sep 2026.** The
      *structural* half is proven: 34 assertions that no stats, leaderboard, ranking,
      progression or badge read path calls `getEnabledGameTypes()` **or**
      `assertGameEnabled()`, and that ranking imports the synchronous registry rather than
      the database-backed entry point. The *behavioural* half - award progression, disable
      the game, assert level, XP and points unchanged - **cannot be written yet**, because
      `UserGameStats` does not exist until X7. The structural test is what prevents the
      defect being introduced in the meantime (risk **R29**, `05` s11.3)
- [x] Existing contests and participants backfilled with the trading label -
      **`tools/games/backfill-game-labels.ts`, 4 Sep 2026.** Report-only by default, 13
      tests against a real MongoDB. **Not yet run against production.** Backfill 2
      (`score`) deliberately deferred to seam 2 - see `18` section 1
- [x] Market-hours gating scoped to `needsMarketHours`, so it cannot block a provider
      contest - **done 4 Sep 2026** at challenge create, challenge accept and admin
      competition create, failing **closed** on an unknown game type
- [x] Every raw-driver contest insert sets the game label explicitly - **done 4 Sep 2026**.
      **Six** writers, not the one R7 named
- [x] ESLint import restrictions in place for invariants 1 and 2 - **done 4 Sep 2026**.
      Invariant 1 is blocked by default with the public surface negated; invariant 2 is
      scoped to `lib/games/*/**`, one level below the layer, so it catches module folders
      without banning `lib/games/index.ts` from reading `WhiteLabel`
- [x] Mirror CI check from X0 passing - 75 agree, 0 drifted

**Effort: 2-3 weeks.** Roughly a third of it is the regression test in section 4, and
that third is the part that makes the rest safe.

> **X1 is code-complete as of 4 September 2026.** Two things remain before it can be called
> closed, and both need a real database rather than more code:
> `tools/games/replay-historical-rankings.ts` has never been run against production data,
> and the backfill has not been applied. Both are read-only or report-only by default.
>
> **Code-complete is not the same as external games working.** X1 is the foundation: the
> engine no longer assumes every contest is trading. A provider game does not plug in until
> **X4** (the adapter) and **X5**. Anyone reading this as "external games are nearly done"
> has misread it by about ten phases.
