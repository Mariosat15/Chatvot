import { CalendarDays } from "lucide-react";
import { NeonPanel } from "@/components/neon/Cards";
import { NEON_ICON } from "@/lib/services/games/overview-assets";

/**
 * Start / End UTC rows — full timestamps, never truncated (Complobyymobile §8).
 */

export function MobileLobbySchedule({
  startLabel,
  endLabel,
}: {
  startLabel: string;
  endLabel: string;
}) {
  return (
    <NeonPanel
      iconSrc={NEON_ICON("calendar-blue")}
      accent="players"
      title="Schedule (UTC)"
      size="lg"
    >
      <div className="space-y-3">
        <ScheduleLine
          label="Start"
          value={startLabel}
          dotClassName="bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
        />
        <ScheduleLine
          label="End"
          value={endLabel}
          dotClassName="bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]"
        />
      </div>
    </NeonPanel>
  );
}

function ScheduleLine({
  label,
  value,
  dotClassName,
}: {
  label: string;
  value: string;
  dotClassName: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-gray-300">
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotClassName}`}
          aria-hidden
        />
        {label}
      </span>
      <span className="inline-flex max-w-[65%] items-center gap-1.5 rounded-lg border border-white/10 bg-black/35 px-2.5 py-1.5 text-right text-xs font-semibold tabular-nums text-white">
        <CalendarDays
          className="h-3.5 w-3.5 shrink-0 text-sky-300"
          aria-hidden
        />
        <span className="min-w-0 break-words">{value}</span>
      </span>
    </div>
  );
}
