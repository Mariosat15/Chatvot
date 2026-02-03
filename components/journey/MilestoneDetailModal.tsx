"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Trophy, CheckCircle, Lock, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Milestone } from "./JourneyMapRenderer";

interface MilestoneDetailModalProps {
  milestone: Milestone;
  status: "completed" | "current" | "unlocked" | "locked";
  open: boolean;
  onClose: () => void;
  currentProgress?: number; // 0-100 for progress towards completion
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
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/30",
  },
  locked: {
    icon: Lock,
    label: "Locked",
    color: "text-slate-600",
    bgColor: "bg-slate-700/10",
    borderColor: "border-slate-700/30",
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
  currentProgress = 0,
  onContinue,
}: MilestoneDetailModalProps) {
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  const formatCondition = (condition: { type: string; value?: number }) => {
    const conditionLabels: Record<string, (value?: number) => string> = {
      account_created: () => "Create an account",
      first_deposit: () => "Make your first deposit",
      total_deposits: (v) => `Make ${v || 1} deposit${(v || 1) > 1 ? "s" : ""}`,
      total_trades: (v) => `Complete ${v || 1} trade${(v || 1) > 1 ? "s" : ""}`,
      winning_trades: (v) => `Win ${v || 1} trade${(v || 1) > 1 ? "s" : ""}`,
      competitions_entered: (v) => `Join ${v || 1} competition${(v || 1) > 1 ? "s" : ""}`,
      competitions_completed: (v) => `Complete ${v || 1} competition${(v || 1) > 1 ? "s" : ""}`,
      first_place_finishes: (v) => `Win ${v || 1} competition${(v || 1) > 1 ? "s" : ""}`,
      podium_finishes: (v) => `Finish top 3 in ${v || 1} competition${(v || 1) > 1 ? "s" : ""}`,
      win_rate: (v) => `Achieve ${v || 50}% win rate`,
      win_streak: (v) => `Get ${v || 3} wins in a row`,
      xp_threshold: (v) => `Earn ${v || 100} XP`,
      level_reached: (v) => `Reach level ${v || 5}`,
    };

    const formatter = conditionLabels[condition.type];
    return formatter ? formatter(condition.value) : condition.type;
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div
              className={cn(
                "bg-slate-900 border rounded-2xl overflow-hidden shadow-2xl",
                config.borderColor
              )}
            >
              {/* Header with color accent */}
              <div
                className="h-2"
                style={{ backgroundColor: milestone.color }}
              />

              {/* Content */}
              <div className="p-6">
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5 text-slate-400" />
                </button>

                {/* Status badge */}
                <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4", config.bgColor)}>
                  <StatusIcon className={cn("h-4 w-4", config.color)} />
                  <span className={cn("text-sm font-medium", config.color)}>
                    {config.label}
                  </span>
                </div>

                {/* Milestone name */}
                <h2 className="text-2xl font-bold text-white mb-2">
                  {milestone.name}
                </h2>

                {/* Type badge */}
                <Badge variant="outline" className="mb-4">
                  {NODE_TYPE_LABELS[milestone.nodeType] || milestone.nodeType}
                </Badge>

                {/* Description */}
                <p className="text-slate-300 mb-6">
                  {milestone.description}
                </p>

                {/* Requirement */}
                <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
                  <div className="text-sm text-slate-400 mb-2">Requirement</div>
                  <div className="text-white font-medium">
                    {formatCondition(milestone.completeCondition)}
                  </div>

                  {/* Progress bar for in-progress milestones */}
                  {(status === "current" || status === "unlocked") && milestone.completeCondition.value && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Progress</span>
                        <span>{Math.round(currentProgress)}%</span>
                      </div>
                      <Progress value={currentProgress} className="h-2" />
                    </div>
                  )}
                </div>

                {/* Rewards */}
                <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 text-amber-400 mb-3">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm font-medium">Rewards</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 bg-amber-500/20 px-3 py-1.5 rounded-full">
                      <Star className="h-4 w-4 text-amber-400" />
                      <span className="text-amber-100 font-medium">
                        +{milestone.rewards.xp} XP
                      </span>
                    </div>
                    {milestone.rewards.badgeId && (
                      <div className="flex items-center gap-2 bg-purple-500/20 px-3 py-1.5 rounded-full">
                        <Trophy className="h-4 w-4 text-purple-400" />
                        <span className="text-purple-100 font-medium">
                          Badge
                        </span>
                      </div>
                    )}
                    {milestone.rewards.title && (
                      <div className="flex items-center gap-2 bg-blue-500/20 px-3 py-1.5 rounded-full">
                        <CheckCircle className="h-4 w-4 text-blue-400" />
                        <span className="text-blue-100 font-medium">
                          "{milestone.rewards.title}"
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Celebration text for completed */}
                {status === "completed" && milestone.celebrationText && (
                  <motion.div
                    className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <p className="text-green-300 text-center italic">
                      "{milestone.celebrationText}"
                    </p>
                  </motion.div>
                )}

                {/* Action button */}
                {status === "locked" ? (
                  <Button disabled className="w-full" variant="secondary">
                    <Lock className="h-4 w-4 mr-2" />
                    Complete previous milestones to unlock
                  </Button>
                ) : status === "completed" ? (
                  <Button onClick={onClose} className="w-full" variant="outline">
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
