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

import { createBoard } from "./board.js";
import {
  desiredFrameHeight,
  hintCopy,
  introCopy,
  resultCopy,
  HEIGHT_REPORT_THRESHOLD_PX,
} from "./presentation.js";

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
  ui.clock.classList.toggle("urgent", remaining <= 10_000);

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
  renderClock();
  clockTimer = window.setInterval(renderClock, 250);
}

function stopClock() {
  if (clockTimer !== null) {
    window.clearInterval(clockTimer);
    clockTimer = null;
  }
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
  ui.resultStat.textContent = copy.statValue;
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

function onBoardChange() {
  if (refusalTimer !== null) {
    window.clearTimeout(refusalTimer);
    refusalTimer = null;
  }
  renderHint(null);
  ui.submit.disabled = !board.isComplete();
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
ui.clear.addEventListener("click", () => board.clear());
ui.leave.addEventListener("click", leave);
ui.done.addEventListener("click", done);
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
