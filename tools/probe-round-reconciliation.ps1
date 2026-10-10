# Probes for X9 slice 1 - scheduled round reconciliation.
#
# Same harness lessons as probe-admin-provider-dispatch.ps1: -LiteralPath + UTF-8
# without BOM; refuse empty reads; confirm the file changed; judge by filtered -t counts.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/services/run-round-reconciliation.test.ts"
$results = @()

function Invoke-Probe {
    param(
        [string]$Name,
        [string]$File,
        [string]$From,
        [string]$To,
        [string]$TestName,
        [string]$Suite = $suite
    )

    Write-Host ""
    Write-Host "PROBE: $Name" -ForegroundColor Cyan

    $path = (Resolve-Path -LiteralPath $File).Path
    $original = [System.IO.File]::ReadAllText($path, $enc)

    if ([string]::IsNullOrEmpty($original)) {
        Write-Host "  HARNESS BROKEN: read $File as empty - refusing to write" -ForegroundColor Magenta
        return [pscustomobject]@{ Name = $Name; Outcome = "HARNESS BROKEN" }
    }
    if (-not $original.Contains($From)) {
        Write-Host "  DID NOT APPLY: pattern absent from $File" -ForegroundColor Yellow
        return [pscustomobject]@{ Name = $Name; Outcome = "DID NOT APPLY" }
    }

    $mutated = $original.Replace($From, $To)
    [System.IO.File]::WriteAllText($path, $mutated, $enc)

    $onDisk = [System.IO.File]::ReadAllText($path, $enc)
    if ($onDisk -eq $original) {
        Write-Host "  HARNESS BROKEN: file unchanged after write" -ForegroundColor Magenta
        return [pscustomobject]@{ Name = $Name; Outcome = "HARNESS BROKEN" }
    }

    try {
        $raw = & npx vitest run $Suite -t $TestName 2>&1 | Out-String
        $out = $raw -replace '\s+', ' '
    }
    finally {
        [System.IO.File]::WriteAllText($path, $original, $enc)
    }

    if ($out -match 'No test files found' -or $out -match 'Tests\s+no tests') {
        Write-Host "  NO TEST RAN" -ForegroundColor Magenta
        return [pscustomobject]@{ Name = $Name; Outcome = "NO TEST RAN" }
    }

    $failed = 0
    if ($out -match 'Tests\s+(\d+)\s+failed') { $failed = [int]$Matches[1] }
    elseif ($out -match '(\d+)\s+failed') { $failed = [int]$Matches[1] }

    if ($failed -eq 1) {
        Write-Host "  RED x1 (expected)" -ForegroundColor Green
        return [pscustomobject]@{ Name = $Name; Outcome = "RED x1" }
    }

    Write-Host "  UNEXPECTED: failed=$failed" -ForegroundColor Red
    Write-Host "  $out"
    return [pscustomobject]@{ Name = $Name; Outcome = "UNEXPECTED failed=$failed" }
}

# 1. Agenda schedule removed
$results += Invoke-Probe `
    -Name "agenda.every round-reconciliation" `
    -File "worker/index.ts" `
    -From 'await agenda.every("1 minute", "round-reconciliation");' `
    -To '// PROBE: schedule removed' `
    -TestName "defines and schedules the job every minute"

# 2. Stage-4 alert side effect skipped
$results += Invoke-Probe `
    -Name "stage 4 alert side effect" `
    -File "lib/services/games/run-round-reconciliation.ts" `
    -From "if (outcome.alert) {`r`n        await fireAlert(round, outcome);`r`n        summary.alerts++;`r`n      }" `
    -To "if (false && outcome.alert) {`r`n        await fireAlert(round, outcome);`r`n        summary.alerts++;`r`n      }" `
    -TestName "marks unresolved, records a critical alert, and notifies the player"

# Retry probe 2 with LF-only if CRLF did not apply
if ($results[-1].Outcome -eq "DID NOT APPLY") {
    $results[-1] = Invoke-Probe `
        -Name "stage 4 alert side effect (LF)" `
        -File "lib/services/games/run-round-reconciliation.ts" `
        -From "if (outcome.alert) {`n        await fireAlert(round, outcome);`n        summary.alerts++;`n      }" `
        -To "if (false && outcome.alert) {`n        await fireAlert(round, outcome);`n        summary.alerts++;`n      }" `
        -TestName "marks unresolved, records a critical alert, and notifies the player"
}

# 3. Challenge hard-coded score_zero flipped to exclude (wrong policy for challenges)
$results += Invoke-Probe `
    -Name "challenge score_zero config" `
    -File "lib/services/games/run-round-reconciliation.ts" `
    -From 'unresolvedRoundPolicy: "score_zero",' `
    -To 'unresolvedRoundPolicy: "exclude",' `
    -TestName "uses score_zero and the derived challenge window"

# 4. Practice skip removed
$results += Invoke-Probe `
    -Name "practice round skip" `
    -File "lib/services/games/run-round-reconciliation.ts" `
    -From 'if (round.contestType === "practice") {' `
    -To 'if (false && round.contestType === "practice") {' `
    -TestName "does not reconcile a practice round even when expired"

# 5. Orphan void restored to skip-and-spam (the live production failure mode)
$results += Invoke-Probe `
    -Name "orphan contest voids once" `
    -File "lib/services/games/run-round-reconciliation.ts" `
    -From 'if (config.orphan) {' `
    -To 'if (false && config.orphan) {' `
    -TestName "voids a live round whose challenge is gone and does not re-alert on the next pass"

Write-Host ""
Write-Host "======== SUMMARY ========" -ForegroundColor Cyan
foreach ($r in $results) {
    Write-Host ("{0}: {1}" -f $r.Name, $r.Outcome)
}
$bad = @($results | Where-Object { $_.Outcome -ne "RED x1" })
if ($bad.Count -gt 0) {
    Write-Host "FAIL: $($bad.Count) probe(s) not RED x1" -ForegroundColor Red
    exit 1
}
Write-Host "OK: all probes RED x1" -ForegroundColor Green
exit 0
