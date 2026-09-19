# Probes for the two things that keep a contest lobby from being a photograph.
#
# THE DEFECT THESE RESTORE, reported by the owner on 10 September 2026: standings that do not
# move during a running contest, and a Play button that needs a page reload to appear.
#
# Conventions carried from the earlier harnesses in this folder, each of which cost a false
# result once:
#
#   * UTF-8 WITHOUT a BOM on the read AND the write. PowerShell 5.1's `Get-Content -Raw` decodes
#     with the system ANSI codepage, which mangles every emoji in the touched file and writes the
#     mojibake back - it surfaces two steps later as unexplained typecheck errors.
#   * `-LiteralPath` on both. THIS FILE IS THE CASE THAT RULE EXISTS FOR: the page under probe is
#     `app/(root)/competitions/[id]/page.tsx`, and PowerShell parses `[id]` as a wildcard
#     character class. A read that silently matches nothing plus a write that does not is how a
#     route file gets emptied and "restored" to nothing.
#   * Refuse to write when the read came back empty.
#   * Relax newlines in the pattern, because a CRLF pattern never matches an LF file - and a
#     probe that fails to apply is indistinguishable from a test that does not work.
#   * Run the expected test ALONE with `-t` and read the summary counts. Searching whole-suite
#     output for a test's name reports RED for a passing test just as readily.
#
# ONE THING SPECIFIC TO THIS SLICE. The two mounts differ only by indentation - ten spaces in the
# game branch, eight in the trading one - and the game branch comes first in the file. Every
# pattern below therefore carries its exact leading whitespace, and the replacement count is one,
# so each probe hits the branch it names. A pattern written without the indentation would silently
# always hit the game branch and the two "other direction" probes would be testing nothing.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Suite = '__tests__/games/live-contest-refresh.test.ts'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Source([string]$Path) {
  [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false))
}

function Write-Source([string]$Path, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) {
    throw "refusing to write an empty file to $Path"
  }
  [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function To-Relaxed([string]$Literal) {
  [regex]::Escape($Literal) -replace '(\\r)?\\n', '\r?\n'
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectTest
  )

  $path = Join-Path $Root $File
  $original = Read-Source $path
  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "[$Name] UNREADABLE - $File came back empty, refusing to probe" -ForegroundColor Magenta
    return
  }

  $mutated = [regex]::Replace($original, (To-Relaxed $Find), { param($m) $Replace }, 1)

  if ($mutated -eq $original) {
    Write-Host "[$Name] DID NOT APPLY - the target moved, so nothing was tested" -ForegroundColor Magenta
    return
  }

  Write-Source $path $mutated
  try {
    $out = & npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String
    # Collapse whitespace: `Out-String` wraps at the console width, so a long line arrives split.
    $flat = ($out -replace '\s+', ' ')
    if ($flat -match 'Tests\s+(\d+)\s+failed') {
      $failed = [int]$Matches[1]
      if ($failed -eq 1) {
        Write-Host "[$Name] RED (1 failure, as expected)" -ForegroundColor Green
      } else {
        Write-Host "[$Name] RED but $failed failures - blast radius, check the probe" -ForegroundColor Yellow
      }
    } elseif ($flat -match 'No test found') {
      Write-Host "[$Name] NO TEST RAN - the expected test name is wrong" -ForegroundColor Magenta
    } else {
      Write-Host "[$Name] GREEN - the guard is absent, weak, unreachable, or changes no observable" -ForegroundColor Red
    }
  } finally {
    Write-Source $path $original
  }
}

$LobbyPage = 'app/(root)/competitions/[id]/page.tsx'
$PlayPage = 'app/(root)/competitions/[id]/play/page.tsx'
$Refresher = 'components/competitions/LiveContestRefresher.tsx'

Write-Host "`n=== The Play button: noticing that the contest started ===" -ForegroundColor Cyan

# 1. THE ACTUAL DEFECT, restored exactly: the game branch returns without the status monitor,
#    which is the state the file was in from the day the branch was written.
Invoke-Probe -Name 'game branch loses the status monitor' `
  -File $LobbyPage `
  -Find '          <CompetitionStatusMonitor
            competitionId={id}
            initialStatus={competition.status}
            startTime={competition.startTime}
            userId={userId}
          />' `
  -Replace '' `
  -ExpectTest 'the status monitor is mounted on both branches, not just trading'

# 2. THE OTHER DIRECTION, and it is not redundant. The count is the assertion that caught the
#    original defect, and a count is only trustworthy if it fails whichever side goes missing -
#    a guard written as "the game branch has one" would be perfectly green while the trading
#    lobby silently lost the same component.
Invoke-Probe -Name 'trading branch loses the status monitor' `
  -File $LobbyPage `
  -Find '        <CompetitionStatusMonitor
          competitionId={id}
          initialStatus={competition.status}
          startTime={competition.startTime}
          userId={userId}
        />' `
  -Replace '' `
  -ExpectTest 'the status monitor is mounted on both branches, not just trading'

# 3. Mounted, but handed the wrong clock. The monitor's adaptive interval is computed from
#    `startTime`, so this leaves a player watching the countdown on the slowest 30-second
#    cadence at the one moment they are staring at it - and the component is present, so every
#    presence check is green.
Invoke-Probe -Name 'the monitor is given the end time instead of the start' `
  -File $LobbyPage `
  -Find '            startTime={competition.startTime}
            userId={userId}' `
  -Replace '            startTime={competition.endTime}
            userId={userId}' `
  -ExpectTest 'the monitor is given the contest'

Write-Host "`n=== Live standings during a running contest ===" -ForegroundColor Cyan

# 4. The game branch loses the refresher - the second half of the owner's report.
Invoke-Probe -Name 'game branch loses the refresher' `
  -File $LobbyPage `
  -Find '          <LiveContestRefresher active={competition.status === "active"} />' `
  -Replace '' `
  -ExpectTest 'the refresher is mounted on both branches'

# 5. The trading branch loses it. Same argument as probe 2.
Invoke-Probe -Name 'trading branch loses the refresher' `
  -File $LobbyPage `
  -Find '        <LiveContestRefresher active={competition.status === "active"} />' `
  -Replace '' `
  -ExpectTest 'the refresher is mounted on both branches'

# 6. Running decided by a clock in the browser rather than by the stored status.
#
#    This is the mutation most likely to be made deliberately, because it reads as more accurate:
#    why keep refreshing a contest whose end time has passed? Because it is still `active` until
#    a cron finalizes it, so the board freezes exactly while the last rounds are being scored.
Invoke-Probe -Name 'running computed from the end time' `
  -File $LobbyPage `
  -Find '          <LiveContestRefresher active={competition.status === "active"} />' `
  -Replace '          <LiveContestRefresher active={new Date(competition.endTime) > new Date()} />' `
  -ExpectTest 'running is read from the stored status and never computed from a date'

Write-Host "`n=== The play screen, deliberately left alone ===" -ForegroundColor Cyan

# 7. THE PROBE FOR THE LOAD-BEARING NEGATIVE ASSERTION.
#
#    Mounting the refresher on the play page is the obvious next step for anybody fixing that
#    screen's own stale sidebar, which is a real and separately-recorded gap. It calls
#    `router.refresh()` on a timer underneath a live round in an iframe, so the harm is an
#    attempt somebody paid for, failing intermittently and unreproducibly.
Invoke-Probe -Name 'the refresher is mounted on the play page' `
  -File $PlayPage `
  -Find 'export default async function PlayPage' `
  -Replace 'import LiveContestRefresher from "@/components/competitions/LiveContestRefresher";

export default async function PlayPage' `
  -ExpectTest 'the refresher is not mounted on the play page'

Write-Host "`n=== The refresher itself ===" -ForegroundColor Cyan

# 8. The early return dropped, so a finished contest keeps re-rendering itself for ever - on a
#    page whose content cannot change again.
Invoke-Probe -Name 'it refreshes a contest that is not running' `
  -File $Refresher `
  -Find '    if (!active) return;' `
  -Replace '    if (false) return;' `
  -ExpectTest 'it does nothing at all when the contest is not running'

# 9. The teardown dropped. A leaked interval calls `router.refresh()` for the rest of the
#    session, on every page the player visits afterwards, costing a server render each time with
#    nothing on screen to suggest where it is coming from.
Invoke-Probe -Name 'the timer outlives the component' `
  -File $Refresher `
  -Find '    return () => {
      clearTimer();
      document.removeEventListener("visibilitychange", handleVisibility);
    };' `
  -Replace '    return undefined;' `
  -ExpectTest 'it tears its timer down when unmounted'

# 10. Visibility gating never attached: server work for a tab nobody is reading, and no
#     immediate refresh for a player who has just come back to a stale board.
#
#     THIS PROBE CAME BACK GREEN THE FIRST TIME AND THE TEST WAS THE THING AT FAULT. It matched
#     a bare `visibilitychange`, which the TEARDOWN line satisfies on its own - so the listener
#     could be left unattached with every assertion passing. The test now names
#     `addEventListener` and `removeEventListener` separately.
Invoke-Probe -Name 'the visibility listener is never attached' `
  -File $Refresher `
  -Find '    document.addEventListener("visibilitychange", handleVisibility);' `
  -Replace '' `
  -ExpectTest 'it stops while the tab is hidden and refreshes on the way back'

# 11. Attached, and only half a handler: it resumes on the way back and never stops on the way
#     out, which is the direction nobody testing by hand would notice.
Invoke-Probe -Name 'hidden is observed but the timer keeps running' `
  -File $Refresher `
  -Find '      } else {
        clearTimer();
      }' `
  -Replace '      }' `
  -ExpectTest 'becoming hidden actually stops the timer'

# 11. A second answer added beside the first. This is the shape the test exists for: not that
#     `router.refresh()` disappears, but that a fetch appears NEXT TO it - which is how a second
#     reader of the ranking rule gets introduced while every positive assertion stays green.
Invoke-Probe -Name 'a second reader of the ranking is added alongside' `
  -File $Refresher `
  -Find '      timerRef.current = setInterval(() => router.refresh(), intervalMs);' `
  -Replace '      timerRef.current = setInterval(() => {
        void fetch("/api/competitions/leaderboard");
        router.refresh();
      }, intervalMs);' `
  -ExpectTest 'it refreshes the page rather than fetching a second answer of its own'

Write-Host ""
