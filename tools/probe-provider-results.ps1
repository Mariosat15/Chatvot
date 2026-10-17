# Probes for the player-facing provider results screen (`13` s6.1a).
#
# Each probe reinstates one defect and expects ONE named test to go red. Naming the expected
# test is the point: a probe aimed at the wrong test is indistinguishable from a test that does
# not work.
#
# This harness probes TWO files, which is the addition over the previous ones - the screen and
# the route branch - so the target is a parameter rather than a script-level constant. The
# lesson that forced it: a probe run against the wrong suite reports "no test ran", which reads
# exactly like a broken harness rather than a missing guard.

$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $PSScriptRoot
$Screen = Join-Path $Root "components\games\ProviderResultsScreen.tsx"
# `[id]` is a wildcard character class to PowerShell, so every read and write of this path must
# be literal. The tell when it is not is the failure COUNT: the file is emptied, restored to
# nothing, and every probe goes red on the expected test for entirely the wrong reason.
$Page = Join-Path $Root "app\(root)\competitions\[id]\results\page.tsx"
$Suite = "__tests__/games/provider-results-screen.test.ts"

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

function To-Relaxed([string]$Literal) {
    return ([regex]::Escape($Literal) -replace "\\r\\n|\\n", "\r?\n")
}

function Invoke-Probe {
    param(
        [string]$Name,
        [string]$Target,
        [string]$ExpectTest,
        [string]$Find,
        [string]$Replace
    )

    Write-Host ""
    Write-Host "=== PROBE: $Name" -ForegroundColor Cyan
    Write-Host "    expects red: $ExpectTest"

    $original = Read-Source $Target
    $pattern = To-Relaxed $Find
    $patched = [regex]::Replace($original, $pattern, { param($m) $Replace }, 1)

    if ($patched -eq $original) {
        Write-Host "    PROBE DID NOT APPLY - pattern never matched. Result is meaningless." -ForegroundColor Red
        return
    }

    try {
        Write-Source $Target $patched

        $out = & npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String
        $flat = ($out -replace "\s+", " ")

        if ($flat -match "Tests\s+(\d+)\s+failed") {
            $failed = [int]$Matches[1]
            if ($failed -eq 1) {
                Write-Host "    RED as expected (1 failed)" -ForegroundColor Green
            }
            else {
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
        Write-Source $Target $original
        $restored = Read-Source $Target
        if ($restored -ne $original) {
            Write-Host "    !! RESTORE FAILED - fix $Target by hand before continuing." -ForegroundColor Red
        }
    }
}

Write-Host "Probing the player-facing provider results screen" -ForegroundColor White

# --- findCountedAttempt ------------------------------------------------------------------
# These probe the service, so the target is the service file.
$Service = Join-Path $Root "lib\services\games\contest-results.service.ts"

# 1. The direction ignored, so a time trial reports its slowest round as the best one.
Invoke-Probe -Name "best attempt ignores the score direction" -Target $Service `
    -ExpectTest "picks the LOWEST score when lower is better" `
    -Find 'const lowerIsBetter = scoreDirection === "lower_is_better";' `
    -Replace 'const lowerIsBetter = false;'

# 2. `sum_of_n` highlighting one round, which misrepresents how the total was reached.
Invoke-Probe -Name "sum_of_n marks a single round as counted" -Target $Service `
    -ExpectTest "marks nothing as counted under sum_of_n" `
    -Find 'if (policy === "sum_of_n") return null;' `
    -Replace ''

# 3. Truthiness instead of a finite check, which discards a genuine zero.
Invoke-Probe -Name "a genuine zero is treated as no score" -Target $Service `
    -ExpectTest "treats a genuine zero as a score, not as an absence" `
    -Find 'const scored = rounds.filter((r) => Number.isFinite(r.score));' `
    -Replace 'const scored = rounds.filter((r) => Boolean(r.score));'

# 4. NaN admitted, which the comparator then places arbitrarily.
Invoke-Probe -Name "NaN admitted as a real score" -Target $Service `
    -ExpectTest "ignores a NaN score rather than placing it arbitrarily" `
    -Find 'const scored = rounds.filter((r) => Number.isFinite(r.score));' `
    -Replace 'const scored = rounds.filter((r) => r.score !== undefined);'

# --- The screen --------------------------------------------------------------------------

# 5. R45's read side: an absent score printed as 0.
Invoke-Probe -Name "absent score renders as zero" -Target $Screen `
    -ExpectTest "renders an absent score as a dash and never as zero" `
    -Find 'return Number.isFinite(score) ? String(score) : "-";' `
    -Replace 'return String(score ?? 0);'

# 6. The screen recomputing a prize instead of reading the settled figure.
Invoke-Probe -Name "screen recomputes the prize from the pool" -Target $Screen `
    -ExpectTest "reads the prize from the settled leaderboard and computes no money of its own" `
    -Find 'const won = results.prizeAmount > 0;' `
    -Replace 'const won = results.prizeAmount > 0; const prizePool = 0;'

# 7. The refund explanation driven by the configured policy rather than the ledger row.
Invoke-Probe -Name "refund driven by the contest policy, not the ledger" -Target $Screen `
    -ExpectTest "explains a refund from the LEDGER row, never from the contest policy" `
    -Find '{refundedAmount !== undefined && (' `
    -Replace '{results.unscoredContestPolicy === "refund_entry_fees" && ('

# 8. The platform fee dropped from the explanation, so a short refund goes unexplained.
Invoke-Probe -Name "refund explanation omits the platform fee" -Target $Screen `
    -ExpectTest "names the platform fee in the refund explanation" `
    -Find 'Your entry fee has been returned less the platform fee.' `
    -Replace 'Your entry fee has been returned.'

# 9. "Best" labelled without reading the direction.
Invoke-Probe -Name "best round labelled without the direction" -Target $Screen `
    -ExpectTest "labels 'best' by the contest's own direction" `
    -Find 'const lowerIsBetter = results.scoreDirection === "lower_is_better";' `
    -Replace 'const lowerIsBetter = false;'

# 10. Raw camelCase keys printed to players again.
#
#     THIS PROBE FIRST REPORTED GREEN, and the cause was the test rather than the guard: it
#     asserted `toContain("humanizeMetric")`, which the IMPORT LINE satisfies on its own. The
#     assertion now matches the call with its arguments. Fourth time an import has defeated a
#     structural test here, after `canTransitionRound`, `MIN_REASON_LENGTH` and the Edit guard.
Invoke-Probe -Name "raw scoreBreakdown keys printed to players" -Target $Screen `
    -ExpectTest "humanizes the provider's score breakdown keys" `
    -Find 'const metric = humanizeMetric(key, value);' `
    -Replace 'const metric = { label: key, value: String(value) };'

# 11. A branch on the game code, which is how "no additional coding" quietly becomes false.
Invoke-Probe -Name "the screen branches on a specific game" -Target $Screen `
    -ExpectTest "enumerates no game code, key or provider anywhere" `
    -Find 'const won = results.prizeAmount > 0;' `
    -Replace 'const won = results.prizeAmount > 0; const isSprint = gameCode === "circuit-sprint";'

# --- The route branch --------------------------------------------------------------------

# 12. The defect exactly as it shipped: the branch redirects instead of rendering.
Invoke-Probe -Name "provider contest redirected away from its own results" -Target $Page `
    -ExpectTest "renders the provider screen rather than redirecting away from it" `
    -Find 'const [providerResults, refundedAmount, appSettings] = await Promise.all([' `
    -Replace 'redirect(`/competitions/${competitionId}`); const [providerResults, refundedAmount, appSettings] = await Promise.all(['

# 13. The branch placed AFTER the trading reads, which is what threw in the first place.
#     Probed by removing the branch's early return entirely.
Invoke-Probe -Name "the branch falls through to the trading post-mortem" -Target $Page `
    -ExpectTest "renders the provider screen rather than redirecting away from it" `
    -Find '  if (hasProviderGameLabel(competition)) {' `
    -Replace '  if (false) {'

# --- The seam the round-path guard forced -------------------------------------------------
$Refund = Join-Path $Root "lib\services\settlement\unscored-refund.ts"

# 14. The reason string duplicated back into a literal at the read site. This is the drift the
#     constant exists to prevent, and it is silent in the worst direction: refunds keep being
#     written correctly while the screen stops finding them.
Invoke-Probe -Name "the refund reason is spelled out twice" -Target $Refund `
    -ExpectTest "reads the refund reason from one constant, not two string literals" `
    -Find '"metadata.refundReason": UNSCORED_REFUND_REASON,' `
    -Replace '"metadata.refundReason": "no_score_recorded",'

# 15. The ledger read folded back into the results service, which is what invariant 6 caught.
Invoke-Probe -Name "the money read moves back into the round path" -Target (Join-Path $Root "lib\services\games\contest-results.service.ts") `
    -ExpectTest "takes the refund from a service outside the round path" `
    -Find 'import { resolveScoreDirection } from "./score-direction.service";' `
    -Replace 'import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { resolveScoreDirection } from "./score-direction.service";'

Write-Host ""
Write-Host "Done. Every probe must have reported RED as expected." -ForegroundColor White
