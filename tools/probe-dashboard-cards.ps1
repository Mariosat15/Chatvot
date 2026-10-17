# Probes for the game-aware dashboard cards.
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

$ErrorActionPreference = 'Continue'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Suite = '__tests__/games/provider-dashboard-cards.test.ts'

$ACTION = 'lib/actions/comprehensive-dashboard.actions.ts'
$SIDEBAR = 'components/dashboard/ContestsSidebar.tsx'
$CARD = 'components/dashboard/ActiveCompetitionCard.tsx'
$TABLE = 'components/dashboard/CompetitionsTable.tsx'

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
    Name = 'the score is dropped from the participant select'
    File = $ACTION
    From = 'prizeReceived createdAt score"'
    To   = 'prizeReceived createdAt"'
    Test = 'selects score on the participant'
  },
  @{
    Name = 'the score is dropped from the bulk ranking read'
    File = $ACTION
    From = 'losingTrades status score")'
    To   = 'losingTrades status")'
    Test = 'selects score on the bulk participant read used for ranking'
  },
  @{
    Name = 'the game label is dropped from the competition select'
    File = $ACTION
    From = 'prizeDistribution gameType gameKey"'
    To   = 'prizeDistribution gameType"'
    Test = 'selects the game label on the competition'
  },
  @{
    Name = 'an absent score is coerced to zero on its way to the card'
    File = $ACTION
    From = 'score: participation.score,'
    To   = 'score: participation.score || 0,'
    Test = 'does not coerce an absent score to zero on its way to the card'
  },
  @{
    Name = 'the direction is assumed rather than resolved'
    File = $ACTION
    From = '? await scoreDirectionFor(competition.gameKey)'
    To   = '? "higher_is_better"'
    Test = 'resolves the score direction rather than assuming higher is better'
  },
  @{
    Name = 'ranking is hand-rolled instead of dispatched to the registry'
    File = $ACTION
    From = '? providerModule.getRankingValue('
    To   = '? ((q) => q.score ?? 0)('
    Test = 'dispatches through the game registry instead of adding a score case to the switch'
  },
  @{
    Name = 'the has-trades pre-sort is applied to a provider contest again'
    File = $ACTION
    From = 'if (!isProviderGame) {'
    To   = 'if (true) {'
    Test = 'skips the has-trades pre-sort for a provider contest'
  },
  @{
    Name = 'the strict launch helper is used to decide ranking'
    File = $ACTION
    From = 'const isProviderGame = hasProviderGameLabel(competition);'
    To   = 'const isProviderGame = isProviderContest(competition);'
    Test = 'reads the game label with the display helper, not the launch helper'
  },
  @{
    Name = 'the card metric goes back to three parallel switches'
    File = $SIDEBAR
    From = 'const metric = describeCompMetric(comp);'
    To   = 'const metric = { value: formatCompMetric(comp), label: getCompMetricLabel(comp.rankingMethod), tone: "positive" as const };'
    Test = 'decides value, label and colour in one function'
  },
  @{
    Name = 'the neutral colour is removed, so a score renders as a loss'
    File = $SIDEBAR
    From = 'tone: "neutral",'
    To   = 'tone: "negative",'
    Test = 'gives the colour a third state so a score is never rendered as a loss'
  },
  @{
    Name = 'an absent score is rendered as zero on the card'
    File = $SIDEBAR
    From = 'comp.score === undefined || comp.score === null'
    To   = 'false'
    Test = 'renders an absent score as a dash rather than as zero'
  },
  @{
    Name = 'the provider metric is labelled with a trading term'
    File = $SIDEBAR
    From = 'label: "Score",'
    To   = 'label: "P&L",'
    Test = 'labels the metric Score for a provider contest'
  },
  @{
    Name = 'the active-competition branch moves below the trading arithmetic'
    File = $CARD
    From = 'if (competition?.gameType === "provider") {'
    To   = 'if (participation.pnl >= 0 && competition?.gameType === "provider") {'
    Test = 'the active-competition card branches instead of guarding nine blocks'
  },
  @{
    Name = 'the provider card gains a Trade Now button'
    File = $CARD
    From = '            View contest'
    To   = '            Trade Now'
    Test = 'the provider card never says Trade Now and never links to the trade route'
  },
  @{
    Name = 'the provider card links straight at the route that spends an attempt'
    File = $CARD
    From = '          href={`/competitions/${competition._id}`}
          className="block w-full py-3 px-6 bg-gradient-to-r from-yellow-500'
    To   = '          href={`/competitions/${competition._id}/play`}
          className="block w-full py-3 px-6 bg-gradient-to-r from-yellow-500'
    Test = 'the provider card does not link straight at the route that spends an attempt'
  },
  @{
    Name = 'the table row span is wrong by one'
    File = $TABLE
    From = 'colSpan={10}'
    To   = 'colSpan={9}'
    Test = 'the table replaces its trading columns rather than filling them with zeroes'
  },
  @{
    Name = 'the table branch moves below the capital and margin maths'
    File = $TABLE
    From = 'if (comp.competition?.gameType === "provider") {'
    To   = 'if (comp.participation.pnl >= 0 && comp.competition?.gameType === "provider") {'
    Test = 'the table branches before computing capital health'
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
