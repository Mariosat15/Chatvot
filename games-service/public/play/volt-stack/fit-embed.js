/**
 * Fit Volt Stack inside a TALL arena iframe — grow the board, do not squeeze it.
 *
 * WHY THIS EXISTS. The stock shell sizes the board from width first. When the
 * arena stage was short, the cabinet + touch row overflowed and scrolled. The
 * right fix is a taller stage (How-it-works pushed below the fold on the host);
 * THIS script then fills that height with as large a board as will fit without
 * an inner scrollbar. It must never shrink chrome so hard the game looks
 * crushed — that was the 27 Sep mistake the owner circled.
 *
 * Standalone offline play (no parent) is untouched.
 */
(() => {
  "use strict";

  const embedded = window.parent !== window;
  if (!embedded) return;

  document.documentElement.classList.add("cv-embedded");

  const SHELL_PAD = 20;
  const MIN_BOARD_H = 360;
  const MAX_BOARD_W = 460;

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
    h += 20;
    return h;
  }

  function fit() {
    const shell = document.querySelector(".game-shell");
    if (!shell) return;

    const viewH = window.innerHeight;
    const viewW = window.innerWidth;
    const chrome = chromeHeight(shell);

    // Prefer a LARGE board that fills the tall stage the host reserved.
    let boardH = Math.max(MIN_BOARD_H, viewH - chrome);
    let boardW = Math.floor(boardH / 2);

    const railBudget = viewW < 520 ? 100 : viewW < 900 ? 180 : 240;
    const maxWFromWidth = Math.max(180, Math.floor(viewW - railBudget));
    if (boardW > maxWFromWidth) {
      boardW = Math.min(MAX_BOARD_W, maxWFromWidth);
      boardH = boardW * 2;
    } else {
      boardW = Math.min(MAX_BOARD_W, boardW);
      boardH = boardW * 2;
    }

    // If the chosen board still overflows the iframe, shrink once — never below MIN.
    const total = chrome + boardH;
    if (total > viewH && viewH > chrome + MIN_BOARD_H) {
      boardH = viewH - chrome;
      boardW = Math.max(160, Math.floor(boardH / 2));
      boardH = boardW * 2;
    }

    const framePad = boardW < 280 ? 12 : boardW < 360 ? 16 : 19;
    shell.style.setProperty("--board-width", `${boardW}px`);
    shell.style.setProperty("--frame-pad", `${framePad}px`);
    shell.style.setProperty(
      "--arena-h",
      `calc(var(--board-height) + var(--frame-pad) * 2 + 16px)`,
    );

    // Ask the parent for room to show the full shell at this board size.
    const fitted = Math.ceil(chromeHeight(shell) + boardH + framePad * 2 + 20);
    tellResize(Math.max(viewH, fitted, 480));

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
