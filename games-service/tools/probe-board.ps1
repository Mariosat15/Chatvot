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
Write-Host "The routes that serve it" -ForegroundColor Cyan

# The token is a credential. It has to arrive in the URL, but rendering it into the document as
# well puts it in every cache that ignores our headers and in every saved copy of the page.
$results += Invoke-Probe -Name 'the launch token is rendered into the page' `
  -Suite $SuitePlay -File $srcPage `
  -Find '  res.sendFile(path.join(PLAY_ROOT, "index.html"));' `
  -Replace '  res.send(fs.readFileSync(path.join(PLAY_ROOT, "index.html"), "utf8") + String(_req.query.t ?? ""));' `
  -ExpectRed 'the page never contains the launch token'

# Without this header, any request the page makes to a third party carries the token in `Referer`.
$results += Invoke-Probe -Name 'the referrer policy is dropped' `
  -Suite $SuitePlay -File $srcPage `
  -Find '  res.setHeader("Referrer-Policy", "no-referrer");' `
  -Replace '  void 0;' `
  -ExpectRed 'the surface refuses to send a referrer'

# A renamed asset is a blank frame, and nothing but this test connects the HTML to the allowlist:
# one is markup and the other is TypeScript, so no typecheck and no lint can see the break.
$results += Invoke-Probe -Name 'an asset is renamed out from under the page' `
  -Suite $SuitePlay -File $srcPage `
  -Find '  ["app.js", { file: "app.js", type: "text/javascript; charset=utf-8" }],' `
  -Replace '  ["app-v2.js", { file: "app.js", type: "text/javascript; charset=utf-8" }],' `
  -ExpectRed 'every asset the page references is actually served' -MaxRed 3

# The allowlist is a traversal guard as much as a file list. A path segment cannot contain a
# literal slash - which is what makes serving the parameter look safe - but Express decodes route
# parameters, so `%2f` becomes `/` and `path.join` follows it out of the directory.
$results += Invoke-Probe -Name 'any filename is served, not just the allowlisted three' `
  -Suite $SuitePlay -File $srcPage `
  -Find '  const asset = ASSETS.get(String(req.params.asset));' `
  -Replace '  const asset = { file: String(req.params.asset), type: "text/javascript; charset=utf-8" };' `
  -ExpectRed 'an encoded traversal cannot read a file outside the play directory' -MaxRed 3

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
