'use client';

import { TitleLevel } from '@/lib/constants/levels';
import { Trophy, Zap, Target, TrendingUp } from 'lucide-react';

interface XPProgressBarProps {
  currentXP: number;
  currentLevel: number;
  currentTitle: string;
  currentIcon: string;
  currentDescription: string;
  currentColor: string;
  totalBadgesEarned: number;
  badgeXPValues: { common: number; rare: number; epic: number; legendary: number };
  titleLevels: TitleLevel[];
}

export default function XPProgressBar({
  currentXP,
  currentLevel,
  currentTitle,
  currentIcon,
  currentDescription,
  currentColor,
  totalBadgesEarned,
  badgeXPValues,
  titleLevels,
}: XPProgressBarProps) {
  // Use the title, icon, description from database (passed as props)
  const levelData = {
    level: currentLevel,
    title: currentTitle,
    icon: currentIcon,
    description: currentDescription,
    color: currentColor,
    minXP: titleLevels[currentLevel - 1]?.minXP || 0,
    maxXP: titleLevels[currentLevel - 1]?.maxXP || 0,
  };

  const getNextTitle = (currentLevel: number) => {
    if (currentLevel >= titleLevels.length) return null;
    return titleLevels[currentLevel];
  };

  const nextLevel = getNextTitle(currentLevel);

  let progressPercent = 100;
  let xpToNext = 0;

  if (nextLevel) {
    const xpInCurrentLevel = currentXP - levelData.minXP;
    const xpNeededForNextLevel = nextLevel.minXP - levelData.minXP;
    progressPercent = Math.min(100, (xpInCurrentLevel / xpNeededForNextLevel) * 100);
    xpToNext = nextLevel.minXP - currentXP;
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-purple-500/20 via-dark-800 to-dark-900 p-6 shadow-xl border border-purple-500/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-purple-500/20 border border-purple-500/30">
            <Trophy className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Trader Level & Title</h2>
            <p className="text-sm text-gray-400">Earn XP by collecting badges</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm text-gray-400">Total XP</p>
          <p className="text-2xl font-bold text-purple-400 tabular-nums">{currentXP.toLocaleString()}</p>
        </div>
      </div>

      {/* Current Title Card */}
      <div className="mb-6">
        <div className={`rounded-xl p-6 bg-gradient-to-r from-purple-600/30 to-blue-600/30 border-2 border-purple-500/50 shadow-lg`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-5xl">{levelData.icon}</div>
              <div>
                <p className="text-sm text-gray-300 uppercase tracking-wide">Current Title</p>
                <h3 className={`text-3xl font-bold ${levelData.color}`}>{currentTitle}</h3>
                <p className="text-sm text-gray-400 mt-1">{levelData.description}</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30">
                    <p className="text-xs font-semibold text-purple-300">Level {currentLevel}</p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30">
                    <p className="text-xs font-semibold text-blue-300">
                      {totalBadgesEarned} {totalBadgesEarned === 1 ? 'Badge' : 'Badges'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress to Next Level */}
      {nextLevel ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-400" />
              <p className="text-sm font-semibold text-white">Next Title:</p>
              <span className={`text-sm font-bold ${nextLevel.color}`}>
                {nextLevel.icon} {nextLevel.title}
              </span>
            </div>
            <p className="text-sm text-gray-400">
              <span className="text-purple-400 font-semibold">{xpToNext}</span> XP needed
            </p>
          </div>

          {/* Progress Bar */}
          <div className="relative">
            <div className="h-6 bg-dark-700 rounded-full overflow-hidden border border-dark-600">
              <div
                className="h-full bg-gradient-to-r from-purple-600 via-purple-500 to-blue-500 transition-all duration-500 ease-out relative"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>
            <p className="text-center text-xs font-bold text-white mt-2">
              {progressPercent.toFixed(1)}% Complete
            </p>
          </div>

          {/* Next Level Description */}
          <div className="mt-4 p-4 rounded-lg bg-dark-800/50 border border-dark-600">
            <p className="text-xs text-gray-400">{nextLevel.description}</p>
          </div>
        </div>
      ) : (
        <div className="text-center p-6 rounded-xl bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border-2 border-yellow-500/50">
          <div className="text-4xl mb-3">🎉</div>
          <h3 className="text-2xl font-bold text-yellow-400 mb-2">Maximum Level Reached!</h3>
          <p className="text-sm text-gray-300">You've achieved the highest trading title!</p>
        </div>
      )}

      {/* All Levels Preview */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-purple-400" />
          <h3 className="text-lg font-bold text-white">All Title Levels</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {titleLevels.map((level) => {
            const isCurrentLevel = level.level === currentLevel;
            const isCompleted = currentLevel > level.level;
            const isLocked = currentLevel < level.level;

            return (
              <div
                key={level.level}
                className={`p-4 rounded-lg border transition-all ${
                  isCurrentLevel
                    ? 'bg-purple-500/20 border-purple-500/50 shadow-lg shadow-purple-500/20'
                    : isCompleted
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-dark-800/30 border-dark-600 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`text-3xl ${isLocked ? 'grayscale opacity-40' : ''}`}>
                    {level.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-bold ${isLocked ? 'text-gray-500' : level.color}`}>
                        {level.title}
                      </p>
                      {isCurrentLevel && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500 text-white text-xs font-semibold">
                          Current
                        </span>
                      )}
                      {isCompleted && (
                        <span className="px-2 py-0.5 rounded-full bg-green-500 text-white text-xs font-semibold">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Level {level.level} • {level.minXP.toLocaleString()}+ XP
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* XP Earning Guide */}
      <div className="mt-6 p-4 rounded-lg bg-dark-800/50 border border-dark-600">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-5 w-5 text-yellow-400" />
          <h4 className="text-sm font-bold text-white">How to Earn XP</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center p-3 rounded-lg bg-dark-700/50">
            <p className="text-gray-400 text-xs mb-1">⭐ Common</p>
            <p className="text-green-400 font-bold text-lg">+{badgeXPValues.common} XP</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-dark-700/50">
            <p className="text-gray-400 text-xs mb-1">💎 Rare</p>
            <p className="text-blue-400 font-bold text-lg">+{badgeXPValues.rare} XP</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-dark-700/50">
            <p className="text-gray-400 text-xs mb-1">👑 Epic</p>
            <p className="text-purple-400 font-bold text-lg">+{badgeXPValues.epic} XP</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-dark-700/50">
            <p className="text-gray-400 text-xs mb-1">🌟 Legendary</p>
            <p className="text-yellow-400 font-bold text-lg">+{badgeXPValues.legendary} XP</p>
          </div>
        </div>
      </div>
    </div>
  );
}

