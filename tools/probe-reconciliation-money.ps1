# Probes `__tests__/admin/reconciliation-money-guards.test.ts` - the five money defects the
# financial reconciliation screen exposed (R78-R82).
#
# Same harness shape as `probe-opponent-picker.ps1` - see that file for the encoding notes
# (read/write UTF-8 without a BOM, ASCII-only anchors, and the rule that PROBE DID NOT APPLY
# means the target moved rather than that the run was quiet).
#
# Every probe here restores a defect that was LIVE or was reachable over HTTP, so the restore
# is checked after each one and a failed read refuses to write.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/admin/reconciliation-money-guards.test.ts'
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

$PAYOUT = 'lib/services/settlement/prize-payout.service.ts'
$PAYOUT_ADMIN = 'apps/admin/lib/services/settlement/prize-payout.service.ts'
$VOCAB = 'lib/services/settlement/types.ts'
$DISTRIBUTE = 'lib/services/settlement/game-master-fees/distribute.ts'
$CHALLENGES = 'apps/admin/app/api/challenges/route.ts'
$RECON = 'apps/admin/app/api/reconciliation/route.ts'
$SCREEN = 'apps/admin/components/admin/ReconciliationSection.tsx'

Write-Host "`n=== R78: which lifetime counter a prize credits ===" -ForegroundColor Cyan

# The defect verbatim. The balance is right, the ledger row is right, and two lifetime figures
# are wrong in opposite directions by exactly the prize - which is what the screen reported.
Probe -Name 'the prize stage names the competition counter again' `
  -File $PAYOUT `
  -Find '          [vocabulary.walletWinField]: prizeAmount,' `
  -Replace '          totalWonFromCompetitions: prizeAmount,' `
  -ExpectRed 'increments the counter the vocabulary chooses, in both copies'

# The admin copy alone. `check:mirrors` compares MODELS, so it has no opinion about this file
# pair, and fixing one copy while the other pays every contest the admin cron claims first is
# R26 and R42's shape - which is why the assertion loops over both.
Probe -Name 'only the main copy was fixed' `
  -File $PAYOUT_ADMIN `
  -Find '          [vocabulary.walletWinField]: prizeAmount,' `
  -Replace '          totalWonFromCompetitions: prizeAmount,' `
  -ExpectRed 'increments the counter the vocabulary chooses, in both copies'

# The indirection kept and the answer collapsed. This is the fix that reviews as correct: the
# stage reads `vocabulary.walletWinField` exactly as demanded, and both kinds point at the same
# field, so the defect is intact behind one more layer.
Probe -Name 'both contest kinds name the same counter' `
  -File $VOCAB `
  -Find '  walletWinField: "totalWonFromChallenges",' `
  -Replace '  walletWinField: "totalWonFromCompetitions",' `
  -ExpectRed 'gives the two contest kinds two different counters'

Write-Host "`n=== R79: the admin challenge cancel and its ledger row ===" -ForegroundColor Cyan

# The defect verbatim: credit the wallet, write nothing. The player's balance is correct and
# unattributable, and reconciliation then reports a balance ABOVE the ledger - which is the
# state R81's Fix button used to resolve by deleting the credits.
Probe -Name 'the refund writes no transaction row' `
  -File $CHALLENGES `
  -Find '  await WalletTransaction.create(' `
  -Replace '  await Promise.resolve(' `
  -ExpectRed 'writes a challenge_refund transaction beside the wallet credit'

# `referenceId` instead of `challengeId`. Strict mode discards the undeclared name while the
# write reports success, so the refund lands with no way to join it to its challenge - the exact
# defect Stage 0 found on nine challenge writers at once.
Probe -Name 'the row is attributed to a field the schema does not declare' `
  -File $CHALLENGES `
  -Find '        challengeId,
' `
  -Replace '        referenceId: challengeId,
' `
  -ExpectRed 'writes a challenge_refund transaction beside the wallet credit'

# The loop unrolled back into two blocks. This is how the challenger got a row and the
# challenged user did not in the first draft, and each block reads perfectly on its own.
Probe -Name 'the two seats are refunded by two separate call sites' `
  -File $CHALLENGES `
  -Find '            for (const userId of [
              challenge.challengerId,
              challenge.challengedId,
            ]) {' `
  -Replace '            for (const userId of [challenge.challengerId]) {' `
  -ExpectRed 'refunds both seats through the one helper'

# `totalRefunded` dropped. The wallet and the ledger agree, so no reconciliation check can see
# it - the counter simply understates for ever.
Probe -Name 'the refund does not count towards totalRefunded' `
  -File $CHALLENGES `
  -Find '        totalRefunded: entryFee,' `
  -Replace '' `
  -ExpectRed 'writes a challenge_refund transaction beside the wallet credit'

Write-Host "`n=== R80: the deleted second money writer ===" -ForegroundColor Cyan

# The action restored in its smallest recognisable form. It paid a prize with no ledger row, no
# lifetime counter, no platform fee, no Game Master share and no lock, on a route that had no
# authorization of any kind and no UI caller - reachable only over HTTP.
Probe -Name 'force_complete is reintroduced' `
  -File $CHALLENGES `
  -Find '      default:
' `
  -Replace '      case "force_complete": {
        await CreditWallet.updateOne(
          { userId: challenge.challengerId },
          { $inc: { creditBalance: challenge.winnerPrize } },
          { session },
        );
        break;
      }

      default:
' `
  -ExpectRed 'has no force_complete action of any kind'

# The GET unguarded while the POST keeps its guard. This is the shape a file-wide check cannot
# see, and this GET hands out every challenge on the platform with both players named.
Probe -Name 'the GET handler loses its section guard' `
  -File $CHALLENGES `
  -Find 'export async function GET(request: NextRequest) {
  const guard = await guardSection("challenges");
  if (!guard.ok) return guard.response;' `
  -Replace 'export async function GET(request: NextRequest) {' `
  -ExpectRed 'guards every exported handler with the challenges section'

# `requireAdminAuth`-style widening: a guard that asks whether the caller is an admin at all
# rather than whether they hold the section. Ninth instance of that class in this programme.
Probe -Name 'the POST guard names a different section' `
  -File $CHALLENGES `
  -Find 'export async function POST(request: NextRequest) {
  const guard = await guardSection("challenges");' `
  -Replace 'export async function POST(request: NextRequest) {
  const guard = await guardSection("overview");' `
  -ExpectRed 'guards every exported handler with the challenges section'

Write-Host "`n=== R81: the Fix button that deleted a player's credits ===" -ForegroundColor Cyan

# The defect verbatim: trust the ledger absolutely and overwrite the balance in both directions.
# On the account in the owner's screenshot that is 20 credits confiscated, irreversibly, with no
# transaction recording it and no record of what the player used to hold.
Probe -Name 'the fix applies in the destructive direction' `
  -File $RECON `
  -Find '        if (rounded < previousBalance - 0.01) {' `
  -Replace '        if (false) {' `
  -ExpectRed 'aborts and returns 409 when the correction would reduce the balance'

# The comparison reversed, which is the change somebody makes when they read the guard as "only
# apply a repair that does not move much". It refuses every safe repair and applies every
# destructive one, and the diff is one character.
Probe -Name 'the guard refuses the safe direction instead' `
  -File $RECON `
  -Find '        if (rounded < previousBalance - 0.01) {' `
  -Replace '        if (rounded > previousBalance + 0.01) {' `
  -ExpectRed 'aborts and returns 409 when the correction would reduce the balance'

# The refusal after the write. The transaction is already open and the abort still rolls it
# back, but the ordering is the guarantee - and asserting only that a guard exists is green here.
Probe -Name 'the write happens before the refusal' `
  -File $RECON `
  -Find '        if (rounded < previousBalance - 0.01) {
          await session.abortTransaction();' `
  -Replace '        await CreditWallet.updateOne({ userId }, { $set: { creditBalance: rounded } }, { session });
        if (rounded < previousBalance - 0.01) {
          await session.abortTransaction();' `
  -ExpectRed 'aborts and returns 409 when the correction would reduce the balance'

# A bare refusal with no repair named. An operator who cannot act on a message presses the other
# buttons or edits the database - so the message losing its instruction is a real regression.
Probe -Name 'the refusal stops naming the real repair' `
  -File $RECON `
  -Find 'without a transaction row' `
  -Replace 'in an inconsistent state' `
  -ExpectRed 'names the real repair rather than only refusing'

Write-Host "`n=== R82: the Game Master lifetime counter ===" -ForegroundColor Cyan

# The defect verbatim: pay the Game Master and increment nothing. The field was declared on the
# wallet, rendered on this very screen, and written by no code path anywhere.
Probe -Name 'the GM payout stops maintaining the counter' `
  -File $DISTRIBUTE `
  -Find '{ $inc: { creditBalance: totalEarning, totalGmEarnings: totalEarning } }' `
  -Replace '{ $inc: { creditBalance: totalEarning } }' `
  -ExpectRed 'increments totalGmEarnings in the same update as the balance, in both copies'

# Two updates instead of one. Individually correct, and the pair can diverge on any partial
# failure - at which point each write still reads as right.
Probe -Name 'the counter moves in a second update of its own' `
  -File $DISTRIBUTE `
  -Find '{ $inc: { creditBalance: totalEarning, totalGmEarnings: totalEarning } }' `
  -Replace '{ $inc: { creditBalance: totalEarning }, $set: { totalGmEarnings: totalEarning } }' `
  -ExpectRed 'increments totalGmEarnings in the same update as the balance, in both copies'

# The mask restored. This is why the counter could sit at zero for every Game Master on the
# platform without the screen ever disagreeing with itself: a falsy stored value was replaced by
# the calculated one, so the row was always internally consistent and always wrong.
Probe -Name 'the route substitutes the calculated figure for a zero counter' `
  -File $RECON `
  -Find '    wallet: { ...walletData },' `
  -Replace '    wallet: { ...walletData, totalGmEarnings: walletData.totalGmEarnings || gmEarningsTotal },' `
  -ExpectRed 'reports the STORED counter rather than substituting the calculated one'

# The `gmEarningsTotal > 0` half dropped. Every player who has never been a Game Master
# legitimately stores zero, so the screen warns about nearly every account on the platform -
# and a screen that warns about everybody is one nobody reads.
Probe -Name 'the GM check fires for players who are not Game Masters' `
  -File $RECON `
  -Find '  if (gmEarningsTotal > 0 && gmEarningsDiff > 0.01) {' `
  -Replace '  if (gmEarningsDiff > 0.01) {' `
  -ExpectRed 'raises an issue only for a user who has GM payout rows'

# Only the competition payout row summed. A Game Master earns from referred players' entry fees
# in BOTH competitions and challenges, so the repair halves a partner's recorded lifetime
# earnings - and the repaired figure then looks authoritative.
Probe -Name 'the repair sums only one of the two payout row types' `
  -File $RECON `
  -Find '            $in: ["gamemaster_earning", "gamemaster_challenge_referral"],' `
  -Replace '            $in: ["gamemaster_earning"],' `
  -ExpectRed 'sums BOTH payout row types when it repairs the counter'

Write-Host "`n=== the screen that has to render them ===" -ForegroundColor Cyan

# An issue type the route raises and the screen does not know. It renders with no label and no
# Fix button, so a repairable discrepancy becomes a permanent red badge on the account.
Probe -Name 'the screen does not know the new issue type' `
  -File $SCREEN `
  -Find '  gm_earnings_mismatch: {' `
  -Replace '  gm_earnings_mismatch_typo: {' `
  -ExpectRed 'offers a Fix for each new issue type'

# The GM row's verdict replaced by a fixed icon - the display half of the route's mask. The row
# renders two figures and no opinion about them, however far apart they are.
Probe -Name 'the GM row prints an icon instead of a verdict' `
  -File $SCREEN `
  -Find '{Math.abs(
                                          (user.wallet.totalGmEarnings || 0) -
                                            (user.calculated.gmEarningsTotal ||
                                              0),
                                        ) < 0.01 ? (' `
  -Replace '{true ? (' `
  -ExpectRed 'gives the GM row a verdict rather than a fixed icon'

Write-Host "`n=== R86: the reset that manufactured reconciliation issues ===" -ForegroundColor Cyan

$RESET = 'apps/admin/lib/services/user-data-reset.service.ts'

# The defect verbatim - the seven-counter list. The reset succeeds, the ledger is empty, and two
# of the five survivors are equality-checked, so every affected wallet comes back carrying an
# incident_compensation_mismatch and a gm_earnings_mismatch for activity that no longer exists.
Probe -Name 'the reset leaves the five later counters alone' `
  -File $RESET `
  -Find '          totalAdminCredits: 0,
          totalAdminDebits: 0,
          totalIncidentCompensation: 0,
          totalGmEarnings: 0,
          totalRefunded: 0,
' `
  -Replace '' `
  -ExpectRed 'zeroes every Number path on CreditWallet'

# One counter dropped rather than five. A list-based guard written against the five names known
# today would still pass here if it happened to omit this one, which is the whole reason the
# assertion reads the model's own numeric paths instead.
Probe -Name 'one counter is dropped from the list' `
  -File $RESET `
  -Find '          totalGmEarnings: 0,
' `
  -Replace '' `
  -ExpectRed 'zeroes every Number path on CreditWallet'

Write-Host "`n=== R85: the idempotency guard on the wrong side of the money ===" -ForegroundColor Cyan

# The defect verbatim, and it is the only probe here aimed at a BEHAVIOURAL test rather than a
# structural one: the guard moves back inside the per-referred-player loop, where it skips the
# earning row insert and then falls through to the subscription increment, the wallet credit and
# the ledger row. So `gamemasterearnings` still holds exactly one row per referral - the one
# artefact an operator would check - while the Game Master is paid a second time.
Probe -Name 'the guard skips the rows and pays the money again' `
  -File $DISTRIBUTE `
  -Suite '__tests__/services/admin-finalize-gamemaster-parity.test.ts' `
  -Find '      continue;
    }

    // Divided from the possibly-capped total, so a scaled-down commission is shared
    // proportionally across the referred players rather than paid in full to the first.
    const perUserEarning = totalEarning / users.length;

    for (const user of users) {' `
  -Replace '    }

    // Divided from the possibly-capped total, so a scaled-down commission is shared
    // proportionally across the referred players rather than paid in full to the first.
    const perUserEarning = totalEarning / users.length;

    for (const user of users) {
      if (alreadyPaid) continue;' `
  -ExpectRed 'pays a Game Master once when the fee stage itself is re-run'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
