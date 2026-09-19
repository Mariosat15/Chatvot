# Probes for the board's size: the single-column arena, and the height that follows the width.
#
# THE DEFECT THESE EXIST FOR, reported by the owner on 11 September 2026: *"this is the large
# board, when we choose medium and large the system makes the board smaller"*. The board is
# width-bound inside the platform's arena - a 450-to-650-pixel middle column, and a cell is
# square - and two rails beside it were taking about a third of that width. An 8x8 divided what
# was left into cells at their 34-pixel floor while a 4x4, dividing the same remainder four ways,
# looked perfectly healthy. Nothing errored and nothing logged.
#
# Every probe below reintroduces one part of that and must turn exactly the named test red.

$ErrorActionPreference = 'Continue'
Set-Location (Split-Path -Parent $PSScriptRoot)
. "$PSScriptRoot\probe-harness.ps1"

$PLAY_SUITE = "tools/test-play.ts"
$PRESENTATION_SUITE = "tools/test-presentation.ts"
$CSS = "public/play/app.css"
$HTML = "public/play/index.html"
$APP = "public/play/app.js"
$PRESENTATION = "public/play/presentation.js"

$ARENA_TEST = "the arena stretches the board's row and gives the board the whole width"
$MOVED_TEST = "the actions and the figures are out of the board's row"
$MEASURE_TEST = "the fit and the height request measure the same space"
$FOLLOWS_TEST = "the height asked for follows the width the frame has, and still ignores the height"
$FILLS_TEST = "a bigger grid does not get a smaller board"
$ENDS_TEST = "a width the board cannot use leaves the cell at the target or the floor"

Write-Host ""
Write-Host "Probing the board's size" -ForegroundColor Cyan
Write-Host ""

$results = @()

# ------------------------------------------------------------------------------------------
# The layout: the rails are what took the width
# ------------------------------------------------------------------------------------------

$results += Invoke-Probe -Name "the arena is three columns again - a rail, the board, a rail" `
  -Suite $PLAY_SUITE -File $CSS `
  -Find "  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) auto;" `
  -Replace "  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-rows: minmax(0, 1fr) auto;" `
  -ExpectRed $ARENA_TEST

$results += Invoke-Probe -Name "the arena centres its row again - fitBoard measures the grid" `
  -Suite $PLAY_SUITE -File $CSS `
  -Find "  grid-template-rows: minmax(0, 1fr) auto;
  align-items: stretch;" `
  -Replace "  grid-template-rows: minmax(0, 1fr) auto;
  align-items: center;" `
  -ExpectRed $ARENA_TEST

# A media query re-laying the arena is how the three-column version comes back at one width only,
# which is the arrangement that fired inside every laptop-sized iframe.
$results += Invoke-Probe -Name "a media query re-lays the arena at some width" `
  -Suite $PLAY_SUITE -File $CSS `
  -Find "@media (max-width: 420px) {
  /* Submit takes its own line; two icon buttons beside it leave it about five characters. */
  .footer-actions {" `
  -Replace "@media (max-width: 420px) {
  .arena {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .footer-actions {" `
  -ExpectRed $ARENA_TEST

$results += Invoke-Probe -Name "an action rail is put back beside the board" `
  -Suite $PLAY_SUITE -File $HTML `
  -Find '        <div class="arena">
          <div id="board-wrap" class="board-wrap">' `
  -Replace '        <div class="arena">
          <div class="action-rail"></div>
          <div id="board-wrap" class="board-wrap">' `
  -ExpectRed $MOVED_TEST

# The figures above the board rather than under it. On a phone that is the top of the frame given
# to four stat tiles with the board below the fold - the `order` trap, from the DOM side.
$results += Invoke-Probe -Name "the figures come before the board in the arena" `
  -Suite $PLAY_SUITE -File $HTML `
  -Find '        <div class="arena">
          <div id="board-wrap" class="board-wrap">' `
  -Replace '        <div class="arena">
          <aside class="stat-rail"></aside>
          <div id="board-wrap" class="board-wrap">' `
  -ExpectRed $ARENA_TEST

$results += Invoke-Probe -Name "Submit stops taking the leftover width and can match Clear's" `
  -Suite $PLAY_SUITE -File $CSS `
  -Find ".submit-wide {
  flex: 1 1 auto;" `
  -Replace ".submit-wide {
  width: 100%;" `
  -ExpectRed $MOVED_TEST

# ------------------------------------------------------------------------------------------
# The measure: one space, two callers
# ------------------------------------------------------------------------------------------

$results += Invoke-Probe -Name "fitBoard measures the wrap itself again" `
  -Suite $PLAY_SUITE -File $APP `
  -Find "  const space = boardSpace();
  board.resize(space.width, space.height);" `
  -Replace "  const box = ui.boardWrap.getBoundingClientRect();
  board.resize(box.width - 8, box.height - 8);" `
  -ExpectRed $MEASURE_TEST

$results += Invoke-Probe -Name "the height request stops following the width" `
  -Suite $PLAY_SUITE -File $APP `
  -Find "    availableWidth: playing ? boardSpace().width : undefined," `
  -Replace "    availableWidth: undefined," `
  -ExpectRed $MEASURE_TEST

# ------------------------------------------------------------------------------------------
# The arithmetic
# ------------------------------------------------------------------------------------------

$results += Invoke-Probe -Name "the request ignores the width and asks for the target cell" `
  -Suite $PRESENTATION_SUITE -File $PRESENTATION `
  -Find "    const cell = positive(availableWidth)
      ? widthBoundCellPx(availableWidth, cols, rows)
      : TARGET_CELL_PX;" `
  -Replace "    const cell = TARGET_CELL_PX;" `
  -ExpectRed $FOLLOWS_TEST

$results += Invoke-Probe -Name "the width-bound cell forgets the bezel" `
  -Suite $PRESENTATION_SUITE -File $PRESENTATION `
  -Find "  const grid = spaceForGrid(availableWidth, horizontal);" `
  -Replace "  const grid = Math.floor(availableWidth);" `
  -ExpectRed $FILLS_TEST

# The generic bezel reaches 14% past the grid and the drawn 4x4's reaches 35% horizontally, so
# reserving the generic share for a drawn board overflows its own frame off the edge.
$results += Invoke-Probe -Name "the width-bound cell reserves the generic bezel for every board" `
  -Suite $PRESENTATION_SUITE -File $PRESENTATION `
  -Find "  const { horizontal } = frameOverhang(boardFrameFor(cols, rows));" `
  -Replace "  const { horizontal } = frameOverhang(null);" `
  -ExpectRed $FILLS_TEST

$results += Invoke-Probe -Name "the width-bound cell loses its floor and its cap" `
  -Suite $PRESENTATION_SUITE -File $PRESENTATION `
  -Find "  return Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, Math.floor(grid / cols)));" `
  -Replace "  return Math.floor(grid / cols);" `
  -ExpectRed $ENDS_TEST

# A grid with no columns divides the width by zero, and the clamp below turns the `Infinity` into
# `MAX_CELL_PX` - a request for a frame a third taller than the board needs, on the one code path
# that runs before anything has been laid out.
$results += Invoke-Probe -Name "a grid with no columns divides the width by zero" `
  -Suite $PRESENTATION_SUITE -File $PRESENTATION `
  -Find "  if (!cols || !positive(availableWidth)) return TARGET_CELL_PX;" `
  -Replace "  if (!positive(availableWidth)) return TARGET_CELL_PX;" `
  -ExpectRed $ENDS_TEST

# NOT PROBED, DELIBERATELY, AND THIS IS THE ENTRY RATHER THAN A GAP: removing the width half of
# that same guard leaves the suite green, because `spaceForGrid` answers 0 for anything that is
# not a positive number and the `!positive(grid)` line below then returns the target. The two
# cover each other, so the mutation reaches no observable. Shipping it green would teach the next
# reader that the early return is decoration; the comment on the function says what it is for.

Write-ProbeSummary $results
