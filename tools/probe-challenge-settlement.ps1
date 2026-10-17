# Probes the game-agnostic core of challenge settlement: ranking, tie-breaking,
# disqualification and which of the four outcomes gets paid. Each probe restores one defect
# and must turn EXACTLY the named test red.
#
# Three of these restore defects that were live in the pre-unification code and are recorded
# as fixes 1-3 in `challenge-settlement.service.ts`'s own file comment - the `enteredAt`
# tiebreaker, the `challenger_wins` record disagreeing with what was paid, and `both_lose`
# leaving both rows stuck at "active". A probe is the only thing that proves those three
# stay fixed, because none of them throws and none of them logs.
#
# Same harness as `probe-provider-challenge-finalize.ps1` - see that file for why each
# defence exists (`-LiteralPath`-equivalent reads via `File::ReadAllText`, UTF-8 without a
# BOM on both the read and the write, a refusal to write when the read came back empty,
# `PROBE DID NOT APPLY` when the anchor has moved, the expected test run ALONE with `-t` and
# judged on the summary counts rather than on its name appearing in the output, and the whole
# suite re-run only to measure blast radius).

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/services/challenge-settlement.test.ts'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Relax([string]$literal) { [regex]::Escape($literal) -replace '\r?\n', '\r?\n' }

function Probe {
  param([string]$Name, [string]$File, [string]$Find, [string]$Replace, [string]$ExpectRed, [string]$Suite = $SUITE, [string]$Find2, [string]$Replace2)

  $path = Join-Path (Get-Location) $File
  $original = [System.IO.File]::ReadAllText($path, $Utf8NoBom)

  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "  [READ FAILED - REFUSING TO WRITE] $Name" -ForegroundColor Magenta
    return
  }

  $patched = [regex]::Replace($original, (Relax $Find), $Replace.Replace('$', '$$'), 1)
  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] $Name" -ForegroundColor Magenta
    return
  }

  if ($Find2) {
    $twice = [regex]::Replace($patched, (Relax $Find2), $Replace2.Replace('$', '$$'), 1)
    if ($twice -eq $patched) {
      Write-Host "  [SECOND EDIT DID NOT APPLY] $Name" -ForegroundColor Magenta
      return
    }
    $patched = $twice
  }

  [System.IO.File]::WriteAllText($path, $patched, $Utf8NoBom)
  try {
    $alone = npx vitest run $Suite -t $ExpectRed --reporter=dot 2>&1 | Out-String
    $aloneFailed = 0
    if ($alone -match 'Tests\s+(\d+)\s+failed') { $aloneFailed = [int]$Matches[1] }
    $ran = ($alone -match 'Tests\s+') -and ($alone -notmatch 'No test found')

    $whole = npx vitest run $Suite --reporter=dot 2>&1 | Out-String
    $wholeFailed = 0
    if ($whole -match 'Tests\s+(\d+)\s+failed') { $wholeFailed = [int]$Matches[1] }

    if (-not $ran) {
      Write-Host "  [EXPECTED TEST DID NOT RUN - wrong name or wrong suite] $Name" -ForegroundColor Magenta
    } elseif ($aloneFailed -gt 0) {
      Write-Host ("  [RED: expected test failed, {0} red in suite] {1}" -f $wholeFailed, $Name) -ForegroundColor Green
    } else {
      Write-Host ("  [STILL GREEN - GUARD IS NOT WORKING, {0} red in suite] {1}" -f $wholeFailed, $Name) -ForegroundColor Red
    }
  } finally {
    [System.IO.File]::WriteAllText($path, $original, $Utf8NoBom)
    if ([System.IO.File]::ReadAllText($path, $Utf8NoBom) -ne $original) {
      Write-Host "  !! RESTORE FAILED for $File - check git diff" -ForegroundColor Red
    }
  }
}

$SETTLE = 'lib/services/settlement/challenge-settlement.service.ts'

Write-Host "`n=== the three defects fixed while this logic was MOVED, not copied ===" -ForegroundColor Cyan

# Fix 1, restored verbatim. `ChallengeParticipant` has never declared `enteredAt` - the field
# is `joinedAt` - so the old code compared `Date.now()` with itself and the `join_time`
# tiebreaker could never resolve anything. It threw nothing and logged nothing; the challenge
# simply fell through to a "true tie" and split a prize one player had earned.
Probe -Name 'the join_time tiebreaker reads the undeclared enteredAt field again' `
  -File $SETTLE `
  -Find '    enteredAt: participant.joinedAt,' `
  -Replace '    enteredAt: (participant as unknown as { enteredAt: Date }).enteredAt,' `
  -ExpectRed 'falls through to the join-time tiebreaker'

# Fix 2, restored. Leaving `isTie` true after the challenger_wins policy has named a winner is
# the stored record disagreeing with the payment: `winnerId` is set, so the document reads as
# a challenger win, while the distribution branch below tests `winnerId && !isTie` and builds
# nothing at all - the challenger is named the winner and paid zero.
Probe -Name 'challenger_wins names a winner without clearing the tie' `
  -File $SETTLE `
  -Find '    loserPnL = challengedValue;
    isTie = false;' `
  -Replace '    loserPnL = challengedValue;' `
  -ExpectRed 'gives the whole prize to the challenger under the challenger_wins tie policy'

# Fix 3, restored. Skipping the final pass leaves a both_lose tie's two rows at "active"
# forever - the challenge is completed, the pot is booked as unclaimed, and both players'
# seats still say they are playing.
Probe -Name 'the participant status pass is skipped entirely' `
  -File $SETTLE `
  -Find '  if (!bothDisqualified) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'pays nobody under both_lose'

# The MIRROR IMAGE of the same condition, and it needs its own probe: running the pass
# unconditionally overwrites a disqualified row with "completed", so a challenge nobody
# qualified for reports two ordinary finishers and the disqualification disappears from the
# seat while surviving only on the challenge document.
Probe -Name 'the status pass overwrites a both-disqualified row with completed' `
  -File $SETTLE `
  -Find '  if (!bothDisqualified) {' `
  -Replace '  if (true) {' `
  -ExpectRed 'declares NO WINNER when neither seat produced a result'

Write-Host "`n=== ranking a provider challenge on its score ===" -ForegroundColor Cyan

# The score never reaching the module is R32/R33 on the challenge side: both players rank on
# zero, both are refused for having no result, and a challenge two people played settles as
# though neither turned up.
Probe -Name 'the score is not passed to the game module' `
  -File $SETTLE `
  -Find '    score: participant.score,' `
  -Replace '    score: undefined,' `
  -ExpectRed 'pays the higher score when the title counts upward'

# Hard-coding the direction is the defect that pays the SLOWEST player first on a time trial.
# It is invisible: every figure is present, the order is coherent, and only the catalogue row
# says it is upside down.
Probe -Name 'the ranking direction is hard-coded upward' `
  -File $SETTLE `
  -Find '    scoreDirection: scoringRules?.direction,' `
  -Replace '    scoreDirection: "higher_is_better",' `
  -ExpectRed 'pays the LOWER score when the title counts downward'

# Without the catalogue read there are no rules at all - direction, the zero rule and the
# minimum bar all vanish together. Probed separately from the three fields below because this
# is the one mutation a reviewer would make deliberately, to "save a query".
Probe -Name 'the catalogue scoring rules are never resolved' `
  -File $SETTLE `
  -Find '    : await resolveScoringRules(challenge.gameKey, session);' `
  -Replace '    : undefined;' `
  -ExpectRed 'pays the LOWER score when the title counts downward'

Write-Host "`n=== eligibility, which is a different question from ranking ===" -ForegroundColor Cyan

# `hasResult` is the module's own answer to whether a run is worth paying on. Forcing it true
# pays a player who never reported - and on both sides at once, so a challenge nobody played
# splits its pot between two absentees.
Probe -Name 'the no-result check is disabled on both sides' `
  -File $SETTLE `
  -Find '  const challengerNoResult = !gameModule.hasResult(challengerRankable);
  const challengedNoResult = !gameModule.hasResult(challengedRankable);' `
  -Replace '  const challengerNoResult = false;
  const challengedNoResult = false;' `
  -ExpectRed 'disqualifies a seat with NO score and pays the player who has one'

# Declaring every zero valid pays a stored zero on a title that has said nothing - R50's
# phantom score, arriving through the eligibility door instead of the seat builder.
Probe -Name 'every zero is treated as a valid result' `
  -File $SETTLE `
  -Find '    zeroIsValidResult: scoringRules?.zeroIsValidResult,' `
  -Replace '    zeroIsValidResult: true,' `
  -ExpectRed 'treats a STORED zero as no result while the title says nothing'

# Dropping the extra bar pays a score the operator has explicitly said is not good enough.
Probe -Name "the title's minimum eligible score is ignored" `
  -File $SETTLE `
  -Find '    minimumEligibleScore: scoringRules?.minimumEligibleScore,' `
  -Replace '    minimumEligibleScore: undefined,' `
  -ExpectRed "refuses a score under the title's minimum"

# The trading-only scoping of the trade floor. Unscoped, `minimumTrades` disqualifies EVERY
# provider participant, because `totalTrades` is never populated for a non-trading game -
# so every provider challenge would settle as both-disqualified and pay nobody, ever.
Probe -Name 'the minimum-trades rule is applied to provider participants too' `
  -File $SETTLE `
  -Find '  const challengerMinTradesFail = isTrading && challenger.totalTrades < minTrades;
  const challengedMinTradesFail = isTrading && challenged.totalTrades < minTrades;' `
  -Replace '  const challengerMinTradesFail = challenger.totalTrades < minTrades;
  const challengedMinTradesFail = challenged.totalTrades < minTrades;' `
  -ExpectRed 'pays the higher score when the title counts upward'

# The same scoping from the other end. Aimed at the trade floor rather than at liquidation:
# `isTrading` decides ONLY the trade floor and the catalogue read, so a first version of this
# probe expecting the liquidation test to go red came back green - `disqualifyOnLiquidation &&
# status === "liquidated"` is deliberately game-agnostic and reads no game type at all. The
# claim was wrong, not the test, and the trade floor had no trading-side test until this
# probe went looking for one.
Probe -Name 'the trading rule checks stop recognising a trading challenge' `
  -File $SETTLE `
  -Find '  const isTrading = challenge.gameType === "trading";' `
  -Replace '  const isTrading = false;' `
  -ExpectRed 'disqualifies a trading seat under the minimum trade count'

Write-Host "`n=== which outcome gets paid ===" -ForegroundColor Cyan

# Without the epsilon comparison an equal pair falls into the else branch and one of them is
# declared an outright winner on nothing - the tiebreakers and the tie policy are both
# bypassed, and the challenge reads as a clean win.
Probe -Name 'equal ranking values are no longer detected as a tie' `
  -File $SETTLE `
  -Find '    if (Math.abs(challengerValue - challengedValue) < epsilon) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'splits the prize equally on a tie no tiebreaker can resolve'

# Splitting on every tie ignores the operator's policy: `both_lose` pays two players the
# admin has decided should be paid nothing, and the unclaimed pool is never recorded.
Probe -Name 'every tie is split, whatever the policy says' `
  -File $SETTLE `
  -Find '  } else if (isTie && tiePrizeDistribution === "split_equally") {' `
  -Replace '  } else if (isTie) {' `
  -ExpectRed 'pays nobody under both_lose'

# `qualifiedWinnersCount` is what lets the fee stage tell "two qualified players were not
# paid" from "nobody qualified at all". Hard-coded to zero, a both_lose tie is filed under
# `all_disqualified` - a reason that says two players broke the rules when neither did.
Probe -Name 'the qualified-winner count is hard-coded to zero' `
  -File $SETTLE `
  -Find '    qualifiedWinnersCount: [challengerDisqualified, challengedDisqualified].filter(
      (d) => !d,
    ).length,' `
  -Replace '    qualifiedWinnersCount: 0,' `
  -ExpectRed 'pays nobody under both_lose'

# The provider winner's audit trail. `buildWinMetadata` records `finalScore` for a provider
# row instead of the `finalPnl`/`finalCapital` a trading row carries - without `score` on the
# leaderboard entry it has nothing to read, so the one number that explains why this player
# was paid is missing from the ledger while every credit moves correctly.
Probe -Name 'the leaderboard entry carries no score for the ledger' `
  -File $SETTLE `
  -Find '    score: p.score,' `
  -Replace '    score: undefined,' `
  -ExpectRed 'pays the higher score when the title counts upward'

Write-Host "`n=== the mirror pin, probed by breaking it ===" -ForegroundColor Cyan

# The pinning test must be able to see a real divergence between the two copies, or a future
# drift goes unnoticed - `check:mirrors` compares models and has never had an opinion about a
# service file.
Probe -Name 'the admin copy of the challenge settlement service drifts from the main app' `
  -File 'apps/admin/lib/services/settlement/challenge-settlement.service.ts' `
  -Find '  const epsilon = 0.001; // For floating point comparison' `
  -Replace '  const epsilon = 0.002; // For floating point comparison' `
  -ExpectRed 'the provider CHALLENGE settlement stack is byte-identical in both apps' `
  -Suite '__tests__/services/settlement-dispatch.test.ts'

# DELIBERATELY NOT PROBED, with the reason recorded rather than a probe that reports green:
#
# `resolveScoringModule`'s throw on an unknown game type is UNREACHABLE from this suite.
# `getGameModuleOrTrading` resolves an absent or unrecognised game type to trading (invariant
# 5), so it never returns undefined and the branch cannot be entered without mocking the
# registry itself. It is kept as a tripwire for the day a third module is registered and the
# resolver stops defaulting - matching `competition-ranking.service.ts`'s own guard, whose
# comment says the same thing. A probe aimed at it would report STILL GREEN with the guard
# fully intact, which teaches the next reader that the guard is decoration.

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
