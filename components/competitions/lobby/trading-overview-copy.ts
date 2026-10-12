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
 * TILES SAY WHAT, STEPS SAY HOW (owner reference, 12 Oct 2026, superseding the same day's
 * one-list merge): `features` are four short facts - market, seats, ranking rule, pot - and
 * `steps` are the four moves of play in order. Each is written once from the stored fields.
 */

export interface TradingOverviewFeature {
  /** `NEON_ICON` path - a string so it can cross the server/client boundary. */
  iconSrc: string;
  title: string;
  detail: string;
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

/** The short line under the ranking tile: what finishing first takes, per ranking method. */
const FINISH_DETAIL = new Map<string, string>([
  ["pnl", "Finish with the strongest profit to top the board."],
  ["roi", "Finish with the best return % to top the board."],
  ["total_capital", "Finish with the biggest balance to top the board."],
  ["win_rate", "Finish with the best win rate to top the board."],
  ["total_wins", "Finish with the most winning trades to top the board."],
  ["profit_factor", "Finish with the best profit factor to top the board."],
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
    ? `Start with ${capitalText} of simulated cash${leverage ? ` and trade with leverage up to 1:${leverage}` : ""}.`
    : "Real prices, simulated cash - no real money at risk.";
  const qualifyLine = minTrades
    ? ` Complete at least ${minTrades} trade${minTrades === 1 ? "" : "s"} to qualify.`
    : "";
  const spotsLeft = seats ? Math.max(0, seats - joined) : null;
  const payoutLine =
    paid === 1
      ? "The winner takes it all"
      : paid > 1
        ? `The top ${paid} split it`
        : "It goes to the winners";

  const features: TradingOverviewFeature[] = [
    {
      iconSrc: NEON_ICON("candles"),
      title: assets.length ? joinLabels(assets) : "Live markets",
      detail: capitalLine,
    },
    {
      iconSrc: NEON_ICON("users-group"),
      title: seats ? `${seats.toLocaleString()} seats` : "Open field",
      detail:
        joined > 0
          ? `${joined.toLocaleString()} trader${joined === 1 ? "" : "s"} already joined${spotsLeft !== null ? ` - ${spotsLeft.toLocaleString()} seats left` : ""}.`
          : "Nobody is in yet - grab the first seat.",
    },
    {
      iconSrc: NEON_ICON("target-purple"),
      title: `${RANKING_LABELS.get(rankingMethod)} wins`,
      detail: FINISH_DETAIL.get(rankingMethod) ?? "Finish on top of the board.",
    },
    {
      iconSrc: NEON_ICON("trophy-green"),
      title: potText ? `${potText} pot` : "Glory & XP",
      detail: potText
        ? `${payoutLine} when the bell rings.`
        : "No prize pot - play for rank, badges and bragging rights.",
    },
  ];

  const climbExtras = [
    minWinRate ? `Keep your win rate above ${minWinRate}%.` : null,
    rules.disqualifyOnLiquidation ? "Get liquidated and you're out." : null,
  ].filter(Boolean);

  const steps: TradingOverviewStep[] = [
    {
      title: "Jump in",
      detail: `${fee ? `Pay ${formatVolts(fee, { symbol: creditSymbol })} to grab a seat.` : "Grab a free seat."}${capitalText ? ` You start with ${capitalText} of simulated cash.` : ""}`,
    },
    {
      title: "Trade live",
      detail: `${assets.length ? `Trade ${joinLabels(assets)}` : "Trade the live markets"}${leverage ? ` with leverage up to 1:${leverage}` : ""} while the clock runs.${qualifyLine}`,
    },
    {
      title: "Climb the ranks",
      detail: [CLIMB_DETAIL.get(rankingMethod), ...climbExtras].join(" "),
    },
    {
      title: "Take the pot",
      detail: potText
        ? paid === 1
          ? `The winner takes all ${potText} when the bell rings.`
          : paid > 1
            ? `The top ${paid} split ${potText} when the bell rings.`
            : `${potText} goes to the winners when the bell rings.`
        : "Finish high for XP, badges and a spot in the hall of fame.",
    },
  ];

  return { features, steps };
}
