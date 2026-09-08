# Probes for the two layout blocks appended to __tests__/games/provider-play-ui.test.ts
#
# THE DEFECTS THESE GUARD, both reported by the owner as "the standings are not showing
# correctly":
#
#   1. `ProviderLeaderboard` forced `min-w-[320px]` inside an `overflow-x-auto` wrapper. In the
#      arena's standings rail that is narrower than the content, so the board scrolled sideways
#      and the SCORE COLUMN - the one number the board exists to show - was off screen.
#   2. `GameArenaLayout` set `order` only at `xl`. Grid auto-placement follows order-modified
#      document order, so at every narrower width the columns fell back to DOM order: on a phone
#      the standings came first and pushed the board below the fold, and at `lg` - two columns -
#      the standings took the wide one and the board was placed in the 320px sidebar column.
#
# Harness rules are the ones every earlier probe file here learned the hard way: read and write
# through [System.IO.File] with UTF-8 and no BOM, refuse to write when the read came back empty,
# confirm the replacement actually changed the file, and run the expected test ALONE with `-t`
# reading the summary counts - searching whole-suite output for a name finds it either way.

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Utf8 = New-Object System.Text.UTF8Encoding $false
$Suite = '__tests__/games/provider-play-ui.test.ts'

function Read-File([string]$Rel) {
  $text = [System.IO.File]::ReadAllText((Join-Path $Root $Rel), $Utf8)
  if ([string]::IsNullOrEmpty($text)) { throw "PROBE ABORT: read $Rel came back empty" }
  return $text
}

function Write-File([string]$Rel, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) { throw "PROBE ABORT: refusing to write empty $Rel" }
  [System.IO.File]::WriteAllText((Join-Path $Root $Rel), $Text, $Utf8)
}

function Relaxed([string]$Literal) {
  return ([regex]::Escape($Literal) -replace '\\r\\n|\\n', '\r?\n')
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$From,
    [string]$To,
    [string]$ExpectTest
  )

  $original = Read-File $File
  $mutated = [regex]::Replace($original, (Relaxed $From), { param($m) $To }, 1)

  if ($mutated -eq $original) {
    Write-Host "[$Name] PROBE DID NOT APPLY - pattern not found in $File" -ForegroundColor Magenta
    return
  }

  try {
    Write-File $File $mutated

    $out = & npx vitest run $Suite -t "$ExpectTest" 2>&1 | Out-String
    $flat = ($out -replace '\s+', ' ')

    $failed = 0
    if ($flat -match 'Tests\s+(\d+)\s+failed') { $failed = [int]$Matches[1] }

    if ($failed -ge 1) {
      Write-Host "[$Name] RED ($failed failed) - '$ExpectTest'" -ForegroundColor Green
    } else {
      Write-Host "[$Name] GREEN - '$ExpectTest' did not fail. Guard absent, test weak, or probe aimed wrong." -ForegroundColor Red
      Write-Host $flat
    }
  } finally {
    Write-File $File $original
    if ((Read-File $File) -ne $original) { Write-Host "[$Name] RESTORE FAILED" -ForegroundColor Red }
  }
}

$BOARD = 'components/games/ProviderLeaderboard.tsx'
$ARENA = 'components/games/arena/GameArenaLayout.tsx'

Write-Host '=== Probing the arena layout and the standings board ===' -ForegroundColor Cyan

# 1. THE FIRST DEFECT VERBATIM: the fixed minimum width and the horizontal scroller.
Invoke-Probe -Name '1 fixed width returns (the real defect)' -File $BOARD `
  -From '  return (
    <div>
      <div>' `
  -To '  return (
    <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
      <div className="min-w-[320px]">' `
  -ExpectTest 'declares no fixed width and no sideways scroll'

# 2. The row wraps again, which is what turned each rail entry into three stacked lines.
Invoke-Probe -Name '2 the row wraps' -File $BOARD `
  -From 'flex min-w-0 flex-nowrap items-center gap-2' `
  -To 'flex min-w-0 flex-wrap items-center gap-2' `
  -ExpectTest 'truncates the name rather than wrapping the row'

# 3. `1fr` instead of `minmax(0,1fr)`. This is the subtle half: a bare `1fr` is floored by its
#    content's minimum size, so the grid widens to fit a long name and the row overflows even
#    with no `min-w-` anywhere. Probe 1 stays green against it, which is why this is its own test.
Invoke-Probe -Name '3 the name column can push the grid wider' -File $BOARD `
  -From 'grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 px-3 pb-2' `
  -To 'grid grid-cols-[auto_1fr_auto] gap-2 px-3 pb-2' `
  -ExpectTest 'truncates the name rather than wrapping the row'

# 4. THE SECOND DEFECT VERBATIM: the standings carry an order only at xl, so every narrower
#    layout falls back to DOM order and puts them in front of the board.
Invoke-Probe -Name '4 order only at xl (the real defect)' -File $ARENA `
  -From '<div className="order-2 lg:order-3 xl:order-1">' `
  -To '<div className="xl:order-1">' `
  -ExpectTest 'gives all three columns an order at every breakpoint'

# 5. The stage loses its base and lg order while the OTHER two keep theirs. The counting test
#    catches it, and so must the positional one - which is the point of having both, since a
#    file with two of three children ordered is exactly the state that shipped.
Invoke-Probe -Name '5 the board alone loses its order' -File $ARENA `
  -From '<div className="order-1 lg:order-1 xl:order-2">{stage}</div>' `
  -To '<div className="xl:order-2">{stage}</div>' `
  -ExpectTest 'puts the board first on a phone and on a laptop'

# 6. The stage keeps an order at every breakpoint but is no longer FIRST at lg - it swaps with
#    the sidebar, so the board sits in the 320px column. The counting test cannot see this;
#    only the positional one can.
Invoke-Probe -Name '6 the board is ordered, but second on a laptop' -File $ARENA `
  -From '<div className="order-1 lg:order-1 xl:order-2">{stage}</div>' `
  -To '<div className="order-1 lg:order-2 xl:order-2">{stage}</div>' `
  -ExpectTest 'puts the board first on a phone and on a laptop'

# 7. The rail narrows back to 260px. Nothing in the board changes, so every other probe here
#    stays green - the two sides of the bargain need two assertions.
Invoke-Probe -Name '7 the rail narrows again' -File $ARENA `
  -From 'xl:grid-cols-[280px_minmax(0,1fr)_320px]' `
  -To 'xl:grid-cols-[260px_minmax(0,1fr)_320px]' `
  -ExpectTest 'keeps the standings rail wide enough for the board it holds'

Write-Host '=== Done ===' -ForegroundColor Cyan
