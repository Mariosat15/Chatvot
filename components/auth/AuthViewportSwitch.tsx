"use client";

import { useEffect, useState } from "react";

const DESKTOP_MQ = "(min-width: 769px)";

/**
 * Mounts exactly one of desktop / mobile so we do not double-submit forms,
 * double-toast verification banners, or download two auth shells at once.
 */
export default function AuthViewportSwitch({
  desktop,
  mobile,
}: {
  desktop: React.ReactNode;
  mobile: React.ReactNode;
}) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Reason: SSR and the first paint have no viewport — show nothing rather
  // than both trees (which would load two backgrounds and run two hooks).
  if (isDesktop === null) {
    return (
      <div
        className="min-h-dvh bg-[#020714]"
        aria-hidden
        style={{
          paddingTop: "env(safe-area-inset-top)",
        }}
      />
    );
  }

  return <>{isDesktop ? desktop : mobile}</>;
}
