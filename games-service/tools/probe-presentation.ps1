# Probes for the play surface's presentation layer: the size the board asks for, the words the
# player is told, and the rules that used to exist in two places.
#
# Each probe restores one defect - most of them the ACTUAL defect that was there until 7 September
# 2026 - and asserts the test written for it goes red. This layer is the part of the service with
# no compiler behind it: `presentation.js` has no types, the markup has no schema, and the wording
# is strings. A test that has only ever passed is the only thing standing between a corrected
# result screen and a silently uncorrected one.
#
# Run with: npm run probe:presentation

$ErrorActionPreference = 'Continue'
Set-Location (Split-Path -Parent $PSScriptRoot)
. "$PSScriptRoot/probe-harness.ps1"

$SuitePresentation = 'tools/test-presentation.ts'
$SuitePlayRoutes = 'tools/test-play.ts'
$SuiteCatalogue = 'tools/test-api.ts'

$srcPresentation = 'public/play/presentation.js'
$srcClient = 'public/play/app.js'
$srcState = 'src/rounds/play.ts'
$srcTitles = 'src/games/titles.ts'
$srcPage = 'src/http/play-page.ts'
$srcMarkup = 'public/play/index.html'

$results = @()

Write-Host ""
Write-Host "The size the board asks for" -ForegroundColor Cyan

# THE ORIGINAL DEFECT, restored as closely as a pure function allows.
#
# The frame reported its own `scrollHeight`, and the stylesheet sizes the page to `100dvh` - inside
# an iframe, the iframe's own height. So the game measured the frame and the platform sized the
# frame to the measurement: a fixed point at whatever the host opened with, which is 320 pixels.
# The board then hit its minimum cell size on every screen, for every player, with no error.
$results += Invoke-Probe -Name 'the height asked for is fed back from the height we have' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  const { screen, gridHeight, chromeHeight, contentHeight } = input ?? {};' `
  -Replace '  const { screen, gridHeight, chromeHeight, contentHeight, currentHeight } = input ?? {};
  if (positive(currentHeight)) return clampFrame(currentHeight);' `
  -ExpectRed 'the height asked for does not depend on the height we already have'

# The player-visible half of the same defect: a request that does not exceed the host's own
# minimum leaves the board exactly where the bug left it, which is why the assertion is against
# 320 rather than against our own floor.
#
# Declared at 4, and the width is the finding rather than harness damage: "the request is derived
# from the grid at a comfortable cell size" is ONE property with four observable consequences, and
# every one of them is a different way the old bug showed. A taller grid stops asking for more; the
# step between a panel and the smallest board falls under the report threshold, so the frame stops
# reporting at all; and the missing-grid fallback lands exactly on the floor, which is the value the
# defect produced. Tightening this to 2 would mean deleting three assertions to make a probe tidy.
$results += Invoke-Probe -Name 'the request no longer scales with the grid' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '    return clampFrame(chrome + rows * TARGET_CELL_PX + BOARD_FRAME_PX);' `
  -Replace '    return clampFrame(chrome + rows * MIN_CELL_PX + BOARD_FRAME_PX);' `
  -ExpectRed "a board always asks for more than a host's usual minimum, at every grid size" -MaxRed 4

# A board screen taking the measured content height is the feedback loop by another route: the
# content is inside the frame, so its height IS the frame's height, and measuring it is the same
# fixed point by a different name.
#
# Declared at 5 - the four above plus the branch's own test. This probe deletes the board branch
# entirely, so it is the widest legitimate blast radius in this file and everything it breaks is
# a property of that branch.
$results += Invoke-Probe -Name 'a board screen measures its content like a panel does' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  if (screen === "play") {' `
  -Replace '  if (false) {' `
  -ExpectRed 'a panel screen asks for its measured content, and a board screen ignores it' -MaxRed 5

Write-Host ""
Write-Host "The size a cell draws at" -ForegroundColor Cyan

# A cell is square and the grid may not be, so the larger fit draws a board taller than the space
# it was given - and the overflow is clipped by the frame rather than scrolled, which makes the
# bottom row undraggable.
$results += Invoke-Probe -Name 'a cell takes the larger fit instead of the smaller' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  return Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, Math.min(byWidth, byHeight)));' `
  -Replace '  return Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, Math.max(byWidth, byHeight)));' `
  -ExpectRed 'a cell takes the smaller of the two fits, because it is square'

# `getBoundingClientRect` on a hidden element returns zeroes, and a render at NaN sets every SVG
# attribute to the string "NaN" - which draws nothing and is indistinguishable, from the player's
# seat, from the game failing to load.
$results += Invoke-Probe -Name 'a nonsensical grid size is not guarded' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  if (!positive(gridWidth) || !positive(gridHeight)) return MIN_CELL_PX;' `
  -Replace '  if (false) return MIN_CELL_PX;' `
  -ExpectRed 'a missing or nonsensical measurement does not produce a NaN board'

Write-Host ""
Write-Host "What the player is told at the end" -ForegroundColor Cyan

# THE SECOND ORIGINAL DEFECT. `completed` covers two genuinely different endings - a Sprint clock
# reaching zero and a Perfect player finishing the last of a fixed set - and the heading was a
# lookup on the status, so both said the player's time was up. Circuit Perfect has no clock in its
# rules at all, so the one player who had done everything the game asked was congratulated for
# running out of time.
$results += Invoke-Probe -Name 'the heading goes back to being a lookup on the status' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '    heading = finishedEverything ? "Every board complete" : "Time''s up";' `
  -Replace '    heading = "Time''s up";' `
  -ExpectRed 'finishing every board is not reported as running out of time'

# A status nobody has defined yet is what a new terminal state looks like on the day it is added.
# Treating an unknown ending as the good one shows a player celebratory artwork for something that
# may well be a failure - and the same line decides the artwork for a void and for an empty round.
$results += Invoke-Probe -Name 'every ending is treated as the good one' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '    triumphant: status === "completed" && (finishedEverything || solved > 0),' `
  -Replace '    triumphant: true,' `
  -ExpectRed 'each ending has its own heading, and an unknown one is not silently a good outcome' -MaxRed 3

# Section 13: a voided round "is not scored, and we return the attempt to the player - no money
# moves". A player not told that assumes they have lost a paid entry, which is a support ticket
# rather than a retry.
$results += Invoke-Probe -Name 'a void stops saying the attempt comes back' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '    next = "This round was cancelled, so it was not scored. Your attempt has been given back.";' `
  -Replace '    next = "Your result is being confirmed.";' `
  -ExpectRed 'a void says the attempt has been given back, because that is what a void does'

# A round that finished no board scores nothing under both titles' rules, so telling the player
# their score is on its way sends them looking for a result that is never going to appear.
$results += Invoke-Probe -Name 'an empty round is promised a score' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  } else if (solved === 0) {' `
  -Replace '  } else if (false) {' `
  -ExpectRed 'a round that finished nothing is told there is nothing to score'

# A practice round is free, unranked and prize-less. A player who believes it counted plays the
# paid one differently - and this is the same distinction the platform makes on its own pre-flight
# panel, so the two must not disagree.
$results += Invoke-Probe -Name 'practice stops saying it changes nothing' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  } else if (practice) {
    next = "Practice rounds are not scored and change nothing in the contest.";' `
  -Replace '  } else if (false) {
    next = "";' `
  -ExpectRed 'practice says it changes nothing, on every ending'

# The rule the specification states twice: "never send us a score this way", "we will ignore any
# score arriving from the browser". A number on this screen is one the player could argue with
# that nothing authoritative had agreed to - and it is exactly the field somebody adds "just for
# the result screen".
$results += Invoke-Probe -Name 'a score reaches the result screen' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  return {
    heading,
    statValue: target !== null ? `${solved} / ${target}` : String(solved),' `
  -Replace '  return {
    heading,
    score: input?.score,
    statValue: target !== null ? `${solved} / ${target}` : String(solved),' `
  -ExpectRed 'a score handed to the result panel cannot reach the screen'

Write-Host ""
Write-Host "What the player is told at the start" -ForegroundColor Cyan

# The frame kept its own map of display names, so a title added to the catalogue appeared inside
# the game as "Circuit" while the platform showed its real name. Two names for one thing, no error.
$results += Invoke-Probe -Name 'the frame invents the title name again' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  const name = typeof title === "string" && title.trim() ? title.trim() : "Circuit";' `
  -Replace '  const name = "Circuit";' `
  -ExpectRed 'the name comes from the state, and falls back rather than showing nothing'

# The two titles rank in opposite directions and this sentence is the only place inside the game a
# player learns which. Getting it backwards has them playing to lose - which is the player-facing
# form of the warning section 6 gives about `scoreDirection`.
$results += Invoke-Probe -Name 'the scoring direction is described backwards' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '      ". Your total time is your score, and the lowest time wins.";' `
  -Replace '      ". Your total time is your score, and the highest time wins.";' `
  -ExpectRed 'a fixed set of boards is described as a race, and a clock as a count'

Write-Host ""
Write-Host "The three facts the state carries, and the rules that had two homes" -ForegroundColor Cyan

# `scoring` was missing outright until 7 September 2026: a player in a paid contest had no way to
# find out from inside the game whether a fast board was worth more than a finished one, which for
# Circuit Perfect is the difference between playing to win and playing to lose.
$results += Invoke-Probe -Name 'the state stops carrying how the title scores' `
  -Suite $SuitePlayRoutes -File $srcState `
  -Find '    scoring: title?.rulesSummary ?? "",' `
  -Replace '    scoring: "",' `
  -ExpectRed "the state carries the title's own name, rules and scoring"

# The rules used to be markup. Handing the client an empty list is what a reversion looks like:
# the page still renders, the container is still there, and the player is simply told nothing.
$results += Invoke-Probe -Name 'the state stops carrying the shared rules' `
  -Suite $SuitePlayRoutes -File $srcState `
  -Find '    boardRules: BOARD_RULES,' `
  -Replace '    boardRules: [],' `
  -ExpectRed "the state carries the title's own name, rules and scoring"

# The terminal report is the likeliest place for a score to be added "just for the result screen",
# and the client guard above would not catch it - the two guards fail differently, which is why
# both exist.
$results += Invoke-Probe -Name 'the terminal report carries a score' `
  -Suite $SuitePlayRoutes -File $srcState `
  -Find '  if (over) state.finished = { status: over, boardsSolved: solvedCount(round) };' `
  -Replace '  if (over) state.finished = { status: over, boardsSolved: solvedCount(round), score: 1 };' `
  -ExpectRed 'the state carries no score, no rank and no prize, on any status'

# The rules drifted the first time because they were hand-written twice. A title that reverts to
# its own paragraph is the same defect returning, and neither a typecheck nor a mirror check can
# see prose.
$results += Invoke-Probe -Name 'a title hand-writes its how-to-play again' `
  -Suite $SuiteCatalogue -File $srcTitles `
  -Find '  howToPlay: howToPlayProse("The next board appears as soon as you complete one."),' `
  -Replace '  howToPlay: "Connect the circles that share a number. The next board appears as soon as you complete one.",' `
  -ExpectRed "every title's how-to-play carries the shared rules, word for word"

# The other direction: rules back in the markup, where they are invisible to every other check in
# this repository and free to disagree with the catalogue.
$results += Invoke-Probe -Name 'the page hard-codes a rule again' `
  -Suite $SuitePlayRoutes -File $srcMarkup `
  -Find '            <ul id="intro-rules" class="rules"></ul>' `
  -Replace '            <ul id="intro-rules" class="rules"><li>Paths cannot cross each other or themselves.</li></ul>' `
  -ExpectRed 'the page has no rules of its own to disagree with the catalogue'

Write-Host ""
Write-Host "The failure the platform could not see" -ForegroundColor Cyan

# THE THIRD ORIGINAL DEFECT, and the one the owner actually hit: starting a round showed
# "Loading Circuit Sprint..." for ever.
#
# `fail()` rendered the error panel and said nothing, so the platform's OPAQUE overlay stayed on
# top of it. Every refusal `boot()` can reach - an expired launch token, a 401, a 500 from this
# service - looked identical from the player's seat: an endless spinner, with the sentence
# explaining it painted directly underneath and the only way out of the round in here too.
#
# Restored as an early return rather than by deleting the call, because `tellPlatform("ready")`
# appears twice in this file and the second one is the happy path. A probe that removed the wrong
# one would report on a guard nobody wrote.
$results += Invoke-Probe -Name 'an error panel stops telling the platform to drop its overlay' `
  -Suite $SuitePlayRoutes -File $srcClient `
  -Find '  show("error");' `
  -Replace '  show("error");
  return;' `
  -ExpectRed 'a failure inside the game still tells the platform to stop loading'

Write-Host ""
Write-Host "The module graph the page cannot describe" -ForegroundColor Cyan

# `presentation.js` is reached by an `import` inside another script, so the test that walks the
# document's own references never sees it. A module missing from the allowlist is a 404 in the
# middle of the graph: the importer fails to evaluate too, the game does not boot at all, and the
# only evidence is a console message in a player's browser.
$results += Invoke-Probe -Name 'a module reached only by import is dropped from the allowlist' `
  -Suite $SuitePlayRoutes -File $srcPage `
  -Find '  ["presentation.js", { file: "presentation.js", type: "text/javascript; charset=utf-8" }],' `
  -Replace '  // removed by probe' `
  -ExpectRed 'every module the play surface imports is served'

Write-ProbeSummary $results
