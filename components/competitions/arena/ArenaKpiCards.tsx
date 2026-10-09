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

function KpiPanel({
  card,
  value,
  onClick,
}: {
  card: (typeof CARDS)[number];
  value: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full opacity-35"
        style={{
          background: `radial-gradient(circle, ${card.accent}, transparent 70%)`,
        }}
      />
      <div className="relative flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/45">
        <Image
          src={card.icon}
          alt=""
          width={58}
          height={58}
          className="h-[42px] w-[42px] object-contain"
        />
      </div>
      <div className="relative min-w-0 flex-1">
        <p className="text-[13px] font-extrabold uppercase tracking-wide text-white/70">
          {card.label}
        </p>
        <p
          className={`truncate text-[32px] font-extrabold leading-none tabular-nums ${card.valueClass}`}
        >
          {value}
        </p>
        <p className="mt-1 truncate text-xs text-white/45">{card.description}</p>
      </div>
      <span className="relative text-2xl text-white/35" aria-hidden>
        ›
      </span>
    </>
  );

  const className = `relative flex h-[118px] w-full items-center gap-4 overflow-hidden rounded-2xl border bg-gradient-to-br from-[rgba(7,22,55,.92)] to-[rgba(3,11,29,.96)] px-4 text-left ${card.border}`;
  const style = { boxShadow: `0 0 22px ${card.accent}` };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} cursor-pointer transition hover:brightness-110`}
        style={style}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={className} style={style}>
      {body}
    </div>
  );
}

export function ArenaKpiCards({
  values,
  onSelect,
}: {
  values: ArenaKpiValues;
  onSelect?: (key: "live" | "soon" | "prize") => void;
}) {
  const map = {
    live: String(values.liveNow),
    soon: String(values.startingSoon),
    prize: values.prizePoolLabel,
  };

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      {CARDS.map((card) => (
        <KpiPanel
          key={card.key}
          card={card}
          value={map[card.key]}
          onClick={
            onSelect && card.key !== "prize"
              ? () => onSelect(card.key)
              : undefined
          }
        />
      ))}
    </section>
  );
}
