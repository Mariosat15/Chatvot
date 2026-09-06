import {
  Ban,
  Coins,
  Gauge,
  Scale,
  ShieldAlert,
  Trophy,
} from "lucide-react";
import { IconTile, NeonNote, NeonRow } from "@/components/neon/Cards";
import type { NeonAccordionSection } from "@/components/neon/Accordion";

/**
 * The six collapsible reference sections in the trading lobby's sidebar, from the bottom row of
 * the owner's style sheet: Eligible Assets, Trading Rules, Scoring, Risk Management,
 * Disqualification, Prizes.
 *
 * WHAT COLLAPSING ACTUALLY COSTS, because a restyle should not hide a behaviour change. These
 * six sections were nine always-open cards, so a trader who reads the page today sees every
 * rule without clicking and now has to open them. That is what the owner's mock asks for, and
 * the mitigation is in *which* things collapsed rather than in how they collapse: the entry
 * control, the countdown, the schedule, the difficulty and the prize table stay open, because
 * they are what a trader decides on. **Only reference material is behind a click.** If a later
 * change moves the prize table or the countdown in here, that is the mistake this note exists
 * to prevent.
 *
 * EVERY VALUE, FALLBACK AND CONDITION IS CARRIED OVER UNCHANGED. The percentages, the `|| 50`
 * and `|| 20` defaults, the ranking-method dictionaries and the exact conditions under which a
 * section appears at all are the page's, moved rather than rewritten. A restyle that quietly
 * changed a default would be a rules change on a contest with money in it, and it would review
 * as a tidy-up.
 *
 * THE DICTIONARIES ARE MAPS. They are indexed by a value from the database, and object indexing
 * walks the prototype chain, so a contest whose `rankingMethod` read `toString` would resolve to
 * a function - truthy, past the `||` fallback, and rendered as source code. The page's original
 * inline objects were reachable in exactly that way.
 */

const RANKING_LABELS = new Map<string, string>([
  ["pnl", "Highest P&L"],
  ["roi", "Highest ROI %"],
  ["total_capital", "Highest Capital"],
  ["win_rate", "Highest Win Rate"],
  ["total_wins", "Most Winning Trades"],
  ["profit_factor", "Best Profit Factor"],
]);

const RANKING_EXPLANATIONS = new Map<string, string>([
  [
    "pnl",
    "Winner is determined by total profit & loss (realized + unrealized).",
  ],
  [
    "roi",
    "Winner is determined by the highest return on investment percentage.",
  ],
  ["total_capital", "Winner has the highest account balance at the end."],
  ["win_rate", "Winner has the highest percentage of winning trades."],
  ["total_wins", "Winner has the most profitable trades closed."],
  ["profit_factor", "Winner has the best ratio of winning to losing trades."],
]);

const TIE_BREAKER_LABELS = new Map<string, string>([
  ["trades_count", "Most Trades"],
  ["win_rate", "Higher Win Rate"],
  ["total_capital", "Higher Capital"],
  ["roi", "Higher ROI"],
  ["join_time", "First to Join"],
  ["split_prize", "Split Prize"],
]);

const TIE_BREAKER_EXPLANATIONS = new Map<string, string>([
  ["trades_count", "The trader with more completed trades wins."],
  ["win_rate", "The trader with a higher win rate wins."],
  ["total_capital", "The trader with more capital wins."],
  ["roi", "The trader with a higher return on investment wins."],
  ["join_time", "The trader who joined first wins."],
  ["split_prize", "The prize is split equally between tied traders."],
]);

const ASSET_LABELS = new Map<string, string>([
  ["forex", "Forex"],
  ["crypto", "Crypto"],
  ["stocks", "Stocks"],
]);

const COMPETITION_TYPE_LABELS = new Map<string, string>([
  ["time_based", "Time-based"],
  ["goal_based", "Goal-based"],
  ["hybrid", "Hybrid"],
]);

interface RiskSettings {
  maxLeverage: number;
  marginLiquidation: number;
  marginCall: number;
  marginWarning: number;
  marginSafe: number;
}

/**
 * Builds the sections that apply to this contest.
 *
 * Sections with nothing to say are omitted rather than rendered empty, which is why this returns
 * an array rather than a fixed six. An accordion a trader opens to find a blank panel is worse
 * than one that was never offered - and the original cards were conditional in exactly the same
 * way, so this preserves the behaviour rather than inventing it.
 */
export function buildTradingLobbySections({
  competition,
  riskSettings,
  currSymbol,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  riskSettings: RiskSettings;
  currSymbol: string;
}): NeonAccordionSection[] {
  const sections: NeonAccordionSection[] = [];
  const rules = competition.rules;

  /* ---------- Eligible assets and the account a trader is given ---------- */
  sections.push({
    id: "eligible-assets",
    icon: <IconTile icon={Coins} accent="players" size="sm" />,
    title: "Eligible Assets",
    content: (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {(competition.assetClasses ?? []).map((asset: string) => (
            <span
              key={asset}
              className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-300"
            >
              {ASSET_LABELS.get(asset) ?? asset}
            </span>
          ))}
        </div>
        <NeonRow
          label="Starting capital"
          accent="entry"
          value={`$${(
            competition.startingCapital ||
            competition.startingTradingPoints ||
            0
          ).toLocaleString()}`}
        />
        <NeonRow
          label="Leverage"
          accent="score"
          /* Competition-specific leverage, never the platform-wide setting - carried over. */
          value={
            competition.leverage?.enabled
              ? `1:${competition.leverage.min} to 1:${competition.leverage.max}`
              : `1:${competition.leverage?.max || riskSettings.maxLeverage}`
          }
        />
        <NeonRow
          label="Max open positions"
          accent="rate"
          value={competition.maxOpenPositions || 10}
        />
        <NeonRow
          label="Max position size"
          accent="rate"
          value={`${competition.maxPositionSize || 100}%`}
        />
      </div>
    ),
  });

  /* ---------- The format, and the thresholds a trader must clear ---------- */
  sections.push({
    id: "trading-rules",
    icon: <IconTile icon={Scale} accent="value" size="sm" />,
    title: "Trading Rules",
    content: (
      <div className="space-y-2">
        <NeonRow
          label="Format"
          value={
            COMPETITION_TYPE_LABELS.get(competition.competitionType) ??
            "Time-based"
          }
        />
        {rules?.minimumTrades > 0 && (
          <NeonRow
            label="Minimum trades"
            accent="waiting"
            value={rules.minimumTrades}
          />
        )}
        {rules?.minimumWinRate > 0 && (
          <NeonRow
            label="Minimum win rate"
            accent="waiting"
            value={`${rules.minimumWinRate}%`}
          />
        )}
        <NeonNote>
          Trades are placed in the competition workspace and only count while
          the competition is running.
        </NeonNote>
      </div>
    ),
  });

  /* ---------- How the winner is decided ---------- */
  if (rules) {
    sections.push({
      id: "scoring",
      icon: <IconTile icon={Gauge} accent="entry" size="sm" />,
      title: "Scoring",
      content: (
        <div className="space-y-2">
          <NeonRow
            label="Ranked by"
            accent="value"
            value={RANKING_LABELS.get(rules.rankingMethod) ?? "Highest P&L"}
          />
          <NeonNote>
            {RANKING_EXPLANATIONS.get(rules.rankingMethod) ??
              "Winner is determined by total profit & loss."}
          </NeonNote>

          {rules.tieBreaker1 && (
            <>
              <NeonRow
                label="First tie breaker"
                accent="score"
                value={
                  TIE_BREAKER_LABELS.get(rules.tieBreaker1) ?? rules.tieBreaker1
                }
              />
              <NeonNote>
                If two traders tie,{" "}
                {TIE_BREAKER_EXPLANATIONS.get(rules.tieBreaker1) ??
                  "this is used to break the tie."}
              </NeonNote>
            </>
          )}

          {rules.tieBreaker2 && (
            <>
              <NeonRow
                label="Second tie breaker"
                accent="score"
                value={
                  TIE_BREAKER_LABELS.get(rules.tieBreaker2) ?? rules.tieBreaker2
                }
              />
              <NeonNote>
                If they are still tied,{" "}
                {TIE_BREAKER_EXPLANATIONS.get(rules.tieBreaker2) ??
                  "this is used as a secondary tie breaker."}
              </NeonNote>
            </>
          )}
        </div>
      ),
    });
  }

  /* ---------- Risk limits and the margin ladder, which were two cards ---------- */
  sections.push({
    id: "risk-management",
    icon: <IconTile icon={ShieldAlert} accent="ended" size="sm" />,
    title: "Risk Management",
    content: (
      <div className="space-y-2">
        <NeonRow
          label="Risk limits"
          accent={competition.riskLimits?.enabled ? "ended" : undefined}
          value={competition.riskLimits?.enabled ? "Active" : "Off"}
        />
        <NeonRow
          label="Max drawdown"
          accent={competition.riskLimits?.enabled ? "ended" : undefined}
          value={`${competition.riskLimits?.maxDrawdownPercent || 50}%`}
        />
        <NeonRow
          label="Daily loss limit"
          accent={competition.riskLimits?.enabled ? "ended" : undefined}
          value={`${competition.riskLimits?.dailyLossLimitPercent || 20}%`}
        />
        {competition.riskLimits?.equityCheckEnabled && (
          <NeonRow
            label="Equity drawdown"
            accent="score"
            value={`${competition.riskLimits?.equityDrawdownPercent || 30}%`}
          />
        )}

        <p className="pt-2 text-[11px] uppercase tracking-wider text-gray-500">
          Margin levels
        </p>
        <NeonRow
          label="Liquidation"
          accent="ended"
          value={`${riskSettings.marginLiquidation}%`}
        />
        <NeonRow
          label="Margin call"
          accent="waiting"
          value={`${riskSettings.marginCall}%`}
        />
        <NeonRow
          label="Warning"
          accent="prize"
          value={`${riskSettings.marginWarning}%`}
        />
        <NeonRow
          label="Safe"
          accent="entry"
          value={`${riskSettings.marginSafe}%`}
        />

        {/* The ladder as a bar, which is the one part of the old card that was not a number. */}
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-[#080C18]">
          <div className="bg-rose-500" style={{ width: "20%" }} />
          <div className="bg-orange-500" style={{ width: "20%" }} />
          <div className="bg-amber-400" style={{ width: "20%" }} />
          <div className="bg-emerald-500" style={{ width: "40%" }} />
        </div>
      </div>
    ),
  });

  /* ---------- Disqualification, only when something can actually disqualify ---------- */
  if (
    rules &&
    (rules.minimumTrades > 0 ||
      rules.disqualifyOnLiquidation ||
      rules.minimumWinRate)
  ) {
    sections.push({
      id: "disqualification",
      icon: <IconTile icon={Ban} accent="ended" size="sm" />,
      title: "Disqualification",
      content: (
        <div className="space-y-2">
          {rules.minimumTrades > 0 && (
            <>
              <NeonRow
                label="Minimum trades required"
                accent="waiting"
                value={rules.minimumTrades}
              />
              <NeonNote>
                Complete {rules.minimumTrades} or more trades, or you are
                disqualified.
              </NeonNote>
            </>
          )}
          {rules.disqualifyOnLiquidation && (
            <>
              <NeonRow
                label="Liquidation"
                accent="ended"
                value="Immediate disqualification"
              />
              <NeonNote>
                If your account is liquidated you are out of the competition.
              </NeonNote>
            </>
          )}
          {rules.minimumWinRate > 0 && (
            <>
              <NeonRow
                label="Minimum win rate"
                accent="prize"
                value={`${rules.minimumWinRate}%`}
              />
              <NeonNote>
                A win rate below {rules.minimumWinRate}% is a disqualification.
              </NeonNote>
            </>
          )}
        </div>
      ),
    });
  }

  /* ---------- How prize money is worked out, which used to be a footnote ---------- */
  sections.push({
    id: "prizes",
    icon: <IconTile icon={Trophy} accent="prize" size="sm" />,
    title: "Prizes",
    content: (
      <div className="space-y-2">
        <NeonRow
          label="Prize pool"
          accent="prize"
          value={`${currSymbol}${(
            competition.prizePool ||
            competition.prizePoolCredits ||
            0
          ).toFixed(0)}`}
        />
        <NeonRow
          label="Paid positions"
          value={competition.prizeDistribution?.length ?? 0}
        />
        {competition.platformFeePercentage > 0 && (
          <NeonRow
            label="Platform fee"
            accent="value"
            value={`${competition.platformFeePercentage}%`}
          />
        )}
        <NeonNote>
          Prize amounts are shown net of the platform fee. If a paid position is
          not filled, its share is split equally among the winners who did
          finish.
        </NeonNote>
      </div>
    ),
  });

  return sections;
}
