"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * Full screen for the game stage, for every game.
 *
 * It knows nothing about the game inside the frame: it enlarges the element that HOSTS the
 * iframe, so a provider needs no code of its own and the frame's message protocol is untouched.
 *
 * Reason for the fallback: iPhone Safari has no element Fullscreen API (only video can go full
 * screen there), so a button that calls `requestFullscreen` would do nothing on the most common
 * phone. When the API is missing or refuses, the stage is pinned over the whole window instead
 * ("pseudo" mode), which looks the same apart from the browser's own address bar.
 */
/**
 * A phone, as opposed to a tablet or a touch laptop: a touch pointer and a short side of at most
 * 500px, whichever way up it is held.
 */
export const PHONE_STAGE_QUERY =
  "(pointer: coarse) and (max-width: 500px), (pointer: coarse) and (max-height: 500px)";

export function useStageFullscreen(stageRef: RefObject<HTMLElement | null>) {
  const [native, setNative] = useState(false);
  const [pseudo, setPseudo] = useState(false);
  const [phone, setPhone] = useState(false);

  // Reason (owner, 13 Oct 2026: "we need to see the game in mobile full screen"): on a phone the
  // stage starts pinned over the whole window rather than as a box inside the page, the way a
  // native game opens. It is the window-sized view, not the Fullscreen API, because the API needs
  // a tap and refuses on mount; the game may still ask for true full screen from its own first tap.
  // Read after mount so the server render and the first client render agree. The player can leave
  // with the same button, and this never re-enters behind their back.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    if (!window.matchMedia(PHONE_STAGE_QUERY).matches) return;
    setPhone(true);
    setPseudo(true);
  }, []);

  useEffect(() => {
    const sync = () => setNative(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [stageRef]);

  // Pseudo mode has no browser Escape handling and must not leave the page scrolling underneath.
  useEffect(() => {
    if (!pseudo) return;
    // Reason (owner, 13 Oct 2026: "when scroll to end while play game the game crashes"): iOS
    // Safari ignores `overflow: hidden` on the body alone, so a swipe still scrolled and
    // rubber-banded the page, and every scroll step resized the visual viewport the game measures
    // itself against - a storm of canvas reallocations on the device least able to afford them.
    // Both elements are locked and overscroll is switched off for as long as the stage is pinned.
    const html = document.documentElement;
    const previous = document.body.style.overflow;
    const previousHtml = html.style.overflow;
    const previousOverscroll = html.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    // Reason (owner, 14 Oct 2026: the logo bar and the tab strip still sat above the "pinned" game
    // on a phone, and the page could not be scrolled to reach anything): `position: fixed` is only
    // relative to the window while no ancestor has a transform, filter, backdrop-filter, contain or
    // will-change, and a z-index ancestor traps z-[9999] inside its own stacking context. The arena
    // panels use backdrop blur, so the pinned stage was a fixed box inside a panel, under the page
    // chrome, with scrolling locked. Every ancestor is neutralised while pinned and restored after.
    const neutralised: Array<[HTMLElement, string]> = [];
    for (let el = stageRef.current?.parentElement; el && el !== document.body; el = el.parentElement) {
      neutralised.push([el, el.style.cssText]);
      el.style.setProperty("transform", "none", "important");
      el.style.setProperty("filter", "none", "important");
      el.style.setProperty("backdrop-filter", "none", "important");
      el.style.setProperty("-webkit-backdrop-filter", "none", "important");
      el.style.setProperty("contain", "none", "important");
      el.style.setProperty("will-change", "auto", "important");
      el.style.setProperty("z-index", "auto", "important");
      el.style.setProperty("isolation", "auto", "important");
    }
    html.dataset.gamePinned = "true";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPseudo(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      html.style.overflow = previousHtml;
      html.style.overscrollBehavior = previousOverscroll;
      for (const [el, css] of neutralised) el.style.cssText = css;
      delete html.dataset.gamePinned;
      window.removeEventListener("keydown", onKey);
    };
  }, [pseudo, stageRef]);

  const enter = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    if (typeof stage.requestFullscreen === "function" && document.fullscreenEnabled) {
      try {
        await stage.requestFullscreen({ navigationUI: "hide" });
        return;
      } catch {
        // Refused (permissions policy, an embedded page): fall through to the window-sized view.
      }
    }
    setPseudo(true);
  }, [stageRef]);

  const exit = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Already left (the player pressed Escape at the same moment).
      }
    }
    setPseudo(false);
  }, []);

  const active = native || pseudo;
  const toggle = useCallback(() => (active ? exit() : enter()), [active, enter, exit]);

  return { active, pseudo, phone, toggle };
}
