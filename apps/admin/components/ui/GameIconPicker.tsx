"use client";

import { useState, useMemo } from "react";
import { GameIcon } from "@/components/ui/GameIcon";
import { GAME_ICONS, type GameIconName } from "@/lib/constants/game-icons";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface GameIconPickerProps {
  /** Currently selected icon name */
  value: string;
  /** Callback when icon is selected */
  onChange: (iconName: GameIconName) => void;
  /** Size of icons in the picker (default: 40) */
  iconSize?: number;
  /** Additional CSS classes for the container */
  className?: string;
  /** Max height for scrollable area */
  maxHeight?: string;
}

// Group icons by category for easier navigation
const ICON_CATEGORIES = {
  "Trophies & Awards": [
    "trophy", "trophyStar", "trophyGame", "trophyFootball",
    "goldMedal", "champion", "victory", "award",
    "starAward", "starBadge", "shieldAward", "certificateAward",
    "graduationAward", "scrollAward", "giftAward", "studyAward"
  ],
  "Stars & Rankings": [
    "star1", "star2", "star3", "rank1", "rank2", "rank3",
    "rank4", "rank5", "rank6", "rank7", "crown"
  ],
  "Currency & Treasure": [
    "coin", "coins", "gems", "gemsAlt", "treasure", "chest",
    "chest1", "chest2", "chest3", "chest4", "pouch1", "pouch2",
    "money", "moneyDeposit", "moneyBalance", "capital"
  ],
  "Finance": [
    "profit", "loss", "trade", "investment", "portfolio",
    "buy", "sell", "equity", "dividend", "valuation",
    "inflation", "hedge", "gain", "fluctuation", "longTermInvestment",
    "returnOfInvest", "investStock", "dollarPlant", "financialCalculation"
  ],
  "Weapons": [
    "sword", "sword1", "sword2", "sword3", "sword4", "sword5", "sword6",
    "swordKnight3D", "swordNumbered", "axe1", "axe2", "axe3", "axe4",
    "axe3D", "axeNumbered", "hammer1", "hammer2", "hammer3", "hammer3D",
    "bow3D", "bomb1", "bomb2", "bombNumbered"
  ],
  "Defense & Equipment": [
    "shield1", "shield2", "shield3", "shield4", "magicShield3D",
    "helmet1", "helmet2", "helmet3", "helmet4",
    "armor1", "armor2", "key", "banner", "flag", "maps", "guideBook"
  ],
  "Potions & Spells": [
    "healthPotion", "energyPotion", "lightningPotion", "ragePotion", "poisonPotion",
    "fireSpell", "blueFireSpell", "iceSpell", "energySpell", "lightningSpell",
    "healthSpell", "poisonSpell", "spellBrown", "spellGreen"
  ],
  "Characters": [
    "rookie", "lord", "archer", "war",
    "wolf1", "wolf2", "wolf3",
    "animal1", "animal2", "animal3", "animal4", "animal5"
  ],
  "Status & Alerts": [
    "warning", "warning2", "warning3",
    "riskWarning", "riskManagement", "riskAnalysis", "riskControl", "riskMonitoring",
    "target", "timer", "timerAlt", "skull", "crisisRecovery"
  ],
  "Gaming Hardware": [
    "joystick1", "joystick2", "joystick3",
    "headset", "keyboard", "wasd", "mic", "dashboard"
  ],
  "Rewards & Misc": [
    "reward1", "reward2", "reward3", "reward4", "reward5",
    "heart", "dream", "meat", "medKit1", "medKit2",
    "notifications", "settings", "help", "profile", "marketplace"
  ]
} as const;

// Get all icon names
const ALL_ICON_NAMES = Object.keys(GAME_ICONS) as GameIconName[];

export function GameIconPicker({
  value,
  onChange,
  iconSize = 40,
  className,
  maxHeight = "400px"
}: GameIconPickerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Filter icons based on search
  const filteredIcons = useMemo(() => {
    if (!searchTerm) {
      if (activeCategory && ICON_CATEGORIES[activeCategory as keyof typeof ICON_CATEGORIES]) {
        return ICON_CATEGORIES[activeCategory as keyof typeof ICON_CATEGORIES].filter(
          (name) => name in GAME_ICONS
        ) as GameIconName[];
      }
      return ALL_ICON_NAMES;
    }
    
    const term = searchTerm.toLowerCase();
    return ALL_ICON_NAMES.filter(name => 
      name.toLowerCase().includes(term)
    );
  }, [searchTerm, activeCategory]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search icons..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium transition-colors",
            !activeCategory
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          All ({ALL_ICON_NAMES.length})
        </button>
        {Object.entries(ICON_CATEGORIES).map(([category, icons]) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors",
              activeCategory === category
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            {category} ({icons.filter(name => name in GAME_ICONS).length})
          </button>
        ))}
      </div>

      {/* Icon Grid */}
      <div 
        className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-14 gap-1 bg-muted/50 rounded-lg p-3 overflow-y-auto"
        style={{ maxHeight }}
      >
        {filteredIcons.map((iconName) => (
          <button
            key={iconName}
            type="button"
            onClick={() => onChange(iconName)}
            className={cn(
              "flex items-center justify-center p-2 rounded-lg transition-all hover:bg-background hover:scale-110",
              value === iconName && "bg-primary/20 ring-2 ring-primary"
            )}
            title={iconName}
          >
            <GameIcon name={iconName} size={iconSize} />
          </button>
        ))}
        {filteredIcons.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No icons found matching &quot;{searchTerm}&quot;
          </div>
        )}
      </div>

      {/* Selected Icon Info */}
      {value && (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <GameIcon name={value as GameIconName} size={48} />
          <div>
            <p className="font-semibold">Selected: {value}</p>
            <p className="text-xs text-muted-foreground">
              Click another icon to change selection
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameIconPicker;
