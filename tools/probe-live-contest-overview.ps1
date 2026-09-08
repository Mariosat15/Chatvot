# Probes for the admin overview's live-competition figures -
# `__tests__/admin/live-contest-overview.test.ts`.
#
# Same harness as probe-ai-route-guards.ps1; its lessons are already paid for and not re-derived
# here: -LiteralPath and explicit UTF-8 without a BOM on the read AND the write; refuse to write
# when the read came back empty; confirm the file actually changed; name the expected failing
# test and judge by the summary counts of that single filtered test.
#
# 1-2 tests red is the honest number for a one-line change. More than that usually means the
# harness mangled the file rather than that the guard is broad.
#
# WHAT IS BEING PROBED, and why it is mostly behavioural. This slice is additive - the overview
# counted no contests at all before it - so there is no prior defect to reintroduce. What the
# probes attack instead are the four ways a plausible-looking implementation is silently wrong:
# counting drafts, grouping seats by their own game label, losing every seat at the
# ObjectId/String boundary, and hiding the price feed while trading contests are still running.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/admin/live-contest-overview.test.ts"
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

    # Line endings are mixed across this repository, so a literal multi-line pattern matches one
    # file and silently misses the next - indistinguishable from a test that does not work.
    $pattern = [regex]::Escape($From) -replace '\\r\\n|\\n', '\r?\n'
    if (-not [regex]::IsMatch($original, $pattern)) {
        Write-Host "  DID NOT APPLY: pattern absent from $File" -ForegroundColor Yellow
        return [pscustomobject]@{ Name = $Name; Outcome = "DID NOT APPLY" }
    }

    $mutated = [regex]::Replace($original, $pattern, { param($m) $To })
    [System.IO.File]::WriteAllText($path, $mutated, $enc)

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

    return Read-Outcome -Name $Name -Out $out
}

function Read-Outcome {
    param([string]$Name, [string]$Out)

    if ($Out -match 'No test files found' -or $Out -match 'Tests\s+no tests') {
        $outcome = "PROBE BROKEN (no test ran)"
        Write-Host "  $outcome" -ForegroundColor Magenta
    }
    elseif ($Out -match 'Tests\s+(\d+)\s+failed') {
        $outcome = "RED ($($Matches[1]) failed)"
        Write-Host "  $outcome" -ForegroundColor Green
    }
    elseif ($Out -match 'Tests\s+\d+\s+passed') {
        $outcome = "GREEN - guard useless"
        Write-Host "  $outcome" -ForegroundColor Red
    }
    else {
        $outcome = "PROBE BROKEN (unreadable summary)"
        Write-Host "  $outcome" -ForegroundColor Magenta
    }

    return [pscustomobject]@{ Name = $Name; Outcome = $outcome }
}

$SVC = "apps/admin/lib/services/games/live-contest-overview.service.ts"
$ROUTE = "apps/admin/app/api/dashboard/stats/route.ts"

# ---------------------------------------------------------------------------------------
# 1. Drafts are counted as live. The tempting change - an operator asking "what have we got
#    on" arguably wants to see the drafts too - and it tells them work is live that nobody
#    can enter.
#
#    AIMED AT THE SECOND TEST, DELIBERATELY. Run against "counts active and upcoming, and
#    nothing else" this probe reported GREEN, and the test was not broken: a draft increments
#    neither counter, so the totals stay 1 and 1 and the mutation changes no observable at all.
#    The fourth cause of a green probe, after a weak test, a wrong claim and an unreachable
#    guard. The observable is the ROW, so that is what the added test asserts and what this
#    now names.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "draft is admitted to the live status list" `
    -File $SVC `
    -From 'export const LIVE_CONTEST_STATUSES = ["active", "upcoming"] as const;' `
    -To 'export const LIVE_CONTEST_STATUSES = ["active", "upcoming", "draft"] as const;' `
    -TestName "does not list a game whose only contest is an unpublished draft"

# ---------------------------------------------------------------------------------------
# 2. THE MOST IMPORTANT ONE. Seats grouped by their own `gameKey` rather than by their
#    contest's. This is the single-query version, it reads perfectly, and it files a provider
#    contest's entrants under trading whenever the seat carries the schema default or was
#    written by the raw-driver Game Master route (R7).
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "seats are grouped by the seat's own game label" `
    -File $SVC `
    -From '    { $group: { _id: "$competitionId", seats: { $sum: 1 } } },' `
    -To '    { $group: { _id: "$gameKey", seats: { $sum: 1 } } },' `
    -TestName "attributes a seat to its contest's game, not to the seat's own label"

# ---------------------------------------------------------------------------------------
# 3. The ObjectId/String boundary. `competition_participant.competitionId` is declared
#    `String` while `Competition._id` is an ObjectId, and an aggregation does no casting - so
#    this reports every contest as having no entrants, with no error anywhere.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "contest ids are passed to the pipeline unconverted" `
    -File $SVC `
    -From '  const contestIds = contests.map((contest) => String(contest._id));' `
    -To '  const contestIds = contests.map((contest) => contest._id);' `
    -TestName "counts seats across the ObjectId/String boundary"

# ---------------------------------------------------------------------------------------
# 4. The price feed hidden on `tradingEnabled` alone - which is literally what `12` s5 asks
#    for, and is wrong in the one direction that matters: switching trading off does not close
#    the contests already running, and their open positions are still priced from that feed.
#
#    THE TARGET MOVED, and this is worth reading rather than "fixing" back. The rule left this
#    service on 8 September 2026 for `lib/admin/trading-surface.ts`, because the sidebar asks
#    the same question about the whole TRADING group. `shouldShowPriceFeed` is now a delegation,
#    so mutating it would prove only that a one-line wrapper forwards. Mutating the shared rule
#    proves both consumers change together - which is the property that matters now.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "price feed hidden on the enabled flag alone" `
    -File "apps/admin/lib/admin/trading-surface.ts" `
    -From '  return facts.tradingEnabled || facts.tradingHasLiveContests;' `
    -To '  return facts.tradingEnabled;' `
    -TestName "stays visible while trading has something live"

# ---------------------------------------------------------------------------------------
# 5. Counts taken over the ENABLED set rather than over the stored labels. R29 and invariant
#    9: a disabled game's history must not vanish, and here a running contest would disappear
#    from the operator's screen the moment somebody flipped a switch.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "contests filtered by the currently-enabled games" `
    -File $SVC `
    -From '  const contests = await Competition.find({
    status: { $in: [...LIVE_CONTEST_STATUSES] },
  })' `
    -To '  const contests = await Competition.find({
    status: { $in: [...LIVE_CONTEST_STATUSES] },
    gameKey: { $in: await getEnabledGameTypes() },
  })' `
    -TestName "still counts a running trading contest after trading is switched off"

# ---------------------------------------------------------------------------------------
# 6. An unlabelled provider contest collapsed onto one shared key. `gameKey` is immutable
#    precisely so history stays addressable, and merging two games' rows is worse than a row
#    keyed on the provider and code the contest does carry.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "unlabelled provider contests share one bucket" `
    -File "apps/admin/lib/admin/contest-analytics-presentation.ts" `
    -From '  const provider = nonEmpty(row.providerKey);
  const code = nonEmpty(row.gameCode);
  if (provider && code) return `provider:${provider}:${code}`;
  return "provider:unlabelled";' `
    -To '  return "provider:unlabelled";' `
    -TestName "keys an unlabelled provider contest on its provider and code"

# ---------------------------------------------------------------------------------------
# 7. The route reverts to `verifyAdminAuth`, which asks only whether the caller is an admin at
#    all. An employee granted one unrelated section passes it. Eighth instance of that class.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "stats route reverts to admin-at-all authentication" `
    -File $ROUTE `
    -From '    const guard = await guardSection("overview");' `
    -To '    const guard = await verifyAdminAuth();' `
    -TestName "the stats route is granted by the overview section"

# ---------------------------------------------------------------------------------------
# 8. Money reaches a screen granted by `overview`. The negative assertion is the load-bearing
#    half of this slice's RBAC claim, and adding a prize-pool figure reviews as a helpful
#    addition rather than as a widening of who can read the platform's earnings.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the service starts selecting the prize pool" `
    -File $SVC `
    -From '    .select("_id status gameType gameKey gameConfig.providerKey gameConfig.gameCode")' `
    -To '    .select("_id status gameType gameKey prizePool gameConfig.providerKey gameConfig.gameCode")' `
    -TestName "the service reads no money field off a contest"

Write-Host ""
Write-Host "================ SUMMARY ================" -ForegroundColor Cyan
$results | ForEach-Object { Write-Host ("  {0,-24} {1}" -f $_.Outcome, $_.Name) }
Write-Host ""
$bad = @($results | Where-Object { $_.Outcome -notlike "RED*" })
if ($bad.Count -eq 0) {
    Write-Host "All $($results.Count) probes red on the expected test." -ForegroundColor Green
}
else {
    Write-Host "$($bad.Count) probe(s) did not go red - investigate before believing any guard." -ForegroundColor Red
}
