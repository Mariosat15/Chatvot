# Probes `__tests__/challenges/game-willingness.test.ts` - X10's per-game challenge
# willingness, plus the master switch that had existed with no UI at all.
#
# Same harness shape as `probe-preference-gating.ps1` - see that file for the encoding
# notes (read/write UTF-8 without a BOM, ASCII-only anchors, and the rule that PROBE DID
# NOT APPLY means the target MOVED rather than that the run was quiet).

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/challenges/game-willingness.test.ts'
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

$RULES = 'lib/services/games/challenge-willingness.ts'
$SERVICE = 'lib/services/games/challenge-availability.service.ts'
$MODEL = 'database/models/games/user-game-preference.model.ts'
$CREATE_ROUTE = 'app/api/challenges/route.ts'
$PRESENCE_ROUTE = 'app/api/user/presence/route.ts'
$SECTION = 'components/profile/ChallengeAvailabilitySection.tsx'

Write-Host "`n=== the default, which is the whole exposure ===" -ForegroundColor Cyan

# THE probe. Every player on the platform has zero rows, so reading absence as "unwilling"
# refuses every challenge on the platform - silently, because a refusal is a 400 and not an
# error, and with every structural test still green.
Probe -Name 'an absent row reads as unwilling' `
  -File $RULES `
  -Find 'export const WILLING_TO_BE_CHALLENGED_BY_DEFAULT = true;' `
  -Replace 'export const WILLING_TO_BE_CHALLENGED_BY_DEFAULT = false;' `
  -ExpectRed 'an absent declaration means WILLING'

# The predicate reading the default rather than the stored value, which is the same outage
# from the other side once the constant is right.
Probe -Name 'the predicate ignores a stored declaration' `
  -File $RULES `
  -Find '  const stored = byGameKey.get(gameKey.trim());
  return stored ?? WILLING_TO_BE_CHALLENGED_BY_DEFAULT;' `
  -Replace '  return WILLING_TO_BE_CHALLENGED_BY_DEFAULT;' `
  -ExpectRed 'a stored false means NOT willing'

# The schema disagreeing with the constant. A row written by the upsert would then contradict
# what every screen showed before it saved.
Probe -Name 'the schema default contradicts the constant' `
  -File $MODEL `
  -Find '    willingToBeChallenged: {
      type: Boolean,
      required: true,
      default: true,
    },' `
  -Replace '    willingToBeChallenged: {
      type: Boolean,
      required: true,
      default: false,
    },' `
  -ExpectRed 'the schema default and the shared constant are one fact'

# An object lookup walks the prototype chain, so a row keyed `__proto__` returns a truthy
# `Object.prototype` that survives a `!row` test. Fourth instance of this trap.
Probe -Name 'declarations are indexed in a plain object' `
  -File $RULES `
  -Find '  const byGameKey = new Map<string, boolean>();' `
  -Replace '  const byGameKey = Object.create(Object.prototype) as Map<string, boolean>;
  byGameKey.get = function (key: string) { return (this as unknown as Record<string, boolean>)[key]; };
  byGameKey.set = function (key: string, value: boolean) { (this as unknown as Record<string, boolean>)[key] = value; return this; };' `
  -ExpectRed 'cannot poison the lookup'

# A blank key stored as a key, which then answers for a game nobody named.
Probe -Name 'a blank gameKey is stored as a key' `
  -File $RULES `
  -Find '    if (!gameKey) continue;' `
  -Replace '' `
  -ExpectRed 'is dropped rather than stored as a key'

Write-Host "`n=== the refusal ===" -ForegroundColor Cyan

# One shared string makes the finer setting indistinguishable from the master one, so the
# challenger gives up instead of trying a different game.
Probe -Name 'the per-game refusal is the master switch message' `
  -File $RULES `
  -Find '  return label.length
    ? `This player is not accepting ${label} challenges`
    : "This player is not accepting challenges at this game";' `
  -Replace '  void label;
  return "User is not accepting challenges";' `
  -ExpectRed 'is not the master switch'

# An absent label leaking into the sentence.
Probe -Name 'an absent label produces an empty refusal' `
  -File $RULES `
  -Find '  return label.length
    ? `This player is not accepting ${label} challenges`
    : "This player is not accepting challenges at this game";' `
  -Replace '  return label.length ? `This player is not accepting ${label} challenges` : "";' `
  -ExpectRed 'still says something when no label is available'

Write-Host "`n=== stored declarations ===" -ForegroundColor Cyan

# Trading has no catalogue row, so a list built from `listChallengeableTitles` alone offers
# no way to opt out of the one game every player can already be challenged at.
Probe -Name 'trading is dropped from the list' `
  -File $SERVICE `
  -Find '    { gameKey: TRADING_GAME_TYPE, label: "Trading" },
' `
  -Replace '' `
  -ExpectRed 'trading is always offered, and is first'

# Trading present but not first, which is the same defect wearing an ordering.
Probe -Name 'trading is listed last' `
  -File $SERVICE `
  -Find '  return [
    { gameKey: TRADING_GAME_TYPE, label: "Trading" },
    ...titles.map' `
  -Replace '  return [
    ...titles.map' `
  -ExpectRed 'trading is always offered, and is first'

# An insert rather than an upsert, so a second declaration duplicates the row and the unique
# index decides which one wins.
Probe -Name 'a declaration inserts rather than upserting' `
  -File $SERVICE `
  -Find '    { upsert: true, new: true },' `
  -Replace '    { upsert: false, new: true },' `
  -ExpectRed 'an opt-out round-trips'

# The allow-list dropped, so a row lands under a key nothing resolves - a setting the player
# can see, toggle and never have honoured, indistinguishable from a retired game.
Probe -Name 'an unknown gameKey is stored rather than refused' `
  -File $SERVICE `
  -Find '  if (!games.some((game) => game.gameKey === requested)) {
    return { success: false, error: "That game cannot be challenged" };
  }' `
  -Replace '' `
  -ExpectRed 'an unrecognised gameKey is REFUSED'

# The whole-platform version: one player's declaration answering for everybody.
Probe -Name 'the read is not scoped to the player' `
  -File $SERVICE `
  -Find '  const rows = await UserGamePreference.find({ userId })' `
  -Replace '  const rows = await UserGamePreference.find({})' `
  -ExpectRed "one player's declaration does not reach another"

# An absent presence row read literally, which refuses challenges for everybody who has
# never been online.
Probe -Name 'an absent presence row reads as not accepting' `
  -File $SERVICE `
  -Find '      (presence as { acceptingChallenges?: boolean } | null)
        ?.acceptingChallenges !== false,' `
  -Replace '      (presence as { acceptingChallenges?: boolean } | null)
        ?.acceptingChallenges === true,' `
  -ExpectRed 'a player with no presence row reads as accepting challenges'

Write-Host "`n=== the create route consults it ===" -ForegroundColor Cyan

# The defect the whole slice is built to prevent, and the one no other assertion catches:
# the route fetching, indexing and then never asking.
Probe -Name 'the route never asks the predicate' `
  -File $CREATE_ROUTE `
  -Find '        if (
          !isWillingToBeChallengedAt(challengedWillingness, gameLabel.gameKey)
        ) {
          return errorResponse(gameWillingnessRefusal(gameDisplayName), 400);
        }' `
  -Replace '        void challengedWillingness;
        void gameDisplayName;' `
  -ExpectRed 'calls the shared predicate rather than comparing a field itself'

# A hand-rolled comparison, which is a second reading of the default that drifts the day
# either changes.
Probe -Name 'the route hand-rolls the comparison' `
  -File $CREATE_ROUTE `
  -Find '        if (
          !isWillingToBeChallengedAt(challengedWillingness, gameLabel.gameKey)
        ) {' `
  -Replace '        if (challengedWillingness.get(gameLabel.gameKey) === false) {' `
  -ExpectRed 'calls the shared predicate rather than comparing a field itself'

# Per-game asked BEFORE the master switch, so a player who switched challenges off entirely
# is told to try a different game - which is false.
Probe -Name 'the per-game refusal runs before the master switch' `
  -File $CREATE_ROUTE `
  -Find '        if (
          challengedPresence &&
          challengedPresence.acceptingChallenges === false
        ) {
          return errorResponse("User is not accepting challenges", 400);
        }
' `
  -Replace '' `
  -ExpectRed 'asks the MASTER switch first'

# The read issued for an open challenge, where there is no opponent - so it would be answered
# from the creator's own declarations and opting out of a game would stop you offering it.
Probe -Name 'the read is issued for an open challenge too' `
  -File $CREATE_ROUTE `
  -Find '          isOpenChallenge
            ? Promise.resolve(new Map<string, boolean>())
            : getWillingnessByGameKey(challengedId),' `
  -Replace '          getWillingnessByGameKey(challengedId),' `
  -ExpectRed 'withholds the read for an open challenge'

Write-Host "`n=== the screen, and the switch it must not write twice ===" -ForegroundColor Cyan

# A hard-coded default in the browser, which is the "one rule, two copies" shape - and the
# copy that drifts is the one the player reads before they save.
Probe -Name 'the screen hard-codes its own default' `
  -File $SECTION `
  -Find '  const [acceptingChallenges, setAcceptingChallenges] = useState(
    WILLING_TO_BE_CHALLENGED_BY_DEFAULT,
  );' `
  -Replace '  const [acceptingChallenges, setAcceptingChallenges] = useState(true);' `
  -ExpectRed 'takes the default from the shared constant'

# PATCH on that route is the presence HEARTBEAT, so using it makes changing a setting
# indistinguishable from playing.
Probe -Name 'the master switch is written through the heartbeat' `
  -File $SECTION `
  -Find '        method: "PUT",' `
  -Replace '        method: "PATCH",' `
  -ExpectRed 'writes the master switch through the route that owns it'

Write-Host "`n=== the master switch could not be saved by a new player ===" -ForegroundColor Cyan

# The defect as it was: a 404 on a missing document, so the player most likely to be setting
# this before they start playing was the one it refused - while the create route reads an
# absent row as "accepting", leaving them reachable with the screen reporting success.
Probe -Name 'the presence toggle 404s instead of upserting' `
  -File $PRESENCE_ROUTE `
  -Find '        $set: { acceptingChallenges },
        $setOnInsert: {
          userId: session.user.id,
          username: session.user.name || "Unknown",
        },
      },
      { upsert: true, new: true },
    );' `
  -Replace '        $set: { acceptingChallenges },
      },
      { new: true },
    );

    if (!presence) {
      return NextResponse.json(
        { error: "Presence not found" },
        { status: 404 },
      );
    }' `
  -ExpectRed 'the presence toggle upserts'

# `$set: { acceptingChallenges: undefined }` is a no-op that still reports success, and
# switching OFF is the entire point of the route.
Probe -Name 'the presence toggle accepts a non-boolean' `
  -File $PRESENCE_ROUTE `
  -Find '    if (typeof acceptingChallenges !== "boolean") {' `
  -Replace '    if (false) {' `
  -ExpectRed 'the presence toggle refuses a non-boolean'

Write-Host "`n=== nothing is declared before anything writes it ===" -ForegroundColor Cyan

# Chapter `20`'s table lists three more fields. Declaring one before anything writes it is
# the shape behind `requiresSyncPlay`, `isPaused`, `family` and `playModeOverride`.
Probe -Name 'an unwritten field is declared' `
  -File $MODEL `
  -Find '    declaredAt: {' `
  -Replace '    skillBand: { type: String },
    declaredAt: {' `
  -ExpectRed 'carries no interestLevel, inferredAt or skillBand'

# R58: a `"use client"` file may not name a driver-reaching module in a value-import
# position, and the settings screen imports these rules. The admin build went down over
# exactly this.
Probe -Name 'the rules module reaches a model' `
  -File $RULES `
  -Find 'export const WILLING_TO_BE_CHALLENGED_BY_DEFAULT = true;' `
  -Replace 'import UserGamePreference from "@/database/models/games/user-game-preference.model";
void UserGamePreference;

export const WILLING_TO_BE_CHALLENGED_BY_DEFAULT = true;' `
  -ExpectRed 'the rules module reaches no model'

Write-Host "`nDone.`n" -ForegroundColor Cyan
