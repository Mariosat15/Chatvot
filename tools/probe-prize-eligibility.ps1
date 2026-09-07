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

Probe -Name 'the provider module claims every participant has a result' `
  -File $PROVIDER `
  -Find '  return Number.isFinite(participant.score);' `
  -Replace '  return true;' `
  -ExpectRed 'pays nothing to a player who never scored'

# TRUTHINESS IS THE INTERESTING WRONG ANSWER. It is shorter, it reads correctly, and it
# refuses the player who attempted the game and scored nothing.
Probe -Name 'the provider module uses truthiness, so a real zero is refused' `
  -File $PROVIDER `
  -Find '  return Number.isFinite(participant.score);' `
  -Replace '  return Boolean(participant.score);' `
  -ExpectRed 'treats a genuine zero as a result'

# `!= null` admits NaN, which fails every comparison in the sort - so it lands wherever the
# sort leaves it and is then paid from a position nobody chose.
Probe -Name 'the provider module admits NaN as a score' `
  -File $PROVIDER `
  -Find '  return Number.isFinite(participant.score);' `
  -Replace '  return participant.score !== undefined && participant.score !== null;' `
  -ExpectRed 'refuses a score that is not a finite number'

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
