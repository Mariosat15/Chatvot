# Probes for the figures: one caption per figure, and one size for every box.
#
# THE REPORT THESE EXIST FOR, from the owner on 11 September 2026: *"boards done needs to replace
# solved and solved deleted, no need both, and rearrange bottom info to be aligning"*. The round
# header read "Solved 0" and the strip under the board read "Boards done 0" - the same number
# twice on one screen - and the boxes in that strip were not the same size, because the meter and
# the tile group split the row by a fixed share that is only correct at one tile count.
#
# Neither is a failure anything could detect. Both figures were right, and the strip laid out
# exactly as its stylesheet said. Every probe below restores one half and must turn exactly the
# named test red.

$ErrorActionPreference = 'Continue'
Set-Location (Split-Path -Parent $PSScriptRoot)
. "$PSScriptRoot\probe-harness.ps1"

$PLAY_SUITE = "tools/test-play.ts"
$PRESENTATION_SUITE = "tools/test-presentation.ts"
$CSS = "public/play/app.css"
$APP = "public/play/app.js"
$PRESENTATION = "public/play/presentation.js"

$CAPTION_TEST = "no figure in the strip repeats a caption from the header"
$DENOMINATOR_TEST = "a title with a fixed set of boards gets a denominator; one without does not"
$CLAMP_TEST = "the board cell never counts past the set it belongs to"
$STRIP_TEST = "every box in the figures strip is one part of the same whole"

Write-Host ""
Write-Host "Probing the figures" -ForegroundColor Cyan
Write-Host ""

$results = @()

# ------------------------------------------------------------------------------------------
# One figure, one caption
# ------------------------------------------------------------------------------------------

# The defect itself, restored verbatim: the tile that said the same thing as the header cell.
$results += Invoke-Probe -Name "the boards-done tile is back in the strip as well as the header" `
  -Suite $PRESENTATION_SUITE -File $PRESENTATION `
  -Find '    { key: "moves", label: "Moves", value: String(positive(moves) ? Math.round(moves) : 0) },
  ];' `
  -Replace '    { key: "moves", label: "Moves", value: String(positive(moves) ? Math.round(moves) : 0) },
    { key: "solved", label: "Boards done", value: "0" },
  ];' `
  -ExpectRed $CAPTION_TEST

# The other way the duplicate returns: the header goes back to its old caption and the strip
# keeps a "Boards done" tile. Same screen, same two figures - so the guard has to catch it from
# whichever side it arrives, which a test naming three tile keys would not.
$results += Invoke-Probe -Name "the header goes back to Solved" `
  -Suite $PRESENTATION_SUITE -File $PRESENTATION `
  -Find '      label: "Boards done",
      value: target === null' `
  -Replace '      label: "Solved",
      value: target === null' `
  -ExpectRed $DENOMINATOR_TEST

# A caption that says "boards done" over the board you are ON. This is the version that was there
# before, and under the old label it was correct - which is exactly why it has to be probed now.
$results += Invoke-Probe -Name "the targeted cell names the current board again" `
  -Suite $PRESENTATION_SUITE -File $PRESENTATION `
  -Find 'value: target === null ? String(solved) : `${Math.min(solved, target)} / ${target}`,' `
  -Replace 'value: target === null ? String(solved) : `${Math.min(solved + 1, target)} / ${target}`,' `
  -ExpectRed $DENOMINATOR_TEST

$results += Invoke-Probe -Name "the count is no longer held to the set it belongs to" `
  -Suite $PRESENTATION_SUITE -File $PRESENTATION `
  -Find 'value: target === null ? String(solved) : `${Math.min(solved, target)} / ${target}`,' `
  -Replace 'value: target === null ? String(solved) : `${solved} / ${target}`,' `
  -ExpectRed $CLAMP_TEST

# ------------------------------------------------------------------------------------------
# One size for every box
# ------------------------------------------------------------------------------------------

# The fixed share, restored exactly as it was. It matches the meter while there are two tiles and
# stops matching the moment "best board" appears, which is the state the owner photographed.
$results += Invoke-Probe -Name "the tile group takes a fixed share of the strip again" `
  -Suite $PLAY_SUITE -File $CSS `
  -Find "  flex: var(--tiles) 1 calc(var(--tiles) * 7rem);" `
  -Replace "  flex: 2 1 18rem;" `
  -ExpectRed $STRIP_TEST

$results += Invoke-Probe -Name "the meter claims two parts, so it is twice a tile" `
  -Suite $PLAY_SUITE -File $CSS `
  -Find "  flex: 1 1 7rem;
  min-width: 0;
  display: grid;" `
  -Replace "  flex: 2 1 7rem;
  min-width: 0;
  display: grid;" `
  -ExpectRed $STRIP_TEST

# The stylesheet can divide by `--tiles` perfectly and still be wrong at every count but the
# fallback, if nobody publishes the number. This is the half a CSS-only assertion cannot see.
$results += Invoke-Probe -Name "the tile count is never published to the stylesheet" `
  -Suite $PLAY_SUITE -File $APP `
  -Find '    ui.statRail.style.setProperty("--tiles", String(tiles.length));' `
  -Replace '    // (the count is not published)' `
  -ExpectRed $STRIP_TEST

Write-ProbeSummary $results
