import { NEON_ICON } from "@/lib/services/games/overview-assets";
import { formatVolts } from "@/lib/utils/format-volts";
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
 * ONE LIST, NOT TILES PLUS STEPS (owner, 12 Oct 2026: "make this section all as one ... they
 * are very busy and hard to read so merge the info"). Four feature tiles and four timeline steps
 * said the same things twice - the market and capital, the ranking, the pot - so each item is
 * now one step in play order carrying the facts its tile used to repeat.
 */

export interface TradingOverviewItem {
  /** `NEON_ICON` path - a string so it can cross the server/client boundary. */
  iconSrc: string;
  title: string;
  detail: string;
}

export interface TradingOverviewCopy {
  items: TradingOverviewItem[];
}

/** Why each ranking method puts one trader above another, in the lobby's playful voice. */
const CLIMB_DETAIL = new Map<string, string>([
  ["pnl", "Your total profit & loss decides the order - every tick counts."],
  [
    "roi",
    "Your return % decides the order - a sharp small account can beat a big one.",
  ],
  [
    "total_capital",
    "Your account balance decides the order - grow it bigger than anyone.",
  ],
  ["win_rate", "Your win rate decides the order - pick your shots carefully."],
  [
    "total_wins",
    "Your number of winning trades decides the order - rack them up.",
  ],
  [
    "profit_factor",
    "Your profit factor decides the order - let winners run, cut losers fast.",
  ],
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

function leverageCeiling(competition: {
  leverage?: { enabled?: boolean; max?: number } | null;
}): number | null {
  return positiveNumber(competition.leverage?.max);
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
  const seats = positiveNumber(competition?.maxParticipants);
  const joined = Math.max(0, Number(competition?.currentParticipants) || 0);

  const capitalLine = capitalText
    ? `Start with ${capitalText} of simulated cash${leverage ? ` and up to 1:${leverage} leverage` : ""}.`
    : "Real prices, simulated cash - no real money at risk.";
  const qualifyLine = minTrades
    ? ` Close at least ${minTrades} trade${minTrades === 1 ? "" : "s"} to qualify.`
    : "";
  const seatsLine = seats
    ? ` ${Math.max(0, seats - joined).toLocaleString()} of ${seats.toLocaleString()} spots left.`
    : joined > 0
      ? ` ${joined.toLocaleString()} trader${joined === 1 ? "" : "s"} already in.`
      : "";

  const climbExtras = [
    minWinRate ? `Keep your win rate above ${minWinRate}%.` : null,
    rules.disqualifyOnLiquidation ? "Get liquidated and you're out." : null,
  ].filter(Boolean);

  const items: TradingOverviewItem[] = [
    {
      iconSrc: NEON_ICON("users-group"),
      title: "Jump in",
      detail: `${fee ? `Pay ${formatVolts(fee, { symbol: creditSymbol })} to grab a seat.` : "Grab a free seat."}${seatsLine}`,
    },
    {
      iconSrc: NEON_ICON("candles"),
      title: assets.length ? `Trade ${joinLabels(assets)}` : "Trade live",
      detail: `${capitalLine}${qualifyLine}`,
    },
    {
      iconSrc: NEON_ICON("target-purple"),
      title: `${RANKING_LABELS.get(rankingMethod)} wins`,
      detail: [CLIMB_DETAIL.get(rankingMethod), ...climbExtras].join(" "),
    },
    {
      iconSrc: NEON_ICON("trophy-green"),
      title: potText ? `Take the ${potText} pot` : "Play for glory",
      detail: potText
        ? paid === 1
          ? "The winner takes it all when the bell rings."
          : paid > 1
            ? `The top ${paid} share it when the bell rings.`
            : "It goes to the winners when the bell rings."
        : "No prize pot - finish high for XP, badges and bragging rights.",
    },
  ];

  return { items };
}
