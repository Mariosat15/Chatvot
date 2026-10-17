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
  TradingOverviewCopy,
  TradingOverviewFact,
  TradingOverviewFactIcon,
} from "@/components/competitions/lobby/trading-overview-copy";
import { NEON_ICON } from "@/lib/services/games/overview-assets";

/** Menuitems swords tile — Battle plan header (owner, 17 Oct 2026). */
const BATTLE_PLAN_ICON = NEON_ICON("swords");

/**
 * The trading / game Overview tab: "About this competition", then each fact tile, then the
 * "Battle plan" — all full-width stacked bands (owner, 17 Oct 2026: red-box mark-up; was a
 * side-by-side About + two tiles that cramped the copy).
 *
 * Every word comes from `buildTradingOverviewCopy` / `buildGameOverviewCopy`; this file only
 * draws it. Headings sit on one line with their icon (`items-center`, `leading-none`), each
 * step's title shares the height of its number circle so the two line up, and nothing
 * truncates - long text wraps instead.
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
    frame: "border-violet-400/35 shadow-[0_0_18px_rgba(167,139,250,0.14)]",
    bar: "bg-violet-400",
    dot: "border-violet-400/50 text-violet-300",
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
  const stepCount = overview.steps.length;
  // Reason: node centres sit at (2i+1)/(2n). The track runs from the first centre to the
  // last, so each end inset is 100/(2n) — 16.7% for three steps, 12.5% for trading's four.
  const trackInsetPct = stepCount > 1 ? 100 / (2 * stepCount) : 0;
  const roadmapMax =
    stepCount >= 4 ? "max-w-5xl" : stepCount === 3 ? "max-w-3xl" : "max-w-2xl";

  return (
    // Reason (owner, 17 Oct 2026): About, How you play / market tile, and How you win each
    // get their own full-width band — not three columns. Side-by-side cramped the About
    // copy and put How-you-play beside How-you-win; stacked matches the red-box mark-up on
    // both the game and trading lobbies. Battle plan stays a fourth band below.
    <div className="flex flex-col gap-5">
      <section className={CARD}>
        <CardHeading
          icon={<Info className="h-7 w-7 shrink-0 text-cyan-300" />}
          lead="About this"
          accent="competition"
        />
        <p className="mt-4 text-base leading-relaxed text-gray-300">{about}</p>
      </section>

      {overview.features.map((feature, index) => {
        const tone = TILE_TONES[index % TILE_TONES.length];
        return (
          <section
            key={`${feature.title}-${feature.iconSrc}`}
            className={`${CARD} flex flex-col gap-5 sm:flex-row sm:items-start`}
          >
            <div className="flex shrink-0 flex-col items-center sm:w-40">
              {/* eslint-disable-next-line @next/next/no-img-element -- fixed local icon art */}
              <img
                src={feature.iconSrc}
                alt=""
                draggable={false}
                className="h-16 w-16 object-contain"
              />
              <p className="mt-3 text-center text-lg font-bold leading-tight text-white">
                {feature.title}
              </p>
              <span
                className={`mt-2.5 h-0.5 w-8 shrink-0 rounded-full ${tone.bar}`}
              />
            </div>
            <ul
              className={`min-w-0 flex-1 divide-y divide-white/10 rounded-xl border bg-[#0A1024]/80 px-4 py-2 ${tone.frame}`}
            >
              {feature.facts.map((fact) => (
                <FactRow
                  key={`${fact.icon}-${fact.strong}`}
                  fact={fact}
                  dot={tone.dot}
                />
              ))}
            </ul>
          </section>
        );
      })}

      <section className={CARD}>
        <CardHeading
          icon={
            // eslint-disable-next-line @next/next/no-img-element -- fixed local neon icon
            <img
              src={BATTLE_PLAN_ICON}
              alt=""
              draggable={false}
              className="h-8 w-8 shrink-0 object-contain drop-shadow-[0_0_10px_rgba(56,189,248,0.45)]"
            />
          }
          lead="Battle"
          accent="plan"
        />
        {/*
          Reason (owner, 17 Oct 2026): progress roadmap on game AND trading lobbies —
          numbered nodes on one cyan track, not islands with a dead gap. Track inset
          follows step count so trading's four nodes still sit on the line.
        */}
        <ol
          className={`relative mx-auto mt-8 grid ${roadmapMax} grid-cols-1 gap-8 ${
            stepCount <= 1
              ? ""
              : stepCount === 2
                ? "sm:grid-cols-2 sm:gap-4"
                : stepCount === 3
                  ? "sm:grid-cols-3 sm:gap-3"
                  : "sm:grid-cols-2 sm:gap-6 xl:grid-cols-4 xl:gap-2"
          }`}
        >
          {stepCount > 1 ? (
            <div
              aria-hidden
              className="pointer-events-none absolute top-5 z-0 hidden h-[3px] sm:block"
              style={{ left: `${trackInsetPct}%`, right: `${trackInsetPct}%` }}
            >
              <div className="h-full w-full rounded-full bg-gradient-to-r from-sky-500/10 via-cyan-300/90 to-sky-500/10 shadow-[0_0_16px_rgba(34,211,238,0.45)]" />
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[repeating-linear-gradient(90deg,rgba(165,243,252,0.7)_0_5px,transparent_5px_11px)] opacity-80" />
            </div>
          ) : null}
          {overview.steps.map((step, index) => (
            <li
              key={step.title}
              className="relative z-10 flex min-w-0 flex-col items-center text-center"
            >
              <span className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-cyan-300/90 bg-gradient-to-b from-[#0B1A36] to-[#060A18] text-base font-black text-white shadow-[0_0_20px_rgba(34,211,238,0.55)] ring-[5px] ring-cyan-400/20">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(125,211,252,0.35),transparent_55%)]"
                />
                <span className="relative">{index + 1}</span>
              </span>
              <p className="mt-3.5 text-lg font-bold leading-tight text-white">
                {step.title}
              </p>
              <p className="mt-1.5 max-w-[13rem] text-sm leading-relaxed text-gray-400">
                {step.detail}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
