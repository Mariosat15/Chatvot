# Probes for X9 slice 3 - provider outage pause/extend.
#
# Same harness lessons as probe-provider-kill-switch.ps1: -LiteralPath + UTF-8
# without BOM; refuse empty reads; confirm the file changed; judge by filtered -t counts.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/services/provider-outage-pause.test.ts"
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
    -Name "agenda.every provider-outage-pause" `
    -File "worker/index.ts" `
    -From 'await agenda.every("1 minute", "provider-outage-pause");' `
    -To '// PROBE: schedule removed' `
    -TestName "schedules the Agenda job every minute beside the kill-switch"

# 2. System-outage filter removed (would auto-resume manual pauses)
$results += Invoke-Probe `
    -Name "manual pause filter" `
    -File "lib/services/game-providers/provider-outage-pause.service.ts" `
    -From 'if (!isSystemOutagePause(contest)) {
      summary.skippedManualPause += 1;
      continue;
    }' `
    -To '/* PROBE: no system filter */' `
    -TestName "never auto-resumes a manual pause"

# 3. System marker renamed
$results += Invoke-Probe `
    -Name "system pausedBy marker" `
    -File "lib/services/games/contest-pause.service.ts" `
    -From 'export const SYSTEM_OUTAGE_PAUSED_BY = "system:provider-outage";' `
    -To 'export const SYSTEM_OUTAGE_PAUSED_BY = "system:other";' `
    -TestName "marks system pauses with the stable pausedBy string"

# 4. Inline playWindowEnd assignment (must stay in contest-pause only)
$results += Invoke-Probe `
    -Name "no inline extend math" `
    -File "lib/services/game-providers/provider-outage-pause.service.ts" `
    -From 'export async function runProviderOutagePause(
  now: Date = new Date(),
): Promise<OutagePauseSummary> {' `
    -To 'export async function runProviderOutagePause(
  now: Date = new Date(),
): Promise<OutagePauseSummary> {
  let playWindowEnd = now; playWindowEnd = now;' `
    -TestName "reuses contest-pause rather than reimplementing extend math"

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
