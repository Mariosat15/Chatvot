import type { GameModule } from "../types";
import { TRADING_GAME_TYPE } from "../types";
import { tradingCapabilities, tradingScoring } from "./config";
import { getTradingRankingValue, getTradingTieBreakerValue } from "./scoring";

/**
 * The trading game module.
 *
 * X1 succeeds only if trading behaves IDENTICALLY afterwards, so this is a wrapper around
 * existing behaviour and not a rewrite. At this step it declares only identity,
 * capabilities and scoring direction; the ranking and settle functions move here in the
 * following steps, unchanged, pinned by the golden baseline in
 * `__tests__/services/ranking-regression.test.ts`.
 *
 * Left completely untouched by X1, and this module must never reach into them:
 * `order.actions.ts`, `position.actions.ts`, `liquidation.actions.ts`,
 * `margin-monitor.actions.ts`, `pnl-calculator.service.ts`, `risk-manager.service.ts`,
 * `margin-safety.service.ts`, the `/trade` routes and `components/trading/`.
 */
export const tradingGameModule: GameModule = {
  type: TRADING_GAME_TYPE,
  label: "Trading",
  capabilities: tradingCapabilities,
  scoring: tradingScoring,
  getRankingValue: getTradingRankingValue,
  getTieBreakerValue: getTradingTieBreakerValue,

  /*
    ALWAYS TRUE, AND THAT IS THE ANSWER RATHER THAN A GAP. A trading participant has a
    result the moment they enter: the account is funded, PnL is zero, and a flat account is
    a legitimate last place. `minimumTrades` is the operator's configurable way to say a
    flat account should not be ranked, and it defaults to 0.

    So `totalTrades > 0` here would look like a tightening and would in fact **impose a
    one-trade minimum on every trading contest ever created**, retroactively, with no
    operator choosing it - a change to the trading contract smuggled in under a provider
    fix. X1's promise is that trading behaves identically, and this keeps it. Pinned by two
    tests in `__tests__/services/provider-prize-eligibility.test.ts`, one for the default
    and one for the explicit minimum, because a single test collapses the two behaviours.
  */
  hasResult: () => true,
};
