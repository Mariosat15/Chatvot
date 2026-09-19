# Probes the universal cut-off: the grace-window deferral, the round mark and its ordering.
#
# Same harness as tools/probe-play-clock.ps1 - see that file for why each defence exists.
# Every one of them has already produced a false result in this repository at least once.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/services/provider-round-cutoff.test.ts'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Relax([string]$literal) { [regex]::Escape($literal) -replace '\r?\n', '\r?\n' }

# `Find2`/`Replace2` exist because two guards can cover each other, and then NEITHER can be
# probed alone - removing one leaves the suite green on the strength of the other, which
# reports as "the guard is not working" when both are working. R42 hit the same thing with
# its two game gates. A probe that has to make two edits says so by making them together,
# rather than shipping a green line that teaches the next reader the guard is decoration.
function Probe {
  param([string]$Name, [string]$File, [string]$Find, [string]$Replace, [string]$ExpectRed, [string]$Suite = $SUITE, [string]$Find2, [string]$Replace2)

  $path = Join-Path (Get-Location) $File
  $original = [System.IO.File]::ReadAllText($path, $Utf8NoBom)

  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "  [READ FAILED - REFUSING TO WRITE] $Name" -ForegroundColor Magenta
    return
  }

  $patched = [regex]::Replace($original, (Relax $Find), $Replace.Replace('$', '$$'), 1)
  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] $Name" -ForegroundColor Magenta
    return
  }

  if ($Find2) {
    $twice = [regex]::Replace($patched, (Relax $Find2), $Replace2.Replace('$', '$$'), 1)
    if ($twice -eq $patched) {
      Write-Host "  [SECOND EDIT DID NOT APPLY] $Name" -ForegroundColor Magenta
      return
    }
    $patched = $twice
  }

  [System.IO.File]::WriteAllText($path, $patched, $Utf8NoBom)
  try {
    $alone = npx vitest run $Suite -t $ExpectRed --reporter=dot 2>&1 | Out-String
    $aloneFailed = 0
    if ($alone -match 'Tests\s+(\d+)\s+failed') { $aloneFailed = [int]$Matches[1] }
    $ran = ($alone -match 'Tests\s+') -and ($alone -notmatch 'No test found')

    $whole = npx vitest run $Suite --reporter=dot 2>&1 | Out-String
    $wholeFailed = 0
    if ($whole -match 'Tests\s+(\d+)\s+failed') { $wholeFailed = [int]$Matches[1] }

    if (-not $ran) {
      Write-Host "  [EXPECTED TEST DID NOT RUN - wrong name or wrong suite] $Name" -ForegroundColor Magenta
    } elseif ($aloneFailed -gt 0) {
      Write-Host ("  [RED: expected test failed, {0} red in suite] {1}" -f $wholeFailed, $Name) -ForegroundColor Green
    } else {
      Write-Host ("  [STILL GREEN - GUARD IS NOT WORKING, {0} red in suite] {1}" -f $wholeFailed, $Name) -ForegroundColor Red
    }
  } finally {
    [System.IO.File]::WriteAllText($path, $original, $Utf8NoBom)
    if ([System.IO.File]::ReadAllText($path, $Utf8NoBom) -ne $original) {
      Write-Host "  !! RESTORE FAILED for $File - check git diff" -ForegroundColor Red
    }
  }
}

$FINALIZE = 'lib/services/settlement/provider-finalize.ts'
$CUTOFF = 'lib/services/settlement/round-cutoff.ts'
$CLEANUP = 'lib/services/games/contest-round-cleanup.ts'
$TYPES = 'lib/services/games/round-types.ts'

Write-Host "`n=== the deferral ===" -ForegroundColor Cyan

# Without this the contest settles a minute after the cut-off, discarding the score of
# everyone who finished in the last seconds - the defect the whole slice exists for.
Probe -Name 'settlement no longer defers at all' `
  -File $FINALIZE `
  -Find '    if (cutoff.deferSettlement) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'defers, leaving the contest untouched'

# Comparing the wrong way round defers a contest whose grace has expired and settles one
# whose has not - wrong in both directions, and it reads correctly.
Probe -Name 'the grace comparison is inverted' `
  -File $CUTOFF `
  -Find '  if (now.getTime() < graceEndsAt.getTime()) {' `
  -Replace '  if (now.getTime() > graceEndsAt.getTime()) {' `
  -ExpectRed 'defers, leaving the contest untouched'

# A deferral that pre-emptively closes the round refuses the very result it is waiting for.
Probe -Name 'the deferral runs after the round is closed' `
  -File $FINALIZE `
  -Find '    if (cutoff.deferSettlement) {' `
  -Replace '    if (cutoff.deferSettlement && cutoff.liveRoundCount < 0) {' `
  -ExpectRed 'defers, leaving the contest untouched'

# The gate must sit BEFORE the optimistic claim, or every pass churns the status of a
# contest that is merely waiting.
#
# THE INJECTION IS A CLAIM AND A RELEASE, not a bare write, because that is what a late
# gate actually produces: `active -> finalizing -> active`. The end status is `active`
# either way, so `updatedAt` is the only observable - which is the whole reason the test
# asserts it. A first version of this probe added the write immediately before the lock and
# stayed green, because the deferral returns before ever reaching that line: it probed a
# statement the defect never executes. Same class as every other mis-aimed probe here - it
# was indistinguishable from the guard not working.
Probe -Name 'the gate moves after the claim, so a waiting contest is written' `
  -File $FINALIZE `
  -Find '  if (policyDoc) {' `
  -Replace '  await Competition.updateOne({ _id: competitionId, status: "active" }, { $set: { status: "finalizing" } });
  await Competition.updateOne({ _id: competitionId, status: "finalizing" }, { $set: { status: "active" } });
  if (policyDoc) {' `
  -ExpectRed 'defers, leaving the contest untouched'

Write-Host "`n=== the round mark ===" -ForegroundColor Cyan

Probe -Name 'the live rounds are never closed' `
  -File $FINALIZE `
  -Find '    if (cutoff.liveRoundCount > 0) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'marks the round that never reported UNRESOLVED'

# `voided` is the tidy-looking mistake: it reads as housekeeping and silently overrides all
# three configured policies with "score zero, nothing owed".
Probe -Name 'the round is voided instead of left unresolved' `
  -File $CLEANUP `
  -Find '  cutoff: { status: "unresolved", resultSource: undefined },' `
  -Replace '  cutoff: { status: "voided", resultSource: "manual" },' `
  -ExpectRed 'marks the round that never reported UNRESOLVED'

# Stamping a source claims a human adjudicated a round nobody looked at.
#
# Injected as its own block rather than by loosening the `if`: the first version widened the
# condition to `if (true)` and stayed green, because the body it then ran assigns
# `resultSource` - which is `undefined` on this outcome - straight over the value the probe
# had just set. The probe undid itself one line later.
Probe -Name 'the cut-off stamps a result source it does not have' `
  -File $CLEANUP `
  -Find '    if (resultSource) {' `
  -Replace '    if (!resultSource) {
      round.resultSource = "manual";
      round.resultReceivedAt = new Date();
    }
    if (resultSource) {' `
  -ExpectRed 'marks the round that never reported UNRESOLVED'

# A completed round overwritten by the cut-off destroys a real score.
#
# BOTH GUARDS GO IN ONE EDIT, and finding out why cost a green probe. `ROUND_TRANSITIONS`
# maps `completed` to nothing, so loosening the query alone leaves the reported round
# skipped by the transition check and the suite green. That check is documented in
# `contest-round-cleanup.ts` as unreachable - which is true of the `cancelled` outcome and
# of normal operation, and stops being true the moment the filter is what breaks. So the two
# genuinely cover each other, exactly like R42's pair of game gates, and the honest probe
# removes both rather than reporting that one of them does nothing.
Probe -Name 'the query stops filtering on live statuses AND the transition check is gone' `
  -File $CLEANUP `
  -Find '    status: { $in: LIVE_ROUND_STATUSES },' `
  -Replace '    status: { $nin: ["nothing"] },' `
  -Find2 '    if (!canTransitionRound(round.status as RoundStatus, target)) {' `
  -Replace2 '    if (false) {' `
  -ExpectRed 'marks the round that never reported UNRESOLVED'

Write-Host "`n=== the ordering, which is the subtle half ===" -ForegroundColor Cyan

# Marked inside the settlement transaction, a hold_and_alert abort rolls the mark back and
# every cron pass re-marks, re-blocks and re-rolls-back for ever, with no error anywhere.
Probe -Name 'the mark is written inside the settlement transaction' `
  -File $FINALIZE `
  -Find '      await endLiveRoundsForContest({
        contestId: competitionId,
        outcome: "cutoff",' `
  -Replace '      await Promise.resolve();
      const _skipped = ({
        contestId: competitionId,
        outcome: "cutoff",' `
  -ExpectRed 'leaves the mark DURABLE when the hold policy aborts'

# The hold gate reads rounds sitting at `unresolved`, so assessing BEFORE the mark always
# sees zero and the pre-lock gate lets a held contest through.
#
# THE PROBE REORDERS THE TWO BLOCKS, which is the defect stated exactly. Two earlier
# versions were wrong in the same instructive way. Forcing the policy to `score_zero`
# stayed green, because `settleProviderCompetition` asks the same question again inside the
# transaction and refuses there - so the end status and the error message are identical and
# **neither hold gate can be proven by them.** What differs is whether the contest was ever
# CLAIMED: with the order wrong it goes `active -> finalizing -> active` and `updatedAt`
# moves, which is why the expected test asserts it. Same observable as the deferral probe,
# and the same lesson as the main app's pre-lock hold gate - a guard whose whole value is
# "no write happened" needs a test that can see a write.
Probe -Name 'the hold gate is assessed before the rounds are marked' `
  -File $FINALIZE `
  -Find '    if (cutoff.liveRoundCount > 0) {
      await endLiveRoundsForContest({
        contestId: competitionId,
        outcome: "cutoff",
        reason: `Play closed and the ${cutoff.graceSeconds}s result grace window expired with no result`,
      });
    }

    const held = await assessUnresolvedRounds({
      competitionId,
      storedPolicy: policyDoc.unresolvedRoundPolicy,
    });' `
  -Replace '    const held = await assessUnresolvedRounds({
      competitionId,
      storedPolicy: policyDoc.unresolvedRoundPolicy,
    });

    if (cutoff.liveRoundCount > 0) {
      await endLiveRoundsForContest({
        contestId: competitionId,
        outcome: "cutoff",
        reason: `Play closed and the ${cutoff.graceSeconds}s result grace window expired with no result`,
      });
    }' `
  -ExpectRed 'leaves the mark DURABLE when the hold policy aborts'

Write-Host "`n=== the defaults and the no-regression half ===" -ForegroundColor Cyan

# Zero would settle every pre-field contest instantly at its cut-off - the defect
# reintroduced for exactly the contests least likely to be noticed.
Probe -Name 'an absent grace period resolves to zero rather than the default' `
  -File $CUTOFF `
  -Find '  const graceSeconds = resultGracePeriodSeconds ?? DEFAULT_RESULT_GRACE_SECONDS;' `
  -Replace '  const graceSeconds = resultGracePeriodSeconds ?? 0;' `
  -ExpectRed 'measures grace from the play window end'

Probe -Name 'the shared default is changed, so both apps would disagree' `
  -File $TYPES `
  -Find 'export const DEFAULT_RESULT_GRACE_SECONDS = 600;' `
  -Replace 'export const DEFAULT_RESULT_GRACE_SECONDS = 900;' `
  -ExpectRed 'measures grace from the play window end'

# Waiting on a contest where everybody reported makes every well-behaved contest late.
Probe -Name 'a contest with no live rounds is deferred anyway' `
  -File $CUTOFF `
  -Find '  if (live.length === 0) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'does not defer a contest whose rounds have all reported'

# The early return is what keeps the gate off trading and off pre-field contests.
Probe -Name 'a contest with no play window is assessed anyway' `
  -File $CUTOFF `
  -Find '  if (!playWindowEnd) return NOTHING_TO_WAIT_FOR;' `
  -Replace '  if (!playWindowEnd) playWindowEnd = new Date(0);' `
  -ExpectRed 'is off entirely for a contest with no play window'

Probe -Name 'a bad contest id is passed straight to the query' `
  -File $CUTOFF `
  -Find '  if (!Types.ObjectId.isValid(competitionId)) return NOTHING_TO_WAIT_FOR;' `
  -Replace '  if (false) return NOTHING_TO_WAIT_FOR;' `
  -ExpectRed 'does not throw on an id that is not an ObjectId'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
