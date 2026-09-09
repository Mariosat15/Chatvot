# Probes the prize ARITHMETIC: proportional normalisation, the configured-total scaling,
# largest-remainder rounding, and the single unclaimed-pool writer's idempotency.
#
# Separate from tools/probe-prize-eligibility.ps1 on purpose. That file asks "who is a
# winner"; this one asks "what is a winner paid". They fail for different reasons and mixing
# them makes a red run harder to read, which is the only thing a probe harness is for.
#
# Same defences as tools/probe-round-cutoff.ps1 - every one of them has produced a false
# result in this repository at least once. In particular: the read is checked before any
# write, the pattern's newlines are relaxed so a CRLF pattern matches an LF file, and the
# expected test is run ALONE by name, because vitest prints a passing test's name as
# readily as a failing one.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$MATRIX  = '__tests__/services/prize-rule-matrix.test.ts'
$RETRY   = '__tests__/services/settlement-retry-idempotency.test.ts'
$BASIS   = '__tests__/admin/contest-prize-basis.test.ts'
$PAYOUT  = '__tests__/services/competition-finalize-payout.test.ts'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Relax([string]$literal) { [regex]::Escape($literal) -replace '\r?\n', '\r?\n' }

# Run vitest with a HARD DEADLINE, because an injected defect can be an infinite loop.
#
# This exists because one probe here deleted a loop's own decrement, which reads as "the
# residue is never consumed" and is in fact a non-terminating sweep. The run was killed
# after 35 minutes and the probed file was left mutated on disk, since a killed PowerShell
# process never reaches its `finally`. An injected hang is the one outcome a harness cannot
# report on unless it owns the clock, so it owns the clock.
#
# The child is spawned rather than piped so it can be killed by pid, and its output is
# redirected to a temp file rather than captured, because `Out-String` wraps at the console
# width and has twice made a test name arrive split across two lines - which reads exactly
# like a test that did not run.
function RunVitest {
  param([string]$Suite, [string]$NameFilter, [int]$TimeoutSeconds = 300)

  $out = [System.IO.Path]::GetTempFileName()

  # LAUNCHED THROUGH cmd.exe, NEVER `-FilePath 'npx'`. On Windows `npx` is a shell script
  # with no extension, so Start-Process refuses it with "%1 is not a valid Win32
  # application" - and that error goes to the SCRIPT's error stream, not to a probe result.
  # Written the obvious way, all twelve probes reported nothing at all and the run finished
  # in twenty seconds looking like a completed pass. A probe harness needs its own probe.
  $inner = "npx vitest run $Suite --reporter=dot"
  if ($NameFilter) { $inner += " -t `"$NameFilter`"" }

  $p = $null
  try {
    $p = Start-Process -FilePath $env:ComSpec -ArgumentList @('/c', $inner) -NoNewWindow `
      -PassThru -RedirectStandardOutput $out -RedirectStandardError "$out.err"
  } catch {
    Write-Host "  [CANNOT SPAWN VITEST: $($_.Exception.Message)]" -ForegroundColor Magenta
  }

  if (-not $p) {
    Remove-Item $out, "$out.err" -Force -ErrorAction SilentlyContinue
    return @{ Text = ''; TimedOut = $false; Spawned = $false }
  }

  if (-not $p.WaitForExit($TimeoutSeconds * 1000)) {
    # Reason: taskkill /T takes the whole tree. Killing only the npx shim leaves the node
    # process spinning, and the next probe then measures a machine under load.
    & taskkill /PID $p.Id /T /F *> $null
    Remove-Item $out, "$out.err" -Force -ErrorAction SilentlyContinue
    return @{ Text = ''; TimedOut = $true; Spawned = $true }
  }

  $text = ((Get-Content $out -Raw -ErrorAction SilentlyContinue) + "`n" +
           (Get-Content "$out.err" -Raw -ErrorAction SilentlyContinue))
  Remove-Item $out, "$out.err" -Force -ErrorAction SilentlyContinue
  return @{ Text = $text; TimedOut = $false; Spawned = $true }
}

function Probe {
  # `Find2` / `Replace2` make ONE probe out of TWO edits, in the same file, and they exist
  # because two guards can cover each other. `normalisePrizeShares`'s divide-by-zero guard
  # and `allocateWithoutRoundingLoss`'s `Number.isFinite` check both stop a NaN prize, so
  # removing either alone leaves the suite green and reports the guard as decoration. Both
  # must be removed together for the defect to become observable.
  param(
    [string]$Name, [string]$File, [string]$Find, [string]$Replace, [string]$ExpectRed,
    [string]$Suite = $MATRIX, [string]$Find2, [string]$Replace2
  )

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
    $r = RunVitest -Suite $Suite -NameFilter $ExpectRed
    if (-not $r.Spawned) {
      Write-Host "  [HARNESS BROKEN - vitest never started] $Name" -ForegroundColor Magenta
      return
    }
    if ($r.TimedOut) {
      Write-Host "  [TIMED OUT - the injected defect probably does not terminate] $Name" -ForegroundColor Magenta
      return
    }

    $alone = $r.Text
    $aloneFailed = 0
    if ($alone -match 'Tests\s+(\d+)\s+failed') { $aloneFailed = [int]$Matches[1] }
    $ran = ($alone -match 'Tests\s+') -and ($alone -notmatch 'No test found')

    if (-not $ran) {
      Write-Host "  [EXPECTED TEST DID NOT RUN - wrong name or wrong suite] $Name" -ForegroundColor Magenta
      return
    }

    # The whole suite is run only to measure BLAST RADIUS. 5-7 red for a one-line change is
    # the signal that the harness damaged the file rather than that the guard fired; the
    # honest number is 1 or 2.
    $w = RunVitest -Suite $Suite
    $wholeFailed = if ($w.TimedOut) { -1 } elseif ($w.Text -match 'Tests\s+(\d+)\s+failed') { [int]$Matches[1] } else { 0 }
    $radius = if ($wholeFailed -lt 0) { 'suite timed out' } else { "$wholeFailed red in suite" }

    if ($aloneFailed -gt 0) {
      Write-Host ("  [RED: expected test failed, {0}] {1}" -f $radius, $Name) -ForegroundColor Green
    } else {
      Write-Host ("  [STILL GREEN - GUARD IS NOT WORKING, {0}] {1}" -f $radius, $Name) -ForegroundColor Red
    }
  } finally {
    [System.IO.File]::WriteAllText($path, $original, $Utf8NoBom)
    if ([System.IO.File]::ReadAllText($path, $Utf8NoBom) -ne $original) {
      Write-Host "  !! RESTORE FAILED for $File - check git diff" -ForegroundColor Red
    }
  }
}

$SHARES     = 'lib/utils/prize-shares.ts'
$RANKING    = 'lib/services/competition-ranking.service.ts'
$PROJECTION = 'lib/utils/prize-projection.ts'
$FINANCIALS = 'lib/services/platform-financials.service.ts'

Write-Host "`n=== proportional normalisation ===" -ForegroundColor Cyan

# THE OWNER'S RULE. The equal-share bonus is what this replaced, and it is the mutation most
# likely to be reintroduced by somebody "simplifying" the factor away - it reads perfectly
# and only differs once a rank is vacated.
Probe -Name 'the equal-share bonus is restored, flattening the prize curve' `
  -File $SHARES `
  -Find '  const factor = filledTotal > 0 ? configuredTotal / filledTotal : 1;' `
  -Replace '  const factor = 1;' `
  -ExpectRed 'two valid and one zero pays only the two, proportionally'

# NORMALISING TO 100 IS THE WRONG FIX THAT READS AS THE RIGHT ONE. It is identical to the
# correct code on every table totalling 100 - which is nearly all of them - and over-pays by
# the shortfall on any table that deliberately under-allocates.
Probe -Name 'normalises to 100 instead of the configured total' `
  -File $SHARES `
  -Find '  const factor = filledTotal > 0 ? configuredTotal / filledTotal : 1;' `
  -Replace '  const factor = filledTotal > 0 ? 100 / filledTotal : 1;' `
  -ExpectRed 'never to 100'

# DIVIDING BY ZERO, AND THIS PROBE WAS WRONG TWICE BEFORE IT WAS RIGHT. Worth keeping both
# corrections, because they are two different causes of a green probe.
#
# First it was aimed at the "nobody is eligible" test, which stayed green: every share is
# then `filled: false`, so the bad factor is computed and never multiplied by anything. The
# guard genuinely changes no answer on that path - a WRONG CLAIM about where it matters.
#
# Re-aimed at the one reachable shape - a rank IS held and the held ranks are all configured
# at 0%, where `0 * NaN` reaches a prize - it stayed green again, for a different reason:
# `allocateWithoutRoundingLoss` has its own `Number.isFinite` check and turns the NaN into a
# zero. TWO GUARDS COVERING EACH OTHER, which no single-edit probe can see. Both go in one
# edit, and the pair is the honest unit of protection here.
Probe -Name 'the divide-by-zero guard is removed (with the allocator NaN guard)' `
  -File $SHARES `
  -Find '  const factor = filledTotal > 0 ? configuredTotal / filledTotal : 1;' `
  -Replace '  const factor = configuredTotal / filledTotal;' `
  -Find2 '    Number.isFinite(amount) ? Math.max(0, Math.floor(amount * 100)) : 0,' `
  -Replace2 '    Math.max(0, Math.floor(amount * 100)),' `
  -ExpectRed 'configured at 0%'

# THE MONGOOSE SUBDOCUMENT TRAP, and the only probe here that reproduces a bug this work
# actually shipped for a few minutes. `prizeDistribution` is an array of Mongoose
# subdocuments in production; a spread copies own enumerable properties and a Mongoose
# document keeps its data behind per-path getters, so `rank` comes back `undefined`, every
# rank group misses, and a contest calculates ZERO prizes while reporting success.
#
# AIMED AT THE DATABASE SUITE, NOT THE MATRIX, and that is the whole point of this probe.
# The matrix hands in plain objects, where a spread keeps `rank` perfectly - so it stays
# GREEN on a defect that empties every real payout. Only a fixture built through Mongoose
# can see it, which is the general rule: a fixture that is not bound by the schema the
# application writes through cannot prove anything about the application.
Probe -Name 'the explicit rank copy becomes a spread, losing rank on subdocuments' `
  -File $SHARES `
  -Find '    rank: d.rank,
    percentage: Number.isFinite(d.percentage) ? d.percentage : 0,' `
  -Replace '    ...d,
    percentage: Number.isFinite(d.percentage) ? d.percentage : 0,' `
  -ExpectRed 'pays the configured percentages when the players are actually ranked' `
  -Suite $PAYOUT

Write-Host "`n=== rounding must neither create nor destroy credits ===" -ForegroundColor Cyan

# Flooring each winner independently is what this replaced. It loses up to a cent per
# winner, always in the platform's favour - the direction nobody reports.
Probe -Name 'the residue is never handed out, so cents are quietly kept' `
  -File $SHARES `
  -Find '  if (residue === 0) return floored.map((cents) => cents / 100);' `
  -Replace '  return floored.map((cents) => cents / 100);' `
  -ExpectRed 'pays exactly the distributable pool'

# And the opposite failure: handing out more than the residue inflates the total.
#
# `+= 2` RATHER THAN THE OBVIOUS MUTATION, AND THE REASON IS WORTH KEEPING. The natural
# probe here is to delete `residue -= 1`, which reads as "the residue is never consumed" -
# and it HANGS THE TEST RUNNER FOR EVER. That line is the loop's own decrement, and the
# `i = -1` wrap beneath it restarts the sweep while residue is still positive, so removing
# it is an infinite loop rather than a wrong number. It was run once, killed after 35
# minutes, and left `prize-shares.ts` mutated on disk because a killed PowerShell process
# never reaches its `finally`.
#
# TWO RULES OUT OF IT. A probe must inject a defect that TERMINATES - an injected hang is
# indistinguishable from a slow suite, and it is the one failure mode this harness cannot
# report. And after killing a probe run, `git diff` the probed file before doing anything
# else: the restore is the part that did not happen.
Probe -Name 'more than the residue is handed out, inflating the total' `
  -File $SHARES `
  -Find '      floored[remainders[i].index] += 1;
      residue -= 1;' `
  -Replace '      floored[remainders[i].index] += 2;
      residue -= 1;' `
  -ExpectRed 'pays exactly the distributable pool'

# DELIBERATELY NOT PROBED, and the reason changed a comment in the production code rather
# than this harness. The probe was "the rounding target is summed from the amounts it is
# meant to check", replacing `netOf(normalised.configuredTotal)` with a sum over `exact`.
# It came back GREEN WITH ZERO RED IN THE SUITE - the fourth cause, a mutation that changes
# no observable - and measuring it showed why: `netOf` is linear and `normalisePrizeShares`
# guarantees the filled shares sum to `configuredTotal`, so the two expressions agree to
# within 1e-13 on every input the function can construct. Far below a cent, and flooring
# absorbs it.
#
# The comment beside that line claimed the choice existed "to catch a discrepancy between
# the two". That was a wrong fact and is now corrected in place: what it actually buys is a
# CAP bounded by the net pot, held by `ranking-regression.test.ts`'s "no scenario pays out
# more than its prize pool" across all 18 scenarios.

Write-Host "`n=== the lobby must promise what settlement pays ===" -ForegroundColor Cyan

# One rule, two consumers. The projection draws the prize table a player reads BEFORE paying,
# so a second copy of the redistribution means the promise and the payout disagree - and the
# promise is the one that was relied on.
Probe -Name 'the projection goes back to its own equal-share arithmetic' `
  -File $PROJECTION `
  -Find '  const normalised = normalisePrizeShares(' `
  -Replace '  const normalised = ((d: any, f: any) => ({ shares: d.map((x: any) => ({ rank: x.rank, configuredPercentage: x.percentage, effectivePercentage: x.percentage, bonusPercentage: 0, filled: f(x.rank) })), configuredTotal: 100, vacatedPercentage: 0, allVacated: false }))(' `
  -ExpectRed "redistributes an unclaimed rank's share" `
  -Suite $BASIS

Write-Host "`n=== one unclaimed-pool writer, and it must be idempotent ===" -ForegroundColor Cyan

Probe -Name 'the duplicate check is removed, so every retry books another pool' `
  -File $FINANCIALS `
  -Find '    if (existing) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'records one row however many times' `
  -Suite $RETRY

# `sourceId` alone is not the identity. A challenge and a competition can share an id, and
# the guard would then refuse a real unclaimed pool with no error anywhere.
Probe -Name 'the duplicate check ignores sourceType' `
  -File $FINANCIALS `
  -Find '      sourceType,
      sourceId: params.competitionId,
    })' `
  -Replace '      sourceId: params.competitionId,
    })' `
  -ExpectRed 'does not confuse a challenge with a competition' `
  -Suite $RETRY

# The live wrong number the unification fixed: the seven raw writers hardcoded a 1:1 euro
# conversion, so every unclaimed pool read a hundred times its value at the default rate.
Probe -Name 'the euro conversion goes back to a hardcoded 1:1' `
  -File $FINANCIALS `
  -Find '    const eurAmount = params.poolAmount / conversionSettings.eurToCreditsRate;' `
  -Replace '    const eurAmount = params.poolAmount;' `
  -ExpectRed 'converts the euro figure through the stored rate' `
  -Suite $RETRY

Write-Host "`n=== NOT PROBED, with the reason ===" -ForegroundColor Cyan
Write-Host @'
  The ADMIN copies of prize-shares.ts, prize-projection.ts and competition-ranking.service.ts
  are not probed here, and cannot be by this harness: vitest aliases `@` to the repository
  root, so every test imports the ROOT copy and the admin files are never loaded. Both
  probes were written, both came back green, and a green probe left in a harness teaches the
  next reader that the admin copy is decoration. This is the third cause of a green probe -
  the guard is real but unreachable BY THIS HARNESS - after "weak test" and "wrong claim".

  The property is held instead by a byte-for-byte text comparison in the matrix suite's
  mirror test, which IS reachable, and by the structural parity assertions in
  admin-finalize-gamemaster-parity.test.ts.
'@ -ForegroundColor DarkGray

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
