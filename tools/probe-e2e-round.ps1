# Probes for __tests__/games/end-to-end-round.test.ts
#
# The suite takes ~75 seconds, so there are three probes rather than a dozen, chosen to cover the
# three seams that have each already produced a live defect in this programme:
#
#   1. the OUTBOUND signature   - the platform's half of the protocol (R34's neighbourhood)
#   2. gate 11b                 - the score seam (R32: it did not exist for a day)
#   3. the ranking DIRECTION    - the read of it (R33: settlement read a field nothing wrote)
#
# Each probe injects one defect, runs the ONE test that should notice, and restores the file.
# Lessons already paid for and applied here: read and write with -LiteralPath and explicit UTF-8
# without a BOM (PowerShell 5.1 otherwise mangles emoji through the ANSI codepage and the "restore"
# writes the mangled text back); refuse to write if the read came back empty; confirm the file
# actually changed before believing any outcome; and judge by the summary counts of a single
# filtered test rather than by searching whole-suite output for a test's name, which vitest prints
# for a passing test as readily as a failing one.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/games/end-to-end-round.test.ts"
$results = @()

function Invoke-Probe {
    param(
        [string]$Name,
        [string]$File,
        [string]$From,
        [string]$To,
        [string]$TestName
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

    # A probe that failed to apply is indistinguishable from a test that does not work.
    $onDisk = [System.IO.File]::ReadAllText($path, $enc)
    if ($onDisk -eq $original) {
        Write-Host "  HARNESS BROKEN: file unchanged after write" -ForegroundColor Magenta
        return [pscustomobject]@{ Name = $Name; Outcome = "HARNESS BROKEN" }
    }

    try {
        $raw = & npx vitest run $suite -t $TestName 2>&1 | Out-String
        $out = $raw -replace '\s+', ' '
    }
    finally {
        [System.IO.File]::WriteAllText($path, $original, $enc)
    }

    if ($out -match 'No test files found' -or $out -match 'Tests\s+no tests') {
        $outcome = "PROBE BROKEN (no test ran)"
        Write-Host "  $outcome" -ForegroundColor Magenta
    }
    elseif ($out -match 'Tests\s+(\d+)\s+failed') {
        $outcome = "RED ($($Matches[1]) failed)"
        Write-Host "  $outcome" -ForegroundColor Green
    }
    elseif ($out -match 'Tests\s+\d+\s+passed') {
        $outcome = "GREEN - guard useless"
        Write-Host "  $outcome" -ForegroundColor Red
    }
    else {
        $outcome = "PROBE BROKEN (unreadable summary)"
        Write-Host "  $outcome" -ForegroundColor Magenta
    }

    return [pscustomobject]@{ Name = $Name; Outcome = $outcome }
}

# 1. The platform signs outbound calls with the wrong scheme. The service's inbound guard accepts
#    `sha256={hex}` or bare hex, so this must be a genuinely different digest rather than a
#    reformatting - hence signing a constant.
$results += Invoke-Probe `
    -Name "outbound signature is wrong -> the catalogue cannot be synced" `
    -File "lib/services/game-providers/adapters/chartvolt-games/transport.ts" `
    -From '"X-Signature": `sha256=${signature}`,' `
    -To '"X-Signature": `sha256=${"0".repeat(64)}`,' `
    -TestName "syncs the catalogue the service actually published"

# 2. R32 exactly: a scored round that never reaches the participant. Latent for a day, and it
#    would have paid every provider player the same.
$results += Invoke-Probe `
    -Name "gate 11b removed -> the score never reaches the participant" `
    -File "lib/services/games/result-ingestion.service.ts" `
    -From "const scoreSync = await syncParticipantScore({" `
    -To "const scoreSync = { synced: false, reason: 'probe' } as never; await Promise.resolve({" `
    -TestName "launches, plays and scores a round, end to end"

# 3. R33 exactly: settlement ranks without the catalogue's direction. Pays the SLOWEST player
#    first on a lower-is-better title, and nothing else in the suite would notice.
$results += Invoke-Probe `
    -Name "settlement ignores score direction -> the slow player is paid more" `
    -File "lib/services/settlement/provider-settlement.service.ts" `
    -From "const direction = await resolveScoreDirection(competition.gameKey, session);" `
    -To 'const direction = "higher_is_better" as never;' `
    -TestName "ranks a lower-is-better title by the faster player"

Write-Host ""
Write-Host "==================== SUMMARY ====================" -ForegroundColor Cyan
foreach ($r in $results) { Write-Host ("  {0,-28} {1}" -f $r.Outcome, $r.Name) }
$bad = @($results | Where-Object { $_.Outcome -notlike "RED*" })
if ($bad.Count -gt 0) {
    Write-Host ""
    Write-Host "$($bad.Count) probe(s) did not go red as expected." -ForegroundColor Red
    exit 1
}
Write-Host ""
Write-Host "All probes red on the expected test." -ForegroundColor Green
