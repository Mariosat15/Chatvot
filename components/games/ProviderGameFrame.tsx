"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
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

  const expectedOrigin = frameOriginOf(launchUrl);

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
    <div className="relative overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
      {!ready && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gray-900">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          <p className="text-sm text-gray-400">Loading {gameName}…</p>
        </div>
      )}

      <iframe
        ref={frameRef}
        src={launchUrl}
        title={gameName}
        // See the header for why `allow-top-navigation` and `allow-popups` are absent.
        sandbox="allow-scripts allow-same-origin allow-forms"
        allow="fullscreen; autoplay"
        // Reason: the launch URL is single-use and short-lived, but our own contest URL is
        // still ours. No need to hand a third party the page the player came from.
        referrerPolicy="no-referrer"
        className="w-full border-0"
        style={{ height: `${height}px` }}
      />
    </div>
  );
}
