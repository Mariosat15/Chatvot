# Probes the "no result, no prize" rule: the module method, the engine's gate, its scope,
# and the parity between the two copies of the ranking engine.
#
# Same harness as tools/probe-round-cutoff.ps1 - see that file for why each defence exists.
# Every one of them has already produced a false result in this repository at least once.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/services/provider-prize-eligibility.test.ts'
$PARITY = '__tests__/services/admin-finalize-gamemaster-parity.test.ts'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Relax([string]$literal) { [regex]::Escape($literal) -replace '\r?\n', '\r?\n' }

function Probe {
  param([string]$Name, [string]$File, [string]$Find, [string]$Replace, [string]$ExpectRed, [string]$Suite = $SUITE)

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

$RANKING = 'lib/services/competition-ranking.service.ts'
$ADMIN_RANKING = 'apps/admin/lib/services/competition-ranking.service.ts'
$PROVIDER = 'lib/games/provider/scoring.ts'
$TRADING = 'lib/games/trading/index.ts'

Write-Host "`n=== the engine's gate ===" -ForegroundColor Cyan

# The defect itself: nothing disqualified a provider participant, so a player who never
# launched a round ranked on a fallback zero and was paid.
Probe -Name 'the engine stops asking the module at all' `
  -File $RANKING `
  -Find '  if (isCompleted && !gameModule.hasResult(participant)) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'pays nothing to a player who never scored'

# Unscoped, the same function draws the LIVE board, so every player mid-round is stamped
# disqualified on a contest they are still playing - and `13` s4.1b renders the reason.
Probe -Name 'the gate is no longer scoped to a completed contest' `
  -File $RANKING `
  -Find '  if (isCompleted && !gameModule.hasResult(participant)) {' `
  -Replace '  if (!gameModule.hasResult(participant)) {' `
  -ExpectRed 'does not disqualify anybody while the contest is still running'

# The reason is the only part that reaches the player, so a blank one is a verdict with no
# explanation on a contest they paid to enter.
Probe -Name 'the disqualification carries no reason' `
  -File $RANKING `
  -Find '      reason: "No score recorded",' `
  -Replace '      reason: undefined,' `
  -ExpectRed 'disqualifies a player who never scored, with a reason'

Write-Host "`n=== the provider module's answer ===" -ForegroundColor Cyan

# THE BODY THESE THREE PATCH CHANGED ON 9 SEPTEMBER 2026, when the owner's rule made a
# stored zero ineligible. The old `-Find` was `return Number.isFinite(participant.score);`
# and every probe below reported PROBE DID NOT APPLY - which prints in the same magenta as
# a genuine harness fault and is easy to read as one. Worth carrying: a probe file is
# coupled to the source text it patches, so a rule change silently retires its own probes.
$HAS_RESULT = '  return Number.isFinite(participant.score) && (participant.score as number) > 0;'

Probe -Name 'the provider module claims every participant has a result' `
  -File $PROVIDER `
  -Find $HAS_RESULT `
  -Replace '  return true;' `
  -ExpectRed 'pays nothing to a player who never scored'

# THE OWNER'S RULE ITSELF: drop the `> 0` and a stored zero is paid again. This is the
# probe that replaced the old truthiness one, which has stopped being a wrong answer -
# `Boolean(score)` now agrees with the rule for 0, NaN and undefined alike, and differs
# only on a negative score. It is no longer an interesting mutation, so it is gone rather
# than kept as a probe that cannot fail.
Probe -Name 'the zero exclusion is dropped, so a stored zero is paid again' `
  -File $PROVIDER `
  -Find $HAS_RESULT `
  -Replace '  return Number.isFinite(participant.score);' `
  -ExpectRed 'pays nothing for a score of zero'

# And the other direction: refusing a zero must not become refusing everybody, which is
# what a stray `< 0` or a flipped comparison would do.
Probe -Name 'the comparison is flipped, so every real score is refused' `
  -File $PROVIDER `
  -Find $HAS_RESULT `
  -Replace '  return Number.isFinite(participant.score) && (participant.score as number) < 0;' `
  -ExpectRed 'pays nothing to a player who never scored'

# `!= null` admits NaN, which fails every comparison in the sort - so it lands wherever the
# sort leaves it and is then paid from a position nobody chose.
Probe -Name 'the provider module admits NaN as a score' `
  -File $PROVIDER `
  -Find $HAS_RESULT `
  -Replace '  return participant.score !== undefined && participant.score !== null;' `
  -ExpectRed 'refuses a score that is not a finite number'

Write-Host "`n=== the operator's own verdict ===" -ForegroundColor Cyan

# `status: "disqualified"` is checked by the ENGINE rather than by a game module, because it
# is an operator's decision about a person and not a fact about their metrics. Latent for
# competitions today - nothing writes it on a competition participant - and live for
# challenges, which is why removing it has to go red rather than being left to a game.
$MATRIX = '__tests__/services/prize-rule-matrix.test.ts'

Probe -Name 'an admin-disqualified GAME player is eligible again' `
  -File $RANKING `
  -Find '  if (participant.status === "disqualified") {' `
  -Replace '  if (false) {' `
  -ExpectRed 'beside a disqualified player' `
  -Suite $MATRIX

# Asserted on BOTH halves of the matrix, because the rule lives in one place and a game-only
# or trading-only assertion would be satisfied by a branch on game type - which is precisely
# the shape that makes the next game silently fail.
Probe -Name 'an admin-disqualified TRADER is eligible again' `
  -File $RANKING `
  -Find '  if (participant.status === "disqualified") {' `
  -Replace '  if (false) {' `
  -ExpectRed 'case 3: a disqualified trader is excluded' `
  -Suite $MATRIX

# The liquidation switch must keep BOTH its states. Hard-wiring it on reads as a
# tightening and turns an operator's setting into decoration.
Probe -Name 'disqualifyOnLiquidation is hard-wired on, so the off state is decoration' `
  -File $RANKING `
  -Find '  if (rules.disqualifyOnLiquidation && participant.status === "liquidated") {' `
  -Replace '  if (participant.status === "liquidated") {' `
  -ExpectRed 'off, a liquidated trader is paid' `
  -Suite $MATRIX

Write-Host "`n=== trading must not change, which is the load-bearing half ===" -ForegroundColor Cyan

# The tightening that looks correct and silently imposes a one-trade minimum on every
# trading contest ever created.
Probe -Name 'trading answers totalTrades > 0, changing every existing contest' `
  -File $TRADING `
  -Find '  hasResult: () => true,' `
  -Replace '  hasResult: (p) => (p.totalTrades ?? 0) > 0,' `
  -ExpectRed 'keeps a trader who placed no trades qualified'

# And the opposite mistake: if trading returned false for a flat account, minimumTrades
# would stop being the thing that decides, and the two behaviours would collapse into one.
Probe -Name 'trading refuses everybody, so minimumTrades stops deciding' `
  -File $TRADING `
  -Find '  hasResult: () => true,' `
  -Replace '  hasResult: () => false,' `
  -ExpectRed 'keeps a trader who placed no trades qualified'

Write-Host "`n=== the two copies of the ranking engine ===" -ForegroundColor Cyan

# NOT PROBED, WITH THE REASON, rather than shipping a probe that reports green.
#
# The obvious probe is to blank the gate in the ADMIN copy and expect the parity suite's
# money comparison to go red. It does not, and cannot: vitest aliases `@` to the repository
# root, so both finalizers import the ROOT ranking service and the admin copy is never
# loaded. Both probes were written, both came back green, and a green probe left in here
# would teach the next reader that the admin gate is decoration.
#
# This is the third cause of a green probe - the guard is real but unreachable BY THIS
# HARNESS - after "weak test" and "wrong claim". The property moved to a structural test,
# which is reachable, and that is what these two probe instead.

# `competition-ranking.service.ts` is a divergent duplicate and `check:mirrors` compares
# MODELS, so nothing else notices. Both apps run the finalize cron every minute, so a rule
# in one copy only means the payout depends on which process won the race - R26 and R42.
Probe -Name "the admin copy never learned the rule, so the two crons disagree" `
  -File $ADMIN_RANKING `
  -Find '  if (isCompleted && !gameModule.hasResult(participant)) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'asks the module for a result' `
  -Suite $PARITY

# The scope is asserted by COUNT, so the failure this catches is a second unscoped call
# added BESIDE the scoped one - which every positive match is happy with, since the correct
# gate is still there to be found.
#
# Written on one line deliberately. The first attempt built the replacement with
# `'...' + "`r`n" + '...'`, and PowerShell does not concatenate in argument mode - it passed
# the first string alone, which REPLACED the gate rather than adding to it, leaving the count
# at one. The probe reported green beside 10 unrelated failures, which reads like a broken
# guard rather than a broken probe.
Probe -Name 'a second, unscoped call is added beside the scoped one' `
  -File $RANKING `
  -Find '  if (isCompleted && !gameModule.hasResult(participant)) {' `
  -Replace '  if (!gameModule.hasResult(participant)) return { qualified: false }; if (isCompleted && !gameModule.hasResult(participant)) {' `
  -ExpectRed 'scopes the gate to a completed contest' `
  -Suite $PARITY

# ALSO NOT PROBED: the comment strip in the structural guard. Removing it leaves the suite
# green, and this one is the SECOND cause rather than the third - the claim was wrong. The
# strip is the right default and both paragraphs happen not to write the call out today, so
# `hasResult` appears once either way. Recorded here and in the test rather than carrying a
# probe that reports green, and rather than asserting the strip does work it does not.

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
