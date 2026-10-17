# Re-probes only the three guards that stayed green on the first pass.
$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

function Relax([string]$literal) { [regex]::Escape($literal) -replace '\r?\n', '\r?\n' }

function Probe {
  param([string]$Name, [string]$File, [string]$Find, [string]$Replace, [string]$Suite, [string]$ExpectRed)

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

Write-Host "`n=== the three that stayed green first time ===" -ForegroundColor Cyan

Probe -Name 'the pool is not reduced by the refunded fees' `
  -File 'lib/services/settlement/provider-settlement.service.ts' `
  -Find '    prizePool = Math.max(0, prizePool - refund.totalRefunded);' `
  -Replace '    prizePool = Math.max(0, prizePool);' `
  -Suite '__tests__/services/provider-settlement.test.ts' `
  -ExpectRed 'reduces the pool even when the integrity cap cannot do it for us'

Probe -Name 'a refusal commits and never releases the claim (the stranding bug)' `
  -File 'lib/services/settlement/provider-finalize.ts' `
  -Find '    if (!result.success) {
      await session.abortTransaction();' `
  -Replace '    if (false) {
      await session.abortTransaction();' `
  -Suite '__tests__/services/provider-settlement-late-hold.test.ts' `
  -ExpectRed 'RELEASES the claim so the contest can be settled later'

Probe -Name 'the in-transaction hold check is removed entirely' `
  -File 'lib/services/settlement/provider-settlement.service.ts' `
  -Find '  if (assessment.blocksSettlement) {' `
  -Replace '  if (assessment.blocksSettlement && false) {' `
  -Suite '__tests__/services/provider-settlement-late-hold.test.ts' `
  -ExpectRed 'commits nothing - no prize, no fee, no completion'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
