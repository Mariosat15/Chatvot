"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Lock, Sparkles, Trophy, Shield, Zap, TrendingUp, Target, Clock } from "lucide-react";
import { GameIcon } from "@/components/ui/GameIcon";
import type { GameIconName } from "@/lib/constants/game-icons";
import type { Badge, BadgeCategory } from "@/lib/constants/badges";
import { getBadgeRequirement, getBadgeXP, getRarityDescription } from "@/lib/utils/badge-descriptions";

interface BadgeDetailCardProps {
  badge: Badge & { earned: boolean; earnedAt?: Date };
  open: boolean;
  onClose: () => void;
  userLevel?: number;
}

const RARITY_CONFIG = {
  common: {
    gradient: "from-slate-500 to-gray-600",
    border: "border-gray-400",
    glow: "shadow-gray-500/40",
    bg: "bg-gradient-to-br from-gray-800/90 to-slate-900/95",
    accent: "text-gray-300",
    accentBg: "bg-gray-500/20",
    shimmer: "from-gray-400/0 via-gray-400/20 to-gray-400/0",
    starCount: 1,
  },
  rare: {
    gradient: "from-blue-500 to-cyan-600",
    border: "border-blue-400",
    glow: "shadow-blue-500/50",
    bg: "bg-gradient-to-br from-blue-950/90 to-slate-900/95",
    accent: "text-blue-300",
    accentBg: "bg-blue-500/20",
    shimmer: "from-blue-400/0 via-blue-400/30 to-blue-400/0",
    starCount: 2,
  },
  epic: {
    gradient: "from-purple-500 to-pink-600",
    border: "border-purple-400",
    glow: "shadow-purple-500/50",
    bg: "bg-gradient-to-br from-purple-950/90 to-slate-900/95",
    accent: "text-purple-300",
    accentBg: "bg-purple-500/20",
    shimmer: "from-purple-400/0 via-purple-400/30 to-purple-400/0",
    starCount: 3,
  },
  legendary: {
    gradient: "from-yellow-400 to-amber-600",
    border: "border-yellow-400",
    glow: "shadow-yellow-500/60",
    bg: "bg-gradient-to-br from-amber-950/90 to-slate-900/95",
    accent: "text-yellow-300",
    accentBg: "bg-yellow-500/20",
    shimmer: "from-yellow-400/0 via-yellow-400/40 to-yellow-400/0",
    starCount: 4,
  },
};

const CATEGORY_ICONS: Record<string, { icon: typeof Trophy; label: string }> = {
  Competition: { icon: Trophy, label: "Competition" },
  Trading: { icon: TrendingUp, label: "Trading" },
  Profit: { icon: Zap, label: "Profit & Loss" },
  Risk: { icon: Shield, label: "Risk Management" },
  Speed: { icon: Clock, label: "Speed & Execution" },
  Consistency: { icon: Target, label: "Consistency" },
  Strategy: { icon: TrendingUp, label: "Strategy" },
  Social: { icon: Star, label: "Social & Achievement" },
  Legendary: { icon: Sparkles, label: "Legendary" },
};

// Default minLevel per rarity
const RARITY_DEFAULT_MIN_LEVEL: Record<string, number> = {
  common: 0,
  rare: 0,
  epic: 5,
  legendary: 8,
};

export default function BadgeDetailCard({
  badge,
  open,
  onClose,
  userLevel = 1,
}: BadgeDetailCardProps) {
  const config = RARITY_CONFIG[badge.rarity] || RARITY_CONFIG.common;
  const requirement = getBadgeRequirement(badge);
  const xpReward = getBadgeXP(badge.rarity);
  const rarityDesc = getRarityDescription(badge.rarity);
  const requiredLevel = badge.minLevel || RARITY_DEFAULT_MIN_LEVEL[badge.rarity] || 0;
  const isLevelLocked = requiredLevel > 0 && userLevel < requiredLevel;
  const categoryInfo = CATEGORY_ICONS[badge.category] || CATEGORY_ICONS.Trading;
  const CategoryIcon = categoryInfo.icon;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm mx-4"
            initial={{ opacity: 0, scale: 0.8, rotateY: -15 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotateY: 15 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            <div
              className={`relative ${config.bg} border-2 ${config.border} rounded-2xl overflow-hidden shadow-2xl ${config.glow}`}
            >
              {/* Animated shimmer effect for legendary/epic */}
              {(badge.rarity === "legendary" || badge.rarity === "epic") && (
                <motion.div
                  className={`absolute inset-0 bg-gradient-to-r ${config.shimmer} pointer-events-none z-10`}
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                />
              )}

              {/* Top Gradient Header */}
              <div className={`relative h-40 bg-gradient-to-br ${config.gradient} flex items-center justify-center overflow-hidden`}>
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute inset-0" style={{
                    backgroundImage: "radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                  }} />
                </div>

                {/* Badge icon - large, centered */}
                <motion.div
                  className={`relative z-10 ${badge.earned ? "" : "opacity-40 grayscale"}`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring" }}
                >
                  <div className="w-24 h-24 rounded-full bg-black/30 backdrop-blur-sm border-4 border-white/30 flex items-center justify-center p-3 shadow-2xl">
                    <GameIcon name={badge.icon as GameIconName} size={64} />
                  </div>
                </motion.div>

                {/* Category label - top left */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
                  <CategoryIcon className="h-3.5 w-3.5 text-white/80" />
                  <span className="text-xs font-medium text-white/90">{categoryInfo.label}</span>
                </div>

                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors z-20"
                >
                  <X className="h-4 w-4 text-white" />
                </button>

                {/* Earned badge */}
                {badge.earned && (
                  <motion.div
                    className="absolute bottom-3 right-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: "spring" }}
                  >
                    EARNED
                  </motion.div>
                )}

                {/* Level lock */}
                {isLevelLocked && !badge.earned && (
                  <div className="absolute bottom-3 right-3 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Lv.{requiredLevel}
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-5 space-y-4">
                {/* Name + Rarity Stars */}
                <div className="text-center">
                  <h2 className="text-xl font-bold text-white mb-1">{badge.name}</h2>
                  <div className="flex items-center justify-center gap-1 mb-2">
                    {Array.from({ length: config.starCount }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${badge.earned ? config.accent : "text-gray-600"} fill-current`}
                      />
                    ))}
                  </div>
                  <span className={`text-xs font-semibold uppercase tracking-wider ${config.accent}`}>
                    {badge.rarity}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">{rarityDesc}</p>
                </div>

                {/* Description */}
                <p className="text-sm text-slate-300 text-center">{badge.description}</p>

                {/* Requirement Card */}
                <div className={`${config.accentBg} border border-white/10 rounded-xl p-4`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Target className={`h-4 w-4 ${config.accent}`} />
                    <span className={`text-sm font-semibold ${config.accent}`}>How to Earn</span>
                  </div>
                  <p className="text-white font-medium text-sm mb-3">{requirement.requirement}</p>

                  {/* Stat display */}
                  <div className="flex items-center justify-between bg-black/20 rounded-lg px-3 py-2">
                    <span className="text-xs text-slate-400">{requirement.statLabel}</span>
                    <span className={`text-sm font-bold ${config.accent}`}>{requirement.targetValue}</span>
                  </div>

                  {/* Extra requirements */}
                  {requirement.extras.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {requirement.extras.map((extra, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                          <div className="w-1 h-1 rounded-full bg-slate-500" />
                          <span>{extra}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tip */}
                  {requirement.tip && (
                    <div className="mt-3 flex items-start gap-2 bg-black/20 rounded-lg px-3 py-2">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <span className="text-xs text-amber-200">{requirement.tip}</span>
                    </div>
                  )}
                </div>

                {/* XP Reward */}
                <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-medium text-amber-100">XP Reward</span>
                    </div>
                    <span className="text-lg font-bold text-amber-300">+{xpReward} XP</span>
                  </div>
                </div>

                {/* Earned date */}
                {badge.earned && badge.earnedAt && (
                  <motion.div
                    className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-center"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <p className="text-green-300 text-sm">
                      Earned on {new Date(badge.earnedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </motion.div>
                )}

                {/* Close button */}
                <button
                  onClick={onClose}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                    badge.earned
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : isLevelLocked
                        ? "bg-purple-600/50 text-purple-200 cursor-default"
                        : `bg-gradient-to-r ${config.gradient} text-white hover:brightness-110`
                  }`}
                >
                  {badge.earned
                    ? "Badge Earned!"
                    : isLevelLocked
                      ? `Unlock at Level ${requiredLevel}`
                      : "Keep Trading to Earn!"
                  }
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
