import Image from "next/image";
import type { CompetitionMetric } from "@/lib/competitions/types";

/**
 * One boxed stat on a competition card (Image 1 anatomy).
 *
 * Reason: values must never be cut off with "…" — the old block used `truncate`,
 * which clipped Entry Fee / Mode / Difficulty in the footer. Values now wrap.
 * The box is its own container so, when a card is narrow, the icon tile shrinks
 * instead of squeezing the value into an unreadable sliver.
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
        className="grid h-full min-h-[72px] grid-cols-[28px_minmax(0,1fr)] items-center gap-2 rounded-xl border px-2.5 py-2 @[130px]:grid-cols-[38px_minmax(0,1fr)]"
        style={{
          borderColor: prize ? "rgba(255,176,0,.38)" : "rgba(255,255,255,.10)",
          background: prize
            ? "linear-gradient(135deg, rgba(255,176,0,.16), rgba(255,92,34,.08))"
            : "rgba(5,11,28,.72)",
        }}
      >
        <span
          className="flex size-7 items-center justify-center rounded-lg border @[130px]:size-[38px]"
          style={{ borderColor: `${tint}40`, background: `${tint}1a` }}
          aria-hidden
        >
          <Image
            src={metric.icon}
            alt=""
            width={26}
            height={26}
            className="size-5 object-contain @[130px]:size-[26px]"
          />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase leading-tight tracking-[0.08em] text-white/55 @[130px]:text-[10px]">
            {metric.label}
          </p>
          <p
            className={`mt-0.5 break-words font-extrabold leading-tight tabular-nums ${
              prize
                ? "text-[16px] text-amber-200 @[130px]:text-[18px]"
                : "text-[15px] text-white @[130px]:text-[16px]"
            }`}
          >
            {metric.value}
          </p>
          {metric.subvalue ? (
            <p className="mt-0.5 break-words text-[10px] font-medium leading-tight text-white/45">
              {metric.subvalue}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
