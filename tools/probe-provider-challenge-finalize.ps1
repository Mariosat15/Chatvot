# Probes the provider CHALLENGE settlement path: the same cut-off deferral and round mark as
# `provider-finalize.ts` (already probed by `probe-round-cutoff.ps1`), plus the parts that are
# specific to a 1v1 - the optimistic lock, the lock release on refusal/abort, and the dispatch
# that routes a provider challenge here instead of through the trading path.
#
# Same harness as `probe-round-cutoff.ps1` - see that file for why each defence exists.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/services/provider-challenge-finalize.test.ts'
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

$FINALIZE = 'lib/services/settlement/provider-challenge-finalize.ts'
$ACTIONS = 'lib/actions/trading/challenge-finalize.actions.ts'

Write-Host "`n=== the deferral, re-probed on the challenge's own file ===" -ForegroundColor Cyan

# Without this a challenge settles a minute after the cut-off, discarding the score of a
# challenger who finished at the last second - the same defect `probe-round-cutoff.ps1`
# guards on the competition side, re-probed here because the CALL SITE is a different file.
Probe -Name 'the challenge deferral is disabled' `
  -File $FINALIZE `
  -Find '      if (cutoff.deferSettlement) {' `
  -Replace '      if (false) {' `
  -ExpectRed 'defers, leaving the challenge untouched'

# The deferral must not pre-emptively close the live round - that is the round it is
# waiting on. Same shape as the competition probe: reading the round back proves nothing
# closed early. Deliberately anchored on the ASCII condition rather than the emoji log
# line beneath it - PowerShell 5.1 has no BOM on this script and decodes a multi-byte
# emoji literal via the console codepage rather than UTF-8, so an emoji anchor silently
# fails to match and the whole probe reports [PROBE DID NOT APPLY] rather than a real result.
Probe -Name 'the live round is closed even while deferring' `
  -File $FINALIZE `
  -Find '      if (cutoff.deferSettlement) {' `
  -Replace '      if (cutoff.deferSettlement) {
        await endLiveRoundsForContest({ contestId: challengeId, outcome: "cutoff", reason: "probe" });' `
  -ExpectRed 'defers, leaving the challenge untouched'

Write-Host "`n=== the optimistic lock ===" -ForegroundColor Cyan

# Without the status filter, a second cron pass (or a manual admin retry) claims an
# already-`finalizing` or `completed` challenge and pays it a second time.
Probe -Name 'the lock no longer requires status "active"' `
  -File $FINALIZE `
  -Find '      status: "active",' `
  -Replace '      status: { $exists: true },' `
  -ExpectRed 'refuses a challenge that is not active'

# Dropping the endTime clause lets a challenge be claimed before play has actually closed -
# the same class of bug the competition path guards against with its own lock query.
# Deliberately NOT aimed at 'defers, leaving the challenge untouched' - that test has a LIVE
# round, so the cut-off gate above the lock already defers it for a reason this mutation does
# not touch, and the guard would report green while doing nothing. The test this actually
# protects has no live rounds and an endTime an hour in the future, which is the one case
# where only the lock's own clause stands between the call and an early settlement.
Probe -Name 'the lock no longer requires endTime to have passed' `
  -File $FINALIZE `
  -Find '      $or: [
        { endTime: { $exists: false } },
        { endTime: null },
        { endTime: { $lte: new Date() } },
      ],' `
  -Replace '      $or: [{ endTime: { $exists: true } }],' `
  -ExpectRed 'refuses to settle a challenge whose endTime has not yet passed'

Write-Host "`n=== the dispatch (X1 seam 3, extended to challenges) ===" -ForegroundColor Cyan

# Without the dispatch, a provider challenge falls through to the trading finalizer, which
# reads `TradingPosition`/`pnl` neither of which a provider challenge ever writes - it would
# either throw or silently rank both players at zero.
Probe -Name 'the main app no longer dispatches provider challenges to the provider path' `
  -File $ACTIONS `
  -Find 'if (route.path === "provider") {' `
  -Replace 'if (false) {' `
  -ExpectRed 'routes a provider challenge to finalizeProviderChallenge rather than the trading path'

Write-Host "`n=== the admin app stays in step ===" -ForegroundColor Cyan

# Deliberately behavioral only. `settlement-dispatch.test.ts`'s "%s dispatches on the game
# label" only asserts that the file calls `routeToTradingSettlement(` SOMEWHERE - it stayed
# green against this exact mutation, because the call it names is a different one (the
# trading-path gate a few lines above) and the assertion cannot tell which branch runs. A
# structural probe aimed at that test reported [STILL GREEN - GUARD IS NOT WORKING] with the
# guard fully intact - the probe was aimed at the wrong test, not evidence of a missing one.
# This probe instead runs the admin app's OWN dispatch, imported through the same admin
# process the cron runs, and proves it actually routes to finalizeProviderChallenge.
Probe -Name 'the admin app no longer dispatches provider challenges to the provider path' `
  -File 'apps/admin/lib/actions/trading/challenge-finalize.actions.ts' `
  -Find 'if (route.path === "provider") {' `
  -Replace 'if (false) {' `
  -ExpectRed "routes a provider challenge to finalizeProviderChallenge from the admin cron's entry point" `
  -Suite $SUITE

Write-Host "`n=== the mirror pin, probed by breaking it ===" -ForegroundColor Cyan

# The pinning test itself must be able to see a real divergence, or a future drift between
# the two copies would go unnoticed exactly like the challenge-window.ts comment did.
Probe -Name 'the admin copy of the provider challenge finalizer drifts from the main app' `
  -File 'apps/admin/lib/services/settlement/provider-challenge-finalize.ts' `
  -Find 'const MAX_RETRIES = 3;' `
  -Replace 'const MAX_RETRIES = 4;' `
  -ExpectRed 'the provider CHALLENGE settlement stack is byte-identical in both apps' `
  -Suite '__tests__/services/settlement-dispatch.test.ts'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
