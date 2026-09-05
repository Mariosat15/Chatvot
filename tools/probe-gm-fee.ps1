# Probes the R31 fix by reintroducing each defect and confirming the suite goes red.
# A test that only ever passes proves nothing - and every one of these tests was written
# against code that did not exist yet, so without probes they could all be tautologies.
#
# Same harness as tools/probe-provider-entry.ps1, and for the same three reasons learned the
# hard way: a multi-line pattern with CRLF does not match an LF file, Out-String wraps long
# test names across lines so a literal match silently misses, and a probe that fails to apply
# is indistinguishable from a test that does not work.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$Suite = '__tests__/services/game-master-fee-percentage.test.ts'

function Relax([string]$literal) {
  [regex]::Escape($literal) -replace '\r?\n', '\r?\n'
}

function Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectRed
  )

  $original = Get-Content $File -Raw
  $patched = [regex]::Replace($original, (Relax $Find), $Replace.Replace('$', '$$'), 1)

  if ($patched -eq $original) {
    Write-Host "  [PROBE DID NOT APPLY] $Name" -ForegroundColor Magenta
    return
  }

  Set-Content -LiteralPath $File -Value $patched -NoNewline
  try {
    $out = npx vitest run $Suite --reporter=dot 2>&1 | Out-String
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

Write-Host "`n=== the fee a settlement applies (the R31 defect itself) ===" -ForegroundColor Cyan

Probe -Name 'the cached-rate fallback goes back to `||`, reading a stored 0% as unset' `
  -File 'lib/services/settlement/game-master-fees/calculate.ts' `
  -Find '  const cached = gmSubscription?.limits?.referralFeePercentage;
  return typeof cached === "number" && Number.isFinite(cached)
    ? cached
    : DEFAULT_REFERRAL_FEE_PERCENTAGE;' `
  -Replace '  return (
    gmSubscription?.limits?.referralFeePercentage ||
    DEFAULT_REFERRAL_FEE_PERCENTAGE
  );' `
  -ExpectRed 'pays 0 when the subscription carries no packageId and its cached rate is 0'

Probe -Name 'the current-package branch loses its `!== undefined` check' `
  -File 'lib/services/settlement/game-master-fees/calculate.ts' `
  -Find 'currentPackage?.gameMasterConfig?.referralFeePercentage !== undefined' `
  -Replace 'currentPackage?.gameMasterConfig?.referralFeePercentage' `
  -ExpectRed 'pays 0 when the CURRENT package says 0, even though the cache says 5'

Probe -Name 'the fallback always returns the default, ignoring a configured rate' `
  -File 'lib/services/settlement/game-master-fees/calculate.ts' `
  -Find '  const cached = gmSubscription?.limits?.referralFeePercentage;
  return typeof cached === "number" && Number.isFinite(cached)
    ? cached
    : DEFAULT_REFERRAL_FEE_PERCENTAGE;' `
  -Replace '  return DEFAULT_REFERRAL_FEE_PERCENTAGE;' `
  -ExpectRed 'still honours an ordinary configured rate from the current package'

Write-Host "`n=== the one writer of a subscription's cached limits ===" -ForegroundColor Cyan

Probe -Name 'the builder goes back to `||`, storing a 0% package as 5%' `
  -File 'lib/services/gamemaster/subscription-limits.ts' `
  -Find '  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;' `
  -Replace '  return value || fallback;' `
  -ExpectRed 'stores a 0% referral fee as 0, not as the 5% default'

Probe -Name 'the builder uses a bare `??`, letting NaN through into a stored percentage' `
  -File 'lib/services/gamemaster/subscription-limits.ts' `
  -Find '  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;' `
  -Replace '  return value ?? fallback;' `
  -ExpectRed 'refuses NaN, which is what `??` alone would have let through'

Probe -Name 'the builder copies the competition rate into the challenge rate' `
  -File 'lib/services/gamemaster/subscription-limits.ts' `
  -Find '    ...(typeof c.challengeReferralFeePercentage === "number" &&
    Number.isFinite(c.challengeReferralFeePercentage)
      ? { challengeReferralFeePercentage: c.challengeReferralFeePercentage }
      : {}),' `
  -Replace '    challengeReferralFeePercentage:
      c.challengeReferralFeePercentage ?? c.referralFeePercentage ?? 5,' `
  -ExpectRed 'leaves the challenge rate absent rather than copying the competition rate'

Probe -Name 'the builder drops an explicit 0% challenge rate as if it were absent' `
  -File 'lib/services/gamemaster/subscription-limits.ts' `
  -Find '    ...(typeof c.challengeReferralFeePercentage === "number" &&
    Number.isFinite(c.challengeReferralFeePercentage)
      ? { challengeReferralFeePercentage: c.challengeReferralFeePercentage }
      : {}),' `
  -Replace '    ...(c.challengeReferralFeePercentage
      ? { challengeReferralFeePercentage: c.challengeReferralFeePercentage }
      : {}),' `
  -ExpectRed 'keeps an explicit 0% challenge rate, which is a different fact from an absent one'

Probe -Name 'the two permission flags collapse to the same default' `
  -File 'lib/services/gamemaster/subscription-limits.ts' `
  -Find '    canEarnFromChallenges: c.canEarnFromChallenges === true,' `
  -Replace '    canEarnFromChallenges: c.canEarnFromChallenges !== false,' `
  -ExpectRed 'treats the two boolean flags with opposite defaults, matching the schema'

Write-Host ''
