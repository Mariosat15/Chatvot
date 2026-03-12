"use client";

import { useState } from "react";
import * as LucideAll from "lucide-react";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GameIconPicker } from "@/components/ui/GameIconPicker";
import { GameIcon } from "@/components/ui/GameIcon";
import {
  type GameIconName,
  GAME_ICONS,
  getGameIconPath,
} from "@/lib/constants/game-icons";

// ─── Lucide Icon Options ────────────────────────────────────────────────────
// Reason: Curated list of icons relevant to a trading/gaming platform.
// Using a static array for performance rather than iterating all Lucide icons.

export const LUCIDE_ICON_OPTIONS: { name: string; label: string }[] = [
  { name: "Zap", label: "Zap" },
  { name: "Trophy", label: "Trophy" },
  { name: "Star", label: "Star" },
  { name: "Shield", label: "Shield" },
  { name: "Target", label: "Target" },
  { name: "Award", label: "Award" },
  { name: "Crown", label: "Crown" },
  { name: "Flame", label: "Flame" },
  { name: "Rocket", label: "Rocket" },
  { name: "TrendingUp", label: "Trending Up" },
  { name: "BarChart3", label: "Bar Chart" },
  { name: "Users", label: "Users" },
  { name: "Globe", label: "Globe" },
  { name: "Clock", label: "Clock" },
  { name: "DollarSign", label: "Dollar" },
  { name: "Lock", label: "Lock" },
  { name: "Sparkles", label: "Sparkles" },
  { name: "Gift", label: "Gift" },
  { name: "Medal", label: "Medal" },
  { name: "Brain", label: "Brain" },
  { name: "Lightbulb", label: "Lightbulb" },
  { name: "Gauge", label: "Gauge" },
  { name: "Gem", label: "Gem" },
  { name: "Eye", label: "Eye" },
  { name: "Heart", label: "Heart" },
  { name: "Coins", label: "Coins" },
  { name: "Wallet", label: "Wallet" },
  { name: "UserPlus", label: "User Plus" },
  { name: "CheckCircle", label: "Check" },
  { name: "Activity", label: "Activity" },
  { name: "Swords", label: "Swords" },
  { name: "Gamepad2", label: "Gamepad" },
  { name: "Banknote", label: "Banknote" },
  { name: "LineChart", label: "Line Chart" },
  { name: "ShoppingBag", label: "Shopping" },
  { name: "Map", label: "Map" },
  { name: "HelpCircle", label: "Help" },
  { name: "MessageSquare", label: "Message" },
];

// ─── Lucide Preview (renders any Lucide icon by name) ────────────────────────

const lucideMap = new Map(
  Object.entries(
    LucideAll as Record<
      string,
      React.FC<{ className?: string; size?: number }>
    >,
  ),
);

export function LucidePreview({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  const Icon = lucideMap.get(name);
  if (!Icon)
    return <span className="text-[10px] text-gray-500">{name}</span>;
  return <Icon size={size} />;
}

// ─── IconPickerField ────────────────────────────────────────────────────────
// Reason: Shared visual icon picker supporting both Lucide SVG icons and
// game PNG icons. Used across Hero Page editors and Enterprise Page editors.

interface IconPickerFieldProps {
  value: string;
  onChange: (val: string) => void;
  /** Optional label text (default: "Icon") */
  label?: string;
  /** Compact mode: smaller height for inline use */
  compact?: boolean;
}

export default function IconPickerField({
  value,
  onChange,
  label = "Icon",
  compact = false,
}: IconPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"lucide" | "game">(
    value?.startsWith("/game-icons/") || value?.startsWith("/assets/")
      ? "game"
      : "lucide",
  );

  // Derive the GameIconName from a path like "/game-icons/skull.png"
  const currentGameIconName = (() => {
    if (!value?.startsWith("/game-icons/")) return "";
    for (const [iconName, path] of Object.entries(GAME_ICONS)) {
      if (value === path || value === String(path)) return iconName;
    }
    return "";
  })();

  return (
    <div>
      {label && (
        <Label className="text-gray-500 text-[10px] mb-0.5 block">
          {label}
        </Label>
      )}
      {/* Selected icon preview + toggle button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-3 ${compact ? "py-1.5" : "py-2"} bg-gray-800 border border-gray-700 rounded-md hover:border-gray-600 transition-colors text-left`}
      >
        {value ? (
          <>
            <div className="w-7 h-7 rounded-md bg-gray-700 flex items-center justify-center shrink-0">
              {value.startsWith("/game-icons/") ||
              value.startsWith("/assets/") ? (
                currentGameIconName ? (
                  <GameIcon
                    name={currentGameIconName as GameIconName}
                    size={20}
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={value}
                    alt=""
                    width={20}
                    height={20}
                    className="object-contain"
                  />
                )
              ) : (
                <LucidePreview name={value} size={18} />
              )}
            </div>
            <span className="text-xs text-gray-300 truncate flex-1">
              {value}
            </span>
          </>
        ) : (
          <span className="text-xs text-gray-500">Select icon…</span>
        )}
        {open ? (
          <ChevronUp className="h-3 w-3 text-gray-500 shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 text-gray-500 shrink-0" />
        )}
      </button>

      {/* Dropdown picker */}
      {open && (
        <div className="mt-1 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-xl z-50">
          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            <button
              type="button"
              onClick={() => setTab("lucide")}
              className={`flex-1 text-xs py-2 font-medium transition-colors ${tab === "lucide" ? "text-violet-400 bg-violet-500/10 border-b-2 border-violet-500" : "text-gray-500 hover:text-gray-300"}`}
            >
              Lucide Icons
            </button>
            <button
              type="button"
              onClick={() => setTab("game")}
              className={`flex-1 text-xs py-2 font-medium transition-colors ${tab === "game" ? "text-emerald-400 bg-emerald-500/10 border-b-2 border-emerald-500" : "text-gray-500 hover:text-gray-300"}`}
            >
              Game Icons
            </button>
          </div>

          {tab === "lucide" ? (
            <div className="grid grid-cols-6 gap-1 p-2 max-h-[200px] overflow-y-auto">
              {LUCIDE_ICON_OPTIONS.map((opt) => (
                <button
                  key={opt.name}
                  type="button"
                  title={opt.label}
                  onClick={() => {
                    onChange(opt.name);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-center p-2 rounded-lg transition-all hover:bg-gray-700 ${value === opt.name ? "bg-violet-500/20 ring-1 ring-violet-500" : ""}`}
                >
                  <LucidePreview name={opt.name} size={20} />
                </button>
              ))}
            </div>
          ) : (
            <div className="max-h-[300px] overflow-hidden">
              <GameIconPicker
                value={currentGameIconName}
                onChange={(iconName) => {
                  // Reason: Use Map lookup to avoid ESLint object-injection-sink warning
                  const gameIconsMap = new Map(Object.entries(GAME_ICONS));
                  const rawPath =
                    gameIconsMap.get(iconName) || getGameIconPath(iconName);
                  onChange(String(rawPath));
                  setOpen(false);
                }}
                iconSize={32}
                maxHeight="250px"
              />
            </div>
          )}

          {/* Clear button */}
          <div className="flex items-center gap-2 p-2 border-t border-gray-800">
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-xs text-red-400 hover:text-red-300 h-7"
              >
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
