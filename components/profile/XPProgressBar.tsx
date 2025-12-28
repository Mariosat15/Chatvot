'use client';

import { useState } from 'react';
import { TitleLevel } from '@/lib/constants/levels';
import { Trophy, Zap, Target, TrendingUp, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [showDetails, setShowDetails] = useState(false);
  
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
    <div className="space-y-4">
      {/* Compact Header - Always Visible */}
      <div className="flex items-center gap-4">
        {/* Level Icon */}
        <div className="relative">
          <div 
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg"
            style={{ backgroundColor: `${currentColor}20`, border: `2px solid ${currentColor}40` }}
          >
            {currentIcon}
          </div>
          <div 
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-slate-800 border-2"
            style={{ borderColor: currentColor, color: currentColor }}
          >
            {currentLevel}
          </div>
        </div>

        {/* Title & Progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-white text-lg truncate" style={{ color: currentColor }}>
              {currentTitle}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
              {totalBadgesEarned} badges
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: currentColor }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
              {currentXP.toLocaleString()} XP
            </span>
          </div>
          
          {/* Next Level Info */}
          {nextLevel && (
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-slate-400">{xpToNext.toLocaleString()}</span> XP to{' '}
              <span style={{ color: nextLevel.color }}>{nextLevel.icon} {nextLevel.title}</span>
            </p>
          )}
        </div>

        {/* Expand Button */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors text-slate-400 hover:text-white"
        >
          {showDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-4 border-t border-slate-700/50 space-y-4">
              {/* Current Level Details */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Current Level</p>
                <p className="text-sm text-slate-300">{currentDescription}</p>
              </div>

              {/* Max Level Reached */}
              {!nextLevel && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 text-center">
                  <Sparkles className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                  <p className="font-bold text-yellow-400">Maximum Level Reached!</p>
                  <p className="text-xs text-slate-300 mt-1">You&apos;ve achieved the highest trading title!</p>
                </div>
              )}

              {/* All Levels Grid */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-slate-400" />
                  <h4 className="text-sm font-semibold text-white">All Levels</h4>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {titleLevels.map((level) => {
                    const isCurrentLevel = level.level === currentLevel;
                    const isCompleted = currentLevel > level.level;
                    const isLocked = currentLevel < level.level;

                    return (
                      <div
                        key={level.level}
                        className={`p-3 rounded-lg border transition-all ${
                          isCurrentLevel
                            ? 'bg-purple-500/20 border-purple-500/50'
                            : isCompleted
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-slate-800/30 border-slate-700/30 opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-xl ${isLocked ? 'grayscale' : ''}`}>
                            {level.icon}
                          </span>
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold truncate ${isLocked ? 'text-slate-500' : ''}`} style={{ color: isLocked ? undefined : level.color }}>
                              {level.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              {level.minXP.toLocaleString()}+ XP
                            </p>
                          </div>
                          {isCurrentLevel && (
                            <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500 text-white">NOW</span>
                          )}
                          {isCompleted && (
                            <span className="ml-auto text-green-400 text-xs">✓</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* XP Guide */}
              <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <h4 className="text-xs font-semibold text-white">Earn XP from Badges</h4>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-slate-500">Common</p>
                    <p className="text-sm font-bold text-green-400">+{badgeXPValues.common}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Rare</p>
                    <p className="text-sm font-bold text-blue-400">+{badgeXPValues.rare}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Epic</p>
                    <p className="text-sm font-bold text-purple-400">+{badgeXPValues.epic}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Legendary</p>
                    <p className="text-sm font-bold text-yellow-400">+{badgeXPValues.legendary}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
