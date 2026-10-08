/**
 * ChartVolt Games host for Volt Velocity.
 *
 * The race client is a 100 MB self-contained document built outside this repository. It is not
 * edited: this page loads it in a same-origin frame and drives its public
 * `window.ChartvoltVelocity3D` API from outside.
 *
 * THE TICKET NEVER APPEARS IN A URL
 * ---------------------------------
 * The launch token arrives in this page's query string, because that is the only channel the
 * provider specification gives an embedded frame. The race ticket is different: it is a bearer
 * credential for a seat in a live room, so it is fetched with a POST and handed to
 * `connectCompetition` as a JavaScript value. It never reaches a `src`, `Referer`, access log or
 * browser history.
 *
 * NO SCORE LEAVES THIS PAGE
 * -------------------------
 * The race server signs the result and games-service polls it server-side. This page only tells
 * the platform that the race is over (`finished`) so the arena can move on; it never forwards a
 * time, a position or a lap.
 */
(() => {
  "use strict";

  const TOKEN_KEY = "chartvolt-velocity-token";
  const CONNECT_TIMEOUT_MS = 60000;
  const CONNECT_POLL_MS = 250;
  const END_POLL_MS = 500;
  // Reason: give the practice host time to PATCH/pull the score before exit lands.
  const HANDOFF_MS = 1200;

  const params = new URLSearchParams(location.search);
  let token = (params.get("t") || "").trim();
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else token = (sessionStorage.getItem(TOKEN_KEY) || "").trim();
  } catch {
    /* Storage refused: a reload simply needs a fresh launch URL. */
  }
  if (params.has("t")) {
    // Reason: keep the launch token out of this frame's history once it has been read.
    try {
      history.replaceState(null, "", location.pathname);
    } catch {
      /* ignore */
    }
  }

  let parentOrigin = "*";
  let finishedSent = false;
  let exitSent = false;
  let handoffTimer = null;
  // Reason (8 Oct 2026): practice result copy must say the score is saved, not "being confirmed".
  let practiceMode = false;

  const frame = document.getElementById("race");
  const statusBox = document.getElementById("status");
  const messageEl = document.getElementById("message");
  const errorEl = document.getElementById("error");
  const loadbarEl = document.getElementById("loadbar");
  const closeEl = document.getElementById("close");

  function tellPlatform(type, extra) {
    if (window.parent === window) return;
    const target = type === "ready" || type === "resize" || parentOrigin === "*" ? "*" : parentOrigin;
    try {
      window.parent.postMessage(Object.assign({ type }, extra || {}), target);
    } catch {
      /* A frame that cannot post is still a playable race. */
    }
  }

  /**
   * Ask the arena for a tall enough frame. Velocity never posts resize otherwise, so the
   * host's default min-height (320) left the race squeezed in a short strip (owner, 6 Oct 2026).
   */
  function askForRoom() {
    // Reason: practice/arena embeds start short; ask for a tall stage so the hangar
    // is not vertically squeezed (owner, 6 Oct 2026).
    const height = Math.max(820, Math.min(1200, Math.round(window.innerHeight || 820)));
    tellPlatform("resize", { height });
  }

  function showStatus(message, error, options) {
    const waiting = !(options && options.done);
    statusBox.hidden = false;
    messageEl.textContent = message || "";
    errorEl.textContent = error || "";
    // Reason: the bar is only for waiting; race-complete / error must not keep animating.
    if (loadbarEl) loadbarEl.hidden = !waiting || Boolean(error);
    if (closeEl) closeEl.hidden = waiting;
  }

  function hideStatus() {
    statusBox.hidden = true;
    if (loadbarEl) loadbarEl.hidden = true;
    if (closeEl) closeEl.hidden = true;
  }

  function markFinished() {
    if (finishedSent) return;
    finishedSent = true;
    tellPlatform("finished");
  }

  /**
   * Hand the player back to the practice / arena host.
   *
   * Contests already leave the iframe on `finished` (RoundResultPanel), so a later `exit` is
   * a no-op there. Practice keeps the iframe until `exit`, and without this hand-off Velocity
   * sat on "being confirmed" forever (owner, 6 Oct 2026).
   */
  function handBackToPlatform() {
    if (exitSent) return;
    exitSent = true;
    if (handoffTimer) {
      clearTimeout(handoffTimer);
      handoffTimer = null;
    }
    tellPlatform("exit");
  }

  function scheduleHandBack() {
    if (exitSent || handoffTimer) return;
    if (closeEl) closeEl.hidden = false;
    handoffTimer = setTimeout(handBackToPlatform, HANDOFF_MS);
  }

  if (closeEl) {
    closeEl.addEventListener("click", () => {
      handBackToPlatform();
    });
  }

  async function startSession() {
    const response = await fetch("/play/api/velocity/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ t: token }),
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      /* fall through */
    }
    if (!response.ok) {
      throw new Error(payload?.error?.message || `HTTP ${response.status}`);
    }
    return payload;
  }

  function raceUrlFor(session) {
    if (typeof session.raceUrl === "string" && session.raceUrl) return session.raceUrl;
    // Production: nginx proxies the race server's WebSocket at /race on this same origin.
    return `${location.origin}/race`;
  }

  function waitForClientApi() {
    const deadline = Date.now() + CONNECT_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
      const poll = () => {
        let api = null;
        try {
          api = frame.contentWindow && frame.contentWindow.ChartvoltVelocity3D;
        } catch {
          /* Cross-origin would throw; the client is same-origin by construction. */
        }
        if (api && typeof api.connectCompetition === "function") {
          resolve(api);
          return;
        }
        if (Date.now() > deadline) {
          reject(new Error("The race client did not load."));
          return;
        }
        setTimeout(poll, CONNECT_POLL_MS);
      };
      poll();
    });
  }

  async function connect(api, session) {
    const deadline = Date.now() + CONNECT_TIMEOUT_MS;
    // The client refuses to join while it is still booting out of the hangar; retry until it
    // settles or the deadline passes.
    for (;;) {
      try {
        await api.connectCompetition({
          url: raceUrlFor(session),
          ticket: session.ticket,
          raceId: session.raceId,
        });
        return;
      } catch (error) {
        if (Date.now() > deadline) throw error;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  /**
   * Hand the player back to the platform the moment their race is over for them.
   *
   * The vendor result screen offers LEAVE COMPETITION, which drops into SOLO FLIGHT and a
   * "next random race" - a free-play loop inside a paid contest's frame. So this page watches
   * the client and, once this pilot has finished (or has left the room), removes the client and
   * tells the platform, which shows its own result panel and a way back to the lobby.
   *
   * `competition-result` alone is not enough: it fires only when the WHOLE race is final, so a
   * player who crossed the line while others were still racing would be left on the vendor
   * screen with that button in front of them.
   */
  function watchForRaceEnd(api) {
    let joined = false;
    const timer = setInterval(() => {
      let state = null;
      try {
        state = api.getState();
      } catch {
        return;
      }
      if (!state) return;
      if (state.mode === "multiplayer") joined = true;
      const done = joined && state.mode === "multiplayer" && state.state === "finished";
      const left = joined && state.mode === "solo";
      if (!done && !left) return;
      clearInterval(timer);
      frame.hidden = true;
      try {
        frame.src = "about:blank";
      } catch {
        /* ignore */
      }
      if (done) {
        showStatus(
          practiceMode
            ? "Practice race complete. Your result is saved on the practice page."
            : "Race complete. Your result is being confirmed.",
          "",
          { done: true },
        );
        markFinished();
        scheduleHandBack();
      } else if (!finishedSent) {
        showStatus(practiceMode ? "Practice ended." : "You left the race.", "", {
          done: true,
        });
        handBackToPlatform();
      }
    }, END_POLL_MS);
  }

  /**
   * Remove the vendor's two ways back into free play.
   *
   * `#quit` ("RETURN TO HANGAR" on the pause menu) drops the pilot into the ship picker, and
   * `#again` on the result screen starts another race - both a loop inside a paid contest's
   * frame. The client is not edited, so the buttons are hidden with a stylesheet from here.
   * LEAVE RACE stays: `watchForRaceEnd` turns it into a proper exit to the lobby.
   */
  const VENDOR_EXITS_CSS = "#quit, #again { display: none !important; }";

  function hideVendorExits() {
    try {
      const doc = frame.contentDocument;
      if (!doc || doc.getElementById("chartvolt-host-rules")) return;
      const style = doc.createElement("style");
      style.id = "chartvolt-host-rules";
      style.textContent = VENDOR_EXITS_CSS;
      (doc.head || doc.documentElement).appendChild(style);
    } catch {
      /* Same-origin by construction; a refusal leaves the race playable. */
    }
  }

  function listenForResult() {
    let clientWindow = null;
    try {
      clientWindow = frame.contentWindow;
    } catch {
      return;
    }
    if (!clientWindow) return;
    clientWindow.addEventListener("chartvolt:velocity", (event) => {
      const detail = event && event.detail;
      if (!detail) return;
      if (detail.type === "competition-result") markFinished();
    });
  }

  async function boot() {
    // Before any await: the arena clears its loading overlay only on `ready`.
    tellPlatform("ready");
    askForRoom();

    if (!token) {
      showStatus("", "Missing launch token.");
      return;
    }

    try {
      const session = await startSession();
      practiceMode = session.mode === "practice";
      if (session.parentOrigin && /^https?:\/\/[^/]+$/.test(session.parentOrigin)) {
        parentOrigin = session.parentOrigin;
      }
      if (session.finished) {
        showStatus(
          practiceMode
            ? "This practice race has finished. Your result is on the practice page."
            : "This race has finished.",
          "",
          { done: true },
        );
        markFinished();
        scheduleHandBack();
        return;
      }

      showStatus("Loading the race client\u2026");
      await new Promise((resolve, reject) => {
        frame.addEventListener("load", resolve, { once: true });
        frame.addEventListener("error", () => reject(new Error("The race client did not load.")), {
          once: true,
        });
        frame.src = session.clientUrl;
      });
      hideVendorExits();
      frame.hidden = false;

      const api = await waitForClientApi();
      listenForResult();
      showStatus("Joining the grid\u2026");
      await connect(api, session);
      hideStatus();
      askForRoom();
      watchForRaceEnd(api);
    } catch (error) {
      showStatus("", (error && error.message) || "Could not join the race.");
    }
  }

  window.addEventListener("resize", askForRoom);

  window.__voltVelocityLoaded = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
