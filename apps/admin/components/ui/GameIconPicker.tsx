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

/**
 * Build categories dynamically from the GAME_ICONS registry.
 * Icons are grouped by prefix pattern for intuitive browsing.
 */
function buildCategories(): Record<string, string[]> {
  const all = Object.keys(GAME_ICONS) as GameIconName[];
  const cats: Record<string, string[]> = {};
  const assigned = new Set<string>();

  const add = (label: string, filter: (k: string) => boolean) => {
    const matches = all.filter(k => filter(k) && !assigned.has(k));
    if (matches.length > 0) {
      cats[label] = matches;
      matches.forEach(k => assigned.add(k));
    }
  };

  add("Trophies & Awards", k => /^(trophy|goldMedal|champion|victory|starAward|starBadge|shieldAward|certificateAward|graduationAward|scrollAward|award|giftAward|studyAward)/i.test(k));
  add("Stars & Rankings", k => /^(star[0-9]|rank[0-9]|medal|crown)/i.test(k));
  add("Currency & Treasure", k => /^(coin|gems|treasure|chest|pouch|money|capital|pirateCoin)/i.test(k));
  add("Potions & Spells", k => /^(health|energy|lightning|rage|poison|spell|fire|blue|ice)/i.test(k) && !/finance/i.test(k));
  add("Weapons", k => /^(sword|axe|hammer|bow|bomb|piratePistol|pirateCannon|cannon|sw[0-9])/i.test(k));
  add("Defense & Equipment", k => /^(shield[0-9]|helmet|armor|key|banner|flag|crown|map|guide|compass|eyePatch|pirateH|piratesH|piratePeg|barrel|island)/i.test(k));
  add("Characters", k => /^(rookie|lord|archer|war|wolf|animal|parrot)/i.test(k));
  add("Pirate Theme", k => /^(pirate|anchor)/i.test(k));
  add("Gaming Hardware", k => /^(joystick|headset|keyboard|wasd|mic|dashboard)/i.test(k));
  add("Finance", k => /^(dollar|euro|finance|financial|equity|equities|dividend|valuation|inflation|hedge|gain|fluctuation|overPrice|redemption|riskRating|repository|investmentModel|fixIncome|longTerm|returnOf|investStock|investEd|goldInvest|attracting|dollarPlant|retirement|buy|sell|profit|loss|trade|investment|portfolio)/i.test(k));
  add("Risk & Status", k => /^(warning|risk|market[RM]|operational|external|system|internal|qualitative|quantitative|impact|target|timer|skull|crisis)/i.test(k));
  add("Rewards & Misc", k => /^(reward|heart|dream|meat|medKit|notification|settings|help|profile|marketplace|num[0-9])/i.test(k));
  add("Renders & Art", k => /^(render|icon00)/i.test(k));
  add("Game Collections", k => /^(game)/i.test(k));
  add("Technology", k => /^(tech)/i.test(k));
  add("Seasonal: Christmas", k => /^christmas/i.test(k));
  add("Seasonal: Halloween", k => /^halloween/i.test(k));
  add("Seasonal: Black Friday", k => /^blackFriday/i.test(k));
  add("Seasonal: Cyber", k => /^cyber/i.test(k));
  add("School & Education", k => /^school/i.test(k));
  add("Marketing", k => /^marketing/i.test(k));
  add("Badge Prototypes", k => /^(round|shield)Proto/i.test(k));

  // Catch anything not yet categorized
  const uncategorized = all.filter(k => !assigned.has(k));
  if (uncategorized.length > 0) {
    cats["Other"] = uncategorized;
  }

  return cats;
}

const ICON_CATEGORIES = buildCategories();

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
