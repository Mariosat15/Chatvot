/**
 * Circuit - the play surface the platform loads in an iframe.
 *
 * WHAT THE SERVER OWNS AND THIS FILE ONLY DISPLAYS
 * -----------------------------------------------
 * The board, the clock, whether a board is solved, whether the round is over, and the score.
 * This file draws them and sends the player's drags. It never computes a score, never sends one,
 * and never asks for one - the result screen deliberately has no number on it, because the score
 * reaches the platform from our servers over a signed callback and the player's browser is not a
 * link in that chain.
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
  start: document.getElementById("start"),
  clock: document.getElementById("clock"),
  progress: document.getElementById("progress"),
  leave: document.getElementById("leave"),
  board: document.getElementById("board"),
  boardWrap: document.getElementById("board-wrap"),
  hint: document.getElementById("hint"),
  submit: document.getElementById("submit"),
  clear: document.getElementById("clear"),
  resultTitle: document.getElementById("result-title"),
  resultDetail: document.getElementById("result-detail"),
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

function reportHeight() {
  const height = Math.ceil(document.documentElement.scrollHeight);
  if (Math.abs(height - lastHeight) < 24) return;
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
  reportHeight();
}

function fail(message) {
  ui.errorDetail.textContent = message;
  show("error");
}

/*
 * A `Map`, not an object literal, and the same for the result headings below.
 *
 * Both are looked up with a value that arrived over the network, and both object indexing and `in`
 * walk the prototype chain - so `"__proto__"` returns `Object.prototype`, which is truthy and
 * survives a falsy check before failing somewhere further away. The platform found exactly that in
 * its admin round inspector on 5 September 2026. A `Map` has no prototype chain to walk, so the
 * lookup is total and the fallback is reached for every unknown key.
 */
const TITLE_NAMES = new Map([
  ["circuit-sprint", "Circuit Sprint"],
  ["circuit-perfect", "Circuit Perfect"],
]);

function titleName(gameCode) {
  return TITLE_NAMES.get(gameCode) ?? "Circuit";
}

function renderIntro() {
  ui.introTitle.textContent = titleName(state.gameCode);

  if (state.boardTarget) {
    ui.introLimit.textContent =
      "Finish " + state.boardTarget + " boards. Your total time is your score - lower is better.";
  } else if (state.durationSeconds) {
    ui.introLimit.textContent =
      "You have " +
      state.durationSeconds +
      " seconds. Solve as many boards as you can - higher is better.";
  } else {
    ui.introLimit.textContent = "";
  }

  ui.start.disabled = false;
  ui.start.textContent = state.mode === "practice" ? "Start practice" : "Start";
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
  const solved = finished.boardsSolved;

  const headings = new Map([
    ["completed", "Time!"],
    ["abandoned", "Round ended"],
    ["expired", "Round expired"],
    ["voided", "Round cancelled"],
  ]);
  ui.resultTitle.textContent = headings.get(finished.status) ?? "Round ended";

  /*
   * No score on this screen, and that is the point rather than an omission.
   *
   * The score is computed on our servers from the boards they verified and reaches the platform
   * over a signed callback. Showing a number here would mean either sending one to the browser -
   * which the specification forbids for exactly this reason - or computing one in code the player
   * can edit. Either way the player would then have a number to argue with that nothing
   * authoritative had agreed to.
   */
  ui.resultDetail.textContent =
    (solved === 1 ? "1 board solved." : solved + " boards solved.") +
    (state.mode === "practice"
      ? " Practice rounds are not scored."
      : " Your result is being confirmed.");

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

  const joined = board.joinedCount();
  const pairs = board.pairCount();
  const used = board.cellsUsed();
  const cells = board.cellCount();

  if (board.isComplete()) {
    ui.hint.textContent = "Ready.";
    ui.hint.className = "hint ready";
  } else if (joined < pairs) {
    ui.hint.textContent = "Join every pair: " + joined + " of " + pairs + ".";
    ui.hint.className = "hint";
  } else {
    ui.hint.textContent = "Use every square: " + used + " of " + cells + ".";
    ui.hint.className = "hint";
  }
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
  if (!window.confirm("Leave the round? Boards you have already solved still count.")) return;
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
  reportHeight();
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
  reportHeight();
}

boot();
