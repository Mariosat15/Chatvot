"use client";

import { Shield, TrendingDown } from "lucide-react";
import {
  GM_EQUITY_DRAWDOWN_MAX_PERCENT,
  GM_EQUITY_DRAWDOWN_MIN_PERCENT,
  gmEquityCheckExplanation,
  resolveGmEquityDrawdownPercent,
} from "@/lib/services/gamemaster/gm-equity-check";

/**
 * The equity check on the Game Master create wizard. Always ticked and never untickable - the
 * route forces it on and clamps the percentage whatever this sends (`gm-equity-check.ts`), so a
 * checkbox that could be cleared would be a control that appears to work and does nothing.
 */
export default function GmEquityCheckPanel({
  percent,
  onPercentChange,
}: {
  percent: number;
  onPercentChange: (percent: number) => void;
}) {
  const shown = resolveGmEquityDrawdownPercent(percent);
  return (
    <div className="p-6 bg-purple-500/10 border border-purple-500/30 rounded-xl">
      <div className="flex items-start gap-3 mb-4">
        <Shield className="h-5 w-5 text-purple-400 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-purple-300">
            Equity Check (Anti-Fraud)
          </h4>
          <p className="text-xs text-gray-400 mt-1">
            {gmEquityCheckExplanation(shown)}
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3 mb-4">
        <input
          type="checkbox"
          id="equityCheckEnabled"
          checked
          disabled
          readOnly
          aria-describedby="equityCheckRequired"
          className="w-4 h-4 rounded border-gray-600 text-purple-500 bg-gray-800 cursor-not-allowed"
        />
        <label
          htmlFor="equityCheckEnabled"
          className="text-sm font-medium text-gray-200"
        >
          Enable Equity-Based Drawdown Check
        </label>
        <span
          id="equityCheckRequired"
          className="text-[11px] font-semibold uppercase tracking-wide text-purple-300 bg-purple-500/20 rounded px-2 py-0.5"
        >
          Required
        </span>
      </div>

      <label
        htmlFor="equityDrawdownPercent"
        className="text-gray-300 flex items-center gap-2 mb-2"
      >
        <TrendingDown className="h-4 w-4 text-purple-400" />
        Max Equity Drawdown % (up to {GM_EQUITY_DRAWDOWN_MAX_PERCENT}%)
      </label>
      <input
        id="equityDrawdownPercent"
        type="number"
        min={GM_EQUITY_DRAWDOWN_MIN_PERCENT}
        max={GM_EQUITY_DRAWDOWN_MAX_PERCENT}
        value={percent}
        onChange={(e) => onPercentChange(Number(e.target.value))}
        onBlur={() => onPercentChange(shown)}
        className="w-full bg-gray-800 border border-gray-600 text-gray-100 h-11 rounded-lg px-4 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />
      <p className="text-xs text-purple-400 mt-1">
        🛡️ Trading pauses when a player&apos;s balance plus open trades drops{" "}
        {shown}% below their starting money
      </p>
      <p className="text-xs text-gray-500 mt-2">
        💡 Tip: lower is stricter. Around 30% catches teamed-up cheaters early
        without bothering honest players having a bad run.
      </p>
    </div>
  );
}
