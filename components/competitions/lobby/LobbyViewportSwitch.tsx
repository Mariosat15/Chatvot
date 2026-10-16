"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Same cut as auth and the game lobby CSS split — phone / small tablet vs desktop. */
export const LOBBY_DESKTOP_MQ = "(min-width: 769px)";

/**
 * Mounts exactly one of desktop / mobile for competition lobbies.
 *
 * Reason (16 Oct 2026): CSS-only `min-[769px]:hidden` / `hidden min-[769px]:block` can leave
 * a phone on the desktop three-column shell when Safari's layout width is stuck wide (zoom,
 * viewport lock race). matchMedia uses the real device width, so the dedicated phone tree
 * always wins on a handset. Same pattern as `AuthViewportSwitch`.
 */
export default function LobbyViewportSwitch({
  desktop,
  mobile,
}: {
  desktop: ReactNode;
  mobile: ReactNode;
}) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(LOBBY_DESKTOP_MQ);
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Reason: SSR has no viewport — prefer the phone tree so a first paint on a handset is
  // never the three-column shell. Desktop swaps in after matchMedia on the client.
  if (isDesktop === null) return <>{mobile}</>;
  return <>{isDesktop ? desktop : mobile}</>;
}
