"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Lock, Sparkles, Target } from "lucide-react";
import { GameIcon } from "@/components/ui/GameIcon";
import type { GameIconName } from "@/lib/constants/game-icons";
import type { Badge } from "@/lib/constants/badges";
import { getBadgeRequirement, getBadgeXP, getRarityDescription } from "@/lib/utils/badge-descriptions";

interface BadgeDetailCardProps {
  badge: Badge & { earned: boolean; earnedAt?: Date };
  open: boolean;
  onClose: () => void;
  userLevel?: number;
}

const RARITY_CONFIG = {
  common: {
    border: "border-[#a0a0a0]",
    headerBg: "from-gray-400 to-gray-500",
    cardBg: "from-gray-100 to-gray-200",
    textColor: "text-gray-700",
    accentColor: "text-gray-600",
    tagBg: "bg-gray-200 text-gray-700",
    shimmer: false,
    starCount: 1,
  },
  rare: {
    border: "border-blue-400",
    headerBg: "from-blue-400 to-cyan-500",
    cardBg: "from-blue-50 to-cyan-100",
    textColor: "text-blue-800",
    accentColor: "text-blue-600",
    tagBg: "bg-blue-100 text-blue-700",
    shimmer: false,
    starCount: 2,
  },
  epic: {
    border: "border-purple-400",
    headerBg: "from-purple-500 to-pink-500",
    cardBg: "from-purple-50 to-pink-100",
    textColor: "text-purple-800",
    accentColor: "text-purple-600",
    tagBg: "bg-purple-100 text-purple-700",
    shimmer: true,
    starCount: 3,
  },
  legendary: {
    border: "border-yellow-400",
    headerBg: "from-yellow-400 via-orange-400 to-red-500",
    cardBg: "from-yellow-50 via-orange-50 to-red-50",
    textColor: "text-amber-900",
    accentColor: "text-amber-700",
    tagBg: "bg-amber-100 text-amber-800",
    shimmer: true,
    starCount: 4,
  },
};

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

          {/* Pokemon-style Card */}
          <motion.div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[360px] mx-4"
            initial={{ opacity: 0, scale: 0.7, rotateY: -20 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.7, rotateY: 20 }}
            transition={{ type: "spring", damping: 18, stiffness: 250 }}
            style={{ perspective: "1000px" }}
          >
            <div
              className={`relative border-[6px] ${config.border} rounded-[18px] overflow-hidden shadow-2xl`}
              style={{ background: "linear-gradient(135deg, #f5f0e1 0%, #e8dcc8 100%)" }}
            >
              {/* Holographic shimmer for epic/legendary */}
              {config.shimmer && (
                <motion.div
                  className="absolute inset-0 pointer-events-none z-30 opacity-30"
                  style={{
                    background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.8) 45%, transparent 50%)",
                    backgroundSize: "200% 200%",
                  }}
                  animate={{ backgroundPosition: ["200% 0%", "-200% 0%"] }}
                  transition={{ duration: 3, repeat: Infinity, repeatDelay: 1.5, ease: "linear" }}
                />
              )}

              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors z-40"
              >
                <X className="h-4 w-4 text-white" />
              </button>

              {/* === TOP BAR: Stage + Name + XP === */}
              <div className="px-4 pt-3 pb-1">
                {/* Rarity stage label */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${config.tagBg}`}>
                      {badge.rarity}
                    </span>
                    <span className="text-[10px] text-gray-500 italic">{badge.category}</span>
                  </div>
                  {badge.earned && (
                    <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded">
                      EARNED
                    </span>
                  )}
                </div>

                {/* Name + XP (like Pokemon Name + HP) */}
                <div className="flex items-center justify-between">
                  <h2 className={`text-lg font-extrabold ${config.textColor} leading-tight`}>{badge.name}</h2>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-extrabold text-amber-600">{xpReward}</span>
                    <span className="text-[10px] font-bold text-amber-500 uppercase">XP</span>
                    <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
                  </div>
                </div>
              </div>

              {/* === CHARACTER ART FRAME === */}
              <div className="mx-3 mb-2">
                <div className={`relative rounded-lg border-2 ${config.border} overflow-hidden bg-gradient-to-br ${config.headerBg} p-6`}>
                  {/* Background energy pattern */}
                  <div className="absolute inset-0 opacity-15">
                    <div className="absolute inset-0" style={{
                      backgroundImage: "radial-gradient(circle at 30% 30%, white 2px, transparent 2px), radial-gradient(circle at 70% 70%, white 1px, transparent 1px)",
                      backgroundSize: "24px 24px",
                    }} />
                  </div>

                  {/* Badge icon centered */}
                  <motion.div
                    className={`relative z-10 flex justify-center ${badge.earned ? "" : "opacity-40 grayscale"}`}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: badge.earned ? 1 : 0.4 }}
                    transition={{ delay: 0.15, type: "spring", damping: 15 }}
                  >
                    <div className="w-28 h-28 flex items-center justify-center drop-shadow-lg">
                      <GameIcon name={badge.icon as GameIconName} size={96} />
                    </div>
                  </motion.div>

                  {/* Level lock overlay */}
                  {isLevelLocked && !badge.earned && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg z-20">
                      <div className="flex flex-col items-center gap-1">
                        <Lock className="h-8 w-8 text-purple-300" />
                        <span className="text-xs font-bold text-purple-200 bg-purple-900/60 px-2 py-0.5 rounded-full">
                          Lv.{requiredLevel} Required
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* === FLAVOR TEXT (Description) === */}
              <div className="mx-4 mb-2">
                <p className="text-[11px] text-gray-600 italic text-center leading-snug">{badge.description}. {rarityDesc}.</p>
              </div>

              {/* === ATTACK / POWER SECTION (How to Earn) === */}
              <div className="mx-3 mb-2">
                <div className="bg-white/60 border border-gray-300 rounded-lg overflow-hidden">
                  {/* Attack header */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-100/80 border-b border-gray-300">
                    <Target className={`h-4 w-4 ${config.accentColor}`} />
                    <span className={`text-xs font-bold uppercase tracking-wide ${config.accentColor}`}>
                      Requirement
                    </span>
                    {/* Damage value (target) */}
                    <span className={`ml-auto text-lg font-black ${config.textColor}`}>
                      {requirement.targetValue}
                    </span>
                  </div>

                  {/* Attack description */}
                  <div className="px-3 py-2">
                    <p className="text-sm font-semibold text-gray-800 mb-1">{requirement.requirement}</p>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>{requirement.statLabel}</span>
                    </div>

                    {/* Extra requirements */}
                    {requirement.extras.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {requirement.extras.map((extra, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px] text-gray-500">
                            <div className="w-1 h-1 rounded-full bg-gray-400" />
                            <span>{extra}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tip */}
                    {requirement.tip && (
                      <div className="mt-2 flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                        <Sparkles className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                        <span className="text-[10px] text-amber-700">{requirement.tip}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* === BOTTOM STATS BAR (like Weakness/Resistance/Retreat) === */}
              <div className="mx-3 mb-2 flex items-stretch divide-x divide-gray-300 bg-white/50 border border-gray-300 rounded-lg overflow-hidden text-center">
                <div className="flex-1 py-2 px-1">
                  <p className="text-[9px] text-gray-500 uppercase font-semibold">Category</p>
                  <p className={`text-xs font-bold ${config.textColor} mt-0.5`}>{badge.category}</p>
                </div>
                <div className="flex-1 py-2 px-1">
                  <p className="text-[9px] text-gray-500 uppercase font-semibold">Rarity</p>
                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                    {Array.from({ length: config.starCount }).map((_, i) => (
                      <Star key={i} className={`h-3 w-3 ${badge.earned ? "text-amber-500" : "text-gray-400"} fill-current`} />
                    ))}
                  </div>
                </div>
                <div className="flex-1 py-2 px-1">
                  <p className="text-[9px] text-gray-500 uppercase font-semibold">XP</p>
                  <p className="text-xs font-bold text-amber-600 mt-0.5">+{xpReward}</p>
                </div>
              </div>

              {/* === CARD FOOTER === */}
              <div className="mx-3 mb-3">
                {/* Earned date */}
                {badge.earned && badge.earnedAt && (
                  <p className="text-[10px] text-gray-500 text-center italic mb-2">
                    Earned on {new Date(badge.earnedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                )}

                {/* Action button */}
                <button
                  onClick={onClose}
                  className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all ${
                    badge.earned
                      ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30 hover:brightness-110"
                      : isLevelLocked
                        ? "bg-gray-300 text-gray-500 cursor-default"
                        : `bg-gradient-to-r ${config.headerBg} text-white shadow-lg hover:brightness-110`
                  }`}
                >
                  {badge.earned
                    ? "Badge Collected!"
                    : isLevelLocked
                      ? `Unlock at Level ${requiredLevel}`
                      : "Keep Trading to Earn!"
                  }
                </button>
              </div>

              {/* Card ID at bottom */}
              <div className="px-4 pb-2 flex items-center justify-between">
                <span className="text-[8px] text-gray-400">Chartvolt Trading Badge</span>
                <span className="text-[8px] text-gray-400 font-mono">{badge.id}</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
