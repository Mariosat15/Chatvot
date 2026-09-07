"use client";

import { useState, useEffect } from "react";

interface InlineCountdownProps {
  targetDate: string;
  type: "start" | "end";
  className?: string;
  /**
   * What to show once the target has passed, overriding "Started" / "Ended".
   *
   * Reason it is a prop rather than a third `type`: the two existing words describe a contest's
   * own clock, and this component is now also counting down to the entry deadline, where
   * "Started" would be actively wrong - the contest may not have started, and what closed was
   * the door. An open page cannot re-render the server's `registrationClosed`, so the word at
   * zero is the only thing that tells a waiting player the moment has gone.
   */
  zeroLabel?: string;
}

export default function InlineCountdown({
  targetDate,
  type,
  className = "",
  zeroLabel,
}: InlineCountdownProps) {
  const [countdown, setCountdown] = useState<string>("");

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const target = new Date(targetDate);
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown(zeroLabel ?? (type === "start" ? "Started" : "Ended"));
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setCountdown(`${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${seconds}s`);
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [targetDate, type, zeroLabel]);

  return (
    <span className={`tabular-nums ${className}`}>{countdown || "..."}</span>
  );
}
