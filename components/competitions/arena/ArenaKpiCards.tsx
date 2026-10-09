import Image from "next/image";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";

export interface ArenaKpiValues {
  liveNow: number;
  startingSoon: number;
  prizePoolLabel: string;
}

const ICON_BASE = "/assets/neon/competitions/icons";

/**
 * Owner reference: each tile is tinted in its own colour, with a glowing ring
 * icon, a coloured label, the white figure with its caption beside it, faint
 * artwork on the right and a ringed arrow.
 */
const CARDS = [
  {
    key: "live" as const,
    label: "LIVE NOW",
    description: "Active competitions",
    icon: COMPETITION_ICON.live,
    art: `${ICON_BASE}/icon-chart.png`,
    rgb: "0,229,200",
    labelClass: "text-[#3dffd8]",
  },
  {
    key: "soon" as const,
    label: "STARTING SOON",
    description: "Reserve your spot",
    icon: COMPETITION_ICON.soon,
    art: COMPETITION_ICON.volts,
    rgb: "255,190,40",
    labelClass: "text-[#ffd23d]",
  },
  {
    key: "prize" as const,
    label: "PRIZE POOL",
    description: "Total value across all competitions",
    icon: COMPETITION_ICON.prize,
    art: `${ICON_BASE}/icon-trophy-purple.png`,
    rgb: "196,80,255",
    labelClass: "text-[#e9b8ff]",
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
  const c = card.rgb;
  const body = (
    <>
      {/* Faint artwork on the right, as in the reference */}
      <div
        className="pointer-events-none absolute inset-y-0 right-10 w-[45%] opacity-30 [mask-image:linear-gradient(90deg,transparent,#000_45%)]"
        aria-hidden
      >
        <Image src={card.art} alt="" fill className="object-contain object-right" sizes="200px" />
      </div>

      {/* Glowing ring icon */}
      <div
        className="relative flex size-[46px] shrink-0 items-center justify-center rounded-full border-2"
        style={{
          borderColor: `rgba(${c},.9)`,
          background: `radial-gradient(circle, rgba(${c},.25), rgba(0,0,0,.55) 70%)`,
          boxShadow: `0 0 14px rgba(${c},.7), inset 0 0 10px rgba(${c},.45)`,
        }}
      >
        <Image src={card.icon} alt="" width={30} height={30} className="size-[28px] object-contain" />
      </div>

      <div className="relative min-w-0 flex-1">
        <p
          className={`text-[13px] font-black uppercase leading-none tracking-wide ${card.labelClass}`}
          style={{ textShadow: `0 0 10px rgba(${c},.6)` }}
        >
          {card.label}
        </p>
        <div className="mt-1 flex items-center gap-2.5">
          <span className="text-[28px] font-black leading-none text-white tabular-nums [text-shadow:0_0_12px_rgba(255,255,255,.25)]">
            {value}
          </span>
          <span className="line-clamp-2 max-w-[130px] text-[11.5px] font-semibold leading-tight text-white/85">
            {card.description}
          </span>
        </div>
      </div>

      {/* Ringed arrow */}
      <span
        className="relative flex size-[28px] shrink-0 items-center justify-center rounded-full border-2 bg-black/40 text-[16px] font-black leading-none text-white"
        style={{ borderColor: `rgba(${c},.85)`, boxShadow: `0 0 10px rgba(${c},.55)` }}
        aria-hidden
      >
        ›
      </span>
    </>
  );

  const className =
    "relative flex h-[76px] w-full items-center gap-3.5 overflow-hidden rounded-xl border-[1.5px] px-4 text-left";
  const style = {
    borderColor: `rgba(${c},.85)`,
    background: `linear-gradient(100deg, rgba(${c},.22) 0%, rgba(${c},.10) 45%, rgba(6,10,28,.92) 100%), #060a1c`,
    boxShadow: `0 0 18px rgba(${c},.45), inset 0 0 22px rgba(${c},.18)`,
  };

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
  const map = new Map<string, string>([
    ["live", String(values.liveNow)],
    ["soon", String(values.startingSoon)],
    ["prize", values.prizePoolLabel],
  ]);

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      {CARDS.map((card) => (
        <KpiPanel
          key={card.key}
          card={card}
          value={map.get(card.key) ?? ""}
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
