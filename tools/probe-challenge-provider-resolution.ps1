# Probes `resolveChallengeProviderGame` (item 3 of the roadmap,
# `lib/services/games/challenge-provider-resolution.ts`) - the resolver `POST /api/challenges`
# calls for a provider game, in front of `Challenge.create()`.
#
# Same harness shape as `probe-provider-challenge-finalize.ps1` - see that file for the
# encoding notes (read/write UTF-8 without a BOM, ASCII-only anchors).

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/services/challenge-provider-resolution.test.ts'
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

$RESOLVER = 'lib/services/games/challenge-provider-resolution.ts'

Write-Host "`n=== the hard gate on externalGamesEnabled ===" -ForegroundColor Cyan

# A challenge has no draft state, so the master switch being off must refuse creation
# outright - not warn, the way the competition draft path does. Removing this turns the
# refusal into a silent pass-through, which would let a challenge be created for a title
# the picker feeding this same route has already hidden for the identical reason.
Probe -Name 'externalGamesEnabled no longer refuses outright' `
  -File $RESOLVER `
  -Find '  if (!externalGamesEnabled) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'refuses as a HARD gate when external games are switched off'

Write-Host "`n=== the hard-coded attempts/round-start policy ===" -ForegroundColor Cyan

# A challenge is exactly two players facing one round each - `single` / `reserve_full_round`
# is not a default, it is the only policy this shape supports. Widening it here without also
# widening the model and the accept-route seat builder is real scope for a later phase, so
# this pins that nobody quietly does it by editing one literal.
Probe -Name 'attemptsPolicy is no longer hard-coded to "single"' `
  -File $RESOLVER `
  -Find '    attemptsPolicy: "single",' `
  -Replace '    attemptsPolicy: "best_of_n",' `
  -ExpectRed 'resolves successfully when the round fits inside the requested duration'

# `until_window_closes` turns the SAME fact (round longer than the window) from a refusal
# into a warning - `runPreflight`'s own `reservesFullRound` branch. Silently switching this
# would let a challenge be created that no attempt could ever complete inside, with nothing
# telling the player.
Probe -Name 'roundStartPolicy is no longer hard-coded to "reserve_full_round"' `
  -File $RESOLVER `
  -Find '    roundStartPolicy: "reserve_full_round",' `
  -Replace '    roundStartPolicy: "until_window_closes",' `
  -ExpectRed "refuses when the title's own declared play clock is longer than the requested challenge duration"

Write-Host "`n=== the adapter check is wired to the REQUESTED provider, not a fixed one ===" -ForegroundColor Cyan

# `adapterInstalled` must be looked up for `input.providerKey`, not any registered key that
# happens to resolve. Hard-coding the mock key here would let a challenge be created for a
# provider with no adapter at all - a control that appears to work and does nothing.
Probe -Name 'adapterInstalled no longer checks the requested providerKey' `
  -File $RESOLVER `
  -Find 'adapterInstalled: Boolean(getProviderAdapter(input.providerKey)),' `
  -Replace 'adapterInstalled: true,' `
  -ExpectRed 'refuses when no code connector is registered for the provider'

Write-Host "`n=== the result grace period is DERIVED, never a fixed figure ===" -ForegroundColor Cyan

# Nothing here is stored, so there is no second copy of this value to drift against - but the
# derivation itself (round length plus the pre-flight's own margin) is the thing that keeps
# a short challenge's grace window sufficient for whatever round length the title declares.
# Collapsing it to the shared margin alone would refuse every challenge whose title declares
# a play clock, because the pre-flight's OWN minimum is exactly `roundSeconds + margin`.
Probe -Name 'resultGracePeriodSeconds is no longer derived from the round length' `
  -File $RESOLVER `
  -Find '  const resultGracePeriodSeconds =
    roundSeconds !== undefined
      ? roundSeconds + RESULT_GRACE_MARGIN_SECONDS
      : DEFAULT_RESULT_GRACE_SECONDS;' `
  -Replace '  const resultGracePeriodSeconds = RESULT_GRACE_MARGIN_SECONDS;' `
  -ExpectRed 'resolves successfully when the round fits inside the requested duration'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
