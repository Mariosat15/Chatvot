# Probes for "show what each player solved or progress according to game".
#
# WHAT THIS SLICE DID, 11 September 2026: the owner rejected the arena as not matching their
# reference and added a requirement the previous pass had no answer to - the standings must say
# what each player has been doing, not only who is ahead. `game_round` has carried the game's
# own `scoreBreakdown` since X3 and nothing had ever read it onto a screen.
#
# THE TWO CLAIMS WORTH PROBING are that the answer comes from the GAME rather than from us, and
# that a round which earned no score never contributes one. Everything else here is markup.
#
# Conventions carried from the earlier harnesses in this folder, each of which cost a false
# result once:
#
#   * UTF-8 WITHOUT a BOM on the read AND the write. PowerShell 5.1's `Get-Content -Raw` decodes
#     with the system ANSI codepage and writes the mojibake back.
#   * `-LiteralPath` semantics via `System.IO.File`, because a Next.js dynamic route's path
#     contains `[id]` and PowerShell parses that as a wildcard character class.
#   * Refuse to write when the read came back empty.
#   * Relax newlines in the pattern - a CRLF pattern never matches an LF file, and a probe that
#     fails to apply is indistinguishable from a test that does not work.
#   * Run the expected test ALONE with `-t` and read the summary counts.
#   * DID NOT APPLY means the target moved, never that the run was quiet.
#
# ONE CONVENTION SPECIFIC TO THIS HARNESS: vitest's `-t` is a REGULAR EXPRESSION, and the
# status-copy test is an `it.each` whose names interpolate a status. Those are plain ASCII
# words, so they are safe - but do not add a probe whose expected name contains a bracket.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Suite = '__tests__/games/contest-activity.test.ts'

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

$Service = 'lib/services/games/contest-activity.service.ts'
$Scoring = 'lib/services/games/participant-score.service.ts'
$Phrase = 'lib/utils/round-activity.ts'
$Board = 'components/games/ProviderLeaderboard.tsx'

Write-Host ''
Write-Host '=== A round that earned nothing contributes nothing ===' -ForegroundColor Cyan

# THE ONE THAT MATTERS. A `voided` round stores `rawScore: 0` deliberately - it is what is left
# after a support action, not something a player did. Take the nought at face value and an
# operator's intervention becomes a result; on a lower-is-better title it sorts FIRST.
Invoke-Probe -Name 'a voided nought is taken at face value' -File $Service `
  -Find '      roundContributesScore(row.status) && Number.isFinite(row.rawScore)' `
  -Replace '      Number.isFinite(row.rawScore)' `
  -ExpectTest 'withholds the score from a round that did not earn one'

# The other side of the same rule, and it must fail independently: `expired` is the ORDINARY
# ending for a player still going at the final whistle, and R48 makes that run count.
Invoke-Probe -Name 'a run cut short by the clock is discarded' -File $Scoring `
  -Find '  ...SCORE_PRODUCING_ROUND_STATUSES,' `
  -Replace '  "completed",' `
  -ExpectTest 'keeps the score from a run the clock cut short'

Write-Host ''
Write-Host '=== The read is scoped, ranked and current ===' -ForegroundColor Cyan

# A practice round is free, unranked and prize-less. Counting one puts a rehearsal on a money
# leaderboard.
Invoke-Probe -Name 'practice rounds are counted' -File $Service `
  -Find '    userId: { $in: userIds },
    mode: "ranked",' `
  -Replace '    userId: { $in: userIds },' `
  -ExpectTest 'ignores practice rounds'

# The board supplies the user list, so an unscoped read grows with the contest for ever and
# reports somebody the standings beside it never mention.
Invoke-Probe -Name 'the read is not scoped to the board' -File $Service `
  -Find '    userId: { $in: userIds },
    mode: "ranked",' `
  -Replace '    mode: "ranked",' `
  -ExpectTest 'returns nobody who was not asked about'

# `attemptNumber: -1` is what makes the first row per player the latest one. Ascending, the
# board shows a player's FIRST attempt for ever while every figure still renders.
Invoke-Probe -Name 'the earliest attempt wins instead of the latest' -File $Service `
  -Find '.sort({ attemptNumber: -1 })' `
  -Replace '.sort({ attemptNumber: 1 })' `
  -ExpectTest 'reports the latest attempt per player, not the first'

Write-Host ''
Write-Host '=== The words describe the round honestly ===' -ForegroundColor Cyan

Invoke-Probe -Name 'the attempt number is never filled in' -File $Phrase `
  -Find 'headline: copy.headline.replace("%d", String(activity.attemptNumber)),' `
  -Replace 'headline: copy.headline,' `
  -ExpectTest 'names the attempt a player finished'

# Blaming the player for the clock is a false statement about the most common way a round ends.
Invoke-Probe -Name 'running out of time is blamed on the player' -File $Phrase `
  -Find '["expired", { headline: "Time ran out", tone: "lapsed" as const }],' `
  -Replace '["expired", { headline: "Gave up", tone: "lapsed" as const }],' `
  -ExpectTest 'describes the clock rather than the player when time runs out'

# `ROUND_STATUSES` is an add-only Mongoose enum, so the test reads the list rather than naming
# seven strings. Dropping one must be caught.
Invoke-Probe -Name 'a status loses its wording' -File $Phrase `
  -Find '["voided", { headline: "Attempt cancelled", tone: "idle" as const }],' `
  -Replace '' `
  -ExpectTest 'says something specific about voided'

Invoke-Probe -Name 'a player who has not played is described as one who has' -File $Phrase `
  -Find '  headline: "Not played yet",' `
  -Replace '  headline: "In progress",' `
  -ExpectTest 'says a player has not played rather than inventing a round'

Write-Host ''
Write-Host '=== The metrics are the game''s, not ours ===' -ForegroundColor Cyan

# Sorting the breakdown is the tidy-looking change and it overrides the provider's own ordering
# of their own metrics, silently, on every title at once.
Invoke-Probe -Name 'the metrics are reordered' -File $Phrase `
  -Find '    .filter(([, value]) => isRenderable(value))' `
  -Replace '    .filter(([, value]) => isRenderable(value))
    .sort((a, b) => a[0].localeCompare(b[0]))' `
  -ExpectTest 'keeps the metrics in the order the game declared them'

# `isRenderable` is a renderability test, not a preference. Accepting everything puts a JSON
# dump of a nested object on a leaderboard row, and the word "NaN" beside a player's name.
Invoke-Probe -Name 'anything at all is rendered' -File $Phrase `
  -Find 'function isRenderable(value: unknown): boolean {' `
  -Replace 'function isRenderable(value: unknown): boolean {
  return value !== undefined;' `
  -ExpectTest 'drops values a screen cannot render, and keeps a genuine zero'

Write-Host ''
Write-Host '=== Nothing here knows what game it is describing ===' -ForegroundColor Cyan

# THE ONE FAILURE MODE OF THE "NO ADDITIONAL CODING" CLAIM. A nicer label for one game's metric
# reads as an improvement and leaves the next title's metrics unlabelled.
Invoke-Probe -Name 'a metric gets a hand-written label' -File $Phrase `
  -Find 'const NOT_PLAYED: RoundActivityPhrase = {' `
  -Replace 'const NICER: Record<string, string> = { boardsCompleted: "Boards" };

const NOT_PLAYED: RoundActivityPhrase = {' `
  -ExpectTest 'lib/utils/round-activity.ts mentions no game and no game metric'

# Which rounds earned a score is decided once, in the service. Two copies is how one screen
# credits a voided round while the screen beside it does not.
Invoke-Probe -Name 'a component re-decides which rounds scored' -File $Board `
  -Find 'import {
  describeRoundActivity,' `
  -Replace 'import { roundContributesScore } from "@/lib/services/games/participant-score.service";
import {
  describeRoundActivity,' `
  -ExpectTest 'decides which rounds earned a score once, in the service'

Write-Host ''
Write-Host '=== The attempt clock says what it knows and nothing else ===' -ForegroundColor Cyan

# A voided attempt was handed back, so its duration is the residue of a support action. Left in,
# a cancelled round shows a time beside a dash where its score should be.
Invoke-Probe -Name 'a cancelled attempt still reports a time' -File $Service `
  -Find '  if (row.status === "voided") return undefined;' `
  -Replace '' `
  -ExpectTest 'reports no clock at all for a cancelled attempt'

# Without the live branch the Time column is empty for every player in a contest that is being
# played, which is exactly when somebody is reading it.
Invoke-Probe -Name 'a player still at the board has no clock' -File $Service `
  -Find '  if (!LIVE_STATUSES.has(row.status)) return undefined;' `
  -Replace '  return undefined;' `
  -ExpectTest 'reports a running clock for a player who is still at the board'

# The game measured the round; `completedAt - startedAt` includes however long the player read
# the rules for, and is the figure we can compute rather than the one that is true.
Invoke-Probe -Name 'our own timestamps are subtracted instead' -File $Service `
  -Find '  if (typeof row.durationMs === "number" && Number.isFinite(row.durationMs)) {
    return row.durationMs;
  }' `
  -Replace '  if (row.startedAt && row.completedAt) {
    return row.completedAt.getTime() - row.startedAt.getTime();
  }' `
  -ExpectTest 'reports the clock the game measured for a finished attempt'

# Rounding up shows a moment the player had not reached. On a lower-is-better title that is a
# figure slightly worse than the one they earned, beside a score that is exactly right.
Invoke-Probe -Name 'the seconds are rounded rather than floored' -File $Phrase `
  -Find '  const totalSeconds = Math.floor(ms / 1000);' `
  -Replace '  const totalSeconds = Math.round(ms / 1000);' `
  -ExpectTest 'floors the seconds rather than rounding them up'

# `0:00` reads as an instantaneous round rather than an unknown one - R50 one field along.
Invoke-Probe -Name 'an unknown clock renders as zero' -File $Phrase `
  -Find '  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return undefined;' `
  -Replace '  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return "0:00";' `
  -ExpectTest 'answers nothing for a figure it cannot show, and never zero'

# Importing the formatter is trivially satisfied by a board that does the arithmetic anyway.
Invoke-Probe -Name 'a board rolls its own stopwatch' -File $Board `
  -Find '          const clock = formatRoundClock(entry?.durationMs);' `
  -Replace '          const secs = Math.floor((entry?.durationMs ?? 0) / 1000);
          const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;' `
  -ExpectTest 'formats an attempt.s clock in one place'

Write-Host ''
Write-Host 'Done. Every probe above must read RED with exactly 1 failure.' -ForegroundColor Cyan
Write-Host 'GREEN means the guard is absent, weak, unreachable, or the mutation changed no observable.' -ForegroundColor DarkGray
