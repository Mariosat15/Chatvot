"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Star, CheckCircle, Lock, ArrowRight, Sparkles, Target, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import type { Milestone } from "./JourneyMapRenderer";
import { BADGES } from "@/lib/constants/badges";

// Build a lookup map from badge ID -> display name
const BADGE_NAME_MAP = new Map(BADGES.map(b => [b.id, b.name]));

interface MilestoneDetailModalProps {
  milestone: Milestone;
  status: "completed" | "current" | "unlocked" | "locked" | "level_locked";
  open: boolean;
  onClose: () => void;
  currentValue?: number;
  targetValue?: number;
  onContinue?: () => void;
}

const STATUS_CONFIG = {
  completed: {
    border: "border-green-500",
    headerBg: "from-green-400 to-emerald-500",
    cardBg: "from-green-50 to-emerald-50",
    textColor: "text-green-400",
    accentColor: "text-green-400",
    tagBg: "bg-green-500/20 text-green-400",
    tagLabel: "Completed",
    buttonBg: "bg-gradient-to-r from-green-500 to-emerald-600",
  },
  current: {
    border: "border-blue-500",
    headerBg: "from-blue-400 to-indigo-500",
    cardBg: "from-blue-50 to-indigo-50",
    textColor: "text-blue-400",
    accentColor: "text-blue-400",
    tagBg: "bg-blue-500/20 text-blue-400",
    tagLabel: "In Progress",
    buttonBg: "bg-gradient-to-r from-blue-500 to-indigo-600",
  },
  unlocked: {
    border: "border-amber-500",
    headerBg: "from-amber-400 to-orange-500",
    cardBg: "from-amber-50 to-orange-50",
    textColor: "text-amber-400",
    accentColor: "text-amber-400",
    tagBg: "bg-amber-500/20 text-amber-400",
    tagLabel: "Available",
    buttonBg: "bg-gradient-to-r from-amber-500 to-orange-600",
  },
  locked: {
    border: "border-gray-600",
    headerBg: "from-gray-500 to-slate-600",
    cardBg: "from-gray-50 to-slate-100",
    textColor: "text-gray-400",
    accentColor: "text-gray-500",
    tagBg: "bg-gray-700 text-gray-400",
    tagLabel: "Locked",
    buttonBg: "bg-gray-600",
  },
  level_locked: {
    border: "border-purple-400",
    headerBg: "from-purple-400 to-violet-500",
    cardBg: "from-purple-50 to-violet-50",
    textColor: "text-purple-400",
    accentColor: "text-purple-400",
    tagBg: "bg-purple-500/20 text-purple-400",
    tagLabel: "Level Required",
    buttonBg: "bg-gradient-to-r from-purple-500 to-violet-600",
  },
};

const NODE_TYPE_LABELS: Record<string, string> = {
  start: "Starting Point",
  milestone: "Milestone",
  checkpoint: "Checkpoint",
  branch: "Path Choice",
  legendary: "Legendary",
  lesson: "Learning Point",
  optional: "Optional",
};

// Map icon names to game-icon files
const getIconImage = (icon: string): string => {
  const iconMap: Record<string, string> = {
    ship: "Pirate Ship.png", pirateShip: "Pirate Ship.png",
    anchor: "Anchor.png", compass: "Compass.png",
    map: "Pirate Map.png", pirateMap: "Pirate Map.png", maps: "Pirate Map.png",
    treasure: "treasure.png", treasureChest: "chest 1.png", chest: "chest 1.png",
    pirateCoins: "Pirate Coins.png", pirateFlag: "Pirate Flag.png", flag: "Pirate Flag.png",
    pirateSword: "Pirate Sword.png", pirateHat: "Pirate Hat.png",
    pirateHook: "Pirate Hook.png", pirateCannon: "Pirate Cannon.png", cannon: "Pirate Cannon.png",
    piratePistol: "Pirate Pistol.png", parrot: "Parrot.png", skull: "skull.png",
    barrel: "Barrel.png", island: "Island Rock.png", eyePatch: "Eye Patch.png",
    moneyDeposit: "money deposite.png", deposit: "money deposite.png",
    trade: "2. trade.png", buy: "2. trade.png", sell: "stock down.png",
    profit: "3. profit.png", coin: "3. Coin.png", coins: "Pirate Coins.png",
    gems: "4. Gems.png", target: "target.png",
    portfolio: "1. invest portfolio.png", invest: "Long Term Investment.png",
    longTermInvestment: "Long Term Investment.png", balance: "money balance.png",
    trophy: "1. TROPHY.png", trophyStar: "2. STAR TROPHY.png",
    goldMedal: "3. GOLD MEDAL.png", starBadge: "14. STAR BADGE.png",
    shield: "5. SHIELD AWARD.png", shield1: "shield 1.png",
    champion: "11. CHAMPION AWARD.png", victory: "20. VICTORY AWARD.png",
    crown: "16. Crown.png", star1: "star 1.png", star: "star 1.png",
    medal: "medal 1.png", reward: "reward 1.png",
    guideBook: "20. GuideBook.png", sword: "sword.png",
    archer: "11. Archer.png", axe: "10. Axe.png", bomb: "12. Bomb.png",
    timer: "13. Timer.png", key: "15. Key.png", banner: "18. Banner.png",
    helmet: "helmet 1.png", armor: "armor 1.png", hammer: "hammer 1.png",
    lightningSpell: "lightning speel.png", fireSpell: "fire spell.png",
    spell: "1. Spell Brown.png", magicShield3D: "Magic Shiled 3D.png",
    healthPotion: "healt potion.png", energyPotion: "energi potion.png",
    riskWarning: "1. Risk Warning.png", riskManagement: "2. Risk Management.png",
    riskControl: "7. Risk Control.png",
    lord: "8. Lord.png", rookie: "7. Rookie.png", war: "6. War.png",
  };
  return `/game-icons/${iconMap[icon] || "Pirate Ship.png"}`;
};

const formatCondition = (condition: { type: string; value?: number }) => {
  const labels: Record<string, (v?: number) => string> = {
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
    kyc_verified: () => "Complete KYC verification",
  };
  const fn = labels[condition.type];
  return fn ? fn(condition.value) : condition.type.replace(/_/g, " ");
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

  const target = targetValue || milestone.completeCondition?.value || 1;
  const progressPercent = Math.min(100, Math.round((currentValue / target) * 100));
  const xpReward = milestone.rewards?.xp || 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Scrollable Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 overflow-y-auto overscroll-contain"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
          <div className="min-h-full flex items-start justify-center py-8 px-4">
          {/* Pokemon-style Card */}
          <motion.div
            className="w-full max-w-[360px]"
            initial={{ opacity: 0, scale: 0.7, rotateY: -20 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.7, rotateY: 20 }}
            transition={{ type: "spring", damping: 18, stiffness: 250 }}
            style={{ perspective: "1000px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`relative border-[6px] ${config.border} rounded-[18px] overflow-hidden shadow-2xl`}
              style={{ background: "linear-gradient(135deg, #1a1d2e 0%, #131722 100%)" }}
            >
              {/* Shimmer for completed */}
              {status === "completed" && (
                <motion.div
                  className="absolute inset-0 pointer-events-none z-30 opacity-20"
                  style={{
                    background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 45%, transparent 50%)",
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
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${config.tagBg}`}>
                      {config.tagLabel}
                    </span>
                    <span className="text-[10px] text-gray-400 italic">
                      {NODE_TYPE_LABELS[milestone.nodeType] || milestone.nodeType}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500">#{milestone.order || "?"}</span>
                </div>

                <div className="flex items-center justify-between">
                  <h2 className={`text-lg font-extrabold ${config.textColor} leading-tight`}>{milestone.name}</h2>
                  {xpReward > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-extrabold text-amber-400">{xpReward}</span>
                      <span className="text-[10px] font-bold text-amber-500 uppercase">XP</span>
                      <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
                    </div>
                  )}
                </div>
              </div>

              {/* === CHARACTER ART FRAME === */}
              <div className="mx-3 mb-2">
                <div
                  className={`relative rounded-lg border-2 ${config.border} overflow-hidden bg-gradient-to-br ${config.headerBg} p-6`}
                >
                  {/* Background pattern */}
                  <div className="absolute inset-0 opacity-15">
                    <div className="absolute inset-0" style={{
                      backgroundImage: "radial-gradient(circle at 30% 30%, white 2px, transparent 2px), radial-gradient(circle at 70% 70%, white 1px, transparent 1px)",
                      backgroundSize: "24px 24px",
                    }} />
                  </div>

                  {/* Milestone icon */}
                  <motion.div
                    className={`relative z-10 flex justify-center ${status === "locked" || status === "level_locked" ? "opacity-40 grayscale" : ""}`}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: status === "locked" || status === "level_locked" ? 0.4 : 1 }}
                    transition={{ delay: 0.15, type: "spring", damping: 15 }}
                  >
                    <div className="w-28 h-28 flex items-center justify-center drop-shadow-lg">
                      <div className="relative w-24 h-24">
                        <Image
                          src={getIconImage(milestone.icon)}
                          alt={milestone.name}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    </div>
                  </motion.div>

                  {/* Lock overlay */}
                  {(status === "locked" || status === "level_locked") && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg z-20">
                      <div className="flex flex-col items-center gap-1">
                        <Lock className="h-8 w-8 text-white/80" />
                        {status === "level_locked" && milestone.unlockCondition?.value && (
                          <span className="text-xs font-bold text-purple-200 bg-purple-900/60 px-2 py-0.5 rounded-full">
                            Lv.{milestone.unlockCondition.value}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* === FLAVOR TEXT === */}
              <div className="mx-4 mb-2">
                <p className="text-[11px] text-gray-400 italic text-center leading-snug">{milestone.description}</p>
              </div>

              {/* === REQUIREMENT SECTION (Attack-style) === */}
              <div className="mx-3 mb-2">
                <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/80 border-b border-gray-700">
                    <Target className={`h-4 w-4 ${config.accentColor}`} />
                    <span className={`text-xs font-bold uppercase tracking-wide ${config.accentColor}`}>
                      Requirement
                    </span>
                    {milestone.completeCondition?.value && (
                      <span className={`ml-auto text-lg font-black ${config.textColor}`}>
                        {milestone.completeCondition.value}
                      </span>
                    )}
                  </div>

                  <div className="px-3 py-2">
                    <p className="text-sm font-semibold text-gray-200 mb-1">
                      {formatCondition(milestone.completeCondition)}
                    </p>

                    {/* Progress bar */}
                    {status !== "completed" && milestone.completeCondition?.value && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-gray-400">Progress</span>
                          <span className={cn("font-semibold", config.accentColor)}>
                            {currentValue} / {target}
                          </span>
                        </div>
                        <div className="h-3 bg-gray-700 rounded-full overflow-hidden border border-gray-600">
                          <motion.div
                            className={cn(
                              "h-full rounded-full",
                              status === "locked" || status === "level_locked"
                                ? "bg-gray-400"
                                : `bg-gradient-to-r ${config.headerBg}`
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          />
                        </div>
                        <div className="text-right text-[10px] text-gray-500 mt-0.5">{progressPercent}%</div>
                      </div>
                    )}

                    {/* Completed checkmark */}
                    {status === "completed" && (
                      <div className="mt-1 flex items-center gap-1.5 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-xs font-semibold">Completed!</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* === BOTTOM STATS BAR === */}
              <div className="mx-3 mb-2 flex items-stretch divide-x divide-gray-700 bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden text-center">
                <div className="flex-1 py-2 px-1">
                  <p className="text-[9px] text-gray-400 uppercase font-semibold">Reward</p>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    {xpReward > 0 ? (
                      <>
                        <Star className="h-3 w-3 text-amber-500 fill-amber-400" />
                        <span className="text-xs font-bold text-amber-400">+{xpReward} XP</span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </div>
                </div>
                <div className="flex-1 py-2 px-1">
                  <p className="text-[9px] text-gray-400 uppercase font-semibold">Badge</p>
                  {milestone.rewards?.badgeId ? (
                    <Sparkles className="h-3.5 w-3.5 text-purple-500 mx-auto mt-0.5" />
                  ) : (
                    <span className="text-xs text-gray-400 block mt-0.5">-</span>
                  )}
                </div>
                <div className="flex-1 py-2 px-1">
                  <p className="text-[9px] text-gray-400 uppercase font-semibold">Title</p>
                  {milestone.rewards?.title ? (
                    <span className="text-[10px] font-bold text-blue-400 mt-0.5 block truncate px-1">
                      {milestone.rewards.title}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 block mt-0.5">-</span>
                  )}
                </div>
              </div>

              {/* === SEASONAL / BADGE REQUIREMENTS === */}
              {milestone.isSeasonal && (
                <div className="mx-3 mb-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-[10px] font-bold text-amber-400">
                      {milestone.seasonTag ? `Season: ${milestone.seasonTag.replace(/_/g, " ")}` : "Limited Time"}
                    </span>
                  </div>
                  {milestone.seasonEnd && (
                    <p className="text-[10px] text-amber-500 mt-0.5">
                      Until {new Date(milestone.seasonEnd).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {milestone.requiredBadgeIds && milestone.requiredBadgeIds.length > 0 && (
                <div className="mx-3 mb-2 bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-[10px] font-bold text-purple-400">Required Badges</span>
                  </div>
                  <p className="text-[10px] text-purple-300 mt-0.5">
                    {milestone.requiredBadgeIds.map(id => BADGE_NAME_MAP.get(id) || id).join(", ")}
                  </p>
                </div>
              )}

              {/* Celebration text */}
              {status === "completed" && milestone.celebrationText && (
                <div className="mx-3 mb-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-center">
                  <p className="text-[11px] text-green-400 italic">&quot;{milestone.celebrationText}&quot;</p>
                </div>
              )}

              {/* === ACTION BUTTON === */}
              <div className="mx-3 mb-3">
                <button
                  onClick={status === "completed" ? onClose : (onContinue || onClose)}
                  className={`w-full py-2.5 rounded-lg font-bold text-sm text-white transition-all shadow-lg hover:brightness-110 flex items-center justify-center gap-2 ${config.buttonBg}`}
                >
                  {status === "completed" ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Completed!
                    </>
                  ) : status === "locked" || status === "level_locked" ? (
                    <>
                      <Lock className="h-4 w-4" />
                      {status === "level_locked" ? "Level Up to Unlock" : "Complete Previous Steps"}
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4" />
                      Continue Journey
                    </>
                  )}
                </button>
              </div>

              {/* Card ID */}
              <div className="px-4 pb-2 flex items-center justify-between">
                <span className="text-[8px] text-gray-500">Chartvolt Journey Milestone</span>
                <span className="text-[8px] text-gray-500 font-mono">#{milestone.order || "?"}</span>
              </div>
            </div>
          </motion.div>
          </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
