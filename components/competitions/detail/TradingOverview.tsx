import {
  BarChart3,
  Clock,
  DollarSign,
  Flag,
  Info,
  TrendingUp,
  Trophy,
  User,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type {
  TradingOverviewCopy,
  TradingOverviewFact,
  TradingOverviewFactIcon,
} from "@/components/competitions/lobby/trading-overview-copy";

/**
 * The trading Overview tab (owner reference, 12 Oct 2026): "About this competition" with four
 * centred fact tiles (each with up to two small icon rows), beside a "Battle plan" numbered timeline.
 *
 * Every word comes from `buildTradingOverviewCopy`; this file only draws it. Headings sit on one
 * line with their icon (`items-center`, `leading-none`), each step's title shares the height of
 * its number circle so the two line up, and nothing truncates - long text wraps instead.
 *
 * Rendered inside the client tab bar, so the icons are imported here rather than passed in (R39).
 */

/** One glow per tile position. Whole class strings so Tailwind sees each. */
const TILE_TONES = [
  {
    frame: "border-emerald-400/35 shadow-[0_0_18px_rgba(52,211,153,0.14)]",
    bar: "bg-emerald-400",
    dot: "border-emerald-400/50 text-emerald-300",
  },
  {
    frame: "border-sky-400/35 shadow-[0_0_18px_rgba(56,189,248,0.14)]",
    bar: "bg-sky-400",
    dot: "border-sky-400/50 text-sky-300",
  },
  {
    frame: "border-violet-400/35 shadow-[0_0_18px_rgba(167,139,250,0.14)]",
    bar: "bg-violet-400",
    dot: "border-violet-400/50 text-violet-300",
  },
  {
    frame: "border-green-400/35 shadow-[0_0_18px_rgba(74,222,128,0.14)]",
    bar: "bg-green-400",
    dot: "border-green-400/50 text-green-300",
  },
] as const;

// Reason: a Map, not an object - the key arrives as data and an object lookup walks the
// prototype chain.
const FACT_ICONS = new Map<TradingOverviewFactIcon, LucideIcon>([
  ["cash", DollarSign],
  ["leverage", TrendingUp],
  ["player", User],
  ["seats", UsersRound],
  ["chart", BarChart3],
  ["trophy", Trophy],
  ["crowd", Users],
  ["clock", Clock],
]);

function FactRow({ fact, dot }: { fact: TradingOverviewFact; dot: string }) {
  const Icon = FACT_ICONS.get(fact.icon) ?? Info;
  return (
    <li className="flex items-center gap-2.5 py-2.5 text-left first:pt-0 last:pb-0">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white/[0.03] ${dot}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <p className="min-w-0 text-[13px] leading-snug text-gray-400">
        {fact.lead ? <>{fact.lead} </> : null}
        <span className="font-bold text-white">{fact.strong}</span>
        {fact.tail ? <> {fact.tail}</> : null}
      </p>
    </li>
  );
}

const CARD =
  "rounded-2xl border border-sky-400/40 bg-[#060A18]/85 p-6 shadow-[0_0_26px_rgba(56,189,248,0.14)]";

function CardHeading({
  icon,
  lead,
  accent,
}: {
  icon: React.ReactNode;
  lead: string;
  accent: string;
}) {
  return (
    <h3 className="flex items-center gap-3 text-2xl font-bold leading-none text-white">
      {icon}
      <span>
        {lead} <span className="text-cyan-300">{accent}</span>
      </span>
    </h3>
  );
}

export function TradingOverview({
  about,
  overview,
}: {
  about: string;
  overview: TradingOverviewCopy;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className={CARD}>
        <CardHeading
          icon={<Info className="h-7 w-7 shrink-0 text-cyan-300" />}
          lead="About this"
          accent="competition"
        />
        <p className="mt-4 text-base leading-relaxed text-gray-300">{about}</p>
        <ul className="mt-6 grid grid-cols-2 gap-3">
          {overview.features.map((feature, index) => {
            const tone = TILE_TONES[index % TILE_TONES.length];
            return (
              <li
                key={feature.iconSrc}
                className={`flex min-w-0 flex-col items-center rounded-xl border bg-[#0A1024]/80 px-3.5 pb-4 pt-5 text-center ${tone.frame}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- fixed local icon art */}
                <img
                  src={feature.iconSrc}
                  alt=""
                  draggable={false}
                  className="h-16 w-16 shrink-0 object-contain"
                />
                <p className="mt-3 text-lg font-bold leading-tight text-white">
                  {feature.title}
                </p>
                <span
                  className={`mt-2.5 h-0.5 w-8 shrink-0 rounded-full ${tone.bar}`}
                />
                <ul className="mt-4 w-full divide-y divide-white/10 border-t border-white/10 pt-3">
                  {feature.facts.map((fact) => (
                    <FactRow
                      key={`${fact.icon}-${fact.strong}`}
                      fact={fact}
                      dot={tone.dot}
                    />
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={CARD}>
        <CardHeading
          icon={<Flag className="h-7 w-7 shrink-0 text-cyan-300" />}
          lead="Battle"
          accent="plan"
        />
        <ol className="relative mt-6">
          {/* The rail runs through the centres of the number circles. */}
          <span
            aria-hidden
            className="absolute bottom-5 left-[18px] top-5 w-px bg-sky-400/40"
          />
          {overview.steps.map((step, index) => (
            <li
              key={step.title}
              className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-x-4 pb-5 last:pb-0"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-sky-400 bg-[#060A18] text-sm font-bold text-white shadow-[0_0_12px_rgba(56,189,248,0.45)]">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-9 text-white">
                  {step.title}
                </p>
                <p className="text-sm leading-relaxed text-gray-400">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
