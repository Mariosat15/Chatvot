import Image from "next/image";
import type { ReactNode } from "react";
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
export function CompetitionDataShell({
  icon,
  label,
  value,
  subvalue,
  accent,
  emphasize = false,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  subvalue?: string;
  accent: string;
  emphasize?: boolean;
}) {
  const prize = emphasize;
  const tint = prize ? "#ffb000" : accent;

  return (
    <div className="@container h-full min-w-0">
      <div
        className="grid h-full min-h-[56px] grid-cols-[26px_minmax(0,1fr)] items-center gap-2 rounded-xl border px-2 py-1.5 @[120px]:grid-cols-[32px_minmax(0,1fr)] @[120px]:px-2.5"
        style={{
          borderColor: prize ? "rgba(255,176,0,.55)" : `${accent}40`,
          background: prize
            ? "linear-gradient(135deg, rgba(255,176,0,.18), rgba(255,92,34,.08))"
            : "linear-gradient(180deg, rgba(14,24,52,.92), rgba(6,12,30,.92))",
          boxShadow: prize
            ? "0 0 14px rgba(255,176,0,.25), inset 0 0 14px rgba(255,176,0,.10)"
            : `inset 0 0 14px ${accent}14`,
        }}
      >
        <Image
          src={icon}
          alt=""
          width={32}
          height={32}
          aria-hidden
          className="size-[26px] object-contain @[120px]:size-8"
          style={{ filter: `drop-shadow(0 0 6px ${tint}80)` }}
        />
        <div className="min-w-0">
          <p className="truncate text-[9px] font-bold uppercase leading-tight tracking-[0.06em] text-slate-300 @[120px]:text-[10px]">
            {label}
          </p>
          <p
            className={`mt-0.5 font-extrabold leading-tight tabular-nums [overflow-wrap:normal] [word-break:keep-all] ${
              prize
                ? "text-[15px] text-amber-300 @[120px]:text-[18px]"
                : "text-[14px] text-white @[120px]:text-[15px]"
            }`}
          >
            {value}
          </p>
          {subvalue ? (
            <p className="mt-0.5 text-[10px] font-semibold leading-tight text-slate-300/80">
              {subvalue}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CompetitionDataBlock({
  metric,
  accent,
}: {
  metric: CompetitionMetric;
  accent: string;
}) {
  return (
    <CompetitionDataShell
      icon={metric.icon}
      label={metric.label}
      value={metric.value}
      subvalue={metric.subvalue}
      accent={accent}
      emphasize={metric.emphasize}
    />
  );
}
