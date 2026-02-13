"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  X,
  Trophy,
  Target,
  TrendingUp,
  Swords,
  Award,
  BarChart3,
  Loader2,
  Star,
  Shield,
} from "lucide-react";
import { GameIcon } from "@/components/ui/GameIcon";
import { GAME_ICONS, type GameIconName } from "@/lib/constants/game-icons";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Rank tier config (like Pokemon card rarity)
const RANK_CONFIG = {
  champion: {
    border: "border-yellow-400",
    headerBg: "from-yellow-400 via-amber-400 to-orange-500",
    tagBg: "bg-yellow-500/20 text-yellow-400",
    tagLabel: "Champion",
    textColor: "text-amber-400",
  },
  elite: {
    border: "border-purple-400",
    headerBg: "from-purple-400 to-violet-500",
    tagBg: "bg-purple-500/20 text-purple-400",
    tagLabel: "Elite",
    textColor: "text-purple-400",
  },
  veteran: {
    border: "border-blue-400",
    headerBg: "from-blue-400 to-cyan-500",
    tagBg: "bg-blue-500/20 text-blue-400",
    tagLabel: "Veteran",
    textColor: "text-blue-400",
  },
  trader: {
    border: "border-gray-600",
    headerBg: "from-gray-500 to-slate-600",
    tagBg: "bg-gray-700 text-gray-400",
    tagLabel: "Trader",
    textColor: "text-gray-300",
  },
};

function getRankTier(rank?: number) {
  if (!rank) return RANK_CONFIG.trader;
  if (rank <= 3) return RANK_CONFIG.champion;
  if (rank <= 10) return RANK_CONFIG.elite;
  if (rank <= 50) return RANK_CONFIG.veteran;
  return RANK_CONFIG.trader;
}

interface ProfileCardStats {
  rank?: number;
  winRate?: number;
  totalTrades?: number;
  totalPnl?: number;
  competitionsEntered?: number;
  competitionsWon?: number;
  challengesEntered?: number;
  challengesWon?: number;
  totalBadges?: number;
  overallScore?: number;
  userTitle?: string;
  userTitleIcon?: string;
  userTitleColor?: string;
}

interface ProfileCardProps {
  show: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  stats?: ProfileCardStats;
  showChallengeButton?: boolean;
  onChallenge?: () => void;
}

export default function ProfileCard({
  show,
  onClose,
  userId,
  username,
  stats,
  showChallengeButton = false,
  onChallenge,
}: ProfileCardProps) {
  const [loading, setLoading] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const config = getRankTier(stats?.rank);

  useEffect(() => {
    if (show && userId) {
      setImageError(false);
      const fetchProfile = async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/user/profile/public?userId=${userId}`);
          if (res.ok) {
            const data = await res.json();
            setProfileImage(data.profileImage || null);
            setBio(data.bio || null);
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchProfile();
    }
  }, [show, userId]);

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Scrollable Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md overflow-y-auto overscroll-contain"
            onClick={onClose}
          >
          <div className="min-h-full flex items-start justify-center py-8 px-4">
          {/* Pokemon-style Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7, rotateY: -20 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.7, rotateY: 20 }}
            transition={{ type: "spring", damping: 18, stiffness: 250 }}
            className="w-full max-w-[380px]"
            style={{ perspective: "1000px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`relative border-[6px] ${config.border} rounded-[18px] overflow-hidden shadow-2xl`}
              style={{ background: "linear-gradient(135deg, #1a1d2e 0%, #131722 100%)" }}
            >
              {/* Holographic shimmer for top ranks */}
              {stats?.rank && stats.rank <= 10 && (
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

              {/* === TOP BAR: Tier + Name + Rank === */}
              <div className="px-4 pt-3 pb-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${config.tagBg}`}>
                      {config.tagLabel}
                    </span>
                    {stats?.userTitle && (
                      <span className="text-[10px] text-gray-400 italic flex items-center gap-1">
                        {stats.userTitleIcon && stats.userTitleIcon in GAME_ICONS ? (
                          <GameIcon name={stats.userTitleIcon as GameIconName} size={10} />
                        ) : null}
                        {stats.userTitle}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h2 className={`text-lg font-extrabold ${config.textColor} leading-tight`}>{username}</h2>
                  {stats?.rank && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Rank</span>
                      <span className={`text-lg font-extrabold ${config.textColor}`}>#{stats.rank}</span>
                      <Trophy className={`h-4 w-4 ${stats.rank <= 3 ? "text-yellow-500" : "text-gray-400"}`} />
                    </div>
                  )}
                </div>
              </div>

              {/* === AVATAR FRAME === */}
              <div className="mx-3 mb-2">
                <div className={`relative rounded-lg border-2 ${config.border} overflow-hidden bg-gradient-to-br ${config.headerBg}`}>
                  {/* Decorative pattern overlay */}
                  <div className="absolute inset-0 opacity-15 z-10 pointer-events-none">
                    <div className="absolute inset-0" style={{
                      backgroundImage: "radial-gradient(circle at 30% 30%, white 2px, transparent 2px), radial-gradient(circle at 70% 70%, white 1px, transparent 1px)",
                      backgroundSize: "24px 24px",
                    }} />
                  </div>

                  <motion.div
                    className="relative w-full"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15, type: "spring", damping: 15 }}
                  >
                    {loading ? (
                      <div className="w-full aspect-[16/10] flex items-center justify-center">
                        <Loader2 className="h-10 w-10 text-white animate-spin" />
                      </div>
                    ) : profileImage && !imageError ? (
                      <Image
                        src={profileImage}
                        alt=""
                        width={360}
                        height={220}
                        className="w-full aspect-[16/10] object-cover"
                        onError={() => setImageError(true)}
                        unoptimized
                      />
                    ) : (
                      <div className="w-full aspect-[16/10] flex items-center justify-center">
                        <span className="text-6xl font-bold text-white drop-shadow-lg">
                          {username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </motion.div>
                </div>
              </div>

              {/* === BIO (Flavor text) === */}
              {bio && (
                <div className="mx-4 mb-2">
                  <p className="text-[11px] text-gray-400 italic text-center leading-snug line-clamp-3">&quot;{bio}&quot;</p>
                </div>
              )}

              {/* === STATS SECTION (Attack-style) === */}
              <div className="mx-3 mb-2 space-y-1.5">
                {/* Attack 1: Trading Stats */}
                <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/80 border-b border-gray-700">
                    <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-blue-400">Trading Stats</span>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-gray-700">
                    <StatCell label="Win Rate" value={`${(stats?.winRate || 0).toFixed(1)}%`} color="text-green-400" />
                    <StatCell label="Trades" value={`${stats?.totalTrades || 0}`} color="text-blue-400" />
                    <StatCell
                      label="P&L"
                      value={`${(stats?.totalPnl || 0) >= 0 ? "+" : ""}${(stats?.totalPnl || 0).toFixed(0)}`}
                      color={(stats?.totalPnl || 0) >= 0 ? "text-green-400" : "text-red-400"}
                    />
                  </div>
                </div>

                {/* Attack 2: Competition Stats */}
                <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/80 border-b border-gray-700">
                    <Trophy className="h-3.5 w-3.5 text-yellow-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-yellow-400">Battle Record</span>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-gray-700">
                    <StatCell
                      label="Comps"
                      value={`${stats?.competitionsWon || 0}/${stats?.competitionsEntered || 0}`}
                      color="text-yellow-400"
                    />
                    <StatCell
                      label="Challenges"
                      value={`${stats?.challengesWon || 0}/${stats?.challengesEntered || 0}`}
                      color="text-orange-400"
                    />
                    <StatCell label="Badges" value={`${stats?.totalBadges || 0}`} color="text-pink-400" />
                  </div>
                </div>
              </div>

              {/* === BOTTOM STATS BAR === */}
              <div className="mx-3 mb-2 flex items-stretch divide-x divide-gray-700 bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden text-center">
                <div className="flex-1 py-2 px-1">
                  <p className="text-[9px] text-gray-400 uppercase font-semibold">Score</p>
                  <p className={`text-xs font-bold ${config.textColor} mt-0.5`}>
                    {stats?.overallScore?.toFixed(0) || "0"}
                  </p>
                </div>
                <div className="flex-1 py-2 px-1">
                  <p className="text-[9px] text-gray-400 uppercase font-semibold">Rank</p>
                  <p className={`text-xs font-bold ${config.textColor} mt-0.5`}>
                    #{stats?.rank || "-"}
                  </p>
                </div>
                <div className="flex-1 py-2 px-1">
                  <p className="text-[9px] text-gray-400 uppercase font-semibold">Badges</p>
                  <p className="text-xs font-bold text-pink-400 mt-0.5">
                    {stats?.totalBadges || 0}
                  </p>
                </div>
              </div>

              {/* === ACTION BUTTONS === */}
              <div className="mx-3 mb-3 flex gap-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700 bg-gray-800/60 text-xs h-9"
                >
                  Close
                </Button>
                {showChallengeButton && onChallenge && (
                  <Button
                    onClick={onChallenge}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-xs h-9"
                  >
                    <Swords className="h-3.5 w-3.5 mr-1.5" />
                    Challenge
                  </Button>
                )}
              </div>

              {/* Card ID */}
              <div className="px-4 pb-2 flex items-center justify-between">
                <span className="text-[8px] text-gray-500">Chartvolt Trader Card</span>
                <span className="text-[8px] text-gray-500 font-mono">{userId.slice(-8)}</span>
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

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="py-2 px-2 text-center">
      <p className="text-[9px] text-gray-400 uppercase font-semibold">{label}</p>
      <p className={cn("text-sm font-bold mt-0.5", color)}>{value}</p>
    </div>
  );
}
