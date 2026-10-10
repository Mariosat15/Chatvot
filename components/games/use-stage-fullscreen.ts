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
export function useStageFullscreen(stageRef: RefObject<HTMLElement | null>) {
  const [native, setNative] = useState(false);
  const [pseudo, setPseudo] = useState(false);

  useEffect(() => {
    const sync = () => setNative(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [stageRef]);

  // Pseudo mode has no browser Escape handling and must not leave the page scrolling underneath.
  useEffect(() => {
    if (!pseudo) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPseudo(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [pseudo]);

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

  return { active, pseudo, toggle };
}
