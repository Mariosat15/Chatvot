/**
 * Fit Volt Stack inside the arena iframe WITHOUT overflowing.
 *
 * Owner (27 Sep 2026, image 2): the whole shell — topbar, scoreboard, board,
 * HOLD/NEXT rails — must sit inside the neon stage with a little air at the
 * bottom. Growing the host row is fine; sizing the board larger than the
 * iframe is not. Prefer a slightly smaller board over a clipped READY bar.
 *
 * Standalone offline play (no parent) is untouched.
 */
(() => {
  "use strict";

  const embedded = window.parent !== window;
  if (!embedded) return;

  document.documentElement.classList.add("cv-embedded");

  const SHELL_PAD = 16;
  const SAFETY = 28; // air under the cabinet so the bottom frame is never clipped
  const MIN_BOARD_W = 150;
  const MAX_BOARD_W = 340; // intentionally below the desktop 460 — "a bit smaller"

  function tellResize(height) {
    try {
      window.parent.postMessage(
        { type: "resize", height: Math.round(height) },
        "*",
      );
    } catch {
      /* Frame cannot talk — still playable. */
    }
  }

  function chromeHeight(shell) {
    const topbar = shell.querySelector(".topbar");
    const scoreboard = shell.querySelector(".scoreboard");
    const touch = shell.querySelector(".touch-controls");
    const footer = shell.querySelector("footer");
    const note = shell.querySelector(".integrity-note");
    let h = SHELL_PAD;
    for (const el of [topbar, scoreboard, touch, footer, note]) {
      if (!el || getComputedStyle(el).display === "none") continue;
      h += el.getBoundingClientRect().height;
    }
    // Board title sits above the cabinet and is not in the chrome list.
    h += 18;
    return h;
  }

  function fit() {
    const shell = document.querySelector(".game-shell");
    if (!shell) return;

    const viewH = window.innerHeight;
    const viewW = window.innerWidth;
    const chrome = chromeHeight(shell);

    // HARD CAP: board + frame pad must leave SAFETY px under the shell.
    const budget = Math.max(200, viewH - chrome - SAFETY);
    let boardH = budget;
    let boardW = Math.floor(boardH / 2);

    const railBudget = viewW < 520 ? 110 : viewW < 900 ? 200 : 260;
    const maxWFromWidth = Math.max(MIN_BOARD_W, Math.floor(viewW - railBudget));
    boardW = Math.min(MAX_BOARD_W, maxWFromWidth, boardW);
    boardW = Math.max(MIN_BOARD_W, boardW);
    boardH = boardW * 2;

    // Re-check height after width clamp — square cells can still overshoot.
    if (boardH + chrome + SAFETY > viewH) {
      boardH = Math.max(MIN_BOARD_W * 2, viewH - chrome - SAFETY);
      boardW = Math.max(MIN_BOARD_W, Math.floor(boardH / 2));
      boardH = boardW * 2;
    }

    const framePad = boardW < 240 ? 10 : boardW < 300 ? 14 : 16;
    shell.style.setProperty("--board-width", `${boardW}px`);
    shell.style.setProperty("--frame-pad", `${framePad}px`);
    shell.style.setProperty(
      "--arena-h",
      `calc(var(--board-height) + var(--frame-pad) * 2 + 12px)`,
    );

    // Never ask the parent to grow past the current iframe — that is how the
    // bottom got clipped while the host thought it was "fitting".
    const needed = Math.ceil(chrome + boardH + framePad * 2 + 8);
    tellResize(Math.min(viewH, Math.max(needed, 360)));

    window.dispatchEvent(new Event("resize"));
  }

  function schedule() {
    requestAnimationFrame(() => requestAnimationFrame(fit));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }

  window.addEventListener("resize", schedule);
  window.addEventListener("load", schedule);
  setTimeout(schedule, 300);
  setTimeout(schedule, 1200);
})();
