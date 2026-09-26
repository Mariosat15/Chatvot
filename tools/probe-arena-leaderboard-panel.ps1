# Probes for "STOP. The leaderboard implementation is structurally wrong."
#
# WHAT THIS SLICE DID, 11 September 2026: the arena's leaderboard rail was rebuilt as one
# component. Most of the reference's furniture already existed; what was missing was the panel's
# HEIGHT (its chrome was composed in `GameArenaLayout` while a separate consumer supplied the
# rows, so nothing owned it), a second heading tab, the two scopes we cannot answer, and the row
# height that ten rows need.
#
# THE CLAIMS WORTH PROBING are the two halves of the height rule, the single `flex-1`, the
# absence of a cap, the footer's position outside the scroller, and each of the three removals in
# the ranking variant - because every one of those is a mutation that renders perfectly and
# reports success.
#
# Conventions carried from the sibling harnesses, each of which cost a false result once:
#
#   * UTF-8 WITHOUT a BOM on the read AND the write. `Get-Content -Raw` decodes with the system
#     ANSI codepage and writes the mojibake back.
#   * `System.IO.File` rather than `Get-Content`, because one path here contains `[id]` and
#     PowerShell parses that as a wildcard character class - it would empty the page and report
#     success.
#   * Refuse to write when the read came back empty.
#   * Relax newlines in the pattern - a CRLF pattern never matches an LF file.
#   * Run the expected test ALONE with `-t` and read the summary counts.
#   * `-t` IS A REGULAR EXPRESSION. Every expected name below is plain ASCII, no brackets.
#   * PARAMETERISED ON THE SUITE, because three probes here prove guards in other files.
#   * DID NOT APPLY means the target moved, never that the run was quiet.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$DefaultSuite = '__tests__/games/arena-leaderboard-panel.test.ts'
$ChromeSuite = '__tests__/games/leaderboard-avatars.test.ts'
$BandSuite = '__tests__/games/arena-illustrations.test.ts'

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

$Panel = 'components/games/arena/ArenaLeaderboardPanel.tsx'
$Layout = 'components/games/arena/GameArenaLayout.tsx'
$Board = 'components/games/ProviderLeaderboard.tsx'
$Row = 'components/neon/LeaderboardRow.tsx'
$Cards = 'components/neon/Cards.tsx'

Write-Host ''
Write-Host '=== The height rule, which is the whole structural complaint ===' -ForegroundColor Cyan

# THE ONE THAT MATTERS. `h-full` on an already-stretched grid item is a no-op that reviews as
# correct - the wrapper was the right height while the panel inside it was short, which is why
# every reading of the arithmetic came back clean. This is the same mistake the bottom band made.
Invoke-Probe -Name 'the wrapper is told to stretch instead of the panel' -File $Layout `
  -Find 'xl:order-1 xl:[&>*]:h-full' `
  -Replace 'xl:order-1 xl:h-full' `
  -ExpectTest 'stretches the grid cell and reaches through it to the panel'

# The other half: the panel has to accept the height it is offered.
Invoke-Probe -Name 'the panel does not take the height' -File $Panel `
  -Find '${NEON_PANEL_LIT} flex h-full flex-col overflow-hidden' `
  -Replace '${NEON_PANEL_LIT} flex flex-col overflow-hidden' `
  -ExpectTest 'stretches the grid cell and reaches through it to the panel'

# A cap reads as a sensible precaution and is the defect: it is what made the old panel end early.
Invoke-Probe -Name 'a cap comes back' -File $Panel `
  -Find 'min-h-[400px] flex-1 overflow-y-auto' `
  -Replace 'max-h-[460px] flex-1 overflow-y-auto' `
  -ExpectTest 'caps nothing, and grows in exactly one place'

# Two growing children divide the slack, so the footer drifts up from the bottom edge by whatever
# the rows area does not need - the same empty area, a different cause.
Invoke-Probe -Name 'the footer grows too' -File $Panel `
  -Find 'className={`border-t p-3 ${NEON_DIVIDER}`}' `
  -Replace 'className={`flex-1 border-t p-3 ${NEON_DIVIDER}`}' `
  -ExpectTest 'caps nothing, and grows in exactly one place'

# Room for ten rows is worth nothing if the query returns five, and the two numbers are in
# different files.
Invoke-Probe -Name 'the room for ten rows is taken away' -File $Panel `
  -Find 'min-h-[400px] flex-1' `
  -Replace 'flex-1' `
  -ExpectTest 'leaves room for about ten rows before it has to scroll'

# Inside the scroller the button is at the foot of the LIST rather than the panel, so on a busy
# contest it is off screen and the panel has no visible exit.
# FIRST VERSION CAME BACK GREEN, the fourth cause wearing a positional disguise: it left a
# `<NeonButton` after the scroller's opening tag, which every check in the test was satisfied by.
# The mutation has to drop the scroller's CLOSING tag so the button really is inside it.
Invoke-Probe -Name 'the footer button moves inside the scroller' -File $Panel `
  -Find '      </div>

      <div className={`border-t p-3 ${NEON_DIVIDER}`}>' `
  -Replace '      <div className={`border-t p-3 ${NEON_DIVIDER}`}>' `
  -ExpectTest 'keeps the footer button out of the scroller'

Write-Host ''
Write-Host '=== Two heading tabs, not a title and a pill ===' -ForegroundColor Cyan

# A heading beside a count says one of the pair is furniture, which is what the rejected version
# was. Both have to be choosable.
Invoke-Probe -Name 'the second tab is not a control' -File $Panel `
  -Find '          onClick={() => setTab("players")}
          aria-pressed={tab === "players"}' `
  -Replace '          aria-pressed={tab === "players"}' `
  -ExpectTest 'are two real controls, each announcing which is chosen'

# Importing the kit's tokens is trivially satisfied by a file that hand-rolls a strip beside them.
Invoke-Probe -Name 'the tabs get chrome of their own' -File $Panel `
  -Find '      <div className={NEON_TABS_STRIP}>' `
  -Replace '      <div className="flex gap-1.5 border-[#16203C] bg-[#080C18] p-1.5">' `
  -ExpectTest 'wear the kit tokens rather than chrome of their own'

# The roster tab is where the removed furniture went. Deleting the activity there is deleting the
# only thing on the screen that says whether a rival is still playing.
Invoke-Probe -Name 'the roster stops saying what anybody is doing' -File $Panel `
  -Find '        const phrase = describeRoundActivity(activity[row.userId]);' `
  -Replace '        const phrase = { headline: "", tone: "idle" as const, metrics: [] };' `
  -ExpectTest 'puts what a player has been doing on the second tab, rather than deleting it'

# And the ranking table must not be handed the map at all, so a forgotten variant cannot draw the
# second line anyway.
Invoke-Probe -Name 'the ranking table is handed the activity map' -File $Panel `
  -Find '      variant="ranking"' `
  -Replace '      activity={{}}
      variant="ranking"' `
  -ExpectTest 'puts what a player has been doing on the second tab, rather than deleting it'

Write-Host ''
Write-Host '=== The three removals that make ten rows fit ===' -ForegroundColor Cyan

# Each of these renders perfectly. The failure is a row height, so there is nothing to notice.
Invoke-Probe -Name 'the ranking keeps the second activity line' -File $Board `
  -Find '            activity && !ranking ? describeRoundActivity(entry) : undefined;' `
  -Replace '            activity ? describeRoundActivity(entry) : undefined;' `
  -ExpectTest 'drops all three pieces of furniture together'

Invoke-Probe -Name 'the ranking keeps the you marker' -File $Board `
  -Find 'showYouMarker={!ranking}' `
  -Replace 'showYouMarker={true}' `
  -ExpectTest 'drops all three pieces of furniture together'

Invoke-Probe -Name 'the ranking keeps the tie pill' -File $Board `
  -Find '{row.isTied && !ranking && (' `
  -Replace '{row.isTied && (' `
  -ExpectTest 'drops all three pieces of furniture together'

# THE REMOVALS ARE ONLY SAFE BECAUSE THE FACTS SURVIVE ELSEWHERE. The viewer's mark is a tint on
# the NAME, which is the one marker that survives on the leader's gold row - a row background
# cannot. Lose the tint and the ranking variant loses the viewer entirely.
Invoke-Probe -Name 'the viewer loses the name tint as well as the word' -File $Row `
  -Find 'isCurrentUser ? "text-sky-200"' `
  -Replace 'isCurrentUser ? "text-white"' `
  -ExpectTest 'loses no fact by dropping them'

Write-Host ''
Write-Host '=== The two scopes we cannot answer ===' -ForegroundColor Cyan

# FLIPPED FROM "DRAW NEITHER" ON THE OWNER'S SECOND INSTRUCTION. They are drawn, and the original
# objection - a tab that does nothing teaches a player the screen is broken - is answered by HOW.
# A handler here is precisely the control that appears to work and does nothing.
Invoke-Probe -Name 'the dead scopes become selectable' -File $Cards `
  -Find '        <span
          key={scope}
          aria-disabled="true"' `
  -Replace '        <button
          type="button"
          key={scope}
          onClick={() => undefined}
          aria-disabled="true"' `
  -ExpectTest 'draws all three of the reference scopes, with the two we cannot answer disabled' `
  -Suite $ChromeSuite

Invoke-Probe -Name 'the dead scopes look choosable' -File $Cards `
  -Find 'NEON_TAB_DEAD' `
  -Replace 'NEON_TAB_IDLE' `
  -ExpectTest 'draws all three of the reference scopes, with the two we cannot answer disabled' `
  -Suite $ChromeSuite

Invoke-Probe -Name 'the two we cannot answer are dropped again' -File $Panel `
  -Find 'unavailable={["Friends", "Country"]}' `
  -Replace 'unavailable={[]}' `
  -ExpectTest 'draws all three of the reference scopes, with the two we cannot answer disabled' `
  -Suite $ChromeSuite

Write-Host ''
Write-Host '=== The chrome left the layout ===' -ForegroundColor Cyan

# A copy left behind renders a second heading above the panel's own, and the height rule stops
# holding because the layout owns part of the column again.
Invoke-Probe -Name 'the layout draws the scope strip again' -File $Layout `
  -Find '        <div className="order-2 lg:order-3 xl:order-1 xl:[&>*]:h-full">' `
  -Replace '        <div className="order-2 lg:order-3 xl:order-1 xl:[&>*]:h-full">
          <NeonScopeStrip scopes={["Global"]} />' `
  -ExpectTest 'is headed Leaderboard and leaves through the kit outline button' `
  -Suite $ChromeSuite

# The band's own count was file-wide and now reads three from a slice. Widening it back means the
# rail's selector is counted as the band's, which is how it failed on a correct file.
Invoke-Probe -Name 'the band counts the rail selector as its own' -File $Layout `
  -Find '        <div className="min-w-[260px] flex-[1_1_0] empty:hidden [&>*]:h-full">' `
  -Replace '        <div className="min-w-[260px] flex-[1_1_0] empty:hidden">' `
  -ExpectTest 'reaches through each wrapper to the panel inside it' `
  -Suite $BandSuite

Write-Host ''
Write-Host 'Done. Every probe should read RED with exactly 1 failure.' -ForegroundColor Cyan
