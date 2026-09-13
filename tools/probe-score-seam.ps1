# Probes the participant score seam.
#
# The first probe is the one that matters: it removes the seam entirely, restoring the exact
# code that shipped as "X5 code-complete". If the suite stays green then the new tests are no
# better than the ones that missed it the first time.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$Arrival = '__tests__/services/participant-score-arrival.test.ts'
$Arith = '__tests__/services/participant-score-sync.test.ts'
$Svc = 'lib/services/games/participant-score.service.ts'
$Ingest = 'lib/services/games/result-ingestion.service.ts'
$Settle = '__tests__/services/provider-settlement.test.ts'
$Settlement = 'lib/services/settlement/provider-settlement.service.ts'

function Relax([string]$literal) {
  [regex]::Escape($literal) -replace '\r?\n', '\r?\n'
}

function Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string[]]$Suites,
    [string]$ExpectRed
  )

  # -LiteralPath on the read too: a Next.js dynamic-route path contains [brackets], which
  # PowerShell parses as a wildcard, so a plain Get-Content silently returns $null while
  # Set-Content -LiteralPath still writes - which destroys the file under test.
  $original = Get-Content -LiteralPath $File -Raw
  if ([string]::IsNullOrWhiteSpace($original)) {
    Write-Host "  [CANNOT READ FILE - ABORTING PROBE] $Name" -ForegroundColor Magenta
    return
  }
  $patched = [regex]::Replace($original, (Relax $Find), $Replace.Replace('$', '$$'), 1)

  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] $Name" -ForegroundColor Magenta
    return
  }

  Set-Content -LiteralPath $File -Value $patched -NoNewline
  try {
    $out = npx vitest run @Suites --reporter=dot 2>&1 | Out-String
    $failed = 0
    if ($out -match 'Tests\s+(\d+)\s+failed') { $failed = [int]$Matches[1] }

    $flat = ($out -replace '\s+', ' ')
    $want = ($ExpectRed -replace '\s+', ' ')

    if ($failed -gt 0) {
      $hit = if ($flat -match [regex]::Escape($want)) { 'expected test' } else { 'OTHER test' }
      Write-Host ("  [RED: {0} failed, {1}] {2}" -f $failed, $hit, $Name) -ForegroundColor Green
    } else {
      Write-Host "  [STILL GREEN - GUARD IS NOT WORKING] $Name" -ForegroundColor Red
    }
  } finally {
    Set-Content -LiteralPath $File -Value $original -NoNewline
  }
}

Write-Host "`n=== the seam itself ===" -ForegroundColor Cyan

# THE PROBE THIS WHOLE EXERCISE EXISTS FOR: put the shipped bug back.
Probe -Name 'the seam is removed entirely - the exact code that shipped as X5 code-complete' `
  -File $Ingest `
  -Find '  const scoreSync = await syncParticipantScore({
    contestId: round.contestId,
    userId: round.userId,
    contestType: round.contestType,
    scoreDirection: normalised.scoreDirection,
  });' `
  -Replace '  const scoreSync = { synced: false as const, reason: "probe" };' `
  -Suites @($Arrival) `
  -ExpectRed 'writes the score onto the participant, not only onto the round'

Probe -Name 'the sync runs BEFORE the round is saved, so it misses the result being ingested' `
  -File $Ingest `
  -Find '  await round.save();

  // ── GATE 11b' `
  -Replace '  // probe: save moved after the sync
  // ── GATE 11b' `
  -Suites @($Arrival) `
  -ExpectRed 'writes the score onto the participant, not only onto the round'

Probe -Name 'the stored score is negated for a lower-is-better game' `
  -File $Svc `
  -Find '  const score = combineRoundScores(scores, policy, scoreDirection);' `
  -Replace '  const score =
    scoreDirection === "lower_is_better"
      ? -combineRoundScores(scores, policy, scoreDirection)
      : combineRoundScores(scores, policy, scoreDirection);' `
  -Suites @($Arrival) `
  -ExpectRed 'stores the RAW score for a lower-is-better game, never a negated one'

Probe -Name 'settlement reads the direction per participant again instead of from the catalogue' `
  -File $Settlement `
  -Find '      scoreDirection: direction,' `
  -Replace '      scoreDirection: "higher_is_better" as const,' `
  -Suites @($Settle) `
  -ExpectRed 'ranks a lower_is_better title the other way round'

Write-Host "`n=== the aggregation ===" -ForegroundColor Cyan

Probe -Name 'best_of_n ignores direction and always takes the maximum' `
  -File $Svc `
  -Find '    case "best_of_n":
      return direction === "lower_is_better"
        ? Math.min(...usable)
        : Math.max(...usable);' `
  -Replace '    case "best_of_n":
      return Math.max(...usable);' `
  -Suites @($Arith, $Arrival) `
  -ExpectRed 'takes the LOWEST attempt under best_of_n when lower is better'

Probe -Name 'sum_of_n returns only the latest attempt' `
  -File $Svc `
  -Find '    case "sum_of_n":
      return usable.reduce((total, value) => total + value, 0);' `
  -Replace '    case "sum_of_n":
      return usable[usable.length - 1];' `
  -Suites @($Arith, $Arrival) `
  -ExpectRed 'sums every attempt under sum_of_n'

Probe -Name 'an empty round list returns -Infinity instead of zero' `
  -File $Svc `
  -Find '  if (usable.length === 0) return 0;' `
  -Replace '  if (false) return 0;' `
  -Suites @($Arith) `
  -ExpectRed 'scores zero when no round completed, rather than returning NaN'

Probe -Name 'a non-finite score is propagated rather than discarded' `
  -File $Svc `
  -Find '  const usable = scores.filter((value) => Number.isFinite(value));' `
  -Replace '  const usable = scores;' `
  -Suites @($Arith) `
  -ExpectRed 'discards a non-finite score instead of propagating it'

Probe -Name 'a legitimate zero is filtered out as though it were absent' `
  -File $Svc `
  -Find '  const usable = scores.filter((value) => Number.isFinite(value));' `
  -Replace '  const usable = scores.filter((value) => Number.isFinite(value) && value);' `
  -Suites @($Arith) `
  -ExpectRed 'keeps a legitimate zero, because 0 is a score and not an absence'

Write-Host "`n=== the guards around it ===" -ForegroundColor Cyan

Probe -Name 'practice rounds are allowed to write a paid contest participant score' `
  -File $Svc `
  -Find '  if (contestType !== "competition") {' `
  -Replace '  if (false) {' `
  -Suites @($Arrival) `
  -ExpectRed 'does not touch a participant row for a practice round'

Probe -Name 'a missing attempts policy is defaulted instead of refused' `
  -File $Svc `
  -Find '  const policy = contest.attemptsPolicy as AttemptsPolicy | undefined;
  if (policy !== "single" && policy !== "best_of_n" && policy !== "sum_of_n") {' `
  -Replace '  const policy = (contest.attemptsPolicy ?? "single") as AttemptsPolicy;
  if (false) {' `
  -Suites @($Arrival) `
  -ExpectRed 'refuses to score a contest with no attempts policy rather than guessing one'

Write-Host ''
