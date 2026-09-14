# Probes `__tests__/services/wallet-writer-inventory.test.ts` - the tripwire that a new
# wallet-balance writer cannot be added without somebody answering the ledger question.
#
# Same harness shape as `probe-reconciliation-money.ps1` - see that file for the encoding
# notes (read/write UTF-8 without a BOM, ASCII-only anchors, and the rule that PROBE DID NOT
# APPLY means the target moved rather than that the run was quiet).
#
# One clause is deliberately UNPROBED and the reason is recorded at the foot of this file.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/services/wallet-writer-inventory.test.ts'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Relax([string]$literal) { [regex]::Escape($literal) -replace '\r?\n', '\r?\n' }

function Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectRed,
    [string]$Suite = $SUITE,
    # Some mutations need every occurrence, not the first: removing a file's ledger
    # writer means removing the import and the create together, and a one-shot
    # replace leaves the identifier in the file for the guard to find.
    [switch]$All
  )

  $path = Join-Path (Get-Location) $File
  $original = [System.IO.File]::ReadAllText($path, $Utf8NoBom)

  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "  [READ FAILED - REFUSING TO WRITE] $Name" -ForegroundColor Magenta
    return
  }

  # Built explicitly rather than through the static helper: PowerShell resolves
  # [regex]::Replace(input, pattern, replacement, int) to the RegexOptions overload and
  # throws, which left $patched null and wrote an EMPTY FILE while every probe still
  # reported red - the "a probe that reports more damage than it caused" trap.
  $rx = [regex]::new((Relax $Find))
  $rep = $Replace.Replace('$', '$$')
  $patched = if ($All) { $rx.Replace($original, $rep) } else { $rx.Replace($original, $rep, 1) }

  if ([string]::IsNullOrEmpty($patched)) {
    Write-Host "  [PATCH PRODUCED NOTHING - REFUSING TO WRITE] $Name" -ForegroundColor Magenta
    return
  }
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

$FEES = 'lib/services/settlement/fees.service.ts'
$NUVEI = 'app/api/nuvei/withdrawal/route.ts'
$WITHDRAWAL = 'lib/services/withdrawal.service.ts'
$UNSCORED = 'lib/services/settlement/unscored-refund.ts'

Write-Host "`n=== a wallet writer arriving in a file nobody has reviewed ===" -ForegroundColor Cyan

# The case the whole file exists for. `fees.service.ts` is a settlement stage that today reads
# balances and never writes one, which is exactly the sort of file a balance change gets added
# to - it is already in the money layer, so the addition reviews as belonging there.
Probe -Name 'a new balance writer appears in an unlisted file' `
  -File $FEES `
  -Find 'export async function settleFeesAndGameMasters({' `
  -Replace 'async function probeCreditWriter(w: { creditBalance: number }) {
  w.creditBalance += 1;
}

export async function settleFeesAndGameMasters({' `
  -ExpectRed 'has no wallet-balance writer outside the inventory'

Write-Host "`n=== a second writer landing beside an existing correct one (R85's shape) ===" -ForegroundColor Cyan

# R85 in miniature. The file is already inventoried and already writes a ledger row, so a
# file-list guard is satisfied and the ledger clause is satisfied; only the COUNT moves. This
# is the probe that justifies counting rather than listing.
Probe -Name 'an extra $inc is added to an inventoried file' `
  -File $WITHDRAWAL `
  -Find 'import ' `
  -Replace 'async function probeSecondWriter(w: { creditBalance: number }) {
  w.creditBalance -= 1;
}
import ' `
  -ExpectRed 'agrees with the codebase on how many writers each file has'

# And the other direction. A writer REMOVED is not a defect, but an inventory that has stopped
# matching the code is no longer evidence of anything, so it has to be corrected rather than
# drifting quietly. Eight sites down to seven, so the file stays an offender and only the count
# clause moves.
Probe -Name 'a writer is removed from a multi-site file' `
  -File $NUVEI `
  -Find '      { $inc: { creditBalance: -creditsNeeded } },' `
  -Replace '      {},' `
  -ExpectRed 'agrees with the codebase on how many writers each file has'

Write-Host "`n=== an inventory entry that has stopped protecting anything ===" -ForegroundColor Cyan

# The R60 canary rule. A listed file that no longer writes a balance reads as a reviewed,
# known writer for ever while its count guards nothing. This file has exactly one site, so
# removing it drops the file out of the scan entirely.
Probe -Name 'an inventoried file stops writing a balance at all' `
  -File $WITHDRAWAL `
  -Find 'creditBalance' `
  -Replace 'probeRenamedBalance' `
  -All `
  -ExpectRed 'has no stale inventory entry'

Write-Host "`n=== a balance moved and no ledger row was written ===" -ForegroundColor Cyan

# The R78-R86 defect itself, stated as bluntly as a structural test can state it: the file
# still moves a balance and no longer mentions a transaction anywhere. Every occurrence has to
# go - the import, the prior-refund read, the create and the read-back - because one surviving
# mention satisfies the clause.
Probe -Name 'a writer file stops naming WalletTransaction' `
  -File $UNSCORED `
  -Find 'WalletTransaction' `
  -Replace 'ProbeLedgerRow' `
  -All `
  -ExpectRed 'only claims to write a ledger row where one is written'

Write-Host "`n=== an exemption with no reason ===" -ForegroundColor Cyan

# A file may legitimately move a balance without a ledger row - the reconciliation repair and
# the test-data reset both do - but an exemption nobody had to justify is how the rule gets
# widened one silent entry at a time.
Probe -Name 'a no-ledger exemption is left unexplained' `
  -File $SUITE `
  -Find '    reason:
      "It repairs a wallet to agree with the ledger. A transaction row here would " +
      "change the figure it is reconciling against, so the repair could never converge. " +
      "R81 is why it may only ever raise a balance.",' `
  -Replace '    reason: "",' `
  -ExpectRed 'gives a reason for every file that writes no ledger row'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan

# DELIBERATELY UNPROBED: "finds the writers at all".
#
# That clause exists so a broken scan cannot make every assertion below it pass vacuously -
# if a pattern stops matching or a scan root is renamed, `found` empties and the tripwire is
# switched off in silence. Probing it means emptying `found`, which turns three tests red at
# once, so a probe would report success against a mutation it cannot attribute. It is the
# sanity clause for the others rather than a claim of its own, and the honest thing is to say
# so here rather than ship a probe whose green reads as evidence.
