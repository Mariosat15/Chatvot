import Image from "next/image";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";

export interface ArenaKpiValues {
  liveNow: number;
  startingSoon: number;
  prizePoolLabel: string;
}

const CARDS = [
  {
    key: "live" as const,
    label: "LIVE NOW",
    description: "Active competitions",
    icon: COMPETITION_ICON.live,
    accent: "rgba(0,216,255,.45)",
    border: "border-cyan-400/45",
    valueClass: "text-cyan-200",
  },
  {
    key: "soon" as const,
    label: "STARTING SOON",
    description: "Reserve your spot",
    icon: COMPETITION_ICON.soon,
    accent: "rgba(255,176,32,.4)",
    border: "border-amber-400/45",
    valueClass: "text-amber-200",
  },
  {
    key: "prize" as const,
    label: "PRIZE POOL",
    description: "Total value across all competitions",
    icon: COMPETITION_ICON.prize,
    accent: "rgba(217,76,255,.4)",
    border: "border-fuchsia-400/45",
    valueClass: "text-fuchsia-200",
  },
];

export function ArenaKpiCards({ values }: { values: ArenaKpiValues }) {
  const map = {
    live: String(values.liveNow),
    soon: String(values.startingSoon),
    prize: values.prizePoolLabel,
  };

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      {CARDS.map((card) => (
        <div
          key={card.key}
          className={`relative flex h-[104px] items-center gap-3 overflow-hidden rounded-2xl border bg-gradient-to-br from-[rgba(7,22,55,.9)] to-[rgba(3,11,29,.95)] px-4 ${card.border}`}
          style={{ boxShadow: `0 0 18px ${card.accent}` }}
        >
          <div
            className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 rounded-full opacity-30"
            style={{
              background: `radial-gradient(circle, ${card.accent}, transparent 70%)`,
            }}
          />
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/40">
            <Image
              src={card.icon}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
            />
          </div>
          <div className="relative min-w-0 flex-1">
            <p className="text-[13px] font-extrabold uppercase tracking-wide text-white/70">
              {card.label}
            </p>
            <p
              className={`truncate text-[30px] font-black leading-none tabular-nums ${card.valueClass}`}
            >
              {map[card.key]}
            </p>
            <p className="mt-1 truncate text-xs text-white/45">
              {card.description}
            </p>
          </div>
          <span className="relative text-xl text-white/35" aria-hidden>
            ›
          </span>
        </div>
      ))}
    </section>
  );
}
