# Probes for the standings rebuilt to the owner's leaderboard reference (11 September 2026):
# players' pictures on the board, the leader's gold row, the plates, the panel's chrome.
#
# THE CLAIMS WORTH PROBING, in order of what it would cost to lose them:
#
#   1. The row gains the picture and NOTHING ELSE off the user card. `getUsersByIds` returns
#      email and address too, and a spread of that card onto a PUBLIC board reviews as "attach
#      the avatar". The test asserts the whole object; this probe restores the spread.
#   2. One producer. The arena page renders once and then polls a JSON route; if only one of the
#      two attached pictures, every avatar would vanish fifteen seconds after load.
#   3. The trading board is untouched. `neonRowClasses` and `NeonRankBadge` are shared, so the
#      gold frame and the crown-and-plates marker must reach the flush board and NOT the card
#      form - the probes here push each one across the line.
#
# Conventions carried from the earlier harnesses in this folder, each of which cost a false
# result once: UTF-8 without a BOM on read and write; `System.IO.File` for the `[id]` path;
# refuse to write an empty file; relax newlines in the pattern; run the expected test ALONE with
# `-t` (which is a REGULAR EXPRESSION, so every name below is plain ASCII without brackets);
# DID NOT APPLY means the target moved, never that the run was quiet.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$DefaultSuite = '__tests__/games/leaderboard-avatars.test.ts'
$PlayUiSuite = '__tests__/games/provider-play-ui.test.ts'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Source([string]$Path) {
  [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false))
}

function Write-Source([string]$Path, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) {
    throw "refusing to write an empty file to $Path"
  }
  [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function To-Relaxed([string]$Literal) {
  [regex]::Escape($Literal) -replace '(\\r)?\\n', '\r?\n'
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectTest,
    [string]$Suite = $DefaultSuite
  )

  $path = Join-Path $Root $File
  $original = Read-Source $path
  if ([string]::IsNullOrEmpty($original)) {
    Write-Host "[$Name] UNREADABLE - $File came back empty, refusing to probe" -ForegroundColor Magenta
    return
  }

  $mutated = [regex]::Replace($original, (To-Relaxed $Find), { param($m) $Replace }, 1)

  if ($mutated -eq $original) {
    Write-Host "[$Name] DID NOT APPLY - the target moved, so nothing was tested" -ForegroundColor Magenta
    return
  }

  Write-Source $path $mutated
  try {
    $out = & npx vitest run $Suite -t $ExpectTest 2>&1 | Out-String
    $flat = ($out -replace '\s+', ' ')
    if ($flat -match 'Tests\s+(\d+)\s+failed') {
      $failed = [int]$Matches[1]
      if ($failed -eq 1) {
        Write-Host "[$Name] RED (1 failure, as expected)" -ForegroundColor Green
      } else {
        Write-Host "[$Name] RED but $failed failures - blast radius, check the probe" -ForegroundColor Yellow
      }
    } elseif ($flat -match 'No test found' -or $flat -match 'Tests\s+no tests') {
      Write-Host "[$Name] NO TEST RAN - wrong test name, or wrong suite" -ForegroundColor Magenta
    } else {
      Write-Host "[$Name] GREEN - the guard is absent, weak, unreachable, or changes no observable" -ForegroundColor Red
    }
  } finally {
    Write-Source $path $original
  }
}

$Producer = 'lib/services/games/leaderboard-avatars.ts'
$Service = 'lib/services/games/arena-standings.service.ts'
$Page = 'app/(root)/competitions/[id]/page.tsx'
$Board = 'components/games/ProviderLeaderboard.tsx'
$KitRow = 'components/neon/LeaderboardRow.tsx'
$Tokens = 'components/neon/tokens.ts'
$Layout = 'components/games/arena/GameArenaLayout.tsx'
$Live = 'components/games/arena/ArenaLiveStandings.tsx'

Write-Host ''
Write-Host '=== The row gains the picture and nothing else ===' -ForegroundColor Cyan

# THE ONE THAT MATTERS. Spreading the user card is the natural way to write this, and it puts an
# email address on a public leaderboard row.
Invoke-Probe -Name 'the whole user card is spread onto the row' -File $Producer `
  -Find '    return picture ? { ...row, profileImage: picture } : row;' `
  -Replace '    const user = users.get(row.userId);
    return user ? { ...row, ...user, profileImage: picture } : row;' `
  -ExpectTest 'adds the picture and NOTHING ELSE from the user card'

# `profileImage: undefined` on a row without one - the polled JSON drops the key and the server
# render keeps it, so the two renders disagree about the shape of every row.
Invoke-Probe -Name 'an absent picture is written as undefined' -File $Producer `
  -Find '    return picture ? { ...row, profileImage: picture } : row;' `
  -Replace '    return { ...row, profileImage: picture };' `
  -ExpectTest 'adds the picture and NOTHING ELSE from the user card'

Invoke-Probe -Name 'an empty board still hits the database' -File $Producer `
  -Find '  if (rows.length === 0) return rows;' `
  -Replace '' `
  -ExpectTest 'does not look anything up for an empty board'

Write-Host ''
Write-Host '=== One producer for the page, the arena and the poll ===' -ForegroundColor Cyan

Invoke-Probe -Name 'the arena service skips the pictures' -File $Service `
  -Find '  const rows = await attachProfileImages(ranked);' `
  -Replace '  const rows = ranked;' `
  -ExpectTest 'is the one producer, called by the arena service and by the lobby'

Invoke-Probe -Name 'the lobby is handed the rows without pictures' -File $Page `
  -Find '            leaderboard={gameLeaderboard}' `
  -Replace '            leaderboard={leaderboard}' `
  -ExpectTest 'is the one producer, called by the arena service and by the lobby'

# The board looking players up itself is a second producer beside the service's.
Invoke-Probe -Name 'the board looks the player up itself' -File $Board `
  -Find '                  src={row.profileImage}' `
  -Replace '                  src={getUsersByIds([row.userId]).then(() => row.profileImage)}' `
  -ExpectTest 'the board draws the picture off the row and never looks a player up itself'

Write-Host ''
Write-Host '=== The picture reaches the chip ===' -ForegroundColor Cyan

Invoke-Probe -Name 'the board never passes the picture' -File $Board `
  -Find '                  src={row.profileImage}' `
  -Replace '' `
  -ExpectTest 'the board draws the picture off the row and never looks a player up itself'

Invoke-Probe -Name 'the chip ignores src and draws initials' -File $KitRow `
  -Find '  if (src) {' `
  -Replace '  if (false as boolean) {' `
  -ExpectTest 'renders the platform.s ProfileImage when handed a picture, initials otherwise'

Write-Host ''
Write-Host '=== The leader''s gold is flush-only ===' -ForegroundColor Cyan

# Pushing the gold onto the card form changes the trading board through a shared helper.
Invoke-Probe -Name 'the card form goes gold too' -File $KitRow `
  -Find '  if (isCurrentUser) return NEON_ROW_YOU;
  if (rank >= 1 && rank <= 3) return NEON_ROW_PODIUM;' `
  -Replace '  if (rank === 1) return NEON_ROW_FLUSH_LEADER;
  if (isCurrentUser) return NEON_ROW_YOU;
  if (rank >= 1 && rank <= 3) return NEON_ROW_PODIUM;' `
  -ExpectTest 'is drawn on the flush board whoever the leader is, and never on the card form'

# The old order - you before leader - hides the gold exactly when the reference draws it.
Invoke-Probe -Name 'you beats the leader on the flush board' -File $KitRow `
  -Find '    if (rank === 1) return NEON_ROW_FLUSH_LEADER;
    if (isCurrentUser) return NEON_ROW_FLUSH_YOU;' `
  -Replace '    if (isCurrentUser) return NEON_ROW_FLUSH_YOU;
    if (rank === 1) return NEON_ROW_FLUSH_LEADER;' `
  -ExpectTest 'is drawn on the flush board whoever the leader is, and never on the card form'

# A left bar instead of a frame is the podium tint in a different colour, not the reference.
#
# THIS PROBE CAME BACK GREEN THE FIRST TIME IT WAS RUN, and the cause was a weak test rather
# than a missing guard: the assertion was `\bborder\b`, a hyphen is a word boundary, so
# `border-l-2` satisfied it and the mutation below was indistinguishable from the real thing.
# The assertion now demands the all-sides utility standing alone. Keeping the note here as
# well as in the test, because the next person to loosen that regex will be reading this file.
Invoke-Probe -Name 'the gold is a left bar rather than a frame' -File $Tokens `
  -Find '  "rounded-lg border border-l-2 border-[#FFC01B]/80 bg-gradient-to-r from-[#FFB300]/20 to-[#FFB300]/5";' `
  -Replace '  "border-l-2 border-[#FFC01B]/80 bg-gradient-to-r from-[#FFB300]/20 to-[#FFB300]/5";' `
  -ExpectTest 'frames the row on every side in the reference.s gold'

Write-Host ''
Write-Host '=== The marker and the score gold ===' -ForegroundColor Cyan

Invoke-Probe -Name 'the game board falls back to medals' -File $Board `
  -Find '<NeonRankBadge rank={row.currentRank} size="sm" style="plates" />' `
  -Replace '<NeonRankBadge rank={row.currentRank} size="sm" />' `
  -ExpectTest 'the game board asks for plates and the trading board still gets medals'

# Making plates the default reaches the trading board without its file changing at all.
Invoke-Probe -Name 'plates become the default' -File $KitRow `
  -Find '  style = "medals",' `
  -Replace '  style = "plates",' `
  -ExpectTest 'the game board asks for plates and the trading board still gets medals'

Invoke-Probe -Name 'the podium cut-off comes back' -File $Board `
  -Find '<span className={`text-sm font-bold ${NEON_SCORE_GOLD}`}>' `
  -Replace '<span className={`text-sm font-bold ${row.currentRank <= 3 ? "text-amber-300" : "text-gray-100"}`}>' `
  -ExpectTest 'writes every score in one gold, from the kit, with no podium cut-off'

# The gold typed into the board instead of taken from the kit - the drift the kit-only literal
# test exists for, in a different suite.
Invoke-Probe -Name 'the score gold is typed into the board' -File $Board `
  -Find '<span className={`text-sm font-bold ${NEON_SCORE_GOLD}`}>' `
  -Replace '<span className="text-sm font-bold text-[#FFD72D]">' `
  -ExpectTest 'owns kit literal 6 in the kit and nowhere else' -Suite $PlayUiSuite

Write-Host ''
Write-Host '=== The panel''s chrome ===' -ForegroundColor Cyan

Invoke-Probe -Name 'the panel goes back to Standings' -File $Layout `
  -Find '            title="Leaderboard"' `
  -Replace '            title="Standings"' `
  -ExpectTest 'is headed Leaderboard, scoped Global, and leaves through the kit.s outline button'

Invoke-Probe -Name 'the exit is hand-rolled again' -File $Layout `
  -Find '                tone="outline"' `
  -Replace '                tone="quiet"' `
  -ExpectTest 'is headed Leaderboard, scoped Global, and leaves through the kit.s outline button'

# A dead tab teaches a player the screen is broken.
Invoke-Probe -Name 'dead scope tabs are drawn' -File $Layout `
  -Find '<NeonScopeStrip scopes={["Global"]} />' `
  -Replace '<NeonScopeStrip scopes={["Global", "Friends", "Country"]} />' `
  -ExpectTest 'draws no dead scope tabs'

Invoke-Probe -Name 'the count says traders' -File $Live `
  -Find '  return <NeonCountPill>Players ({rows.length})</NeonCountPill>;' `
  -Replace '  return <NeonCountPill>Traders ({rows.length})</NeonCountPill>;' `
  -ExpectTest 'counts players in the reference.s form, and never traders'

Write-Host ''
Write-Host 'Done. Every probe above must read RED with exactly 1 failure.' -ForegroundColor Cyan
Write-Host 'GREEN means the guard is absent, weak, unreachable, or the mutation changed no observable.' -ForegroundColor DarkGray
