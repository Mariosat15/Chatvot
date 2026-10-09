import Image from "next/image";
import type { CompetitionMetric } from "@/lib/competitions/types";

/**
 * One boxed stat on a competition card (owner reference anatomy).
 *
 * Icon on the left drawn bare and large (no tile), label on one line, value
 * beneath it, optional sub-value under that.
 *
 * Reason: the icon used to sit in a 38px tile, which left a footer box ~45px for
 * text, so `break-words` split "Skilled" and "Attempt" mid-word. The bare icon
 * gives that width back, and values now wrap only between words.
 */
export function CompetitionDataBlock({
  metric,
  accent,
}: {
  metric: CompetitionMetric;
  accent: string;
}) {
  const prize = Boolean(metric.emphasize);
  const tint = prize ? "#ffb000" : accent;

  return (
    <div className="@container h-full min-w-0">
      <div
        className="grid h-full min-h-[68px] grid-cols-[26px_minmax(0,1fr)] items-center gap-2 rounded-xl border px-2.5 py-2 @[120px]:grid-cols-[34px_minmax(0,1fr)] @[120px]:gap-2.5"
        style={{
          borderColor: prize ? "rgba(255,176,0,.45)" : "rgba(120,160,255,.18)",
          background: prize
            ? "linear-gradient(135deg, rgba(255,176,0,.18), rgba(255,92,34,.08))"
            : "linear-gradient(180deg, rgba(14,24,52,.92), rgba(6,12,30,.92))",
        }}
      >
        <Image
          src={metric.icon}
          alt=""
          width={34}
          height={34}
          aria-hidden
          className="size-[26px] object-contain @[120px]:size-[34px]"
          style={{ filter: `drop-shadow(0 0 6px ${tint}80)` }}
        />
        <div className="min-w-0">
          <p className="whitespace-nowrap text-[9px] font-bold uppercase leading-tight tracking-[0.06em] text-slate-300 @[120px]:text-[10px]">
            {metric.label}
          </p>
          <p
            className={`mt-0.5 font-extrabold leading-tight tabular-nums [overflow-wrap:normal] [word-break:keep-all] ${
              prize
                ? "text-[15px] text-amber-300 @[120px]:text-[18px]"
                : "text-[14px] text-white @[120px]:text-[15px]"
            }`}
          >
            {metric.value}
          </p>
          {metric.subvalue ? (
            <p className="mt-0.5 text-[10px] font-semibold leading-tight text-slate-300/80">
              {metric.subvalue}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
