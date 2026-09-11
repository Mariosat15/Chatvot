# Probes for the shared four-cell contest countdown.
#
# WHAT THIS SLICE DID, 10 September 2026: the owner asked for the game lobby's clock to have
# "the same graphics as the counter in trading competition countdown". The trading lobby's
# four-cell panel was lifted into `components/competitions/CountdownPanel.tsx` and the game
# lobby now renders it through `ContestCountdown`, which runs on the SERVER's clock while
# trading deliberately stays on the browser's.
#
# So the probes fall into three groups, and the middle one is the easiest to get wrong:
#
#   * ONE DEFINITION - a consumer that hand-rolls the panel beside importing it.
#   * THE TWO CLOCKS - trading moved onto the server's, or the game moved onto the browser's.
#     Both read as tidying up. Both are behaviour changes to a screen nobody was asked to touch.
#   * THE ARITHMETIC - a negative cell, a wall of NaN, a unit carrying across a boundary.
#
# Conventions carried from the earlier harnesses in this folder, each of which cost a false
# result once:
#
#   * UTF-8 WITHOUT a BOM on the read AND the write. PowerShell 5.1's `Get-Content -Raw` decodes
#     with the system ANSI codepage, which mangles every emoji in the touched file and writes the
#     mojibake back - it surfaces two steps later as unexplained typecheck errors.
#   * `-LiteralPath` semantics via `System.IO.File`, because a path containing `[id]` is parsed
#     by PowerShell as a wildcard character class. No file here has one, but the harness is
#     copied between slices and the day it matters is the day the route file gets emptied.
#   * Refuse to write when the read came back empty.
#   * Relax newlines in the pattern, because a CRLF pattern never matches an LF file - and a
#     probe that fails to apply is indistinguishable from a test that does not work.
#   * Run the expected test ALONE with `-t` and read the summary counts. Searching whole-suite
#     output for a test's name reports RED for a passing test just as readily.
#   * DID NOT APPLY means the target moved, never that the run was quiet. Two probes in the
#     play-shape harness sat unapplied for a day after `resolvePlayMode` was rewritten, so two
#     real guards were unprobed while the harness looked healthy.
#
# ONE THING SPECIFIC TO THIS SLICE. `{countdownTarget && !isCompleted && !isCancelled && (`
# appears TWICE in the game lobby - once for this panel and once for the play-window row's
# inline countdown, which was already there. Every pattern below that touches the guard carries
# `<ContestCountdown` with it, so a probe cannot silently land on the older one and report on a
# guard it was not aiming at.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Suite = '__tests__/games/contest-countdown.test.ts'

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

$Panel = 'components/competitions/CountdownPanel.tsx'
$Live = 'components/trading/LiveCountdown.tsx'
$Game = 'components/games/ContestCountdown.tsx'
$Lobby = 'components/games/ProviderContestLobby.tsx'

Write-Host ''
Write-Host '=== One definition of the panel ===' -ForegroundColor Cyan

# The failure the negative assertion exists for: a screen that imports the shared panel AND
# draws its own cells beside it. The positive half - "does it import the panel" - is green here.
Invoke-Probe -Name 'hand-rolls the grid beside importing it' -File $Game `
  -Find "  return (
    <CountdownPanel" `
  -Replace "  const spare = <div className=`"grid grid-cols-4 gap-2`">{null}</div>;
  void spare;
  return (
    <CountdownPanel" `
  -ExpectTest 'is hand-rolled by no screen that renders it'

Invoke-Probe -Name 'reaches the panel by some other path' -File $Game `
  -Find 'import CountdownPanel from "@/components/competitions/CountdownPanel";' `
  -Replace 'import CountdownPanel from "../competitions/CountdownPanel";' `
  -ExpectTest 'is reached by both lobbies through the shared module'

Write-Host ''
Write-Host '=== The game lobby mounts it, once, in the right place ===' -ForegroundColor Cyan

Invoke-Probe -Name 'the clock is never mounted' -File $Lobby `
  -Find "          {countdownTarget && !isCompleted && !isCancelled && (
            <ContestCountdown
              target={countdownTarget}
              serverNow={state?.serverNow}
              label={isActive ? `"Time remaining`" : `"Competition starts in`"}
              variant={isActive ? `"end`" : `"start`"}
            />
          )}
" `
  -Replace '' `
  -ExpectTest "sits where the trading lobby's sits"

# A second block - one per contest state, which is how the trading sidebar is written - gives
# this screen two chances to count down to different moments. Injected AFTER the real one, so
# the guard probe below still finds the guarded occurrence first.
Invoke-Probe -Name 'mounted twice, one per state' -File $Lobby `
  -Find "              variant={isActive ? `"end`" : `"start`"}
            />
          )}
" `
  -Replace "              variant={isActive ? `"end`" : `"start`"}
            />
          )}
          {isActive && (
            <ContestCountdown target={countdownTarget} serverNow={state?.serverNow} label=`"Time remaining`" variant=`"end`" />
          )}
" `
  -ExpectTest 'is rendered once, not once per contest state'

Invoke-Probe -Name 'the server time is never passed in' -File $Lobby `
  -Find "              serverNow={state?.serverNow}
" `
  -Replace '' `
  -ExpectTest "hands the countdown the server's time rather than letting it guess"

Invoke-Probe -Name 'a cancelled contest still counts down' -File $Lobby `
  -Find "{countdownTarget && !isCompleted && !isCancelled && (
            <ContestCountdown" `
  -Replace "{countdownTarget && !isCompleted && (
            <ContestCountdown" `
  -ExpectTest 'is withheld from a contest that has finished or been called off'

Write-Host ''
Write-Host '=== The two clocks stay different ===' -ForegroundColor Cyan

# The game screen back on the visitor's own clock - which is what it would read as if somebody
# "unified" the two countdowns on the grounds that they now share a panel.
Invoke-Probe -Name 'the game clock reads the browser' -File $Game `
  -Find '  const now = useServerClock(serverNow);' `
  -Replace '  const now = Date.now();' `
  -ExpectTest "runs the game countdown on the server's clock"

# And the other direction, which is the one a well-meaning consistency pass would make.
Invoke-Probe -Name 'the trading clock reads the server' -File $Live `
  -Find 'import { useState, useEffect } from "react";' `
  -Replace 'import { useState, useEffect } from "react";
import { useServerClock } from "@/hooks/useServerClock";' `
  -ExpectTest "leaves the trading countdown on the browser's clock"

Invoke-Probe -Name 'an unparseable target reports a finished contest' -File $Game `
  -Find '  if (Number.isNaN(targetMs)) return null;' `
  -Replace '' `
  -ExpectTest 'refuses an unparseable target rather than reporting a finished contest'

Write-Host ''
Write-Host '=== The arithmetic ===' -ForegroundColor Cyan

Invoke-Probe -Name 'a past target counts backwards' -File $Panel `
  -Find '  if (!Number.isFinite(ms) || ms <= 0) {' `
  -Replace '  if (!Number.isFinite(ms)) {' `
  -ExpectTest 'treats a past target as the finished state'

Invoke-Probe -Name 'an unusable duration reaches the cells' -File $Panel `
  -Find '  if (!Number.isFinite(ms) || ms <= 0) {' `
  -Replace '  if (ms <= 0) {' `
  -ExpectTest 'treats an unusable duration as finished rather than as a wall of NaN'

# 59m59s becomes 60m under rounding, which reads correctly for every duration except the second
# before a boundary - so the first, larger fixture stays green and only the boundary test moves.
Invoke-Probe -Name 'minutes round instead of truncating' -File $Panel `
  -Find '    minutes: Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60)),' `
  -Replace '    minutes: Math.round((ms % (1000 * 60 * 60)) / (1000 * 60)),' `
  -ExpectTest 'carries nothing across the unit boundaries'

Write-Host ''
Write-Host '=== The ending-soon threshold ===' -ForegroundColor Cyan

Invoke-Probe -Name 'the threshold moves' -File $Panel `
  -Find 'export const COUNTDOWN_WARNING_MS = 60 * 60 * 1000;' `
  -Replace 'export const COUNTDOWN_WARNING_MS = 30 * 60 * 1000;' `
  -ExpectTest 'has one definition of when a contest is ending soon'

Invoke-Probe -Name 'a consumer restates the hour' -File $Game `
  -Find '  const targetMs = new Date(target).getTime();' `
  -Replace '  const targetMs = new Date(target).getTime();
  const warn = 60 * 60 * 1000;
  void warn;' `
  -ExpectTest 'has one definition of when a contest is ending soon'

Write-Host ''
Write-Host "=== LiveCountdown's own behaviour ===" -ForegroundColor Cyan

Invoke-Probe -Name 'the status gate is widened' -File $Live `
  -Find '  if (type === "start" && status === "upcoming") {' `
  -Replace '  if (type === "start") {' `
  -ExpectTest 'still renders nothing for a type and status that do not match'

Invoke-Probe -Name 'the first-tick skeleton goes' -File $Live `
  -Find '  if (remainingMs === null) {' `
  -Replace '  if (remainingMs === undefined) {' `
  -ExpectTest 'still shows a skeleton before its first tick'

Write-Host ''
Write-Host 'Done. Every probe should read RED with exactly 1 failure.' -ForegroundColor Cyan
Write-Host ''
