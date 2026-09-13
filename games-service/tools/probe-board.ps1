# Probes for the play surface: the board client and the routes that serve it.
#
# Each probe removes one guard and asserts the test written for it goes red. A test that has only
# ever passed proves nothing, and the client is the half of this service where that matters most -
# it has no types, no compiler and no schema behind it.
#
# Run with: npm run probe:board

$ErrorActionPreference = 'Continue'
Set-Location (Split-Path -Parent $PSScriptRoot)
. "$PSScriptRoot/probe-harness.ps1"

$SuiteBoard = 'tools/test-board.ts'
$SuitePlay = 'tools/test-play.ts'

$srcBoard = 'public/play/board.js'
$srcPage = 'src/http/play-page.ts'

$results = @()

Write-Host ""
Write-Host "The client's input rules" -ForegroundColor Cyan

# The guard that keeps one player's mistake from making another pair unsolvable. Without it a path
# routes straight through somebody else's anchor and the board cannot be finished.
$results += Invoke-Probe -Name "another pair's terminal is no longer protected" `
  -Suite $SuiteBoard -File $srcBoard `
  -Find '    if (terminalOwner !== undefined && terminalOwner !== pairId) return false;' `
  -Replace '    if (false) return false;' `
  -ExpectRed "a path may not be routed through another pair's terminal"

# Retraction has to be checked BEFORE the no-reuse rule. Removing it makes dragging back read as
# revisiting a cell, so a player is stuck with whatever they first drew.
$results += Invoke-Probe -Name 'dragging backwards no longer retracts' `
  -Suite $SuiteBoard -File $srcBoard `
  -Find '    if (cells.length >= 2 && same(cells[cells.length - 2], cell)) {' `
  -Replace '    if (false) {' `
  -ExpectRed 'dragging back over the previous cell retracts instead of refusing'

# Full coverage is a rule of this puzzle, not a bonus. Dropping it from the completeness check
# offers Submit on a board the server refuses with `incomplete_coverage`, which reads to the player
# as the game being wrong rather than the puzzle being unfinished.
$results += Invoke-Probe -Name 'completeness stops asking whether every cell is used' `
  -Suite $SuiteBoard -File $srcBoard `
  -Find '    return owner.size === puzzle.width * puzzle.height;' `
  -Replace '    return true;' `
  -ExpectRed 'joining every pair is not enough while a square is unused'

# A phone coalesces pointer moves, so a fast drag arrives several cells apart. Refusing those makes
# the game feel unresponsive exactly when the player is trying to be quick.
#
# Declared at 3: a client that cannot follow a fast drag also fails to draw the solution at all in
# the two agreement tests, which is a legitimately cross-cutting consequence rather than harness
# damage.
$results += Invoke-Probe -Name 'a skipped cell is refused instead of walked' `
  -Suite $SuiteBoard -File $srcBoard `
  -Find '    if (walkTowards(dragging, cell)) {' `
  -Replace '    if (extendTo(dragging, cell)) {' `
  -ExpectRed 'a fast drag that skips cells is still walked one cell at a time' -MaxRed 3

# Touching a terminal means "redraw this one". Continuing the existing path instead is ambiguous
# once the path already reaches the far terminal, and leaves the player no way to start again.
$results += Invoke-Probe -Name 'touching a terminal extends rather than restarts' `
  -Suite $SuiteBoard -File $srcBoard `
  -Find '      paths.set(terminalOwner, [cell]);' `
  -Replace '      paths.set(terminalOwner, pathOf(terminalOwner).concat([cell]));' `
  -ExpectRed 'touching a terminal restarts that pair rather than extending it'

# The lock is what stops a drag landing between the final submission and the result screen from
# repainting a board the server has already closed.
$results += Invoke-Probe -Name 'a closed board still accepts drags' `
  -Suite $SuiteBoard -File $srcBoard `
  -Find '    if (locked || !puzzle) return;' `
  -Replace '    if (!puzzle) return;' `
  -ExpectRed 'a locked board ignores the player'

# An unfinished pair must be submitted as a short path rather than omitted, or a partially solved
# board comes back as `wrong_pair_count` instead of being scored on what was solved.
$results += Invoke-Probe -Name 'unfinished pairs are dropped from the submission' `
  -Suite $SuiteBoard -File $srcBoard `
  -Find '      return puzzle.pairs.map((pair) => ({ pairId: pair.id, cells: pathOf(pair.id) }));' `
  -Replace '      return puzzle.pairs.map((pair) => ({ pairId: pair.id, cells: pathOf(pair.id) })).filter((path) => path.cells.length > 1);' `
  -ExpectRed 'the submission carries one path per pair, and nothing else'

Write-Host ""
Write-Host "The artwork, and the split that lets it be drawn once" -ForegroundColor Cyan

# The numeral under the token is not decoration - it is what the player reads if the artwork does
# not arrive. A token that 404s draws nothing and the vector socket keeps the board playable; drop
# the numeral and the same 404 leaves seven identical blank discs and an unsolvable-looking puzzle.
$results += Invoke-Probe -Name 'the numeral under the token is dropped' `
  -Suite $SuiteBoard -File $srcBoard `
  -Find '  group.appendChild(label);' `
  -Replace '  void label;' `
  -ExpectRed "every terminal carries its number, so a missing image costs decoration only"

# Artwork chosen by position rather than by pair number means two terminals of the SAME pair show
# different tokens - which is exactly the thing the player is asked to match. The board still
# works, so nothing errors and nobody can win.
$results += Invoke-Probe -Name "a token is chosen by position instead of by pair" `
  -Suite $SuiteBoard -File $srcBoard `
  -Find '  return TERMINAL_ART[pairId] ?? null;' `
  -Replace '  return TERMINAL_ART[pairId + 1] ?? null;' `
  -ExpectRed "a terminal's artwork is chosen by its pair number, never by position"

# The whole point of the build/paint split. Repainting everything on every pointer move means
# re-decoding eight images and rebuilding ~100 nodes per frame - which does not fail, it just makes
# a drag stutter on the phones most players are holding.
#
# RE-AIMED on 8 September 2026. `paint()` gained an argument - the pairs that landed on this
# repaint, which is what decides whether their wire surges - so the two-line anchor stopped
# matching and the probe reported DID NOT APPLY. That reads like a broken harness rather than a
# moved target, and it is the same failure as a probe pointed at the wrong test: a result that
# means nothing while looking like one that does. The property is unchanged, so only the anchor
# moved. `paint(arrived)` appears exactly once, inside the drag handler.
$results += Invoke-Probe -Name 'a drag rebuilds the whole board again' `
  -Suite $SuiteBoard -File $srcBoard `
  -Find '      paint(arrived);' `
  -Replace '      render();' `
  -ExpectRed 'a drag repaints the wires and leaves the cells and terminals standing'

# Resizing must do the opposite: the artwork is sized in grid units, so a repaint alone leaves
# every token and the bezel at the old cell size while the wires move to the new one.
$results += Invoke-Probe -Name 'a resize only repaints' `
  -Suite $SuiteBoard -File $srcBoard `
  -Find '    );
    render();
  }' `
  -Replace '    );
    paint();
  }' `
  -ExpectRed 'resizing rebuilds, because the artwork is sized in the same units as the grid'

Write-Host ""
Write-Host "The routes that serve it" -ForegroundColor Cyan

# The token is a credential. It has to arrive in the URL, but rendering it into the document as
# well puts it in every cache that ignores our headers and in every saved copy of the page.
# RE-AIMED 11 Sep 2026. The document has been served from `PLAY_DOCUMENT` since the fingerprinting
# of s4.1o, so the old `sendFile(... "index.html")` pattern matched nothing and this probe reported
# DID NOT APPLY for three days - a moved target, not a quiet run.
$results += Invoke-Probe -Name 'the launch token is rendered into the page' `
  -Suite $SuitePlay -File $srcPage `
  -Find '  res.send(PLAY_DOCUMENT);' `
  -Replace '  res.send(PLAY_DOCUMENT + String(_req.query.t ?? ""));' `
  -ExpectRed 'the page never contains the launch token'

# Without this header, any request the page makes to a third party carries the token in `Referer`.
$results += Invoke-Probe -Name 'the referrer policy is dropped' `
  -Suite $SuitePlay -File $srcPage `
  -Find '  res.setHeader("Referrer-Policy", "no-referrer");' `
  -Replace '  void 0;' `
  -ExpectRed 'the surface refuses to send a referrer'

# A renamed asset is a blank frame, and nothing but this test connects the HTML to the served set:
# one is markup and the other is a directory listing, so no typecheck and no lint can see the break.
#
# RE-AIMED on 8 September 2026. It used to rename an entry in the hand-written `ASSETS` map, which
# stopped existing when R52's second fix derived the set from disk - so it reported DID NOT APPLY,
# which reads like a broken harness rather than a moved target. The page is the half that can still
# name a file nobody serves, so that is the half to mutate.
#
# FOUR faces, not three, since s4.1o: the immutability test also finds `app.js` by reading the
# document, so a document naming a ghost fails it too. Each of the four reads the page's script
# references and each is an honest reading of the one mutation - the limit was raised, not the
# tests loosened, when the harness reported RED* over the old limit on 11 Sep 2026.
$results += Invoke-Probe -Name 'the page asks for a script nobody serves' `
  -Suite $SuitePlay -File 'public/play/index.html' `
  -Find '<script type="module" src="/play/app.js"></script>' `
  -Replace '<script type="module" src="/play/app-v2.js"></script>' `
  -ExpectRed 'every asset the page references is actually served' -MaxRed 4

# An unserved token is the quietest failure on this screen: the board keeps working, so there is no
# error anywhere and it merely looks unfinished. Nothing but this test connects `BOARD_ART` to the
# files on disk - the hrefs are strings the browser resolves long after the code has evaluated, so
# the import-graph walk above cannot see them.
$results += Invoke-Probe -Name 'a token is named but not shipped' `
  -Suite $SuitePlay -File $srcBoard `
  -Find '  "/play/token-1.webp",' `
  -Replace '  "/play/token-99.webp",' `
  -ExpectRed 'every image the board names is served' -MaxRed 3

# The version this replaced: warm on the intro screen, which is correct on the path everybody
# tests and wrong for a player resuming a round, who never sees the intro.
$results += Invoke-Probe -Name 'the artwork is warmed on the intro screen again' `
  -Suite $SuitePlay -File 'public/play/app.js' `
  -Find '  warmBoardArt();
  try {' `
  -Replace '  try {' `
  -ExpectRed 'the artwork is fetched at boot, not when a screen happens to want it'

# The bezel overhang is declared twice - a number in `presentation.js` reserves the space, a custom
# property in `app.css` fills it - because a stylesheet cannot import a number. Drift and the
# frame's opening stops landing on the grid's edge, which reads as "the art is a bit off".
$results += Invoke-Probe -Name 'the stylesheet and the code disagree about the bezel' `
  -Suite $SuitePlay -File 'public/play/app.css' `
  -Find '  --board-art-overhang: 0.072;' `
  -Replace '  --board-art-overhang: 0.1;' `
  -ExpectRed 'the stylesheet and the board agree how far the bezel overhangs the grid'

# The postage-stamp board's second coming, 11 September 2026. Centring the arena's items shrinks
# `.board-wrap` to the grid inside it, and `fitBoard` then measures a wrap the size of the previous
# grid on every fit - converging on the 34-pixel floor while the frame stays tall. This restores the
# exact defect the owner photographed.
$results += Invoke-Probe -Name 'the arena centres the board cell again' `
  -Suite $SuitePlay -File 'public/play/app.css' `
  -Find '  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: stretch;' `
  -Replace '  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;' `
  -ExpectRed "the arena stretches the board's cell to the row and centres only the rails"

# And the other half: the rails stacking under the board at a width a laptop's iframe always has.
$results += Invoke-Probe -Name 'the rails stack under the board inside a laptop iframe again' `
  -Suite $SuitePlay -File 'public/play/app.css' `
  -Find '@media (max-width: 520px) {' `
  -Replace '@media (max-width: 680px) {' `
  -ExpectRed "the arena stretches the board's cell to the row and centres only the rails"

Write-Host ""
Write-Host "The three drawn boards" -ForegroundColor Cyan

# A drawn board's picture IS its cells. Leaving the vector cells painted under it draws two grids
# a few pixels apart, which reads as a rendering fault rather than as a decoration.
$results += Invoke-Probe -Name 'the vector cells paint under a drawn board again' `
  -Suite $SuitePlay -File 'public/play/app.css' `
  -Find '.board-stage.drawn svg#board .cell {
  fill: transparent;' `
  -Replace '.board-stage.drawn svg#board .cell {
  fill: url(#cell-face);' `
  -ExpectRed 'a drawn board hides the vector cells, keeps the wires, and comes off if its picture fails'

# The wrong extension: hiding the wires too. The picture has no wires in it, so this is a paid
# round played on a grid that shows nothing the player draws.
$results += Invoke-Probe -Name 'a drawn-board rule hides the wires' `
  -Suite $SuitePlay -File 'public/play/app.css' `
  -Find '.board-stage.drawn svg#board .junction {
  display: none;
}' `
  -Replace '.board-stage.drawn svg#board .junction {
  display: none;
}

.board-stage.drawn svg#board .trace {
  display: none;
}' `
  -ExpectRed 'a drawn board hides the vector cells, keeps the wires, and comes off if its picture fails'

# A picture that fails to load must give the vector board back. Without the check, the class stays
# on and the player drags wires over a blank square - the quietest failure the screen has, and the
# one R54 proved a stale edge cache can produce for four hours.
$results += Invoke-Probe -Name 'a picture that failed to load still hides the cells' `
  -Suite $SuitePlay -File 'public/play/app.js' `
  -Find '  const usable = frame && !failedArt.has(frame.file) ? frame : null;' `
  -Replace '  const usable = frame;' `
  -ExpectRed 'a drawn board hides the vector cells, keeps the wires, and comes off if its picture fails'

# Dressing before `setPuzzle` chooses the frame for the PREVIOUS board's shape - correct on a round
# whose boards are all one size, which is every round today, and wrong the day that changes.
$results += Invoke-Probe -Name 'the board is dressed before the puzzle is set' `
  -Suite $SuitePlay -File 'public/play/app.js' `
  -Find '  board.setPuzzle(state.board);
  // After `setPuzzle`, because the frame is chosen by the puzzle''s shape; before `fitBoard`,
  // because the space the grid may take depends on how deep that frame is.
  dressBoard();' `
  -Replace '  dressBoard();
  board.setPuzzle(state.board);' `
  -ExpectRed 'a drawn board hides the vector cells, keeps the wires, and comes off if its picture fails'

# A drawn board dropped from `BOARD_ART` is one nothing warms and nothing tests for being served -
# so the day it is renamed, the game boots and plays on an invisible grid.
$results += Invoke-Probe -Name 'the drawn boards leave the warmed list' `
  -Suite $SuitePlay -File $srcBoard `
  -Find 'export const BOARD_ART = [FRAME_ART, ...DRAWN_BOARD_FRAMES.map((frame) => frame.file), ...TERMINAL_ART];' `
  -Replace 'export const BOARD_ART = [FRAME_ART, ...TERMINAL_ART];' `
  -ExpectRed 'every image the board names is served'

# The allowlist is a traversal guard as much as a file list. A path segment cannot contain a
# literal slash - which is what makes serving the parameter look safe - but Express decodes route
# parameters, so `%2f` becomes `/` and `path.join` follows it out of the directory.
#
# Declared at 4 rather than 1: serving the parameter verbatim also hands every request the one
# hard-coded content type, so the artwork arrives as JavaScript and the token, cache and error-shape
# tests all fail with it. That is a genuine consequence of the mutation, not harness damage.
$results += Invoke-Probe -Name 'any filename is served, not just the allowlisted three' `
  -Suite $SuitePlay -File $srcPage `
  -Find '  const asset = ASSETS.get(String(req.params.asset));' `
  -Replace '  const asset = { file: String(req.params.asset), type: "text/javascript; charset=utf-8" };' `
  -ExpectRed 'an encoded traversal cannot read a file outside the play directory' -MaxRed 4

Write-Host ""
Write-Host "The state the client reads before offering Start" -ForegroundColor Cyan

# `finished` means the round is over, not "there is no board to show" - and a round nobody has
# started has no board either. Conflating them answers a fresh round with a result screen.
$results += Invoke-Probe -Name '"finished" goes back to meaning "no board"' `
  -Suite $SuitePlay -File 'src/rounds/play.ts' `
  -Find '  const over = isTerminal(round.status)' `
  -Replace '  const over = !board ? round.status : isTerminal(round.status)' `
  -ExpectRed 'a round that has not started is not reported as finished' -MaxRed 3

# The breakdown is what the platform's own `normalise.ts` reads for its display panel, under
# exactly this name. Nothing asserted it until the smoke tool printed the wrong field name and
# appeared to find a defect that was not there.
$results += Invoke-Probe -Name 'the score breakdown stops being delivered' `
  -Suite $SuitePlay -File 'src/rounds/report.ts' `
  -Find '    if (round.scoreBreakdown) body.scoreBreakdown = round.scoreBreakdown;' `
  -Replace '    void round.scoreBreakdown;' `
  -ExpectRed 'finishing every board completes the round and delivers a result'

Write-ProbeSummary $results
