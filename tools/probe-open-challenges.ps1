# Probes the open-challenge guards: the shared rule, the two model copies, the create path,
# the atomic claim on accept, discovery, and the six screens that used to assume two named
# players. Each probe restores one defect and must turn EXACTLY the named test red.
#
# Every defect here is silent. An inferred `openToAnyone`, a claim filter missing a clause, a
# card offering Decline on a seat nobody was invited to - none of them throws, none of them
# logs, and two of them debit a real entry fee. A probe is the only thing that proves the
# guards see them.
#
# Same harness as `probe-challenge-settlement.ps1` - see that file for why each defence
# exists (UTF-8 without a BOM on the read AND the write, a refusal to write when the read
# came back empty, `PROBE DID NOT APPLY` when the anchor has moved, the expected test run
# ALONE with `-t` and judged on the summary counts rather than on its name appearing in the
# output, and the whole suite re-run only to measure blast radius).
#
# One addition worth keeping: several probes here target tests in the OTHER challenge suite,
# so `-Suite` is passed per probe. Run against the default suite a probe reports "did not
# run", which reads like a broken harness rather than a moved target.

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/challenges/open-challenges.test.ts'
$PICKER_SUITE = '__tests__/challenges/opponent-picker.test.ts'
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

$RULE = 'lib/utils/open-challenge.ts'
$MODEL = 'database/models/trading/challenge.model.ts'
$CREATE = 'app/api/challenges/route.ts'
$ACCEPT = 'app/api/challenges/[id]/accept/route.ts'
$DIALOG = 'components/challenges/ChallengeCreateDialog.tsx'
$PICKER = 'components/challenges/create/OpponentPicker.tsx'
$CARD = 'components/trading/ChallengeCard.tsx'
$ACTIONS = 'components/trading/ChallengeEntryActions.tsx'
$LOBBY = 'components/games/ProviderChallengeLobby.tsx'
$PAGE = 'app/(root)/challenges/page-content.tsx'
$DETAIL = 'app/(root)/challenges/[id]/page.tsx'
$LANDING = 'app/api/landing/challenges/route.ts'

Write-Host "`n=== the shared rule: a flag, never an inference ===" -ForegroundColor Cyan

# THE defect this whole feature is shaped to prevent. Inferred, a bug that drops
# `challengedId` from a directed challenge offers a named friend's seat to any stranger, and
# a real entry fee is debited by somebody nobody chose.
Probe -Name 'openness is inferred from the absent opponent instead of read from the flag' `
  -File $RULE `
  -Find '  return challenge.openToAnyone === true;' `
  -Replace '  return challenge.openToAnyone === true || !challenge.challengedId;' `
  -ExpectRed 'reads the flag and never the absent opponent'

# "Missing" has three shapes and only one is obvious. This spelling reads a stored empty
# string as taken - a seat nobody can claim, on a document that looks perfectly correct.
Probe -Name 'only an absent opponent counts as an empty seat' `
  -File $RULE `
  -Find '  return isOpenChallenge(challenge) && !challenge.challengedId;' `
  -Replace '  return isOpenChallenge(challenge) && challenge.challengedId === undefined;' `
  -ExpectRed 'treats all three shapes of an empty seat as unclaimed'

# "vs " followed by nothing reads as a rendering fault rather than as an invitation.
Probe -Name 'an empty seat renders as an empty string' `
  -File $RULE `
  -Find '  return isUnclaimedOpenChallenge(challenge)
    ? OPEN_CHALLENGE_OPPONENT_LABEL
    : "Unknown";' `
  -Replace '  return "";' `
  -ExpectRed 'names an empty seat rather than rendering nothing'

Write-Host "`n=== the model, where an open challenge is simply unsaveable ===" -ForegroundColor Cyan

# The feature cannot ship at all with this restored - but the failure is a validation error
# at create time, which reads as a bad request rather than as a schema that forbids the case.
Probe -Name 'the main copy requires an opponent again' `
  -File $MODEL `
  -Find '    challengedId: {
      type: String,
      required: function (this: { openToAnyone?: boolean }) {
        return this.openToAnyone !== true;
      },' `
  -Replace '    challengedId: {
      type: String,
      required: true,' `
  -ExpectRed 'stops requiring the three opponent fields on the main copy'

Write-Host "`n=== creating one ===" -ForegroundColor Cyan

# Guessing is the failure worth naming: read as directed it quietly makes an open challenge
# private, read as open it offers a named friend's seat to a stranger.
Probe -Name 'both facts at once are accepted rather than refused' `
  -File $CREATE `
  -Find '    if (isOpenChallenge && challengedId) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'refuses both facts server-side rather than guessing'

# A stored `""` is exactly what the accept-time claim filter's `$exists` reading treats as
# taken - so the seat is created already full and nobody can ever take it.
Probe -Name 'the three opponent fields are stored empty instead of omitted' `
  -File $CREATE `
  -Find '      ...(isOpenChallenge
        ? {}
        : { challengedId, challengedName, challengedEmail }),' `
  -Replace '      challengedId, challengedName, challengedEmail,' `
  -ExpectRed 'omits the three opponent fields rather than storing empty ones'

# Sending to an undefined recipient either throws into the catch and logs a false error, or
# writes a notification row addressed to nobody.
Probe -Name 'an open challenge notifies its absent opponent' `
  -File $CREATE `
  -Find '    if (!isInSimulatorMode && !isOpenChallenge) {' `
  -Replace '    if (!isInSimulatorMode) {' `
  -ExpectRed 'tells nobody about a challenge addressed to nobody'

# The dialog's own scoping. A screen opened about one person is not offering a choice, so a
# stale flag must not be able to turn that challenge into one any stranger may take.
Probe -Name 'the dialog honours the flag even when the caller named somebody' `
  -File $DIALOG `
  -Find '  const isOpen = !challengedUser && openToAnyone;' `
  -Replace '  const isOpen = openToAnyone;' `
  -ExpectRed 'ignores the flag when the caller named somebody'

# Holding both means the request body depends on which state was written last.
Probe -Name 'opening the seat leaves an earlier pick in place' `
  -File $DIALOG `
  -Find '                setOpenToAnyone(next);
                if (next) setPickedOpponent(null);' `
  -Replace '                setOpenToAnyone(next);' `
  -ExpectRed 'clears any earlier pick when the seat is opened'

# The submit gate. Aimed at the OTHER suite, where the claim has lived since before open
# challenges existed - it was `!opponent` and was flipped rather than deleted.
Probe -Name 'the submit gate demands a named opponent again' `
  -File $DIALOG `
  -Find '    if (!hasRecipient) return;
    setShowTerms(true);' `
  -Replace '    if (!opponent) return;
    setShowTerms(true);' `
  -ExpectRed 'refuses to submit without a recipient of either kind' `
  -Suite $PICKER_SUITE

# An "anyone" row that survives a search is one click from sending the opposite of what the
# player is in the middle of typing.
Probe -Name 'the anyone row stays visible under a search' `
  -File $PICKER `
  -Find '      {query.trim().length === 0 && (' `
  -Replace '      {true && (' `
  -ExpectRed 'offers the seat from the picker only while nothing is typed'

Write-Host "`n=== the atomic claim ===" -ForegroundColor Cyan

# Without the flag in the filter, the claim will write an opponent onto a DIRECTED challenge
# - the one shape where the seat is not anybody's to take.
Probe -Name 'the claim filter stops demanding an open challenge' `
  -File $ACCEPT `
  -Find '          openToAnyone: true,' `
  -Replace '          openToAnyone: { $ne: false },' `
  -ExpectRed 'claims it atomically, so the second accepter is refused'

# Dropping one shape of an empty seat from the filter. `""` is the one a `$exists` reading
# gets wrong, so it is the one probed.
Probe -Name 'a stored empty string is no longer treated as an empty seat' `
  -File $ACCEPT `
  -Find '            { challengedId: "" },' `
  -Replace '' `
  -ExpectRed 'claims it atomically, so the second accepter is refused'

# Everything below the claim reads `challenge.challengedId` to debit a wallet, write a ledger
# row and build a seat. The pre-claim copy still has none, so the tripwire fires and the
# whole acceptance aborts - visibly, but for a reason that names nothing useful.
Probe -Name 'acceptance continues from the pre-claim document' `
  -File $ACCEPT `
  -Find '      challenge = claimed;' `
  -Replace '' `
  -ExpectRed 'continues from the claimed document, not the stale read'

Write-Host "`n=== finding one ===" -ForegroundColor Cyan

# A player cannot take their own seat, so listing it offers a button the accept route
# refuses - and it is the challenger's own challenge, so it looks entirely legitimate.
Probe -Name 'the open list includes the caller own seats' `
  -File $CREATE `
  -Find '      query.challengerId = { $ne: session.user.id };' `
  -Replace '' `
  -ExpectRed 'lists only unclaimed seats that are not the caller'

# Filtering the caller's own list by the flag shows an empty tab, and nothing fails.
Probe -Name 'the open tab reads the caller own challenges' `
  -File $PAGE `
  -Find 'const filteredChallenges = (activeTab === "open" ? openChallenges : challenges)' `
  -Replace 'const filteredChallenges = challenges' `
  -ExpectRed 'gives the open list its own tab rather than mixing it into the caller'

# Without this the prospective accepter meets a 404 on the one screen that would tell them
# what they are about to pay to enter.
Probe -Name 'the detail page hides an unclaimed seat from everybody but the pair' `
  -File $DETAIL `
  -Find '    !isUnclaimedOpenChallenge(challenge)' `
  -Replace '    true' `
  -ExpectRed 'lets any signed-in player read an unclaimed seat'

Write-Host "`n=== the screens that assumed two named players ===" -ForegroundColor Cyan

# Declining is refusing an invitation addressed to you, and nobody is addressed - the route
# answers 403. The button appears to work and does nothing.
Probe -Name 'Decline is offered on a seat nobody was invited to' `
  -File $CARD `
  -Find '  const canDecline = canRespond && !isOpenSeat;' `
  -Replace '  const canDecline = canRespond;' `
  -ExpectRed 'withholds decline on an open seat'

# Deciding from `isChallenger` alone tells every browsing player they were singled out.
Probe -Name 'the card tells a browsing player they were challenged' `
  -File $CARD `
  -Find '            : isOpenSeat
              ? "Open to anyone"
              : "Challenged you"' `
  -Replace '            : "Challenged you"' `
  -ExpectRed 'does not tell a browsing player they were singled out'

# `!isChallenger` is the same question only while a challenge names two players. On an open
# one a browsing player satisfied it and was shown "Challenge Received!" with a Decline
# button the route refuses.
Probe -Name 'the provider lobby infers the recipient from not being the challenger' `
  -File $LOBBY `
  -Find '  const isChallenged =
    !isChallenger && String(challenge.challengedId ?? "") === String(userId);' `
  -Replace '  const isChallenged = !isChallenger;' `
  -ExpectRed 'resolves the provider lobby'

# A visitor to an unclaimed seat fell through to a "no longer active" panel - the one screen
# with room to explain the challenge had no way to take it.
Probe -Name 'the detail page offers no way to take the seat' `
  -File $ACTIONS `
  -Find '  if (status === "pending" && openSeat) {' `
  -Replace '  if (false) {' `
  -ExpectRed 'offers the seat on the detail page instead of a dead panel'

# "Player 2" states there is an opponent when the whole point of the row is that the seat is
# free - on the public, signed-out landing feed.
Probe -Name 'the landing feed invents a second player' `
  -File $LANDING `
  -Find '        challenged: isUnclaimedOpenChallenge(challenge)
          ? OPEN_CHALLENGE_OPPONENT_LABEL
          : anonymizeName(challenge.challengedName || "Player 2"),' `
  -Replace '        challenged: anonymizeName(challenge.challengedName || "Player 2"),' `
  -ExpectRed 'does not invent a second player on the public landing feed'

# DELIBERATELY NOT PROBED, with the reason recorded rather than a probe reporting green:
#
# The decline route's refusal of an open seat. It is `challenge.challengedId !==
# session.user.id`, the SAME comparison that refuses any other non-recipient, so there is no
# open-challenge-specific line to remove - mutating it turns red for the directed case and
# proves nothing about the open one. The guard asserts the comparison is still what decides,
# plus that the route has learned no second rule; that pair is the whole claim.

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
