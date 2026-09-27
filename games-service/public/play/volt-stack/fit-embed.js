/**
 * Fit Volt Stack inside the arena iframe WITHOUT overflowing.
 *
 * Owner (27 Sep 2026): board + HOLD/NEXT rails + the mobile touch row
 * (MOVE / SOFT DROP / ROTATE / HOLD / HARD DROP) must all sit inside the
 * neon stage. Prefer a shorter board over clipping the buttons.
 *
 * Standalone offline play (no parent) is untouched.
 */
(() => {
  "use strict";

  const embedded = window.parent !== window;
  if (!embedded) return;

  document.documentElement.classList.add("cv-embedded");
  // Reason: CSS used to hide .touch-controls unless this class was set.
  // Keep it so any leftover selector still treats the arena as touch-capable.
  // Script is in <head>, so body may not exist yet.
  function markForceTouch() {
    if (document.body) document.body.classList.add("force-touch");
  }
  markForceTouch();
  if (!document.body) {
    document.addEventListener("DOMContentLoaded", markForceTouch, { once: true });
  }

  const SHELL_PAD = 16;
  // Air under the touch row so the last button is never flush with the clip edge.
  const SAFETY = 20;
  // Floor for the touch strip when the first measure runs before layout settles.
  const TOUCH_RESERVE = 58;
  const MIN_BOARD_W = 140;
  // Cap below the old 340 so chrome + touch row always fit in typical arena heights.
  const MAX_BOARD_W = 280;

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
    for (const el of [topbar, scoreboard, footer, note]) {
      if (!el || getComputedStyle(el).display === "none") continue;
      h += el.getBoundingClientRect().height;
    }
    // Always reserve the touch row — it is visible in the arena (force-touch).
    if (touch && getComputedStyle(touch).display !== "none") {
      h += Math.max(TOUCH_RESERVE, touch.getBoundingClientRect().height);
    } else {
      h += TOUCH_RESERVE;
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

    // Frame pad is part of --arena-h, so leave room for it inside the budget
    // or the rails+board block pushes the touch row off the bottom.
    const FRAME_EXTRA = 12;
    const framePadGuess = 14;
    const budget = Math.max(
      200,
      viewH - chrome - SAFETY - framePadGuess * 2 - FRAME_EXTRA,
    );
    let boardH = budget;
    let boardW = Math.floor(boardH / 2);

    const railBudget = viewW < 520 ? 110 : viewW < 900 ? 200 : 260;
    const maxWFromWidth = Math.max(MIN_BOARD_W, Math.floor(viewW - railBudget));
    boardW = Math.min(MAX_BOARD_W, maxWFromWidth, boardW);
    boardW = Math.max(MIN_BOARD_W, boardW);
    boardH = boardW * 2;

    let framePad = boardW < 240 ? 10 : boardW < 300 ? 14 : 16;

    // Re-check with the real frame pad — square cells + pad can still overshoot.
    const maxArena = viewH - chrome - SAFETY;
    if (boardH + framePad * 2 + FRAME_EXTRA > maxArena) {
      boardH = Math.max(
        MIN_BOARD_W * 2,
        maxArena - framePad * 2 - FRAME_EXTRA,
      );
      boardW = Math.max(MIN_BOARD_W, Math.floor(boardH / 2));
      boardH = boardW * 2;
      framePad = boardW < 240 ? 10 : boardW < 300 ? 14 : 16;
    }

    shell.style.setProperty("--board-width", `${boardW}px`);
    shell.style.setProperty("--frame-pad", `${framePad}px`);
    shell.style.setProperty(
      "--arena-h",
      `calc(var(--board-height) + var(--frame-pad) * 2 + ${FRAME_EXTRA}px)`,
    );

    // Never ask the parent to grow past the current iframe — that is how the
    // bottom got clipped while the host thought it was "fitting".
    const needed = Math.ceil(chrome + boardH + framePad * 2 + FRAME_EXTRA);
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
