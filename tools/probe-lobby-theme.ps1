# Probes for the guards that keep both competition lobbies built from one design kit.
#
# WHAT CHANGED HERE, AND WHY IT MATTERS TO THE HARNESS. The previous version of this file probed
# a guard that compared class strings between two lobby files. Those guards are gone: the kit
# replaced them, because pairwise comparison between five screens is twenty comparisons and the
# first one nobody adds is silent. The probes below therefore aim at a different property - that
# the kit is the single definition and neither screen has chrome of its own.
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
#   * The -t filter is a REGEX, so the fragments below avoid `[`, `(` and `|`, and use `.`
#     where the real test name has a bracket.

$ErrorActionPreference = 'Continue'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Suite = '__tests__/games/provider-play-ui.test.ts'

$LOBBY = 'components/games/ProviderContestLobby.tsx'
$BOARD = 'components/games/ProviderLeaderboard.tsx'
$TOKENS = 'components/neon/tokens.ts'
$CARDS = 'components/neon/Cards.tsx'
$HERO = 'components/trading/lobby/TradingLobbyHero.tsx'
$SIDEBAR = 'components/trading/lobby/TradingLobbySidebar.tsx'
$PRIZES = 'components/trading/lobby/TradingPrizeTable.tsx'
$TRADING_BOARD = 'components/trading/CompetitionLeaderboard.tsx'

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
  # ---- The kit owns the chrome, and nothing outside it spells the chrome out ----------------
  @{
    Name = 'the game lobby hand-rolls a panel instead of using the token'
    File = $LOBBY
    From = 'className={`${NEON_PANEL} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}'
    To   = 'className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1B2540] bg-[#0A0F1F]/80 px-4 py-3"'
    # The it.each case names contain the class string, so the -t REGEX has to avoid `[` and `/`.
    # An earlier version used dots for the brackets and miscounted them, which reported PROBE
    # BROKEN on a working guard. The hex is unique to one case and contains nothing special.
    Test = '#1B2540'
  },
  @{
    Name = 'the trading sidebar hand-rolls a panel instead of using the kit'
    File = $SIDEBAR
    From = '<NeonPanel icon={Target} accent="players" title="Schedule (UTC)">'
    To   = '<div className="rounded-xl border border-[#1B2540] bg-[#0A0F1F]/80 p-4"><NeonPanel icon={Target} accent="players" title="Schedule (UTC)">'
    Test = '#1B2540'
  },
  @{
    Name = 'the game board hand-rolls the row shell'
    File = $BOARD
    From = '${neonRowClasses('
    To   = '${"border-[#161E36] bg-[#080C18]/80 " + neonRowClasses('
    Test = '#161E36'
  },
  @{
    Name = 'the kit stops defining the panel shell at all'
    File = $TOKENS
    From = '"rounded-xl border border-[#1B2540] bg-[#0A0F1F]/80 backdrop-blur-sm"'
    To   = '"rounded-xl border border-gray-800 bg-gray-900/40"'
    Test = '#1B2540'
  },

  # ---- Both heroes are the same component, four figures across -----------------------------
  @{
    Name = 'the game lobby grows its own hero instead of the shared one'
    File = $LOBBY
    From = '<NeonHero'
    To   = '<div className="p-6"><NeonHeroReplacement'
    Test = 'dresses both heroes with the same component'
  },
  @{
    Name = 'the trading hero grows its own instead of the shared one'
    File = $HERO
    From = '<NeonHero'
    To   = '<div className="p-6"><NeonHeroReplacement'
    Test = 'dresses both heroes with the same component'
  },
  @{
    Name = 'the game hero widens to five figures across'
    File = $LOBBY
    From = 'className="grid grid-cols-2 gap-3 md:grid-cols-4 sm:gap-4"'
    To   = 'className="grid grid-cols-2 gap-3 md:grid-cols-5 sm:gap-4"'
    Test = 'draws every figure with the same stat card, four across'
  },
  @{
    Name = 'the trading hero writes its own figure markup beside the cards'
    File = $HERO
    From = '<StatCard'
    To   = '<div className="grid-cols-4" /><StatCard'
    Test = 'draws every figure with the same stat card, four across'
  },

  # ---- Both boards share the row shell and the column headings -----------------------------
  @{
    Name = 'the trading board writes its own column headings'
    File = $TRADING_BOARD
    From = 'NEON_TABLE_HEAD'
    To   = '"px-3 py-2 text-left text-xs text-gray-500"'
    Test = 'gives both leaderboards the same row shell and column headings'
  },
  @{
    Name = 'the trading board writes its own row shell'
    File = $TRADING_BOARD
    From = 'neonRowClasses({'
    To   = 'ownRowClasses({'
    Test = 'gives both leaderboards the same row shell and column headings'
  },

  # ---- The icon set is the sheet's, on every screen -----------------------------------------
  @{
    Name = 'the game lobby reverts to the 3D icon set'
    File = $LOBBY
    From = 'icon={Trophy}'
    To   = 'icon={GameIcon}'
    Test = 'uses the flat icon set from the sheet'
  },
  @{
    Name = 'the board reverts to the 3D rank medals'
    File = $BOARD
    From = '<NeonRankBadge rank={row.currentRank} />'
    To   = '<RankIcon rank={row.currentRank} size={22} />'
    Test = 'uses the flat icon set from the sheet'
  },
  @{
    Name = 'the icon tile stops being a single definition'
    File = $CARDS
    From = 'export function IconTile('
    To   = 'function IconTileLocal('
    Test = 'uses the flat icon set from the sheet'
  },

  # ---- Time, wording, and class interpolation ----------------------------------------------
  @{
    Name = 'the UTC clock is dropped from the game lobby header'
    File = $LOBBY
    From = '<UTCClock />'
    To   = '<span className="text-xs text-gray-500">UTC</span>'
    Test = 'reuses the trading lobby.s time components'
  },
  @{
    Name = 'the game lobby formats the remaining time itself'
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
    Name = 'the kit interpolates an accent into a class string'
    File = $TOKENS
    From = 'export function accentClasses('
    To   = 'export function unusedAccentClasses(accent: NeonAccent) { return { tile: `bg-${accent}-500/10`, text: "", surface: "" }; }
export function accentClasses('
    Test = 'builds no Tailwind class by interpolation'
  },
  @{
    Name = 'the trading accordions interpolate an accent'
    File = $SIDEBAR
    From = '<NeonAccordion sections={sections} />'
    To   = '<div className={`border-${sections.length}-500/30`} /><NeonAccordion sections={sections} />'
    Test = 'builds no Tailwind class by interpolation'
  },
  @{
    Name = 'the trading performance dashboard is rendered on the game lobby'
    File = $LOBBY
    From = '<ProviderLeaderboard'
    To   = '<CompetitionDashboard /><ProviderLeaderboard'
    Test = 'renders no trading panel on the game lobby'
  },

  # ---- The sidebar's decisions stay open, and the money did not move -----------------------
  @{
    Name = 'the prize table is buried inside the accordion'
    File = $SIDEBAR
    From = '<TradingPrizeTable competition={competition} currSymbol={currSymbol} />'
    To   = '<span data-moved="TradingPrizeTable" />'
    Test = 'keeps the trading sidebar.s decisions open'
  },
  @{
    Name = 'the entry control is pushed below the reference material'
    File = $SIDEBAR
    From = '<CompetitionEntryButton'
    To   = '<EntryButtonMovedBelow'
    Test = 'keeps the trading sidebar.s decisions open'
  },
  @{
    Name = 'the unclaimed-prize split silently changes denominator'
    File = $PRIZES
    From = 'filledPositions > 0 ? unclaimedPercentage / filledPositions : 0'
    To   = 'filledPositions > 0 ? unclaimedPercentage / (filledPositions + 1) : 0'
    Test = 'moves no money computation while restyling the prize table'
  },
  @{
    Name = 'the platform fee stops being deducted from a prize'
    File = $PRIZES
    From = '(1 - platformFeePercentage)'
    To   = '(1 - 0)'
    Test = 'moves no money computation while restyling the prize table'
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
    if ($red -le 2) {
      Write-Host "  RED as expected ($red failed)" -ForegroundColor Green
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
