import { NEON_ICON } from "@/lib/services/games/overview-assets";
import { MobileLobbyCard } from "./MobileLobbyCard";

/**
 * Start / End in UTC as two side-by-side date pills. The full timestamp wraps inside its
 * pill rather than being truncated.
 */

export function MobileLobbySchedule({
  startLabel,
  endLabel,
  id = "lobby-schedule",
}: {
  startLabel: string;
  endLabel: string;
  id?: string;
}) {
  return (
    <MobileLobbyCard id={id} iconSrc={NEON_ICON("calendar-blue")} title="Schedule (UTC)">
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <DatePill label="Start" value={startLabel} dot="bg-emerald-400" />
        <DatePill label="End" value={endLabel} dot="bg-rose-400" />
      </div>
    </MobileLobbyCard>
  );
}

function DatePill({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-black/25 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
        {label}
      </div>
      <div className="mt-1 break-words text-[12px] font-semibold tabular-nums text-white">
        {value}
      </div>
    </div>
  );
}
