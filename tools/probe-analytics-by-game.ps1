# Probes for X6's analytics-by-provider slice (`12` s5).
#
# Each probe reinstates one defect and expects ONE named test to go red. Naming the expected
# test is the point: an earlier probe elsewhere reported red against a test asserting a
# different claim, which is indistinguishable from the guard working.
#
# PARAMETERISED ON THE FILE AND THE SUITE, not just the test name. This slice spans a pure
# module, an API route and a client component, and the eighth probing instance was a probe that
# reported "no test ran" purely because it was aimed at the default suite while the guard it
# needed lived in another file - which reads exactly like a missing guard.
#
# Harness rules carried from every previous probing instance, each of which produced a false
# result at least once:
#   - `-LiteralPath`-equivalent reads via [System.IO.File], because a path containing `[id]`
#     is parsed by PowerShell as a wildcard character class and `Get-Content` returns $null.
#   - Refuse to write when the read came back empty, for the same reason.
#   - UTF-8 without BOM on both ends: PowerShell 5.1 decodes with the system ANSI codepage,
#     which silently mangles every emoji in a touched file and surfaces two steps later.
#   - Relax newlines so a CRLF pattern matches an LF file.
#   - Assert the file actually CHANGED. A pattern that fails to apply is indistinguishable
#     from a test that does not work.
#   - Judge by the summary counts of a single `-t` run, never by searching whole-suite output
#     for a test name, which vitest prints for a passing test as readily as a failing one.

$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $PSScriptRoot
$Module = Join-Path $Root "apps\admin\lib\admin\contest-analytics-presentation.ts"
$Route = Join-Path $Root "apps\admin\app\api\competition-analytics\route.ts"
$Component = Join-Path $Root "apps\admin\components\admin\CompetitionAnalytics.tsx"
$Service = Join-Path $Root "apps\admin\lib\services\games\game-performance.service.ts"
$PerfRoute = Join-Path $Root "apps\admin\app\api\games\performance\route.ts"

$AnalyticsSuite = "__tests__/admin/contest-analytics-presentation.test.ts"
$PerfSuite = "__tests__/admin/game-performance.test.ts"

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Source([string]$Path) {
    $text = [System.IO.File]::ReadAllText($Path, $Utf8NoBom)
    if ([string]::IsNullOrWhiteSpace($text)) {
        throw "ABORT: read of $Path came back empty. Refusing to continue."
    }
    return $text
}

function Write-Source([string]$Path, [string]$Text) {
    if ([string]::IsNullOrWhiteSpace($Text)) {
        throw "ABORT: refusing to write empty content to $Path"
    }
    [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function To-Relaxed([string]$Literal) {
    return ([regex]::Escape($Literal) -replace "\\r\\n|\\n", "\r?\n")
}

function Invoke-Probe {
    param(
        [string]$Name,
        [string]$File,
        [string]$Suite,
        [string]$ExpectTest,
        [string]$Find,
        [string]$Replace
    )

    Write-Host ""
    Write-Host "=== PROBE: $Name" -ForegroundColor Cyan
    Write-Host "    expects red: $ExpectTest"

    $original = Read-Source $File
    $pattern = To-Relaxed $Find
    $patched = [regex]::Replace($original, $pattern, { param($m) $Replace }, 1)

    if ($patched -eq $original) {
        Write-Host "    PROBE DID NOT APPLY - pattern never matched. Result is meaningless." -ForegroundColor Red
        return
    }

    try {
        Write-Source $File $patched

        $out = & npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String
        # Collapse whitespace: Out-String wraps at the console width, so a long test name can
        # arrive split across two lines and a literal match silently misses it.
        $flat = ($out -replace "\s+", " ")

        if ($flat -match "Tests\s+(\d+)\s+failed") {
            $failed = [int]$Matches[1]
            if ($failed -eq 1) {
                Write-Host "    RED as expected (1 failed)" -ForegroundColor Green
            }
            else {
                Write-Host "    RED but $failed tests failed - expected exactly 1. Suspect collateral damage, not a guard." -ForegroundColor Yellow
            }
        }
        elseif ($flat -match "Tests\s+.*(passed|skipped)") {
            Write-Host "    GREEN - the guard is NOT held by this test. Investigate: weak test, wrong claim, unreachable, or missing test." -ForegroundColor Red
        }
        elseif ($flat -match "No test found") {
            Write-Host "    NO TEST RAN - the expected test name does not match. Probe is mis-aimed." -ForegroundColor Red
        }
        else {
            Write-Host "    UNKNOWN result - read the output." -ForegroundColor Yellow
            Write-Host $out
        }
    }
    finally {
        Write-Source $File $original
        $restored = Read-Source $File
        if ($restored -ne $original) {
            Write-Host "    !! RESTORE FAILED - fix $File by hand before continuing." -ForegroundColor Red
        }
    }
}

Write-Host "Probing analytics by game and provider, plus game performance" -ForegroundColor White

# ---------------------------------------------------------------------------------------------
# The analytics presentation module
# ---------------------------------------------------------------------------------------------

# 1. Grouping on the display name instead of the immutable key. Renaming a title then splits one
#    game's revenue into two rows that each look complete.
Invoke-Probe -Name "by-game summary groups on the display name" `
    -File $Module -Suite $AnalyticsSuite `
    -ExpectTest "groups on the key, so renaming a title does not split its history" `
    -Find @'
  return collapse(rows, (row) => {
    const badge = resolveGameBadge(row);
    return { groupKey: badge.key, badge };
  });
'@ `
    -Replace @'
  return collapse(rows, (row) => {
    const badge = resolveGameBadge(row);
    return { groupKey: badge.label, badge };
  });
'@

# 2. Every unlabelled provider contest collapsed under one constant - two games' money in one line.
Invoke-Probe -Name "unlabelled provider contests collapse to one key" `
    -File $Module -Suite $AnalyticsSuite `
    -ExpectTest "composes a key for a provider contest whose gameKey never got written" `
    -Find @'
  if (provider && code) return `provider:${provider}:${code}`;
'@ `
    -Replace ''

# 3. The label falling back to "Unknown" - a row holding real revenue an operator cannot chase.
Invoke-Probe -Name "retired title labelled Unknown" `
    -File $Module -Suite $AnalyticsSuite `
    -ExpectTest "falls back through the code and the key, never to Unknown" `
    -Find 'label: nonEmpty(row.gameDisplayName) ?? nonEmpty(row.gameCode) ?? key,' `
    -Replace 'label: nonEmpty(row.gameDisplayName) ?? "Unknown game",'

# 4. The R46 defect one screen along: the provider branch reads trading's P&L.
Invoke-Probe -Name "provider metric falls back to trading P&L" `
    -File $Module -Suite $AnalyticsSuite `
    -ExpectTest "shows a score for a provider game and P&L for trading" `
    -Find @'
  const metric = resolveResultMetric(
    { score: row.finalScore, pnl: row.finalPnl, pnlPercentage: null, totalTrades: null },
    isProviderGame,
  );
'@ `
    -Replace @'
  const metric = resolveResultMetric(
    { score: row.finalScore, pnl: row.finalPnl, pnlPercentage: null, totalTrades: null },
    false,
  );
'@

# 5. The percentage sub-line passed through, printing +0.00% under a genuine profit.
Invoke-Probe -Name "percentage sub-line passed through from a ledger row" `
    -File $Module -Suite $AnalyticsSuite `
    -ExpectTest "drops the percentage sub-line, which a ledger row cannot carry" `
    -Find 'return { ...metric, sub: null };' `
    -Replace 'return metric;'

# 6. Share of pool returning 0 rather than null when there is no pool - inviting an operator to
#    look for the other 100%.
Invoke-Probe -Name "share of pool returns zero when there is no pool" `
    -File $Module -Suite $AnalyticsSuite `
    -ExpectTest "returns no share at all rather than zero when there is no pool" `
    -Find @'
  if (typeof prizePool !== "number" || !Number.isFinite(prizePool) || prizePool <= 0) {
    return null;
  }
'@ `
    -Replace @'
  if (typeof prizePool !== "number" || !Number.isFinite(prizePool) || prizePool <= 0) {
    return 0;
  }
'@

# 7. The complement, which must be a SEPARATE guard: a null for both cases collapses "no ratio"
#    and "a ratio of zero" into one answer.
Invoke-Probe -Name "a genuine zero share reported as no ratio" `
    -File $Module -Suite $AnalyticsSuite `
    -ExpectTest "does report a genuine zero share when the pool exists" `
    -Find 'if (typeof amount !== "number" || !Number.isFinite(amount)) return null;' `
    -Replace 'if (typeof amount !== "number" || !Number.isFinite(amount) || amount === 0) return null;'

# 8. Trading excluded from the provider comparison - one side of the comparison missing.
#
#    RE-AIMED AFTER A GREEN. The first version of this probe changed only the GROUP KEY, leaving
#    the badge and every figure in the group identical - so with one trading contest present the
#    output was indistinguishable and the probe reported the guard absent. **A mutation that
#    changes no observable is indistinguishable from a test that does not work**, which is the
#    ninth probing instance and the same shape as every other one. Removing the early return is
#    the real defect: trading then falls into the provider branch and is labelled "unknown".
Invoke-Probe -Name "trading dropped from the by-provider comparison" `
    -File $Module -Suite $AnalyticsSuite `
    -ExpectTest "includes trading in the provider comparison, labelled as ours" `
    -Find @'
    if (!badge.isProviderGame) {
      return { groupKey: TRADING_GAME_KEY, badge };
    }
'@ `
    -Replace ''

# 9. Two titles from one provider kept apart in the by-provider view, which is the whole point
#    of having two summaries.
Invoke-Probe -Name "by-provider summary keyed per title" `
    -File $Module -Suite $AnalyticsSuite `
    -ExpectTest "splits two titles from one provider by game and merges them by provider" `
    -Find 'const providerKey = nonEmpty(row.providerKey) ?? "unknown";' `
    -Replace 'const providerKey = badge.key;'

# 10. A payout ratio of 0% where there is no basis for one - a claim about generosity.
Invoke-Probe -Name "payout ratio reported as zero with nothing collected" `
    -File $Module -Suite $AnalyticsSuite `
    -ExpectTest "computes the payout ratio and average pot, and nulls them when there is no basis" `
    -Find 'payoutRatio: group.collected > 0 ? (group.prizesPaid / group.collected) * 100 : null,' `
    -Replace 'payoutRatio: group.collected > 0 ? (group.prizesPaid / group.collected) * 100 : 0,'

# 11. NaN admitted into a total, turning a whole game's revenue line into a rendering bug.
Invoke-Probe -Name "a non-finite figure poisons the total" `
    -File $Module -Suite $AnalyticsSuite `
    -ExpectTest "treats a non-finite figure as absent rather than poisoning the total" `
    -Find 'return typeof value === "number" && Number.isFinite(value) ? value : 0;' `
    -Replace 'return typeof value === "number" ? value : 0;'

# 12. The estimated-fee count dropped, so recorded and inferred revenue mix silently.
Invoke-Probe -Name "estimated fees counted as recorded ones" `
    -File $Module -Suite $AnalyticsSuite `
    -ExpectTest "counts how many fee figures were estimated rather than read from the ledger" `
    -Find 'if (row.platformFeeEstimated === true) existing.estimatedFeeContests += 1;' `
    -Replace ''

# 13. An unstable sort, so the same data reorders between refreshes.
Invoke-Probe -Name "summary order unstable on a tie" `
    -File $Module -Suite $AnalyticsSuite `
    -ExpectTest "sorts by entry-fee volume and breaks ties on the label, so refreshes are stable" `
    -Find '.sort((a, b) => b.collected - a.collected || a.label.localeCompare(b.label));' `
    -Replace '.sort((a, b) => b.collected - a.collected || b.label.localeCompare(a.label));'

# 14. The filter offering only catalogue titles, leaving retired games' rows unreachable.
Invoke-Probe -Name "prototype key admitted by the filter" `
    -File $Module -Suite $AnalyticsSuite `
    -ExpectTest "is not confused by a prototype key arriving as a selection" `
    -Find 'return rows.filter((row) => resolveGameBadge(row).key === selected);' `
    -Replace 'return rows.filter((row) => ({ [resolveGameBadge(row).key]: true })[selected]);'

# 15. The scope note claiming an all-time total when the list is capped.
Invoke-Probe -Name "scope note claims all time when the list is capped" `
    -File $Module -Suite $AnalyticsSuite `
    -ExpectTest "names the window when the list is capped and the true count when it is not" `
    -Find 'if (contestCount < limit) {' `
    -Replace 'if (true) {'

# ---------------------------------------------------------------------------------------------
# The analytics route
# ---------------------------------------------------------------------------------------------

# 16. The live authorization defect exactly as it shipped: token validity, not section access.
Invoke-Probe -Name "route guards on admin-at-all instead of the section grant" `
    -File $Route -Suite $AnalyticsSuite `
    -ExpectTest "guards on the analytics section grant, not merely on being an admin" `
    -Find @'
  const guard = await guardSection("analytics");
  if (!guard.ok) return guard.response;
'@ `
    -Replace @'
  const auth = await verifyAdminToken();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
'@

# 17. The catalogue names dropped, so every provider contest renders its own key.
Invoke-Probe -Name "route stops sending the catalogue name" `
    -File $Route -Suite $AnalyticsSuite `
    -ExpectTest "sends the catalogue and provider names the labels need" `
    -Find 'gameDisplayName' `
    -Replace 'gameTitleName'

# 18. The provider score dropped, leaving the winners column blank for every game contest.
Invoke-Probe -Name "route stops sending the provider score" `
    -File $Route -Suite $AnalyticsSuite `
    -ExpectTest "sends the score a provider contest was ranked on" `
    -Find 'finalScore' `
    -Replace 'rankedOn'

# 19. The limit hard-coded in the response, so the caption can drift from the query.
Invoke-Probe -Name "contest limit duplicated instead of sent" `
    -File $Route -Suite $AnalyticsSuite `
    -ExpectTest "sends its own contest limit so the caption cannot drift from it" `
    -Find 'contestLimit: CONTEST_LIMIT,' `
    -Replace 'contestLimit: 50,'

# ---------------------------------------------------------------------------------------------
# The analytics component
# ---------------------------------------------------------------------------------------------

# 20. A per-game special case, which is the one failure mode a "works for any game" claim has.
Invoke-Probe -Name "component branches on the game" `
    -File $Component -Suite $AnalyticsSuite `
    -ExpectTest "branches on nothing game-specific" `
    -Find 'const scopeNote =' `
    -Replace 'const isTrading = (c: { gameType?: string }) => c.gameType === "trading";
  const scopeNote ='

# 21. The metric formatted the old way beside the resolver - the negative half of the claim,
#     which is trivially satisfied by a component that merely imports the shared module.
Invoke-Probe -Name "P&L formatted inline beside the shared resolver" `
    -File $Component -Suite $AnalyticsSuite `
    -ExpectTest "resolves the metric and the share through the shared module" `
    -Find 'const scopeNote =' `
    -Replace 'const legacyPnl = (w: { finalPnl?: number }) => (w.finalPnl ?? 0).toFixed(2);
  const scopeNote ='

# 22. The scope note removed, so every headline card is captioned as an all-time total again.
Invoke-Probe -Name "scope note dropped from the screen" `
    -File $Component -Suite $AnalyticsSuite `
    -ExpectTest "renders the scope note, so no card is captioned as an all-time total" `
    -Find 'resolveScopeNote(' `
    -Replace 'legacyScopeNote('

# ---------------------------------------------------------------------------------------------
# Game performance
# ---------------------------------------------------------------------------------------------

# 23. The window taken from the caller - a full-collection scan behind a URL edit.
Invoke-Probe -Name "window honoured straight from the query string" `
    -File $Service -Suite $PerfSuite `
    -ExpectTest "falls back to the default rather than honouring an arbitrary day count" `
    -Find @'
  return (
    PERFORMANCE_WINDOWS.find((days) => days === parsed) ??
    DEFAULT_PERFORMANCE_WINDOW
  );
'@ `
    -Replace @'
  return (Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_PERFORMANCE_WINDOW) as PerformanceWindow;
'@

# 24. Practice rounds counted, making abandonment a measure of how much free play a title gets.
Invoke-Probe -Name "practice rounds counted as traffic" `
    -File $Service -Suite $PerfSuite `
    -ExpectTest "does not count a practice round as traffic" `
    -Find '{ $match: { createdAt: { $gte: since }, mode: "ranked" } },' `
    -Replace '{ $match: { createdAt: { $gte: since } } },'

# 25. The window filter dropped entirely.
Invoke-Probe -Name "window filter dropped from the status query" `
    -File $Service -Suite $PerfSuite `
    -ExpectTest "omits a title whose only rounds are older than the window" `
    -Find '{ $match: { createdAt: { $gte: since }, mode: "ranked" } },' `
    -Replace '{ $match: { mode: "ranked" } },'

# 26. Live rounds counted as finished, so the abandonment rate improves whenever somebody plays.
Invoke-Probe -Name "live rounds counted in the abandonment denominator" `
    -File $Service -Suite $PerfSuite `
    -ExpectTest "does not count live rounds in the abandonment denominator" `
    -Find @'
      const finished =
        rounds.scored + rounds.gaveUp + rounds.cancelled + rounds.neverReported;
'@ `
    -Replace @'
      const finished = rounds.started;
'@

# 27. Abandonment reported as a count, which calls two-out-of-four fine.
Invoke-Probe -Name "abandonment judged on a count rather than a share" `
    -File $Service -Suite $PerfSuite `
    -ExpectTest "reports abandonment as a share of finished rounds, not a bare count" `
    -Find 'const abandonShare = rounds.gaveUp / finished;' `
    -Replace 'const abandonShare = rounds.gaveUp > 100 ? 1 : 0;'

# 28. A negative latency averaged in, reporting a healthy delay on a provider whose clock is
#     minutes ahead of ours.
Invoke-Probe -Name "clock skew averaged into the latency" `
    -File $Service -Suite $PerfSuite `
    -ExpectTest "counts a negative delay as clock skew instead of averaging it in" `
    -Find @'
            latencyMs: {
              $avg: {
                $cond: [{ $gte: ["$latencyMs", 0] }, "$latencyMs", null],
              },
            },
'@ `
    -Replace @'
            latencyMs: { $avg: "$latencyMs" },
'@

# 29. An unmeasurable latency reported as zero - an instant result and an absent one made one fact.
Invoke-Probe -Name "absent latency reported as zero" `
    -File $Service -Suite $PerfSuite `
    -ExpectTest "reports no latency at all rather than zero when nothing carries both timestamps" `
    -Find @'
        averageResultLatencySeconds:
          typeof duration?.latencyMs === "number" &&
          Number.isFinite(duration.latencyMs) &&
          (duration.latencySamples ?? 0) > 0
            ? duration.latencyMs / 1000
            : null,
'@ `
    -Replace @'
        averageResultLatencySeconds: (duration?.latencyMs ?? 0) / 1000,
'@

# 30. The funnel scoped to gameKey alone, so the shortfall is every seat the title ever sold.
Invoke-Probe -Name "funnel counts every seat the title ever sold" `
    -File $Service -Suite $PerfSuite `
    -ExpectTest "counts entrants who never started a round in a competition they paid for" `
    -Find '{ $match: { competitionId: { $in: allContestIds } } },' `
    -Replace '{ $match: { competitionId: { $in: allContestIds }, userId: "nobody" } },'

# 31. The ObjectId/String boundary uncrossed - the R42 fixture trap, which reports every entrant
#     as having played and never errors.
Invoke-Probe -Name "contest ids not stringified for the seat query" `
    -File $Service -Suite $PerfSuite `
    -ExpectTest "matches seats across the ObjectId/String boundary" `
    -Find 'row.contests.map((id) => String(id)),' `
    -Replace 'row.contests as string[],'

# 32. Challenge rounds counted as having played a competition.
Invoke-Probe -Name "challenge rounds counted against competition seats" `
    -File $Service -Suite $PerfSuite `
    -ExpectTest "does not let a challenge round count as having played a competition" `
    -Find @'
            mode: "ranked",
            contestType: "competition",
            contestId: { $ne: null },
'@ `
    -Replace @'
            mode: "ranked",
            contestId: { $ne: null },
'@

# 33. No seats reported as nobody having failed to play.
Invoke-Probe -Name "an absent funnel reported as zero" `
    -File $Service -Suite $PerfSuite `
    -ExpectTest "reports no funnel at all rather than zero when there are no seats" `
    -Find @'
        entrantsWhoNeverPlayed: entrants
          ? [...entrants].filter((userId) => !playedInContests?.has(userId)).length
          : null,
'@ `
    -Replace @'
        entrantsWhoNeverPlayed:
          (entrants?.size ?? 0) - (playedInContests?.size ?? 0),
'@

# 34. A retired title dropped, so its recorded abandonment disappears when an operator switches
#     the game off - the read-side form of R29's retroactive subtraction.
Invoke-Probe -Name "a retired title dropped from the report" `
    -File $Service -Suite $PerfSuite `
    -ExpectTest "still reports the game, labelled, when its catalogue row is gone" `
    -Find 'inCatalogue: Boolean(title),' `
    -Replace 'inCatalogue: true,'

# 35. The summary reduced to the badge word, which is what makes a verdict unexplainable.
Invoke-Probe -Name "summary reduced to a bare status word" `
    -File $Service -Suite $PerfSuite `
    -ExpectTest "never returns a bare status word as the summary" `
    -Find 'summary: `${rounds.scored} of ${finished} finished rounds produced a score, with none unreported.`,' `
    -Replace 'summary: "healthy",'

# 36. The verdict badge and its sentence able to disagree, by returning them separately.
Invoke-Probe -Name "unreported rounds no longer a problem verdict" `
    -File $Service -Suite $PerfSuite `
    -ExpectTest "calls a title with unreported rounds a problem and one with abandonment a watch" `
    -Find 'if (unreportedShare > PROBLEM_UNREPORTED_SHARE) {' `
    -Replace 'if (false) {'

# 37. All-live rounds read as evidence, so a game nobody has finished reports a verdict.
Invoke-Probe -Name "all-live rounds treated as evidence" `
    -File $Service -Suite $PerfSuite `
    -ExpectTest "says so rather than reporting healthy when every round is still live" `
    -Find @'
  if (finished === 0) {
'@ `
    -Replace @'
  if (false) {
'@

# ---------------------------------------------------------------------------------------------
# The game-performance route and screen
# ---------------------------------------------------------------------------------------------

# 38. The section guard replaced by admin-at-all.
Invoke-Probe -Name "performance route guards on admin-at-all" `
    -File $PerfRoute -Suite $PerfSuite `
    -ExpectTest "guards on the section grant and not merely on being an admin" `
    -Find @'
  const guard = await guardSection("game-performance");
  if (!guard.ok) return guard.response;
'@ `
    -Replace @'
  const auth = await requireAdminAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
'@

# 39. A money field read into the operational service - the RBAC widening that reviews as a
#     helpful addition.
Invoke-Probe -Name "a money figure added to the operational service" `
    -File $Service -Suite $PerfSuite `
    -ExpectTest "reads no money field and imports no money model" `
    -Find 'const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);' `
    -Replace 'const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const entryFee = 0;
  void entryFee;'

Write-Host ""
Write-Host "Done. Every probe must have reported RED as expected." -ForegroundColor White
