"use client";

import {
  Crown, Users, Map, ShoppingBag, HelpCircle, BarChart3, Trophy,
  Activity, MessageSquare, Shield, ChevronUp, ChevronDown, GripVertical,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SectionVisibilitySettings {
  gameMasterEnabled: boolean;
  competitionTypesEnabled: boolean;
  journeyBadgesEnabled: boolean;
  marketplaceEnabled: boolean;
  faqEnabled: boolean;
  liveStatsEnabled: boolean;
  leaderboardEnabled: boolean;
  activityFeedEnabled: boolean;
  testimonialsEnabled: boolean;
  trustBadgesEnabled: boolean;
}

interface NewSectionEditorsProps {
  settings: SectionVisibilitySettings;
  onToggle: (key: keyof SectionVisibilitySettings, value: boolean) => void;
}

// ─── Section Definitions ─────────────────────────────────────────────────────

const NEW_SECTIONS: Array<{
  key: keyof SectionVisibilitySettings;
  label: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
}> = [
  {
    key: "liveStatsEnabled",
    label: "Live Stats Bar",
    description: "Real-time ticker showing live competitions, challenges, and active traders.",
    icon: BarChart3,
    iconColor: "text-blue-400",
  },
  {
    key: "gameMasterEnabled",
    label: "Game Master Program",
    description: "Showcase the GM referral program, earnings, and benefits.",
    icon: Crown,
    iconColor: "text-yellow-400",
  },
  {
    key: "competitionTypesEnabled",
    label: "Competition Types",
    description: "Display different competition formats (PnL, ROI, Win Rate, etc.).",
    icon: Trophy,
    iconColor: "text-orange-400",
  },
  {
    key: "journeyBadgesEnabled",
    label: "Journey & Badges",
    description: "Showcase the progression system, milestones, zones, and collectible badges.",
    icon: Map,
    iconColor: "text-emerald-400",
  },
  {
    key: "marketplaceEnabled",
    label: "Marketplace",
    description: "Display marketplace items, strategies, and trading tools available for purchase.",
    icon: ShoppingBag,
    iconColor: "text-pink-400",
  },
  {
    key: "leaderboardEnabled",
    label: "Leaderboard Preview",
    description: "Show top traders and recent competition winners.",
    icon: Users,
    iconColor: "text-cyan-400",
  },
  {
    key: "activityFeedEnabled",
    label: "Activity Feed",
    description: "Live stream of recent trades, competitions joined, and challenges completed.",
    icon: Activity,
    iconColor: "text-green-400",
  },
  {
    key: "testimonialsEnabled",
    label: "Testimonials",
    description: "User testimonials and success stories.",
    icon: MessageSquare,
    iconColor: "text-purple-400",
  },
  {
    key: "trustBadgesEnabled",
    label: "Trust Badges",
    description: "Security badges, compliance logos, and trust indicators.",
    icon: Shield,
    iconColor: "text-teal-400",
  },
  {
    key: "faqEnabled",
    label: "FAQ Section",
    description: "Frequently asked questions with expandable answers.",
    icon: HelpCircle,
    iconColor: "text-amber-400",
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function NewSectionEditors({
  settings,
  onToggle,
}: NewSectionEditorsProps) {
  return (
    <>
      {NEW_SECTIONS.map((section) => {
        const Icon = section.icon;
        const isEnabled = settings[section.key];
        return (
          <AccordionItem
            key={section.key}
            value={section.key}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${isEnabled ? "bg-green-500" : "bg-gray-500"}`}
                />
                <Icon className={`h-5 w-5 ${section.iconColor}`} />
                <span className="font-semibold text-white">
                  {section.label}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-gray-700">
                <div>
                  <Label className="text-gray-300">
                    Enable {section.label}
                  </Label>
                  <p className="text-xs text-gray-500 mt-1">
                    {section.description}
                  </p>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(v) => onToggle(section.key, v)}
                />
              </div>
              <p className="text-sm text-gray-400">
                💡 Content for this section is auto-generated from your platform
                data and theme settings. Toggle visibility above.
              </p>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </>
  );
}

// ─── Section Order Editor ────────────────────────────────────────────────────

const ALL_SECTION_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  hero: { label: "Hero", icon: BarChart3 },
  stats: { label: "Stats Counter", icon: BarChart3 },
  features: { label: "Features Grid", icon: Shield },
  howItWorks: { label: "How It Works", icon: Map },
  competitions: { label: "Live Competitions", icon: Trophy },
  challenges: { label: "Live Challenges", icon: Users },
  gameMaster: { label: "Game Master", icon: Crown },
  competitionTypes: { label: "Competition Types", icon: Trophy },
  journeyBadges: { label: "Journey & Badges", icon: Map },
  marketplace: { label: "Marketplace", icon: ShoppingBag },
  liveStats: { label: "Live Stats Bar", icon: BarChart3 },
  leaderboard: { label: "Leaderboard", icon: Users },
  activityFeed: { label: "Activity Feed", icon: Activity },
  testimonials: { label: "Testimonials", icon: MessageSquare },
  trustBadges: { label: "Trust Badges", icon: Shield },
  faq: { label: "FAQ", icon: HelpCircle },
  cta: { label: "Final CTA", icon: Activity },
  footer: { label: "Footer", icon: Shield },
};

interface SectionOrderEditorProps {
  order: string[];
  onOrderChange: (newOrder: string[]) => void;
}

export function SectionOrderEditor({ order, onOrderChange }: SectionOrderEditorProps) {
  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...order];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    onOrderChange(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === order.length - 1) return;
    const newOrder = [...order];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    onOrderChange(newOrder);
  };

  return (
    <div className="space-y-2">
      <Label className="text-gray-300 text-sm font-semibold">
        Section Display Order
      </Label>
      <p className="text-xs text-gray-500 mb-3">
        Drag sections to reorder how they appear on the landing page.
      </p>
      <div className="space-y-1">
        {order.map((sectionKey, index) => {
          const info = ALL_SECTION_LABELS[sectionKey];
          if (!info) return null;
          const Icon = info.icon;
          return (
            <div
              key={sectionKey}
              className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2"
            >
              <GripVertical className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-300 flex-1">
                {info.label}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className="h-6 w-6 p-0"
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveDown(index)}
                  disabled={index === order.length - 1}
                  className="h-6 w-6 p-0"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
