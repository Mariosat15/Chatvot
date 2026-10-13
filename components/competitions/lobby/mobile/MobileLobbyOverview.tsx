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
import { MOBILE_CARD } from "./MobileLobbyCard";

/**
 * About this competition - full-width phone card (Complobyymobile §10, mobile fix guide).
 * Feature tiles stack one per row: icon and title on one line, facts listed beneath.
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
  { dot: "border-emerald-400/40 text-emerald-300" },
  { dot: "border-violet-400/40 text-violet-300" },
] as const;

export function MobileLobbyOverview({
  id,
  about,
  overview,
}: {
  id?: string;
  about: string;
  overview: TradingOverviewCopy;
}) {
  return (
    <section id={id} className={`scroll-mt-4 ${MOBILE_CARD}`}>
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-white">
        <Info className="h-5 w-5 shrink-0 text-cyan-300" aria-hidden />
        <span>
          About this <span className="text-cyan-300">competition</span>
        </span>
      </h2>
      <p className="mt-2.5 text-[14px] leading-relaxed text-gray-300 break-words">
        {about}
      </p>
      {overview.features.length > 0 ? (
        <ul className="mt-4 flex min-w-0 flex-col gap-3">
          {overview.features.map((feature, index) => {
            const tone = TILE_TONES[index % TILE_TONES.length];
            return (
              <li
                key={feature.iconSrc}
                className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- fixed local icon art */}
                  <img
                    src={feature.iconSrc}
                    alt=""
                    draggable={false}
                    className="h-9 w-9 shrink-0 object-contain"
                  />
                  <p className="min-w-0 text-[15px] font-bold leading-tight text-white break-words">
                    {feature.title}
                  </p>
                </div>
                <ul className="mt-2.5 w-full divide-y divide-white/[0.06] border-t border-white/[0.06] pt-2 text-left">
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
