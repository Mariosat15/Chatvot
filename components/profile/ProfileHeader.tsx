'use client';

import { useState, useEffect } from 'react';
import { Camera, MapPin, Calendar, ChevronDown, Sparkles, Trophy, Swords, TrendingUp, Verified } from 'lucide-react';
import { useUserProfileImage } from '@/hooks/useUserProfileImage';
import { useAppSettings } from '@/contexts/AppSettingsContext';

interface ProfileHeaderProps {
  session: {
    user: {
      name?: string;
      email?: string;
      image?: string;
    };
  };
  levelData: {
    currentLevel: number;
    currentTitle: string;
    currentIcon: string;
    currentColor: string;
    currentXP: number;
    totalBadgesEarned: number;
  };
  combinedStats: {
    totalTrades: number;
    winRate: number;
    totalPnL: number;
    totalPrizesWon: number;
  };
  competitionStats: {
    competitionsWon: number;
    totalCompetitionsEntered: number;
  };
  challengeStats?: {
    totalChallengesWon: number;
    totalChallengesEntered: number;
  };
  walletData: {
    currentBalance: number;
  };
  isKYCVerified?: boolean;
}

export default function ProfileHeader({
  session,
  levelData,
  combinedStats,
  competitionStats,
  challengeStats,
  walletData,
  isKYCVerified = false,
}: ProfileHeaderProps) {
  const { profileImage, hasCustomImage } = useUserProfileImage();
  const { settings } = useAppSettings();
  const [showQuickStats, setShowQuickStats] = useState(true);

  const userInitials = session.user.name?.charAt(0) || session.user.email?.charAt(0) || 'U';
  const displayName = session.user.name || 'Trader';
  const memberSince = new Date().getFullYear(); // Would come from user data

  // Calculate total wins
  const totalWins = (competitionStats?.competitionsWon || 0) + (challengeStats?.totalChallengesWon || 0);

  return (
    <div className="relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        </div>
        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 sm:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Main Profile Row */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-8">
            {/* Avatar Section */}
            <div className="relative flex-shrink-0">
              <div className="relative group">
                {/* Animated Ring */}
                <div 
                  className="absolute -inset-1 rounded-full opacity-75 blur-sm group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `conic-gradient(from 0deg, ${levelData.currentColor}, transparent, ${levelData.currentColor})` }}
                />
                
                {/* Avatar */}
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden ring-4 ring-gray-800 bg-gradient-to-br from-gray-700 to-gray-800">
                  {profileImage && hasCustomImage ? (
                    <img
                      src={profileImage}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div 
                      className="w-full h-full flex items-center justify-center text-4xl font-bold text-white"
                      style={{ backgroundColor: levelData.currentColor + '40' }}
                    >
                      {userInitials.toUpperCase()}
                    </div>
                  )}
                  
                  {/* Camera Overlay */}
                  <button className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-8 h-8 text-white" />
                  </button>
                </div>

                {/* Level Badge */}
                <div 
                  className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-lg border-2 border-gray-800"
                  style={{ backgroundColor: levelData.currentColor }}
                >
                  <span className="text-white drop-shadow">{levelData.currentIcon}</span>
                </div>

                {/* Verified Badge */}
                {isKYCVerified && (
                  <div className="absolute -top-1 -right-1 w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center shadow-lg border-2 border-gray-800">
                    <Verified className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            </div>

            {/* Info Section */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-white truncate">
                  {displayName}
                </h1>
                
                {/* Title Badge */}
                <div 
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold w-fit"
                  style={{ 
                    backgroundColor: levelData.currentColor + '20',
                    color: levelData.currentColor,
                    border: `1px solid ${levelData.currentColor}40`
                  }}
                >
                  <span>{levelData.currentIcon}</span>
                  <span>{levelData.currentTitle}</span>
                  <span className="text-xs opacity-70">Lv.{levelData.currentLevel}</span>
                </div>
              </div>

              <p className="text-gray-400 mb-4 text-sm sm:text-base">{session.user.email}</p>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>Member since {memberSince}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <span>{levelData.currentXP.toLocaleString()} XP</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span>{totalWins} Wins</span>
                </div>
              </div>
            </div>

            {/* Quick Balance Card */}
            <div className="lg:text-right">
              <div className="inline-flex flex-col items-start lg:items-end bg-gray-800/50 backdrop-blur rounded-2xl p-4 border border-gray-700/50">
                <span className="text-xs text-gray-400 mb-1 uppercase tracking-wider">Balance</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white tabular-nums">
                    {(walletData?.currentBalance || 0).toLocaleString(undefined, { 
                      minimumFractionDigits: settings?.credits.decimals || 0,
                      maximumFractionDigits: settings?.credits.decimals || 0
                    })}
                  </span>
                  <span className="text-yellow-500 text-xl">{settings?.credits.symbol || '⚡'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Toggle */}
          <button 
            onClick={() => setShowQuickStats(!showQuickStats)}
            className="mt-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <span>Quick Stats</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showQuickStats ? 'rotate-180' : ''}`} />
          </button>

          {/* Quick Stats Row */}
          <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 transition-all duration-300 ${
            showQuickStats ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 overflow-hidden'
          }`}>
            <QuickStatCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Total Trades"
              value={combinedStats.totalTrades.toString()}
              color="text-blue-400"
            />
            <QuickStatCard
              icon={<Trophy className="w-4 h-4" />}
              label="Win Rate"
              value={`${combinedStats.winRate.toFixed(1)}%`}
              color="text-green-400"
            />
            <QuickStatCard
              icon={<Trophy className="w-4 h-4" />}
              label="Competitions"
              value={competitionStats.totalCompetitionsEntered.toString()}
              color="text-yellow-400"
            />
            <QuickStatCard
              icon={<Swords className="w-4 h-4" />}
              label="Challenges"
              value={challengeStats?.totalChallengesEntered?.toString() || '0'}
              color="text-orange-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStatCard({ 
  icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  color: string;
}) {
  return (
    <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl px-4 py-3 border border-gray-700/30 hover:border-gray-600/50 transition-colors">
      <div className={`flex items-center gap-2 ${color} mb-1`}>
        {icon}
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="text-lg font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

