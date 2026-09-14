"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, Clock, DollarSign, Gamepad2, Target } from "lucide-react";
import ChallengeSettingsFields from "@/components/challenges/ChallengeSettingsFields";
import type { ChallengeGameSelection } from "@/lib/services/games/challenge-game-copy";
import type { ChallengeFormData, ChallengeSettings } from "./types";

interface ChallengeBattleSettingsProps {
  settings: ChallengeSettings | null;
  selection: ChallengeGameSelection;
  formData: ChallengeFormData;
  onChange: (patch: Partial<ChallengeFormData>) => void;
  gameSettings: Record<string, unknown>;
  onGameSettingChange: (name: string, value: unknown) => void;
  disabled: boolean;
}

const DURATION_CHIPS = [15, 30, 60, 120, 240];

/**
 * The left column: what both players pay, how long they have, and the settings of whichever
 * game was picked.
 *
 * The game's own settings are rendered from its declared `settingsFields` and nothing here
 * knows a game code - the same no-developer-needed property the admin contest wizard has.
 */
export default function ChallengeBattleSettings({
  settings,
  selection,
  formData,
  onChange,
  gameSettings,
  onGameSettingChange,
  disabled,
}: ChallengeBattleSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 className="h-4 w-4 text-orange-400" />
        <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
          Battle Settings
        </span>
      </div>

      {/* Entry Fee */}
      <div className="space-y-1.5">
        <Label className="text-gray-300 flex items-center gap-2 text-sm">
          <DollarSign className="h-3.5 w-3.5 text-green-400" />
          Entry Fee (Credits)
        </Label>
        <Input
          type="number"
          min={settings?.minEntryFee || 5}
          max={settings?.maxEntryFee || 1000}
          value={formData.entryFee}
          onChange={(e) =>
            onChange({ entryFee: parseInt(e.target.value) || 0 })
          }
          className="bg-gray-800/60 border-gray-700 text-white h-9"
        />
        <p className="text-[11px] text-gray-500">Both players pay this amount</p>
      </div>

      {/* Duration */}
      <div className="space-y-1.5">
        <Label className="text-gray-300 flex items-center gap-2 text-sm">
          <Clock className="h-3.5 w-3.5 text-blue-400" />
          Duration (Minutes)
        </Label>
        <Input
          type="number"
          min={settings?.minDurationMinutes || 15}
          max={settings?.maxDurationMinutes || 1440}
          value={formData.duration}
          onChange={(e) =>
            onChange({ duration: parseInt(e.target.value) || 60 })
          }
          className="bg-gray-800/60 border-gray-700 text-white h-9"
        />
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {DURATION_CHIPS.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => onChange({ duration: mins })}
              className={`px-2.5 py-1 text-xs rounded-full transition-all ${
                formData.duration === mins
                  ? "bg-blue-500 text-white shadow-md shadow-blue-500/25"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
            >
              {mins < 60 ? `${mins}m` : `${mins / 60}h`}
            </button>
          ))}
        </div>
      </div>

      {/* The chosen game's OWN settings, rendered from its schema - provider only.
          Trading's equivalents are the fields below (capital, ranking method), which
          are the trading module's settings and are not schema-driven. */}
      {selection.type === "provider" && (
        <div className="space-y-1.5 border-t border-gray-800 pt-4">
          <Label className="flex items-center gap-2 text-sm text-gray-300">
            <Gamepad2 className="h-3.5 w-3.5 text-orange-400" />
            {selection.title.displayName} Settings
          </Label>
          <ChallengeSettingsFields
            fields={selection.title.settingsFields}
            values={gameSettings}
            onChange={onGameSettingChange}
            disabled={disabled}
          />
        </div>
      )}

      {/* Starting Capital + Ranking Method - trading only. A provider game has no
          virtual capital (Challenge.startingCapital is conditionally required and
          ChallengeParticipant's capital fields the same way) and no rankingMethod -
          settlement ranks it by score via resolveScoreDirection instead. */}
      {selection.type === "trading" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-gray-300 flex items-center gap-2 text-sm">
              <DollarSign className="h-3.5 w-3.5 text-yellow-400" />
              Starting Capital
            </Label>
            <Input
              type="number"
              min={100}
              value={formData.startingCapital}
              onChange={(e) =>
                onChange({ startingCapital: parseInt(e.target.value) || 100 })
              }
              className="bg-gray-800/60 border-gray-700 text-white h-9"
            />
            <p className="text-[11px] text-gray-500">
              Virtual capital both players start trading with
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-300 flex items-center gap-2 text-sm">
              <Target className="h-3.5 w-3.5 text-purple-400" />
              Ranking Method
            </Label>
            <select
              value={formData.rankingMethod}
              onChange={(e) => onChange({ rankingMethod: e.target.value })}
              className="w-full bg-gray-800/60 border border-gray-700 text-white rounded-md px-3 py-2 text-sm h-9 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/25 transition-colors"
            >
              <option value="pnl">P&L (Profit &amp; Loss)</option>
              <option value="roi">ROI (Return on Investment)</option>
              <option value="total_capital">Total Capital</option>
              <option value="win_rate">Win Rate</option>
              <option value="total_wins">Total Wins</option>
              <option value="profit_factor">Profit Factor</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
}
