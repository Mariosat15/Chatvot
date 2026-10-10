<#
  Probes for the extracted dashboard rank resolver (13 s5.1b, 11 September 2026).

  WHAT IS BEING PROVED. The four ranking claims moved out of the dashboard action into
  `lib/services/games/dashboard-contest-rank.service.ts` and were re-pointed rather than
  rewritten. A re-pointed test is exactly the kind that can end up asserting nothing - it
  reads a file it was never written against - so every one of them is probed at its new home,
  plus the three new guards that stop a second copy of the sort appearing.

  THE CONVENTIONS, EACH LEARNED BY GETTING IT WRONG:

    - UTF-8 WITHOUT A BOM on the read AND the write. PowerShell 5.1's `Get-Content -Raw`
      decodes with the system ANSI codepage, so every emoji in a touched file comes back as
      mojibake and is written back that way: probes pass, files are quietly mangled, and it
      surfaces two steps later as unexplained typecheck errors.
    - REFUSE TO WRITE AN EMPTY FILE. A read that returned nothing followed by a write is how
      a probe destroys the file it is probing and reports success.
    - RELAX NEWLINES. A multi-line pattern with CRLF does not match an LF file, nothing is
      modified, and the test stays green - which is indistinguishable from a broken guard.
    - NAME THE EXPECTED FAILING TEST and run it alone with `-t`. Vitest prints a test's name
      for a pass as readily as a failure, so judging a probe by searching whole-suite output
      for the name reports RED beside "0 failed".
    - COLLAPSE WHITESPACE in captured output before matching, because `Out-String` wraps at
      the console width and a long test name arrives split across two lines.
    - DID NOT APPLY MEANS THE TARGET MOVED, never that the run was quiet.

  FOUR CAUSES OF A GREEN PROBE, all of which have happened here: a weak test, a wrong claim,
  a guard that is real but unreachable, and a mutation that changes no observable.
#>

$ErrorActionPreference = 'Continue'
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$Root = Split-Path -Parent $PSScriptRoot
$Suite = '__tests__/games/provider-dashboard-cards.test.ts'

$Service = Join-Path $Root 'lib/services/games/dashboard-contest-rank.service.ts'
$Action  = Join-Path $Root 'lib/actions/comprehensive-dashboard.actions.ts'
$Arena   = Join-Path $Root 'app/api/dashboard/competitions/route.ts'

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
  Write-Host "── $Name" -ForegroundColor Cyan
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
        $script:Pass++
      } else {
        Write-Host "   RED but $failed failures - blast radius, the probe is hitting more than the guard" -ForegroundColor Yellow
        $script:Pass++
      }
    }
    else {
      Write-Host "   GREEN - the guard is absent, weak, unreachable, or changes no observable" -ForegroundColor Red
      $script:Fail++
    }
  }
  finally {
    Write-Source $File $original
  }
}

Write-Host "Probing the dashboard rank resolver" -ForegroundColor White

# ── Group 1: the four re-pointed claims, at their new home ────────────────────────────────
# If any of these is green, the move silently un-guarded a property that was guarded before.

Invoke-Probe `
  -Name 'the score direction is hard-coded instead of resolved' `
  -File $Service `
  -From 'const direction = isProviderGame
      ? await scoreDirectionFor(competition.gameKey)
      : undefined;' `
  -To 'const direction = isProviderGame ? "higher_is_better" : undefined;' `
  -ExpectedTest 'resolves the score direction rather than assuming higher is better'

Invoke-Probe `
  -Name 'the provider score is ranked by the trading switch instead of the registry' `
  -File $Service `
  -From 'const providerModule = isProviderGame
      ? getGameModuleOrTrading(competition.gameType)
      : undefined;' `
  -To 'const providerModule = undefined as undefined | { getRankingValue: (p: any, m: string) => number };' `
  -ExpectedTest 'dispatches through the game registry instead of adding a score case'

Invoke-Probe `
  -Name 'the has-trades pre-sort is applied to a provider contest too' `
  -File $Service `
  -From 'if (!isProviderGame) {' `
  -To 'if (true) {' `
  -ExpectedTest 'skips the has-trades pre-sort for a provider contest'

Invoke-Probe `
  -Name 'the strict launch helper decides what a provider contest is' `
  -File $Service `
  -From 'const isProviderGame = hasProviderGameLabel(competition);' `
  -To 'const isProviderGame = isProviderContest(competition as never);' `
  -ExpectedTest 'reads the game label with the display helper, not the launch helper'

# ── Group 2: the action must delegate, not merely import ──────────────────────────────────
# THE NEGATIVE HALF IS THE LOAD-BEARING ONE. A version that calls the resolver and then sorts
# anyway satisfies every positive assertion, and its answer is the one the card shows.

Invoke-Probe `
  -Name 'the action keeps its own copy of the sort beside the shared one' `
  -File $Action `
  -From '    const computedRank = await resolveRank({' `
  -To '    const _shadow = [...competitionParticipants].sort((a: any, b: any) => {
      const aHasTrades = (a.totalTrades || 0) > 0;
      const bHasTrades = (b.totalTrades || 0) > 0;
      if (aHasTrades && !bHasTrades) return -1;
      if (!aHasTrades && bHasTrades) return 1;
      return 0;
    });
    void _shadow;
    const computedRank = await resolveRank({' `
  -ExpectedTest 'the action delegates rather than sorting participants itself'

Invoke-Probe `
  -Name 'the resolver is created inside the per-contest loop' `
  -File $Action `
  -From '  const { resolveRank } = createDashboardRankResolver();' `
  -To '  // moved into the loop below' `
  -ExpectedTest 'the resolver is created once per request, not once per contest'

# ── Group 3: the exception's canary ───────────────────────────────────────────────────────
# The arena route is a named exception. This probe proves the canary can actually fire, so a
# stale exception cannot sit there re-permitting the defect after somebody fixes that route.

Invoke-Probe `
  -Name 'the arena route has been fixed and the exception is now stale' `
  -File $Arena `
  -From '          const aHasTrades = a.totalTrades > 0;' `
  -To '          const _resolved = await resolveRank({});' `
  -ExpectedTest 'the arena broadcast route is STILL an offender'

Write-Host ""
Write-Host "─────────────────────────────────────────────" -ForegroundColor White
Write-Host "  red as expected: $script:Pass" -ForegroundColor Green
Write-Host "  NOT red:         $script:Fail" -ForegroundColor $(if ($script:Fail -gt 0) { 'Red' } else { 'Green' })
Write-Host "─────────────────────────────────────────────" -ForegroundColor White
