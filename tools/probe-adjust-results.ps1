# Probes `__tests__/admin/adjust-results.test.ts` - the six defects in the operator's correction
# of a settled result.
#
# Same harness shape as `probe-opponent-picker.ps1` - see that file for the encoding notes
# (read/write UTF-8 without a BOM, ASCII-only anchors, and the rule that PROBE DID NOT APPLY
# means the target moved rather than that the run was quiet).
#
# EVERY PROBE HERE IS BEHAVIOURAL EXCEPT THE LAST THREE. That is deliberate and is the whole
# point of the suite: each defect was a branch that ran, wrote something and returned a
# cheerful result row, so mutating the source and asking whether the file still LOOKS right
# proves nothing. The mutations below restore the real defect and the test reads the balance,
# the ledger and the stored snapshot afterwards.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/admin/adjust-results.test.ts'
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

$ROUTE = 'apps/admin/app/api/competitions/[id]/adjust-results/route.ts'
$MODEL = 'database/models/trading/wallet-transaction.model.ts'

Write-Host "`n=== defect 6: the two fields the schema has not got ===" -ForegroundColor Cyan

# The prize baseline read off the participant again. Always `undefined`, so correcting a winner
# paid 100 down to 40 CREDITS 40 rather than reclaiming 60. The most expensive of the six, and
# invisible in the source: the expression reads perfectly and the field simply is not there.
Probe -Name 'the prize baseline reads a field the participant has not got' `
  -File $ROUTE `
  -Find '        const previousPrize = snapshotRow?.prizeAmount || 0;' `
  -Replace '        const previousPrize = (participant as { prizeWon?: number }).prizeWon || 0;' `
  -ExpectRed 'prices a correction against the prize that was recorded'

# The rank written to `finalRank` again. Strict mode discards it, so the correction moves
# nothing at all - including the win and podium counts, which read `currentRank`.
Probe -Name 'a rank change is written to an undeclared field' `
  -File $ROUTE `
  -Find '          participant.currentRank = adj.newRank;' `
  -Replace '          (participant as { finalRank?: number }).finalRank = adj.newRank;' `
  -ExpectRed 'writes a rank change to the field the platform counts wins on'

# The refusal removed, so a contest with no stored leaderboard is read as a zero prize. That is
# the wrong reading of "we do not know": a player who may already hold 100 is credited the
# full 40 and the route reports success.
Probe -Name 'a contest with no recorded result is read as a zero prize' `
  -File $ROUTE `
  -Find '          !snapshotRow &&
          (adj.disqualify || adj.newPrize !== undefined)' `
  -Replace '          false' `
  -ExpectRed 'refuses to move money on a contest that stored no snapshot'

Write-Host "`n=== defect 5: the ledger types ===" -ForegroundColor Cyan

# The enum values removed. A missing enum value rejects the WHOLE document, so
# `WalletTransaction.create` throws, the per-adjustment catch files it as a row-level error and
# the route commits anyway - with the wallet `$inc` above already applied. Credits move, no
# ledger row exists, and `participant.save()` never runs because the throw precedes it.
Probe -Name 'the adjustment ledger types are undeclared again' `
  -File $MODEL `
  -Find '      "prize_reclaim",' `
  -Replace '' `
  -ExpectRed 'records a clawback when a paid player is disqualified'

Probe -Name 'the prize-increase ledger type is undeclared again' `
  -File $MODEL `
  -Find '      "prize_adjustment_add",' `
  -Replace '' `
  -ExpectRed 'records a prize increase'

Probe -Name 'the prize-reduction ledger type is undeclared again' `
  -File $MODEL `
  -Find '      "prize_adjustment_deduct",' `
  -Replace '' `
  -ExpectRed 'records a prize reduction'

Write-Host "`n=== defect 1: the half-applied disqualification ===" -ForegroundColor Cyan

# The original defect verbatim: the status is set, the clawback is attempted only if it happens
# to be possible, and an impossible one is skipped in silence while the row says `disqualified`.
Probe -Name 'a short balance skips the clawback instead of refusing' `
  -File $ROUTE `
  -Find '            if (wallet.creditBalance < previousPrize) {' `
  -Replace '            if (false) {' `
  -ExpectRed 'refuses when the balance is short'

Probe -Name 'a missing wallet skips the clawback instead of refusing' `
  -File $ROUTE `
  -Find '            if (!wallet) {
              results.push({' `
  -Replace '            if (false) {
              results.push({' `
  -ExpectRed 'refuses when the player has no wallet'

# The refusal widened to every disqualification rather than scoped to one that owes money. The
# commonest case there is - an unpaid player, who has no wallet because they have never held a
# credit - would be refused, which is a guard that fires on correct operator behaviour.
Probe -Name 'the refusal is not scoped to a clawback that is owed' `
  -File $ROUTE `
  -Find '          if (previousPrize > 0) {' `
  -Replace '          if (true) {' `
  -ExpectRed 'disqualifies an unpaid player with no wallet'

Write-Host "`n=== defect 2: the prize change with no wallet ===" -ForegroundColor Cyan

# The whole block back inside `if (wallet)`. A player with no wallet had no credit moved, no
# ledger row and no notification - and was reported as success with the full prize change,
# which went into the incident's permanent audit trail as fact.
Probe -Name 'an increase for a walletless player creates nothing' `
  -File $ROUTE `
  -Find '            if (!wallet) {
              const created = await CreditWallet.create(' `
  -Replace '            if (false) {
              const created = await CreditWallet.create(' `
  -ExpectRed 'creates the wallet for an increase'

# The reduction refusal removed. There is nothing to take, so the fabricated wallet is created
# at zero and immediately fails the balance check below - a different refusal for a different
# reason, which is how a wrong diagnosis reaches the operator.
Probe -Name 'a reduction for a walletless player is not refused on its own terms' `
  -File $ROUTE `
  -Find '            if (!wallet && prizeDiff < 0) {' `
  -Replace '            if (false) {' `
  -ExpectRed 'refuses a reduction, because there is nothing to take'

# The reported figure taken from the request rather than from what moved.
#
# NOT `adj.newPrize - previousPrize`, which was the first spelling of this probe and came back
# GREEN - the fourth cause, a mutation that changes no observable. Now that defects 1 and 2
# REFUSE rather than skipping, there is no surviving path on which the requested figure and the
# applied one can differ, so the two expressions agree everywhere. `appliedPrizeChange` earns
# its place by keeping them that way if a future path ever skips again; what the test can see
# is a figure that is not a CHANGE at all, which is what the mutation below reports.
Probe -Name 'the row reports the new prize rather than the change' `
  -File $ROUTE `
  -Find '          prizeChange: appliedPrizeChange,' `
  -Replace '          prizeChange: adj.newPrize ?? 0,' `
  -ExpectRed 'reports the prize change that was APPLIED'

Write-Host "`n=== defect 3: the double count ===" -ForegroundColor Cyan

# The baseline captured before the clawback again. Disqualifying and re-pricing in one
# adjustment reclaimed 100 and then tried to take a further 75, so the player ended at 0 with
# the audit line claiming -75.
Probe -Name 'a re-price after a clawback is priced against the old prize' `
  -File $ROUTE `
  -Find '          const basePrize = heldPrize;' `
  -Replace '          const basePrize = previousPrize;' `
  -ExpectRed 'prices the change against what the player holds NOW'

Write-Host "`n=== defect 4: the stored snapshot ===" -ForegroundColor Cyan

# The snapshot write removed. `SettledResultPanel` captions that table as the amounts paid, so
# a corrected rank or prize appeared nowhere an operator looks and the pre-adjustment figures
# stayed on screen as fact.
Probe -Name 'the snapshot is not carried with the participant' `
  -File $ROUTE `
  -Find '      if (snapshotRowsUpdated > 0) {' `
  -Replace '      if (false) {' `
  -ExpectRed 'carries the corrected rank and prize'

Probe -Name 'a disqualification is not marked in the snapshot' `
  -File $ROUTE `
  -Find '          row.qualificationStatus = "disqualified";' `
  -Replace '' `
  -ExpectRed 'marks a disqualified player in the snapshot'

Write-Host "`n=== the gate and the guards ===" -ForegroundColor Cyan

# The gate readmitting a cancelled contest. Every entry fee has already been refunded, so a
# prize adjustment there pays out of a pool that was returned to the players.
Probe -Name 'a cancelled contest may be adjusted' `
  -File $ROUTE `
  -Find '    if (competition.status !== "completed") {' `
  -Replace '    if (false) {' `
  -ExpectRed 'refuses a cancelled contest'

# The unreachable status name back in the refusal, which is the change somebody makes to
# "restore" a state the model declares.
Probe -Name 'the gate names a state no contest can be in' `
  -File $ROUTE `
  -Find '    if (competition.status !== "completed") {' `
  -Replace '    if (!["completed", "emergency_ended"].includes(competition.status)) {' `
  -ExpectRed 'does not name a state no contest can be in'

# The section grant dropped for a caller that is merely an admin - the ninth instance of that
# class here and the natural helper to reach for.
#
# The mutation keeps the module IMPORTABLE on purpose. Replacing the call with an undefined
# helper turns 18 tests red rather than 1, and a probe reporting more damage than it caused is
# not reporting on the guard.
Probe -Name 'the route authenticates on admin-at-all' `
  -File $ROUTE `
  -Find '    const guard = await guardSection("competitions");' `
  -Replace '    const guard = { ok: true as const, admin: { id: "any-admin" } };' `
  -ExpectRed 'is granted per section, on every exported handler'

# One validation refusal returning without aborting. Invisible until the session is ended under
# the open transaction, and satisfied by the neighbours in any presence check.
Probe -Name 'a validation refusal leaks the transaction' `
  -File $ROUTE `
  -Find '    if (!incidentId) {
      await mongoSession.abortTransaction();' `
  -Replace '    if (!incidentId) {' `
  -ExpectRed 'aborts the transaction on every refusal'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
