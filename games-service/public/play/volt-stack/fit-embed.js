/**
 * Fit Volt Stack inside the arena iframe WITHOUT overflowing.
 *
 * Owner (27 Sep 2026): board + HOLD/NEXT rails + the mobile touch row
 * must all sit inside the neon stage.
 *
 * Owner (27 Sep 2026, board enlarge — corrected): grow the CENTER Tetris
 * well vertically (classic 1:2 playfield). Shrink HOLD/NEXT to fixed narrow
 * columns. Ask the parent iframe to grow so the touch row is pushed down
 * and the board can be taller — do NOT transform:scale() the shell.
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

  const SHELL_PAD = 10;
  const SAFETY = 6;
  const TOUCH_RESERVE = 48;
  const MIN_BOARD_W = 160;
  // Reason: Tetris is 10×20 — height must be 2× width. The earlier 510×590
  // target made a squat well and left HOLD/NEXT taller than the board.
  // Prefer a tall well (~295×590); grow the host iframe to make room.
  const TARGET_BOARD_H = 590;
  const BOARD_ASPECT = 2;
  const TARGET_BOARD_W = Math.round(TARGET_BOARD_H / BOARD_ASPECT); // 295
  const MAX_BOARD_W = 340;
  const MAX_BOARD_H = 680;
  // Both rails + both gutters. Rails are fixed-width in CSS — budget matches.
  const RAIL_TOTAL = 76 * 2 + 12;

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
    if (touch && getComputedStyle(touch).display !== "none") {
      h += Math.max(TOUCH_RESERVE, touch.getBoundingClientRect().height);
    } else {
      h += TOUCH_RESERVE;
    }
    // Slim reserve for the board title strip above the cabinet.
    h += 8;
    return h;
  }

  function framePadFor(boardW) {
    if (boardW < 220) return 6;
    if (boardW < 300) return 8;
    return 10;
  }

  function fit() {
    const shell = document.querySelector(".game-shell");
    if (!shell) return;

    const viewH = window.innerHeight;
    const viewW = window.innerWidth;
    const chrome = chromeHeight(shell);
    const FRAME_EXTRA = 4;

    // Ideal size first — then ask the parent to grow so it can fit.
    let boardH = TARGET_BOARD_H;
    let boardW = TARGET_BOARD_W;
    let framePad = framePadFor(boardW);

    const maxWFromWidth = Math.max(
      MIN_BOARD_W,
      Math.floor(viewW - RAIL_TOTAL),
    );
    if (boardW > maxWFromWidth) {
      boardW = Math.min(MAX_BOARD_W, maxWFromWidth);
      boardW = Math.max(MIN_BOARD_W, boardW);
      boardH = Math.round(boardW * BOARD_ASPECT);
      framePad = framePadFor(boardW);
    }

    const needed =
      chrome + boardH + framePad * 2 + FRAME_EXTRA + SAFETY;
    // Reason: capping to viewH trapped the board at the opening iframe
    // height forever. The host honours resize up to MAX_FRAME_HEIGHT (2000).
    tellResize(Math.max(needed, 420));

    // While the parent is still short, use every vertical pixel we have.
    const budget = Math.max(
      220,
      viewH - chrome - SAFETY - framePad * 2 - FRAME_EXTRA,
    );
    if (boardH > budget) {
      boardH = Math.min(MAX_BOARD_H, budget);
      boardW = Math.max(MIN_BOARD_W, Math.floor(boardH / BOARD_ASPECT));
      if (boardW > maxWFromWidth) {
        boardW = maxWFromWidth;
        boardH = Math.round(boardW * BOARD_ASPECT);
      }
      framePad = framePadFor(boardW);
    }

    boardW = Math.min(MAX_BOARD_W, Math.max(MIN_BOARD_W, boardW));
    boardH = Math.round(boardW * BOARD_ASPECT);

    shell.style.setProperty("--board-width", `${boardW}px`);
    shell.style.setProperty("--board-height", `${boardH}px`);
    shell.style.setProperty("--frame-pad", `${framePad}px`);
    shell.style.setProperty(
      "--arena-h",
      `calc(var(--board-height) + var(--frame-pad) * 2 + ${FRAME_EXTRA}px)`,
    );
    shell.style.setProperty(
      "--cabinet-width",
      `calc(var(--board-width) + var(--frame-pad) * 2 + 4px)`,
    );

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
