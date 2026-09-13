"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { NEON_STAGE_FRAME } from "@/components/neon/tokens";
import {
  clampFrameHeight,
  frameOriginOf,
  MIN_FRAME_HEIGHT,
  parseProviderFrameMessage,
} from "./provider-frame-messages";

/**
 * Hosts a provider's game in an iframe, and treats everything it says as untrusted.
 *
 * THE THREE CHECKS ON AN INBOUND MESSAGE, all of which must pass:
 *
 *   1. `event.source === iframe.contentWindow` - it came from the frame we opened, not from
 *      another tab, an extension, or a popup. This is the strongest of the three, because no
 *      unrelated window can forge it.
 *   2. `event.origin === expectedOrigin` - the frame is still on the provider's origin. A frame
 *      that has navigated itself elsewhere stops being trusted, which matters because the
 *      launch URL carries a single-use token and a redirect chain can end anywhere.
 *   3. The payload narrows to one of exactly four agreed types.
 *
 * AND THE THING THAT IS NOT CHECKED, BECAUSE IT IS NOT ACCEPTED AT ALL: a score. See
 * `provider-frame-messages.ts` - the message type has no score field, so there is nothing to
 * read even if a provider sends one. `finished` means "go ask the server", never "the player
 * scored X".
 *
 * THE SANDBOX OMISSION IS DELIBERATE AND LOAD-BEARING. `allow-top-navigation` is absent, so a
 * game cannot navigate the player's whole page away from ChartVolt - the failure it prevents is
 * a provider bug or a compromised game redirecting a player mid-contest, which would look to
 * them like our site crashing. `allow-popups` is absent too, matching the spec's "no external
 * links out". `allow-same-origin` IS granted, because the game needs its own storage and
 * cookies; it does not weaken the sandbox here, since the frame's origin is the provider's and
 * not ours.
 */

/**
 * How long to wait for `ready` before telling the player what is happening.
 *
 * WHY THE WAIT HAS TO BE BOUNDED. `ready` is the only thing that clears the loading overlay, and
 * it can legitimately never arrive: the play surface can be refused by the provider's own
 * `frame-ancestors` policy, served a 404 by a proxy that is not routing it, or be unreachable
 * because the service is down. In every one of those cases the browser renders something inside
 * the frame and fires `load`, so there is no error event to catch and nothing in our logs - the
 * player simply watched "Loading ..." for ever, with no message, no retry, and no way out,
 * because the button that leaves the round is inside the frame that failed.
 *
 * WHY 12 SECONDS. It has to clear a cold start on a slow connection, or a healthy game gets
 * accused of being broken; and it has to be short enough that a player does not conclude the site
 * is broken before we say anything. This is a few kilobytes of static assets behind whatever
 * latency the provider has, so twelve seconds is generous for the working case.
 */
const READY_TIMEOUT_MS = 12000;

interface ProviderGameFrameProps {
  launchUrl: string;
  gameName: string;
  /** Called when the frame reports a terminal state. The caller polls the server. */
  onFinished: () => void;
  /** Called when the player asks to leave the game. */
  onExit: () => void;
  /** Called when the frame reports an origin we did not expect - a real integration fault. */
  onUntrustedOrigin?: (origin: string) => void;
}

export function ProviderGameFrame({
  launchUrl,
  gameName,
  onFinished,
  onExit,
  onUntrustedOrigin,
}: ProviderGameFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(MIN_FRAME_HEIGHT);
  const [ready, setReady] = useState(false);
  const [stalled, setStalled] = useState(false);
  // Whether the frame's document fired `load`. It does not mean the game started - a 404 page and
  // a policy refusal both load - but it is what separates "we could not reach the game" from "the
  // game answered and did not start", which are two different things to tell a player.
  const [documentLoaded, setDocumentLoaded] = useState(false);
  // Reason: remounting the iframe is what a retry IS. `servePlayPage` reads no token and consumes
  // nothing, and the session behind it resumes rather than restarting, so reloading costs the
  // player no attempt - which is what makes offering the button honest.
  const [attempt, setAttempt] = useState(0);

  const expectedOrigin = frameOriginOf(launchUrl);

  const retry = useCallback(() => {
    setReady(false);
    setStalled(false);
    setDocumentLoaded(false);
    setHeight(MIN_FRAME_HEIGHT);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setStalled(true), READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [ready, attempt]);

  useEffect(() => {
    if (!stalled) return;
    // Reason it is logged as well as shown: the player-facing copy deliberately does not name an
    // origin or a timeout, and this is the one line that lets support tell a routing fault apart
    // from a game that crashed on boot.
    console.error(
      `❌ The game frame at ${expectedOrigin} did not report ready within ${READY_TIMEOUT_MS}ms; ` +
        `its document ${documentLoaded ? "loaded but the game did not start" : "never loaded"}.`,
    );
  }, [stalled, documentLoaded, expectedOrigin]);

  useEffect(() => {
    if (!expectedOrigin) return;

    const handle = (event: MessageEvent) => {
      // CHECK 1. Silent, because a page receives constant postMessage traffic from extensions
      // and dev tools; warning here would bury the message that matters.
      if (event.source !== frameRef.current?.contentWindow) return;

      // CHECK 2. NOT silent - a message from our own frame on an unexpected origin means the
      // game navigated away from where we launched it, which is an integration fault worth
      // surfacing rather than swallowing.
      if (event.origin !== expectedOrigin) {
        onUntrustedOrigin?.(event.origin);
        return;
      }

      // CHECK 3.
      const message = parseProviderFrameMessage(event.data);
      if (!message) {
        console.warn(
          `⚠️ Ignored an unrecognised message from the game frame at ${event.origin}.`,
        );
        return;
      }

      // A switch rather than an object keyed by `message.type`. The type has already been
      // narrowed to one of four literals, so an object lookup would be safe here - but it
      // would still be the shape that produced the prototype-chain hole in the admin round
      // inspector, and a reader cannot tell the safe instance from the unsafe one at a glance.
      switch (message.type) {
        case "ready":
          setReady(true);
          break;
        // Reason it carries no score into our state: see the header. This is a cue to ask the
        // server, and the server's answer is the only one that counts.
        case "finished":
          onFinished();
          break;
        case "exit":
          onExit();
          break;
        case "resize":
          if (typeof message.height === "number") {
            setHeight(clampFrameHeight(message.height));
          }
          break;
      }
    };

    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, [expectedOrigin, onFinished, onExit, onUntrustedOrigin]);

  // Reason this refuses rather than rendering anyway: a launch URL we cannot parse into an
  // http(s) origin is one we cannot verify messages against, so the frame would be
  // unsupervised. A game that cannot be supervised must not be shown at all.
  if (!expectedOrigin) {
    console.error(
      "❌ Refusing to host a game frame: the provider's launch URL is not an absolute http(s) URL.",
    );
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <p className="text-sm text-red-300">
          This game could not be opened. Please contact support - your attempt has
          not been used up.
        </p>
      </div>
    );
  }

  return (
    /*
      THE LIT FRAME IS THE ONE ON THE BOARD. The owner's arena reference gives the playing
      area a glowing cyan surround and everything else a quiet one, so the board is the thing
      the eye lands on. `NEON_STAGE_FRAME` carries a small pad, which is what makes the glow
      read as a bezel around the game rather than as an outline drawn on it.
    */
    <div className={`relative overflow-hidden ${NEON_STAGE_FRAME}`}>
      {/*
        Reason the overlay stops at `stalled` rather than waiting for `ready`: it is opaque and
        covers the whole frame, so a game that has rendered its own explanation underneath is
        hidden by it. Standing down reveals that explanation, which is more useful than anything
        this component could say, and the notice below covers the case where there is nothing
        underneath to reveal.
      */}
      {!ready && !stalled && (
        // Opaque on purpose - see the note above - and in the board's own navy rather than a
        // neutral grey, so the loading state reads as part of the game rather than as a panel
        // from somewhere else that has landed on top of it.
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-[#060C1A]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <p className="text-sm text-gray-400">Loading {gameName}…</p>
        </div>
      )}

      {!ready && stalled && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-amber-200">
                {gameName} is taking longer than expected to start
              </p>
              <p className="text-xs text-amber-100/80">
                {documentLoaded
                  ? "The game opened but has not started. If the panel below stays blank, it is unavailable rather than slow."
                  : "The game could not be reached, which is usually a connection problem."}
              </p>
              {/*
                Accurate rather than reassuring. The attempt was spent when the round was created,
                so leaving does not hand it back - the round stays open and the result is settled
                by the contest's unresolved-round policy. Telling the player they can leave freely
                would be the one thing here that is untrue.
              */}
              <p className="text-xs text-amber-100/60">
                Your attempt is already open. Leaving keeps the round open and its result will be
                confirmed for you.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={retry}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-500/30"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Try again
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-100/80 transition-colors hover:bg-amber-500/10"
                >
                  Leave the game
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <iframe
        key={attempt}
        ref={frameRef}
        src={launchUrl}
        onLoad={() => setDocumentLoaded(true)}
        title={gameName}
        // See the header for why `allow-top-navigation` and `allow-popups` are absent.
        sandbox="allow-scripts allow-same-origin allow-forms"
        allow="fullscreen; autoplay"
        // Reason: the launch URL is single-use and short-lived, but our own contest URL is
        // still ours. No need to hand a third party the page the player came from.
        referrerPolicy="no-referrer"
        className="w-full rounded-xl border-0 bg-[#060C1A]"
        style={{ height: `${height}px` }}
      />
    </div>
  );
}
