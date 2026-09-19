# Probes the Circuit scoring guards. See tools/probe-harness.ps1 for how and why.

$ErrorActionPreference = 'Continue'
. "$PSScriptRoot/probe-harness.ps1"

$Suite = 'tools/test-scoring.ts'

Write-Host ""
Write-Host "Probing the Circuit scoring guards" -ForegroundColor Cyan
Write-Host ""

$results = @()

# The two strategy invariants. A scoring rule can be arithmetically correct and still reward the
# wrong behaviour, which produces no error - just a contest won by the player who did the thing
# the game meant to discourage.

# MaxRed 4: the penalty is read by both scorePerfect and zeroScore, so removing it legitimately
# breaks every test that depends on an unfinished board costing anything.
$results += Invoke-Probe -Suite $Suite -Name 'the unfinished-board penalty exists' `
  -File 'src/games/scoring.ts' `
  -Find 'const penaltyTotal = unfinished * penaltyMs;' `
  -Replace 'const penaltyTotal = 0;' `
  -ExpectRed 'finishing everything slowly beats quitting early' `
  -MaxRed 4

$results += Invoke-Probe -Suite $Suite -Name 'the speed bonus cannot outweigh a completed board' `
  -File 'src/games/scoring.ts' `
  -Find 'const SPRINT_MAX_SPEED_BONUS = 200;' `
  -Replace 'const SPRINT_MAX_SPEED_BONUS = 2000;' `
  -ExpectRed 'completing boards always beats rushing' `
  -MaxRed 4

# The one that is easiest to get backwards, and silent when it is.
#
# Re-aimed TWICE, and both misses are the same mistake: an anchor that is not unique to the code
# being probed. The `PERFECT_CODE && config.kind === "perfect"` condition appears in both
# scoreRound and zeroScore, and so does `return scorePerfect(` - each time the replacement hit
# scoreRound, routing all Perfect scoring into the fail-closed throw and turning seven tests red.
# That is a far broader defect than the one intended, and a probe aimed at the wrong code is
# indistinguishable from a broken guard.
#
# The line below exists only in zeroScore. Emptying the synthesised board list makes zeroScore
# report "no boards at all" instead of "every board unfinished", which is precisely the
# lower-is-better inversion the test is for.
$results += Invoke-Probe -Suite $Suite -Name 'no result is the worst score for a lower-is-better title' `
  -File 'src/games/scoring.ts' `
  -Find 'Array.from({ length: config.boardCount }, (_, index) => ({' `
  -Replace 'Array.from({ length: 0 }, (_, index) => ({' `
  -ExpectRed 'no result is the WORST score, not zero' `
  -MaxRed 2

$results += Invoke-Probe -Suite $Suite -Name 'Sprint duration measures time to the last solve' `
  -File 'src/games/scoring.ts' `
  -Find '  const durationMs = lastSolveAt ? lastSolveAt.getTime() - firstIssuedAt : 0;' `
  -Replace '  const durationMs = 0;' `
  -ExpectRed 'duration is the time to the last completed board, not the session length' `
  -MaxRed 3

$results += Invoke-Probe -Suite $Suite -Name 'the lower bound on a duration score holds' `
  -File 'src/games/scoring.ts' `
  -Find '    Math.max(PERFECT.scoreRange.min, raw),' `
  -Replace '    Math.max(0, raw),' `
  -ExpectRed 'a score can never be reported below the declared minimum'

$results += Invoke-Probe -Suite $Suite -Name 'a non-finite setting cannot become NaN' `
  -File 'src/games/titles.ts' `
  -Find '  if (typeof value !== "number" || !Number.isFinite(value)) {' `
  -Replace '  if (typeof value === "symbol") {' `
  -ExpectRed 'a non-numeric setting does not become NaN' `
  -MaxRed 3

$results += Invoke-Probe -Suite $Suite -Name 'a clamped setting is reported, not swallowed' `
  -File 'src/games/titles.ts' `
  -Find '    if (duration.clamped) corrected.push("durationSeconds");' `
  -Replace '    if (false) corrected.push("durationSeconds");' `
  -ExpectRed 'an out-of-range setting is clamped and reported, not silently accepted'

$results += Invoke-Probe -Suite $Suite -Name 'scoring fails closed on a title/config mismatch' `
  -File 'src/games/scoring.ts' `
  -Find '  throw new Error(' `
  -Replace '  return { score: 0, durationMs: 0, breakdown: {} }; throw new Error(' `
  -ExpectRed 'scoring refuses a title and config that disagree'

Write-ProbeSummary $results
