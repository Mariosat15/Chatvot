# Probes `__tests__/challenges/challenge-duration-clocks.test.ts` - the two lengths on a game
# challenge shown as clocks rather than offered as controls (owner, 14 September 2026).
#
# Same harness shape as `probe-opponent-picker.ps1` - see that file for the encoding notes
# (read/write UTF-8 without a BOM, ASCII-only anchors, and the rule that PROBE DID NOT APPLY
# means the target moved rather than that the run was quiet).

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/challenges/challenge-duration-clocks.test.ts'
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

$CLOCK = 'components/challenges/create/ChallengeDurationClock.tsx'
$BATTLE = 'components/challenges/create/ChallengeBattleSettings.tsx'
$FIELDS = 'components/challenges/ChallengeSettingsFields.tsx'

Write-Host "`n=== the clock itself ===" -ForegroundColor Cyan

# The cells hand-rolled beside the import. This is the shape every kit guard here exists for:
# importing the shared cells is trivially satisfied by a file that imports them and then lays
# out its own four boxes, after which one screen spells a duration two ways.
Probe -Name 'the clock lays out its own four cells' `
  -File $CLOCK `
  -Find '        <CountdownCells' `
  -Replace '        <div className="grid grid-cols-4 gap-2" /><CountdownCells' `
  -ExpectRed 'hand-rolls no cells of its own'

# The empty guard removed. A title declaring no play clock renders 00:00:00:00 under "how long
# the game runs" - an invented deadline that reads perfectly and that no gate enforces.
Probe -Name 'an absent length renders a row of zeroes' `
  -File $CLOCK `
  -Find '  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }' `
  -Replace '' `
  -ExpectRed 'renders NOTHING for an absent or non-positive length'

# The guard moved below the markup, which is the mutation a reviewer would not notice: the file
# still contains every literal the other assertions look for.
Probe -Name 'the guard sits after the markup it is meant to prevent' `
  -File $CLOCK `
  -Find '  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }' `
  -Replace '  const hidden = seconds === undefined;' `
  -ExpectRed 'renders NOTHING for an absent or non-positive length'

Write-Host "`n=== how long the challenge runs ===" -ForegroundColor Cyan

# The branch reversed, so trading gets the clock and a game gets the box. This is the defect
# itself, facing the other way: the one game whose window is genuinely the player's loses the
# control, and the one whose window must fit a provider round gets it back.
Probe -Name 'the clock and the control are swapped' `
  -File $BATTLE `
  -Find '      {selection.type === "provider" ? (' `
  -Replace '      {selection.type === "trading" ? (' `
  -ExpectRed 'is a clock for a game and a control for trading'

# Trading's bounds dropped while the input stays. The box accepts anything, the create route
# refuses it, and the refusal names a bound no screen ever showed.
Probe -Name "trading's duration bounds are gone" `
  -File $BATTLE `
  -Find '            min={settings?.minDurationMinutes || 15}' `
  -Replace '            min={1}' `
  -ExpectRed "keeps trading's own bounds and chips exactly as they were" `
  -Suite $SUITE

# The length recomputed here rather than read off the form. `chooseGame` already moves it with
# the pick, resolved and clamped server-side; a second derivation in the browser disagrees in
# the direction that shows a figure the create route then refuses.
Probe -Name 'the clock derives its own length' `
  -File $BATTLE `
  -Find '          seconds={formData.duration * 60}' `
  -Replace '          seconds={selection.title.maxDurationSeconds}' `
  -ExpectRed 'reads the length off the form rather than recomputing it'

Write-Host "`n=== how long the game runs ===" -ForegroundColor Cyan

# The lock keyed on the field's NAME. It locks one game's clock and leaves the next title's as
# a box - the single failure mode of the no-developer-needed claim, and it reviews as correct
# because it works on the one title anybody tests with.
Probe -Name 'the play clock is found by name rather than by format' `
  -File $FIELDS `
  -Find '        lockPlayClock && field.format === "duration-seconds" ? (' `
  -Replace '        lockPlayClock && field.name === "durationSeconds" ? (' `
  -ExpectRed 'is locked by the declared FORMAT, never by a field name'

# The prop never passed. The form is capable of locking the clock and nothing asks it to, so
# the control is still editable while every assertion about the form passes.
Probe -Name 'the dialog never asks for the lock' `
  -File $BATTLE `
  -Find '            lockPlayClock' `
  -Replace '' `
  -ExpectRed 'is locked on the player'

# The label back to the raw key. A title with no declared `title` renders `durationSeconds`
# above a box holding minutes - an internal name and the wrong unit in one line.
Probe -Name 'the raw schema key is used as a label again' `
  -File $FIELDS `
  -Find '            {fieldLabel(field)}' `
  -Replace '            {field.title ?? field.name}' `
  -ExpectRed 'never labels a control with the raw schema key'

# The format branch dropped from the label. Every other assertion stays green, because
# `fieldLabel` is still a function and is still called twice - only the unlabelled play clock
# falls through to a humanised key, which is the case nobody has a fixture for.
Probe -Name 'the label no longer special-cases the play clock' `
  -File $FIELDS `
  -Find '  if (field.format === "duration-seconds") return "How long the game runs";' `
  -Replace '' `
  -ExpectRed 'labels the play clock from its format'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
