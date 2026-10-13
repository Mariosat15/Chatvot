import type { TradingOverviewCopy } from "@/components/competitions/lobby/trading-overview-copy";
import {
  BarChart3,
  Clock,
  DollarSign,
  Info,
  TrendingUp,
  Trophy,
  User,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type {
  TradingOverviewFact,
  TradingOverviewFactIcon,
} from "@/components/competitions/lobby/trading-overview-copy";

/**
 * About this competition — full-width phone card (Complobyymobile §10).
 * Feature tiles stay 2-up only when they fit; never beside Battle Plan.
 */

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

const TILE_TONES = [
  {
    frame: "border-emerald-400/35 shadow-[0_0_18px_rgba(52,211,153,0.14)]",
    bar: "bg-emerald-400",
    dot: "border-emerald-400/50 text-emerald-300",
  },
  {
    frame: "border-violet-400/35 shadow-[0_0_18px_rgba(167,139,250,0.14)]",
    bar: "bg-violet-400",
    dot: "border-violet-400/50 text-violet-300",
  },
] as const;

export function MobileLobbyOverview({
  about,
  overview,
}: {
  about: string;
  overview: TradingOverviewCopy;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-sky-400/40 bg-[#060A18]/85 p-4 shadow-[0_0_26px_rgba(56,189,248,0.14)]">
      <h2 className="flex items-center gap-2 text-lg font-bold text-white">
        <Info className="h-6 w-6 shrink-0 text-cyan-300" aria-hidden />
        <span>
          About this <span className="text-cyan-300">competition</span>
        </span>
      </h2>
      <p className="mt-3 text-[14px] leading-relaxed text-gray-300 break-words">
        {about}
      </p>
      {overview.features.length > 0 ? (
        <ul className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {overview.features.map((feature, index) => {
            const tone = TILE_TONES[index % TILE_TONES.length];
            return (
              <li
                key={feature.iconSrc}
                className={`flex min-w-0 flex-col items-center rounded-xl border bg-[#0A1024]/80 px-3 pb-3.5 pt-4 text-center ${tone.frame}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- fixed local icon art */}
                <img
                  src={feature.iconSrc}
                  alt=""
                  draggable={false}
                  className="h-14 w-14 shrink-0 object-contain"
                />
                <p className="mt-2 text-base font-bold leading-tight text-white break-words">
                  {feature.title}
                </p>
                <span
                  className={`mt-2 h-0.5 w-8 shrink-0 rounded-full ${tone.bar}`}
                />
                <ul className="mt-3 w-full divide-y divide-white/10 border-t border-white/10 pt-2 text-left">
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
      ) : null}
    </section>
  );
}

function FactRow({ fact, dot }: { fact: TradingOverviewFact; dot: string }) {
  const Icon = FACT_ICONS.get(fact.icon) ?? Info;
  return (
    <li className="flex items-center gap-2 py-2 text-left first:pt-0 last:pb-0">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-white/[0.03] ${dot}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <p className="min-w-0 text-[13px] leading-snug text-gray-400 break-words">
        {fact.lead ? <>{fact.lead} </> : null}
        <span className="font-bold text-white">{fact.strong}</span>
        {fact.tail ? <> {fact.tail}</> : null}
      </p>
    </li>
  );
}
