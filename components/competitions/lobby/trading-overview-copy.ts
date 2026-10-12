import { NEON_ICON } from "@/lib/services/games/overview-assets";
import { formatVolts } from "@/lib/utils/format-volts";
import { storedLeverageCeiling } from "@/lib/services/trading/competition-leverage";
import {
  ASSET_LABELS,
  RANKING_LABELS,
} from "@/components/trading/lobby/trading-lobby-labels";

/**
 * The trading Overview tab's copy, written from THIS competition's own facts (owner, 12 Oct
 * 2026: "all info here must be competition data agnostic ... how they climb the ranks depends
 * on the comp type").
 *
 * The static `contestFeatures("trading")` / `contestHowItWorks("trading")` copy told every
 * trading contest that "your P&L decides the order", including contests ranked on ROI, win rate
 * or profit factor - a player-facing statement of the rules that was wrong on four of the six
 * ranking methods. Every sentence here is derived from a stored field, and a fact the contest
 * does not carry is left out rather than guessed.
 *
 * Pure data in, pure data out: the server page builds it and the client tab bar renders it, so
 * nothing here may be a component (R39). Ranking labels come from `trading-lobby-labels.ts`, the
 * same dictionary the Scoring tab reads, so the two can never name different rules.
 *
 * TILES SAY WHAT, STEPS SAY HOW (owner reference, 12 Oct 2026, superseding the same day's
 * one-list merge): `features` are two short facts - market and ranking rule (seats and pot were dropped 12 Oct 2026: the summary tiles above already show both) - each with
 * up to two small rows (`facts`, reference image of the same day), and
 * `steps` are the four moves of play in order. Each is written once from the stored fields.
 */

/**
 * Which small glyph a fact row wears. A string key rather than a component, because this copy
 * is built on the server and drawn by a client component (R39); the renderer maps it.
 */
export type TradingOverviewFactIcon =
  | "cash"
  | "leverage"
  | "player"
  | "seats"
  | "chart"
  | "trophy"
  | "crowd"
  | "clock";

/** One small row under a tile: `lead` and `tail` are plain, `strong` is the bold part. */
export interface TradingOverviewFact {
  icon: TradingOverviewFactIcon;
  lead?: string;
  strong: string;
  tail?: string;
}

export interface TradingOverviewFeature {
  /** `NEON_ICON` path - a string so it can cross the server/client boundary. */
  iconSrc: string;
  title: string;
  /** At most two short rows; a fact the contest does not carry is left out. */
  facts: TradingOverviewFact[];
}

export interface TradingOverviewStep {
  title: string;
  detail: string;
}

export interface TradingOverviewCopy {
  features: TradingOverviewFeature[];
  steps: TradingOverviewStep[];
}

/** Why each ranking method puts one trader above another, in the lobby's playful voice. */
const CLIMB_DETAIL = new Map<string, string>([
  ["pnl", "Make the most profit to climb. Every tick counts!"],
  [
    "roi",
    "Grow your money by the biggest % to climb. Small and sharp can win!",
  ],
  ["total_capital", "End with the biggest balance to climb. Grow it, grow it!"],
  ["win_rate", "Win more of your trades to climb. Pick your shots!"],
  ["total_wins", "Rack up the most winning trades to climb."],
  ["profit_factor", "Let winners run and cut losers fast to climb."],
]);

/** The short line under the ranking tile: what finishing first takes, per ranking method. */
const FINISH_DETAIL = new Map<string, string>([
  ["pnl", "biggest profit"],
  ["roi", "best return %"],
  ["total_capital", "biggest balance"],
  ["win_rate", "best win rate"],
  ["total_wins", "most winning trades"],
  ["profit_factor", "best profit factor"],
]);

const DEFAULT_RANKING = "pnl";

function positiveNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;
}

/** Paid places are the configured shares above zero, never the configured row count. */
function countPaidPositions(distribution: unknown): number {
  if (!Array.isArray(distribution)) return 0;
  return distribution.filter((row) => positiveNumber(row?.percentage) !== null)
    .length;
}

function leverageCeiling(competition: { leverage?: unknown }): number | null {
  return storedLeverageCeiling(competition.leverage) ?? null;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- `competition` is the lean document the
   page already hands to every trading block; typing it here would be a third hand-written
   shape of one model (the R32/R33 lean-generic trap). */
export function buildTradingOverviewCopy({
  competition,
  creditSymbol,
}: {
  competition: any;
  creditSymbol?: string;
}): TradingOverviewCopy {
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const rules = competition?.rules ?? {};
  const rankingMethod =
    typeof rules.rankingMethod === "string" &&
    RANKING_LABELS.has(rules.rankingMethod)
      ? rules.rankingMethod
      : DEFAULT_RANKING;

  const assets: string[] = (
    Array.isArray(competition?.assetClasses) ? competition.assetClasses : []
  ).map((a: string) => ASSET_LABELS.get(a) ?? a);
  const capital = positiveNumber(
    competition?.startingCapital ?? competition?.startingTradingPoints,
  );
  const capitalText = capital ? `$${capital.toLocaleString()}` : null;
  const leverage = leverageCeiling(competition ?? {});
  const minTrades = positiveNumber(rules.minimumTrades);
  const minWinRate = positiveNumber(rules.minimumWinRate);
  const pot = positiveNumber(
    competition?.prizePool ?? competition?.prizePoolCredits,
  );
  const potText = pot ? formatVolts(pot, { symbol: creditSymbol }) : null;
  const fee = positiveNumber(
    competition?.entryFee ?? competition?.entryFeeCredits,
  );
  const paid = countPaidPositions(competition?.prizeDistribution);

  const qualifyLine = minTrades
    ? ` Make at least ${minTrades} trade${minTrades === 1 ? "" : "s"} to count.`
    : "";

  const marketFacts: TradingOverviewFact[] = [
    capitalText
      ? { icon: "cash", strong: capitalText, tail: "Simulated funds" }
      : { icon: "cash", strong: "No real money", tail: "at risk" },
  ];
  if (leverage) {
    marketFacts.push({
      icon: "leverage",
      lead: "Leverage up to",
      strong: `1:${leverage}`,
    });
  }

  const features: TradingOverviewFeature[] = [
    {
      iconSrc: NEON_ICON("candles"),
      title: assets.length ? joinLabels(assets) : "Live markets",
      facts: marketFacts,
    },
    {
      iconSrc: NEON_ICON("target-purple"),
      title: `${RANKING_LABELS.get(rankingMethod)} wins`,
      facts: [
        {
          icon: "chart",
          lead: "Finish with the",
          strong: FINISH_DETAIL.get(rankingMethod) ?? "best score",
        },
        { icon: "trophy", lead: "Climb to", strong: "the top" },
      ],
    },
  ];

  const climbExtras = [
    minWinRate ? `Keep your win rate above ${minWinRate}%.` : null,
    rules.disqualifyOnLiquidation
      ? "Get liquidated once and you're out - even if funds are left!"
      : null,
  ].filter(Boolean);

  const steps: TradingOverviewStep[] = [
    {
      title: "Jump in",
      detail: `${fee ? `Pay ${formatVolts(fee, { symbol: creditSymbol })} to grab a seat.` : "Grab a free seat."}${capitalText ? ` You get ${capitalText} of Simulated funds to play with.` : ""}`,
    },
    {
      title: "Trade live",
      detail: `${assets.length ? `Trade ${joinLabels(assets)}` : "Trade the live markets"}${leverage ? ` with up to 1:${leverage} leverage` : ""} before the clock runs out.${qualifyLine}`,
    },
    {
      title: "Climb the ranks",
      detail: [CLIMB_DETAIL.get(rankingMethod), ...climbExtras].join(" "),
    },
    {
      title: "Take the pot",
      detail: potText
        ? paid === 1
          ? `Finish first and grab all ${potText}!`
          : paid > 1
            ? `Finish in the top ${paid} and share ${potText}!`
            : `The winners share ${potText}!`
        : "Finish high for XP, badges and bragging rights!",
    },
  ];

  return { features, steps };
}
