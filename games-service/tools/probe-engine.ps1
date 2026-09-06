# Probes the Circuit engine tests by injecting one defect at a time.
#
# A test that has only ever passed proves nothing. Each probe removes exactly one guard and
# asserts that the test written for it goes red - and that the blast radius is small, because
# a one-line change turning five tests red usually means the harness broke the file rather
# than the guard.
#
# LESSONS BAKED IN, EACH OF WHICH HAS ALREADY PRODUCED A FALSE RESULT ELSEWHERE IN THIS REPO:
#
#   - -LiteralPath on the READ as well as the write. Paths containing [brackets] are parsed by
#     PowerShell as a wildcard character class, so Get-Content returns $null while Set-Content
#     happily writes it back - emptying the file and reporting success.
#   - Refuse to write when the read came back empty, for the same reason.
#   - UTF-8 without a BOM on both directions. Get-Content -Raw decodes with the system ANSI
#     codepage on PowerShell 5.1, which silently mangles every emoji and accented character.
#   - Assert the file actually changed. A pattern that fails to match is indistinguishable
#     from a test that does not work, and CRLF/LF mismatches make multi-line patterns miss.
#   - Name the expected failing test and check the red one is the one meant. A probe aimed at
#     the wrong test is indistinguishable from a broken guard.

$ErrorActionPreference = 'Continue'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Source([string]$Path) {
  $full = (Resolve-Path -LiteralPath $Path).Path
  $text = [System.IO.File]::ReadAllText($full, [System.Text.Encoding]::UTF8)
  if ([string]::IsNullOrEmpty($text)) {
    throw "Read-Source got nothing from $Path - refusing to continue, this is how a probe empties a file"
  }
  return $text
}

function Write-Source([string]$Path, [string]$Text) {
  if ([string]::IsNullOrEmpty($Text)) {
    throw "Write-Source refused an empty body for $Path"
  }
  $full = (Resolve-Path -LiteralPath $Path).Path
  [System.IO.File]::WriteAllText($full, $Text, $Utf8NoBom)
}

# Escape the literal, then relax every newline, so a pattern authored with either line ending
# matches a file saved with the other.
function To-Pattern([string]$Literal) {
  return ([regex]::Escape($Literal) -replace '(\\r)?\\n', '\r?\n')
}

function Invoke-Probe {
  param(
    [string]$Name,
    [string]$File,
    [string]$Find,
    [string]$Replace,
    [string]$ExpectRed,
    # How many tests this defect may legitimately turn red.
    #
    # Defaults to 2, because for a local guard the honest number is 1 or 2 and a one-line change
    # turning five tests red usually means the harness damaged the file rather than removed the
    # guard - that is the signal that caught a probe emptying a route file entirely.
    #
    # Some properties really are cross-cutting, though: determinism is relied on by every
    # generation test, so breaking the RNG SHOULD turn four tests red. Those probes declare it,
    # so the threshold stays tight everywhere it can be.
    [int]$MaxRed = 2
  )

  $original = Read-Source $File
  $pattern = To-Pattern $Find
  $patched = [regex]::Replace($original, $pattern, [System.Text.RegularExpressions.MatchEvaluator] { param($m) $Replace }, 1)

  if ($patched -eq $original) {
    Write-Host "  ?? $Name" -ForegroundColor Yellow
    Write-Host "     PROBE DID NOT APPLY - the pattern matched nothing, so this result means nothing." -ForegroundColor Yellow
    return [pscustomobject]@{ Name = $Name; Outcome = 'DID-NOT-APPLY' }
  }

  Write-Source $File $patched
  try {
    $raw = & npx tsx tools/test-engine.ts 2>&1
    # Collapse each line's internal whitespace before matching: console wrapping and variable
    # padding both defeat a literal comparison.
    $lines = @($raw | ForEach-Object { ($_ -replace '\s+', ' ').Trim() })

    $redTests = @($lines | Where-Object { $_ -like 'FAIL *' } | ForEach-Object { $_.Substring(5).Trim() })
    $expected = ($ExpectRed -replace '\s+', ' ').Trim()
    $hitExpected = $redTests -contains $expected

    $summary = ($lines | Where-Object { $_ -match '^\d+ passed, \d+ failed$' } | Select-Object -Last 1)
  }
  finally {
    Write-Source $File $original
  }

  if ($hitExpected -and $redTests.Count -le $MaxRed) {
    Write-Host "  RED  $Name" -ForegroundColor Green
    Write-Host "       $summary | red: $($redTests -join '; ')" -ForegroundColor DarkGray
    return [pscustomobject]@{ Name = $Name; Outcome = 'RED' }
  }
  elseif ($hitExpected) {
    Write-Host "  RED* $Name" -ForegroundColor Yellow
    Write-Host "       expected test went red but $($redTests.Count) tests failed, over the declared limit of $MaxRed - suspect the harness, not the guard" -ForegroundColor Yellow
    Write-Host "       $summary | red: $($redTests -join '; ')" -ForegroundColor DarkGray
    return [pscustomobject]@{ Name = $Name; Outcome = 'RED-WIDE' }
  }
  else {
    Write-Host "  GREEN $Name" -ForegroundColor Red
    Write-Host "       expected '$expected' to fail. It did not." -ForegroundColor Red
    Write-Host "       $summary | red: $($redTests -join '; ')" -ForegroundColor DarkGray
    return [pscustomobject]@{ Name = $Name; Outcome = 'GREEN' }
  }
}

Write-Host ""
Write-Host "Probing the Circuit engine guards" -ForegroundColor Cyan
Write-Host ""

$results = @()

# MaxRed 4: determinism is cross-cutting by design. Every generation test depends on the same
# seed producing the same puzzle, so a non-deterministic RNG legitimately turns all of them red.
$results += Invoke-Probe -Name 'seeded RNG is actually seeded' `
  -File 'src/engine/rng.ts' `
  -Find 'return (t >>> 0) / 4294967296;' `
  -Replace 'return Math.random();' `
  -ExpectRed 'same seed produces the same stream' `
  -MaxRed 4

# Re-aimed. The first version weakened xmur3's mixing to a plain addition and the suite stayed
# green - correctly, because sfc32's avalanche produces wildly different first outputs from
# almost any differing state, so the divergence property does not depend on the mixing at all.
# The claim behind the probe was wrong, not the test. What IS worth pinning is that the seed
# reaches the state at all.
$results += Invoke-Probe -Name 'the seed actually reaches the generator state' `
  -File 'src/engine/rng.ts' `
  -Find 'let h = 1779033703 ^ str.length;' `
  -Replace 'let h = 1779033703; str = "";' `
  -ExpectRed 'different seeds diverge' `
  -MaxRed 4

# MaxRed 5: every test that submits the generator's own solution depends on this alignment.
$results += Invoke-Probe -Name 'solution stays aligned with its reordered pairs' `
  -File 'src/engine/generate.ts' `
  -Find 'solution: order.map((sourceIndex) => canonical.solution[sourceIndex]),' `
  -Replace 'solution: canonical.solution,' `
  -ExpectRed 'every generated puzzle is solvable by its own solution' `
  -MaxRed 5

# Re-aimed. The first version replaced the rotation with `nx = y`, which is a TRANSPOSE - still
# a perfectly good bijection, so the test was right to stay green and the probe's premise was
# simply wrong. Collapsing the coordinate is what actually destroys injectivity.
$results += Invoke-Probe -Name 'rotation is a bijection' `
  -File 'src/engine/puzzle.ts' `
  -Find 'const nx = height - 1 - y;' `
  -Replace 'const nx = 0;' `
  -ExpectRed 'each transform is a bijection on the grid'

$results += Invoke-Probe -Name 'full-coverage rule is enforced' `
  -File 'src/engine/verify.ts' `
  -Find 'if (occupied.size !== gridCells) {' `
  -Replace 'if (false) {' `
  -ExpectRed 'rejects incomplete coverage when everything else is correct'

$results += Invoke-Probe -Name 'paths may not overlap' `
  -File 'src/engine/verify.ts' `
  -Find 'if (owner !== undefined) {' `
  -Replace 'if (false) {' `
  -ExpectRed 'rejects overlapping paths, with coverage and adjacency intact'

$results += Invoke-Probe -Name 'a path may not jump between non-adjacent cells' `
  -File 'src/engine/verify.ts' `
  -Find 'if (i > 0 && !adjacent(cells[i - 1], cells[i])) {' `
  -Replace 'if (false) {' `
  -ExpectRed 'rejects a diagonal jump, with coverage and endpoints intact'

$results += Invoke-Probe -Name 'endpoints must match the pair terminals' `
  -File 'src/engine/verify.ts' `
  -Find 'if (!forwards && !backwards) {' `
  -Replace 'if (false) {' `
  -ExpectRed 'rejects wrong endpoints, with coverage and adjacency intact'

# Two separate size guards, so two probes. The total-cells one was unreachable from the
# original single test, which only ever tripped the path-count guard.
$results += Invoke-Probe -Name 'path count is capped' `
  -File 'src/engine/verify.ts' `
  -Find 'if (input.length > MAX_SUBMITTED_PATHS) return null;' `
  -Replace 'if (false) return null;' `
  -ExpectRed 'refuses an absurd number of paths'

$results += Invoke-Probe -Name 'running cell total is capped before the work' `
  -File 'src/engine/verify.ts' `
  -Find 'if (totalCells > MAX_SUBMITTED_CELLS) return null;' `
  -Replace 'if (false) return null;' `
  -ExpectRed 'refuses an absurd number of cells, in few paths'

# The regression for the bug the probes found: tightening the work bound back towards the grid
# size must turn the naming test red, or the poor-message defect can silently return.
#
# MaxRed 10, and the breadth is the point rather than a nuisance. A cell cap of 6 refuses every
# submission on the 6x6 puzzle the suite uses, so ten tests go red - which is the clearest
# available evidence that the original bug was not a cosmetic message problem. It was refusing
# real work.
$results += Invoke-Probe -Name 'work bound stays clear of the game rules' `
  -File 'src/engine/verify.ts' `
  -Find 'const MAX_SUBMITTED_CELLS = 4096;' `
  -Replace 'const MAX_SUBMITTED_CELLS = 6;' `
  -ExpectRed 'an overlapping submission is named as overlapping, not as malformed' `
  -MaxRed 10

$results += Invoke-Probe -Name 'out-of-bounds coordinates are refused' `
  -File 'src/engine/verify.ts' `
  -Find 'if (!inBounds(cell, width, height)) {' `
  -Replace 'if (false) {' `
  -ExpectRed 'rejects out-of-bounds cells'

Write-Host ""
$red = @($results | Where-Object { $_.Outcome -eq 'RED' }).Count
$wide = @($results | Where-Object { $_.Outcome -eq 'RED-WIDE' }).Count
$green = @($results | Where-Object { $_.Outcome -eq 'GREEN' }).Count
$noop = @($results | Where-Object { $_.Outcome -eq 'DID-NOT-APPLY' }).Count
Write-Host ("$red red, $wide red-but-wide, $green GREEN (bad), $noop did not apply") -ForegroundColor Cyan
Write-Host ""

if ($green -gt 0 -or $noop -gt 0) { exit 1 }
exit 0
