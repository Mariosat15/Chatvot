# Probes for the game lobby wearing the trading lobby's theme.
#
# Harness rules, every one of which has produced a false result on this codebase before:
#   * -LiteralPath on the READ as well as the write, or a path containing `[id]` matches
#     nothing while Set-Content happily truncates the file.
#   * UTF-8 without a BOM both ways, or emoji in the touched files come back as mojibake.
#   * Refuse to write empty content.
#   * Match with newlines relaxed, substitute as a plain string.
#   * Name the expected failing test, run it alone with -t, and treat "no test matched" as a
#     BROKEN PROBE rather than as a pass. A probe aimed at the wrong test is indistinguishable
#     from a guard that does not work.
#
# One rule specific to this harness: several of the guards are `it.each` cases, so their test
# names contain the class string being compared. The -t filter is a REGEX, so the fragments
# below deliberately avoid `[`, `(` and `|`, and use `.` where the real name has a bracket.

$ErrorActionPreference = 'Continue'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Suite = '__tests__/games/provider-play-ui.test.ts'

$LOBBY = 'components/games/ProviderContestLobby.tsx'
$UI = 'components/games/lobby-ui.tsx'
$BOARD = 'components/games/ProviderLeaderboard.tsx'

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
    Name = 'the page shell gets its own padding instead of the trading ramp'
    File = $LOBBY
    From = 'className="flex min-h-screen flex-col gap-4 sm:gap-6 p-3 sm:p-4 md:p-8 overflow-x-hidden"'
    To   = 'className="mx-auto max-w-5xl px-4 py-8"'
    Test = 'class string: flex min-h-screen flex-col'
  },
  @{
    Name = 'the hero loses the trading gradient and becomes a flat card'
    File = $LOBBY
    From = 'className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-yellow-500/20 via-gray-800 to-gray-900 p-4 sm:p-6 md:p-8 shadow-xl border border-yellow-500/20"'
    To   = 'className="relative overflow-hidden rounded-xl border border-gray-800 bg-gray-900/40 p-6"'
    Test = 'class string: relative overflow-hidden rounded-xl'
  },
  @{
    Name = 'the two-column split is re-invented at a different ratio'
    File = $LOBBY
    From = 'className="grid grid-cols-1 lg:grid-cols-3 gap-6"'
    To   = 'className="grid gap-6 lg:grid-cols-.1fr_320px."'
    Test = 'class string: grid grid-cols-1 lg'
  },
  @{
    Name = 'the leaderboard panel gets its own shell'
    File = $LOBBY
    From = 'className="rounded-xl bg-gray-800/50 border border-gray-700 p-4 sm:p-6"'
    To   = 'className="rounded-xl border border-gray-800 bg-gray-900/40 p-4"'
    Test = 'class string: rounded-xl bg-gray-800/50'
  },
  @{
    Name = 'the contest name is set at a smaller size than the trading lobby uses'
    File = $LOBBY
    From = 'className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-100 mb-2"'
    To   = 'className="text-2xl font-semibold text-white"'
    Test = 'class string: text-2xl sm:text-3xl md:text-4xl'
  },
  @{
    Name = 'the hero figure label stops being uppercase and tracked'
    File = $UI
    From = 'className="text-[11px] sm:text-xs text-gray-500 uppercase tracking-wider"'
    To   = 'className="text-xs text-gray-500"'
    Test = 'class string: text-.11px. sm:text-xs'
  },
  @{
    Name = 'the hero figure value stops scaling with the viewport'
    File = $UI
    From = '`text-xl sm:text-2xl md:text-3xl font-bold ${valueTone}`'
    To   = '`text-sm font-semibold ${valueTone}`'
    Test = 'class string: text-xl sm:text-2xl md:text-3xl font-bold'
  },
  @{
    Name = 'the panel heading icon becomes a flat lucide glyph'
    File = $UI
    From = '<GameIcon name={icon} size={16} />'
    To   = '<span className="h-4 w-4" />'
    Test = 'heads its panels with the same 3D icon set'
  },
  @{
    Name = 'a flat glyph is used beside the refusal instead of the 3D set'
    File = $LOBBY
    From = '<GameIcon name="warning" size={16} className="mt-0.5 shrink-0" />'
    To   = '<Info className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />'
    Test = 'heads its panels with the same 3D icon set'
  },
  @{
    Name = 'the rank medals are replaced by a bare number'
    File = $BOARD
    From = '<RankIcon rank={row.currentRank} size={22} />'
    To   = '<span className="text-sm">{row.currentRank}</span>'
    Test = 'heads its panels with the same 3D icon set'
  },
  @{
    Name = 'the UTC clock is dropped from the header'
    File = $LOBBY
    From = '<UTCClock />'
    To   = '<span className="text-xs text-gray-500">UTC</span>'
    Test = 'reuses the trading lobby.s time components'
  },
  @{
    Name = 'the lobby formats the remaining time itself'
    File = $LOBBY
    From = 'const countdownTarget = isActive ? competition.endTime : competition.startTime;'
    To   = 'const countdownTarget = Math.floor((Date.now() % (1000 * 60 * 60)) / 1000);'
    Test = 'reuses the trading lobby.s time components'
  },
  @{
    Name = 'the count pill is copied from the trading board verbatim'
    File = $LOBBY
    From = '{leaderboard.length} players'
    To   = '{leaderboard.length} traders'
    Test = 'says players, never traders'
  },
  @{
    Name = 'the panel accent is interpolated into the class string'
    File = $UI
    From = '${PANEL_SHELLS.get(accent) ?? GRAY_SHELL}'
    To   = 'from-${accent}-500/10 to-gray-800/50 border-${accent}-500/30'
    Test = 'builds no Tailwind class by interpolation'
  },
  @{
    Name = 'the trading performance dashboard is rendered on the game lobby'
    File = $LOBBY
    From = '<ProviderLeaderboard'
    To   = '<CompetitionDashboard /><ProviderLeaderboard'
    Test = 'renders no trading panel from the trading lobby'
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
