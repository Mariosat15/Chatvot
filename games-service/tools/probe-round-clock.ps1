# Probes for the clock the player is shown, and the length they are promised before they start.
#
# THE DEFECT THESE RESTORE, reported by the owner on 10 September 2026: "when a user enters late
# and the time of the competition is less than the game's default time, it must show the time left
# to end the competition, so it is not misleading."
#
# Two numbers were wrong and they are two separate reads, which is why there are two families of
# probe below. `endsAt` drove the live countdown and was the title's own clock from `startedAt`,
# so a ten-minute sprint begun with five minutes of contest left counted down from 10:00 and was
# cut off with 5:00 still on it. `playableSeconds` drove the sentence before Start, and did not
# exist - the panel read the configured length, so the same player was promised ten minutes in
# writing while the platform's own pre-flight screen, one click earlier, said five.
#
# Every probe here restores a defect that either WAS in the file or is the obvious over-correction
# of it. The over-correction probes are the ones that matter most: "report the contest's remaining
# time" fixes the reported case and lies harder in the other direction, telling a player with an
# hour of contest left that a two-minute sprint lasts an hour.
#
# Run with: npm run probe:round-clock

$ErrorActionPreference = 'Continue'
Set-Location (Split-Path -Parent $PSScriptRoot)
. "$PSScriptRoot/probe-harness.ps1"

$SuitePlay = 'tools/test-play.ts'
$SuitePresentation = 'tools/test-presentation.ts'

$srcState = 'src/rounds/play.ts'
$srcLifecycle = 'src/rounds/lifecycle.ts'
$srcPresentation = 'public/play/presentation.js'

$results = @()

Write-Host ""
Write-Host "The clock the player watches" -ForegroundColor Cyan

# THE ORIGINAL DEFECT, restored exactly. `gameplayEndsAt(round)` is `startedAt` plus the title's
# own length, which ignores the contest window entirely.
#
# Written as the inline arithmetic rather than by calling `gameplayEndsAt`, because that import was
# removed with the fix - and an undefined identifier crashes the suite on its first test, which the
# harness reports as DID-NOT-APPLY. A probe that takes the suite down tells you nothing about the
# guard. This expression is that function's body, character for character.
$results += Invoke-Probe -Name 'the countdown goes back to the title clock, ignoring the contest' `
  -Suite $SuitePlay -File $srcState `
  -Find '  const endsAt = round.startedAt ? hardDeadline(round) : null;' `
  -Replace '  const endsAt = round.startedAt
    ? new Date(round.startedAt.getTime() + roundDurationMs(config))
    : null;' `
  -ExpectRed "a round the contest will cut short counts down to the contest, not the title's clock"

Write-Host ""
Write-Host "The length promised before Start" -ForegroundColor Cyan

# The promise going back to the configured length - the half the player reads in words rather than
# watches tick, and the half that had no field at all before this fix.
#
# Declared at 2: a Perfect round inside a 90-second window is then promised its full 300, so the
# fixed-set test fails on the same one-line change. One rule, two titles.
$results += Invoke-Probe -Name 'the promise goes back to the length the title asks for' `
  -Suite $SuitePlay -File $srcState `
  -Find '  state.playableSeconds = playableSeconds(round);' `
  -Replace '  state.playableSeconds = Math.floor(roundDurationMs(config) / 1000);' `
  -ExpectRed 'the length promised before Start is the length the server will honour'

# THE OVER-CORRECTION, and the reason the control test exists. Reporting the contest's remaining
# time satisfies the owner's report and every probe above it, while telling a player with an hour
# of contest left that a two-minute sprint runs for an hour.
#
# Declared at 2: it also shrinks on every poll, which is the anchoring test.
$results += Invoke-Probe -Name 'the promise becomes the whole rest of the contest' `
  -Suite $SuitePlay -File $srcState `
  -Find '  state.playableSeconds = playableSeconds(round);' `
  -Replace '  state.playableSeconds = Math.max(
    0,
    Math.floor((round.expiresAt.getTime() - Date.now()) / 1000),
  );' `
  -ExpectRed 'a round with the whole window ahead of it promises its full length'

# The anchor. Measured from `now` throughout, a player who refreshes watches the round they were
# granted getting shorter - which reads as the game taking time off them, and is the shape of
# complaint nobody who is not watching that same round can reproduce.
$results += Invoke-Probe -Name 'the promise is re-measured from now on every poll' `
  -Suite $SuitePlay -File $srcLifecycle `
  -Find '  const anchor = round.startedAt ?? now;' `
  -Replace '  const anchor = now;' `
  -ExpectRed 'the promised length stops moving once the clock is running'

# A fixed-set title has no clock in its rules, so its intro leads on the board count and says
# nothing about time - which is exactly why it was easy to miss that the contest cuts a Perfect
# round short as readily as a sprint. With no length on the state the client has nothing to
# compare, so it cannot notice.
$results += Invoke-Probe -Name 'only the timed title reports a length, so Perfect cannot notice' `
  -Suite $SuitePlay -File $srcState `
  -Find '  state.durationSeconds = Math.floor(roundDurationMs(config) / 1000);' `
  -Replace '  if (config.kind === "sprint") state.durationSeconds = config.durationSeconds;' `
  -ExpectRed 'a fixed-set title reports a length too, so it can notice being cut short'

Write-Host ""
Write-Host "The words the player actually reads" -ForegroundColor Cyan

# The client half of the original defect: the state now carries the truth and the panel still reads
# the title's length. Worth its own probe because the server and the client fail independently - a
# correct state rendered by a panel that ignores it is the same lie.
#
# Declared at 2: the zero test also asserts the title's length never appears.
$results += Invoke-Probe -Name 'the panel reads the title length instead of the promise' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '      `You have ${formatDuration(granted)}` +' `
  -Replace '      `You have ${formatDuration(nominal)}` +' `
  -ExpectRed "the length stated is the one the player will get, not the title's own"

# The reason, dropped. "You have five minutes" on a title the player knows is a ten-minute game
# reads as a fault in the game rather than as the contest running out - so they either report it or
# distrust the contest, and both are worse than the sentence.
$results += Invoke-Probe -Name 'the panel states the short length without saying why' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '      (cutShort ? ", which is all that is left before the competition closes" : "") +' `
  -Replace '      "" +' `
  -ExpectRed "the length stated is the one the player will get, not the title's own"

# The over-correction in the copy: blame the contest on every round. Every player of every
# full-length round is then told their time is being taken away.
#
# Declared at 3, and all three are honest - the sprint control, the fixed-set control, and the
# legacy state carrying no promise at all. One rule, three of the four cases it decides.
$results += Invoke-Probe -Name 'every round is described as cut short by the contest' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  const cutShort = granted !== null && nominal !== null && granted < nominal;' `
  -Replace '  const cutShort = true;' `
  -ExpectRed 'a round that is not being cut short says nothing about the competition' -MaxRed 3

# The fixed-set sentence removed. That branch cannot be corrected by changing a number, because it
# quotes none - a player with two minutes left is simply told to finish three boards.
$results += Invoke-Probe -Name 'a fixed-set round is never told the contest is closing' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '    if (cutShort && positive(granted)) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'a fixed-set title is told about the contest separately, or not at all'

# The falsy fallback, which looks defensive and reinstates the promise the server cannot keep.
# Zero is reachable: the window can close between the state being read and the panel being drawn.
$results += Invoke-Probe -Name 'a promised length of zero falls back to the title length' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  const granted =
    typeof playableSeconds === "number" &&
    Number.isFinite(playableSeconds) &&
    playableSeconds >= 0
      ? Math.floor(playableSeconds)
      : nominal;' `
  -Replace '  const granted = positive(playableSeconds) ? Math.floor(playableSeconds) : nominal;' `
  -ExpectRed 'a promised length of zero is honoured rather than falling back'

# ------------------------------------------------------------------------------------------------
# ONE PROBE IS DELIBERATELY ABSENT, with its reason here rather than as a probe that reports GREEN.
#
# `playableSeconds` floors rather than rounds, so it can never overstate. No test can see the
# difference: the only fixture that distinguishes the two is one whose remaining time has a
# fractional part large enough to cross a second boundary, and asserting on that is asserting on
# the clock the suite itself is running against. It is a one-line property with a comment beside
# it, and a probe reporting GREEN here would teach the next reader that the floor is decoration.
# ------------------------------------------------------------------------------------------------

Write-ProbeSummary $results
