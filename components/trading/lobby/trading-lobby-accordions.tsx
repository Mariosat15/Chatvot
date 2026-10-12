import {
  CalendarX,
  Clock,
  Gauge,
  Layers,
  ListChecks,
  Percent,
  Scale,
  ShieldCheck,
  TrendingDown,
  Trophy,
  Wallet,
} from "lucide-react";
import type { NeonAccordionSection } from "@/components/neon/Accordion";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import { storedLeverageCeiling } from "@/lib/services/trading/competition-leverage";
import {
  MarginLadder,
  RuleBadge,
  RuleCard,
  RuleInfo,
  RuleRow,
  RuleWarning,
} from "./TradingRuleCard";
import {
  ASSET_LABELS,
  RANKING_EXPLANATIONS,
  RANKING_LABELS,
} from "./trading-lobby-labels";

/**
 * The reference sections in the trading lobby's tab bar: Eligible Assets, Trading Rules and
 * Risk Management. Scoring and Disqualification were their own sections until 12 Oct 2026 and
 * now sit inside Trading Rules as cards of their own (owner instruction). Prizes was a fourth
 * section until the same day and was removed from the tabs at the owner's request: the prize
 * distribution panel in the sidebar already shows the pool, the paid places, the fee and the
 * unfilled-share rule, so the tab only repeated it.
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

const TIE_BREAKER_LABELS = new Map<string, string>([
  ["trades_count", "Most Trades"],
  ["win_rate", "Higher Win Rate"],
  ["total_capital", "Higher Capital"],
  ["roi", "Higher ROI"],
  ["join_time", "First to Join"],
  ["split_prize", "Split Prize"],
]);

const TIE_BREAKER_EXPLANATIONS = new Map<string, string>([
  ["trades_count", "whoever made more trades wins."],
  ["win_rate", "whoever won more of their trades wins."],
  ["total_capital", "whoever has more money wins."],
  ["roi", "whoever grew their money by a bigger % wins."],
  ["join_time", "whoever joined first wins."],
  ["split_prize", "you share the prize equally."],
]);

const COMPETITION_TYPE_LABELS = new Map<string, string>([
  ["time_based", "Time-based"],
  ["goal_based", "Goal-based"],
  ["hybrid", "Hybrid"],
]);

/** The small Menuitems picture each tab button carries (R39: an element, never a component). */
function tabIcon(slug: string) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed local icon art
    <img
      src={NEON_ICON(slug)}
      alt=""
      draggable={false}
      className="h-5 w-5 shrink-0 object-contain"
    />
  );
}

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
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  riskSettings: RiskSettings;
  /**
   * `AppSettings.credits.symbol`. Read by the Prizes section, which left the tabs on
   * 12 Oct 2026; still accepted so the page's call is unchanged.
   */
  creditSymbol?: string;
}): NeonAccordionSection[] {
  const sections: NeonAccordionSection[] = [];
  const rules = competition.rules;
  const assets: string[] = competition.assetClasses ?? [];

  /* ---------- Eligible assets and the account a trader is given ---------- */
  sections.push({
    id: "eligible-assets",
    icon: tabIcon("candles"),
    title: "Eligible Assets",
    content: (
      <div className="w-full">
        <RuleCard
          iconSrc={NEON_ICON("candles")}
          accent="sky"
          title="Eligible Assets"
          subtitle="What you can trade and what you start with."
          badge={
            assets.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1.5">
                {assets.map((asset) => (
                  <RuleBadge key={asset}>
                    {ASSET_LABELS.get(asset) ?? asset}
                  </RuleBadge>
                ))}
              </div>
            )
          }
        >
          <RuleRow
            icon={Wallet}
            label="Practice cash"
            tone="cyan"
            value={`$${(
              competition.startingCapital ||
              competition.startingTradingPoints ||
              0
            ).toLocaleString()}`}
          />
          <RuleRow
            icon={Gauge}
            label="Leverage"
            /* Competition-specific leverage, never the platform-wide setting - carried over. */
            value={
              competition.leverage?.enabled
                ? `1:${competition.leverage.min} to 1:${competition.leverage.max}`
                : `1:${storedLeverageCeiling(competition.leverage) ?? riskSettings.maxLeverage}`
            }
          />
          <RuleRow
            icon={Layers}
            label="Max open positions"
            value={competition.maxOpenPositions || 10}
          />
          <RuleRow
            icon={Percent}
            label="Max position size"
            value={`${competition.maxPositionSize || 100}%`}
          />
        </RuleCard>
      </div>
    ),
  });

  /*
   * ---------- Trading rules, scoring and disqualification, as ONE tab ----------
   *
   * Three sections until 12 Oct 2026, when the owner asked for them combined; since the
   * owner's second reference the same day each is its own card inside the one tab. Every row,
   * note, fallback and condition below is the old sections' own. The two minimum rows the old
   * "Trading Rules" carried live only in the disqualification card, which shows them under
   * exactly the same condition, so neither threshold is stated twice.
   */
  const hasDisqualification =
    rules &&
    (rules.minimumTrades > 0 ||
      rules.disqualifyOnLiquidation ||
      rules.minimumWinRate);

  sections.push({
    id: "trading-rules",
    icon: tabIcon("swords"),
    title: "Trading Rules",
    content: (
      <div className="grid items-start gap-4 xl:grid-cols-2 xl:[&>*:last-child:nth-child(odd)]:col-span-2">
        <RuleCard
          iconSrc={NEON_ICON("swords")}
          accent="violet"
          title="Trading Rules"
          subtitle="How the game works."
        >
          <RuleRow
            icon={Clock}
            label="Format"
            tone="cyan"
            value={
              COMPETITION_TYPE_LABELS.get(competition.competitionType) ??
              "Time-based"
            }
          />
          <RuleInfo>
            Trade from the competition screen. Only trades made while the clock
            is running count!
          </RuleInfo>
        </RuleCard>

        {rules && (
          <RuleCard
            iconSrc={NEON_ICON("target-purple")}
            accent="sky"
            title="Scoring"
            subtitle="How you win."
          >
            <RuleRow
              icon={Trophy}
              label="Ranked by"
              tone="yellow"
              value={RANKING_LABELS.get(rules.rankingMethod) ?? "Highest P&L"}
            />
            <RuleInfo>
              {RANKING_EXPLANATIONS.get(rules.rankingMethod) ??
                "Make the most profit to win."}
            </RuleInfo>

            {rules.tieBreaker1 && (
              <>
                <RuleRow
                  icon={Scale}
                  label="If there is a tie"
                  tone="purple"
                  value={
                    TIE_BREAKER_LABELS.get(rules.tieBreaker1) ??
                    rules.tieBreaker1
                  }
                />
                <RuleInfo>
                  Tied?{" "}
                  {TIE_BREAKER_EXPLANATIONS.get(rules.tieBreaker1) ??
                    "this decides it."}
                </RuleInfo>
              </>
            )}

            {rules.tieBreaker2 && (
              <>
                <RuleRow
                  icon={Scale}
                  label="Still tied?"
                  tone="purple"
                  value={
                    TIE_BREAKER_LABELS.get(rules.tieBreaker2) ??
                    rules.tieBreaker2
                  }
                />
                <RuleInfo>
                  Still level?{" "}
                  {TIE_BREAKER_EXPLANATIONS.get(rules.tieBreaker2) ??
                    "this decides it."}
                </RuleInfo>
              </>
            )}
          </RuleCard>
        )}

        {hasDisqualification && (
          <RuleCard
            iconSrc={NEON_ICON("fire")}
            accent="rose"
            title="Disqualification"
            subtitle="Ways to get knocked out. Avoid them!"
          >
            {rules.minimumTrades > 0 && (
              <>
                <RuleRow
                  icon={ListChecks}
                  label="Trades you must make"
                  tone="yellow"
                  value={rules.minimumTrades}
                />
                <RuleInfo>
                  Make at least {rules.minimumTrades} trades or you are out.
                </RuleInfo>
              </>
            )}
            {rules.disqualifyOnLiquidation && (
              <>
                <RuleWarning
                  label="Liquidation"
                  value="You are out right away"
                />
                <RuleInfo>
                  Lose all your money and the game is over for you.
                </RuleInfo>
              </>
            )}
            {rules.minimumWinRate > 0 && (
              <>
                <RuleRow
                  icon={Percent}
                  label="Minimum win rate"
                  tone="orange"
                  value={`${rules.minimumWinRate}%`}
                />
                <RuleInfo>
                  Win fewer than {rules.minimumWinRate}% of your trades and you
                  are out.
                </RuleInfo>
              </>
            )}
          </RuleCard>
        )}
      </div>
    ),
  });

  /* ---------- Risk limits and the margin ladder ---------- */
  const riskOn = !!competition.riskLimits?.enabled;
  sections.push({
    id: "risk-management",
    icon: tabIcon("shield"),
    title: "Risk Management",
    content: (
      <div className="w-full">
        <RuleCard
          iconSrc={NEON_ICON("shield")}
          accent="pink"
          title="Risk Management"
          subtitle="Safety limits that keep you in the game."
        >
          <RuleRow
            icon={ShieldCheck}
            label="Risk limits"
            tone={riskOn ? "red" : "plain"}
            value={riskOn ? "Active" : "Off"}
          />
          <RuleRow
            icon={TrendingDown}
            label="Most you can lose overall"
            tone={riskOn ? "red" : "plain"}
            value={`${competition.riskLimits?.maxDrawdownPercent || 50}%`}
          />
          <RuleRow
            icon={CalendarX}
            label="Most you can lose in a day"
            tone={riskOn ? "red" : "plain"}
            value={`${competition.riskLimits?.dailyLossLimitPercent || 20}%`}
          />
          {competition.riskLimits?.equityCheckEnabled && (
            <RuleRow
              icon={TrendingDown}
              label="Equity drawdown"
              tone="purple"
              value={`${competition.riskLimits?.equityDrawdownPercent || 30}%`}
            />
          )}
          <MarginLadder
            levels={[
              {
                label: "Liquidation",
                value: `${riskSettings.marginLiquidation}%`,
                dot: "bg-rose-500",
                text: "text-rose-400",
              },
              {
                label: "Margin call",
                value: `${riskSettings.marginCall}%`,
                dot: "bg-orange-500",
                text: "text-orange-300",
              },
              {
                label: "Warning",
                value: `${riskSettings.marginWarning}%`,
                dot: "bg-amber-400",
                text: "text-amber-300",
              },
              {
                label: "Safe",
                value: `${riskSettings.marginSafe}%`,
                dot: "bg-emerald-500",
                text: "text-emerald-300",
              },
            ]}
          />
        </RuleCard>
      </div>
    ),
  });

  return sections;
}
