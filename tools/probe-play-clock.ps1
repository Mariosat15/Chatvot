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

Probe -Name 'the too-late-to-start arithmetic is deleted' `
  -File $PREFLIGHT `
  -Find '    now + roundNeedsMs > windowEndMs;' `
  -Replace '    false;' `
  -ExpectRed 'blocks Play when a round can no longer finish inside the window'

# A resume reopens the round the player already has and needs no fresh room in the window.
# Without this the gate would refuse to reopen a round the server would happily return.
Probe -Name 'the gate fires on a resume as well as a fresh launch' `
  -File $PREFLIGHT `
  -Find '  const tooLateToStart =
    !resuming &&' `
  -Replace '  const tooLateToStart =
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

Probe -Name 'the false play-window note comes back' `
  -File $LOBBY `
  -Find '                Every player gets the same window. Any round still open when it
                closes is closed with the competition, and the scores stand as
                they were.' `
  -Replace '                The play window can be narrower than the competition itself, so
                check both.' `
  -ExpectRed 'no longer tells players the play window can be narrower'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
