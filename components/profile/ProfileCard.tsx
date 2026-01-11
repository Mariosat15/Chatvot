'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  X,
  Trophy,
  Target,
  TrendingUp,
  Swords,
  Award,
  BarChart3,
  Loader2,
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// Level info - should match your app's level config
const LEVEL_INFO: Record<number, { label: string; color: string; bgColor: string; icon: string }> = {
  1: { label: 'Beginner', color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: '🌱' },
  2: { label: 'Apprentice', color: 'text-green-400', bgColor: 'bg-green-500/20', icon: '📈' },
  3: { label: 'Intermediate', color: 'text-blue-400', bgColor: 'bg-blue-500/20', icon: '📊' },
  4: { label: 'Advanced', color: 'text-purple-400', bgColor: 'bg-purple-500/20', icon: '💹' },
  5: { label: 'Expert', color: 'text-orange-400', bgColor: 'bg-orange-500/20', icon: '🔥' },
  6: { label: 'Master', color: 'text-red-400', bgColor: 'bg-red-500/20', icon: '⚡' },
  7: { label: 'Grandmaster', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', icon: '👑' },
  8: { label: 'Legend', color: 'text-pink-400', bgColor: 'bg-pink-500/20', icon: '🏆' },
};

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

  // Derive level from title
  const getLevelFromTitle = (title?: string): number => {
    if (!title) return 3;
    const titleLower = title.toLowerCase();
    if (titleLower.includes('beginner') || titleLower.includes('newbie')) return 1;
    if (titleLower.includes('apprentice')) return 2;
    if (titleLower.includes('intermediate') || titleLower.includes('trader')) return 3;
    if (titleLower.includes('advanced') || titleLower.includes('skilled')) return 4;
    if (titleLower.includes('expert') || titleLower.includes('veteran')) return 5;
    if (titleLower.includes('master')) return 6;
    if (titleLower.includes('grandmaster') || titleLower.includes('elite')) return 7;
    if (titleLower.includes('legend') || titleLower.includes('champion')) return 8;
    return 3;
  };

  const level = getLevelFromTitle(stats?.userTitle);
  const levelInfo = LEVEL_INFO[level];

  // Fetch profile image and bio when shown
  useEffect(() => {
    if (show && userId) {
      setImageError(false); // Reset error state when fetching new profile
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
          console.error('Error fetching profile:', error);
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative w-full max-w-md bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Gradient */}
            <div className="h-24 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/30 text-white/70 hover:text-white hover:bg-black/50 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Avatar */}
            <div className="relative -mt-12 flex justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 p-1">
                <div className="w-full h-full rounded-full overflow-hidden bg-gray-900 flex items-center justify-center">
                  {loading ? (
                    <Loader2 className="h-8 w-8 text-gray-500 animate-spin" />
                  ) : profileImage && !imageError ? (
                    <Image
                      src={profileImage}
                      alt=""
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                      onError={() => setImageError(true)}
                      unoptimized
                    />
                  ) : (
                    <span className="text-3xl font-bold text-gray-400">
                      {username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* User Info */}
            <div className="px-6 pt-4 text-center">
              <h2 className="text-2xl font-bold text-white">{username}</h2>
              
              {/* Title & Level */}
              <div className="flex items-center justify-center gap-2 mt-2">
                {stats?.userTitle && (
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${stats.userTitleColor || 'text-purple-400'} bg-gray-800/80 border border-gray-700`}>
                    {stats.userTitleIcon} {stats.userTitle}
                  </span>
                )}
                <span className={cn(
                  "px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1",
                  levelInfo.bgColor,
                  levelInfo.color
                )}>
                  <span>{levelInfo.icon}</span>
                  {levelInfo.label}
                </span>
              </div>

              {/* Rank Badge */}
              {stats?.rank && (
                <div className="flex justify-center mt-3">
                  <div className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2",
                    stats.rank === 1 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' :
                    stats.rank === 2 ? 'bg-gray-300/20 text-gray-300 border border-gray-300/50' :
                    stats.rank === 3 ? 'bg-amber-600/20 text-amber-600 border border-amber-600/50' :
                    stats.rank <= 10 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' :
                    'bg-gray-700/20 text-gray-400 border border-gray-700/50'
                  )}>
                    <Trophy className="h-4 w-4" />
                    Rank #{stats.rank}
                  </div>
                </div>
              )}

              {/* Bio */}
              {bio && (
                <p className="mt-4 text-sm text-gray-400 italic line-clamp-3">
                  &quot;{bio}&quot;
                </p>
              )}
            </div>

            {/* Stats Grid */}
            <div className="px-6 py-6">
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={<Target className="h-4 w-4 text-green-400" />}
                  label="Win Rate"
                  value={`${(stats?.winRate || 0).toFixed(1)}%`}
                  color="text-green-400"
                />
                <StatCard
                  icon={<BarChart3 className="h-4 w-4 text-blue-400" />}
                  label="Total Trades"
                  value={stats?.totalTrades?.toString() || '0'}
                  color="text-blue-400"
                />
                <StatCard
                  icon={<TrendingUp className="h-4 w-4 text-purple-400" />}
                  label="Total P&L"
                  value={`${(stats?.totalPnl || 0) >= 0 ? '+' : ''}${(stats?.totalPnl || 0).toFixed(0)}`}
                  color={(stats?.totalPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}
                />
                <StatCard
                  icon={<Trophy className="h-4 w-4 text-yellow-400" />}
                  label="Competitions"
                  value={`${stats?.competitionsWon || 0}/${stats?.competitionsEntered || 0}`}
                  color="text-yellow-400"
                />
                <StatCard
                  icon={<Swords className="h-4 w-4 text-orange-400" />}
                  label="Challenges"
                  value={`${stats?.challengesWon || 0}/${stats?.challengesEntered || 0}`}
                  color="text-orange-400"
                />
                <StatCard
                  icon={<Award className="h-4 w-4 text-pink-400" />}
                  label="Badges"
                  value={stats?.totalBadges?.toString() || '0'}
                  color="text-pink-400"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 border-gray-600 text-gray-400 hover:bg-gray-800"
              >
                Close
              </Button>
              {showChallengeButton && onChallenge && (
                <Button
                  onClick={onChallenge}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                >
                  <Swords className="h-4 w-4 mr-2" />
                  Challenge
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className={cn("text-lg font-bold", color)}>{value}</p>
    </div>
  );
}

