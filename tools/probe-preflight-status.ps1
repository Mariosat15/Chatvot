# Probes for the pre-flight's contest-status guards.
#
# Same harness rules as tools/probe-leaderboard-score.ps1: UTF-8 without a BOM on the read and
# the write, -LiteralPath on both, refuse to write an empty file, relax newlines in the match
# but substitute as a plain string, and name the test each probe expects to turn red so a probe
# aimed at the wrong test cannot masquerade as a working guard.

$ErrorActionPreference = 'Continue'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Target = 'components/games/RoundPreflight.tsx'
$Suite = '__tests__/games/provider-play-ui.test.ts'

function Read-Source([string]$Path) {
  $text = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path), $Utf8NoBom)
  if ([string]::IsNullOrWhiteSpace($text)) { throw "Read of $Path returned nothing." }
  return $text
}

function Write-Source([string]$Path, [string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { throw "Refusing to write empty content to $Path." }
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $Path), $Text, $Utf8NoBom)
}

function To-Pattern([string]$Literal) {
  return [Regex]::Escape($Literal) -replace '(\\r)?\\n', '\r?\n'
}

$probes = @(
  @{
    Name = 'the contest status is never read'
    From = 'state.contestStatus === "upcoming" || state.contestStatus === "draft"'
    To   = 'false'
    Test = 'reads the contest status, which is already on the state it is given'
  },
  @{
    Name = 'a draft contest is treated as playable'
    From = ' || state.contestStatus === "draft"'
    To   = ''
    Test = 'treats a draft contest as not started, because a URL reaches one before publish'
  },
  @{
    Name = 'resume is allowed to bypass the status gate'
    From = 'notStartedYet || noLongerOpen || windowNotOpen || windowClosed || exhausted'
    To   = '(notStartedYet || noLongerOpen || windowNotOpen || windowClosed || exhausted) && !resuming'
    Test = 'blocks resume as well as play, because the status gate runs before the resume path'
  },
  @{
    Name = 'the button goes back to ignoring the contest'
    From = 'disabled={launching || blocked}'
    To   = 'disabled={launching || exhausted || windowClosed}'
    Test = 'disables the control when there is nothing left to spend'
  },
  @{
    Name = 'a not-yet-started contest is rendered as an error'
    From = @'
        <div className="flex items-start gap-2 rounded-lg border border-gray-700 bg-gray-900/60 p-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
'@
    To   = @'
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
'@
    Test = 'does not colour a not-yet-started contest as an error'
  },
  @{
    Name = 'the attempt cost is promised on an unplayable contest'
    From = '{!resuming && !blocked && ('
    To   = '{!resuming && ('
    Test = 'does not promise an attempt cost on a contest that cannot be played'
  },
  @{
    Name = 'one generic message replaces the five worded refusals'
    From = '"This competition has not started yet. Your seat is reserved - come back when it opens."'
    To   = '"You cannot play right now."'
    Test = 'gives every refusal its own wording rather than one generic message'
  }
)

$failures = 0

foreach ($probe in $probes) {
  Write-Host ''
  Write-Host "PROBE: $($probe.Name)" -ForegroundColor Cyan

  $original = Read-Source $Target

  if ($original -notmatch (To-Pattern $probe.From)) {
    Write-Host '  DID NOT APPLY - pattern not found' -ForegroundColor Yellow
    $failures++
    continue
  }

  $broken = $original.Replace($probe.From, $probe.To)
  if ($broken -eq $original) {
    Write-Host '  DID NOT APPLY - file unchanged' -ForegroundColor Yellow
    $failures++
    continue
  }

  Write-Source $Target $broken

  try {
    $raw = & npx vitest run $Suite -t "$($probe.Test)" 2>&1
    $out = (($raw | Out-String) -replace '\s+', ' ')
  } finally {
    Write-Source $Target $original
  }

  # A `-t` filter matching no test is a fault in the probe, never in the code - and without this
  # branch it reports as GREEN, which is the opposite conclusion. One apostrophe in a test name
  # was enough to produce that false result in tools/probe-provider-lobby.ps1.
  if ($out -notmatch 'Tests\s+\d+\s+(passed|failed)') {
    Write-Host "  PROBE BROKEN - no test matched `"$($probe.Test)`"" -ForegroundColor Magenta
    $failures++
  } elseif ($out -match 'Tests\s+(\d+)\s+failed') {
    $red = [int]$Matches[1]
    if ($red -eq 1) {
      Write-Host '  RED as expected (1 test failed)' -ForegroundColor Green
    } else {
      Write-Host "  RED but $red tests failed - blast radius larger than expected" -ForegroundColor Yellow
      $failures++
    }
  } else {
    Write-Host '  GREEN - the guard is not doing its job' -ForegroundColor Red
    $failures++
  }
}

Write-Host ''
if ($failures -eq 0) {
  Write-Host "All $($probes.Count) probes behaved as expected." -ForegroundColor Green
} else {
  Write-Host "$failures of $($probes.Count) probes did not behave as expected." -ForegroundColor Red
}
