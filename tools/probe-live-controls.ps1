# Probes for __tests__/admin/live-contest-controls.test.ts
#
# Same harness as probe-contest-edit.ps1 - its lessons are already paid for: -LiteralPath and
# explicit UTF-8 without a BOM on read AND write; refuse to write if the read came back empty;
# confirm the file actually changed; judge by the summary counts of a single filtered test
# rather than by searching whole-suite output for a test's name, which vitest prints for a
# passing test as readily as a failing one.
#
# 1-2 tests red is the honest number for a one-line change. Five or more means the probe
# damaged the file rather than the behaviour.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/admin/live-contest-controls.test.ts"
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

$LAUNCH = "lib/services/games/round-launch.service.ts"
$CLEANUP = "lib/services/games/contest-round-cleanup.ts"
$STATUS = "lib/services/games/round-status.service.ts"
$PREFLIGHT = "components/games/RoundPreflight.tsx"
$OLDFINAL = "apps/admin/app/api/finalize-old-competitions/route.ts"
$PAUSE = "apps/admin/app/api/competitions/[id]/pause/route.ts"
$EMERGENCY = "apps/admin/app/api/competitions/[id]/emergency-cancel/route.ts"
$CANCEL = "apps/admin/app/api/competitions/[id]/cancel/route.ts"
# The cleanup call lives in the ACTION, not the route - the route delegates. Naming the route
# here is how probe 14 first reported DID NOT APPLY.
$CANCEL_ACTION = "lib/actions/trading/competition-cancel.actions.ts"
$ADJUST = "apps/admin/app/api/competitions/[id]/adjust-results/route.ts"
$LISTROUTE = "apps/admin/app/api/competitions/route.ts"
$PLAYSTATE = "components/games/play-state.ts"
$PANEL = "apps/admin/components/admin/CompetitionAdminActions.tsx"
$COPY = "apps/admin/lib/admin/contest-control-copy.ts"
$VIEWPAGE = "apps/admin/app/competitions/view/[id]/page.tsx"
$ROUNDSROUTE = "app/api/competitions/[id]/rounds/route.ts"

# --- the pause gate, which is the whole point of the slice ---------------------------------

# 1. The original defect: isPaused ignored, so pausing a provider contest was cosmetic.
$results += Invoke-Probe `
    -Name "launch ignores isPaused again (the original defect)" `
    -File $LAUNCH `
    -From "  if (contest.isPaused) {" `
    -To "  if (false) {" `
    -TestName "refuses with contest_paused and creates no round"

# 2. The gate moved BELOW round creation. It still refuses, so end status alone cannot see
#    this - the test has to observe that no round document exists.
$results += Invoke-Probe `
    -Name "pause gate placed after the seat lookup, not before it" `
    -File $LAUNCH `
    -From @'
  if (contest.isPaused) {
'@ `
    -To @'
  if (contest.isPaused && false) {
'@ `
    -TestName "refuses to RESUME a live round while paused"

# 3. The refusal is folded into a generic code, which is the lesson from LaunchRefusal:
#    a code the UI must branch on is not an implementation detail to collapse.
$results += Invoke-Probe `
    -Name "contest_paused collapsed into contest_not_open" `
    -File $LAUNCH `
    -From @'
        "contest_paused",
'@ `
    -To @'
        "contest_not_open",
'@ `
    -TestName "refuses with contest_paused and creates no round"

# --- the cleanup service -------------------------------------------------------------------

# 4. The STATUS filter drops, so terminal rounds are stamped over.
#
#    Re-aimed. The first version of this probe removed the `canTransitionRound` check inside
#    the loop and came back GREEN - the third answer to a green probe, after "weak test" and
#    "wrong claim": the guard is real but UNREACHABLE on this path, because
#    `LIVE_ROUND_STATUSES` is `pending`/`launched` and `ROUND_TRANSITIONS` permits `voided`
#    from both, so the query has already guaranteed a legal move before the check runs.
#    The property "terminal rounds are left alone" lives in the query filter, so that is
#    where the probe belongs. The check is kept as a tripwire and the comment says so.
$results += Invoke-Probe `
    -Name "cleanup query stops filtering to live statuses" `
    -File $CLEANUP `
    -From @'
    contestId,
    status: { $in: LIVE_ROUND_STATUSES },
'@ `
    -To @'
    contestId,
'@ `
    -TestName "voids every live round and leaves terminal ones alone"

# 5. The contest filter drops, so a cancellation voids the whole platform's live rounds.
$results += Invoke-Probe `
    -Name "cleanup query loses its contest filter" `
    -File $CLEANUP `
    -From @'
    contestId,
    status: { $in: LIVE_ROUND_STATUSES },
'@ `
    -To @'
    status: { $in: LIVE_ROUND_STATUSES },
'@ `
    -TestName "does not touch another contest's rounds"

# 6. The result source is recorded as the net giving up rather than an operator decision,
#    which is what makes a cancelled round indistinguishable from a provider that never
#    reported.
$results += Invoke-Probe `
    -Name "cleanup records the void as a timeout, not as a manual decision" `
    -File $CLEANUP `
    -From 'round.resultSource = "manual";' `
    -To 'round.resultSource = "timeout";' `
    -TestName "records the decision as manual"

# --- the play state and the player's screen ------------------------------------------------

# 7. isPaused stops crossing the seam, so the player is offered a Play button on a paused
#    contest and the refusal only arrives after the click.
$results += Invoke-Probe `
    -Name "play state stops reporting isPaused" `
    -File $STATUS `
    -From "        isPaused: contest.isPaused === true," `
    -To "        isPaused: false," `
    -TestName "reports the pause on the play state the pre-flight renders"

# 8. The preflight stops blocking on a pause.
$results += Invoke-Probe `
    -Name "preflight no longer treats a pause as blocking" `
    -File $PREFLIGHT `
    -From @'
    noLongerOpen ||
    paused ||
'@ `
    -To @'
    noLongerOpen ||
'@ `
    -TestName "blocks resume as well as play"

# 9. The client copy of PlayState loses the field, which is the drift the parity test exists
#    for - two copies of one type, deliberately, because the service imports Mongoose.
$results += Invoke-Probe `
    -Name "client PlayState copy drifts from the service's" `
    -File $PLAYSTATE `
    -From "  isPaused: boolean;" `
    -To "" `
    -TestName "declares the same fields on both sides of the wire" `
    -Suite "__tests__/games/provider-play-ui.test.ts"

# --- authorization -------------------------------------------------------------------------

# 10. The no-auth defect restored on the force-finalize route.
$results += Invoke-Probe `
    -Name "finalize-old-competitions loses its guard (the no-auth defect)" `
    -File $OLDFINAL `
    -From 'const guard = await guardSection("competitions");' `
    -To 'const guard = { ok: true as const, admin: { id: "x", email: "x" } };' `
    -TestName "calls guardSection"

# 11. The guard runs AFTER the work, so an anonymous caller's writes have already landed.
$results += Invoke-Probe `
    -Name "guard placed after the database work on finalize-old-competitions" `
    -File $OLDFINAL `
    -From @'
    const guard = await guardSection("competitions");
    if (!guard.ok) return guard.response;

    await connectToDatabase();
'@ `
    -To @'
    await connectToDatabase();

    const guard = await guardSection("competitions");
    if (!guard.ok) return guard.response;
'@ `
    -TestName "the force-finalize route had NO auth, so its guard is asserted by position"

# 12. Back to admin-at-all rather than section-scoped, on the route where it matters most.
$results += Invoke-Probe `
    -Name "pause route falls back to bare admin authentication" `
    -File $PAUSE `
    -From 'const guard = await guardSection("competitions");' `
    -To 'const auth = await verifyAdminAuth(request); const guard = { ok: true as const, admin: { id: "x", email: "x" } };' `
    -TestName "no longer authenticates on token validity alone"

# 13. One handler guarded, the other not - the shape that passes a "does the file mention the
#     guard" check while leaving a mutation open.
$results += Invoke-Probe `
    -Name "emergency-cancel keeps one guarded handler and one open" `
    -File $EMERGENCY `
    -From 'const guard = await guardSection("competitions");' `
    -To 'const guard = { ok: true as const, admin: { id: "x", email: "x" } };' `
    -TestName "guards EVERY exported handler, not just the first"

# --- game awareness ------------------------------------------------------------------------

# 14. Cancellation stops ending live rounds, so players keep playing a cancelled contest and
#     the reconciliation net later writes them off as unresolved.
#     Aimed at the call's POSITION relative to the commit, not merely its presence: a call
#     moved after `commitTransaction()` would still "call the function" and would void rounds
#     for a refund that never happened.
$results += Invoke-Probe `
    -Name "cancellation stops voiding live rounds" `
    -File $CANCEL_ACTION `
    -From "    const voided = await endLiveRoundsForContest({" `
    -To "    const voided = await Promise.resolve({ ended: 0, roundIds: [], skipped: 0 }); const unusedCleanup = ({" `
    -TestName "calls endLiveRoundsForContest inside the transaction"

# 15. The force-finalize route stops skipping provider contests, so it runs trading-shaped
#     finalization over a game contest.
$results += Invoke-Probe `
    -Name "force-finalize stops skipping provider contests" `
    -File $OLDFINAL `
    -From "      if (hasProviderGameLabel(comp)) {" `
    -To "      if (false) {" `
    -TestName "skips a provider contest explicitly rather than by accident"

# 16. The pause notification goes back to saying "trading" for every game.
$results += Invoke-Probe `
    -Name "pause notification hard-codes trading wording" `
    -File $PAUSE `
    -From 'const activityNoun = isProviderGame ? "Play" : "Trading";' `
    -To 'const activityNoun = "Trading";' `
    -TestName "derives the noun from the stored label, never from caller input"

# 17. Resume extends endTime only, so a provider contest's play window stays where the pause
#     left it and the players lose the paused time.
$results += Invoke-Probe `
    -Name "resume stops extending the play window" `
    -File $PAUSE `
    -From @'
        competition.playWindowEnd = new Date(
          new Date(competition.playWindowEnd).getTime() + pauseDuration,
'@ `
    -To @'
        const unusedWindow = new Date(
          new Date(competition.playWindowEnd).getTime() + 0,
'@ `
    -TestName "extends playWindowEnd by the pause duration"

# 18. The refusal is grouped with the 503 block, so a paused contest reads as a platform
#     fault and the client retries something that needs an operator instead.
#     The switch uses fall-through `case` labels, not an object map, so the defect is a MOVE
#     rather than a deletion. That is deliberate: deleting the label drops it to the `default`
#     500, which the test would also catch but which is a DIFFERENT bug. The position
#     assertions are the ones being probed here.
$results += Invoke-Probe `
    -Name "contest_paused grouped with the retryable 503 refusals" `
    -File $ROUNDSROUTE `
    -From @'
    case "contest_paused":
    case "play_window_not_started":
'@ `
    -To @'
    case "play_window_not_started":
'@ `
    -TestName "maps contest_paused to 409, not 503"

# 18b. A SECOND label added in the 503 block. `indexOf` finds the first, so the position
#      assertions alone stay green while the switch has two answers - the "count the
#      occurrences" lesson, which is why the test counts them.
$results += Invoke-Probe `
    -Name "a second contest_paused label added in the 503 block" `
    -File $ROUNDSROUTE `
    -From @'
    case "title_unavailable":
'@ `
    -To @'
    case "contest_paused":
    case "title_unavailable":
'@ `
    -TestName "maps contest_paused to 409, not 503"

# 19. adjust-results back to bare admin auth.
$results += Invoke-Probe `
    -Name "adjust-results falls back to bare admin authentication" `
    -File $ADJUST `
    -From 'const guard = await guardSection("competitions");' `
    -To 'const guard = { ok: true as const, admin: { id: "x", email: "x" } };' `
    -TestName "calls guardSection"

# 20. The list route back to its inline JWT check.
$results += Invoke-Probe `
    -Name "competitions list route back to its inline JWT check" `
    -File $LISTROUTE `
    -From 'const guard = await guardSection("competitions");' `
    -To 'const guard = { ok: true as const, admin: { id: "x", email: "x" } };' `
    -TestName "calls guardSection"

# --- the operator's control panel ----------------------------------------------------------

# 21. The original defect: trading wording on a game contest, above a confirm button.
$results += Invoke-Probe `
    -Name "emergency dialog promises to close positions again (the original defect)" `
    -File $PANEL `
    -From "                  {copy.emergencyDialogDescription}" `
    -To "                  This is for critical situations only. All positions will be closed at current prices." `
    -TestName "has no UNCONDITIONAL trading wording left in the panel"

# 22. The consequence list goes back to literals. Aimed at the LIST, not the description, so
#     the two halves of the wording pass are told apart.
$results += Invoke-Probe `
    -Name "pause consequence list hand-rolled beside the module import" `
    -File $PANEL `
    -From @'
                      {copy.pauseConsequences.map((consequence) => (
                        <li key={consequence}>{consequence}</li>
                      ))}
'@ `
    -To @'
                      <li>Prevent any new orders from being placed</li>
'@ `
    -TestName "renders the consequence lists from the module, not from literals"

# 23. The panel decides for itself what a provider contest is - two answers in one app, and
#     the one in the browser is the one nobody tests.
$results += Invoke-Probe `
    -Name "panel derives the game itself instead of taking the server's flag" `
    -File $PANEL `
    -From "  isProviderGame = false," `
    -To '  gameType = "trading",' `
    -TestName "takes the flag from the server, never a game type it decides for itself"

# 24. The STRICT helper on the page, which is the natural mistake: it compiles, reviews
#     correctly, and hands a keyless provider contest the trading dialogs.
$results += Invoke-Probe `
    -Name "view page uses the strict isProviderContest helper" `
    -File $VIEWPAGE `
    -From "hasProviderGameLabel(competition)" `
    -To "isProviderContest(competition)" `
    -TestName "derives that flag from the LABEL alone on the page that renders it"

# 25. The flag stops being passed at all, so the panel silently falls back to trading copy for
#     every game. No error anywhere - the default is what makes this quiet.
$results += Invoke-Probe `
    -Name "flag not passed to the panel, so every game gets trading copy" `
    -File $VIEWPAGE `
    -From "                  isProviderGame={isProviderGame}" `
    -To "" `
    -TestName "derives that flag from the LABEL alone on the page that renders it"

# 26. A wording pass that only swaps the noun. This is the defect the module exists to make
#     impossible, and it is the one a reviewer would approve.
$results += Invoke-Probe `
    -Name "provider copy is the trading copy with the noun swapped" `
    -File $COPY `
    -From '    "Immediately void ALL rounds still in flight - no score from them will count",' `
    -To '    "Immediately close ALL open positions at current market prices",' `
    -TestName "gives a provider contest genuinely different consequences, not a renamed noun"

# 27. The provider pause list stops mentioning the resume refusal, which is the question an
#     operator will actually ask.
$results += Invoke-Probe `
    -Name "provider pause copy drops the mid-round resume answer" `
    -File $COPY `
    -From '    "Prevent a player resuming a round they already have open",' `
    -To '' `
    -TestName "tells a provider operator that a mid-round player cannot resume"

# 28. The trading copy generalised into vagueness - the reverse direction, which a wording
#     pass aimed only at provider games would never notice.
$results += Invoke-Probe `
    -Name "trading copy quietly generalised so it no longer mentions positions" `
    -File $COPY `
    -From '    "Prevent any positions from being closed",' `
    -To '    "Stop players acting in the contest",' `
    -TestName "gives a provider contest genuinely different consequences, not a renamed noun"

# 28b. The one branched site loses its provider arm, so a provider operator is told about
#      positions again. Reads as correct: the trading arm is the one that was already there.
$results += Invoke-Probe `
    -Name "emergency toast loses its provider arm" `
    -File $PANEL `
    -From @'
        isProviderGame
          ? `Competition emergency cancelled! ${data.details?.voidedRounds || 0} rounds voided, ${data.details?.refundedCount || 0} participants refunded.`
          : `Competition emergency cancelled! ${data.details?.closedPositions || 0} positions closed, ${data.details?.refundedCount || 0} participants refunded.`,
'@ `
    -To @'
        `Competition emergency cancelled! ${data.details?.closedPositions || 0} positions closed, ${data.details?.refundedCount || 0} participants refunded.`,
'@ `
    -TestName "branches the one place trading wording survives"

# 29. The copy module reaches a model, which would break the client bundle - and the failure
#     is a build error, not a wrong answer, so the guard is about keeping it that way.
$results += Invoke-Probe `
    -Name "copy module imports a database model" `
    -File $COPY `
    -From "export interface ContestControlCopy {" `
    -To @'
import Competition from "@/database/models/trading/competition.model";
void Competition;

export interface ContestControlCopy {
'@ `
    -TestName "keeps the wording in a model-free module both sides can import"

Write-Host ""
Write-Host "================ SUMMARY ================" -ForegroundColor Cyan
$results | ForEach-Object {
    $colour = if ($_.Outcome -like "RED*") { "Green" } else { "Red" }
    Write-Host ("{0,-14} {1}" -f $_.Outcome, $_.Name) -ForegroundColor $colour
}
$bad = @($results | Where-Object { $_.Outcome -notlike "RED*" })
Write-Host ""
Write-Host "$($results.Count) probes, $($bad.Count) not red" -ForegroundColor $(if ($bad.Count) { "Red" } else { "Green" })
