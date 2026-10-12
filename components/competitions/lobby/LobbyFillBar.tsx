/**
 * Tiny fill meter under the players / traders KPI — same idea as the mocks.
 * Pure markup so both lobbies (server) can render it without a client boundary.
 */
export function LobbyFillBar({
  current,
  max,
}: {
  current: number;
  max: number;
}) {
  if (!(max > 0)) return null;
  const pct = Math.max(0, Math.min(100, Math.round((current / max) * 100)));
  return (
    <div className="mt-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-[#161E36]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-sky-300/80">
        {pct}% filled
      </p>
    </div>
  );
}
