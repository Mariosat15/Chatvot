# Probes `__tests__/challenges/opponent-picker.test.ts` - the opponent half of X10: a player can
# choose who they are challenging rather than arriving from a screen that already knows.
#
# Same harness shape as `probe-challenge-game-picker.ps1` - see that file for the encoding notes
# (read/write UTF-8 without a BOM, ASCII-only anchors, and the rule that PROBE DID NOT APPLY
# means the target moved rather than that the run was quiet).

$ErrorActionPreference = 'Continue'
$env:NODE_OPTIONS = ''

$SUITE = '__tests__/challenges/opponent-picker.test.ts'
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

$DIALOG = 'components/challenges/ChallengeCreateDialog.tsx'
$PICKER = 'components/challenges/create/OpponentPicker.tsx'
$ROUTE = 'app/api/challenges/opponents/route.ts'
$PAGE = 'app/(root)/challenges/page-content.tsx'

Write-Host "`n=== a named opponent wins ===" -ForegroundColor Cyan

# The precedence reversed. This is the one that costs money: a player opens the dialog from
# somebody's profile, the picker's state shadows the prop, and the challenge is created against
# a different person - two wallets debited, nothing thrown, nothing logged.
Probe -Name 'the pick shadows the named opponent' `
  -File $DIALOG `
  -Find '  const opponent = challengedUser ?? pickedOpponent;' `
  -Replace '  const opponent = pickedOpponent ?? challengedUser;' `
  -ExpectRed 'resolves the opponent from the prop first'

# The picker mounted unconditionally. On a screen already about one person it offers a choice
# that `opponent` then ignores - a control that appears to work and does nothing.
Probe -Name 'the picker is mounted even when the caller named somebody' `
  -File $DIALOG `
  -Find '          {!challengedUser && (
            <OpponentPicker' `
  -Replace '          {true && (
            <OpponentPicker' `
  -ExpectRed 'withholds the picker entirely when the caller named somebody'

# The request body reading the prop directly. Correct for every existing caller, and it sends a
# challenge with no `challengedId` at all from the new entry point - refused by the route with a
# validation error naming a field the player never saw.
Probe -Name 'the request body reads the prop rather than the resolved opponent' `
  -File $DIALOG `
  -Find '          challengedId: opponent.userId,' `
  -Replace '          challengedId: challengedUser.userId,' `
  -ExpectRed 'sends the resolved opponent'

# The submit gate removed. The button is pressable with nobody chosen, the terms dialog opens,
# and the refusal arrives from the server after the player has agreed to them.
Probe -Name 'the button is pressable with nobody chosen' `
  -File $DIALOG `
  -Find '              !opponent ||' `
  -Replace '' `
  -ExpectRed 'refuses to submit without one'

# The reset dropped. A player who cancels after choosing somebody reopens the dialog to find
# them still selected - and the heading still says their name, so it reads as intended.
Probe -Name 'the pick survives the dialog being reopened' `
  -File $DIALOG `
  -Find '      setPickedOpponent(null);' `
  -Replace '' `
  -ExpectRed 'clears the pick when the dialog reopens'

# The prop made required again, which is the change somebody makes to "restore type safety".
# It compiles at every existing call site and breaks only the new one.
Probe -Name 'the prop is required again' `
  -File $DIALOG `
  -Find '  challengedUser?: {' `
  -Replace '  challengedUser: {' `
  -ExpectRed 'keeps the prop optional so a caller may omit it'

Write-Host "`n=== the two sources ===" -ForegroundColor Cyan

# The search fired on one character. The endpoint refuses a query shorter than two, so every
# first keystroke is a 400 the player sees as "no players found" before the second one lands.
Probe -Name 'the search fires before the endpoint would accept it' `
  -File $PICKER `
  -Find 'const MIN_QUERY_LENGTH = 2;' `
  -Replace 'const MIN_QUERY_LENGTH = 1;' `
  -ExpectRed 'does not search before the endpoint would accept the query'

# The request-id comparison removed while the counter stays. A slow broad query landing after a
# fast narrow one replaces the results, so the list appears to ignore what was typed - which
# reads as a broken search rather than as a race.
Probe -Name 'a late response is allowed to overwrite a newer one' `
  -File $PICKER `
  -Find '        if (id !== requestId.current) return;' `
  -Replace '' `
  -ExpectRed 'discards a late response'

Write-Host "`n=== the opponents route ===" -ForegroundColor Cyan

# The auth check removed. The route hands out a named friends list to anybody who asks - the
# shape of R40, R47, R51 and R57, and the reason the guard is a test rather than a review note.
Probe -Name 'the route serves an unauthenticated caller' `
  -File $ROUTE `
  -Find '    if (!session?.user?.id) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'refuses an unauthenticated caller'

# The friends list replaced by the trading matchmaker. This is the failure the route's own
# comment exists to prevent, and it is the quiet kind: `matchmaking.service.ts` returns a
# happy, well-ordered list of opponents ranked by TRADING skill, which for a provider game
# is sorted by something with no bearing on the game. No error, no empty state, no log line.
Probe -Name 'opponents come from the trading matchmaker' `
  -File $ROUTE `
  -Find '    const friendships = await Friends.getUserFriends(session.user.id);' `
  -Replace '    const friendships = await findMatchmakingOpponents(session.user.id);' `
  -ExpectRed 'reads the friendship model rather than inventing a list'

# The first entry of `userDetails` taken rather than the other party. That puts the player in
# their own opponent list, which reads as a rendering oddity and is a way to challenge yourself.
Probe -Name 'the caller is returned as their own opponent' `
  -File $ROUTE `
  -Find '        (detail) => detail.userId !== session.user.id,' `
  -Replace '        (detail) => detail.userId != null,' `
  -ExpectRed 'returns the OTHER user of each friendship'

Write-Host "`n=== the entry point ===" -ForegroundColor Cyan

# The new entry point given an opponent, which withholds the picker and sends every challenge
# created from this page to the same person. The button works, the screen renders, and the
# player is never asked.
#
# NOT `challengedUser={null}`: that is the fourth cause of a green probe - null and absent are
# the same fact to `opponent ?? `, so the mutation would change no observable at all. The
# assertion still bans the spelling, because a null here is a prop with nothing to say.
Probe -Name 'the challenges page names an opponent it does not have' `
  -File $PAGE `
  -Find '      <ChallengeCreateDialog open={createOpen} onOpenChange={setCreateOpen} />' `
  -Replace '      <ChallengeCreateDialog open={createOpen} onOpenChange={setCreateOpen} challengedUser={{ userId, username: "you" }} />' `
  -ExpectRed 'opens the dialog with no opponent from the challenges page'

Write-Host "`n=== done ===`n" -ForegroundColor Cyan
