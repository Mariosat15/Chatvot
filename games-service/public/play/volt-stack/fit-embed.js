/**
 * Fit Volt Stack inside the ChartVolt arena iframe without an inner scrollbar.
 *
 * WHY THIS EXISTS. The stock shell sizes the board from width first
 * (`--board-width` → height = width * 2). Inside a short arena stage that
 * makes the cabinet taller than the iframe, so MOVE LEFT / HARD DROP sit
 * below the fold and the player has to scroll mid-match.
 *
 * WHEN EMBEDDED we reverse it: measure chrome (topbar + scoreboard + touch
 * row), give the rest to the board height, derive width from the 1:2 aspect,
 * and ask the parent for exactly that shell height via Circuit `resize`.
 *
 * Standalone offline play (no parent) is untouched.
 */
(() => {
  "use strict";

  const embedded = window.parent !== window;
  if (!embedded) return;

  document.documentElement.classList.add("cv-embedded");

  const SHELL_PAD = 16;
  const MIN_BOARD_H = 220;
  const MAX_BOARD_W = 420;

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
    // Gaps between sections the flex layout adds.
    h += 18;
    return h;
  }

  function fit() {
    const shell = document.querySelector(".game-shell");
    if (!shell) return;

    const viewH = window.innerHeight;
    const viewW = window.innerWidth;
    const chrome = chromeHeight(shell);

    // Board height is whatever is left; width follows the 1:2 cabinet aspect.
    let boardH = Math.max(MIN_BOARD_H, viewH - chrome);
    let boardW = Math.floor(boardH / 2);

    // Rails need ~110px each side on desktop; on narrow stages trade board for rails.
    const railBudget = viewW < 520 ? 100 : viewW < 900 ? 160 : 220;
    const maxWFromWidth = Math.max(140, Math.floor((viewW - railBudget) / 1));
    if (boardW > maxWFromWidth) {
      boardW = Math.min(MAX_BOARD_W, maxWFromWidth);
      boardH = boardW * 2;
    } else {
      boardW = Math.min(MAX_BOARD_W, boardW);
      boardH = boardW * 2;
    }

    const framePad = boardW < 240 ? 8 : boardW < 320 ? 12 : 16;
    shell.style.setProperty("--board-width", `${boardW}px`);
    shell.style.setProperty("--frame-pad", `${framePad}px`);
    // Force arena-h from the board we just chose (overrides width-first CSS).
    shell.style.setProperty(
      "--arena-h",
      `calc(var(--board-height) + var(--frame-pad) * 2 + 16px)`,
    );

    // Parent iframe min-height: shell's fitted content, never taller than we are.
    const fitted = Math.ceil(
      chromeHeight(shell) + boardH + framePad * 2 + 16,
    );
    tellResize(Math.min(viewH, Math.max(320, fitted)));

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
  // Fonts / SVG icons can change chrome height after first paint.
  window.addEventListener("load", schedule);
  setTimeout(schedule, 300);
  setTimeout(schedule, 1200);
})();
