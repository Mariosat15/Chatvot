# Probes for the malformed-competition-id guard and the "absent is not an error" contract.
#
# Same harness as probe-admin-provider-dispatch.ps1. Its lessons are already paid for and are
# not re-derived here: -LiteralPath and explicit UTF-8 without a BOM on the read AND the write;
# refuse to write when the read came back empty; confirm the file actually changed before
# believing any outcome; and judge by the summary counts of a single filtered test rather than
# by searching whole-suite output for a test's name, which vitest prints for a passing test as
# readily as a failing one.
#
# 1-2 tests red is the honest number for a one-line change. Five or more means the probe
# damaged the file rather than the behaviour.
#
# NOTE ON -LiteralPath, WHICH THIS FILE SET NEEDS MORE THAN MOST: every path here contains
# `[id]`, which PowerShell parses as a wildcard character class. A `Get-Content $File` returns
# $null for these while `Set-Content` writes happily, which once emptied a route and reported
# every probe red on the expected test for entirely the wrong reason.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/services/competition-id-guard.test.ts"
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

# NOTE ON `$RESULTS_PAGE`, WHICH COST A FALSE HARNESS FAILURE: it was `$RESULTS` first, and
# PowerShell variable names are CASE-INSENSITIVE - so it silently aliased the `$results`
# accumulator above. The symptom was a "read as empty" failure on an unrelated file and a
# garbled summary table, both of which read as the probe damaging a route.
$HELPER = "lib/utils/competition-id.ts"
$ADMIN_HELPER = "apps/admin/lib/utils/competition-id.ts"
$ACTIONS = "lib/actions/trading/competition.actions.ts"
$ADMIN_ACTIONS = "apps/admin/lib/actions/trading/competition.actions.ts"
$LOBBY = "app/(root)/competitions/[id]/page.tsx"
$RESULTS_PAGE = "app/(root)/competitions/[id]/results/page.tsx"
$STATUS = "app/api/competitions/[id]/status/route.ts"
$ADMIN_VIEW = "apps/admin/app/competitions/view/[id]/page.tsx"

# `-t` is a REGEX, and every route's test title contains `[id]`, which is a character class.
# So the aimed patterns below spell it `.id.` rather than pasting the title.

# ---------------------------------------------------------------------------------------
# 1. The reported defect itself, restored: the read throws for a malformed id again.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Malformed id throws again (the logged defect)" `
    -File $ACTIONS `
    -From @'
    if (!isCompetitionIdShaped(competitionId)) {
      return null;
    }
'@ `
    -To @'
    if (!isCompetitionIdShaped(competitionId)) {
      throw new Error("Invalid competition ID format");
    }
'@ `
    -TestName "returns null for a malformed id instead of throwing"

# ---------------------------------------------------------------------------------------
# 2. The half nobody had noticed: a MISSING contest threw too, which is what made every
#    caller's `if (!competition)` dead code.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Missing contest throws again - every caller's null check goes dead" `
    -File $ACTIONS `
    -From @'
    let competition = (await Competition.findById(competitionId).lean()) as any;

    if (!competition) {
      return null;
    }
'@ `
    -To @'
    let competition = (await Competition.findById(competitionId).lean()) as any;

    if (!competition) {
      throw new Error("Competition not found");
    }
'@ `
    -TestName "returns null for a well-formed id that is not there"

# ---------------------------------------------------------------------------------------
# 3. A guard that refuses everything passes every refusal test. Aimed at the one test that
#    can see it.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Guard refuses everything, including real ids" `
    -File $HELPER `
    -From @'
  return typeof id === "string" && COMPETITION_ID_SHAPE.test(id);
'@ `
    -To @'
  return false && typeof id === "string" && COMPETITION_ID_SHAPE.test(id);
'@ `
    -TestName "still returns the contest when it exists"

# ---------------------------------------------------------------------------------------
# 4. The shape widened - the failure a future bson bump would cause silently.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Shape widened past hex, following a dependency instead of deciding" `
    -File $HELPER `
    -From 'const COMPETITION_ID_SHAPE = /^[0-9a-f]{24}$/i;' `
    -To 'const COMPETITION_ID_SHAPE = /^[0-9a-z]{24}$/i;' `
    -TestName "agrees with ObjectId.isValid today"

# ---------------------------------------------------------------------------------------
# 5. Total on a non-string. A guard that throws on the input it exists to refuse is worse
#    than no guard, and `.test` on a number would coerce rather than refuse.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Guard drops its typeof check and coerces a non-string" `
    -File $HELPER `
    -From @'
  return typeof id === "string" && COMPETITION_ID_SHAPE.test(id);
'@ `
    -To @'
  return id != null && COMPETITION_ID_SHAPE.test(id as string);
'@ `
    -TestName "refuses a non-string without throwing"

# ---------------------------------------------------------------------------------------
# 6. The leaderboard's half of the same contract. Its own test, because the lobby fetches
#    both reads in one Promise.all and either one throwing takes the whole page down.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Leaderboard throws for a missing contest again" `
    -File $ACTIONS `
    -From @'
    } | null;
    if (!competition) {
      return [];
    }
'@ `
    -To @'
    } | null;
    if (!competition) {
      throw new Error("Competition not found");
    }
'@ `
    -TestName "returns an empty leaderboard for both kinds of absence"

# ---------------------------------------------------------------------------------------
# 7-8. The positional structural tests. A guard AFTER the read is the mistake that looks
#      most correct on review, so it is probed by MOVING the guard rather than deleting it -
#      a test that merely mentions the helper is green on a move.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Lobby guards AFTER the reads instead of before" `
    -File $LOBBY `
    -From @'
  if (!isCompetitionIdShaped(id)) {
    logMalformedCompetitionId("/competitions/[id]", id);
    notFound();
  }
'@ `
    -To @'
'@ `
    -TestName "competitions/.id./page.tsx guards before its first read"

$results += Invoke-Probe `
    -Name "Results page reads first, then validates" `
    -File $RESULTS_PAGE `
    -From @'
  if (!isCompetitionIdShaped(competitionId)) {
    logMalformedCompetitionId("/competitions/[id]/results", competitionId);
    notFound();
  }

'@ `
    -To @'
'@ `
    -TestName "results/page.tsx guards before its first read"

# ---------------------------------------------------------------------------------------
# 9. The polled route. A page left open on a bad id wrote a stack trace every few seconds.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Polled status route drops its guard" `
    -File $STATUS `
    -From @'
    if (!isCompetitionIdShaped(id)) {
      logMalformedCompetitionId("GET /api/competitions/[id]/status", id);
'@ `
    -To @'
    if (false) {
      logMalformedCompetitionId("GET /api/competitions/[id]/status", id);
'@ `
    -TestName "status/route.ts guards before its first read"

# ---------------------------------------------------------------------------------------
# 10. The attribution. A silent refusal makes a bad link inside the application
#     indistinguishable from a crawler, which is the whole reason the log line exists.
#
#     ANCHORED ON THE SIGNATURE, NOT ON THE MESSAGE. The first version pasted the
#     `console.warn` body, which carries a `⚠️` and an em dash - and a non-ASCII anchor does
#     not survive the shell, so it reported DID NOT APPLY. That is indistinguishable at a
#     glance from a missing guard, and it is the second time this exact trap has been paid for.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Refusal stops naming the route and the value" `
    -File $HELPER `
    -From 'export function logMalformedCompetitionId(route: string, id: unknown): void {' `
    -To @'
export function logMalformedCompetitionId(route: string, id: unknown): void {
  void route;
  void id;
  return;
'@ `
    -TestName "names the route and the value"

# ---------------------------------------------------------------------------------------
# 11. Next's own control flow swallowed by the catch. This is the noise arriving by a
#     second route: `notFound()` inside the try, logged as a failure and then re-issued.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Lobby catch narrows back to NEXT_REDIRECT only" `
    -File $LOBBY `
    -From 'if (typeof digest === "string" && digest.startsWith("NEXT_")) throw error;' `
    -To 'if (digest?.startsWith("NEXT_REDIRECT")) throw error;' `
    -TestName "competitions/.id./page.tsx re-throws the whole NEXT_ family"

$results += Invoke-Probe `
    -Name "Admin view catch narrows back to NEXT_REDIRECT only" `
    -File $ADMIN_VIEW `
    -From 'if (typeof digest === "string" && digest.startsWith("NEXT_")) throw error;' `
    -To 'if (digest?.startsWith("NEXT_REDIRECT")) throw error;' `
    -TestName "view/.id./page.tsx re-throws the whole NEXT_ family"

# ---------------------------------------------------------------------------------------
# 12. The mirror. `check:mirrors` compares MODELS, so a text comparison is the only guard,
#     and the drift it prevents is specific: one app 404s a URL the other renders, which
#     reads as a caching problem rather than as two different rules.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Admin copy of the shape helper drifts" `
    -File $ADMIN_HELPER `
    -From 'const COMPETITION_ID_SHAPE = /^[0-9a-f]{24}$/i;' `
    -To 'const COMPETITION_ID_SHAPE = /^[0-9a-f]{12,24}$/i;' `
    -TestName "byte-for-byte identical"

# ---------------------------------------------------------------------------------------
# 13. The admin action's half of the contract, which is a separate file from the main app's.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "Admin action throws for a missing contest again" `
    -File $ADMIN_ACTIONS `
    -From @'
    if (!competition) {
      return null;
    }
'@ `
    -To @'
    if (!competition) {
      throw new Error("Competition not found");
    }
'@ `
    -TestName "no longer throws for a malformed or missing contest"

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
