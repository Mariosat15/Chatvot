import Image from "next/image";
import type { CompetitionMetric } from "@/lib/competitions/types";

export function CompetitionDataBlock({
  metric,
  compact = false,
}: {
  metric: CompetitionMetric;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-black/35 ${
        compact ? "px-2.5 py-2" : "px-3 py-2.5"
      } ${
        metric.emphasize
          ? "border-amber-400/35 bg-gradient-to-br from-amber-500/15 to-orange-600/10"
          : ""
      }`}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <Image
          src={metric.icon}
          alt=""
          width={compact ? 14 : 16}
          height={compact ? 14 : 16}
          className="h-3.5 w-3.5 object-contain sm:h-4 sm:w-4"
        />
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/55">
          {metric.label}
        </span>
      </div>
      <p
        className={`font-black tabular-nums text-white ${
          compact ? "text-sm" : "text-[15px] sm:text-base"
        } ${metric.emphasize ? "text-amber-200" : ""}`}
      >
        {metric.value}
      </p>
      {metric.subvalue ? (
        <p className="mt-0.5 text-[11px] font-medium text-white/45">
          {metric.subvalue}
        </p>
      ) : null}
    </div>
  );
}
