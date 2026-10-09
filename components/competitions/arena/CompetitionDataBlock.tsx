import Image from "next/image";
import type { CompetitionMetric } from "@/lib/competitions/types";

export function CompetitionDataBlock({
  metric,
  compact = false,
}: {
  metric: CompetitionMetric;
  compact?: boolean;
}) {
  const iconPx = metric.emphasize ? 38 : compact ? 28 : 30;

  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border border-white/10 bg-black/40 ${
        compact ? "px-2.5 py-2" : "px-3 py-2.5"
      } ${
        metric.emphasize
          ? "border-amber-400/40 bg-gradient-to-br from-amber-500/18 to-orange-600/10"
          : ""
      }`}
    >
      <Image
        src={metric.icon}
        alt=""
        width={iconPx}
        height={iconPx}
        className="mt-0.5 shrink-0 object-contain"
        style={{ width: iconPx, height: iconPx }}
      />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/55">
          {metric.label}
        </p>
        <p
          className={`truncate font-extrabold tabular-nums text-white ${
            compact ? "text-[15px]" : "text-[16px] sm:text-[17px]"
          } ${metric.emphasize ? "text-amber-200" : ""}`}
        >
          {metric.value}
        </p>
        {metric.subvalue ? (
          <p className="mt-0.5 truncate text-[11px] font-medium text-white/45">
            {metric.subvalue}
          </p>
        ) : null}
      </div>
    </div>
  );
}
