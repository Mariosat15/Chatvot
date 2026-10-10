<#
  Probes for the dashboard's self-refreshing competition cards (13 s5.1b, 11 September 2026).

  Conventions, each learned by getting one wrong: UTF-8 without a BOM on the read AND the
  write; refuse to write an empty file; relax newlines so a CRLF pattern matches an LF file;
  name the expected failing test and run it alone with `-t`; collapse whitespace in captured
  output because `Out-String` wraps at the console width; and DID NOT APPLY means the target
  moved, never that the run was quiet.

  Four causes of a green probe, all of which have happened on this codebase: a weak test, a
  wrong claim, a guard that is real but unreachable, and a mutation that changes no observable.
#>

$ErrorActionPreference = 'Continue'
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$Root = Split-Path -Parent $PSScriptRoot
$Suite = '__tests__/games/dashboard-live-refresh.test.ts'

$Route   = Join-Path $Root 'app/api/competitions/dashboard-live/route.ts'
$Sidebar = Join-Path $Root 'components/dashboard/ContestsSidebar.tsx'

function Read-Source([string]$Path) {
  return [System.IO.File]::ReadAllText($Path, $Utf8NoBom)
}

function Write-Source([string]$Path, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) {
    throw "refusing to write an empty file to $Path"
  }
  [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function To-Relaxed([string]$Literal) {
  return ([regex]::Escape($Literal) -replace '(\\r)?\\n', '\r?\n')
}

$script:Pass = 0
$script:Fail = 0

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$From,
    [string]$To,
    [string]$ExpectedTest
  )

  Write-Host ""
  Write-Host "-- $Name" -ForegroundColor Cyan
  Write-Host "   expects RED: $ExpectedTest"

  $original = Read-Source $File
  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "   UNREADABLE - probe aborted, file left untouched" -ForegroundColor Red
    $script:Fail++
    return
  }

  $pattern = To-Relaxed $From
  $mutated = [regex]::Replace($original, $pattern, { param($m) $To }, 1)

  if ($mutated -eq $original) {
    Write-Host "   DID NOT APPLY - the target moved. This is NOT a quiet run." -ForegroundColor Red
    $script:Fail++
    return
  }

  try {
    Write-Source $File $mutated

    $raw = & npx vitest run $Suite -t $ExpectedTest 2>&1 | Out-String
    $flat = ($raw -replace '\s+', ' ')

    if ($flat -match 'No test files found' -or $flat -match 'Tests\s+0 passed') {
      Write-Host "   NO TEST RAN - the name does not match a test" -ForegroundColor Red
      $script:Fail++
    }
    elseif ($flat -match 'Tests\s+(\d+)\s+failed') {
      $failed = [int]$Matches[1]
      if ($failed -eq 1) {
        Write-Host "   RED (1 failure, as expected)" -ForegroundColor Green
      } else {
        Write-Host "   RED but $failed failures - blast radius" -ForegroundColor Yellow
      }
      $script:Pass++
    }
    else {
      Write-Host "   GREEN - absent, weak, unreachable, or changes no observable" -ForegroundColor Red
      $script:Fail++
    }
  }
  finally {
    Write-Source $File $original
  }
}

Write-Host "Probing the dashboard live refresh" -ForegroundColor White

# -- The endpoint must AGREE with the page, which is the property that matters most ---------

Invoke-Probe `
  -Name 'the endpoint sorts the rank itself instead of using the shared resolver' `
  -File $Route `
  -From '      const currentRank = await resolveRank({' `
  -To '      const _own = [...participants].sort((a: any, b: any) => {
        const aHasTrades = (a.totalTrades || 0) > 0;
        const bHasTrades = (b.totalTrades || 0) > 0;
        if (aHasTrades && !bHasTrades) return -1;
        if (!aHasTrades && bHasTrades) return 1;
        return 0;
      });
      void _own;
      const currentRank = await resolveRank({' `
  -ExpectedTest 'sorts the rank with the shared resolver and not a copy of its own'

Invoke-Probe `
  -Name 'the endpoint stops fetching score on the rows it ranks from' `
  -File $Route `
  -From '"userId competitionId pnl currentCapital startingCapital currentRank totalTrades winningTrades losingTrades status score"' `
  -To '"userId competitionId pnl currentCapital startingCapital currentRank totalTrades winningTrades losingTrades status"' `
  -ExpectedTest 'reads the same participant fields the page ranks from'

Invoke-Probe `
  -Name 'the endpoint recomputes profit and loss live while the page shows the stored value' `
  -File $Route `
  -From '        pnl: mine.pnl || 0,' `
  -To '        pnl: await fetchRealForexPrices([]).then(() => calculateUnrealizedPnL()),' `
  -ExpectedTest 'reports the STORED profit and loss rather than recomputing it'

Invoke-Probe `
  -Name 'an absent score is reported as zero' `
  -File $Route `
  -From '        score: mine.score,' `
  -To '        score: mine.score ?? 0,' `
  -ExpectedTest 'does not coerce an absent score to zero'

Invoke-Probe `
  -Name 'the endpoint answers anybody who asks' `
  -File $Route `
  -From '    const session = await auth.api.getSession({ headers: await headers() });' `
  -To '    const session = { user: { id: String(1) } };' `
  -ExpectedTest 'refuses a caller with no session'

Invoke-Probe `
  -Name 'a resolver is built per contest, losing the direction memo' `
  -File $Route `
  -From '    const { resolveRank } = createDashboardRankResolver();' `
  -To '    // moved into the loop' `
  -ExpectedTest 'creates one resolver for the request, not one per contest'

# -- The sidebar must SHOW it -------------------------------------------------------------

Invoke-Probe `
  -Name 'the competitions poll is removed and only challenges refresh' `
  -File $Sidebar `
  -From 'const res = await fetch("/api/competitions/dashboard-live");' `
  -To 'const res = new Response("{}");' `
  -ExpectedTest 'polls the competitions endpoint, not only the challenges one'

Invoke-Probe `
  -Name 'it polls every fifteen seconds and renders the frozen props anyway' `
  -File $Sidebar `
  -From '  const activeComps = liveComps;' `
  -To '  const activeComps = competitions.active;' `
  -ExpectedTest 'renders the live list rather than the props it was given'

Invoke-Probe `
  -Name 'the interval is a literal beside the named one' `
  -File $Sidebar `
  -From 'PERFORMANCE_INTERVALS.COMPETITION_LIVE_DATA);' `
  -To '15000);' `
  -ExpectedTest 'takes its interval from the shared constant'

Invoke-Probe `
  -Name 'a malformed response clears every card' `
  -File $Sidebar `
  -From '      if (!Array.isArray(data.competitions)) return;' `
  -To '' `
  -ExpectedTest 'leaves the cards alone when the response is not a well-formed list'

Invoke-Probe `
  -Name 'a finished contest stays on the list with a live rank' `
  -File $Sidebar `
  -From '        return updated.filter((c) => liveMap.has(c.id));' `
  -To '        return updated;' `
  -ExpectedTest 'drops a contest the endpoint stops reporting'

Invoke-Probe `
  -Name 'the two polls share one mounted flag' `
  -File $Sidebar `
  -From '    if (!isCompMountedRef.current) return;' `
  -To '    if (!isMountedRef.current) return;' `
  -ExpectedTest "keeps its own mounted flag rather than sharing the challenge poll's"

# -- The countdown ------------------------------------------------------------------------

Invoke-Probe `
  -Name 'the timer ticks but the render still reads the clock fresh' `
  -File $Sidebar `
  -From '  const ms = new Date(endTime).getTime() - now;' `
  -To '  const ms = new Date(endTime).getTime() - Date.now();' `
  -ExpectedTest 're-reads the clock on a timer instead of once at render'

Invoke-Probe `
  -Name 'the interval is never cleared' `
  -File $Sidebar `
  -From '      clearInterval(tick);' `
  -To '' `
  -ExpectedTest 'clears its timer'

Write-Host ""
Write-Host "---------------------------------------------" -ForegroundColor White
Write-Host "  red as expected: $script:Pass" -ForegroundColor Green
Write-Host "  NOT red:         $script:Fail" -ForegroundColor $(if ($script:Fail -gt 0) { 'Red' } else { 'Green' })
Write-Host "---------------------------------------------" -ForegroundColor White
