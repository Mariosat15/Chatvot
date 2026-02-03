"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Trophy, CheckCircle, Lock, ArrowRight, Sparkles, Target, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Milestone } from "./JourneyMapRenderer";

interface MilestoneDetailModalProps {
  milestone: Milestone;
  status: "completed" | "current" | "unlocked" | "locked" | "level_locked";
  open: boolean;
  onClose: () => void;
  currentValue?: number; // Current progress value (e.g., 3 trades)
  targetValue?: number; // Target value (e.g., 10 trades)
  onContinue?: () => void;
}

const STATUS_CONFIG = {
  completed: {
    icon: CheckCircle,
    label: "Completed",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  current: {
    icon: Star,
    label: "In Progress",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  unlocked: {
    icon: ArrowRight,
    label: "Available",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
  },
  locked: {
    icon: Lock,
    label: "Locked",
    color: "text-slate-500",
    bgColor: "bg-slate-700/20",
    borderColor: "border-slate-600/30",
  },
  level_locked: {
    icon: Shield,
    label: "Level Required",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
};

const NODE_TYPE_LABELS: Record<string, string> = {
  start: "Starting Point",
  milestone: "Milestone",
  checkpoint: "Checkpoint",
  branch: "Path Choice",
  legendary: "Legendary Achievement",
  lesson: "Learning Point",
  optional: "Optional Challenge",
};

export default function MilestoneDetailModal({
  milestone,
  status,
  open,
  onClose,
  currentValue = 0,
  targetValue,
  onContinue,
}: MilestoneDetailModalProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.locked;
  const StatusIcon = config.icon;

  // Calculate progress percentage
  const target = targetValue || milestone.completeCondition?.value || 1;
  const progressPercent = Math.min(100, Math.round((currentValue / target) * 100));

  const formatCondition = (condition: { type: string; value?: number }) => {
    const conditionLabels: Record<string, (value?: number) => string> = {
      account_created: () => "Create an account",
      first_deposit: () => "Make your first deposit",
      total_deposits: (v) => `Make ${v || 1} deposit${(v || 1) > 1 ? "s" : ""}`,
      total_trades: (v) => `Complete ${v || 1} trade${(v || 1) > 1 ? "s" : ""}`,
      winning_trades: (v) => `Win ${v || 1} trade${(v || 1) > 1 ? "s" : ""}`,
      losing_trades: (v) => `Experience ${v || 1} loss${(v || 1) > 1 ? "es" : ""}`,
      competitions_entered: (v) => `Join ${v || 1} competition${(v || 1) > 1 ? "s" : ""}`,
      competitions_completed: (v) => `Complete ${v || 1} competition${(v || 1) > 1 ? "s" : ""}`,
      first_place_finishes: (v) => `Win ${v || 1} competition${(v || 1) > 1 ? "s" : ""}`,
      podium_finishes: (v) => `Finish top 3 in ${v || 1} competition${(v || 1) > 1 ? "s" : ""}`,
      top_10_finishes: (v) => `Finish top 10 in ${v || 1} competition${(v || 1) > 1 ? "s" : ""}`,
      win_rate: (v) => `Achieve ${v || 50}% win rate`,
      win_streak: (v) => `Get ${v || 3} wins in a row`,
      max_win_streak: (v) => `Achieve ${v || 5} consecutive wins`,
      xp_threshold: (v) => `Earn ${v || 100} XP`,
      level_reached: (v) => `Reach level ${v || 5}`,
      total_pnl_positive: () => "Make a profit",
      profit_factor: (v) => `Achieve profit factor of ${v || 1.5}`,
      consecutive_trading_days: (v) => `Trade for ${v || 5} consecutive days`,
      different_assets_traded: (v) => `Trade ${v || 3} different assets`,
    };

    const formatter = conditionLabels[condition.type];
    return formatter ? formatter(condition.value) : condition.type.replace(/_/g, " ");
  };

  // Get emoji icon for the milestone
  const getIconEmoji = (): string => {
    const iconMap: Record<string, string> = {
      ship: "⛵",
      moneyDeposit: "💰",
      trade: "📈",
      buy: "📈",
      sell: "📉",
      target: "🎯",
      profit: "💎",
      guideBook: "📖",
      starBadge: "⭐",
      maps: "🗺️",
      lightningSpell: "⚡",
      longTermInvestment: "💹",
      shield1: "🛡️",
      archer: "🏹",
      star1: "⭐",
      magicShield3D: "🛡️",
      trophy: "🏆",
      trophyStar: "🏆",
      goldMedal: "🥇",
      champion: "👑",
      fireSpell: "🔥",
      crown: "👑",
      treasureChest: "📦",
      flag: "🚩",
      sword: "⚔️",
      gems: "💎",
      victory: "🏆",
      lord: "👑",
    };
    return iconMap[milestone.icon] || "🏝️";
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md mx-4"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div
              className={cn(
                "bg-slate-900 border-2 rounded-2xl overflow-hidden shadow-2xl",
                config.borderColor
              )}
            >
              {/* Header with color accent and icon */}
              <div
                className="h-20 relative flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${milestone.color}40, ${milestone.color}20)` }}
              >
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center border-4 shadow-lg"
                  style={{ 
                    backgroundColor: milestone.color,
                    borderColor: `${milestone.color}80`
                  }}
                >
                  <span className="text-3xl drop-shadow-lg">
                    {getIconEmoji()}
                  </span>
                </div>
                {/* Order number badge */}
                <div className="absolute top-2 left-2 bg-slate-800/80 text-slate-300 text-xs px-2 py-1 rounded-full">
                  #{milestone.order || "?"}
                </div>
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-800/60 hover:bg-slate-700 transition-colors"
                >
                  <X className="h-4 w-4 text-slate-300" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5">
                {/* Status badge */}
                <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3", config.bgColor)}>
                  <StatusIcon className={cn("h-4 w-4", config.color)} />
                  <span className={cn("text-sm font-medium", config.color)}>
                    {config.label}
                  </span>
                </div>

                {/* Milestone name */}
                <h2 className="text-xl font-bold text-white mb-1">
                  {milestone.name}
                </h2>

                {/* Type badge */}
                <Badge variant="outline" className="mb-3 text-xs">
                  {NODE_TYPE_LABELS[milestone.nodeType] || milestone.nodeType}
                </Badge>

                {/* Description */}
                <p className="text-slate-300 text-sm mb-4">
                  {milestone.description}
                </p>

                {/* Requirement Card */}
                <div className="bg-slate-800/50 rounded-xl p-4 mb-4 border border-slate-700/50">
                  <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                    <Target className="h-4 w-4" />
                    <span>Requirement</span>
                  </div>
                  <div className="text-white font-medium mb-2">
                    {formatCondition(milestone.completeCondition)}
                  </div>

                  {/* Progress bar - show for all statuses except completed */}
                  {status !== "completed" && milestone.completeCondition.value && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-400">Progress</span>
                        <span className={cn(
                          "font-medium",
                          status === "locked" || status === "level_locked" ? "text-slate-500" : "text-blue-400"
                        )}>
                          {currentValue} / {target}
                        </span>
                      </div>
                      <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          className={cn(
                            "h-full rounded-full",
                            status === "locked" || status === "level_locked" 
                              ? "bg-slate-600" 
                              : "bg-gradient-to-r from-blue-500 to-blue-400"
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                      </div>
                      <div className="text-right text-xs text-slate-500 mt-1">
                        {progressPercent}%
                      </div>
                    </div>
                  )}
                </div>

                {/* Rewards */}
                <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 text-amber-400 mb-3">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm font-medium">Rewards</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {milestone.rewards.xp > 0 && (
                      <div className="flex items-center gap-1.5 bg-amber-500/20 px-3 py-1.5 rounded-full">
                        <Star className="h-4 w-4 text-amber-400" />
                        <span className="text-amber-100 font-medium text-sm">
                          +{milestone.rewards.xp} XP
                        </span>
                      </div>
                    )}
                    {milestone.rewards.badgeId && (
                      <div className="flex items-center gap-1.5 bg-purple-500/20 px-3 py-1.5 rounded-full">
                        <Trophy className="h-4 w-4 text-purple-400" />
                        <span className="text-purple-100 font-medium text-sm">
                          Badge Unlock
                        </span>
                      </div>
                    )}
                    {milestone.rewards.title && (
                      <div className="flex items-center gap-1.5 bg-blue-500/20 px-3 py-1.5 rounded-full">
                        <CheckCircle className="h-4 w-4 text-blue-400" />
                        <span className="text-blue-100 font-medium text-sm">
                          "{milestone.rewards.title}"
                        </span>
                      </div>
                    )}
                    {!milestone.rewards.xp && !milestone.rewards.badgeId && !milestone.rewards.title && (
                      <span className="text-slate-400 text-sm">Complete to progress</span>
                    )}
                  </div>
                </div>

                {/* Locked info - show what's needed to unlock */}
                {(status === "locked" || status === "level_locked") && (
                  <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                      <Lock className="h-4 w-4" />
                      <span className="text-sm font-medium">How to Unlock</span>
                    </div>
                    <p className="text-sm text-slate-300">
                      {status === "level_locked" && milestone.unlockCondition?.value
                        ? `Reach Level ${milestone.unlockCondition.value} to unlock this milestone.`
                        : "Complete the previous milestones in your journey to unlock this one."
                      }
                    </p>
                  </div>
                )}

                {/* Celebration text for completed */}
                {status === "completed" && milestone.celebrationText && (
                  <motion.div
                    className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <p className="text-green-300 text-center italic text-sm">
                      "{milestone.celebrationText}"
                    </p>
                  </motion.div>
                )}

                {/* Action button */}
                {status === "locked" || status === "level_locked" ? (
                  <Button onClick={onClose} className="w-full" variant="secondary">
                    <Lock className="h-4 w-4 mr-2" />
                    {status === "level_locked" ? "Level Up to Unlock" : "Complete Previous Steps"}
                  </Button>
                ) : status === "completed" ? (
                  <Button onClick={onClose} className="w-full bg-green-600 hover:bg-green-700">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Completed!
                  </Button>
                ) : (
                  <Button
                    onClick={onContinue || onClose}
                    className="w-full"
                    style={{ backgroundColor: milestone.color }}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Continue Journey
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
