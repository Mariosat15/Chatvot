/**
 * ChartVolt Games host for Volt Stack.
 *
 * Boots from the launch token (same credential Circuit uses), talks to `/play/api/*`,
 * and posts Circuit-compatible `{ type: 'ready' | 'finished' | 'leave' }` messages so
 * ProviderGameFrame works unchanged. Never puts a score in postMessage.
 */
(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const token = (params.get("t") || "").trim();
  let hostState = null;
  let parentOrigin = "*";
  let leaving = false;

  function tellPlatform(type, extra) {
    if (window.parent === window) return;
    try {
      window.parent.postMessage(Object.assign({ type }, extra || {}), parentOrigin);
    } catch {
      /* A frame that cannot post is still a playable game. */
    }
  }

  async function api(method, path, body) {
    const options = { method, headers: { Accept: "application/json" }, credentials: "same-origin" };
    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
    const response = await fetch(path, options);
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const payload = await response.json();
        message = payload?.error?.message || message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    return response.json();
  }

  function sessionFromState(state) {
    const endsAt = state.endsAt ? Date.parse(state.endsAt) : Date.now() + (state.playableSeconds || state.durationSeconds || 120) * 1000;
    const durationMs = Math.max(
      1000,
      typeof state.playableSeconds === "number"
        ? state.playableSeconds * 1000
        : typeof state.durationSeconds === "number"
          ? state.durationSeconds * 1000
          : endsAt - Date.now(),
    );
    return {
      sessionId: state.roundId,
      token,
      pieceSeed: state.pieceSeed,
      endsAt,
      durationMs,
      holdDisabled: Boolean(state.holdDisabled),
      mode: state.mode,
    };
  }

  const adapter = {
    async createSession() {
      hostState = await api("POST", "/play/api/session", { t: token });
      if (hostState.parentOrigin) parentOrigin = hostState.parentOrigin;
      return sessionFromState(hostState);
    },
    async reportEvent(event) {
      if (!event || event.type !== "piece_lock" || !event.lock) return;
      // Never forward a client score — strip anything that looks like one.
      const lock = {
        piece: event.lock.piece,
        rotation: event.lock.rotation,
        x: event.lock.x,
        y: event.lock.y,
        hardDropCells: event.lock.hardDropCells || 0,
        claimedSpin: event.lock.claimedSpin,
      };
      const outcome = await api("POST", "/play/api/lock", { t: token, lock });
      if (!outcome.accepted) {
        throw new Error(outcome.reason || "Lock refused");
      }
      hostState = outcome.state || hostState;
      return outcome;
    },
    async finalize() {
      // Server recomputes the score from stored locks. Client total is ignored.
      hostState = await api("POST", "/play/api/leave", { t: token });
      tellPlatform("finished");
      return { accepted: true, verified: true };
    },
  };

  async function boot() {
    if (!token) {
      document.getElementById("startError").textContent = "Missing launch token.";
      tellPlatform("ready");
      return;
    }

    try {
      hostState = await api("GET", `/play/api/state?t=${encodeURIComponent(token)}`);
    } catch (error) {
      document.getElementById("startError").textContent = error.message || "Could not load round.";
      tellPlatform("ready");
      return;
    }

    if (hostState.parentOrigin) parentOrigin = hostState.parentOrigin;

    const ranked = hostState.mode === "ranked";
    window.ChartvoltCompetition.configure(
      {
        mode: ranked ? "competition" : "practice",
        parentOrigin: parentOrigin === "*" ? location.origin : parentOrigin,
      },
      ranked ? adapter : null,
    );

    if (hostState.holdDisabled && typeof window.ChartvoltTetris?.setHoldEnabled === "function") {
      window.ChartvoltTetris.setHoldEnabled(false);
    }

    if (hostState.finished) {
      tellPlatform("ready");
      tellPlatform("finished");
      return;
    }

    tellPlatform("ready");
  }

  // Leave button → Circuit leave message after ending the run.
  window.addEventListener("chartvolt:host", (event) => {
    const detail = event.detail;
    if (!detail || detail.type !== "leave" || leaving) return;
    leaving = true;
    tellPlatform("leave");
    if (hostState && hostState.mode === "ranked") {
      adapter.finalize().catch(() => {
        tellPlatform("finished");
      });
    } else {
      tellPlatform("finished");
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
