/**
 * Fit Volt Stack inside the arena iframe WITHOUT overflowing.
 *
 * Owner (27 Sep 2026): board + HOLD/NEXT rails + the mobile touch row
 * must all sit inside the neon stage. Prefer a shorter board over clipping.
 *
 * Owner (27 Sep 2026, board enlarge): grow ONLY the center Tetris board to
 * ~510×590. Shrink HOLD/COMBO and NEXT/SPEED rails to make room.
 * Do NOT transform:scale() the whole UI — set --board-width / --board-height
 * and the parent grid column widths.
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

  const SHELL_PAD = 12;
  // Air under the touch row so the last button is never flush with the clip edge.
  const SAFETY = 10;
  // Floor for the touch strip when the first measure runs before layout settles.
  const TOUCH_RESERVE = 54;
  const MIN_BOARD_W = 160;
  // Reason: owner asked for ~510×590 center board (was ~250×500). Cap at that
  // size so the playfield does not outgrow the design box.
  const TARGET_BOARD_W = 510;
  const TARGET_BOARD_H = 590;
  const MAX_BOARD_W = TARGET_BOARD_W;
  const BOARD_ASPECT = TARGET_BOARD_H / TARGET_BOARD_W; // ~1.157, not classic 1:2
  const LAYOUT_GAP = 10; // both gutters between rails and cabinet

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
    // Board title sits above the cabinet; keep a slim reserve after padding cut.
    h += 12;
    return h;
  }

  function railBudgetFor(viewW) {
    // Reason: rails are secondary — shrink HOLD/NEXT so the center board can
    // reach ~510px. Leave just enough for labels and mini canvases.
    if (viewW < 520) return 88;
    if (viewW < 720) return 112;
    if (viewW < 960) return 128;
    return 148;
  }

  function framePadFor(boardW) {
    if (boardW < 220) return 6;
    if (boardW < 300) return 8;
    if (boardW < 400) return 10;
    return 12;
  }

  function fit() {
    const shell = document.querySelector(".game-shell");
    if (!shell) return;

    const viewH = window.innerHeight;
    const viewW = window.innerWidth;
    const chrome = chromeHeight(shell);

    // Frame pad is part of --arena-h, so leave room for it inside the budget
    // or the rails+board block pushes the touch row off the bottom.
    const FRAME_EXTRA = 4;
    let framePad = 12;
    const budget = Math.max(
      220,
      viewH - chrome - SAFETY - framePad * 2 - FRAME_EXTRA,
    );

    // Height-first candidate at the design aspect (~510×590).
    let boardH = Math.min(TARGET_BOARD_H, budget);
    let boardW = Math.floor(boardH / BOARD_ASPECT);

    const maxWFromWidth = Math.max(
      MIN_BOARD_W,
      Math.floor(viewW - railBudgetFor(viewW) - LAYOUT_GAP),
    );
    boardW = Math.min(MAX_BOARD_W, maxWFromWidth, boardW);
    boardW = Math.max(MIN_BOARD_W, boardW);
    boardH = Math.round(boardW * BOARD_ASPECT);
    framePad = framePadFor(boardW);

    // Re-check with the real frame pad — pad + board can still overshoot.
    const maxArena = viewH - chrome - SAFETY;
    if (boardH + framePad * 2 + FRAME_EXTRA > maxArena) {
      boardH = Math.max(
        Math.round(MIN_BOARD_W * BOARD_ASPECT),
        maxArena - framePad * 2 - FRAME_EXTRA,
      );
      boardW = Math.max(MIN_BOARD_W, Math.floor(boardH / BOARD_ASPECT));
      boardH = Math.round(boardW * BOARD_ASPECT);
      framePad = framePadFor(boardW);
    }

    // Prefer the design target when the viewport has room.
    if (
      viewW - railBudgetFor(viewW) - LAYOUT_GAP >= TARGET_BOARD_W &&
      budget >= TARGET_BOARD_H
    ) {
      boardW = TARGET_BOARD_W;
      boardH = TARGET_BOARD_H;
      framePad = framePadFor(boardW);
    }

    shell.style.setProperty("--board-width", `${boardW}px`);
    shell.style.setProperty("--board-height", `${boardH}px`);
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
