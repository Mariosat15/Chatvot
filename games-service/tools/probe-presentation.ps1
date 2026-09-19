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
$SuiteBoard = 'tools/test-board.ts'

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
  -Find '  const { screen, gridWidth, gridHeight, chromeHeight, contentHeight } = input ?? {};' `
  -Replace '  const { screen, gridWidth, gridHeight, chromeHeight, contentHeight, currentHeight } = input ?? {};
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
  -Find '    return clampFrame(chrome + framedGridPx(rows * TARGET_CELL_PX, vertical) + BOARD_FRAME_PX);' `
  -Replace '    return clampFrame(chrome + framedGridPx(rows * MIN_CELL_PX, vertical) + BOARD_FRAME_PX);' `
  -ExpectRed "a board always asks for more than a host's usual minimum, at every grid size" -MaxRed 4

# The reserve for the drawn 4x4 board is three times the generic bezel's. Reserving the generic
# share clips the artwork top and bottom on every screen, while the grid inside still fits and
# still works - so there is no error and the board merely looks cut off.
#
# RE-AIMED. This was first aimed at 'a taller grid asks for a taller frame' and came back GREEN:
# the generic reserve also grows with the rows, so that test is true of both figures. The
# mutation has an observable - the 4x4 request is about 85px shorter - and the test below is the
# one that reads it.
$results += Invoke-Probe -Name 'the frame height reserves the generic bezel for every board' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '    return clampFrame(chrome + framedGridPx(rows * TARGET_CELL_PX, vertical) + BOARD_FRAME_PX);' `
  -Replace '    return clampFrame(chrome + framedGridPx(rows * TARGET_CELL_PX) + BOARD_FRAME_PX);' `
  -ExpectRed "the frame height reserves the drawn frame's own depth, not the generic bezel's"

Write-Host ""
Write-Host "The three drawn boards" -ForegroundColor Cyan

# A drawn frame chosen for the wrong size paints a 6x6 grid under an 8x8 game: the wires land
# between the painted cells and the board reads as broken rather than as plain.
$results += Invoke-Probe -Name 'a drawn frame is chosen for the wrong grid size' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  return DRAWN_BOARD_FRAMES.find((frame) => frame.cells === gridWidth) ?? null;' `
  -Replace '  return DRAWN_BOARD_FRAMES.find((frame) => frame.cells >= gridWidth) ?? null;' `
  -ExpectRed 'each of the three grid sizes has its own drawn frame, and nothing else does'

# A rectangle handed a square picture: the painted cells cannot line up with the grid on both axes.
$results += Invoke-Probe -Name 'a non-square grid is handed a square drawn frame' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  if (!positive(gridWidth) || gridWidth !== gridHeight) return null;' `
  -Replace '  if (!positive(gridWidth)) return null;' `
  -ExpectRed 'each of the three grid sizes has its own drawn frame, and nothing else does'

# One inset for all four sides is 2.5% off on the 4x4 art - a band of page inside the bezel, or the
# outer row of painted cells clipped, and both read as "the art is a bit off".
$results += Invoke-Probe -Name 'the inset is written as one figure for all four sides' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  return [pct(f.top), pct(f.right), pct(f.bottom), pct(f.left)].join(" ");' `
  -Replace '  return [pct(f.top), pct(f.top), pct(f.top), pct(f.top)].join(" ");' `
  -ExpectRed "the artwork's inset is written per side, negative, as percentages"

# The old single reserve, with the per-axis figure ignored. A 4x4 board then gets the space a
# generic-bezel board would and its frame overflows the column.
$results += Invoke-Probe -Name 'the grid reserve ignores the frame it was told about' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  const total = positive(overhang) ? overhang : 2 * BOARD_ART_OVERHANG;
  return Math.floor(available / (1 + total));' `
  -Replace '  const total = 2 * BOARD_ART_OVERHANG;
  return Math.floor(available / (1 + total));' `
  -ExpectRed "the space reserved for the frame is the frame's own, on each axis"

# A board screen taking the measured content height is the feedback loop by another route: the
# content is inside the frame, so its height IS the frame's height, and measuring it is the same
# fixed point by a different name.
#
# Declared at 5 - the four above plus the branch's own test. This probe deletes the board branch
# entirely, so it is the widest legitimate blast radius in this file and everything it breaks is
# a property of that branch. SIX since 11 Sep 2026: the drawn-frame depth test reads the same
# branch, so it goes red with the rest - an honest sixth face of one mutation, and the limit was
# raised rather than the test weakened.
$results += Invoke-Probe -Name 'a board screen measures its content like a panel does' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  if (screen === "play") {' `
  -Replace '  if (false) {' `
  -ExpectRed 'a panel screen asks for its measured content, and a board screen ignores it' -MaxRed 6

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
#
# RE-AIMED on 8 September 2026, for the same reason as the sibling probe in `probe-board.ps1`: the
# allowlist it removed an entry from stopped existing when R52's second fix derived the served set
# from the directory, so it reported DID NOT APPLY - which reads like a broken harness rather than
# a moved target. The half that can still go wrong is a module the directory does not hold, so the
# mutation now renames the import instead.
#
# Declared at 3, and the width is the finding rather than harness damage: renaming `board.js`'s
# import means `board.js` itself cannot be imported, so the test that reads `BOARD_ART` out of it
# to check the artwork is served fails too. That is the defect's real blast radius - an ES module
# that 404s takes its importer down with it - and tightening this to 1 would mean deleting the
# artwork assertion to make a probe tidy.
$results += Invoke-Probe -Name 'a module reached only by import goes missing' `
  -Suite $SuitePlayRoutes -File 'public/play/board.js' `
  -Find 'from "./presentation.js";' `
  -Replace 'from "./presentation-v2.js";' `
  -ExpectRed 'every module the play surface imports is served' -MaxRed 3

Write-Host ""
Write-Host "The arcade pass - movement and sound" -ForegroundColor Cyan

$srcSound = 'public/play/sound.js'
$srcStyles = 'public/play/app.css'

# The default, which is the only way this decision fails without anybody noticing. Written as
# `stored === "on"`, the game is mute for every player who has never touched the control - which
# is all of them - and a silent game is indistinguishable from broken audio, so it is reported as
# a fault or not at all, never as a preference bug.
$results += Invoke-Probe -Name 'sound defaults to off for a player who never chose' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  return stored !== soundPreferenceValue(false);' `
  -Replace '  return stored === soundPreferenceValue(true);' `
  -ExpectRed 'an absent preference means sound is on, and only the stored word turns it off'

# `aria-pressed` describes the button's own action, and the button MUTES. Swapped, nothing changes
# on screen and a screen-reader user is told the exact opposite of the truth - the one failure of
# this control that no sighted reviewer can see.
#
# Declared at 3: the markup carries the default state's label so a screen reader reaching the
# button before the script runs does not announce a bare "button", and that copy is compared
# against this function. One rule, three observable consequences.
$results += Invoke-Probe -Name 'the mute control reports pressed when sound is ON' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '    ? { label: "Mute sound", pressed: "false", icon: "\u{1F50A}" }' `
  -Replace '    ? { label: "Mute sound", pressed: "true", icon: "\u{1F50A}" }' `
  -ExpectRed 'the control is pressed when MUTED, which is the opposite of sound being on' `
  -MaxRed 3

# An object lookup walks the prototype chain, so `toneRecipe("constructor")` returns something
# truthy that survives the `!recipe` test in `playRecipe` and fails later somewhere unrelated.
# Nothing hands this a value from a request today, which is exactly when a lookup gets reused.
$results += Invoke-Probe -Name 'the tone table becomes an object literal again' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  return TONE_RECIPES.get(name) ?? null;' `
  -Replace '  return Object.fromEntries(TONE_RECIPES)[name] ?? null;' `
  -ExpectRed 'a tone name from the prototype chain is not a tone'

# Derived from "is this pair joined" rather than from the transition, a note sounds on every
# pointer move for the rest of the drag - sixty times a second while the finger keeps travelling.
# The board does not fail; it screams.
$results += Invoke-Probe -Name 'a joined pair counts as newly joined for ever' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  const had = new Set(Array.isArray(before) ? before : []);' `
  -Replace '  const had = new Set();' `
  -ExpectRed 'only a pair that was not joined a moment ago counts as newly joined'

# Uncapped, a Sprint player who solved forty boards watches forty ticks before being told their
# round is over. It reads as the result screen hanging, which is the complaint that arrives.
$results += Invoke-Probe -Name 'the count-up runs one step per board, however many' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  const count = Math.min(whole, COUNT_UP_MAX_STEPS);' `
  -Replace '  const count = whole;' `
  -ExpectRed 'the count-up stops short of being a wait, and refuses to count to one'

# The write, not the read. A file where the read is guarded and the write is not passes any "is
# there a try/catch here" check while still throwing the first time somebody presses mute - and
# `localStorage` throws rather than returning null when a browser refuses it, which an iframe on
# somebody else's domain very much can be.
$results += Invoke-Probe -Name 'the mute choice is written outside a catch' `
  -Suite $SuitePlayRoutes -File $srcSound `
  -Find '  try {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, soundPreferenceValue(enabled));
  } catch {' `
  -Replace '  window.localStorage.setItem(SOUND_PREFERENCE_KEY, soundPreferenceValue(enabled));
  try {' `
  -ExpectRed 'the mute preference survives a browser that refuses storage'

# `AudioContext.resume()` returns a promise, and awaiting it before playing the Start sound is the
# obvious thing to write. It puts an audio device between the player's tap and the POST that
# starts their clock - on a timed title the clock IS the score, and a slow handset costs them time
# they paid for with nothing in any log to say so.
$results += Invoke-Probe -Name 'the start sound waits for the audio hardware' `
  -Suite $SuitePlayRoutes -File $srcSound `
  -Find '  function resume() {' `
  -Replace '  async function resume() {
    await Promise.resolve();' `
  -ExpectRed 'nothing on the gameplay path ever waits for a sound'

# Moved below the `await`, the unlock is no longer inside the click as far as the browser is
# concerned. The context is created suspended, never produces a sound, and the game is silent for
# the whole round with nothing anywhere to say why.
$results += Invoke-Probe -Name 'the audio context is opened after the round has started' `
  -Suite $SuitePlayRoutes -File $srcClient `
  -Find '  sound.unlock();
  sound.play("start");' `
  -Replace '  sound.play("start");' `
  -ExpectRed 'nothing on the gameplay path ever waits for a sound'

# An animation added without its reduced-motion half changes nothing for anybody who has not set
# the preference, so it passes every review and every screenshot. There is no symptom to notice.
#
# AIMED AT `.board-stage.refused` RATHER THAN THE FIRST SELECTOR IN THE LIST, and the reason is a
# finding rather than a detail. The first attempt removed `svg#board .join-pulse` and reported
# GREEN - correctly, because that selector is named again three rules below under `display: none`,
# which stops it moving just as thoroughly. The probe had not restored a defect. It did expose a
# weak test, which now asserts what the reduced rule DOES rather than that the selector is
# mentioned; this selector appears exactly once, so the mutation is a real omission.
$results += Invoke-Probe -Name 'an animation is added and the reduced-motion half is forgotten' `
  -Suite $SuitePlayRoutes -File $srcStyles `
  -Find '  .board-stage.solved::after,
  .board-stage.refused {' `
  -Replace '  .board-stage.solved::after {' `
  -ExpectRed 'every animation the stylesheet adds is switched off under reduced motion'

# The other half of the same guard, and the one the first version of this test could not see: the
# selectors all present, under a rule that changes something else entirely. It reads as covered on
# any scan that looks for the name, which is what the first version of this test did.
$results += Invoke-Probe -Name 'a reduced-motion rule is present but stops nothing moving' `
  -Suite $SuitePlayRoutes -File $srcStyles `
  -Find '  .board-stage.refused {
    animation: none;
  }' `
  -Replace '  .board-stage.refused {
    opacity: 1;
  }' `
  -ExpectRed 'every animation the stylesheet adds is switched off under reduced motion'

# The count-up written the natural way round. A browser that never fires the interval again - a
# backgrounded tab, a phone throttling a hidden frame - freezes the figure at "2" on a round that
# solved five, and the player has been told they lost.
$results += Invoke-Probe -Name 'the count-up starts before the correct figure is on screen' `
  -Suite $SuitePlayRoutes -File $srcClient `
  -Find '  ui.resultStat.textContent = statValue;

  const steps' `
  -Replace '  const steps' `
  -ExpectRed 'the score counts up from a value that is already correct'

# The markup's label is a second copy of something `soundControlCopy` owns, so it can disagree.
# A control announcing "unmute" on a game already making a noise is wrong in the way nobody
# sighted can see, and nothing else in this repository compares the two.
$results += Invoke-Probe -Name 'the markup announces the opposite of the default state' `
  -Suite $SuitePlayRoutes -File $srcMarkup `
  -Find '              aria-label="Mute sound"' `
  -Replace '              aria-label="Unmute sound"' `
  -ExpectRed 'the mute control ships announcing the state it is actually in'

Write-Host ""
Write-Host "The play screen's instruments" -ForegroundColor Cyan

# THE ONE THAT MATTERS. The reference design puts a running SCORE in the round header, and this
# client has no honest source for one: `PlayState` carries no score, no rank and no prize.
#
# So a score cell could only be filled by computing one HERE - a second scoring authority, which
# is the single thing the provider seam exists to prevent. The mutation is the shape somebody
# would actually write: a plausible local figure, derived from real facts, that nothing
# authoritative ever agreed to.
$results += Invoke-Probe -Name 'a locally-computed score appears in the round header' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '    { key: "clock", label: "Time left", value: null },' `
  -Replace '    { key: "clock", label: "Time left", value: null },
    { key: "score", label: "Score", value: String(solved * 250) },' `
  -ExpectRed 'the header never states a score, and neither does anything beside the board'

# Circuit Sprint has no fixed set of boards, so there is no denominator to show. Written as one
# branch, the game promises every Sprint player a finishing line the title does not have - and
# `boardTarget` is undefined there, so the cell reads "3 / undefined".
$results += Invoke-Probe -Name 'a title with no fixed set is given a denominator anyway' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '    target === null
      ? { key: "board", label: "Solved", value: String(solved) }
      : { key: "board", label: "Board", value: `${Math.min(solved + 1, target)} / ${target}` },' `
  -Replace '    { key: "board", label: "Board", value: `${solved + 1} / ${target}` },' `
  -ExpectRed 'a title with a fixed set of boards gets a denominator; one without does not' -MaxRed 2

# The clamp. The last board is solved before the round's own state turns terminal, so there is a
# moment where `boardsSolved` equals the target - and unclamped the header says "6 / 5", telling a
# player who has just finished everything that there is another board coming.
$results += Invoke-Probe -Name 'the board cell counts past the set it belongs to' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '      : { key: "board", label: "Board", value: `${Math.min(solved + 1, target)} / ${target}` },' `
  -Replace '      : { key: "board", label: "Board", value: `${solved + 1} / ${target}` },' `
  -ExpectRed 'the board cell never counts past the set it belongs to'

# The header writing the clock's value as well as its caption. Two writers for one figure, and the
# winner is whichever ran last - so the clock freezes on every board change, which is the one
# readout a player under a clock is watching.
$results += Invoke-Probe -Name 'the header writes the clock value as well as its caption' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '    { key: "clock", label: "Time left", value: null },' `
  -Replace '    { key: "clock", label: "Time left", value: "0:00" },' `
  -ExpectRed 'the clock cell brings its caption and deliberately not its value'

# Driven by pairs joined, the meter sits at 100% while the server refuses the board with
# `incomplete_coverage` - because this puzzle is only complete when every SQUARE is used too. A
# full bar over a refused board reads to a player as the game being broken.
$results += Invoke-Probe -Name 'the meter measures pairs joined instead of coverage' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  const { used, cells } = input ?? {};
  if (!positive(cells)) return { fraction: 0, percent: 0 };
  const filled = positive(used) ? Math.min(used, cells) : 0;' `
  -Replace '  const { joined, pairs: cells } = input ?? {};
  if (!positive(cells)) return { fraction: 0, percent: 0 };
  const filled = positive(joined) ? Math.min(joined, cells) : 0;' `
  -ExpectRed 'progress is COVERAGE, not pairs joined' -MaxRed 2

# The fill is a CSS transform, so a fraction above 1 overflows its track and a fraction of `NaN`
# removes the bar entirely. `getBoundingClientRect` on a hidden element returns zeroes, which is
# exactly the state this screen is in for the frame before it is shown.
$results += Invoke-Probe -Name 'the meter is not clamped to the grid it measures' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  const filled = positive(used) ? Math.min(used, cells) : 0;' `
  -Replace '  const filled = used;' `
  -ExpectRed 'progress is COVERAGE, not pairs joined'

# The elapsed figure is the difference of two wall-clock readings, and a device that suspends its
# timers produces a negative or a zero. Taken literally, either becomes the player's "best" for
# the rest of the round and can never be beaten.
$results += Invoke-Probe -Name 'a nonsensical board time becomes the best one' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return previous;' `
  -Replace '  if (!Number.isFinite(elapsedMs)) return previous;' `
  -ExpectRed 'the best board time keeps the quicker of the two, and survives a bad reading'

# Taking the later reading rather than the quicker one. "Best" then means "most recent", which is
# a figure that moves in both directions under a label promising it only improves.
$results += Invoke-Probe -Name 'the best board time keeps the most recent instead of the quickest' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  return Math.min(previous, elapsedMs);' `
  -Replace '  return elapsedMs;' `
  -ExpectRed 'the best board time keeps the quicker of the two, and survives a bad reading'

# A tile reading "-" beside three real figures reads as a number that failed to load, and the
# first board of every round would show one - so this is the common case rather than an edge.
$results += Invoke-Probe -Name 'the best-board tile is rendered empty before there is one' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  const best = formatBoardTime(bestBoardTime(null, bestBoardMs));
  if (best) tiles.push({ key: "best", label: "Best board", value: best });' `
  -Replace '  const best = formatBoardTime(bestBoardTime(null, bestBoardMs));
  tiles.push({ key: "best", label: "Best board", value: best || "-" });' `
  -ExpectRed 'the best-board tile is omitted until there is one, never shown empty'

# Locked must be checked FIRST. The other way round, a board still holding paths offers an enabled
# Undo after the round has ended, and `board.undo()` then refuses it - a control that appears to
# work and does nothing, which is the shape this codebase keeps finding.
$results += Invoke-Probe -Name 'undo is offered on a locked board' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find '  if (locked) return { disabled: true, title: "The board is locked." };
  if (!canUndo) return { disabled: true, title: "Nothing to undo yet." };' `
  -Replace '  if (!canUndo) return { disabled: true, title: "Nothing to undo yet." };
  if (false) return { disabled: true, title: "The board is locked." };' `
  -ExpectRed 'undo is offered only when there is something to remove, and never on a locked board'

# THE FAIRNESS RULE, asserted rather than left as a comment. The reference design shows a Hint
# button with a count of three; a hint tells a player something about the solution they had not
# worked out, which improves a score in a paid contest, and a consumable count is the marketplace
# mechanic the platform's rule names explicitly. This is what somebody adding it would write.
$results += Invoke-Probe -Name 'a hint allowance is added beside undo' `
  -Suite $SuitePresentation -File $srcPresentation `
  -Find 'export function undoState(input) {' `
  -Replace 'export function hintState(input) {
  const { hintsLeft } = input ?? {};
  return { disabled: !hintsLeft, title: `${hintsLeft ?? 0} hints left` };
}

export function undoState(input) {' `
  -ExpectRed 'nothing here offers a hint, and that is the fairness rule rather than a gap'

Write-Host ""
Write-Host "The board's own half of undo, and the move count" -ForegroundColor Cyan

$srcBoard = 'public/play/board.js'

# Keyed on which pairs are JOINED rather than on which was drawn, undo skips a player's most
# recent work - an abandoned half-drawn route - and removes something from several moves ago
# instead. A control that undoes the wrong thing is worse than no control, because the player then
# has to repair it under a clock.
$results += Invoke-Probe -Name 'undo follows the joined pairs rather than the drawn ones' `
  -Suite $SuiteBoard -File $srcBoard `
  -Find '    return drawOrder.length > 0 ? drawOrder.at(-1) : null;' `
  -Replace '    const joined = joinedIds();
    return joined.length > 0 ? joined.at(-1) : null;' `
  -ExpectRed 'undo follows the order pairs were DRAWN, not the order they were joined'

# Reporting success without removing anything. `app.js` plays the clearing sound only when
# `undo()` says it removed something, so a false success is the game making the noise of an action
# it did not take - and a disabled button can still be reached by keyboard on some browsers.
#
# Declared at 3: "an empty board has nothing to undo" is one rule with three observable faces,
# because a cleared board and a fresh board are both empty boards. All three assert that `undo()`
# RETURNS false rather than merely doing nothing, which is the half that matters - `app.js` plays
# the clearing sound on a true, so a false success is the game making the noise of an action it
# did not take.
$results += Invoke-Probe -Name 'undo claims success on a locked or empty board' -MaxRed 3 `
  -Suite $SuiteBoard -File $srcBoard `
  -Find '      if (locked || !puzzle) return false;
      const pairId = lastDrawn();
      if (pairId === null) return false;' `
  -Replace '      const pairId = lastDrawn();
      if (pairId === null) return true;' `
  -ExpectRed 'undo refuses on an empty board and on a locked one'

# The draw order is separate state from the paths, so it has to be reset alongside them. Left
# behind by `clear`, Undo stays enabled on a freshly cleared board and then reports failure when
# pressed - an enabled control that does nothing.
$results += Invoke-Probe -Name 'clearing the board leaves the draw order behind' `
  -Suite $SuiteBoard -File $srcBoard `
  -Find '      rebuildOwnership();
      dragging = null;
      drawOrder = [];
      paint();' `
  -Replace '      rebuildOwnership();
      dragging = null;
      paint();' `
  -ExpectRed 'clearing also clears what undo would reach for'

# `setPuzzle` runs for every board inside one round, so a draw order that survived would let Undo
# reach for a pair id belonging to the previous grid.
$results += Invoke-Probe -Name 'the next board inherits the previous one''s draw order' `
  -Suite $SuiteBoard -File $srcBoard `
  -Find '      locked = false;
      drawOrder = [];' `
  -Replace '      locked = false;' `
  -ExpectRed 'a new board starts with nothing to undo'

# Nothing recorded as drawn, so there is never anything to undo. The control is permanently
# disabled, which looks exactly like a control that is simply not needed yet.
$results += Invoke-Probe -Name 'nothing is recorded as having been drawn' `
  -Suite $SuiteBoard -File $srcBoard `
  -Find '    noteDrawn(dragging);' `
  -Replace '' `
  -ExpectRed 'undo removes the path drawn last, and only that one' -MaxRed 4

# A NOTE ON THE PROBE THAT IS NOT HERE.
#
# The first cut of `lastDrawn` walked backwards past entries whose paths had gone. It read as
# careful, and it was UNREACHABLE - nothing in this file can empty one pair's path without also
# removing its entry, and touching a terminal leaves a path of length one rather than none. Worse,
# it made the two resets above unprobeable: with the walk in place, removing `drawOrder = []` from
# `clear` changed no observable at all, because every stale entry's path was empty and the walk
# skipped the lot. Two guards each silently covering for the other, which is R42's shape.
#
# It was deleted rather than probed, and the two resets are the real mechanism. That is why both
# probes above go red now and reported GREEN on the first run of this file.

Write-ProbeSummary $results
