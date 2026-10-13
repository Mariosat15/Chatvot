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
import { MOBILE_CARD_COMPACT } from "./MobileLobbyCard";

/**
 * About this competition - the left half of the Overview tab (mobile fix guide, 13 Oct 2026).
 * Sized for a half-width column beside the Battle plan, as in the owner's mock: compact
 * feature tiles with the facts listed beneath each title.
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

const TILE_TONES = ["text-emerald-300", "text-violet-300"] as const;

export function MobileLobbyOverview({
  about,
  overview,
}: {
  about: string;
  overview: TradingOverviewCopy;
}) {
  return (
    <section className={`h-full ${MOBILE_CARD_COMPACT}`}>
      <h2 className="flex items-center gap-1.5 text-[13px] font-bold leading-tight text-white">
        <Info className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden />
        <span className="min-w-0">
          About this <span className="text-cyan-300">competition</span>
        </span>
      </h2>
      <p className="mt-2 text-[12px] leading-relaxed text-gray-300 break-words">{about}</p>
      {overview.features.length > 0 ? (
        <ul className="mt-3 flex min-w-0 flex-col gap-2">
          {overview.features.map((feature, index) => {
            const tone = TILE_TONES[index % TILE_TONES.length];
            return (
              <li
                key={feature.iconSrc}
                className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- fixed local icon art */}
                  <img
                    src={feature.iconSrc}
                    alt=""
                    draggable={false}
                    className="h-7 w-7 shrink-0 object-contain"
                  />
                  <p className="min-w-0 text-[12px] font-bold leading-tight text-white break-words">
                    {feature.title}
                  </p>
                </div>
                <ul className="mt-1.5 space-y-1">
                  {feature.facts.map((fact) => (
                    <FactRow key={`${fact.icon}-${fact.strong}`} fact={fact} tone={tone} />
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

function FactRow({ fact, tone }: { fact: TradingOverviewFact; tone: string }) {
  const Icon = FACT_ICONS.get(fact.icon) ?? Info;
  return (
    <li className="flex items-start gap-1.5">
      <Icon className={`mt-[2px] h-3 w-3 shrink-0 ${tone}`} aria-hidden />
      <p className="min-w-0 text-[11px] leading-snug text-gray-400 break-words">
        {fact.lead ? <>{fact.lead} </> : null}
        <span className="font-bold text-white">{fact.strong}</span>
        {fact.tail ? <> {fact.tail}</> : null}
      </p>
    </li>
  );
}
