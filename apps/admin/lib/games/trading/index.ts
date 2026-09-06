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
};
