/**
 * Tiny fill meter under the players / traders KPI — same idea as the mocks.
 * Pure markup so both lobbies (server) can render it without a client boundary.
 */

import type { ReactNode } from "react";
export function LobbyFillBar({
  current,
  max,
  caption,
  tone = "sky",
}: {
  current: number;
  max: number;
  /** Replaces the default "N% filled" line. */
  caption?: ReactNode;
  tone?: "sky" | "amber";
}) {
  if (!(max > 0)) return null;
  const pct = Math.max(0, Math.min(100, Math.round((current / max) * 100)));
  return (
    <div className="mt-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-[#161E36]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${
            tone === "amber"
              ? "from-amber-500 to-yellow-300"
              : "from-sky-500 to-cyan-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {caption ?? (
        <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-sky-300/80">
          {pct}% filled
        </p>
      )}
    </div>
  );
}
