# Probes the server-anchored clock, the pre-flight gates and the lobby countdown.
#
# Every recorded probing lesson is applied here, because each one has already produced a false
# result in this repository at least once:
#
#   - `-LiteralPath` on the READ as well as the write. A Next.js dynamic route contains
#     `[roundId]`, which PowerShell parses as a wildcard character class, so `Get-Content $File`
#     returns nothing while `Set-Content` writes it back happily - emptying the file and
#     reporting a confident RED on entirely the wrong grounds.
#   - UTF-8 without a BOM, pinned explicitly. PowerShell 5.1's `Get-Content -Raw` decodes with
#     the system ANSI codepage, so every emoji in a touched file comes back as mojibake and is
#     written back that way. It surfaces two steps later as unexplained typecheck errors.
#   - Refuse to write when the read came back empty, and assert the file actually changed. A
#     probe that fails to apply is indistinguishable from a test that does not work.
#   - Run the expected test ALONE with `-t` and read the summary counts. Searching whole-suite
#     output for the test's name reports RED for a passing test just as readily, because vitest
#     prints the name either way.
#   - Report the whole-suite failure count too. 5-7 tests red for a one-line change is the
#     signal that the probe damaged the file rather than tripping the guard; the honest number
#     is 1 or 2.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/games/provider-play-ui.test.ts'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Relax([string]$literal) { [regex]::Escape($literal) -replace '\r?\n', '\r?\n' }

function Probe {
  param([string]$Name, [string]$File, [string]$Find, [string]$Replace, [string]$ExpectRed)

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

  [System.IO.File]::WriteAllText($path, $patched, $Utf8NoBom)
  try {
    $alone = npx vitest run $SUITE -t $ExpectRed --reporter=dot 2>&1 | Out-String
    $aloneFailed = 0
    if ($alone -match 'Tests\s+(\d+)\s+failed') { $aloneFailed = [int]$Matches[1] }
    $ran = ($alone -match 'Tests\s+') -and ($alone -notmatch 'No test found')

    $whole = npx vitest run $SUITE --reporter=dot 2>&1 | Out-String
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
    $restored = [System.IO.File]::ReadAllText($path, $Utf8NoBom)
    if ($restored -ne $original) {
      Write-Host "  !! RESTORE FAILED for $File - check git diff" -ForegroundColor Red
    }
  }
}

$CLOCK = 'hooks/useServerClock.ts'
$PREFLIGHT = 'components/games/RoundPreflight.tsx'
$HOST_FILE = 'components/games/ProviderRoundHost.tsx'
$LOBBY = 'components/games/ProviderContestLobby.tsx'

Write-Host "`n=== the clock itself ===" -ForegroundColor Cyan

# The negative clamp is the one that reaches a player's eye: the window's end and now cross
# between one tick and the next, so an unclamped difference renders "-1s".
Probe -Name 'formatRemaining does not clamp a past target to zero' `
  -File $CLOCK `
  -Find '  if (ms <= 0) return "0s";' `
  -Replace '  if (ms <= -999999999) return "0s";' `
  -ExpectRed 'formats a remaining duration the way a player reads one'

Probe -Name 'the offset is never applied, so the clock is the browser again' `
  -File $CLOCK `
  -Find '  return now + offsetMs;' `
  -Replace '  return now;' `
  -ExpectRed "anchors to the server's timestamp and fails closed on a bad one"

# An offset of NaN makes every comparison on the pre-flight false, so the countdown freezes and
# every gate silently OPENS - the wrong direction for a screen that spends attempts.
Probe -Name 'an unparseable anchor propagates NaN instead of failing closed' `
  -File $CLOCK `
  -Find '    if (Number.isNaN(parsed)) return;' `
  -Replace '    if (false) return;' `
  -ExpectRed "anchors to the server's timestamp and fails closed on a bad one"

Write-Host "`n=== the pre-flight gates ===" -ForegroundColor Cyan

Probe -Name "the pre-flight goes back to the browser's clock" `
  -File $PREFLIGHT `
  -Find '  const now = useServerClock(state.serverNow);' `
  -Replace '  const now = Date.now();' `
  -ExpectRed 'uses that clock for every gate rather than'

# RE-AIMED 7 SEP 2026, second time. The arithmetic moved into `round-window.ts` so the lobby
# could count down to the same instant, so the comparison here is now `now > cutoffMs`. Aimed at
# the old inline expression this reported DID NOT APPLY, which reads like a broken harness.
Probe -Name 'the too-late-to-start comparison is deleted' `
  -File $PREFLIGHT `
  -Find '    !resuming && cutoffMs !== null && !windowClosed && now > cutoffMs;' `
  -Replace '    false;' `
  -ExpectRed 'blocks Play when a round can no longer finish inside the window'

# A resume reopens the round the player already has and needs no fresh room in the window.
# Without this the gate would refuse to reopen a round the server would happily return.
#
# RE-AIMED 7 SEP 2026. The `!resuming` guard moved onto `fullRoundNoLongerFits` when the start
# policy split the two facts apart; aimed at the old name this reported DID NOT APPLY, which
# reads exactly like a broken harness rather than a moved guard.
Probe -Name 'the gate fires on a resume as well as a fresh launch' `
  -File $PREFLIGHT `
  -Find '  const fullRoundNoLongerFits =
    !resuming &&' `
  -Replace '  const fullRoundNoLongerFits =
    true &&' `
  -ExpectRed 'blocks Play when a round can no longer finish inside the window'

Probe -Name 'the gate no longer reaches the disabled state' `
  -File $PREFLIGHT `
  -Find '    tooLateToStart ||
    exhausted;' `
  -Replace '    exhausted;' `
  -ExpectRed 'blocks Play when a round can no longer finish inside the window'

# The report was a precise UTC timestamp asking the player to subtract two times in their head,
# one of them in a zone they do not live in.
Probe -Name 'the closing countdown reverts to a bare timestamp' `
  -File $PREFLIGHT `
  -Find '                {formatRemaining(windowEndMs - now)}' `
  -Replace '                {new Date(windowEndMs).toUTCString()}' `
  -ExpectRed 'shows a countdown beside the absolute time'

Write-Host "`n=== the auto-refresh ===" -ForegroundColor Cyan

Probe -Name 'the pre-flight refresh interval is removed' `
  -File $HOST_FILE `
  -Find '    }, PREFLIGHT_REFRESH_MS);' `
  -Replace '    }, 0); clearInterval(timer);' `
  -ExpectRed 'refreshes the pre-flight for the facts a clock cannot know'

# Unscoped it runs during `confirming` too, racing the result poll against the same endpoint.
Probe -Name 'the refresh is no longer scoped to the pre-flight' `
  -File $HOST_FILE `
  -Find '    if (phase.name !== "preflight") return;' `
  -Replace '    if (false) return;' `
  -ExpectRed 'refreshes the pre-flight for the facts a clock cannot know'

Write-Host "`n=== the lobby ===" -ForegroundColor Cyan

# The hero's countdown has been there all along, so a bare `<InlineCountdown` match is green on
# the bug. This probe is what proves the test counts them.
# Note the 22-space indent: the hero's copy sits at 18, so this pattern cannot match it. That
# is deliberate - the first-match replacement would otherwise hit the wrong one and the probe
# would report on a guard it never touched.
Probe -Name "the joined player's countdown is removed, leaving only the hero's" `
  -File $LOBBY `
  -Find '                      <InlineCountdown
                        targetDate={new Date(countdownTarget).toISOString()}
                        type={isActive ? "end" : "start"}
                      />' `
  -Replace '                      new Date(countdownTarget).toUTCString()' `
  -ExpectRed 'counts down in the play-window panel'

# RE-AIMED 7 SEP 2026: the note became policy-aware, so the sentence this used to replace no
# longer exists verbatim. The claim under test is unchanged - a false player-facing caution is
# worse than none.
Probe -Name 'the false play-window note comes back' `
  -File $LOBBY `
  -Find '                Every player gets the same window.{" "}' `
  -Replace '                The play window can be narrower than the competition itself.{" "}' `
  -ExpectRed 'no longer tells players the play window can be narrower'

Write-Host "`n=== the round-start policy ===" -ForegroundColor Cyan

# The gate left unconditional, which is the defect the owner reported: a contest shorter than
# the catalogue ceiling withholding Play from the moment it opened.
# RE-AIMED 7 SEP 2026: the comparison moved into `round-window.ts`, so the pre-flight now asks
# rather than deciding. Same claim, one indirection along.
Probe -Name 'the policy is ignored and every contest reserves a full round' `
  -File $PREFLIGHT `
  -Find '  const reservesFullRound = contestReservesFullRound(state.roundStartPolicy);' `
  -Replace '  const reservesFullRound = true;' `
  -ExpectRed 'offers a shortened round instead of refusing, when the contest allows it'

# The disclosure dropped. This is the one that makes the permissive branch indefensible rather
# than merely untidy: an attempt is consumed on creation and cannot be handed back, so a player
# who is not told spends their only attempt on a game they could never finish.
Probe -Name 'the player is not told the round will be shortened' `
  -File $PREFLIGHT `
  -Find '    fullRoundNoLongerFits && !reservesFullRound && windowEndMs !== null
      ? windowEndMs - now
      : null;' `
  -Replace '    null;' `
  -ExpectRed 'tells the player how long they will actually get'

# It reaches the paragraph but not the button - the plausible half-fix, and the button is the
# thing being pressed by somebody who skimmed the paragraph.
Probe -Name 'the shortening never reaches the button label' `
  -File $PREFLIGHT `
  -Find '                      shortenedMs !== null
                      ? "Play a shortened round"' `
  -Replace '                      false
                      ? "Play a shortened round"' `
  -ExpectRed 'tells the player how long they will actually get'

# Read straight off the contest document rather than the normalised config, so a bad stored
# value offers a button `round.service.ts` refuses.
Probe -Name 'the policy is read off the contest instead of the normalised config' `
  -File 'lib/services/games/round-status.service.ts' `
  -Find '          config.config.roundStartPolicy ?? "reserve_full_round",' `
  -Replace '          contest.roundStartPolicy ?? "reserve_full_round",' `
  -ExpectRed "takes the policy from the server's normalised config"

# The client's own copy of PlayState losing the field, which the compiler would catch in the
# component but not in the two field lists agreeing with each other.
Probe -Name "the client's PlayState drops the policy" `
  -File 'components/games/play-state.ts' `
  -Find '  roundStartPolicy: "reserve_full_round" | "until_window_closes";' `
  -Replace '  roundStartPolicyName?: string;' `
  -ExpectRed "is a field on the client's own PlayState"

Write-Host "`n=== the last moment to start, shared by two screens ===" -ForegroundColor Cyan

$WINDOW = 'components/games/round-window.ts'

# The arithmetic wrong in the direction that looks safe: reserving nothing means Play stays
# offered right up to the close, and the server then refuses the click.
Probe -Name 'the cut-off no longer subtracts the round length' `
  -File $WINDOW `
  -Find '  return playWindowEndMs - maxRoundSeconds * 1000;' `
  -Replace '  return playWindowEndMs;' `
  -ExpectRed 'computes the cut-off in one place, and does not know the policy'

# The tempting simplification: fold the policy in and return null for the permissive case. It is
# exactly when the play screen still needs the figure, in order to say how much time is left.
Probe -Name 'the producer learns the policy and answers null for the permissive case' `
  -File $WINDOW `
  -Find '  return roundStartPolicy !== "until_window_closes";' `
  -Replace '  return true;' `
  -ExpectRed 'computes the cut-off in one place, and does not know the policy'

# An absent duration must produce no cut-off rather than a guessed one. Treating it as zero
# gives every contest a cut-off equal to its close, which reads correct and disables nothing.
Probe -Name 'an unknown round length is guessed at rather than declined' `
  -File $WINDOW `
  -Find '  if (typeof maxRoundSeconds !== "number" || !Number.isFinite(maxRoundSeconds)) {
    return null;
  }' `
  -Replace '  if (typeof maxRoundSeconds !== "number") {
    maxRoundSeconds = 0;
  }' `
  -ExpectRed 'produces no cut-off when the round length is unknown'

# The negative half of the extraction: the screen imports the producer and then does the
# subtraction itself anyway, which is exactly what the pre-flight did before the extraction.
Probe -Name 'the pre-flight recomputes the cut-off beside the shared one' `
  -File $PREFLIGHT `
  -Find '  const cutoffMs = fullRoundCutoffMs(windowEndMs, state.maxRoundSeconds);' `
  -Replace '  const cutoffMs =
    windowEndMs !== null && roundNeedsMs !== null ? windowEndMs - roundNeedsMs : null;' `
  -ExpectRed 'is read by both screens and recomputed by neither'

Write-Host "`n=== the lobby's second clock ===" -ForegroundColor Cyan

# The row shown regardless of policy, so a permissive contest is given a deadline it does not
# have and a player leaves believing they have missed it.
Probe -Name "the last-attempt row ignores the contest's policy" `
  -File $LOBBY `
  -Find '                {isActive &&
                  reservesFullRound &&' `
  -Replace '                {isActive &&
                  true &&' `
  -ExpectRed 'shows the lobby countdown only where a cut-off really exists'

# "Ended" instead of "Passed". The contest has NOT ended - only the chance to open a new round
# has, and a player already inside a round may still finish it.
Probe -Name 'the passed cut-off tells the player the contest has ended' `
  -File $LOBBY `
  -Find '                          zeroLabel="Passed"' `
  -Replace '                          zeroLabel="Ended"' `
  -ExpectRed 'shows the lobby countdown only where a cut-off really exists'

# The note stating the permissive consequence under BOTH policies. Under `reserve_full_round` a
# round cannot still be running at the close, so it promises an impossibility and a player
# concludes they may start whenever they like.
Probe -Name 'the play-window note says the same thing under either policy' `
  -File $LOBBY `
  -Find '                {reservesFullRound
                  ? "An attempt has to begin early enough to finish inside it, so the last one starts before the window shuts."
                  : "You can start an attempt at any time until it shuts, and anything still running then is closed with the competition and scored on what you managed."}' `
  -Replace '                {"You can start an attempt at any time until it shuts, and anything still running then is closed with the competition and scored on what you managed."}' `
  -ExpectRed 'tells a joined player what happens to a round still running at the close'

Write-Host "`n=== how long is left to join ===" -ForegroundColor Cyan

$ENTRY = 'components/trading/CompetitionEntryButton.tsx'

# The deadline recomputed in the component. Identical today, and the clamp against `startTime`
# is what keeps the legacy documents joinable - a copy that forgets it tells those players entry
# closed before it opened, while the button stays open.
Probe -Name 'the entry deadline is recomputed instead of shared' `
  -File $ENTRY `
  -Find '  const entryDeadline = resolveRegistrationDeadline(competition);' `
  -Replace '  const entryDeadline = competition.registrationDeadline
    ? new Date(competition.registrationDeadline)
    : null;' `
  -ExpectRed 'counts down to the same instant the gate compares against'

# The countdown shown to somebody already through the door, beside the red panel saying entry
# has closed - two statements about the same fact, contradicting each other.
Probe -Name 'the countdown is shown after the door has already shut' `
  -File $ENTRY `
  -Find '    !isUserIn && !registrationClosed && (isActive || isUpcoming);' `
  -Replace '    !isUserIn;' `
  -ExpectRed 'is withheld from someone who has already joined or already missed it'

# A deadline-free contest silently given no sentence at all. A player who saw a countdown on
# another competition then assumes this one hides a deadline too.
Probe -Name 'a contest with no deadline says nothing rather than saying so' `
  -File $ENTRY `
  -Find '                  Entry stays open for as long as this competition is running.' `
  -Replace '                  {null}' `
  -ExpectRed 'says something different when no deadline is set, rather than nothing'

# `zeroLabel` dropped, so the countdown reaches zero and reads "Ended" - and this page is
# server-rendered, so an open tab cannot learn that `registrationClosed` has flipped.
Probe -Name 'the passed entry deadline reverts to the default wording' `
  -File $ENTRY `
  -Find '                    zeroLabel="Closed"' `
  -Replace '                    className=""' `
  -ExpectRed 'names the moment as well as the remaining time'

# The absolute time removed, leaving a countdown a player cannot write down.
Probe -Name 'the entry deadline loses its absolute time' `
  -File $ENTRY `
  -Find '                    ({entryDeadline.toUTCString()})' `
  -Replace '                    ()' `
  -ExpectRed 'names the moment as well as the remaining time'

# The shared component's default wording changed for every existing caller, which is how an
# additive prop stops being additive.
Probe -Name "InlineCountdown's default zero wording is changed for everyone" `
  -File 'components/trading/InlineCountdown.tsx' `
  -Find '        setCountdown(zeroLabel ?? (type === "start" ? "Started" : "Ended"));' `
  -Replace '        setCountdown(zeroLabel ?? "Closed");' `
  -ExpectRed "keeps the countdown component's default wording for every existing caller"

# The prop left out of the effect's dependencies, so the first render's word sticks.
Probe -Name 'the zero label is not a dependency of the ticking effect' `
  -File 'components/trading/InlineCountdown.tsx' `
  -Find '  }, [targetDate, type, zeroLabel]);' `
  -Replace '  }, [targetDate, type]);' `
  -ExpectRed "keeps the countdown component's default wording for every existing caller"

# `null` replaced by a substituted `startTime`, which silently gives every deadline-free contest
# a door - and `isRegistrationClosed` would then close it.
Probe -Name 'an absent deadline is substituted with the start time' `
  -File 'lib/utils/registration-deadline.ts' `
  -Find '  if (!contest.registrationDeadline) return null;' `
  -Replace '  if (!contest.registrationDeadline) {
    return contest.startTime ? new Date(contest.startTime) : null;
  }' `
  -ExpectRed 'resolves the deadline as a shared instant, with the clamp intact'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
