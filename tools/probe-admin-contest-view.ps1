# Probes for the game-aware admin contest view (`12` s2.4).
#
# Each probe reinstates one defect and expects ONE named test to go red. Naming the expected
# test is the point: an earlier probe here reported red against a test asserting a different
# claim, which is indistinguishable from the guard working.
#
# Harness rules carried from the six previous probing instances, all of which produced a false
# result at least once:
#   - `-LiteralPath` on the READ as well as the write. Route paths contain `[id]`, which
#     PowerShell parses as a wildcard character class, so `Get-Content` returns $null and the
#     file gets "restored" to nothing. The tell is the failure COUNT, not the failure.
#   - Refuse to write when the read came back empty, for the same reason.
#   - UTF-8 without BOM on both ends, and assert a lossless round trip: PowerShell 5.1 decodes
#     with the system ANSI codepage, which silently mangles every emoji in a touched file.
#   - Assert the file actually CHANGED. A pattern that fails to apply is indistinguishable from
#     a test that does not work.
#   - Judge by the summary counts of a single `-t` run, never by searching whole-suite output
#     for a test name, which vitest prints for a passing test as readily as a failing one.

$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $PSScriptRoot
$Module = Join-Path $Root "apps\admin\lib\admin\contest-result-presentation.ts"
$Suite = "__tests__/admin/contest-result-presentation.test.ts"

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Source([string]$Path) {
    $text = [System.IO.File]::ReadAllText($Path, $Utf8NoBom)
    if ([string]::IsNullOrWhiteSpace($text)) {
        throw "ABORT: read of $Path came back empty. Refusing to continue."
    }
    return $text
}

function Write-Source([string]$Path, [string]$Text) {
    if ([string]::IsNullOrWhiteSpace($Text)) {
        throw "ABORT: refusing to write empty content to $Path"
    }
    [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

# Relax newlines so a CRLF pattern matches an LF file, and vice versa.
function To-Relaxed([string]$Literal) {
    return ([regex]::Escape($Literal) -replace "\\r\\n|\\n", "\r?\n")
}

function Invoke-Probe {
    param(
        [string]$Name,
        [string]$ExpectTest,
        [string]$Find,
        [string]$Replace
    )

    Write-Host ""
    Write-Host "=== PROBE: $Name" -ForegroundColor Cyan
    Write-Host "    expects red: $ExpectTest"

    $original = Read-Source $Module
    $pattern = To-Relaxed $Find
    $patched = [regex]::Replace($original, $pattern, { param($m) $Replace }, 1)

    if ($patched -eq $original) {
        Write-Host "    PROBE DID NOT APPLY - pattern never matched. Result is meaningless." -ForegroundColor Red
        return
    }

    try {
        Write-Source $Module $patched

        $out = & npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String
        # Collapse whitespace: Out-String wraps at the console width, so a long test name can
        # arrive split across two lines and a literal match silently misses it.
        $flat = ($out -replace "\s+", " ")

        # `-t` files every unselected test as SKIPPED, not passed, so the summary reads
        # "1 failed | 11 skipped". Matching only "failed | N passed" made all 13 probes report
        # UNKNOWN - the harness could not read its own result. Seventh probing instance, and the
        # same shape as every other: the harness failed, not the guard.
        if ($flat -match "Tests\s+(\d+)\s+failed") {
            $failed = [int]$Matches[1]
            if ($failed -eq 1) {
                Write-Host "    RED as expected (1 failed)" -ForegroundColor Green
            }
            else {
                # More damage than the probe caused is not a report about the guard: it means
                # the edit broke something unrelated, or the file was mangled.
                Write-Host "    RED but $failed tests failed - expected exactly 1. Suspect collateral damage, not a guard." -ForegroundColor Yellow
            }
        }
        elseif ($flat -match "Tests\s+.*(passed|skipped)") {
            Write-Host "    GREEN - the guard is NOT held by this test. Investigate: weak test, wrong claim, unreachable, or missing test." -ForegroundColor Red
        }
        elseif ($flat -match "No test found") {
            Write-Host "    NO TEST RAN - the expected test name does not match. Probe is mis-aimed." -ForegroundColor Red
        }
        else {
            Write-Host "    UNKNOWN result - read the output." -ForegroundColor Yellow
            Write-Host $out
        }
    }
    finally {
        Write-Source $Module $original
        $restored = Read-Source $Module
        if ($restored -ne $original) {
            Write-Host "    !! RESTORE FAILED - fix $Module by hand before continuing." -ForegroundColor Red
        }
    }
}

Write-Host "Probing the admin contest view presentation module" -ForegroundColor White

# 1. The defect exactly as it shipped: the provider branch reads trading's P&L.
Invoke-Probe -Name "provider column falls back to trading P&L" `
    -ExpectTest "shows a provider participant's SCORE, not their zero P&L" `
    -Find @'
    return {
      value: hasScore ? (row.score as number).toLocaleString() : "-",
'@ `
    -Replace @'
    return {
      value: `${(row.pnl ?? 0) >= 0 ? "+" : ""}${(row.pnl ?? 0).toFixed(2)}`,
'@

# 2. An absent score printed as 0 - the read-side form of R45.
Invoke-Probe -Name "absent score renders as 0 rather than a dash" `
    -ExpectTest "distinguishes NO SCORE from a score of zero" `
    -Find 'const hasScore = typeof row.score === "number" && Number.isFinite(row.score);' `
    -Replace 'const hasScore = true;'

# 3. Truthiness instead of a finite check, which folds 0 in with absent.
Invoke-Probe -Name "truthiness check folds a zero score in with an absent one" `
    -ExpectTest "distinguishes NO SCORE from a score of zero" `
    -Find 'const hasScore = typeof row.score === "number" && Number.isFinite(row.score);' `
    -Replace 'const hasScore = Boolean(row.score);'

# 4. NaN admitted as a real score.
Invoke-Probe -Name "a non-finite score is admitted" `
    -ExpectTest "treats null and a non-finite score as absent, not as zero" `
    -Find 'const hasScore = typeof row.score === "number" && Number.isFinite(row.score);' `
    -Replace 'const hasScore = typeof row.score === "number";'

# 5. A score coloured like a profit.
Invoke-Probe -Name "score coloured as profit or loss" `
    -ExpectTest "does not render a provider score as a profit or a loss" `
    -Find @'
      sub: null,
      tone: "neutral",
'@ `
    -Replace @'
      sub: null,
      tone: (row.score ?? 0) >= 0 ? "positive" : "negative",
'@

# 6. The trade count reinstated for provider rows.
Invoke-Probe -Name "trade count reported for a provider contest" `
    -ExpectTest "never reports a trade count for a provider contest" `
    -Find 'if (isProviderGame) return null;
  return `${row.totalTrades ?? 0} trades`;' `
    -Replace 'return `${row.totalTrades ?? 0} trades`;'

# 7. Trading configuration shown for every game - the $0 starting capital.
Invoke-Probe -Name "trading configuration rendered for a provider contest" `
    -ExpectTest "withholds starting capital, leverage and asset classes on a provider contest" `
    -Find 'return !isProviderGame;' `
    -Replace 'return true;'

# 8. Edit routed to the trading editor for every game - the defect as it shipped.
Invoke-Probe -Name "Edit always routes to the trading editor" `
    -ExpectTest "routes a provider contest to the game editor and trading to the trading editor" `
    -Find @'
  return isProviderGame
    ? `/competitions/edit-game/${competitionId}`
    : `/competitions/edit/${competitionId}`;
'@ `
    -Replace @'
  return `/competitions/edit/${competitionId}`;
'@

# 9. The two destinations SWAPPED. A test naming only the game editor stays green on a swap,
#    and a swap is exactly what sends a provider contest to the trading form.
Invoke-Probe -Name "the two Edit destinations are swapped" `
    -ExpectTest "routes a provider contest to the game editor and trading to the trading editor" `
    -Find @'
  return isProviderGame
    ? `/competitions/edit-game/${competitionId}`
    : `/competitions/edit/${competitionId}`;
'@ `
    -Replace @'
  return isProviderGame
    ? `/competitions/edit/${competitionId}`
    : `/competitions/edit-game/${competitionId}`;
'@

# 10. The no-winners notice announced mid-contest.
Invoke-Probe -Name "no-winners notice not scoped to a completed contest" `
    -ExpectTest "stays silent unless the contest is completed AND paid nobody" `
    -Find 'if (!input.isCompleted || !input.noWinners) return null;' `
    -Replace 'if (!input.noWinners) return null;'

# 11. The notice fires on a contest that DID pay winners.
Invoke-Probe -Name "no-winners notice ignores whether anybody was paid" `
    -ExpectTest "stays silent unless the contest is completed AND paid nobody" `
    -Find 'if (!input.isCompleted || !input.noWinners) return null;' `
    -Replace 'if (!input.isCompleted) return null;'

# 12. The empty-contest case collapsed into the general one.
Invoke-Probe -Name "an empty contest is described as nobody scoring" `
    -ExpectTest "distinguishes an empty contest from one nobody scored in" `
    -Find 'if (input.participantCount === 0) {' `
    -Replace 'if (false) {'

# 13. The prize caution names only redistribution, dropping R45's half.
Invoke-Probe -Name "prize caution drops the no-result half" `
    -ExpectTest "tells the reader the configured shares are a floor, not the payout" `
    -Find ', and a player who recorded no result holds no rank' `
    -Replace ''

Write-Host ""
Write-Host "Done. Every probe must have reported RED as expected." -ForegroundColor White
