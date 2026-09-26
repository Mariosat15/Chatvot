# Probes for the provider contest lobby.
#
# Harness rules, every one of which has produced a false result on this codebase before:
#   * -LiteralPath on the READ as well as the write. The lobby page's path contains `[id]`,
#     which PowerShell parses as a wildcard character class, so a plain Get-Content matches
#     nothing and returns $null while Set-Content happily truncates the file. Every probe then
#     goes red on the expected test for entirely the wrong reason, and the only tell is the
#     failure COUNT - 5 to 7 red for a one-line change instead of 1.
#   * UTF-8 without a BOM both ways, or emoji in the touched files come back as mojibake.
#   * Refuse to write empty content.
#   * Match with newlines relaxed, substitute as a plain string.
#   * Name the expected failing test and run it alone with -t, so a probe aimed at the wrong
#     test cannot masquerade as a working guard.

$ErrorActionPreference = 'Continue'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Suite = '__tests__/games/provider-play-ui.test.ts'

$LOBBY = 'app/(root)/competitions/[id]/page.tsx'
$PROVIDER_LOBBY = 'components/games/ProviderContestLobby.tsx'
$PROVIDER_BOARD = 'components/games/ProviderLeaderboard.tsx'

function Read-Source([string]$Path) {
  $resolved = (Resolve-Path -LiteralPath $Path).Path
  $text = [System.IO.File]::ReadAllText($resolved, $Utf8NoBom)
  if ([string]::IsNullOrWhiteSpace($text)) { throw "Read of $Path returned nothing." }
  return $text
}

function Write-Source([string]$Path, [string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { throw "Refusing to write empty content to $Path." }
  $resolved = (Resolve-Path -LiteralPath $Path).Path
  [System.IO.File]::WriteAllText($resolved, $Text, $Utf8NoBom)
}

function To-Pattern([string]$Literal) {
  return [Regex]::Escape($Literal) -replace '(\\r)?\\n', '\r?\n'
}

$probes = @(
  @{
    Name = 'the lobby uses the strict helper to choose a screen'
    File = $LOBBY
    From = 'if (hasProviderGameLabel(competition)) {'
    To   = 'if (isProviderContest(competition)) {'
    Test = 'branches on the label rather than on the strict helper'
  },
  @{
    Name = 'the branch moves below the trading computation'
    File = $LOBBY
    From = 'if (hasProviderGameLabel(competition)) {'
    To   = 'if (getDifficultyData() && hasProviderGameLabel(competition)) {'
    Test = 'returns before any trading computation runs'
  },
  @{
    Name = 'the deadline rule is inlined again'
    File = $LOBBY
    From = 'const registrationClosed = isRegistrationClosed(competition);'
    To   = 'const registrationClosed = (() => { const deadline = new Date(competition.registrationDeadline); const start = new Date(competition.startTime); const effectiveDeadline = deadline < start ? start : deadline; return new Date() > effectiveDeadline; })();'
    Test = 'does not duplicate the registration-deadline rule'
  },
  @{
    Name = 'the unresolved-round policy panel is dropped'
    File = $PROVIDER_LOBBY
    From = 'title="If a round does not finish"'
    To   = 'title="Notes"'
    Test = 'shows the three things a provider lobby must answer'
  },
  @{
    Name = 'the launch refusal becomes a silent disable'
    File = $PROVIDER_LOBBY
    From = '{isUserIn && !canLaunch && ('
    To   = '{false && ('
    Test = 'refuses Play with a reason when the contest cannot launch a round'
  },
  @{
    Name = 'a field the catalogue model does not declare is read'
    File = $PROVIDER_LOBBY
    From = '.select("displayName scoreType")'
    To   = '.select("displayName scoreType tagline")'
    Test = 'reads only fields the catalogue model actually declares'
  },
  @{
    Name = 'the game name falls back to the internal join key'
    File = $PROVIDER_LOBBY
    From = 'const gameName = title?.displayName ?? "Game";'
    To   = 'const gameName = competition.gameKey;'
    Test = "takes the game's name from the catalogue, never from the keys"
  },
  @{
    Name = 'the trading leaderboard is rendered instead'
    File = $PROVIDER_LOBBY
    From = '<ProviderLeaderboard'
    To   = '<CompetitionLeaderboard'
    Test = 'is not the trading leaderboard'
  },
  @{
    Name = 'a trading figure creeps into the score board'
    File = $PROVIDER_BOARD
    From = '  status?: string;'
    To   = '  status?: string;
  pnl?: number;'
    Test = 'renders no trading figure at all'
  },
  @{
    Name = 'an absent score is rendered as zero'
    File = $PROVIDER_BOARD
    From = 'row.score === undefined || row.score === null'
    To   = 'false'
    Test = 'distinguishes an absent score from a score of zero'
  },
  @{
    Name = 'the board sorts by score itself'
    File = $PROVIDER_BOARD
    From = '{rows.map((row) => {'
    To   = '{rows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((row) => {'
    Test = 'does not decide the ranking direction a second time'
  }
)

$failures = 0

foreach ($probe in $probes) {
  Write-Host ''
  Write-Host "PROBE: $($probe.Name)" -ForegroundColor Cyan

  $original = Read-Source $probe.File

  if ($original -notmatch (To-Pattern $probe.From)) {
    Write-Host "  DID NOT APPLY - pattern not found in $($probe.File)" -ForegroundColor Yellow
    $failures++
    continue
  }

  $broken = $original.Replace($probe.From, $probe.To)
  if ($broken -eq $original) {
    Write-Host "  DID NOT APPLY - $($probe.File) unchanged" -ForegroundColor Yellow
    $failures++
    continue
  }

  Write-Source $probe.File $broken

  try {
    $raw = & npx vitest run $Suite -t "$($probe.Test)" 2>&1
    $out = (($raw | Out-String) -replace '\s+', ' ')
  } finally {
    Write-Source $probe.File $original
  }

  <#
    THE NO-TESTS-RAN CHECK COMES FIRST, and it exists because this harness reported a false
    GREEN before it was added. The probe's `Test` string was missing an apostrophe, so `-t`
    matched nothing, vitest exited having run zero tests, and the absence of a failure line was
    read as "the guard did not fire". That is indistinguishable from a broken guard while being
    the opposite problem. `-t` matching no test is always a fault in the probe, never in the code.
  #>
  if ($out -match 'No test files found|Tests\s+no tests') {
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
  } elseif ($out -notmatch 'Tests\s+\d+\s+passed') {
    Write-Host "  PROBE BROKEN - no test matched `"$($probe.Test)`"" -ForegroundColor Magenta
    $failures++
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
