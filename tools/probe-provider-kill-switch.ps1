# Probes for X9 slice 2 - automatic provider kill switch.
#
# Same harness lessons as probe-round-reconciliation.ps1: -LiteralPath + UTF-8
# without BOM; refuse empty reads; confirm the file changed; judge by filtered -t counts.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/services/provider-kill-switch.test.ts"
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
    -Name "agenda.every provider-kill-switch" `
    -File "worker/index.ts" `
    -From 'await agenda.every("1 minute", "provider-kill-switch");' `
    -To '// PROBE: schedule removed' `
    -TestName "defines and schedules the job every minute"

# 2. Idle evidence treated as fail (would kill quiet providers)
$results += Invoke-Probe `
    -Name "no_evidence must not kill" `
    -File "lib/services/game-providers/provider-kill-switch.service.ts" `
    -From 'if (finished === 0 && input.completed === 0) {
    return "no_evidence";
  }' `
    -To 'if (finished === 0 && input.completed === 0) {
    return "fail";
  }' `
    -TestName "treats no finished rounds as no_evidence"

# 3. 15-minute gate deleted (would disable immediately when down)
$results += Invoke-Probe `
    -Name "15-minute gate" `
    -File "lib/services/game-providers/provider-kill-switch.service.ts" `
    -From 'now.getTime() - next.healthDownSince.getTime() >= KILL_SWITCH_DOWN_MS' `
    -To 'true /* PROBE: no 15m wait */' `
    -TestName "does not disable when down for under 15 minutes"

# 4. Alert type removed from schema enum array
$results += Invoke-Probe `
    -Name "provider_kill_switch enum" `
    -File "database/models/security-alert.model.ts" `
    -From '"provider_kill_switch",
        "other",' `
    -To '"other",' `
    -TestName "SecurityAlert schema enum includes provider_kill_switch"

# 5. Claim filter drops enabled:true
$results += Invoke-Probe `
    -Name "enabled claim on disable" `
    -File "lib/services/game-providers/provider-kill-switch.service.ts" `
    -From '{ providerKey, enabled: true }' `
    -To '{ providerKey }' `
    -TestName "disable claims with enabled true so a retry cannot double-alert"

Write-Host ""
Write-Host "===== SUMMARY =====" -ForegroundColor Cyan
$results | ForEach-Object { Write-Host ("{0}: {1}" -f $_.Name, $_.Outcome) }
$bad = @($results | Where-Object { $_.Outcome -ne "RED x1" })
if ($bad.Count -gt 0) {
    Write-Host "FAIL: $($bad.Count) probe(s) not RED x1" -ForegroundColor Red
    exit 1
}
Write-Host "OK: all $($results.Count) probes RED x1" -ForegroundColor Green
