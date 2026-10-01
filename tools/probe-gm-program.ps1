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
# Reason: a full run takes a long time; $env:PROBE_FROM=65 runs only probe 65 onward, so a
# new step can be proved without re-running every earlier step's probes.
$probeFrom = if ($env:PROBE_FROM) { [int]$env:PROBE_FROM } else { 1 }
$script:probeIndex = 0

function Invoke-Probe {
    param(
        [string]$Name,
        [string]$File,
        [string]$From,
        [string]$To,
        [string]$TestName,
        [string]$Suite = $suite
    )

    $script:probeIndex++
    if ($script:probeIndex -lt $probeFrom) {
        return [pscustomobject]@{ Name = $Name; Outcome = "SKIPPED" }
    }

    Write-Host ""
    Write-Host "PROBE: $script:probeIndex $Name" -ForegroundColor Cyan

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

# ---- Step 5: private contests - visibility, entry, discovery ---------------------------

$PE = "__tests__/services/gm-private-entry.test.ts"
$PD = "__tests__/services/gm-private-discovery.test.ts"
$VP = "__tests__/services/gm-visibility-permission.test.ts"
$VIS = "lib/services/gamemaster/visible-contests.ts"
$PERM = "lib/services/gamemaster/visibility-permission.ts"

# 65. The entry door left open.
$results += Invoke-Probe `
    -Name "Entry guard never refuses" `
    -File "lib/services/contest-entry.service.ts" `
    -From 'if (!canEnterPrivateContest(competition, affiliation?.gameMasterId)) {' `
    -To 'if (false && !canEnterPrivateContest(competition, affiliation?.gameMasterId)) {' `
    -TestName "refuses an unaffiliated player through Gate A" -Suite $PE

# 66. Gate B reports the refusal as a malformed request.
$results += Invoke-Probe `
    -Name "Gate B maps the refusal to 400" `
    -File "app/api/competitions/[id]/join/route.ts" `
    -From 'private_not_affiliated: 403,' `
    -To 'private_not_affiliated: 400,' `
    -TestName "through Gate B with 403" -Suite $PE

# 66b. The step-4 gap this step closed: own_contest missing from Gate B's table -> 500.
$results += Invoke-Probe `
    -Name "Gate B has no status for own_contest" `
    -File "app/api/competitions/[id]/join/route.ts" `
    -From '  own_contest: 403,' `
    -To '' `
    -TestName "maps a Game Master joining their own contest to 403" -Suite $PE

# 67. Any affiliation admits, whichever Game Master it is to.
$results += Invoke-Probe `
    -Name "Private door admits any affiliated player" `
    -File $VIS `
    -From 'contest.gameMasterId === affiliatedGameMasterId' `
    -To 'contest.gameMasterId !== ""' `
    -TestName "refuses a player affiliated to a DIFFERENT Game Master" -Suite $PE

# 68. The batch writer seats strangers in bulk.
$results += Invoke-Probe `
    -Name "Batch route stops refusing private contests" `
    -File "app/api/simulator/competitions/join-batch/route.ts" `
    -From 'if (resolveCompetitionVisibility(competition.visibility) === "gm_private") {' `
    -To 'if (false) {' `
    -TestName "returns 403 before it reads any participant or wallet" -Suite $PE

# 69. The plan's `$ne` - an unknown stored value listed to everybody.
$results += Invoke-Probe `
    -Name "Discovery filter written as ne gm_private" `
    -File $VIS `
    -From '{ $in: [...PUBLIC_VISIBILITY_VALUES] }' `
    -To '{ $ne: "gm_private" }' `
    -TestName "an unrecognised stored value is HIDDEN" -Suite $PD

# 70. Every contest written before the field existed vanishes.
$results += Invoke-Probe `
    -Name "Public values lose null" `
    -File $VIS `
    -From '[null, "", "public"]' `
    -To '["", "public"]' `
    -TestName "an anonymous viewer sees every public shape" -Suite $PD

# 71. A spread overwrites the reader's own $or.
$results += Invoke-Probe `
    -Name "withVisibleContests spreads instead of and" `
    -File $VIS `
    -From 'return { $and: [query, visibleContestsFilter(viewer)] };' `
    -To 'return { ...query, ...visibleContestsFilter(viewer) };' `
    -TestName "keeps the caller's own visibility condition for an anonymous viewer" -Suite $PD

# 72. A Game Master cannot find the private contest they just made.
$results += Invoke-Probe `
    -Name "Enterable filter forgets the viewer's own id" `
    -File $VIS `
    -From '[viewer?.affiliatedGameMasterId, viewer?.userId]' `
    -To '[viewer?.affiliatedGameMasterId]' `
    -TestName "a Game Master may enter their own private contest" -Suite $PD

# 73. One reader lists everything again.
$results += Invoke-Probe `
    -Name "Competition list reader unfiltered" `
    -File "lib/actions/trading/competition.actions.ts" `
    -From 'Competition.find(withVisibleContests(query, viewer))' `
    -To 'Competition.find(query)' `
    -TestName "lib/actions/trading/competition.actions.ts filters its query" -Suite $PD

# 74. The lookup stops carrying the field, so every private win reads as public.
$results += Invoke-Probe `
    -Name "Leaderboard preview drops visibility from the projection" `
    -File "app/api/landing/leaderboard-preview/route.ts" `
    -From '{ $project: { name: 1, prizePool: 1, visibility: 1 } }' `
    -To '{ $project: { name: 1, prizePool: 1 } }' `
    -TestName "the leaderboard preview projects visibility" -Suite $PD

# 75. The platform switch ignored.
$results += Invoke-Probe `
    -Name "Private switch not consulted" `
    -File $PERM `
    -From 'if (visibility === "gm_private" && !input.privateContestsEnabled) {' `
    -To 'if (false) {' `
    -TestName "refuses private while the platform switch is off" -Suite $VP

# 76. The cached copy beats the current package.
$results += Invoke-Probe `
    -Name "Cached limits outrank the current package" `
    -File $PERM `
    -From 'input.hasPackage && Array.isArray(input.packageAllowed)' `
    -To '!Array.isArray(input.cachedAllowed) && input.hasPackage && Array.isArray(input.packageAllowed)' `
    -TestName "the CURRENT package beats the cached limits" -Suite $VP

# 77. An unknown request is guessed rather than refused.
$results += Invoke-Probe `
    -Name "Unknown requested visibility accepted" `
    -File $PERM `
    -From 'if (!requestedBlank && (typeof raw !== "string" || !KNOWN.has(raw))) {' `
    -To 'if (false) {' `
    -TestName "refuses an unknown requested value" -Suite $VP

# 78. The route stops asking about what the caller asked for.
$results += Invoke-Probe `
    -Name "Main creation route ignores body.visibility" `
    -File "app/api/gamemaster/competitions/route.ts" `
    -From 'requested: body.visibility,' `
    -To 'requested: undefined,' `
    -TestName "app/api/gamemaster/competitions/route.ts reads the requested value" -Suite $VP

# 79. The form's options stop coming from the rule.
$results += Invoke-Probe `
    -Name "creation-options offers every visibility" `
    -File "app/api/gamemaster/creation-options/route.ts" `
    -From 'const creatableVisibilities = COMPETITION_VISIBILITIES.filter(' `
    -To 'const creatableVisibilities = ["public", "gm_private"].filter(' `
    -TestName "app/api/gamemaster/creation-options/route.ts computes" -Suite $VP

# 80. The provider form is never told the choice.
$results += Invoke-Probe `
    -Name "Gate withholds visibility from the provider form" `
    -File "components/gamemaster/CreateCompetitionGate.tsx" `
    -From "title={selection.title}`r`n          visibility={visibility}" `
    -To "title={selection.title}" `
    -TestName "the gate hands the chosen visibility to BOTH create forms" -Suite $VP

# 81. The provider form drops it from the POST.
$results += Invoke-Probe `
    -Name "Provider form does not send visibility" `
    -File "components/gamemaster/ProviderContestCreateForm.tsx" `
    -From "gameCode: title.gameCode,`r`n          visibility," `
    -To "gameCode: title.gameCode," `
    -TestName "ProviderContestCreateForm.tsx sends visibility" -Suite $VP

# 82. A pointless one-option picker is drawn.
$results += Invoke-Probe `
    -Name "Picker renders a public-only choice" `
    -File "components/gamemaster/ContestVisibilityPicker.tsx" `
    -From 'if (options.length === 1 && options[0] === "public") return null;' `
    -To '' `
    -TestName "the picker hides itself when public is the only option" -Suite $VP

# 83. The package editor stores an unchecked list.
$results += Invoke-Probe `
    -Name "Marketplace PUT skips the visibility parser" `
    -File "apps/admin/app/api/marketplace/route.ts" `
    -From 'const parsed = parseAllowedVisibilityInput(updates.gameMasterConfig.allowedVisibility);' `
    -To 'const parsed = { ok: true as const, value: updates.gameMasterConfig.allowedVisibility, error: "" };' `
    -TestName "validates the visibility list before the write" -Suite $VP

# 84. A tightened tier leaves the cached grant behind.
$results += Invoke-Probe `
    -Name "Marketplace does not sync limits.allowedVisibility" `
    -File "apps/admin/app/api/marketplace/route.ts" `
    -From 'limitsUpdate["limits.allowedVisibility"] = gmConfig.allowedVisibility;' `
    -To 'void gmConfig.allowedVisibility;' `
    -TestName "syncs the cached limits" -Suite $VP

# 85. The switch can no longer be set.
$results += Invoke-Probe `
    -Name "Program settings allow-list loses the private switch" `
    -File "apps/admin/app/api/gamemasters/program-settings/route.ts" `
    -From '  "gmPrivateContestsEnabled",' `
    -To '  "gmPrivateContestsEnabledRenamed",' `
    -TestName "the program settings allow-list names the private switch" -Suite $VP

# 86. The admin copy of the rule drifts - the one the admin-hosted route runs.
$results += Invoke-Probe `
    -Name "Admin visibility-permission copy drifts" `
    -File "apps/admin/$PERM" `
    -From 'Private competitions are not available on the platform yet.' `
    -To 'Private competitions are unavailable.' `
    -TestName "visibility-permission.ts matches its admin copy" -Suite $VP

# ---------------- Step 6: who may VIEW a private contest ----------------
$CV = "__tests__/services/gm-private-contest-view.test.ts"
$ACC = "lib/services/gamemaster/private-contest-access.service.ts"
$GATE = "lib/services/gamemaster/private-contest-gate.service.ts"
# Reason: the signed-out clause in canViewContest is deliberately NOT probed. Removing it
# changes no answer - a blank id finds no seat and no affiliation, so the rule below refuses
# too. It stays because it saves two queries and states the intent; a probe would be green.

# 86. The creating Game Master is shut out of their own contest.
$results += Invoke-Probe `
    -Name "Creator shortcut removed" `
    -File $ACC `
    -From 'if (typeof contest.gameMasterId === "string" && contest.gameMasterId === userId) return true;' `
    -To '' `
    -TestName "admits the creating Game Master" -Suite $CV

# 87. D5 - a seated player loses sight of their own contest.
$results += Invoke-Probe `
    -Name "Seat shortcut removed (D5)" `
    -File $ACC `
    -From 'if (seated) return true;' `
    -To 'void seated;' `
    -TestName "admits a seated player after their Game Master changed" -Suite $CV

# 88. A database error opens the contest.
$results += Invoke-Probe `
    -Name "Access check fails OPEN" `
    -File $ACC `
    -From 'Private contest access check failed; refusing:", error);' `
    -To 'Private contest access check failed; refusing:", error); return true;' `
    -TestName "fails CLOSED when the seat lookup throws" -Suite $CV

# 89. A missing contest answers false and pre-empts the route's own 404.
$results += Invoke-Probe `
    -Name "Missing contest answers false" `
    -File $ACC `
    -From 'if (!contest) return true;' `
    -To 'if (!contest) return false;' `
    -TestName "answers true for a contest that does not exist" -Suite $CV

# 90. The gate offers Join GM while joining is switched off.
$results += Invoke-Probe `
    -Name "Gate ignores the join switch" `
    -File $GATE `
    -From 'if (!(await isGmJoinEnabled())) return { ...base, state: "join_disabled" };' `
    -To '' `
    -TestName "says joining is off while the platform switch is off" -Suite $CV

# 91. The join URL is built from the user id instead of the subscription id.
$results += Invoke-Probe `
    -Name "Gate hands out the user id for the URL" `
    -File $GATE `
    -From 'return { ...base, state: "joinable", subscriptionId };' `
    -To 'return { ...base, state: "joinable", subscriptionId: gmUserId };' `
    -TestName "offers Join GM with the SUBSCRIPTION id" -Suite $CV

# 92. The arena's round state is answered for an outsider.
$results += Invoke-Probe `
    -Name "Rounds GET guard removed" `
    -File "app/api/competitions/[id]/rounds/route.ts" `
    -From 'if (!(await canViewContestById(competitionId, userId))) return privateNotFound();' `
    -To '' `
    -TestName "rounds GET and POST refuse before the downstream" -Suite $CV

# 93. An outsider can ask for a round to be launched.
$results += Invoke-Probe `
    -Name "Rounds POST guard removed" `
    -File "app/api/competitions/[id]/rounds/route.ts" `
    -From 'if (!(await canViewContestById(competitionId, userId))) {' `
    -To 'if (false) {' `
    -TestName "rounds GET and POST refuse before the downstream" -Suite $CV

# 94. The live standings are served to an outsider.
$results += Invoke-Probe `
    -Name "Standings guard removed" `
    -File "app/api/competitions/[id]/standings/route.ts" `
    -From 'if (!(await canViewContestById(id, session.user.id))) {' `
    -To 'if (false) {' `
    -TestName "standings refuses an outsider" -Suite $CV

# 95. The shared ranking cache is read for an outsider.
$results += Invoke-Probe `
    -Name "Live-ranking guard removed" `
    -File "app/api/competitions/[id]/live-ranking/route.ts" `
    -From '!(await canViewContestById(competitionId, session.user.id))' `
    -To 'false' `
    -TestName "live-ranking refuses before the shared cache" -Suite $CV

# 96. Status trusts the userId query parameter - a spoofable identity.
$results += Invoke-Probe `
    -Name "Status judges the query userId" `
    -File "app/api/competitions/[id]/status/route.ts" `
    -From 'canViewContest(id, competition, await sessionUserId())' `
    -To 'canViewContest(id, competition, (await sessionUserId()) ?? new URL(_request.url).searchParams.get("userId") ?? undefined)' `
    -TestName "status judges the signed-in caller" -Suite $CV

# 97. Status skips the private check altogether.
$results += Invoke-Probe `
    -Name "Status private check removed" `
    -File "app/api/competitions/[id]/status/route.ts" `
    -From 'if (isPrivateContest(competition)) {' `
    -To 'if (false) {' `
    -TestName "status judges the signed-in caller" -Suite $CV

# 98. The lobby renders the private page to an outsider.
$results += Invoke-Probe `
    -Name "Lobby guard removed" `
    -File "app/(root)/competitions/[id]/page.tsx" `
    -From 'if (!(await canViewContest(id, competition, userId, { isSeated: isUserIn || undefined }))) {' `
    -To 'if (false) {' `
    -TestName "the lobby returns the gate before it uses the leaderboard" -Suite $CV

# 99. The lobby stops handing over the seat it already read, so every lobby view of a
# private contest pays a second participant query.
$results += Invoke-Probe `
    -Name "Lobby stops passing its seat fact" `
    -File "app/(root)/competitions/[id]/page.tsx" `
    -From '{ isSeated: isUserIn || undefined }' `
    -To '{}' `
    -TestName "the lobby returns the gate before it uses the leaderboard" -Suite $CV

# 100. The arena opens for an outsider.
$results += Invoke-Probe `
    -Name "Play page redirect removed" `
    -File "app/(root)/competitions/[id]/play/page.tsx" `
    -From 'if (!(await canViewContestById(competitionId, session.user.id))) {' `
    -To 'if (false) {' `
    -TestName "the play and results screens redirect" -Suite $CV

# 101. The results screen opens for an outsider.
$results += Invoke-Probe `
    -Name "Results page redirect removed" `
    -File "app/(root)/competitions/[id]/results/page.tsx" `
    -From 'if (!(await canViewContest(competitionId, competition, session.user.id))) {' `
    -To 'if (false) {' `
    -TestName "the play and results screens redirect" -Suite $CV

# 102. R58 - the client gate pulls the service (and Mongoose) into the browser bundle.
$results += Invoke-Probe `
    -Name "Gate component value-imports the service" `
    -File "components/gamemaster/PrivateContestGate.tsx" `
    -From 'import type { PrivateContestGate as GateFacts }' `
    -To 'import { getPrivateContestGate as _probe, type PrivateContestGate as GateFacts }' `
    -TestName "the gate component imports services as types only" -Suite $CV

# 103. A join from a private contest is filed as a leaderboard join.
$results += Invoke-Probe `
    -Name "Join route loses the private-contest surface" `
    -File $JOIN `
    -From 'surface: competitionId ? "private_contest" : "leaderboard",' `
    -To 'surface: "leaderboard",' `
    -TestName "records a join from a private" -Suite $LJ

# 104. A garbage competition id reaches the referral row.
$results += Invoke-Probe `
    -Name "Join route skips the id shape check" `
    -File $JOIN `
    -From 'typeof rawCompetitionId === "string" && isCompetitionIdShaped(rawCompetitionId)' `
    -To 'typeof rawCompetitionId === "string"' `
    -TestName "ignores a malformed competition id" -Suite $LJ

# ---- Private contests listed to everyone (owner decision 30 Sep 2026) ----
$PL = "__tests__/services/gm-private-listing.test.ts"
$PLS = "lib/services/gamemaster/private-contest-listing.service.ts"
$PCC = "lib/utils/private-contest-card-copy.ts"
$CARD = "components/trading/CompetitionCard.tsx"

# 105. The step-5 rule comes back: signed-in outsiders stop seeing private contests.
$results += Invoke-Probe `
    -Name "Listing filter hides private from signed-in players again" `
    -File $VIS `
    -From 'if (nonEmpty(viewer?.userId)) return {};' `
    -To 'if (nonEmpty(viewer?.userId)) return enterableContestsFilter(viewer);' `
    -TestName "now sees every private contest LISTED" -Suite $PD

# 106. Anonymous feeds start listing private contests to the internet.
$results += Invoke-Probe `
    -Name "Listing filter lists everything to anonymous viewers" `
    -File $VIS `
    -From 'if (nonEmpty(viewer?.userId)) return {};' `
    -To 'return {};' `
    -TestName "an anonymous viewer is still listed public contests only" -Suite $PD

# 107. Suggestions invite players into contests they can never enter.
$results += Invoke-Probe `
    -Name "Suggestions use the listing filter" `
    -File "lib/services/games/game-suggestions.service.ts" `
    -From '    withEnterableContests(' `
    -To '    withVisibleContests(' `
    -TestName "game-suggestions.service.ts filters its query" -Suite $PD

# 108. Everyone is treated as a member, so the card offers Enter Arena to outsiders.
$results += Invoke-Probe `
    -Name "Annotation skips the entry rule" `
    -File $PLS `
    -From 'canEnterPrivateContest(contest, viewer?.affiliatedGameMasterId)' `
    -To 'true' `
    -TestName "gives anyone else the gate's own state" -Suite $PL

# 109. A gate read per contest instead of per Game Master.
$results += Invoke-Probe `
    -Name "Annotation stops caching per Game Master" `
    -File $PLS `
    -From '        gates.set(gmId, pending);' `
    -To '' `
    -TestName "asks the gate once per Game Master" -Suite $PL

# 110. The page list stops annotating, so the card cannot tell a member from an outsider.
$results += Invoke-Probe `
    -Name "getCompetitions stops annotating" `
    -File "lib/actions/trading/competition.actions.ts" `
    -From 'const annotated = await annotatePrivateContests(visible, viewer);' `
    -To 'const annotated = visible;' `
    -TestName "competition.actions.ts annotates what it lists" -Suite $PL

# 111. A locked player is offered a join the server refuses (D1).
$results += Invoke-Probe `
    -Name "Locked copy offers a join" `
    -File $PCC `
    -From '        action: "Members only",
        hint: `Only players under' `
    -To '        action: "Join GM to enter",
        hint: `Only players under' `
    -TestName "never offers a join to a player locked" -Suite $PL

# 112. A seated player is shown the gate instead of Enter Arena (D5).
$results += Invoke-Probe `
    -Name "Card ignores the seat" `
    -File $CARD `
    -From '        !isUserIn &&
        competition.privateAccess &&' `
    -To '        competition.privateAccess &&' `
    -TestName "the card replaces the entry button for a non-member" -Suite $PL

# 113. The enterable narrowing spreads, so an affiliate's $or replaces the reader's own.
$results += Invoke-Probe `
    -Name "withEnterableContests spreads instead of and" `
    -File $VIS `
    -From 'return { $and: [query, enterableContestsFilter(viewer)] };' `
    -To 'return { ...query, ...enterableContestsFilter(viewer) };' `
    -TestName "withEnterableContests keeps the caller's own" -Suite $PD

# 114. The completed-contest ranking is read for the query userId again (any player's prize).
$results += Invoke-Probe `
    -Name "Status ranking reads the query userId" `
    -File "app/api/competitions/[id]/status/route.ts" `
    -From 'competition.status === "completed" ? await sessionUserId() : undefined;' `
    -To 'competition.status === "completed" ? (new URL(_request.url).searchParams.get("userId") ?? undefined) : undefined;' `
    -TestName "status reports the ranking of the signed-in caller only" -Suite $CV

# ---- Task 2 (1 Oct 2026): the private badge on the game page and the admin list ----
$GP = "__tests__/services/gm-private-game-page.test.ts"
$CAT = "lib/services/games/player-catalogue.service.ts"

# 115. The game page drops the access state, so a private contest looks public.
$results += Invoke-Probe `
    -Name "Catalogue drops privateAccess" `
    -File $CAT `
    -From 'privateAccess: seated.has(c._id.toString()) ? "member" : c.privateAccess,' `
    -To 'privateAccess: undefined,' `
    -TestName "carries the private access state and Game Master name" -Suite $GP

# 116. A seated player is offered the gate again (D5).
$results += Invoke-Probe `
    -Name "Catalogue ignores the seat" `
    -File $CAT `
    -From 'privateAccess: seated.has(c._id.toString()) ? "member" : c.privateAccess,' `
    -To 'privateAccess: c.privateAccess,' `
    -TestName "reads a seated player as a member" -Suite $GP

# 117. Anybody's seat counts as the viewer's.
$results += Invoke-Probe `
    -Name "Seat lookup not scoped to the viewer" `
    -File $CAT `
    -From '    const rows = await CompetitionParticipant.find({
      userId,
      competitionId' `
    -To '    const rows = await CompetitionParticipant.find({
      competitionId' `
    -TestName "counts only the viewer's own seat" -Suite $GP

# 118. Play now one-clicks into a contest the player cannot enter.
$results += Invoke-Probe `
    -Name "Play now ignores private access" `
    -File "lib/services/games/game-page-helpers.ts" `
    -From '(c) => !c.privateAccess || c.privateAccess === "member",' `
    -To '() => true,' `
    -TestName "skips a live private contest the player cannot enter" -Suite $GP

# 119. The game page card offers Join Competition on every private contest.
$results += Invoke-Probe `
    -Name "Game page card drops the gate" `
    -File "components/game-page/GamePageContests.tsx" `
    -From '{c.privateAccess && c.privateAccess !== "member" ? (' `
    -To '{false ? (' `
    -TestName "gates the action on membership" -Suite $GP

# 120. The admin list stops badging private contests.
$results += Invoke-Probe `
    -Name "Admin list loses the Private badge" `
    -File "apps/admin/components/admin/CompetitionsListSection.tsx" `
    -From '{resolveCompetitionVisibility(competition.visibility) === "gm_private" && (' `
    -To '{false && (' `
    -TestName "the admin competitions list renders Private" -Suite $GP

Write-Host ""
Write-Host "================ SUMMARY ================"
$results | Format-Table -AutoSize
$bad = @($results | Where-Object { $_.Outcome -notlike "RED*" -and $_.Outcome -ne "SKIPPED" })
if ($bad.Count -gt 0) {
    Write-Host "$($bad.Count) probe(s) did NOT come back red - read each one."
}
else {
    Write-Host "All $($results.Count) probes red on the expected test."
}
