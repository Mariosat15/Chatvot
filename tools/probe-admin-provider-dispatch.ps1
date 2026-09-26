# Probes for R42 - the admin app's missing provider dispatch.
#
# Same harness as probe-live-controls.ps1 / probe-admin-gm-parity.ps1. Its lessons are already
# paid for and are not re-derived here: -LiteralPath and explicit UTF-8 without a BOM on the
# read AND the write; refuse to write when the read came back empty; confirm the file actually
# changed before believing any outcome; and judge by the summary counts of a single filtered
# test rather than by searching whole-suite output for a test's name, which vitest prints for
# a passing test as readily as a failing one.
#
# 1-2 tests red is the honest number for a one-line change. Five or more means the probe
# damaged the file rather than the behaviour.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/services/admin-finalize-gamemaster-parity.test.ts"
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

$ADMIN = "apps/admin/lib/actions/trading/competition-end.actions.ts"

# ---------------------------------------------------------------------------------------
# 1. The defect itself, restored exactly: no provider dispatch at all, so the trading gate
#    below refuses the contest and it never settles.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "R42 restored - admin finalize has no provider dispatch" `
    -File $ADMIN `
    -From @'
    if (route.path === "provider") {
      const { finalizeProviderCompetition } = await import(
        "@/lib/services/settlement/provider-finalize"
      );
      return await finalizeProviderCompetition(competitionId);
    }
'@ `
    -To @'
'@ `
    -TestName "settles a provider contest instead of refusing it"

# ---------------------------------------------------------------------------------------
# 2. The money half. Aimed at the SECOND test deliberately: a dispatch that reaches the
#    provider path and then pays nothing leaves the contest `completed`, so the status
#    assertion in probe 1 cannot see it.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Dispatch returns success without settling - status right, nobody paid" `
    -File $ADMIN `
    -From @'
      return await finalizeProviderCompetition(competitionId);
'@ `
    -To @'
      await Competition.updateOne(
        { _id: competitionId },
        { $set: { status: "completed" } },
      );
      return { success: true };
'@ `
    -TestName "pays the provider contest's winner"

# ---------------------------------------------------------------------------------------
# 3. Fail-closed, and it takes BOTH gates removed to reach it.
#
#    The first two attempts at this probe removed only the pre-session `none` branch and
#    came back green, which is not a weak test - it is the honest answer. The second gate
#    inside the transaction asks the narrower question and refuses `chess` as well, and an
#    aborted transaction writes exactly as little as never opening one, so the two are
#    indistinguishable from the database. That also sinks a probe that moved the refusal
#    past the lock: this app takes no optimistic lock, so there is no `finalizing` state
#    to strand a contest in and nothing observable to assert.
#
#    Recorded rather than contrived, because the reachable claim is the one worth pinning:
#    with neither gate present, a chess contest is settled as trading.
#
#    Note both earlier attempts ALSO failed to apply, for a separate and already-recorded
#    reason - the pattern carried a `❌`, and a non-ASCII anchor does not survive the shell.
#    Two failure causes at once is exactly the situation the "confirm the file changed"
#    check exists for: without it this would have read as a weak test.
# ---------------------------------------------------------------------------------------
#    Both gates go in ONE edit, by stubbing the shared import. Neutering either branch on
#    its own comes back green, because the other refuses `chess` too - which is why the
#    first two versions of this probe were misread as weak tests.
$results += Invoke-Probe `
    -Name "Both game gates removed - a chess contest is settled as trading" `
    -File $ADMIN `
    -From @'
import {
  resolveSettlementPath,
  routeToTradingSettlement,
} from "@/lib/games/settlement";
'@ `
    -To @'
import {
  resolveSettlementPath as _rsp,
  routeToTradingSettlement as _rtts,
} from "@/lib/games/settlement";
const resolveSettlementPath = (..._a: unknown[]) =>
  ({ path: "trading" }) as ReturnType<typeof _rsp>;
const routeToTradingSettlement = (..._a: unknown[]) =>
  ({ ok: true }) as ReturnType<typeof _rtts>;
'@ `
    -TestName "still refuses a game neither app can settle"

# ---------------------------------------------------------------------------------------
# 4. The dispatch must be reached for provider contests ONLY.
#
#    Re-aimed once. Sending trading contests down the provider path too was first probed
#    against the Game Master test, which stayed green - and for an instructive reason: the
#    provider path calls the same shared `settleFeesAndGameMasters` stage, so the referrer
#    is still paid correctly. What differs is everything about the trades, so the test that
#    sees it is the whole-snapshot parity one, where the main app still uses trading.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Trading contests sent down the provider path as well" `
    -File $ADMIN `
    -From @'
    if (route.path === "provider") {
'@ `
    -To @'
    if (route.path === "provider" || route.path === "trading") {
'@ `
    -TestName "produces byte-for-byte the same money as the main app"

# ---------------------------------------------------------------------------------------
# NOT PROBED, DELIBERATELY, AND RECORDED RATHER THAN LEFT AS A GREEN PROBE.
#
# The in-transaction gate cannot be probed on its own in this app. Neutering it leaves the
# pre-session gate refusing `chess` first, so the suite stays green - and unlike the main
# app there is no `updatedAt` difference to fall back on either, because this path takes no
# optimistic lock and therefore has no `finalizing` state to strand a contest in. An
# aborted transaction and a never-opened one are indistinguishable from the database.
#
# Its actual value is a case this suite cannot construct: a label that CHANGES between the
# pre-session read and the transaction. Saying so is better than a fifth probe that reports
# green and teaches the reader that the gate is decoration.
# ---------------------------------------------------------------------------------------

Write-Host ""
Write-Host "================ SUMMARY ================" -ForegroundColor Cyan
$results | Format-Table -AutoSize
$bad = @($results | Where-Object { $_.Outcome -notlike "RED*" })
if ($bad.Count -gt 0) {
    Write-Host "$($bad.Count) probe(s) did NOT come back red - read each one." -ForegroundColor Red
}
else {
    Write-Host "All $($results.Count) probes red on the expected test." -ForegroundColor Green
}
