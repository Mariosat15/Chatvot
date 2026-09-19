# Probes `__tests__/services/chargeback-clawback-refusal.test.ts` - R84, the chargeback
# clawback that clamped the wallet at zero while booking the full negative amount.
#
# Same harness shape as `probe-reconciliation-money.ps1` - see that file for the encoding
# notes (read/write UTF-8 without a BOM, ASCII-only anchors, and the rule that PROBE DID NOT
# APPLY means the target moved rather than that the run was quiet).

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/services/chargeback-clawback-refusal.test.ts'
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

$WRITER = 'lib/services/security/chargeback-case.writers.ts'
$ATLAS = 'apps/admin/app/api/atlas/refund/clawback/route.ts'
$MATH = 'lib/services/reconciliation-math.ts'

Write-Host "`n=== R84: the clamp, restored verbatim ===" -ForegroundColor Cyan

# The defect exactly as it was: nothing refuses and the balance is floored at zero, so the
# ledger books -100 beside a wallet that only lost 20. This is the probe that matters -
# everything else on this page is a variation of it.
#
# The anchor is ASCII-only on purpose: the refusal message carries an em dash, and PowerShell
# 5.1 decodes an un-BOMed script with the system codepage, so a pattern containing one cannot
# match the file and the probe reports DID NOT APPLY - which reads like a moved target.
Probe -Name 'the wallet is clamped at zero again' `
  -File $WRITER `
  -Find '      if (!decision.ok) {' `
  -Replace '      decision.newBalance = Math.max(0, balanceBefore - amount);
      if (false && !decision.ok) {' `
  -ExpectRed 'refuses a clawback the wallet cannot cover'

# The subtler half, and the one a review passes: the guard is present and the ledger row
# is written first. The refusal then throws inside a transaction that has already stored
# the row for anyone reading it before the abort, and on the non-transactional path the
# row simply stays.
Probe -Name 'the refusal fires after the ledger row is written' `
  -File $WRITER `
  -Find '      if (!decision.ok) {' `
  -Replace '      if (!decision.ok && false) {' `
  -ExpectRed 'refuses a clawback the wallet cannot cover'

# Off-by-one in the direction that matters: `>` instead of `>=` admits a clawback one
# credit past the balance, which is the whole class in miniature.
Probe -Name 'the rule allows the balance to go one credit negative' `
  -File $MATH `
  -Find '  const newBalance = round2((currentBalance || 0) - amount);
  if (newBalance < 0) {' `
  -Replace '  const newBalance = round2((currentBalance || 0) - amount);
  if (newBalance < -1) {' `
  -ExpectRed 'the exact balance is allowed, a credit more is not'

Write-Host "`n=== R84: the refusal has to be visible ===" -ForegroundColor Cyan

# Throwing and recording nothing. The operator sees a toast, the case shows no attempt,
# and the next operator repeats it - the R40 rule that a path with no record has no
# attribution, one layer along.
Probe -Name 'the refused attempt leaves no trace on the case' `
  -File $WRITER `
  -Find '      await recordRefusedClawback(c, admin, actorName, input, err, now);' `
  -Replace '      void recordRefusedClawback;' `
  -ExpectRed 'records the refused attempt on the case'

Write-Host "`n=== R84: one reading of the rule ===" -ForegroundColor Cyan

# The Atlas route growing its own copy back. It had one until this fix - the inline
# version and the canonical function agreed by luck, and the chargeback writer, which
# had a third reading, did not.
Probe -Name 'the Atlas route decides for itself again' `
  -File $ATLAS `
  -Find '    const decision = evaluateClawback({' `
  -Replace '    const decision = ((i: { currentBalance: number; grantedCredits: number; requestedAmount?: number }) => ({ ok: true as const, amount: i.requestedAmount ?? i.grantedCredits, newBalance: i.currentBalance - (i.requestedAmount ?? i.grantedCredits), error: "" }))({' `
  -ExpectRed 'decides through evaluateClawback'

# The import kept and the call dropped, which is the form a `not.toContain` on the bare
# identifier cannot see.
Probe -Name 'the chargeback writer imports the rule and does not call it' `
  -File $WRITER `
  -Find '      const decision = evaluateClawback({' `
  -Replace '      const decision = ((i: { currentBalance: number; requestedAmount: number }) => ({ ok: true as const, amount: i.requestedAmount, newBalance: i.currentBalance - i.requestedAmount, error: "" }))({' `
  -ExpectRed 'decides through evaluateClawback'

Write-Host "`nDone.`n" -ForegroundColor Cyan
