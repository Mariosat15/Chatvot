# Probes `__tests__/games/challenge-arena.test.ts` - the two things the owner asked for on
# 13 September 2026: a late player gets a shortened challenge round rather than a refusal, and
# the challenge play screen is the competition arena.
#
# Same harness shape as `probe-challenge-provider-resolution.ps1` - see that file for the
# encoding notes (read/write UTF-8 without a BOM, ASCII-only anchors, and the rule that a
# PROBE DID NOT APPLY means the target moved rather than that the run was quiet).

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/games/challenge-arena.test.ts'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Relax([string]$literal) { [regex]::Escape($literal) -replace '\r?\n', '\r?\n' }

function Probe {
  param([string]$Name, [string]$File, [string]$Find, [string]$Replace, [string]$ExpectRed, [string]$Suite = $SUITE)

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

$CONFIG = 'lib/services/games/challenge-round-config.ts'
$STATUS = 'lib/services/games/challenge-round-status.service.ts'
$PAGE = 'app/(root)/challenges/[id]/play/page.tsx'
$LAYOUT = 'components/games/arena/GameArenaLayout.tsx'
$STANDINGS = 'components/games/arena/ChallengeStandingsPanel.tsx'

Write-Host "`n=== how late a player may start ===" -ForegroundColor Cyan

# The whole owner decision in one value. Every other assertion in the suite passes against a
# constant pointed back at the reservation - they would all describe the wrong rule fluently.
Probe -Name 'the constant is pointed back at the reservation' `
  -File $CONFIG `
  -Find 'export const CHALLENGE_ROUND_START_POLICY: RoundStartPolicy = "until_window_closes";' `
  -Replace 'export const CHALLENGE_ROUND_START_POLICY: RoundStartPolicy = "reserve_full_round";' `
  -ExpectRed 'is the one definition, and it is the permissive one'

# The competition's reading of the same field name, applied to a challenge. This is the change
# a reader makes on consistency grounds, and it silently applies the strict rule to every
# challenge created before the field existed.
Probe -Name 'an absent stored policy is read the way a competition reads it' `
  -File $CONFIG `
  -Find '        challenge.roundStartPolicy === "reserve_full_round"
          ? "reserve_full_round"
          : CHALLENGE_ROUND_START_POLICY,' `
  -Replace '        challenge.roundStartPolicy === "until_window_closes"
          ? "until_window_closes"
          : "reserve_full_round",' `
  -ExpectRed 'reads an ABSENT stored policy as permissive'

# The stored value ignored entirely - the tidier-looking version, since nothing writes
# `reserve_full_round` to a challenge today. It takes the field's future with it.
Probe -Name 'the stored policy is ignored and the constant returned unconditionally' `
  -File $CONFIG `
  -Find '      roundStartPolicy:
        challenge.roundStartPolicy === "reserve_full_round"
          ? "reserve_full_round"
          : CHALLENGE_ROUND_START_POLICY,' `
  -Replace '      roundStartPolicy: CHALLENGE_ROUND_START_POLICY,' `
  -ExpectRed 'STILL honours an explicit'

# An empty string taken literally. `""` is not `reserve_full_round`, so this one needs the
# reading to be inverted to bite - which is what the mutation below does, narrowly.
Probe -Name 'an empty stored string falls through to the reservation' `
  -File $CONFIG `
  -Find '        challenge.roundStartPolicy === "reserve_full_round"' `
  -Replace '        challenge.roundStartPolicy !== "until_window_closes"' `
  -ExpectRed 'reads a stored empty string as permissive too'

# The unreachable fallback, restored to the literal it used to carry.
Probe -Name 'the play-state fallback names the reservation again' `
  -File $STATUS `
  -Find '          config.config.roundStartPolicy ?? CHALLENGE_ROUND_START_POLICY,' `
  -Replace '          config.config.roundStartPolicy ?? "reserve_full_round",' `
  -ExpectRed 'names the constant in the play-state fallback'

Write-Host "`n=== the arena ===" -ForegroundColor Cyan

# The screen the owner rejected: the board and nothing beside it. Dropping one slot is the
# realistic version of that regression, and it is invisible unless the two pages are compared.
Probe -Name 'the sidebar slot is dropped from the challenge arena' `
  -File $PAGE `
  -Find '      sidebar={' `
  -Replace '      sidebarWithheld={' `
  -ExpectRed 'fills every slot the competition page fills'

Probe -Name 'the activity feed is dropped from the challenge arena' `
  -File $PAGE `
  -Find '      activity={' `
  -Replace '      activityWithheld={' `
  -ExpectRed 'fills every slot the competition page fills'

# The layout building the back path itself, which is what it did before this work. A challenge
# then linked to a competition that does not exist - a 404 on the control used to leave a board.
Probe -Name 'the layout builds a competition path again' `
  -File $LAYOUT `
  -Find '        href={backHref}' `
  -Replace '        href={`/competitions/${backHref}`}' `
  -ExpectRed 'takes a back HREF rather than a contest id'

# The competition rail reused for a 1v1. It compiles, it renders, and it decides the order of
# two players itself - a second place the score direction is decided, which is R37.
Probe -Name 'the standings rail sorts the two seats itself' `
  -File $STANDINGS `
  -Find '      {seats.map((seat) => {' `
  -Replace '      {[...seats].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((seat) => {' `
  -ExpectRed 'reports the two seats without ordering them'

# R50's read side. `?? 0` reads as defensive and says a player who has not finished a round
# scored nothing - which on a lower-is-better title is the best result on the board.
#
# ANCHORED ON THE ASCII PREFIX ONLY, deliberately: the full line ends in an em dash, and the
# first version of this probe reported PROBE DID NOT APPLY because the non-ASCII character did
# not survive the round trip through the shell. That outcome is indistinguishable from a guard
# whose target has moved.
Probe -Name 'an absent score renders as a nought' `
  -File $STANDINGS `
  -Find '{typeof seat.score === "number" ? seat.score.toLocaleString() :' `
  -Replace '{(seat.score ?? 0).toLocaleString()}{"" +' `
  -ExpectRed 'renders an absent score as a dash'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
