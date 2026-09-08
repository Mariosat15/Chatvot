/**
 * Circuit - the play surface the platform loads in an iframe.
 *
 * WHAT THE SERVER OWNS AND THIS FILE ONLY DISPLAYS
 * -----------------------------------------------
 * The board, the clock, whether a board is solved, whether the round is over, the score, the
 * title's name, its rules and how it scores. This file draws them and sends the player's drags.
 * It never computes a score, never sends one, and never asks for one - the result screen
 * deliberately has no number on it, because the score reaches the platform from our servers over
 * a signed callback and the player's browser is not a link in that chain.
 *
 * The name and the rules joined that list on 7 September 2026. They used to live here, in a map of
 * display names and a hard-coded list in the markup, which meant a new title showed up in the game
 * as "Circuit" and a corrected rule had to be corrected twice. See `src/games/instructions.ts`.
 *
 * WHAT IS DECIDED IN `presentation.js` AND NOT HERE
 * -----------------------------------------------
 * Every number and every sentence: the height to ask the host for, the cell size, the result
 * wording, the hint. This file reaches for `document` at module scope and so cannot be imported by
 * a test; that one does not, and is covered by `tools/test-presentation.ts`. The split is what
 * makes the two things that were wrong - the board's size and the result's wording - provable.
 *
 * STARTING IS A TAP, NOT A PAGE LOAD
 * ---------------------------------
 * The frame reads the state with a GET, which is safe, and offers a Start button. Starting the
 * clock is a POST the player triggers. The platform hit the mirror image of this on its own play
 * screen: a browser issues a GET for reasons that have nothing to do with intent - prefetch on
 * hover, a crawler, a refresh - so a clock started on load is a paid attempt spent while the
 * player was still reading the rules. On a timed title the clock IS the score, so this is not a
 * nicety.
 *
 * A round already in progress skips the button and resumes straight into the board, because there
 * is no attempt left to protect and a dropped mobile connection must not cost one.
 */

import { BOARD_ART, createBoard } from "./board.js";
import {
  BOARD_COMPLETE_MS,
  COUNT_UP_STEP_MS,
  countUpSteps,
  desiredFrameHeight,
  hintCopy,
  introCopy,
  resultCopy,
  soundControlCopy,
  withCountUpValue,
  HEIGHT_REPORT_THRESHOLD_PX,
} from "./presentation.js";
import { createSound } from "./sound.js";

/*
 * "The code arrived and started running." Read by the boot watchdog in `index.html`, which shows
 * a named error and releases the platform's overlay if this is still unset after 8 seconds.
 *
 * It is the FIRST statement after the imports on purpose. A module graph with one missing file
 * does not evaluate at all, so an unset flag is the only observable difference between "a file
 * 404ed" and "the round is slow" - and those two need different messages. Move it further down
 * and it starts meaning "boot got that far", which is a different claim and a weaker one.
 */
window.__circuitLoaded = true;

const REFUSAL_HOLD_MS = 2600;

/** How long the board's refusal shake runs. Must match `board-refused` in `app.css`. */
const REFUSAL_SHAKE_MS = 420;

/**
 * The token from the launch URL.
 *
 * It arrives in the query string because that is the only channel the specification gives a
 * provider for authenticating an embedded frame. It is read once into memory here and every
 * request afterwards sends it in the body, which keeps it out of `Referer` headers and access
 * logs for every call but the first. The document also carries `<meta name="referrer"
 * content="no-referrer">` so the one appearance in a URL cannot leak either.
 */
const token = new URLSearchParams(window.location.search).get("t") || "";

const screens = {
  loading: document.getElementById("screen-loading"),
  intro: document.getElementById("screen-intro"),
  play: document.getElementById("screen-play"),
  result: document.getElementById("screen-result"),
  error: document.getElementById("screen-error"),
};

const ui = {
  introTitle: document.getElementById("intro-title"),
  introRules: document.getElementById("intro-rules"),
  introLimit: document.getElementById("intro-limit"),
  introScoring: document.getElementById("intro-scoring"),
  introScoringPanel: document.getElementById("intro-scoring-panel"),
  introNote: document.getElementById("intro-note"),
  start: document.getElementById("start"),
  clock: document.getElementById("clock"),
  progress: document.getElementById("progress"),
  leave: document.getElementById("leave"),
  board: document.getElementById("board"),
  boardWrap: document.getElementById("board-wrap"),
  boardStage: document.getElementById("board-stage"),
  mute: document.getElementById("mute"),
  hint: document.getElementById("hint"),
  submit: document.getElementById("submit"),
  clear: document.getElementById("clear"),
  resultArt: document.getElementById("screen-result"),
  resultTitle: document.getElementById("result-title"),
  resultStat: document.getElementById("result-stat"),
  resultStatLabel: document.getElementById("result-stat-label"),
  resultNext: document.getElementById("result-next"),
  done: document.getElementById("done"),
  errorDetail: document.getElementById("error-detail"),
  retry: document.getElementById("retry"),
};

let state = null;
let clockTimer = null;
let refusalTimer = null;
let announcedFinished = false;
let countUpTimer = null;
/** The whole second the tick last sounded for, so a four-times-a-second repaint ticks once. */
let tickedSecond = -1;

/*
 * Constructing this reads the stored preference and nothing else - no `AudioContext` exists until
 * the player taps Start. That ordering is the whole reason sound is a separate module: a browser
 * builds a suspended context if you ask before a gesture, and a suspended context never plays.
 */
const sound = createSound();

/* ------------------------------------------------------------------------------------------
 * Talking to the platform
 * ---------------------------------------------------------------------------------------- */

/**
 * The four messages of the frame contract, and why the target origin is `*`.
 *
 * Nothing secret crosses this boundary by design: the platform's message type has no score, no
 * rank and no player field, and `height` is the only number in it. So `*` discloses nothing.
 *
 * The alternative is worse rather than stricter. We do not know the embedding origin - the round
 * carries a `returnUrl`, but that is where to send the player afterwards, not necessarily the page
 * we are inside, and on a white-labelled deployment the two differ. A target origin derived from
 * the wrong field does not warn: the message is dropped silently, the platform never receives
 * `ready`, and the player watches a loading spinner over a game that is running perfectly.
 *
 * The check that actually matters is on the receiving side, and the platform makes it: it compares
 * `event.origin` against the launch URL it loaded and `event.source` against the frame's own
 * window, which no unrelated page can satisfy.
 */
function tellPlatform(type, extra) {
  if (window.parent === window) return;
  try {
    window.parent.postMessage(Object.assign({ type }, extra || {}), "*");
  } catch {
    /* A frame that cannot post is still a playable game. */
  }
}

let lastHeight = 0;

function activeScreen() {
  for (const screen of Object.values(screens)) {
    if (screen && !screen.hidden) return screen;
  }
  return null;
}

function pixels(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** The gaps and padding a flex column adds around its children. */
function frameOf(element, visibleChildren) {
  const style = window.getComputedStyle(element);
  const gap = pixels(style.rowGap);
  return (
    pixels(style.paddingTop) +
    pixels(style.paddingBottom) +
    Math.max(0, visibleChildren - 1) * gap
  );
}

/** What a panel screen's own content comes to, which no arithmetic could know in advance. */
function contentHeightOf(screen) {
  const children = [...screen.children].filter((child) => !child.hidden);
  const content = children.reduce(
    (total, child) => total + child.getBoundingClientRect().height,
    0,
  );
  return content + frameOf(screen, children.length);
}

/** The header and footer bars around the board, measured rather than assumed. */
function chromeHeightOf(screen) {
  const bars = [...screen.querySelectorAll(":scope > .bar")];
  const height = bars.reduce((total, bar) => total + bar.getBoundingClientRect().height, 0);
  return height > 0 ? height + frameOf(screen, screen.children.length) : 0;
}

/**
 * Ask the host for the height this screen needs.
 *
 * THE DEFECT THIS REPLACED. It used to report `document.documentElement.scrollHeight`, and the
 * stylesheet sizes the page to `100dvh` - which inside an iframe is the iframe's own height. So
 * the game measured the frame while the platform sized the frame to the measurement, and the two
 * settled on whatever the platform had opened with: 320 pixels, its own minimum. The board then
 * fitted itself into what was left after the bars, hit its floor, and every player on every screen
 * size got the smallest board this code can draw. Nothing errored and nothing logged.
 *
 * So the height is now derived from what the game NEEDS. See `desiredFrameHeight` - the property
 * that matters is that the answer cannot depend on the height we already have, which is what makes
 * the loop impossible rather than merely unlikely.
 */
function requestHeight() {
  const active = activeScreen();
  if (!active) return;

  const playing = active === screens.play;
  const height = desiredFrameHeight({
    screen: playing ? "play" : "panel",
    gridHeight: state && state.board ? state.board.height : undefined,
    chromeHeight: playing ? chromeHeightOf(active) : undefined,
    contentHeight: playing ? undefined : contentHeightOf(active),
  });

  if (Math.abs(height - lastHeight) < HEIGHT_REPORT_THRESHOLD_PX) return;
  lastHeight = height;
  tellPlatform("resize", { height });
}

/* ------------------------------------------------------------------------------------------
 * Talking to our own server
 * ---------------------------------------------------------------------------------------- */

async function call(path, body, method) {
  const response = await fetch(path, {
    method: method || "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const message =
      (parsed && parsed.error && parsed.error.message) ||
      "Something went wrong. Please contact support.";
    throw new Error(message);
  }
  return parsed;
}

/* ------------------------------------------------------------------------------------------
 * Movement and sound
 * ---------------------------------------------------------------------------------------- */

/**
 * Whether the player has asked their device for less movement.
 *
 * Asked on every use rather than resolved once at boot. The setting is a live system preference:
 * a phone switching to a battery saver turns it on mid-round, and that is precisely the moment an
 * animation is worth dropping. A value captured at boot would honour it only for players who had
 * already decided before they opened the game.
 *
 * The stylesheet is the primary enforcement - every animation this file adds is declared in
 * `app.css` behind `@media (prefers-reduced-motion: reduce)`. This exists for the two effects CSS
 * cannot switch off, because they are driven by a timer rather than a keyframe: the result
 * screen's count-up, and the board's reaction classes, which would otherwise keep adding and
 * removing a class that paints nothing.
 */
function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    // A browser with no `matchMedia` gets the animations. Refusing them on a failed feature
    // detection would silently strip the movement from every browser that threw for any reason.
    return false;
  }
}

/**
 * Play one of the board's short reactions.
 *
 * Added if absent and removed by a timer, never removed-then-re-added. Re-triggering a CSS
 * animation requires a forced layout read between the two, and the refusal reaction can arrive
 * while a finger is still on the board - a synchronous layout in the middle of a drag is the one
 * cost the build/paint split exists to avoid. Letting a running reaction finish is the better
 * answer anyway: two overlapping shakes read as a rendering fault rather than as feedback.
 */
function flashBoard(name, ms) {
  const stage = ui.boardStage;
  if (!stage || prefersReducedMotion() || stage.classList.contains(name)) return;
  stage.classList.add(name);
  window.setTimeout(() => stage.classList.remove(name), ms);
}

/**
 * Label and press-state for the sound toggle.
 *
 * The button is `aria-pressed` on MUTE rather than on sound, because the control is a mute button
 * - a screen reader announcing "sound on, pressed" for a game that is making no noise is worse
 * than no announcement. `soundControlCopy` decides both, so the two cannot disagree.
 */
function renderSoundControl() {
  if (!ui.mute) return;
  const copy = soundControlCopy(sound.isEnabled());
  ui.mute.textContent = copy.icon;
  ui.mute.setAttribute("aria-label", copy.label);
  ui.mute.setAttribute("title", copy.label);
  ui.mute.setAttribute("aria-pressed", copy.pressed);
}

/* ------------------------------------------------------------------------------------------
 * Screens
 * ---------------------------------------------------------------------------------------- */

function show(name) {
  for (const [key, screen] of Object.entries(screens)) {
    if (screen) screen.hidden = key !== name;
  }
  requestHeight();
}

function fail(message) {
  ui.errorDetail.textContent = message;
  show("error");
  /*
   * Reason this announces `ready` on the FAILURE path too, which reads backwards: `ready` does
   * not mean "the game is playable", it means "there is something on the screen, so drop your
   * loading state". An error panel is something on the screen.
   *
   * Without it, every refusal `boot()` can hit - an expired launch token, a 401, the service
   * answering 500 - rendered this panel underneath the platform's own opaque spinner and left it
   * there for ever. The player saw an endless "Loading <game>..." and the one sentence telling
   * them what had gone wrong was painted directly beneath it, unreachable. It also removed their
   * only way out, because the button that leaves the round is inside this frame.
   */
  tellPlatform("ready");
}

function renderIntro() {
  const copy = introCopy(state);

  ui.introTitle.textContent = copy.name;
  ui.introLimit.textContent = copy.limit;
  ui.introNote.textContent = copy.note;

  /*
   * The rules come from the round state and are written with `textContent`, one element at a
   * time. Not `innerHTML`: these strings originate in our own catalogue rather than from a
   * player, so nothing here is hostile today - but a rule that arrives over the network and is
   * pasted into the document as markup is one refactor away from being a way to inject script
   * into the frame, and the frame is same-origin with the platform under the proxy deployment.
   */
  ui.introRules.replaceChildren(
    ...(state.boardRules ?? []).map((rule) => {
      const item = document.createElement("li");
      item.textContent = rule;
      return item;
    }),
  );

  // Hidden rather than left empty: a heading over nothing reads as a game that failed to load
  // half of itself.
  const scoring = typeof state.scoring === "string" ? state.scoring.trim() : "";
  ui.introScoringPanel.hidden = scoring === "";
  ui.introScoring.textContent = scoring;

  ui.start.disabled = false;
  ui.start.textContent = copy.startLabel;
  show("intro");
}

let artWarmed = false;

/**
 * Fetch the board's artwork before anything asks to draw it.
 *
 * Two reasons, and the second is the one that decides WHERE this is called from.
 *
 * The round's clock starts on the SERVER when Start is pressed, so every byte the board downloads
 * after that is taken out of the player's time. It is only about a hundred kilobytes, but it is a
 * hundred kilobytes they are paying for, and on a phone on mobile data it is the first board that
 * would pay them.
 *
 * And an image that arrives late is VISIBLE: the frame is a background behind the grid, so for one
 * or two frames the player sees a bare grid floating on the page before the bezel snaps in around
 * it. Warming on the intro screen alone was not enough, because the intro is not on every path -
 * a player resuming a round they already started goes straight to the board. So this runs at boot,
 * on every path, before the first render.
 *
 * Deliberately silent and unawaited: if a fetch fails the board still draws - every terminal has a
 * vector socket with its own numeral underneath the artwork, so a missing image costs decoration
 * and never legibility. This must not become something the game waits for.
 */
function warmBoardArt() {
  if (artWarmed) return;
  artWarmed = true;
  for (const url of BOARD_ART) {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
  }
}

function renderProgress() {
  if (state.boardTarget) {
    ui.progress.textContent = "Board " + (state.boardsSolved + 1) + " of " + state.boardTarget;
  } else {
    ui.progress.textContent = "Solved " + state.boardsSolved;
  }
}

function renderClock() {
  if (!state || !state.endsAt) {
    ui.clock.textContent = "";
    return;
  }
  const remaining = Math.max(0, new Date(state.endsAt).getTime() - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  ui.clock.textContent = minutes + ":" + String(rest).padStart(2, "0");
  const urgent = remaining <= 10_000;
  ui.clock.classList.toggle("urgent", urgent);

  /*
   * The tick is keyed on the SECOND changing, not on this function running. It runs four times a
   * second, and four ticks a second is not a countdown, it is an alarm - and the only way a
   * player could stop it would be to mute the whole game in the last ten seconds of a round.
   *
   * Not awaited, like every other sound: the clock's job is to be accurate.
   */
  if (urgent && seconds > 0 && seconds !== tickedSecond) {
    tickedSecond = seconds;
    sound.play("tick");
  }

  /*
   * At zero we ASK the server rather than deciding. The clock here is a display of `endsAt`, and
   * a browser clock can be wrong by minutes or be deliberately set wrong; the round ends when the
   * server says it has. Asking also produces the right terminal status - a finished gameplay clock
   * completes, it does not expire, and those read very differently to a player.
   */
  if (remaining === 0) {
    stopClock();
    refresh().catch((error) => fail(error.message));
  }
}

function startClock() {
  stopClock();
  // A fresh board inside the same round restarts this. Without the reset, a round that reaches
  // the last ten seconds, solves a board and carries on would never tick again for that second.
  tickedSecond = -1;
  renderClock();
  clockTimer = window.setInterval(renderClock, 250);
}

function stopClock() {
  if (clockTimer !== null) {
    window.clearInterval(clockTimer);
    clockTimer = null;
  }
}

/**
 * Count the result screen's figure up to its value.
 *
 * THE FINAL VALUE IS WRITTEN BEFORE THE ANIMATION STARTS, and the first step then rewinds it. It
 * costs one frame showing the answer, and it buys the property that matters: a browser that never
 * fires the interval again - a backgrounded tab, a phone throttling a hidden frame, a device that
 * suspends timers on lock - leaves the correct figure on screen instead of a partial one. A
 * count-up frozen at "2" on a round that solved five is a player told they lost.
 *
 * The same reason the interval writes `statValue` itself on the last step rather than the last
 * computed number: `countUpSteps` rounds, so the two are only usually equal.
 */
function countUpStat(statValue) {
  if (countUpTimer !== null) {
    window.clearInterval(countUpTimer);
    countUpTimer = null;
  }
  ui.resultStat.textContent = statValue;

  const steps = countUpSteps(parseInt(statValue, 10));
  if (steps.length === 0 || prefersReducedMotion()) return;

  let at = 0;
  ui.resultStat.textContent = withCountUpValue(statValue, steps[0]);
  countUpTimer = window.setInterval(() => {
    at += 1;
    if (at >= steps.length) {
      ui.resultStat.textContent = statValue;
      window.clearInterval(countUpTimer);
      countUpTimer = null;
      return;
    }
    ui.resultStat.textContent = withCountUpValue(statValue, steps.at(at));
  }, COUNT_UP_STEP_MS);
}

function renderResult() {
  stopClock();
  board.lock();

  const finished = state.finished || { status: state.status, boardsSolved: state.boardsSolved };
  const copy = resultCopy({
    status: finished.status,
    boardsSolved: finished.boardsSolved,
    boardTarget: state.boardTarget,
    mode: state.mode,
  });

  ui.resultTitle.textContent = copy.heading;
  countUpStat(copy.statValue);
  ui.resultStatLabel.textContent = copy.statLabel;

  /*
   * No score on this screen, and that is the point rather than an omission.
   *
   * The score is computed on our servers from the boards they verified and reaches the platform
   * over a signed callback. Showing a number here would mean either sending one to the browser -
   * which the specification forbids for exactly this reason - or computing one in code the player
   * can edit. Either way the player would then have a number to argue with that nothing
   * authoritative had agreed to. `resultCopy` takes four named fields, so there is no score to
   * read even if one were added to the state.
   */
  ui.resultNext.textContent = copy.next;

  // Which of the two pieces of artwork is shown. A trophy over a round that solved nothing reads
  // as sarcasm, so the neutral mark is not a fallback - it is the honest one for that ending.
  ui.resultArt.classList.toggle("won", copy.triumphant);

  ui.done.textContent = state.returnUrl || window.parent !== window ? "Back to contest" : "Close";
  show("result");

  // `finished` is a cue for the platform to go and poll for the result, never the result itself,
  // and it must be sent exactly once - a second one restarts the poll for a round already settled.
  if (!announcedFinished) {
    announcedFinished = true;
    tellPlatform("finished");
  }
}

function renderHint(refusal) {
  if (refusal) {
    ui.hint.textContent = refusal;
    ui.hint.className = "hint refused";
    return;
  }

  const copy = hintCopy({
    joined: board.joinedCount(),
    pairs: board.pairCount(),
    used: board.cellsUsed(),
    cells: board.cellCount(),
    complete: board.isComplete(),
  });
  ui.hint.textContent = copy.text;
  ui.hint.className = copy.tone ? "hint " + copy.tone : "hint";
}

/**
 * @param {{justJoined?:number[], complete?:boolean}} [change] What the board did, when it knows.
 *
 * `justJoined` is only ever populated by the drag - the one interaction that can complete a pair -
 * so the note sounds once, as the wire lands. Derived here instead, from "is this pair joined
 * now", it would sound again on every pointer move that kept it joined, which is sixty times a
 * second for as long as the finger keeps travelling.
 *
 * Nothing here is awaited. A sound that failed to play must cost the drag nothing.
 */
function onBoardChange(change) {
  if (refusalTimer !== null) {
    window.clearTimeout(refusalTimer);
    refusalTimer = null;
  }
  renderHint(null);
  ui.submit.disabled = !board.isComplete();

  for (const pairId of (change && change.justJoined) || []) sound.playPair(pairId);
}

const board = createBoard(ui.board, onBoardChange);

function fitBoard() {
  const box = ui.boardWrap.getBoundingClientRect();
  board.resize(box.width - 8, box.height - 8);
}

function renderPlay() {
  board.setPuzzle(state.board);
  renderProgress();
  show("play");
  fitBoard();
  onBoardChange();
  if (state.endsAt) startClock();
}

/** The one place that decides which screen a fresh server state belongs on. */
function render() {
  if (!state) return;

  if (state.finished) {
    renderResult();
    return;
  }
  if (state.board) {
    renderPlay();
    return;
  }
  renderIntro();
}

/* ------------------------------------------------------------------------------------------
 * Actions
 * ---------------------------------------------------------------------------------------- */

async function refresh() {
  state = await call("/play/api/state?t=" + encodeURIComponent(token), null, "GET");
  render();
}

async function start() {
  /*
   * THE GESTURE. A browser will not let a page make a noise until the player has touched it, so
   * this is where the audio hardware is actually opened - synchronously, inside the click
   * handler, before the `await` below. Moved after the network call it stops being "inside a
   * gesture" as far as the browser is concerned, and the game is silent for the whole round with
   * nothing in any log to say why.
   */
  sound.unlock();
  sound.play("start");

  ui.start.disabled = true;
  ui.start.textContent = "Starting...";
  try {
    state = await call("/play/api/session", { t: token });
    render();
  } catch (error) {
    fail(error.message);
  }
}

async function submit() {
  if (!board.isComplete()) return;
  sound.play("press");
  ui.submit.disabled = true;
  ui.submit.textContent = "Checking...";

  try {
    const outcome = await call("/play/api/submit", {
      t: token,
      boardIndex: state.board ? state.board.index : -1,
      paths: board.submission(),
    });

    state = outcome.state;
    ui.submit.textContent = "Submit";

    if (outcome.accepted) {
      /*
       * Celebrate BEFORE re-rendering, and note that the class goes on the stage rather than on
       * anything `render` touches. `render` replaces the whole board - the next puzzle, or the
       * result screen - so a sweep started on the SVG would be thrown away in the same tick and
       * the player would never see the one moment in the round worth marking.
       */
      sound.playBoardComplete();
      flashBoard("solved", BOARD_COMPLETE_MS);
      render();
      return;
    }

    /*
     * A refusal is information, not an error, and the server's own wording is shown verbatim.
     *
     * The refusals are named for this reason - "your paths cross" and "one square is unused" need
     * different corrections, and a generic "wrong" on a grid the player believes is finished is
     * the shape of complaint that becomes a ticket about the game being broken. The board stays
     * exactly as drawn so the player can fix it rather than redraw it.
     */
    render();
    if (screens.play && !screens.play.hidden) {
      sound.play("refused");
      flashBoard("refused", REFUSAL_SHAKE_MS);
      renderHint(outcome.message || "That board was not accepted.");
      refusalTimer = window.setTimeout(() => renderHint(null), REFUSAL_HOLD_MS);
    }
  } catch (error) {
    ui.submit.textContent = "Submit";
    ui.submit.disabled = false;
    fail(error.message);
  }
}

async function leave() {
  if (!window.confirm("Leave the round? Boards you have already finished still count.")) return;
  try {
    state = await call("/play/api/leave", { t: token });
    render();
  } catch (error) {
    fail(error.message);
  }
}

/**
 * Leaving the result screen.
 *
 * Inside a frame the platform navigates, because it owns the page - it knows whether the contest
 * still has attempts left and where the player came from. `returnUrl` is the fallback for a round
 * opened directly, which is how the service is smoke-tested.
 */
function done() {
  tellPlatform("exit");
  if (window.parent === window && state && state.returnUrl) {
    window.location.href = state.returnUrl;
  }
}

/* ------------------------------------------------------------------------------------------
 * Wiring
 * ---------------------------------------------------------------------------------------- */

ui.start.addEventListener("click", start);
ui.submit.addEventListener("click", submit);
ui.clear.addEventListener("click", () => {
  sound.play("clear");
  board.clear();
});
ui.leave.addEventListener("click", leave);
ui.done.addEventListener("click", done);

if (ui.mute) {
  ui.mute.addEventListener("click", () => {
    /*
     * Unlocked here as well as on Start, because this is the other gesture that reaches the play
     * screen. A player who muted a previous round arrives with sound off, never presses anything
     * that opens a context, and then unmutes - so without this the button would report itself on
     * and produce nothing until the round after next.
     */
    sound.unlock();
    sound.setEnabled(!sound.isEnabled());
    renderSoundControl();
    // After the toggle, so unmuting is confirmed by a noise and muting is confirmed by silence.
    sound.play("press");
  });
}
renderSoundControl();

/*
 * The third gesture, and the only one a RESUMED round offers.
 *
 * A player whose connection dropped mid-round comes back straight onto the board - there is no
 * intro and no Start button, so the tap that can open the audio hardware has to be the first
 * touch of the grid. Without this, reconnecting silently costs the player sound for the rest of
 * the round, which reads as the game breaking rather than as a browser policy.
 *
 * This sits on the drag path, so it must stay trivial: once a context exists it reads one
 * property and returns. `pointerdown` only - never `pointermove` - and passive, so it cannot
 * delay or cancel the drag `board.js` starts on the same event.
 */
ui.board.addEventListener("pointerdown", () => sound.unlock(), { passive: true });

ui.retry.addEventListener("click", () => {
  show("loading");
  refresh().catch((error) => fail(error.message));
});

window.addEventListener("resize", () => {
  if (screens.play && !screens.play.hidden) fitBoard();
  requestHeight();
});

async function boot() {
  if (!token) {
    fail("This game must be opened from the contest.");
    return;
  }
  // Before `refresh`, not after: a resumed round renders the board on the first response, and an
  // image that arrives after that is a bare grid with the bezel snapping in around it.
  warmBoardArt();
  try {
    await refresh();
  } catch (error) {
    fail(error.message);
    return;
  }
  // `ready` only once something is on the screen. It means "drop your loading state", so sending
  // it before the first paint hands the player a blank frame instead of a spinner.
  tellPlatform("ready");
  requestHeight();
}

boot();
