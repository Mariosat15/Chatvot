/**
 * ChartVolt Games host for Volt Stack.
 *
 * Boots from the launch token (same credential Circuit uses), talks to `/play/api/*`,
 * and posts Circuit-compatible `{ type: 'ready' | 'finished' | 'exit' }` messages so
 * ProviderGameFrame works unchanged. Never puts a score in postMessage.
 *
 * WHY READY FIRES FIRST, BEFORE THE NETWORK
 * ----------------------------------------
 * ProviderGameFrame clears its loading overlay only on `ready`, and stalls at 12s. The
 * Neon Stack shell used to post a different channel (`chartvolt:neon-stack`) aimed at the
 * iframe's own origin, which the parent never accepts when the game is embedded. Waiting
 * for GET /play/api/state before the Circuit-shaped `ready` then made a hung or throwing
 * configure leave the player staring at "taking longer than expected" forever. Matching
 * Circuit: announce ready as soon as this script can talk to the parent, then finish boot.
 */
(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const token = (params.get("t") || "").trim();
  let hostState = null;
  /** Platform origin from the round, once known. Until then "*" so ready still delivers. */
  let parentOrigin = "*";
  let leaving = false;

  function tellPlatform(type, extra) {
    if (window.parent === window) return;
    // Reason ready always uses "*": parentOrigin may still be unset, and a missed early ready
    // is exactly the arena stall. event.origin on the parent is still this frame's origin.
    const target =
      type === "ready" ? "*" : parentOrigin === "*" ? "*" : parentOrigin;
    try {
      window.parent.postMessage(Object.assign({ type }, extra || {}), target);
    } catch {
      /* A frame that cannot post is still a playable game. */
    }
  }

  function announceReady() {
    tellPlatform("ready");
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
    const endsAtMs = state.endsAt ? Date.parse(state.endsAt) : NaN;
    const endsAt = Number.isFinite(endsAtMs)
      ? endsAtMs
      : Date.now() + (state.playableSeconds || state.durationSeconds || 120) * 1000;
    // On resume, prefer remaining wall-clock time so the timer does not restart at full length.
    const remainingMs = Number.isFinite(endsAtMs) ? Math.max(1000, endsAtMs - Date.now()) : null;
    const durationMs = Math.max(
      1000,
      remainingMs != null
        ? remainingMs
        : typeof state.playableSeconds === "number"
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
      resuming: Boolean(state.resuming),
      locksAccepted: state.locksAccepted || 0,
      // Verified placements — the client replays these to restore the board.
      stackLocks: Array.isArray(state.stackLocks) ? state.stackLocks : [],
    };
  }

  function applyHostHints(state) {
    if (!state) return;
    if (state.parentOrigin && /^https?:\/\/[^/]+$/.test(state.parentOrigin)) {
      parentOrigin = state.parentOrigin;
    }
    if (state.pieceSeed && typeof window.ChartvoltTetris?.configureCompetition === "function") {
      try {
        window.ChartvoltTetris.configureCompetition({
          pieceSeed: state.pieceSeed,
          durationMs:
            typeof state.playableSeconds === "number"
              ? state.playableSeconds * 1000
              : undefined,
          sessionId: state.roundId,
          serverToken: token,
        });
      } catch {
        /* Configure only while idle; ignore if a run already started. */
      }
    }
    if (state.holdDisabled && typeof window.ChartvoltTetris?.setHoldEnabled === "function") {
      window.ChartvoltTetris.setHoldEnabled(false);
    }
  }

  const adapter = {
    async createSession() {
      hostState = await api("POST", "/play/api/session", { t: token });
      applyHostHints(hostState);
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
      // Cue only — no score on the wire (ProviderGameFrame progress handler).
      tellPlatform("progress");
      return outcome;
    },
    async finalize() {
      // Top-out / time-up is a finished Tetris run. Server recomputes from locks as completed
      // — never abandoned — so earned points count and the higher score wins.
      hostState = await api("POST", "/play/api/complete", { t: token });
      tellPlatform("finished");
      return { accepted: true, verified: true };
    },
  };

  async function boot() {
    // Announce before any await so a slow or failing network cannot stall the arena.
    announceReady();

    if (!token) {
      const err = document.getElementById("startError");
      if (err) err.textContent = "Missing launch token.";
      return;
    }

    try {
      hostState = await api("GET", `/play/api/state?t=${encodeURIComponent(token)}`);
      applyHostHints(hostState);

      const ranked = hostState.mode === "ranked";
      if (typeof window.ChartvoltCompetition?.configure === "function") {
        window.ChartvoltCompetition.configure(
          {
            mode: ranked ? "competition" : "practice",
            // Exact origin for the bridge's own checks; parent delivery is owned by tellPlatform.
            parentOrigin: parentOrigin === "*" ? location.origin : parentOrigin,
          },
          ranked ? adapter : null,
        );
      }

      if (hostState.finished) {
        tellPlatform("finished");
      } else if (hostState.status === "in_progress" && ranked) {
        // Same attempt: Circuit resumes straight into the board; Volt Stack must too.
        // Defer one frame so ChartvoltTetris listeners are wired.
        requestAnimationFrame(() => {
          try {
            window.ChartvoltTetris?.start?.();
          } catch (error) {
            const err = document.getElementById("startError");
            if (err) err.textContent = error.message || "Could not resume round.";
          }
        });
      }
    } catch (error) {
      const err = document.getElementById("startError");
      if (err) err.textContent = error.message || "Could not load round.";
    }
  }

  // Leave from the shell → Circuit `exit` (ProviderGameFrame has no `leave` type).
  // Mid-run Leave is abandoned (partial score); game_over finalize uses /complete instead.
  window.addEventListener("chartvolt:host", (event) => {
    const detail = event.detail;
    if (!detail || detail.type !== "leave" || leaving) return;
    leaving = true;
    tellPlatform("exit");
    if (hostState && hostState.mode === "ranked") {
      api("POST", "/play/api/leave", { t: token })
        .then((state) => {
          hostState = state;
          tellPlatform("finished");
        })
        .catch(() => {
          tellPlatform("finished");
        });
    } else {
      tellPlatform("finished");
    }
  });

  // Mark the watchdog's subject as present so a future stall panel can tell "host ran".
  window.__voltStackLoaded = true;
  announceReady();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
