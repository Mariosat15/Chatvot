'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Swords } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

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

export interface VsOpponent {
  username: string;
  profileImage?: string;
  level?: number;
  winRate?: number;
  totalTrades?: number;
  challengesEntered?: number;
  matchScore?: number;
}

interface VsScreenProps {
  show: boolean;
  player1Name: string;
  player1Image?: string;
  opponent: VsOpponent;
  onChallenge: () => void;
  onClose: () => void;
}

export default function VsScreen({ 
  show,
  player1Name,
  player1Image,
  opponent,
  onChallenge, 
  onClose 
}: VsScreenProps) {
  const levelInfo = LEVEL_INFO[opponent.level || 3];
  
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={(e) => {
            // Only close if clicking directly on backdrop, not its children
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative w-full max-w-4xl mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* VS Card Container */}
            <div className="relative h-[420px] flex rounded-2xl overflow-hidden shadow-2xl">
              {/* Player 1 Side - Pink/Magenta */}
              <div className="w-1/2 relative overflow-hidden">
                {/* Gradient Background with ray effects */}
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500 via-pink-600 to-fuchsia-700" />
                <div className="absolute inset-0 opacity-20">
                  {/* Rays emanating from center */}
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-1/2 left-full w-[200%] h-3 bg-white/30 origin-left"
                      style={{ transform: `rotate(${i * 15 - 90}deg)` }}
                    />
                  ))}
                </div>
                
                {/* Content */}
                <div className="relative h-full flex flex-col items-center justify-center p-8">
                  {/* Avatar Circle */}
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    className="w-28 h-28 rounded-full bg-gradient-to-br from-pink-300 to-pink-500 flex items-center justify-center mb-5 shadow-2xl border-4 border-white/40 overflow-hidden"
                  >
                    {player1Image ? (
                      <Image
                        src={player1Image}
                        alt={player1Name}
                        width={112}
                        height={112}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-5xl font-bold text-white drop-shadow-lg">{player1Name.charAt(0).toUpperCase()}</span>
                    )}
                  </motion.div>
                  
                  <motion.h3
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl md:text-3xl font-bold text-white mb-4 drop-shadow-lg text-center"
                  >
                    {player1Name}
                  </motion.h3>
                  
                  {/* Player 1 Badge */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className="px-5 py-2 rounded-full bg-pink-400/80 border-2 border-white/50 shadow-lg"
                  >
                    <span className="text-white font-bold text-sm tracking-wide">CHALLENGER</span>
                  </motion.div>
                </div>
              </div>
              
              {/* Player 2 Side - Purple */}
              <div className="w-1/2 relative overflow-hidden">
                {/* Gradient Background with ray effects */}
                <div className="absolute inset-0 bg-gradient-to-bl from-purple-500 via-purple-600 to-indigo-800" />
                <div className="absolute inset-0 opacity-20">
                  {/* Rays emanating from center */}
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-1/2 right-full w-[200%] h-3 bg-white/30 origin-right"
                      style={{ transform: `rotate(${i * 15 - 90}deg)` }}
                    />
                  ))}
                </div>
                
                {/* Content */}
                <div className="relative h-full flex flex-col items-center justify-center p-8">
                  {/* Avatar Circle */}
                  <motion.div
                    initial={{ scale: 0, rotate: 180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    className="w-28 h-28 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center mb-5 shadow-2xl border-4 border-white/40 overflow-hidden"
                  >
                    {opponent.profileImage ? (
                      <Image
                        src={opponent.profileImage}
                        alt={opponent.username}
                        width={112}
                        height={112}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-5xl font-bold text-white drop-shadow-lg">{opponent.username.charAt(0).toUpperCase()}</span>
                    )}
                  </motion.div>
                  
                  <motion.h3
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl md:text-3xl font-bold text-white mb-2 drop-shadow-lg text-center"
                  >
                    {opponent.username}
                  </motion.h3>
                  
                  {/* Level Badge */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4 }}
                    className={cn(
                      "px-4 py-1.5 rounded-full mb-3 flex items-center gap-2 border-2 border-white/30",
                      levelInfo.bgColor,
                      levelInfo.color
                    )}
                  >
                    <span>{levelInfo.icon}</span>
                    <span className="font-semibold text-sm">{levelInfo.label}</span>
                  </motion.div>
                  
                  {/* Match Score */}
                  {opponent.matchScore !== undefined && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.5 }}
                      className="px-5 py-2 rounded-full bg-purple-400/80 border-2 border-white/50 shadow-lg"
                    >
                      <span className="text-white font-bold text-sm">{opponent.matchScore.toFixed(0)}% MATCH</span>
                    </motion.div>
                  )}
                </div>
              </div>
              
              {/* Center VS Badge */}
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
              >
                <div className="relative">
                  {/* Outer glow */}
                  <div className="absolute inset-0 bg-white rounded-2xl blur-xl opacity-60 scale-125" />
                  
                  {/* VS Badge */}
                  <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center border-4 border-white shadow-2xl transform rotate-45">
                    <span className="text-3xl font-black text-white -rotate-45 tracking-wider">VS</span>
                  </div>
                </div>
              </motion.div>
              
              {/* Diagonal Line */}
              <div className="absolute inset-y-0 left-1/2 w-1 bg-white/90 -translate-x-1/2 skew-x-6 shadow-lg" />
            </div>
            
            {/* Action Buttons */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex justify-center gap-4 mt-6"
            >
              <Button
                onClick={onClose}
                variant="outline"
                size="lg"
                className="px-6 py-5 text-base font-semibold bg-gray-800/80 border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <X className="h-5 w-5 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={onChallenge}
                size="lg"
                className="px-6 py-5 text-base font-semibold bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/30"
              >
                <Swords className="h-5 w-5 mr-2" />
                Challenge Now!
              </Button>
            </motion.div>
            
            {/* Stats Comparison */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-5 grid grid-cols-3 gap-3 max-w-md mx-auto"
            >
              <div className="text-center p-3 bg-gray-800/60 rounded-xl border border-gray-700/50">
                <p className="text-xs text-gray-500 mb-1">Win Rate</p>
                <p className={cn(
                  "text-lg font-bold",
                  (opponent.winRate ?? 0) >= 50 ? "text-green-400" : "text-red-400"
                )}>
                  {opponent.winRate?.toFixed(0) ?? '0'}%
                </p>
              </div>
              <div className="text-center p-3 bg-gray-800/60 rounded-xl border border-gray-700/50">
                <p className="text-xs text-gray-500 mb-1">Total Trades</p>
                <p className="text-lg font-bold text-white">{opponent.totalTrades ?? 0}</p>
              </div>
              <div className="text-center p-3 bg-gray-800/60 rounded-xl border border-gray-700/50">
                <p className="text-xs text-gray-500 mb-1">Challenges</p>
                <p className="text-lg font-bold text-purple-400">{opponent.challengesEntered ?? 0}</p>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

