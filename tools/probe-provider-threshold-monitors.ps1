# Probes for X9 slice 4 - chapter 06 s10 threshold monitors.
#
# Same harness as probe-provider-kill-switch.ps1.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/services/provider-threshold-monitors.test.ts"
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

$results += Invoke-Probe `
    -Name "agenda.every provider-threshold-monitors" `
    -File "worker/index.ts" `
    -From 'await agenda.every("1 minute", "provider-threshold-monitors");' `
    -To '// PROBE: schedule removed' `
    -TestName "schedules the Agenda job every minute"

$results += Invoke-Probe `
    -Name "latencyMs forwarded from adapter" `
    -File "lib/services/game-providers/adapters/chartvolt-games.adapter.ts" `
    -From 'return { success: true, data: created, latencyMs: response.latencyMs };' `
    -To 'return { success: true, data: created };' `
    -TestName "forwards createRound latencyMs from the ChartVolt adapter"

$results += Invoke-Probe `
    -Name "ingest alerts removed from result-ingestion" `
    -File "lib/services/games/result-ingestion.service.ts" `
    -From 'voidIngestSecurityAlerts({' `
    -To '/* PROBE */ void ({' `
    -TestName "ingestion raises SecurityAlerts rather than leaving them to a poller"

$results += Invoke-Probe `
    -Name "stuck finalizing status filter dropped" `
    -File "lib/services/game-providers/provider-threshold-monitors.service.ts" `
    -From 'status: "finalizing",
      updatedAt: { $lt: cutoff },' `
    -To 'status: "completed",
      updatedAt: { $lt: cutoff },' `
    -TestName "alerts when a competition is stuck finalizing beyond 10 minutes"

$results += Invoke-Probe `
    -Name "signature alert type removed from enum" `
    -File "database/models/security-alert.model.ts" `
    -From '"provider_signature_invalid",
        "contest_stuck_finalizing",' `
    -To '"contest_stuck_finalizing",' `
    -TestName "SecurityAlert schema enum includes every 06 s10 type"

Write-Host ""
Write-Host "===== SUMMARY =====" -ForegroundColor Cyan
$results | ForEach-Object { Write-Host ("{0}: {1}" -f $_.Name, $_.Outcome) }
$bad = @($results | Where-Object { $_.Outcome -ne "RED x1" })
if ($bad.Count -gt 0) {
    Write-Host "PROBES FAILED: $($bad.Count)" -ForegroundColor Red
    exit 1
}
Write-Host "All probes RED x1" -ForegroundColor Green
exit 0
