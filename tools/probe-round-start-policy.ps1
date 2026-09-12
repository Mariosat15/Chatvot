# Probes the round-start policy where it BEHAVES, plus the wizard's auto-publish.
#
# Two suites, so the harness is parameterised on the suite as well as the test name. That is a
# recorded lesson rather than a convenience: aimed at the default suite, a probe for a test in
# another file reports "no test ran", which reads exactly like a broken harness instead of a
# missing guard.
#
# The STRUCTURAL half of this work is probed in `probe-contest-round-clock.ps1` (the operator's
# screens and the mirrored pre-flights) and `probe-play-clock.ps1` (the player's pre-flight).
# This file covers the two things neither of those can see:
#
#   - `createRound` itself, against a real MongoDB, which is the only place the claim "a
#     permissive contest starts a SHORTENED round rather than an unbounded one" can be tested.
#     A structural assertion on the gate cannot see `resolveExpiry`'s clamp.
#   - The create-then-publish sequence, which lives in the browser and never reaches the server
#     as a flag.
#
# Every recorded probing precaution applies: UTF-8 without a BOM pinned on the read and the
# write, a refusal to write an empty file, an assertion that the file actually changed, the
# expected test run ALONE with `-t`, and the whole-suite count reported so collateral damage is
# distinguishable from a tripped guard.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$LIFECYCLE = '__tests__/services/round-lifecycle.test.ts'
$CREATE_SUITE = '__tests__/services/provider-contest-create.test.ts'
$WIZARD_SUITE = '__tests__/admin/provider-contest-schedule-and-prizes.test.ts'

function Relax([string]$literal) { [regex]::Escape($literal) -replace '\r?\n', '\r?\n' }

function Probe {
  param(
    [string]$Name,
    [string]$Suite,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectRed
  )

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

$ROUND = 'lib/services/games/round.service.ts'
$CONFIG = 'lib/services/games/contest-config.ts'
$WIZARD = 'apps/admin/components/admin/games/ProviderContestWizard.tsx'
$DRAFT = 'apps/admin/components/admin/games/contest-draft.ts'
$EDITOR = 'apps/admin/components/admin/games/ProviderContestEditor.tsx'

Write-Host "`n=== the gate, against a real database ===" -ForegroundColor Cyan

# The defect the owner reported, reinstated: the ceiling reserved unconditionally, so a contest
# shorter than the title's maximum refuses every round from the instant it opens.
Probe -Name 'the policy is ignored and the ceiling is always reserved' `
  -Suite $LIFECYCLE `
  -File $ROUND `
  -Find '  if (config.roundStartPolicy === "until_window_closes") return true;' `
  -Replace '  if (false) return true;' `
  -ExpectRed 'starts that same round, shortened, when the contest lets players start at any time'

# The opposite mistake, and the more dangerous one: the gate skipped for EVERY contest. A round
# is then admitted that the contest end cuts short on a title where a partial run means nothing,
# and the reserving setting silently stops existing.
#
# RE-AIMED 11 September 2026. It had been anchored on `(config.maxDurationSeconds ?? 0)`, which is
# what this line read until `12` s2.9 changed the gate to reserve the configured attempt on
# 8 September - so for three days it reported DID NOT APPLY, which reads exactly like a broken
# harness rather than a moved target.
Probe -Name 'the gate is skipped for every contest, not only permissive ones' `
  -Suite $LIFECYCLE `
  -File $ROUND `
  -Find '  const attemptMs =
    (config.attemptSeconds ?? config.maxDurationSeconds ?? 0) * 1000;
  return now.getTime() + attemptMs <= config.playWindowEnd.getTime();' `
  -Replace '  return true;' `
  -ExpectRed 'refuses to start a round that could not finish inside the play window'

# The safety net going back to the exact configured length, which is slack only while the operator
# has chosen something SHORTER than the title's ceiling. Pick the longest round the title allows
# and the two anchors differ - expiry from round creation, the game's clock from Start - so every
# full-length round is cut off by the frame loading and reported `expired` rather than `completed`.
Probe -Name 'the expiry safety net has no room for the game to load' `
  -Suite $LIFECYCLE `
  -File $ROUND `
  -Find '  const maxDuration =
    ((config.maxDurationSeconds ?? 300) + ROUND_EXPIRY_HEADROOM_SECONDS) * 1000;' `
  -Replace '  const maxDuration = (config.maxDurationSeconds ?? 300) * 1000;' `
  -ExpectRed "leaves the game's own clock room to be the deadline, not this one"

# THE HALF A STRUCTURAL TEST CANNOT SEE. Permitting the round is not the claim - bounding it is.
# Without the clamp, a permissive contest launches a round that outlives its own settlement,
# which is the single most expensive failure in this integration.
Probe -Name 'a permissive contest launches an unbounded round' `
  -Suite $LIFECYCLE `
  -File $ROUND `
  -Find '    Math.min(now.getTime() + maxDuration, config.playWindowEnd.getTime()),' `
  -Replace '    now.getTime() + maxDuration,' `
  -ExpectRed 'starts that same round, shortened, when the contest lets players start at any time'

# A closed window read as merely a narrow one, which would create a round whose expiry is
# already in the past and score it on nothing.
Probe -Name 'a closed window is treated as a short one' `
  -Suite $LIFECYCLE `
  -File $ROUND `
  -Find '  if (now.getTime() >= input.config.playWindowEnd.getTime()) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'still refuses once the window has actually closed, under either policy'

# The normaliser failing open: an unrecognised stored value read as permissive rather than as
# the schema default. It fails closed for the same reason the market-hours gate does - wrongly
# applying a gate is visible and complained about, wrongly skipping one is not.
#
# RE-AIMED, AND THE FIRST AIM FOUND A REAL HOLE. Pointed at the round-lifecycle suite this
# reported GREEN with zero red in the suite: every test there hands `createRound` a hand-built
# config, so the normaliser was reachable by no test at all. That is the third instance of a
# green probe meaning "no test exists" rather than "weak test" - so a test was written for
# `contestRoundConfig` and the probe now names it and its own suite.
Probe -Name 'an unrecognised stored policy is read as permissive' `
  -Suite $CREATE_SUITE `
  -File $CONFIG `
  -Find '        contest.roundStartPolicy === "until_window_closes"' `
  -Replace '        contest.roundStartPolicy !== "reserve_full_round"' `
  -ExpectRed 'normalises the round-start policy, failing CLOSED on anything unrecognised'

Write-Host "`n=== publishing what the wizard creates ===" -ForegroundColor Cyan

# The old behaviour: always a draft. This is how contests sat invisible past their own start
# time while the operator believed they had created one.
Probe -Name 'a new draft no longer defaults to publishing' `
  -Suite $WIZARD_SUITE `
  -File $DRAFT `
  -Find '  publishOnSave: true,' `
  -Replace '  publishOnSave: false,' `
  -ExpectRed 'defaults a new draft to publishing, and an edited contest to not'

# The editor inheriting the wizard's default, so fixing a typo in a name publishes a draft the
# operator had deliberately left unpublished.
Probe -Name 'editing a contest publishes it as a side effect' `
  -Suite $WIZARD_SUITE `
  -File $EDITOR `
  -Find '    publishOnSave: false,' `
  -Replace '    publishOnSave: true,' `
  -ExpectRed 'defaults a new draft to publishing, and an edited contest to not'

# The flag sent to the server, which is the "why two round trips?" simplification. It bypasses
# the publish check against the STORED record - the check that asks whether the settings
# actually persisted, which creation cannot ask.
Probe -Name 'the publish flag is sent on the create call' `
  -Suite $WIZARD_SUITE `
  -File $DRAFT `
  -Find '    playMode: draft.playMode,
    attemptsPolicy: draft.attemptsPolicy,' `
  -Replace '    publishOnSave: draft.publishOnSave,
    playMode: draft.playMode,
    attemptsPolicy: draft.attemptsPolicy,' `
  -ExpectRed 'never sends the flag to the server, at create or at edit'

# Created and then never published, so the checkbox is a control that appears to work and does
# nothing - the shape behind a provider enabled with no adapter and a `rankingMethod` a provider
# game ignores.
Probe -Name 'the create succeeds and the publish call is dropped' `
  -Suite $WIZARD_SUITE `
  -File $WIZARD `
  -Find '      if (draft.publishOnSave && data.competitionId) {' `
  -Replace '      if (false && data.competitionId) {' `
  -ExpectRed 'publishes after the create returns, using the publish route'

# The refusal swallowed. The contest EXISTS by then, so a publish reported as a success sends
# an operator away believing players can enter something invisible.
Probe -Name 'a refused publish is reported as a success' `
  -Suite $WIZARD_SUITE `
  -File $WIZARD `
  -Find '        const refusals: string[] = data.errors ?? [];' `
  -Replace '        const refusals: string[] = [];' `
  -ExpectRed 'keeps the contest and reports the reasons when the publish check refuses'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
