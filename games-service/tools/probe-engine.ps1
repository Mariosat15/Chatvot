# Probes the Circuit engine guards. See tools/probe-harness.ps1 for how and why.

$ErrorActionPreference = 'Continue'
. "$PSScriptRoot/probe-harness.ps1"

$Suite = 'tools/test-engine.ts'

Write-Host ""
Write-Host "Probing the Circuit engine guards" -ForegroundColor Cyan
Write-Host ""

$results = @()

# MaxRed 4: determinism is cross-cutting by design. Every generation test depends on the same
# seed producing the same puzzle, so a non-deterministic RNG legitimately turns all of them red.
$results += Invoke-Probe -Suite $Suite -Name 'seeded RNG is actually seeded' `
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
$results += Invoke-Probe -Suite $Suite -Name 'the seed actually reaches the generator state' `
  -File 'src/engine/rng.ts' `
  -Find 'let h = 1779033703 ^ str.length;' `
  -Replace 'let h = 1779033703; str = "";' `
  -ExpectRed 'different seeds diverge' `
  -MaxRed 4

# MaxRed 5: every test that submits the generator's own solution depends on this alignment.
$results += Invoke-Probe -Suite $Suite -Name 'solution stays aligned with its reordered pairs' `
  -File 'src/engine/generate.ts' `
  -Find 'solution: order.map((sourceIndex) => canonical.solution[sourceIndex]),' `
  -Replace 'solution: canonical.solution,' `
  -ExpectRed 'every generated puzzle is solvable by its own solution' `
  -MaxRed 5

# Re-aimed. The first version replaced the rotation with `nx = y`, which is a TRANSPOSE - still
# a perfectly good bijection, so the test was right to stay green and the probe's premise was
# simply wrong. Collapsing the coordinate is what actually destroys injectivity.
$results += Invoke-Probe -Suite $Suite -Name 'rotation is a bijection' `
  -File 'src/engine/puzzle.ts' `
  -Find 'const nx = height - 1 - y;' `
  -Replace 'const nx = 0;' `
  -ExpectRed 'each transform is a bijection on the grid'

$results += Invoke-Probe -Suite $Suite -Name 'full-coverage rule is enforced' `
  -File 'src/engine/verify.ts' `
  -Find 'if (occupied.size !== gridCells) {' `
  -Replace 'if (false) {' `
  -ExpectRed 'rejects incomplete coverage when everything else is correct'

$results += Invoke-Probe -Suite $Suite -Name 'paths may not overlap' `
  -File 'src/engine/verify.ts' `
  -Find 'if (owner !== undefined) {' `
  -Replace 'if (false) {' `
  -ExpectRed 'rejects overlapping paths, with coverage and adjacency intact'

$results += Invoke-Probe -Suite $Suite -Name 'a path may not jump between non-adjacent cells' `
  -File 'src/engine/verify.ts' `
  -Find 'if (i > 0 && !adjacent(cells[i - 1], cells[i])) {' `
  -Replace 'if (false) {' `
  -ExpectRed 'rejects a diagonal jump, with coverage and endpoints intact'

$results += Invoke-Probe -Suite $Suite -Name 'endpoints must match the pair terminals' `
  -File 'src/engine/verify.ts' `
  -Find 'if (!forwards && !backwards) {' `
  -Replace 'if (false) {' `
  -ExpectRed 'rejects wrong endpoints, with coverage and adjacency intact'

# Two separate size guards, so two probes. The total-cells one was unreachable from the
# original single test, which only ever tripped the path-count guard.
$results += Invoke-Probe -Suite $Suite -Name 'path count is capped' `
  -File 'src/engine/verify.ts' `
  -Find 'if (input.length > MAX_SUBMITTED_PATHS) return null;' `
  -Replace 'if (false) return null;' `
  -ExpectRed 'refuses an absurd number of paths'

$results += Invoke-Probe -Suite $Suite -Name 'running cell total is capped before the work' `
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
$results += Invoke-Probe -Suite $Suite -Name 'work bound stays clear of the game rules' `
  -File 'src/engine/verify.ts' `
  -Find 'const MAX_SUBMITTED_CELLS = 4096;' `
  -Replace 'const MAX_SUBMITTED_CELLS = 6;' `
  -ExpectRed 'an overlapping submission is named as overlapping, not as malformed' `
  -MaxRed 10

$results += Invoke-Probe -Suite $Suite -Name 'out-of-bounds coordinates are refused' `
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
