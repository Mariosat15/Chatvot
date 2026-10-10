# Probes for withholding trading's admin screens -
# `__tests__/admin/trading-surface-visibility.test.ts`.
#
# Same harness as probe-live-contest-overview.ps1; its lessons are already paid for and not
# re-derived here: -LiteralPath and explicit UTF-8 without a BOM on the read AND the write;
# refuse to write when the read came back empty; confirm the file actually changed; name the
# expected failing test and judge by the summary counts of that single filtered test.
#
# 1-2 tests red is the honest number for a one-line change. More than that usually means the
# harness mangled the file rather than that the guard is broad.
#
# WHAT IS BEING PROBED. Every mutation here is a version of this change somebody would plausibly
# write, and each is wrong in a way that leaves the screen looking right: the rule read as
# `tradingEnabled` alone (which is what the plan literally says), the liveness query written the
# positive way so unlabelled contests stop counting, drafts admitted as live, the default failing
# closed, the recovery path inventing `false`, the menu id spelled as a literal - and the one
# that matters most, hiding widened into revoking by gating the render as well as the menu.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/admin/trading-surface-visibility.test.ts"
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

$RULE = "apps/admin/lib/admin/trading-surface.ts"
$SVC = "apps/admin/lib/services/games/live-contest-overview.service.ts"
$SIDEBAR = "apps/admin/components/admin/AdminDashboard.tsx"
$PAGE = "apps/admin/app/dashboard/page.tsx"

# ---------------------------------------------------------------------------------------
# 1. The rule read as `tradingEnabled` alone - which is exactly what `12` s5 and `12` s9 say,
#    and is the mutation most likely to be made on the grounds that it matches the plan.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the rule ignores whether anything is still running" `
    -File $RULE `
    -From '  return facts.tradingEnabled || facts.tradingHasLiveContests;' `
    -To '  return facts.tradingEnabled;' `
    -TestName "keeps them while a trading contest is still running"

# ---------------------------------------------------------------------------------------
# 2. The other half of the same rule: withheld whenever anything is live, ignoring the flag.
#    Reads as generous and means the menu never tidies itself on a platform that has moved on.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the rule ignores the operator's own switch" `
    -File $RULE `
    -From '  return facts.tradingEnabled || facts.tradingHasLiveContests;' `
    -To '  return facts.tradingHasLiveContests;' `
    -TestName "shows the trading surfaces while trading is switched on"

# ---------------------------------------------------------------------------------------
# 3. THE MOST IMPORTANT ONE. Hiding widened into revoking, by gating the rendered screen on the
#    same flag. It reads as completing the job, and it locks an operator with a bookmark out of
#    the screens that run a contest which is still being played.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the rendered screen is gated on the flag as well as the menu" `
    -File $SIDEBAR `
    -From '        return <PriceHealthWidget key={currentRefreshKey} />;' `
    -To '        return tradingSurfaceVisible ? <PriceHealthWidget key={currentRefreshKey} /> : null;' `
    -TestName "does not gate the rendered screen or the tab strip on the flag"

# ---------------------------------------------------------------------------------------
# 4. The liveness query written the positive way. `gameKey: "trading"` reads as clearer and
#    stops counting every contest that predates the X1 label - and the backfill that would
#    repair them has never been applied, so that is most of the production history.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "liveness asks for the trading label instead of not-provider" `
    -File $SVC `
    -From '        gameType: { $ne: "provider" },' `
    -To '        gameKey: "trading",' `
    -TestName "counts an unlabelled contest as trading"

# ---------------------------------------------------------------------------------------
# 5. Drafts admitted as live. Would keep the trading screens on the menu for ever on any
#    platform that ever saved a trading draft.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "a draft counts as a live trading contest" `
    -File $SVC `
    -From '        status: { $in: [...LIVE_CONTEST_STATUSES] },
        gameType: { $ne: "provider" },' `
    -To '        status: { $in: [...LIVE_CONTEST_STATUSES, "draft"] },
        gameType: { $ne: "provider" },' `
    -TestName "does not count a trading draft"

# ---------------------------------------------------------------------------------------
# 6. The default fails closed. One character, and an operator loses six screens because a
#    caller forgot a prop - silently, with nothing to click.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the default hides rather than shows" `
    -File $RULE `
    -From 'export const TRADING_SURFACE_VISIBLE_BY_DEFAULT = true;' `
    -To 'export const TRADING_SURFACE_VISIBLE_BY_DEFAULT = false;' `
    -TestName "defaults to visible"

# ---------------------------------------------------------------------------------------
# 7. The sidebar's own default written as a literal. Works today, and stops tracking the rule
#    the moment the rule is revisited.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the sidebar hard-codes its default" `
    -File $SIDEBAR `
    -From '  tradingSurfaceVisible = TRADING_SURFACE_VISIBLE_BY_DEFAULT,' `
    -To '  tradingSurfaceVisible = true,' `
    -TestName "defaults the prop to the shared constant"

# ---------------------------------------------------------------------------------------
# 8. The menu id spelled as a literal in the filter. Survives a rename of the menu entry and
#    silently stops hiding anything.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the filter names the menu id as a string literal" `
    -File $SIDEBAR `
    -From 'if (item.id === TRADING_MENU_ID && !tradingSurfaceVisible) {' `
    -To 'if (item.id === "trading-menu" && !tradingSurfaceVisible) {' `
    -TestName "names the menu id from the shared module"

# ---------------------------------------------------------------------------------------
# 9. The recovery path invents `false`. A settings read timing out would take the screens with
#    it, which is the failure this whole design is arranged to avoid.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the resolver fails closed when the reads throw" `
    -File $SVC `
    -From '      visible: TRADING_SURFACE_VISIBLE_BY_DEFAULT,' `
    -To '      visible: false,' `
    -TestName "fails open when the facts cannot be resolved"

# ---------------------------------------------------------------------------------------
# 10. The page stops passing the flag. The prop then falls back to visible, so nothing breaks
#     and nothing hides - a feature that reviews as built and does nothing.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the page stops handing the flag to the sidebar" `
    -File $PAGE `
    -From '      tradingSurfaceVisible={tradingSurface.visible}' `
    -To '' `
    -TestName "is handed the flag by the page"

# ---------------------------------------------------------------------------------------
# 11. The two consumers drift apart, which is the failure `trading-surface.ts` exists to make
#     impossible. `shouldShowPriceFeed` deciding for itself is green on every behavioural test
#     above, because it agrees with the rule in three of the four states.
# ---------------------------------------------------------------------------------------
$results += Invoke-Probe `
    -Name "the price-feed tile keeps its own copy of the rule" `
    -File $SVC `
    -From '  return isTradingSurfaceRelevant(overview);' `
    -To '  return overview.tradingEnabled;' `
    -TestName "answers the price-feed tile and the sidebar identically"

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
