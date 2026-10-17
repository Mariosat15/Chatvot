# Probes `listChallengeableTitles` (item 3 of the roadmap,
# `lib/services/games/challengeable-titles.service.ts`) - the reader feeding the "create a
# challenge" game picker.
#
# Same harness shape as `probe-challenge-provider-resolution.ps1` - see that file for the
# encoding notes (read/write UTF-8 without a BOM, ASCII-only anchors).

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/services/challengeable-titles.test.ts'
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

$SERVICE = 'lib/services/games/challengeable-titles.service.ts'

Write-Host "`n=== the hard gate on externalGamesEnabled ===" -ForegroundColor Cyan

# A player has no "drafting ahead of launch" case - the master switch being off must empty
# the list outright, not merely warn the way the admin catalogue reader does for an operator
# drafting a contest. Removing this turns the hard gate into a silent pass-through, which
# would let the picker offer a game the create route (which reuses the same switch as a hard
# refusal) would then reject on submit.
Probe -Name 'externalGamesEnabled no longer empties the list' `
  -File $SERVICE `
  -Find '  if (!settings?.externalGamesEnabled) return [];' `
  -Replace '  if (false) return [];' `
  -ExpectRed 'returns nothing when externalGamesEnabled is off'

Write-Host "`n=== the provider.enabled filter ===" -ForegroundColor Cyan

# A disabled provider's titles must not appear, even if the title itself is otherwise fine -
# checked by querying `GameProvider.find({ enabled: true })` first and using ONLY those keys
# to filter `ProviderGame`. Widening the provider query to all providers regardless of
# `enabled` would list a title from a supplier an operator has switched off.
Probe -Name 'provider.enabled no longer filters which providers are queried' `
  -File $SERVICE `
  -Find '  const providers = await GameProvider.find({ enabled: true }).lean<' `
  -Replace '  const providers = await GameProvider.find({}).lean<' `
  -ExpectRed 'excludes a title whose PROVIDER is disabled'

Write-Host "`n=== the chartvoltEnabled filter ===" -ForegroundColor Cyan

# OUR switch, independent of the provider's own status - a catalogue sync must never put a
# title in front of players by itself, and this is the second of the three switches the
# admin reader also applies.
Probe -Name 'chartvoltEnabled no longer filters the title query' `
  -File $SERVICE `
  -Find '    chartvoltEnabled: true,' `
  -Replace '    chartvoltEnabled: { $in: [true, false] },' `
  -ExpectRed 'excludes a title with chartvoltEnabled: false'

Write-Host "`n=== the providerStatus filter ===" -ForegroundColor Cyan

# The provider's own claim about whether the title is live. A title marked deprecated or
# in maintenance must not surface in the picker even though `chartvoltEnabled` is our
# separate, independent switch.
Probe -Name 'providerStatus no longer filters the title query' `
  -File $SERVICE `
  -Find '    providerStatus: "active",' `
  -Replace '    providerStatus: { $in: ["active", "deprecated", "maintenance"] },' `
  -ExpectRed 'excludes a title the provider itself has marked deprecated'

Write-Host "`n=== the installed-adapter filter ===" -ForegroundColor Cyan

# Checked independently of the three DB-level switches above, because a title can pass
# every one of them and still have no code connector - the adapter registry is a
# compile-time fact, not a setting. Removing this filter would list a title the create route
# refuses on submit with "No code connector is installed", the exact "control that appears
# to work and does nothing" shape this whole module exists to avoid on the player-facing
# side.
Probe -Name 'the installed-adapter filter is removed' `
  -File $SERVICE `
  -Find '    .filter((title) => Boolean(getProviderAdapter(title.providerKey)))' `
  -Replace '    .filter(() => true)' `
  -ExpectRed 'excludes a title with no installed adapter for its provider'

Write-Host "`n=== supportsOneVsOne and supportsContentSeed are NOT excluded, only flagged ===" -ForegroundColor Cyan

# The picker withholds with a reason (StepChooseGame.tsx's pattern), so a title lacking
# either capability must still be RETURNED - hiding it would leave a player wondering why a
# game they can see everywhere else never appears in the challenge picker, with nothing
# telling them why.
Probe -Name 'supportsOneVsOne is coerced to true instead of passed through' `
  -File $SERVICE `
  -Find '        supportsOneVsOne: Boolean(title.supportsOneVsOne),' `
  -Replace '        supportsOneVsOne: true,' `
  -ExpectRed 'does NOT exclude a title with supportsOneVsOne: false'

Write-Host "`n=== the malformed-schema title is listed, not hidden ===" -ForegroundColor Cyan

# `schemaOk` must reflect the real parse result. Hard-coding it to true would silently claim
# a broken title's settings are fine, which is exactly the "reports success while doing the
# wrong thing" shape this codebase keeps finding.
Probe -Name 'schemaOk no longer reflects the real parse result' `
  -File $SERVICE `
  -Find '        schemaOk: parsed.ok,' `
  -Replace '        schemaOk: true,' `
  -ExpectRed 'does NOT exclude a title with a malformed configSchema'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
