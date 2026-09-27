/**
 * Fit Volt Stack inside the arena iframe WITHOUT overflowing.
 *
 * Owner (27 Sep 2026): board + HOLD/NEXT rails + the mobile touch row
 * must all sit inside the neon stage. Prefer a shorter board over clipping.
 *
 * Owner (27 Sep 2026, board enlarge): grow the Tetris playfield itself —
 * widen the center column / raise cell size from available width+height.
 * Do NOT transform:scale() the whole UI. Side rails stay visible but secondary.
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
  // Hard ceiling — beyond this cells stop looking like a Tetris grid in the arena.
  const MAX_BOARD_W = 420;
  // Reason: owner asked for the board as the dominant ~40–45% of the playable
  // center section. Size the playfield from that fraction first, then clamp to
  // height / rail leftovers so HOLD and NEXT stay readable.
  const TARGET_BOARD_FRAC = 0.44;
  const LAYOUT_GAP = 12; // both gutters between rails and cabinet

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
    // Reason: rails are secondary. Leave enough for HOLD/NEXT labels, but give
    // the leftover width to --board-width so cells grow (not the whole shell).
    if (viewW < 520) return 96;
    if (viewW < 720) return 140;
    if (viewW < 960) return 168;
    return 200;
  }

  function framePadFor(boardW) {
    if (boardW < 220) return 6;
    if (boardW < 300) return 8;
    if (boardW < 360) return 10;
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
    let framePad = 10;
    const budget = Math.max(
      220,
      viewH - chrome - SAFETY - framePad * 2 - FRAME_EXTRA,
    );

    // Height-first candidate (square cells → height = 2 × width).
    let boardH = budget;
    let boardW = Math.floor(boardH / 2);

    const targetFromFrac = Math.floor(viewW * TARGET_BOARD_FRAC);
    const maxWFromWidth = Math.max(
      MIN_BOARD_W,
      Math.floor(viewW - railBudgetFor(viewW) - LAYOUT_GAP),
    );
    boardW = Math.min(MAX_BOARD_W, targetFromFrac, maxWFromWidth, boardW);
    boardW = Math.max(MIN_BOARD_W, boardW);
    boardH = boardW * 2;
    framePad = framePadFor(boardW);

    // Re-check with the real frame pad — square cells + pad can still overshoot.
    const maxArena = viewH - chrome - SAFETY;
    if (boardH + framePad * 2 + FRAME_EXTRA > maxArena) {
      boardH = Math.max(
        MIN_BOARD_W * 2,
        maxArena - framePad * 2 - FRAME_EXTRA,
      );
      boardW = Math.max(MIN_BOARD_W, Math.floor(boardH / 2));
      boardH = boardW * 2;
      framePad = framePadFor(boardW);
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
