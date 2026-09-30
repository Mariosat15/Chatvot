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

    # Reason: it.each quotes a $name string, so a probe naming the unquoted title matches
    # nothing and vitest reports every test skipped - which is not a verdict on the guard.
    if ($out -match 'No test files found' -or $out -match 'Tests\s+no tests' -or $out -match 'Tests\s+\d+\s+skipped\s+\(') {
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
$MIG = "lib/services/gamemaster/affiliation-migration.ts"

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

# 13. The signup writer mislabels its source. Re-aimed in step 2: sign-up no longer writes
# `source` itself, it hands the channel to affiliate(), so the mutation is the channel.
$results += Invoke-Probe `
    -Name "Signup hands affiliate() the wrong channel" `
    -File "lib/actions/auth.actions.ts" `
    -From '              channel: "gm_referral_link",' `
    -To '              channel: "chartvolt_join_gm",' `
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
    -From '  const filter = missingSourceFilter();' `
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

# ---- Step 2: the single affiliation writer ---------------------------------------------

$AS = "__tests__/services/gm-affiliation-service.test.ts"
$RULES = "lib/services/gamemaster/affiliation-rules.ts"
$SVC = "lib/services/gamemaster/affiliation.service.ts"

# 19. A Game Master may affiliate with themselves (and so earn on their own entry fees).
$results += Invoke-Probe `
    -Name "Self-affiliation check removed" `
    -File $RULES `
    -From '  if (gm.userId === userId) {' `
    -To '  if (false) {' `
    -TestName "refuses a Game Master affiliating with themselves" -Suite $AS

# 20. D1 undone: a player can move to a second Game Master while the first is active.
$results += Invoke-Probe `
    -Name "Another active Game Master no longer blocks" `
    -File $RULES `
    -From '    if (!ended) {' `
    -To '    if (false) {' `
    -TestName "refuses a second Game Master while the first is active" -Suite $AS

# 21. D4 widened: a merely cancelled Game Master frees the player (commission dodge).
$results += Invoke-Probe `
    -Name "Any non-active previous Game Master frees the player" `
    -File $RULES `
    -From '  if (previousGm.status === "expired") return "gm_expired";' `
    -To '  if (previousGm.status !== "active") return "gm_expired";' `
    -TestName "a cancelled previous Game Master still blocks a move" -Suite $AS

# 22. Join GM offers a paused Game Master (D7).
$results += Invoke-Probe `
    -Name "Join GM ignores isPaused" `
    -File $RULES `
    -From '  return gm.isPaused !== true && gm.scheduledForDeletion !== true;' `
    -To '  return true;' `
    -TestName "refuses a paused Game Master for Join GM" -Suite $AS

# 23. Both-or-neither broken: an unmatched user no longer aborts, so a row and a counter
# survive for a player whose user document was never linked.
$results += Invoke-Probe `
    -Name "Unmatched user no longer aborts the transaction" `
    -File $SVC `
    -From '      if (userUpdate.matchedCount === 0) {' `
    -To '      if (false) {' `
    -TestName "writes both stores or neither" -Suite $AS

# 24. A lost race is reported as a failure instead of retried.
$results += Invoke-Probe `
    -Name "Duplicate-key / conflict retry removed" `
    -File $SVC `
    -From '      if ((isDuplicateKey(error) || isTransientConflict(error)) && attempt < MAX_RETRIES) {' `
    -To '      if (false) {' `
    -TestName "20 concurrent joins to one Game Master produce one row and one increment" -Suite $AS

# 25. The row stops recording how the affiliation happened.
$results += Invoke-Probe `
    -Name "source no longer stored" `
    -File $SVC `
    -From '            source: input.channel,' `
    -To '' `
    -TestName "creates the row, the user fallback and one counter increment" -Suite $AS

# 26. The idempotent repeat writes a second audit row.
$results += Invoke-Probe `
    -Name "Idempotent repeat audits again" `
    -File $SVC `
    -From '      if (decision.kind === "already_affiliated") {' `
    -To '      if (decision.kind === "already_affiliated") { await writeAudit(auditInput, "gm_affiliation_created", "dup", {});' `
    -TestName "writes exactly one audit row on creation and none on the idempotent repeat" -Suite $AS

# 27. A second door: sign-up raw-inserts into userreferrals again.
$results += Invoke-Probe `
    -Name "Sign-up writes userreferrals directly" `
    -File "lib/actions/auth.actions.ts" `
    -From '            const result = await affiliate({' `
    -To '            await db.collection("userreferrals").insertOne({}); const result = await affiliate({' `
    -TestName "no file outside the named exceptions writes" -Suite $AS

# 28. D4 move leaves the old Game Master's active count inflated.
$results += Invoke-Probe `
    -Name "Previous Game Master's active count not decremented" `
    -File $SVC `
    -From '            { $inc: { activeReferredUsers: -1 } },' `
    -To '            { $inc: { activeReferredUsers: 0 } },' `
    -TestName "an expired previous Game Master frees the player" -Suite $AS

# ---- Step 3: Game Master terms and the accepted version ---------------------------------
$TS = "__tests__/services/gm-terms.test.ts"
$RULES = "lib/services/gamemaster/gm-terms-rules.ts"
$TERMS = "lib/services/gamemaster/gm-terms.service.ts"
$ATR = "app/api/action-terms/[slug]/route.ts"
$VER = "apps/admin/lib/admin/site-page-version.ts"
$APUT = "apps/admin/app/api/pages/[slug]/route.ts"

# 29. A deactivated page still counts as live.
$results += Invoke-Probe `
    -Name "Inactive terms page treated as live" `
    -File $RULES `
    -From '  if (!page || page.isActive !== true) return undefined;' `
    -To '  if (!page) return undefined;' `
    -TestName "a page is live only while active AND versioned" -Suite $TS

# 30. Consent to one Game Master accepted for another.
$results += Invoke-Probe `
    -Name "Game Master id not compared" `
    -File $RULES `
    -From '  if (acceptance.gameMasterId !== gameMasterId) return notAccepted;' `
    -To '' `
    -TestName "Join GM with consent to ANOTHER Game Master is refused" -Suite $TS

# 31. Old wording still counts after an edit.
$results += Invoke-Probe `
    -Name "Version not compared" `
    -File $RULES `
    -From '  if (acceptance.termsVersion !== live.version) return outdated;' `
    -To '' `
    -TestName "verification follows the live version" -Suite $TS

# 32. A week-old acceptance replayed for a join.
$results += Invoke-Probe `
    -Name "Acceptance age not bounded" `
    -File $RULES `
    -From 'if (age > GM_TERMS_ACCEPTANCE_MAX_AGE_MS || age < -FUTURE_SKEW_MS) return outdated;' `
    -To 'if (age < -FUTURE_SKEW_MS) return outdated;' `
    -TestName "changed wording or a stale acceptance is outdated" -Suite $TS

# 33. The Game Master's name reaches dangerouslySetInnerHTML unescaped.
$results += Invoke-Probe `
    -Name "HTML sections not escaped" `
    -File $RULES `
    -From '    return html ? escapeHtml(value) : value;' `
    -To '    return value;' `
    -TestName "interpolation escapes HTML only in HTML sections" -Suite $TS

# 34. The built-in text is served for the consent page after all.
$results += Invoke-Probe `
    -Name "Fallback allowed for a requiresLivePage page" `
    -File $ATR `
    -From '        (p) => p.slug === slug && p.requiresLivePage !== true,' `
    -To '        (p) => p.slug === slug,' `
    -TestName "the public terms route has NO built-in fallback" -Suite $TS

# 35. Join GM skips the consent check.
$results += Invoke-Probe `
    -Name "Affiliate skips terms verification" `
    -File $SVC `
    -From '      if (input.channel === "chartvolt_join_gm" || input.termsAcceptanceId !== undefined) {' `
    -To '      if (input.termsAcceptanceId !== undefined) {' `
    -TestName "Join GM without consent is refused" -Suite $TS

# 36. The accepted version never reaches the affiliation row.
$results += Invoke-Probe `
    -Name "Affiliation not stamped with the version" `
    -File $SVC `
    -From '                  termsVersion: terms.termsVersion,' `
    -To '' `
    -TestName "Join GM with valid consent stamps the acceptance" -Suite $TS

# 37. The acceptance itself does not record the version.
$results += Invoke-Probe `
    -Name "Acceptance row not stamped with the version" `
    -File $TERMS `
    -From '      termsVersion: live.version,' `
    -To '' `
    -TestName "records the version and Game Master" -Suite $TS

# 38. Editing the sections of a consent page leaves the version alone.
$results += Invoke-Probe `
    -Name "Version bump ignores sections" `
    -File $VER `
    -From '    JSON.stringify(normaliseSections(before.sections)) !==' `
    -To '    JSON.stringify(normaliseSections(before.sections)) !== JSON.stringify(normaliseSections(before.sections)) && "" !==' `
    -TestName "any wording change is a change" -Suite $TS

# 39. The admin PUT takes the version from the request body.
$results += Invoke-Probe `
    -Name "Admin PUT reads body.version" `
    -File $APUT `
    -From '      page.version = nextTermsVersion(page.version);' `
    -To '      page.version = body.version ?? nextTermsVersion(page.version);' `
    -TestName "the admin PUT bumps action-terms pages" -Suite $TS

# 40. A saved pages.json predating the Game Master page never seeds it.
$results += Invoke-Probe `
    -Name "Seeder drops missing system pages" `
    -File "lib/services/site-page-seed.service.ts" `
    -From '  return missing.length > 0 ? [...saved, ...missing] : saved;' `
    -To '  return saved;' `
    -TestName "the seeder adds a system page that saved defaults predate" -Suite $TS

# Deliberately unprobed: the acceptance route's own 400 for a missing Game Master. Removing it
# hands `undefined` to recordGmTermsAcceptance, whose `invalid_input` also maps to 400, so the
# two guards cover each other and a probe of either alone stays green (R42's shape).

# ---- Step 4: Join GM API and the Gamemaster leaderboard -------------------------------

$LR = "__tests__/services/gm-leaderboard-rules.test.ts"
$LJ = "__tests__/services/gm-leaderboard-join.test.ts"
$LBRULES = "lib/services/gamemaster/gm-leaderboard-rules.ts"
$LBMET = "lib/services/gamemaster/gm-leaderboard-metrics.ts"
$JOIN = "app/api/gamemasters/[subscriptionId]/join/route.ts"
$LBR = "app/api/gamemasters/leaderboard/route.ts"

# 41. Any query-string sort accepted - including "constructor".
$results += Invoke-Probe `
    -Name "Sort not checked against the list" `
    -File $LBRULES `
    -From '  return SORT_SET.has(value) ? (value as GmLeaderboardSort) : null;' `
    -To '  return value as GmLeaderboardSort;' `
    -TestName "an absent sort is the default" -Suite $LR

# 42. One request pulls the whole board.
$results += Invoke-Probe `
    -Name "Page size uncapped" `
    -File $LBRULES `
    -From 'size > GM_LEADERBOARD_MAX_PAGE_SIZE' `
    -To 'size > 100000' `
    -TestName "pages are whole positive numbers" -Suite $LR

# 43. D1 broken on the board: a Join button beside another Game Master.
$results += Invoke-Probe `
    -Name "Locked row offered as joinable" `
    -File $LBRULES `
    -From '  if (decision.code === "already_affiliated_other") return "locked";' `
    -To '  if (decision.code === "already_affiliated_other") return "joinable";' `
    -TestName "paused current GM locks" -Suite $LR

# 44. Ties stop sharing a rank.
$results += Invoke-Probe `
    -Name "Ties ranked apart" `
    -File $LBRULES `
    -From '    if (!prev || prev.activeAffiliates !== row.activeAffiliates || prev.affiliates !== row.affiliates) {' `
    -To '    if (true) {' `
    -TestName "ranks by active affiliates then affiliates" -Suite $LR

# 45. A refusal reported with a success status.
$results += Invoke-Probe `
    -Name "Refusal mapped to 200" `
    -File $LBRULES `
    -From '  ["already_affiliated_other", 409],' `
    -To '  ["already_affiliated_other", 200],' `
    -TestName "maps each refusal to its status" -Suite $LR

# 46. The join is not rate-limited.
$results += Invoke-Probe `
    -Name "Join rate limit ignored" `
    -File $JOIN `
    -From '    if (!limit.success) {' `
    -To '    if (false) {' `
    -TestName "rate-limits the eleventh attempt" -Suite $LJ

# 47. The join works while the feature is switched off.
$results += Invoke-Probe `
    -Name "Join ignores the switch" `
    -File $JOIN `
    -From '    if (!(await isGmJoinEnabled())) {' `
    -To '    if (false) {' `
    -TestName "refuses a signed-out caller and stays dark while the switch is off" -Suite $LJ

# 48. The board is readable while the feature is switched off.
$results += Invoke-Probe `
    -Name "Leaderboard ignores the switch" `
    -File $LBR `
    -From '    if (!(await isGmJoinEnabled())) {' `
    -To '    if (false) {' `
    -TestName "is dark by default" -Suite $LJ

# 49. The switch fails open on a legacy string.
$results += Invoke-Probe `
    -Name "Switch reads truthiness" `
    -File "lib/services/gamemaster/gm-program-flags.ts" `
    -From '    return doc?.gmJoinEnabled === true;' `
    -To '    return Boolean(doc?.gmJoinEnabled);' `
    -TestName "is dark by default" -Suite $LJ

# 50. A row is spread rather than built from the key list, and a money field rides along.
$results += Invoke-Probe `
    -Name "Public row spread with earnings" `
    -File "lib/services/gamemaster/gm-leaderboard.service.ts" `
    -From '  const out = Object.fromEntries(GM_LEADERBOARD_ROW_KEYS.map((key) => [key, source.get(key)]));' `
    -To '  const out = { ...row, totalEarnings: 999 }; void source;' `
    -TestName "rows carry exactly the public keys" -Suite $LJ

# 51. A paused Game Master is listed (D7).
$results += Invoke-Probe `
    -Name "Paused GM listed" `
    -File $LBMET `
    -From '    isPaused: { $ne: true },' `
    -To '' `
    -TestName "counts affiliates, active affiliates and contests" -Suite $LJ

# 52. The String/ObjectId boundary: every seat looks like a seat in no contest.
$results += Invoke-Probe `
    -Name "Seat competitionId not converted" `
    -File $LBMET `
    -From '          cid: { $convert: { input: "$competitionId", to: "objectId", onError: null, onNull: null } },' `
    -To '          cid: "$competitionId",' `
    -TestName "counts affiliates, active affiliates and contests" -Suite $LJ

# 53. Drafts counted as contests created.
$results += Invoke-Probe `
    -Name "Drafts counted" `
    -File $LBMET `
    -From '      { $match: { gameMasterId: { $in: gmIds }, status: { $ne: "draft" } } },' `
    -To '      { $match: { gameMasterId: { $in: gmIds } } },' `
    -TestName "counts affiliates, active affiliates and contests" -Suite $LJ

# 54. The route calls the referral-link channel, which needs no consent and allows paused GMs.
$results += Invoke-Probe `
    -Name "Join route uses the referral channel" `
    -File $JOIN `
    -From '      channel: "chartvolt_join_gm",' `
    -To '      channel: "gm_referral_link",' `
    -TestName "refuses a bad body and a join without consent" -Suite $LJ

# 55. The admin switch route writes any field it is sent.
$results += Invoke-Probe `
    -Name "Admin switch allow-list bypassed" `
    -File "apps/admin/app/api/gamemasters/program-settings/route.ts" `
    -From '      if (!PROGRAM_SWITCHES.has(key)) {' `
    -To '      if (false) {' `
    -TestName "the admin switch route is section-granted" -Suite $LR

# 56. The player board opened from a link while the switch is off.
$results += Invoke-Probe `
    -Name "GM board reachable by query string" `
    -File "components/leaderboard/LeaderboardClient.tsx" `
    -From '    if (q === GM_BOARD && gmBoardEnabled) return q;' `
    -To '    if (q === GM_BOARD) return q;' `
    -TestName "the player board is offered only when the switch is on" -Suite $LR

# 57. Consent recorded against the subscription id, which affiliate() never matches.
$results += Invoke-Probe `
    -Name "Consent recorded against the subscription" `
    -File "components/leaderboard/GameMasterLeaderboard.tsx" `
    -From 'recordedContext={{ gameMasterId: joining.gameMasterUserId }}' `
    -To 'recordedContext={{ gameMasterId: joining.subscriptionId }}' `
    -TestName "the board records consent against the Game Master user id" -Suite $LR

# 58. The client-imported rules module reaches a model (R58).
$results += Invoke-Probe `
    -Name "Leaderboard rules import a model" `
    -File $LBRULES `
    -From 'import { decideAffiliation, type AffiliationGameMasterFacts } from "./affiliation-rules";' `
    -To 'import { decideAffiliation, type AffiliationGameMasterFacts } from "./affiliation-rules";
import "@/database/models/user-referral.model";' `
    -TestName "the leaderboard rules module reaches no model" -Suite $LR

$MR = "__tests__/admin/gm-affiliation-migration-route.test.ts"
$MROUTE = "apps/admin/app/api/gamemasters/affiliation-migration/route.ts"

# 59. Two admins press Run migration at once and the loser reports a failure.
$results += Invoke-Probe `
    -Name "Migration race reported as an error" `
    -File $MIG `
    -From '      if (!isIndexNotFound(error)) throw error;' `
    -To '      throw error;' `
    -TestName "treats the old index already gone as done when two admins run it at once" -Suite $DM

# 60. Every drop error swallowed, so a real fault reads as done.
$results += Invoke-Probe `
    -Name "Migration swallows every drop error" `
    -File $MIG `
    -From '      if (!isIndexNotFound(error)) throw error;' `
    -To '      if (false) throw error;' `
    -TestName "still fails on any other drop error" -Suite $DM

# 61. The status read applies the migration.
$results += Invoke-Probe `
    -Name "Migration GET writes" `
    -File $MROUTE `
    -From 'const report = await migrateAffiliationSource(false);' `
    -To 'const report = await migrateAffiliationSource(true);' `
    -TestName "GET only reports and POST applies" -Suite $MR

# 62. The run leaves no trace under its own action name.
$results += Invoke-Probe `
    -Name "Migration run not audited as itself" `
    -File $MROUTE `
    -From '        "gm_affiliation_migration",' `
    -To '        "system_action",' `
    -TestName "a run is written to the audit trail" -Suite $MR

# 63. The route granted by a different section.
$results += Invoke-Probe `
    -Name "Migration route under the wrong grant" `
    -File $MROUTE `
    -From 'guardSection("gamemaster-management")' `
    -To 'guardSection("users")' `
    -TestName "every handler is section-granted" -Suite $MR

# 64. The admin copy drifts from the main copy.
$results += Invoke-Probe `
    -Name "Admin migration copy drifts" `
    -File "apps/admin/lib/services/gamemaster/affiliation-migration.ts" `
    -From 'const INDEX_NOT_FOUND = 27;' `
    -To 'const INDEX_NOT_FOUND = 26;' `
    -TestName "the admin copy is byte-identical to the main copy" -Suite $MR

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
