# Probes for the no-score refund policy (owner decision, 7 September 2026, question 17).
#
# Each probe reinstates one defect and expects ONE named test to go red. The harness rules are
# carried verbatim from `probe-admin-contest-view.ps1`, where each of them had already produced
# a false result at least once: `-LiteralPath`/ReadAllText on the read as well as the write,
# refuse to write empty content, UTF-8 without BOM both ways, assert the file actually changed,
# and judge by the summary counts of a single `-t` run rather than by searching whole-suite
# output for a test name.

$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $PSScriptRoot
$Module = Join-Path $Root "lib\services\settlement\unscored-refund.ts"
$Suite = "__tests__/services/unscored-contest-refund.test.ts"

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
        $flat = ($out -replace "\s+", " ")

        if ($flat -match "Tests\s+(\d+)\s+failed") {
            $failed = [int]$Matches[1]
            if ($failed -eq 1) {
                Write-Host "    RED as expected (1 failed)" -ForegroundColor Green
            }
            else {
                Write-Host "    RED but $failed tests failed - expected exactly 1. Suspect collateral damage." -ForegroundColor Yellow
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

Write-Host "Probing the no-score refund eligibility rule" -ForegroundColor White

# 1. THE EXPENSIVE DEFECT. `some` instead of `every` refunds a contest that had a real winner,
#    on top of paying the prizes - the pool goes out twice.
Invoke-Probe -Name "one scorer is enough to trigger a refund (some instead of every)" `
    -ExpectTest "says no when even ONE player scored" `
    -Find 'return participants.every((p) => !gameModule.hasResult(p));' `
    -Replace 'return participants.some((p) => !gameModule.hasResult(p));'

# 2. Truthiness instead of the module's own eligibility rule. A genuine zero becomes "no
#    result", so a contest everybody scored 0 in gets refunded rather than paid out.
Invoke-Probe -Name "a real zero score counts as no result" `
    -ExpectTest "counts a genuine ZERO score as a score" `
    -Find 'return participants.every((p) => !gameModule.hasResult(p));' `
    -Replace 'return participants.every((p) => !p.score);'

# 3. The empty-contest guard. `every` over an empty array is true, so removing this line makes
#    a contest with no participants report as refundable.
Invoke-Probe -Name "empty contest reported as unscored" `
    -ExpectTest "says no for a contest with no participants at all" `
    -Find 'if (participants.length === 0) return false;' `
    -Replace '// probe: guard removed'

# 4. Fail-closed on an unknown module. Defaulting to trading would mean NO contest is ever
#    refundable; answering true would mean every one is. This probe takes the second.
Invoke-Probe -Name "unknown game type answers true instead of failing closed" `
    -ExpectTest "refuses to refund when handed a gameKEY instead of a gameTYPE" `
    -Find '  if (!gameModule) {' `
    -Replace '  if (false) {'

# 5. The trading exemption, which is the whole reason there is no game-type branch. Hardcoding
#    the provider module makes a trading contest refundable.
Invoke-Probe -Name "trading contest becomes refundable" `
    -ExpectTest "NEVER fires for a trading contest" `
    -Find 'const gameModule = getGameModuleOrTrading(gameType);' `
    -Replace 'const gameModule = getGameModuleOrTrading("provider");'

Write-Host ""
Write-Host "Done. Five probes; every one should read RED with exactly 1 failure." -ForegroundColor White
