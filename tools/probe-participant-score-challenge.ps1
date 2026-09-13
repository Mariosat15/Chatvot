# Probes the CHALLENGE branch of `syncParticipantScore`
# (`lib/services/games/participant-score.service.ts`) - the wiring that
# `__tests__/services/participant-score-challenge-arrival.test.ts` exists to cover, which
# `participant-score-arrival.test.ts` never touched because it drives `applyResult`
# exclusively through `contestType: "competition"` fixtures.
#
# Same harness shape as `probe-challenge-provider-resolution.ps1` - see that file for the
# encoding notes (read/write UTF-8 without a BOM, ASCII-only anchors, relaxed newlines).

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/services/participant-score-challenge-arrival.test.ts'
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

$SERVICE = 'lib/services/games/participant-score.service.ts'

Write-Host "`n=== isChallenge must actually branch, not just read as though it does ===" -ForegroundColor Cyan

# If this collapses to false, a challenge round tries to read the contest as a Competition
# (not found) and write to CompetitionParticipant - both silently wrong, and the only
# observable difference is that ChallengeParticipant never gets its score.
Probe -Name 'isChallenge is no longer derived from contestType' `
  -File $SERVICE `
  -Find '  const isChallenge = contestType === "challenge";' `
  -Replace '  const isChallenge = false;' `
  -ExpectRed 'writes the score onto ChallengeParticipant via the challengeId filter'

Write-Host "`n=== the ChallengeParticipant filter must be challengeId, not competitionId ===" -ForegroundColor Cyan

# ChallengeParticipant has no `competitionId` field - a typo here is not a type error, it is
# a filter that matches nothing, so findOneAndUpdate returns null and the round is accepted
# while the participant silently never gets scored.
Probe -Name 'ChallengeParticipant lookup no longer filters on challengeId' `
  -File $SERVICE `
  -Find '        { challengeId: contestId, userId },' `
  -Replace '        { competitionId: contestId, userId },' `
  -ExpectRed 'writes the score onto ChallengeParticipant via the challengeId filter'

Write-Host "`n=== a challenge with no attemptsPolicy must be refused, never guessed ===" -ForegroundColor Cyan

# Guessing "single" here would score a challenge under a rule nobody chose. This is the same
# refusal the competition side relies on, re-pinned because the challenge fixture drives a
# different model (`Challenge.attemptsPolicy`, not `Competition.attemptsPolicy`).
Probe -Name 'a missing attemptsPolicy is no longer refused' `
  -File $SERVICE `
  -Find '  const policy = contest.attemptsPolicy as AttemptsPolicy | undefined;
  if (policy !== "single" && policy !== "best_of_n" && policy !== "sum_of_n") {' `
  -Replace '  const policy = (contest.attemptsPolicy ?? "single") as AttemptsPolicy;
  if (false) {' `
  -ExpectRed 'refuses to score a challenge with no attempts policy rather than guessing one'

Write-Host "`n=== nothing contributed must `$unset the score, never `$set a phantom zero ===" -ForegroundColor Cyan

# R50 on the model it was fixed on for competitions, re-proven for challenges: writing 0
# instead of unsetting would make `hasResult` read a voided/unresolved player as having
# played and scored nothing, and pay them a rank.
Probe -Name 'an uncontributed score is no longer $unset' `
  -File $SERVICE `
  -Find '  const update = contributed ? { $set: { score } } : { $unset: { score: "" } };' `
  -Replace '  const update = { $set: { score: score ?? 0 } };' `
  -ExpectRed 'leaves an absent score absent when nothing contributed, never a phantom zero'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
