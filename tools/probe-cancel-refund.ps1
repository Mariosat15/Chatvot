# Probes for R43 - the undersubscribed sweep that cancelled a competition and refunded nobody.
#
# Same harness as probe-admin-provider-dispatch.ps1 / probe-live-controls.ps1. Its lessons are
# already paid for and are not re-derived here: -LiteralPath and explicit UTF-8 without a BOM
# on the read AND the write; refuse to write when the read came back empty; confirm the file
# actually changed before believing any outcome; and judge by the summary counts of a single
# filtered test rather than by searching whole-suite output for a test's name, which vitest
# prints for a passing test as readily as a failing one.
#
# 1-2 tests red is the honest number for a one-line change. Five or more means the probe
# damaged the file rather than the behaviour.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/services/competition-cancel-refund.test.ts"
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

$ACTION = "lib/actions/trading/competition-cancel.actions.ts"
$CRON = "lib/inngest/functions.ts"
$ADMIN_CRON = "apps/admin/lib/inngest/functions.ts"

# ---------------------------------------------------------------------------------------
# 1. The defect itself, restored exactly: an already-cancelled competition is refused
#    outright, so the sweep's pre-cancel means nobody is refunded.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "R43 restored - already-cancelled competition refused instead of healed" `
    -File $ACTION `
    -From "      competition = existing;" `
    -To "      await session.abortTransaction();`r`n      return { success: true, refundedCount: 0, totalRefunded: 0 };" `
    -TestName "refunds every player even when the caller cancelled the competition first"

# ---------------------------------------------------------------------------------------
# 2. The idempotency key the R43 fix depends on. Without it the widened door pays every
#    player twice, which is live bug 5 reopened.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "ledger idempotency removed - second sweep double-refunds" `
    -File $ACTION `
    -From "      if (alreadyRefunded.has(userId)) {" `
    -To "      if (false) {" `
    -TestName "still refunds only once when a pre-cancelled competition is swept twice"

# ---------------------------------------------------------------------------------------
# 3 and 4. The root cause, in each copy of the sweep. This is the write that disarmed the
#    refund's own lock, and it is one line in a file where `status: "cancelled"` also
#    appears legitimately - which is why the guard slices around the refund call.
# ---------------------------------------------------------------------------------------
$preCancel = @'
          await Competition.findByIdAndUpdate(comp._id, {
            $set: {
              status: "cancelled",
              cancellationReason: `Did not meet minimum participants requirement`,
            },
          });

          try {
            const { cancelCompetitionAndRefund } =
'@

$results += Invoke-Probe `
    -Name "main cron pre-cancels again (root cause)" `
    -File $CRON `
    -From "          try {`r`n            const { cancelCompetitionAndRefund } =" `
    -To $preCancel `
    -TestName "refunds without writing a cancelled status"

$results += Invoke-Probe `
    -Name "admin cron pre-cancels again (root cause)" `
    -File $ADMIN_CRON `
    -From "          try {`r`n            const { cancelCompetitionAndRefund } =" `
    -To $preCancel `
    -TestName "refunds without writing a cancelled status"

# ---------------------------------------------------------------------------------------
# 5. The log that made the defect survivable. Reporting the requested count rather than the
#    achieved one is why a run that refunded nobody looked like a full payout.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "cron stops reading the returned refund count" `
    -File $CRON `
    -From "            const refund = await cancelCompetitionAndRefund(" `
    -To "            await cancelCompetitionAndRefund(" `
    -TestName "logs the refund count it was given"

Write-Host ""
Write-Host "==================== SUMMARY ====================" -ForegroundColor Cyan
$results | ForEach-Object { Write-Host ("{0,-62} {1}" -f $_.Name, $_.Outcome) }

$bad = @($results | Where-Object { $_.Outcome -notlike "RED*" })
Write-Host ""
if ($bad.Count -eq 0) {
    Write-Host "All $($results.Count) probes red on the expected test." -ForegroundColor Green
}
else {
    Write-Host "$($bad.Count) of $($results.Count) probes did not go red - investigate." -ForegroundColor Red
}
