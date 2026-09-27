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

  const frame = document.getElementById("race");
  const statusBox = document.getElementById("status");
  const messageEl = document.getElementById("message");
  const errorEl = document.getElementById("error");

  function tellPlatform(type) {
    if (window.parent === window) return;
    const target = type === "ready" || parentOrigin === "*" ? "*" : parentOrigin;
    try {
      window.parent.postMessage({ type }, target);
    } catch {
      /* A frame that cannot post is still a playable race. */
    }
  }

  function showStatus(message, error) {
    statusBox.hidden = false;
    messageEl.textContent = message || "";
    errorEl.textContent = error || "";
  }

  function hideStatus() {
    statusBox.hidden = true;
  }

  function markFinished() {
    if (finishedSent) return;
    finishedSent = true;
    tellPlatform("finished");
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

    if (!token) {
      showStatus("", "Missing launch token.");
      return;
    }

    try {
      const session = await startSession();
      if (session.parentOrigin && /^https?:\/\/[^/]+$/.test(session.parentOrigin)) {
        parentOrigin = session.parentOrigin;
      }
      if (session.finished) {
        showStatus("This race has finished.");
        markFinished();
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
      frame.hidden = false;

      const api = await waitForClientApi();
      listenForResult();
      showStatus("Joining the grid\u2026");
      await connect(api, session);
      hideStatus();
    } catch (error) {
      showStatus("", (error && error.message) || "Could not join the race.");
    }
  }

  window.__voltVelocityLoaded = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
