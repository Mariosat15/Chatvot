"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Shield, Target, Trophy } from "lucide-react";
import {
  challengeContentSeedNote,
  type ChallengeGameSelection,
} from "@/lib/services/games/challenge-game-copy";
import type { ChallengeFormData } from "./types";

interface ChallengeRulesColumnProps {
  selection: ChallengeGameSelection;
  formData: ChallengeFormData;
  onChange: (patch: Partial<ChallengeFormData>) => void;
}

const TIEBREAKERS = [
  { value: "trades_count", label: "Most Trades" },
  { value: "win_rate", label: "Higher Win Rate" },
  { value: "total_capital", label: "Higher Capital" },
  { value: "roi", label: "Higher ROI" },
  { value: "join_time", label: "First to Join" },
  { value: "split_prize", label: "Split Prize" },
];

/**
 * The right column: how a tie is broken and who fails to qualify.
 *
 * Every control here is trading's. A provider round has no tiebreakers, no trade count and no
 * liquidation - eligibility is `hasResult` at settlement - so the provider branch states the
 * one rule a player does need, which is that both sides get identical content.
 */
export default function ChallengeRulesColumn({
  selection,
  formData,
  onChange,
}: ChallengeRulesColumnProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="h-4 w-4 text-blue-400" />
        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
          Rules &amp; Conditions
        </span>
      </div>

      {selection.type === "trading" ? (
        <>
          {/* Tiebreakers */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label className="text-gray-400 text-xs">Tiebreaker 1</Label>
              <select
                value={formData.tieBreaker1}
                onChange={(e) => onChange({ tieBreaker1: e.target.value })}
                className="w-full bg-gray-800/60 border border-gray-700 text-white rounded-md px-2.5 py-2 text-xs h-9 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-colors"
              >
                {TIEBREAKERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-400 text-xs">
                Tiebreaker 2 (Opt.)
              </Label>
              <select
                value={formData.tieBreaker2}
                onChange={(e) => onChange({ tieBreaker2: e.target.value })}
                className="w-full bg-gray-800/60 border border-gray-700 text-white rounded-md px-2.5 py-2 text-xs h-9 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-colors"
              >
                <option value="">None</option>
                {TIEBREAKERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Minimum Trades */}
          <div className="space-y-1.5">
            <Label className="text-gray-300 flex items-center gap-2 text-sm">
              <Target className="h-3.5 w-3.5 text-red-400" />
              Minimum Trades to Qualify
            </Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={formData.minimumTrades}
              onChange={(e) =>
                onChange({
                  minimumTrades: Math.max(1, parseInt(e.target.value) || 1),
                })
              }
              className="bg-gray-800/60 border-gray-700 text-white h-9"
            />
            <p className="text-[11px] text-gray-500">
              Players must complete at least this many trades or get
              disqualified
            </p>
          </div>

          {/* Disqualify on Liquidation — locked */}
          <div className="flex items-center justify-between bg-gray-800/40 rounded-xl p-3 border border-gray-700/60">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                <span className="text-sm text-gray-300">
                  Liquidation = Auto-Lose
                </span>
                <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-medium shrink-0">
                  LOCKED
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1 pl-5.5">
                Always enabled for 1v1 challenges
              </p>
            </div>
            <div
              className="relative w-10 h-5 rounded-full bg-orange-500/80 cursor-not-allowed shrink-0 ml-3"
              title="Locked for challenges"
            >
              <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full translate-x-5 shadow-sm" />
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-start gap-2.5 bg-gray-800/40 rounded-xl p-3 border border-gray-700/60">
          <Trophy className="h-3.5 w-3.5 text-orange-400 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-400">
            {challengeContentSeedNote(selection)}
          </p>
        </div>
      )}
    </div>
  );
}
