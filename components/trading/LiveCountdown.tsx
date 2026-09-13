"use client";

import { useState, useEffect } from "react";
import CountdownPanel from "@/components/competitions/CountdownPanel";

/**
 * The trading competition lobby's large countdown.
 *
 * THE APPEARANCE MOVED OUT AND THE BEHAVIOUR DID NOT. What this file still owns is the two
 * things that are genuinely trading's: it reads the clock on the player's own computer, and it
 * renders nothing at all unless the `type` it was given matches the contest's `status`. The
 * four-cell panel now lives in `components/competitions/CountdownPanel.tsx`, shared with the
 * game lobby, because the owner asked for the two screens to show the same clock and a second
 * copy of that panel would drift on the first edit.
 *
 * Reason: the `status` gate below returns `null` for every pair it does not recognise -
 * including `status: "completed"`, which the props admit and nothing handles. That is a silent
 * no-render: a mismatched pair produces an empty space rather than an error, which is how a
 * countdown goes missing without anybody being told. It is left exactly as it was, because
 * changing it while moving the markup would destroy the only evidence that nothing moved - but
 * it is the reason the game lobby's countdown does not reuse this component.
 */
interface LiveCountdownProps {
  targetDate: Date;
  label: string;
  type: "start" | "end";
  status: "upcoming" | "active" | "completed";
}

export default function LiveCountdown({
  targetDate,
  label,
  type,
  status,
}: LiveCountdownProps) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const target = new Date(targetDate);
      setRemainingMs(Math.max(0, target.getTime() - now.getTime()));
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (remainingMs === null) {
    return <div className="animate-pulse bg-gray-700 h-24 rounded-xl" />;
  }

  // For "starts in" countdown
  if (type === "start" && status === "upcoming") {
    return (
      <CountdownPanel remainingMs={remainingMs} label={label} variant="start" />
    );
  }

  // For "ends in" countdown (active competition)
  if (type === "end" && status === "active") {
    return (
      <CountdownPanel remainingMs={remainingMs} label={label} variant="end" />
    );
  }

  return null;
}
