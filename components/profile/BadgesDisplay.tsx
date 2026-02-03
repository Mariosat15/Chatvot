"use client";

import { useState } from "react";
import { Badge, BadgeCategory } from "@/lib/constants/badges";
import { Lock, Sparkles } from "lucide-react";
import { GameIcon } from "@/components/ui/GameIcon";
import type { GameIconName } from "@/lib/constants/game-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BadgesDisplayProps {
  badges: (Badge & { earned: boolean; earnedAt?: Date })[];
  stats: {
    totalBadges: number;
    earnedCount: number;
    percentage: number;
    rarityCount: {
      common: number;
      rare: number;
      epic: number;
      legendary: number;
    };
    categoryCount: Record<BadgeCategory, number>;
  };
}

const CATEGORIES: BadgeCategory[] = [
  "Competition",
  "Trading",
  "Profit",
  "Risk",
  "Speed",
  "Consistency",
  "Volume",
  "Strategy",
  "Social",
  "Legendary",
];

export default function BadgesDisplay({ badges, stats }: BadgesDisplayProps) {
  const [selectedCategory, setSelectedCategory] = useState<
    BadgeCategory | "All"
  >("All");
  const [selectedRarity, setSelectedRarity] = useState<Badge["rarity"] | "All">(
    "All",
  );

  // Filter badges
  const filteredBadges = badges.filter((badge) => {
    if (selectedCategory !== "All" && badge.category !== selectedCategory)
      return false;
    if (selectedRarity !== "All" && badge.rarity !== selectedRarity)
      return false;
    return true;
  });

  const getRarityColor = (rarity: Badge["rarity"]) => {
    switch (rarity) {
      case "common":
        return "bg-gray-500/40 text-gray-100 border-gray-400 shadow-lg shadow-gray-500/30";
      case "rare":
        return "bg-blue-500/40 text-blue-100 border-blue-400 shadow-lg shadow-blue-500/50";
      case "epic":
        return "bg-purple-500/40 text-purple-100 border-purple-400 shadow-lg shadow-purple-500/50";
      case "legendary":
        return "bg-gradient-to-br from-yellow-400/50 to-amber-500/50 text-yellow-50 border-yellow-300 shadow-xl shadow-yellow-500/60";
    }
  };

  const getRarityIcon = (rarity: Badge["rarity"]) => {
    switch (rarity) {
      case "common":
        return <GameIcon name="star1" size={14} />;
      case "rare":
        return <GameIcon name="star2" size={14} />;
      case "epic":
        return <Sparkles className="h-3 w-3" />;
      case "legendary":
        return <GameIcon name="crown" size={14} />;
    }
  };

  const getCategoryIcon = (
    category: BadgeCategory,
    iconSize: number = 32,
  ) => {
    switch (category) {
      case "Competition":
        return <GameIcon name="trophy" size={iconSize} />;
      case "Trading":
        return <GameIcon name="profit" size={iconSize} />;
      case "Profit":
        return <GameIcon name="coin" size={iconSize} />;
      case "Risk":
        return <GameIcon name="shield1" size={iconSize} />;
      case "Speed":
        return <GameIcon name="blueFireSpell" size={iconSize} />;
      case "Consistency":
        return <GameIcon name="target" size={iconSize} />;
      case "Volume":
        return <GameIcon name="capital" size={iconSize} />;
      case "Strategy":
        return <GameIcon name="guideBook" size={iconSize} />;
      case "Social":
        return <GameIcon name="animal1" size={iconSize} />;
      case "Legendary":
        return <GameIcon name="crown" size={iconSize} />;
      default:
        return <GameIcon name="starAward" size={iconSize} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-primary-600/30 to-primary-700/30 rounded-xl p-4 border-2 border-primary-500 shadow-lg">
          <p className="text-sm text-primary-200 mb-1 font-semibold">
            Total Earned
          </p>
          <p className="text-3xl font-bold text-white tabular-nums">
            {stats.earnedCount}
          </p>
          <p className="text-xs text-primary-300 mt-1 font-medium">
            of {stats.totalBadges} ({stats.percentage.toFixed(0)}%)
          </p>
        </div>

        <div className="bg-gradient-to-br from-gray-600/30 to-gray-700/30 rounded-xl p-4 border-2 border-gray-400 shadow-lg">
          <p className="text-sm text-gray-200 mb-1 font-semibold">Common</p>
          <p className="text-3xl font-bold text-white tabular-nums">
            {stats.rarityCount.common}
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-600/30 to-blue-700/30 rounded-xl p-4 border-2 border-blue-400 shadow-lg">
          <p className="text-sm text-blue-200 mb-1 font-semibold">Rare</p>
          <p className="text-3xl font-bold text-white tabular-nums">
            {stats.rarityCount.rare}
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-600/30 to-purple-700/30 rounded-xl p-4 border-2 border-purple-400 shadow-lg">
          <p className="text-sm text-purple-200 mb-1 font-semibold">Epic</p>
          <p className="text-3xl font-bold text-white tabular-nums">
            {stats.rarityCount.epic}
          </p>
        </div>

        <div className="col-span-2 md:col-span-4 bg-gradient-to-r from-yellow-500/30 to-amber-500/30 rounded-xl p-4 border-2 border-yellow-400 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GameIcon name="crown" size={32} />
              <div>
                <p className="text-sm text-yellow-100 mb-1 font-semibold">
                  Legendary
                </p>
                <p className="text-4xl font-bold text-white tabular-nums">
                  {stats.rarityCount.legendary}
                </p>
              </div>
            </div>
            <p className="text-xs text-yellow-100 font-medium">
              ⚡ The rarest achievements
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Category Filter */}
        <div className="flex-1">
          <p className="text-sm text-gray-200 mb-2 font-semibold">
            Filter by Category
          </p>
          <Select
            value={selectedCategory}
            onValueChange={(value) =>
              setSelectedCategory(value as BadgeCategory | "All")
            }
          >
            <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="All" className="text-white">
                All Categories
              </SelectItem>
              {CATEGORIES.map((category) => (
                <SelectItem
                  key={category}
                  value={category}
                  className="text-white"
                >
                  {category} ({stats.categoryCount[category]} earned)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Rarity Filter */}
        <div className="w-full md:w-64">
          <p className="text-sm text-gray-200 mb-2 font-semibold">
            Filter by Rarity
          </p>
          <Select
            value={selectedRarity}
            onValueChange={(value) =>
              setSelectedRarity(value as Badge["rarity"] | "All")
            }
          >
            <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Select rarity" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="All" className="text-white">
                All Rarities
              </SelectItem>
              <SelectItem value="common" className="text-gray-300">
                Common
              </SelectItem>
              <SelectItem value="rare" className="text-blue-400">
                Rare
              </SelectItem>
              <SelectItem value="epic" className="text-purple-400">
                Epic
              </SelectItem>
              <SelectItem value="legendary" className="text-yellow-400">
                Legendary
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredBadges.map((badge) => (
          <div
            key={badge.id}
            className={`relative group rounded-xl p-4 border-2 transition-all ${
              badge.earned
                ? `${getRarityColor(badge.rarity)} hover:scale-105 hover:brightness-110`
                : "bg-gray-800/60 border-gray-600 hover:bg-gray-700/60"
            }`}
          >
            {/* Locked Overlay */}
            {!badge.earned && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/70 rounded-xl">
                <Lock className="h-8 w-8 text-gray-500" />
              </div>
            )}

            {/* Badge Content */}
            <div className="flex flex-col items-center text-center space-y-2">
              {/* Icon - Using unique badge icon */}
              <div
                className={`p-4 rounded-full flex items-center justify-center ${
                  badge.earned
                    ? getRarityColor(badge.rarity)
                    : "bg-gray-700/50 border border-gray-600"
                } ${badge.earned ? "" : "opacity-50 grayscale"}`}
              >
                <GameIcon name={badge.icon as GameIconName} size={40} />
              </div>

              {/* Name */}
              <p
                className={`text-sm font-bold ${badge.earned ? "text-white" : "text-gray-400"}`}
              >
                {badge.name}
              </p>

              {/* Description */}
              <p
                className={`text-xs font-medium ${badge.earned ? "text-gray-200" : "text-gray-500"}`}
              >
                {badge.description}
              </p>

              {/* Rarity Badge */}
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                  badge.earned
                    ? getRarityColor(badge.rarity)
                    : "bg-gray-700 text-gray-400 border border-gray-600"
                }`}
              >
                {getRarityIcon(badge.rarity)}
                <span className="uppercase">{badge.rarity}</span>
              </div>

              {/* Earned Date */}
              {badge.earned && badge.earnedAt && (
                <p className="text-xs text-gray-300 font-medium">
                  {new Date(badge.earnedAt).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Category Label */}
            <div className="absolute top-2 right-2">
              <span
                className={`text-xs px-2 py-1 rounded font-semibold ${
                  badge.earned
                    ? "bg-black/60 text-white"
                    : "bg-gray-800/80 text-gray-500"
                }`}
              >
                {badge.category}
              </span>
            </div>
          </div>
        ))}
      </div>

      {filteredBadges.length === 0 && (
        <div className="text-center py-12">
          <Lock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-200 text-lg font-semibold">
            No badges match your filters
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Try selecting a different category or rarity
          </p>
        </div>
      )}
    </div>
  );
}
