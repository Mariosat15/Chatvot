# Probes for the Gamemaster Program v2 (External game plans/24).
#
# Same harness as probe-gamemaster-creation.ps1, with its paid-for lessons: -LiteralPath and
# UTF-8 without a BOM on the read AND the write; refuse to write when the read came back
# empty; confirm the file actually changed; judge by the summary of a single filtered test.
# 1-2 tests red is the honest number for a one-line change.
#
# Usage: powershell -NoProfile -File tools/probe-gm-program.ps1 > probe.log; then read it.

$ErrorActionPreference = "Continue"
$enc = New-Object System.Text.UTF8Encoding($false)
$suite = "__tests__/services/gm-referral-foundations.test.ts"
$results = @()

function Invoke-Probe {
    param(
        [string]$Name,
        [string]$File,
        [string]$From,
        [string]$To,
        [string]$TestName,
        [string]$Suite = $suite
    )

    Write-Host ""
    Write-Host "PROBE: $Name" -ForegroundColor Cyan

    $path = (Resolve-Path -LiteralPath $File).Path
    $original = [System.IO.File]::ReadAllText($path, $enc)

    if ([string]::IsNullOrEmpty($original)) {
        Write-Host "  HARNESS BROKEN: read $File as empty - refusing to write" -ForegroundColor Magenta
        return [pscustomobject]@{ Name = $Name; Outcome = "HARNESS BROKEN" }
    }
    if (-not $original.Contains($From)) {
        Write-Host "  DID NOT APPLY: pattern absent from $File" -ForegroundColor Yellow
        return [pscustomobject]@{ Name = $Name; Outcome = "DID NOT APPLY" }
    }

    $mutated = $original.Replace($From, $To)
    [System.IO.File]::WriteAllText($path, $mutated, $enc)

    $onDisk = [System.IO.File]::ReadAllText($path, $enc)
    if ($onDisk -eq $original) {
        Write-Host "  HARNESS BROKEN: file unchanged after write" -ForegroundColor Magenta
        return [pscustomobject]@{ Name = $Name; Outcome = "HARNESS BROKEN" }
    }

    try {
        $raw = & npx vitest run $Suite -t $TestName 2>&1 | Out-String
        $out = $raw -replace '\s+', ' '
    }
    finally {
        [System.IO.File]::WriteAllText($path, $original, $enc)
    }

    if ($out -match 'No test files found' -or $out -match 'Tests\s+no tests') {
        $outcome = "PROBE BROKEN (no test ran)"
    }
    elseif ($out -match 'Tests\s+(\d+)\s+failed') {
        $outcome = "RED ($($Matches[1]) failed)"
    }
    elseif ($out -match 'Tests\s+\d+\s+passed') {
        $outcome = "GREEN - guard useless"
    }
    else {
        $outcome = "PROBE BROKEN (unreadable summary)"
    }
    Write-Host "  $outcome"
    return [pscustomobject]@{ Name = $Name; Outcome = $outcome }
}

$LINK = "lib/services/gamemaster/referral-link.ts"
$CALC = "lib/services/settlement/game-master-fees/calculate.ts"
$SYNC = "apps/admin/app/api/gamemasters/sync-referrals/route.ts"

# ---- Step 0: referral foundations ------------------------------------------------------

# 1. The 404 link, restored in the one helper.
$results += Invoke-Probe `
    -Name "Referral link points at /register again" `
    -File $LINK `
    -From 'export const REFERRAL_SIGNUP_PATH = "/sign-up";' `
    -To 'export const REFERRAL_SIGNUP_PATH = "/register";' `
    -TestName "points at the sign-up page that actually exists"

# 2. A reader goes back to the stored field, which still holds /register on old rows.
$results += Invoke-Probe `
    -Name "Status route reads the stored referralLink" `
    -File "app/api/gamemaster/status/route.ts" `
    -From 'referralLink: buildReferralLink(subscription.referralCode),' `
    -To 'referralLink: subscription.referralLink,' `
    -TestName "app/api/gamemaster/status/route.ts calls buildReferralLink"

# 3. The R68 shape back in settlement: the `id` field alone.
$results += Invoke-Probe `
    -Name "Settlement fallback looks users up by the id field only" `
    -File $CALC `
    -From '        userIdFilter(participantUserIds),' `
    -To '        { id: { $in: participantUserIds } },' `
    -TestName "pays the Game Master named on the user document"

# 4. DELIBERATELY UNPROBED. The `requestedIds` check in buildReferralMap and the
# `isParticipant` filter in calculateGameMasterFees cover each other: removing either
# alone changes no payout, so a probe of one reports green and teaches the next reader
# that the guard is decoration. Removing both needs two edits, which this harness does
# not do. The behavioural test "does not key a referral under an id the caller did not
# ask about" still pins the combined property.

# 5. Precedence reversed: the stale user field overwrites the UserReferral row.
$results += Invoke-Probe `
    -Name "UserReferral loaded before the fallback" `
    -File $CALC `
    -From '  const requestedIds = new Set(participantUserIds);' `
    -To '  const requestedIds = new Set(participantUserIds);
  for (const ref of userReferrals) referralMap.set(ref.userId, { gmId: ref.gameMasterId, userName: "", userEmail: "" });
  userReferrals.length = 0;' `
    -TestName "still lets the UserReferral row override the fallback"

# 6. The admin copy of the settlement stage drifts - the one that runs on the admin cron.
$results += Invoke-Probe `
    -Name "Admin copy of calculate.ts drifts" `
    -File "apps/admin/$CALC" `
    -From 'const DEFAULT_REFERRAL_FEE_PERCENTAGE = 5;' `
    -To 'const DEFAULT_REFERRAL_FEE_PERCENTAGE = 6;' `
    -TestName "lib/services/settlement/game-master-fees/calculate.ts"

# 7. sync-referrals updates by the id field again.
$results += Invoke-Probe `
    -Name "sync-referrals updates by the id field" `
    -File $SYNC `
    -From '          { _id: user._id },' `
    -To '          { id: referral.userId },' `
    -TestName "uses userIdFilter for every user lookup and updates by _id"

# 8. sync-referrals leaks database error text again.
$results += Invoke-Probe `
    -Name "sync-referrals echoes the per-user error message" `
    -File $SYNC `
    -From '`Error with user ${referral.userId}`,' `
    -To '`Error with user ${referral.userId}: ${err instanceof Error ? err.message : ""}`,' `
    -TestName "never echoes an error message to the caller"

# ---- Step 1: data model ----------------------------------------------------------------

$DM = "__tests__/services/gm-program-data-model.test.ts"
$MIG = "tools/gamemaster/backfill-affiliation-source-core.ts"

# 9. Visibility becomes editable - a private contest could be flipped public after entry.
$results += Invoke-Probe `
    -Name "visibility dropped from NEVER_EDITABLE_FIELDS" `
    -File "apps/admin/lib/admin/competition-update-fields.ts" `
    -From '  "visibility",' `
    -To '' `
    -TestName "visibility can never be edited after creation" -Suite $DM

# 10. An unknown stored visibility fails OPEN (R117 - a private contest leaks).
$results += Invoke-Probe `
    -Name "resolveCompetitionVisibility fails open" `
    -File "lib/services/gamemaster/competition-visibility.ts" `
    -From 'return stored === "public" ? "public" : "gm_private";' `
    -To 'return "public";' `
    -TestName "fails CLOSED on an unknown stored value" -Suite $DM

# 11. The admin copy of the vocabulary drifts.
$results += Invoke-Probe `
    -Name "Admin competition-visibility.ts drifts" `
    -File "apps/admin/lib/services/gamemaster/competition-visibility.ts" `
    -From 'export const DEFAULT_COMPETITION_VISIBILITY: CompetitionVisibility = "public";' `
    -To 'export const DEFAULT_COMPETITION_VISIBILITY: CompetitionVisibility = "gm_private";' `
    -TestName "lib/services/gamemaster/competition-visibility.ts matches its admin copy" -Suite $DM

# 12. The implicit [] default returns on a subscription's allowedVisibility.
$results += Invoke-Probe `
    -Name "default: undefined removed from subscription allowedVisibility" `
    -File "database/models/gamemaster/gamemaster-subscription.model.ts" `
    -From '        default: undefined,' `
    -To '' `
    -TestName "the allowed-visibility arrays enumerate the same values and carry NO default" -Suite $DM

# 13. The signup writer stops labelling its source (R7 - raw insert, no default).
$results += Invoke-Probe `
    -Name "Signup referral insert loses its source" `
    -File "lib/actions/auth.actions.ts" `
    -From '                    source: "gm_referral_link" satisfies AffiliationSource,' `
    -To '' `
    -TestName "the signup writer stores gm_referral_link with the signup surface" -Suite $DM

# 14. "Create missing indexes" would rebuild the plain unique userId_1 and block D4.
$results += Invoke-Probe `
    -Name "required-indexes names userId_1 again" `
    -File "apps/admin/app/api/admin/database/indexes/required-indexes.ts" `
    -From '        name: "userId_active_unique",' `
    -To '        name: "userId_1",' `
    -TestName "the admin index list no longer rebuilds a plain unique userId_1" -Suite $DM

# 15. The schema index loses its partial filter - an ended row blocks re-joining.
$results += Invoke-Probe `
    -Name "UserReferral index loses partialFilterExpression" `
    -File "database/models/user-referral.model.ts" `
    -From '    partialFilterExpression: { isActive: true },' `
    -To '' `
    -TestName "allows a new active row once the previous one has ended" -Suite $DM

# 16. The backfill loses its missing filter and overwrites a stored chartvolt_join_gm.
$results += Invoke-Probe `
    -Name "Backfill labels every row, not only missing ones" `
    -File $MIG `
    -From '  const filter = missingStringFilter("source");' `
    -To '  const filter = {};' `
    -TestName "labels all three missing shapes and never overwrites a stored source" -Suite $DM

# 17. The duplicate-active refusal is removed; the build then fails mid-migration.
$results += Invoke-Probe `
    -Name "Backfill builds the index despite duplicate active rows" `
    -File $MIG `
    -From '  if (duplicateActiveUsers > 0) {' `
    -To '  if (false) {' `
    -TestName "refuses the index build while a user holds two active rows" -Suite $DM

# 18. DELIBERATELY UNPROBED. Dropping the `has(ACTIVE_REFERRAL_INDEX_NAME)` half of the drop
# guard changes no observable: the create step directly above always leaves the new index
# present, so the half is a tripwire for a future reordering rather than a live branch.

Write-Host ""
Write-Host "================ SUMMARY ================"
$results | Format-Table -AutoSize
$bad = @($results | Where-Object { $_.Outcome -notlike "RED*" })
if ($bad.Count -gt 0) {
    Write-Host "$($bad.Count) probe(s) did NOT come back red - read each one."
}
else {
    Write-Host "All $($results.Count) probes red on the expected test."
}
