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
  const SAFETY = 4;
  const TOUCH_RESERVE = 86; // 64px buttons + 8px + 14px margins (styles.css embedded rule)
  const MIN_BOARD_W = 160;
  // Reason: Tetris is 10×20 — height must be 2× width. The earlier 510×590
  // target made a squat well and left HOLD/NEXT taller than the board.
  // 590 is the MINIMUM the frame is asked for; the well then GROWS to fill
  // whatever height the arena gives it (owner, 27 Sep: "fill the bottom").
  // Owner, 27 Sep 2026 (second pass): "stretch it more vertically down" -
  // 590 left the frame ending well above the fold, so the request is now 720.
  const TARGET_BOARD_H = 720;
  const BOARD_ASPECT = 2;
  const MAX_BOARD_H = 900;
  const MAX_BOARD_W = MAX_BOARD_H / BOARD_ASPECT;
  // Minimum rail width + both gutters + shell side padding. Rails are
  // minmax(MIN_RAIL, 1fr) in CSS, so they take all leftover width.
  const MIN_RAIL = 96;
  const RAIL_TOTAL = MIN_RAIL * 2 + 8 * 2 + 20;
  const FRAME_EXTRA = 4;

  let lastApplied = "";
  let lastRequested = 0;

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
      // Reason: getBoundingClientRect excludes margins, and the row's top/bottom
      // margins are the breathing room below the buttons — count them too.
      const cs = getComputedStyle(touch);
      const margins = (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
      h += Math.max(TOUCH_RESERVE, touch.getBoundingClientRect().height + margins);
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

    const maxWFromWidth = Math.max(
      MIN_BOARD_W,
      Math.min(MAX_BOARD_W, Math.floor(viewW - RAIL_TOTAL)),
    );

    // Reason: the request is the 590 MINIMUM, never a figure derived from
    // viewH. Asking for "whatever I have now" is a fixed point that can grow
    // the frame on every pass. The arena row already stretches the frame to
    // the window bottom; the board fills that below.
    const minW = Math.min(maxWFromWidth, Math.round(TARGET_BOARD_H / BOARD_ASPECT));
    const minPad = framePadFor(minW);
    const needed = Math.round(
      chrome + minW * BOARD_ASPECT + minPad * 2 + FRAME_EXTRA + SAFETY,
    );
    if (Math.abs(needed - lastRequested) > 2) {
      lastRequested = needed;
      tellResize(Math.max(needed, 420));
    }

    // Fill every vertical pixel the frame actually has, capped by width.
    let framePad = 10;
    let boardH = Math.max(
      MIN_BOARD_W * BOARD_ASPECT,
      Math.min(MAX_BOARD_H, viewH - chrome - SAFETY - framePad * 2 - FRAME_EXTRA),
    );
    let boardW = Math.floor(boardH / BOARD_ASPECT);
    if (boardW > maxWFromWidth) boardW = maxWFromWidth;
    boardW = Math.max(MIN_BOARD_W, boardW);
    framePad = framePadFor(boardW);
    boardH = Math.round(boardW * BOARD_ASPECT);

    // Reason: fit() dispatches "resize", which schedules fit() again. Only
    // re-apply and re-announce when the numbers changed, or it never stops.
    const key = `${boardW}|${boardH}|${framePad}`;
    if (key === lastApplied) return;
    lastApplied = key;

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
