# Probes for the arena play screen rebuilt on the owner's reference.
#
# WHAT THIS SLICE DID, 11 September 2026: the owner supplied `arena-target-full.png` with the
# verdict "the structure is very not professional". Three things on it belong to this
# repository - the heading block, a heading over the prize figures, and the player's own rank -
# and those are what these probes aim at.
#
# WHAT IS DELIBERATELY UNPROBED, because nothing here can reach it. Half of that reference is
# drawn INSIDE the games-service iframe: the round header, the board and its bezel, the
# Hint/Undo/Clear rail, the LEVEL/Moves/Best Time/Combo column and SUBMIT SOLUTION.
# `ProviderGameFrame` renders one lit frame around a bare `<iframe>` and nothing within it, and
# the two repositories share no code by design (`npm run check:isolation`). A probe mutating a
# platform file to test the board's chrome would report on nothing.
#
# Conventions carried from the earlier harnesses in this folder, each of which cost a false
# result once:
#
#   * UTF-8 WITHOUT a BOM on the read AND the write. PowerShell 5.1's `Get-Content -Raw` decodes
#     with the system ANSI codepage, which mangles every emoji in the touched file and writes the
#     mojibake back - it surfaces two steps later as unexplained typecheck errors.
#   * `-LiteralPath` semantics via `System.IO.File`, WHICH MATTERS HERE - the play page's path
#     contains `[id]`, and PowerShell parses that as a wildcard character class. A `Get-Content`
#     on it returns nothing while `Set-Content` writes the nothing back, so the route is emptied
#     and every probe goes red on the expected test for entirely the wrong reason.
#   * Refuse to write when the read came back empty.
#   * Relax newlines in the pattern, because a CRLF pattern never matches an LF file - and a
#     probe that fails to apply is indistinguishable from a test that does not work.
#   * Run the expected test ALONE with `-t` and read the summary counts. Searching whole-suite
#     output for a test's name reports RED for a passing test just as readily.
#   * DID NOT APPLY means the target moved, never that the run was quiet.
#
# ONE THING SPECIFIC TO THIS SLICE. Two probes below are CONTROLS - they inject something that
# looks like the defect and must stay GREEN, because the guard they appear to test deliberately
# permits it. Reading the direction in order to describe it in words is legitimate; only
# comparing two scores with it is not. The first version of that guard banned the identifier
# outright and failed on correct code, which is the kind of guard the first person it
# inconveniences deletes.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Suite = '__tests__/games/provider-play-ui.test.ts'

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
    # A control probe asserts the guard does NOT fire. Green is the pass.
    [switch]$ExpectGreen
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
    # Collapse whitespace: `Out-String` wraps at the console width, so a long line arrives split.
    $flat = ($out -replace '\s+', ' ')
    if ($flat -match 'Tests\s+(\d+)\s+failed') {
      $failed = [int]$Matches[1]
      if ($ExpectGreen) {
        Write-Host "[$Name] CONTROL FAILED - the guard fires on code it must permit" -ForegroundColor Red
      } elseif ($failed -eq 1) {
        Write-Host "[$Name] RED (1 failure, as expected)" -ForegroundColor Green
      } else {
        Write-Host "[$Name] RED but $failed failures - blast radius, check the probe" -ForegroundColor Yellow
      }
    } elseif ($flat -match 'No test found') {
      Write-Host "[$Name] NO TEST RAN - the expected test name is wrong" -ForegroundColor Magenta
    } elseif ($ExpectGreen) {
      Write-Host "[$Name] GREEN (control, as expected)" -ForegroundColor Green
    } else {
      Write-Host "[$Name] GREEN - the guard is absent, weak, unreachable, or changes no observable" -ForegroundColor Red
    }
  } finally {
    Write-Source $path $original
  }
}

$Page = 'app/(root)/competitions/[id]/play/page.tsx'
$Panel = 'components/games/arena/ArenaContestPanel.tsx'
$Identity = 'components/games/arena/ArenaIdentity.tsx'
$Layout = 'components/games/arena/GameArenaLayout.tsx'
$PrizeTable = 'components/competitions/PrizeTable.tsx'
$Tokens = 'components/neon/tokens.ts'

Write-Host ''
Write-Host '=== The prize figures say what they are ===' -ForegroundColor Cyan

# The defect as it shipped on 5 September and stood for six days: the amounts rendered with no
# heading at all, directly under the contest facts, so they read as more facts.
Invoke-Probe -Name 'the heading is removed again' -File $Page `
  -Find '              title="Prize breakdown"' `
  -Replace '              title="Prizes"' `
  -ExpectTest 'gives the prize table a heading'

# The other half. A heading inside the component reads as two headings on both lobbies, where
# the table already sits inside a titled accordion - so it gets deleted there and the arena
# silently loses it again.
#
# RE-AIMED: the first version injected `// Prize breakdown` as a COMMENT and came back green,
# correctly - `readCode` strips comments before matching, which is what stops a file being
# flagged for discussing the anti-pattern it avoids. Inject real markup.
Invoke-Probe -Name 'the table grows a heading of its own' -File $PrizeTable `
  -Find '    <div className="space-y-2">' `
  -Replace '    <div className="space-y-2">
      <h3>Prize breakdown</h3>' `
  -ExpectTest 'gives the prize table a heading'

# Containment, not adjacency. This is the probe that found the first version of the assertion
# weak: it slid the table out past the panel's closing tag, leaving the heading over an empty
# box and the amounts bare underneath - and a slice taken backwards from the table still found
# the panel's opening tag, so the guard reported everything was fine.
Invoke-Probe -Name 'the table slides out from under the heading' -File $Page `
  -Find '              <PrizeTable competition={contest} creditSymbol={creditSymbol} />
            </NeonHeadedPanel>' `
  -Replace '            </NeonHeadedPanel>
          )}
          {prizePositions > 0 && (
            <PrizeTable competition={contest} creditSymbol={creditSymbol} />' `
  -ExpectTest 'gives the prize table a heading'

# The reference says "Top 3 win" because its mock contest pays three. An operator configures
# any number, so a literal is a caption wrong for every contest but one.
Invoke-Probe -Name 'the paying positions become a literal' -File $Page `
  -Find 'Top {prizePositions} win' `
  -Replace 'Top 3 win' `
  -ExpectTest 'counts the paying positions'

Write-Host ''
Write-Host '=== The rank is read, never worked out ===' -ForegroundColor Cyan

# R37 repeated: a screen that decides its own order is a second place the score direction is
# decided, and the two disagreeing means the board says one thing and the payout does another.
Invoke-Probe -Name 'the page sorts the rows itself' -File $Page `
  -Find '  const yourRank = rows.find((row) => row.userId === session.user.id)?.currentRank;' `
  -Replace '  const yourRank =
    [...rows].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).findIndex((row) => row.userId === session.user.id) + 1;' `
  -ExpectTest 'orders nothing itself'

Invoke-Probe -Name 'the lookup is dropped for a hard-coded place' -File $Page `
  -Find 'rows.find((row) => row.userId === session.user.id)?.currentRank' `
  -Replace 'undefined' `
  -ExpectTest 'takes currentRank off the matching row'

# An absent rank as `#1` is the read-side form of the phantom `score: 0` R50 removed - a screen
# telling somebody they lead a contest they have not played.
#
# THE ANCHOR IS ASCII. The first version matched the line including its em dash and reported
# DID NOT APPLY: PowerShell 5.1 reads a UTF-8 script with no BOM using the system ANSI
# codepage, so the dash in the PATTERN arrives mangled and cannot match the file. Anchor on the
# `typeof` test, which is the operator the guard is about anyway.
Invoke-Probe -Name 'an absent rank renders a position' -File $Panel `
  -Find '              value: typeof rank === "number"' `
  -Replace '              value: typeof rank === "number" || true' `
  -ExpectTest 'renders a dash for a player who holds no rank'

# The page holds the ranked rows and is therefore the one file that could reorder them.
Invoke-Probe -Name 'the page reaches for the direction' -File $Page `
  -Find '  const yourRank = rows' `
  -Replace '  const scoreDirection = "higher_is_better";
  void scoreDirection;
  const yourRank = rows' `
  -ExpectTest 'reads the score direction only to describe it in words'

# A SECOND use in the panel is the shape that matters: one to describe, one to compare.
Invoke-Probe -Name 'the panel gains a second use of the direction' -File $Panel `
  -Find '  const scoring = scoringSummary(' `
  -Replace '  const best = presentation.scoreDirection === "lower_is_better";
  void best;
  const scoring = scoringSummary(' `
  -ExpectTest 'reads the score direction only to describe it in words'

# CONTROL. The guard bans ORDERING, not reading - a screen may show a score, and on this one it
# must. Written as a ban on touching the rows at all it would fire on correct code, which is the
# kind of guard the first person it inconveniences deletes.
Invoke-Probe -Name 'CONTROL: the page reads a score without ordering anything' -File $Page `
  -Find '  const yourRank = rows' `
  -Replace '  const topScore = rows[0]?.score;
  void topScore;
  const yourRank = rows' `
  -ExpectTest 'orders nothing itself' -ExpectGreen

# CONTROL. The sentence the direction becomes is wording, and wording is not what this pins.
# Reading the direction in order to describe it is the only way a player learns whether a high
# score or a low one wins, and the first version of this guard banned the identifier outright.
Invoke-Probe -Name 'CONTROL: the describing sentence is reworded' -File $Panel `
  -Find '  const scoring = scoringSummary(' `
  -Replace '  // Turns the title''s declared direction into the sentence a player reads.
  const scoring = scoringSummary(' `
  -ExpectTest 'reads the score direction only to describe it in words' -ExpectGreen

Write-Host ''
Write-Host '=== The header can be read before the board is reached ===' -ForegroundColor Cyan

# The genre, the title and the description were in one flex row, so the title competed with a
# badge and three lines of operator copy for one line's worth of attention.
Invoke-Probe -Name 'the genre moves back beside the title' -File $Identity `
  -Find '          <span className="inline-block rounded border border-violet-500/40' `
  -Replace '          <h1 className="text-2xl">{presentation.gameName}</h1>
          <span className="inline-block rounded border border-violet-500/40' `
  -ExpectTest 'puts the genre above the title'

# `description` has no practical length limit, and unclamped it pushes the board - the thing a
# paying player came for - below the fold.
Invoke-Probe -Name 'the description is unclamped' -File $Identity `
  -Find 'line-clamp-3' `
  -Replace 'leading-relaxed' `
  -ExpectTest 'clamps the description'

Write-Host ''
Write-Host '=== The bottom band survives a slot that renders nothing ===' -ForegroundColor Cyan

# The reference's three side-by-side panels, tried and reverted. Both children return `null`
# when they have no content, and rules text is absent on EVERY title until the catalogue is
# re-synced - so a two-thirds column holding a component that returned null is still a
# two-thirds column, and a layout cannot see that its child rendered nothing.
Invoke-Probe -Name 'the band is put back into grid columns' -File $Layout `
  -Find '      <div className="mt-5 space-y-5">
        {rules}' `
  -Replace '      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {rules}' `
  -ExpectTest 'stacks the band instead of placing it in grid columns'

Write-Host ''
Write-Host '=== One definition of the hairline ===' -ForegroundColor Cyan

# It had escaped into three consumers before anybody noticed. The stat strip draws its internal
# separators with this exact tone, so a divider beside them that is one shade off shows as a
# visible join - nothing fails, nothing logs, and it reads as a rendering artefact rather than a
# colour somebody typed.
Invoke-Probe -Name 'the seam colour is written out in a consumer' -File $Panel `
  -Find '<div className={`space-y-px ${NEON_SEAM}`}>' `
  -Replace '<div className="space-y-px bg-[#16203C]">' `
  -ExpectTest 'owns kit literal 3 in the kit'

Invoke-Probe -Name 'the divider colour is written out in a consumer' -File $Panel `
  -Find '<div className={`space-y-3 border-t ${NEON_DIVIDER} px-4 py-3`}>' `
  -Replace '<div className="space-y-3 border-t border-[#16203C] px-4 py-3">' `
  -ExpectTest 'owns kit literal 4 in the kit'

# The kit half. Reading the kit first is what makes the assertion a comparison rather than a
# snapshot: if the design changes, the literal moves and the test names where it went.
Invoke-Probe -Name 'the kit stops owning the seam' -File $Tokens `
  -Find 'export const NEON_SEAM = "bg-[#16203C]";' `
  -Replace 'export const NEON_SEAM = "bg-[#152039]";' `
  -ExpectTest 'owns kit literal 3 in the kit'

Write-Host ''
Write-Host 'Done. Every probe above must read RED with exactly 1 failure, except the two' -ForegroundColor Cyan
Write-Host 'marked CONTROL, which must read GREEN.' -ForegroundColor Cyan
Write-Host ''
