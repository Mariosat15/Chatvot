'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Image from 'next/image';
import {
  Swords,
  X,
  Heart,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Trophy,
  Target,
  TrendingUp,
  Zap,
  Loader2,
  RefreshCw,
  Users,
  Award,
  BarChart3,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ChallengeCreateDialog from '@/components/challenges/ChallengeCreateDialog';
import VsScreen from '@/components/challenges/VsScreen';

interface MatchableTrader {
  userId: string;
  email: string;
  username: string;
  profileImage?: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';
  winRate: number;
  totalTrades: number;
  totalPnl: number;
  totalPnlPercentage: number;
  profitFactor: number;
  competitionsEntered: number;
  competitionsWon: number;
  challengesEntered: number;
  challengesWon: number;
  totalBadges: number;
  legendaryBadges: number;
  overallScore: number;
  isOnline: boolean;
  acceptingChallenges: boolean;
  matchScore?: number;
}

interface MatchResult {
  trader: MatchableTrader;
  matchScore: number;
  matchReasons: string[];
}

const LEVEL_INFO: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: string; gradient: string }> = {
  beginner: { label: 'Beginner', color: 'text-gray-300', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-400/40', icon: '🌱', gradient: 'from-gray-400 to-gray-500' },
  intermediate: { label: 'Intermediate', color: 'text-blue-300', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-400/40', icon: '📈', gradient: 'from-blue-400 to-blue-500' },
  advanced: { label: 'Advanced', color: 'text-purple-300', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-400/40', icon: '⚡', gradient: 'from-purple-400 to-purple-500' },
  expert: { label: 'Expert', color: 'text-orange-300', bgColor: 'bg-orange-500/20', borderColor: 'border-orange-400/40', icon: '🔥', gradient: 'from-orange-400 to-orange-500' },
  master: { label: 'Master', color: 'text-yellow-300', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-400/40', icon: '👑', gradient: 'from-yellow-400 to-amber-500' },
};

// Convert level string to number for VsScreen
function getLevelNumber(level: string): number {
  const levelMap: Record<string, number> = {
    beginner: 1,
    apprentice: 2,
    intermediate: 3,
    advanced: 4,
    expert: 5,
    master: 6,
    grandmaster: 7,
    legend: 8,
  };
  return levelMap[level.toLowerCase()] || 3;
}

interface MatchmakingCardsProps {
  currentUserId?: string;
}

export default function MatchmakingCards({ currentUserId: _currentUserId }: MatchmakingCardsProps) {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [findingMatch, setFindingMatch] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const [dragX, setDragX] = useState(0);
  const [challengeDialogOpen, setChallengeDialogOpen] = useState(false);
  const [selectedTrader, setSelectedTrader] = useState<{ userId: string; username: string } | null>(null);
  const [showVsScreen, setShowVsScreen] = useState(false);
  const [vsMatch, setVsMatch] = useState<MatchResult | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('You');
  const [currentUserImage, setCurrentUserImage] = useState<string | undefined>();

  const fetchMatches = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/matchmaking?action=ranked&limit=50');
      const data = await response.json();

      if (data.success) {
        setMatches(data.matches);
        setCurrentIndex(0);
      } else {
        toast.error('Failed to load matches');
      }
      
      // Get current user's name and profile image
      try {
        const userRes = await fetch('/api/user/profile');
        const userData = await userRes.json();
        const user = userData.user || userData;
        if (user?.name) {
          setCurrentUserName(user.name);
        }
        if (user?.profileImage) {
          setCurrentUserImage(user.profileImage);
        }
      } catch {
        // Ignore - use default "You"
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
      toast.error('Failed to load matches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const handleSwipe = (swipeDirection: 'left' | 'right') => {
    setDirection(swipeDirection);
    
    if (swipeDirection === 'right' && matches[currentIndex]) {
      const match = matches[currentIndex];
      const trader = match.trader;
      // Show VS screen
      setVsMatch(match);
      setShowVsScreen(true);
      setDirection(null);
      return; // Don't move to next card - let user complete challenge flow
    }
    
    // Move to next card (only for skip)
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setDirection(null);
      setDragX(0);
    }, 300);
  };

  const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setDragX(info.offset.x);
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      handleSwipe('right');
    } else if (info.offset.x < -threshold) {
      handleSwipe('left');
    }
    setDragX(0);
  };

  // Direct challenge button click
  const handleDirectChallenge = () => {
    const match = matches[currentIndex];
    const trader = match?.trader;
    if (!trader) {
      toast.error('No trader selected');
      return;
    }
    
    // Show warning if trader is not online
    if (!trader.isOnline) {
      toast.info(`${trader.username} may be offline - challenge will be pending`);
    }
    
    // Show VS screen
    setVsMatch(match);
    setShowVsScreen(true);
  };

  const handleFindBestMatch = async () => {
    try {
      setFindingMatch(true);
      const response = await fetch('/api/matchmaking?action=best');
      const data = await response.json();

      if (data.success && data.match) {
        // Show VS screen
        setVsMatch(data.match);
        setShowVsScreen(true);
        
        // Find this trader in the deck for later
        const matchIndex = matches.findIndex(m => m.trader.userId === data.match.trader.userId);
        if (matchIndex !== -1) {
          setCurrentIndex(matchIndex);
        }
      } else {
        toast.error('No suitable matches found', {
          description: 'Try again later when more traders are online',
        });
      }
    } catch (error) {
      console.error('Error finding best match:', error);
      toast.error('Failed to find match');
    } finally {
      setFindingMatch(false);
    }
  };
  
  const handleVsChallenge = () => {
    if (!vsMatch) return;
    const trader = { userId: vsMatch.trader.userId, username: vsMatch.trader.username };
    setSelectedTrader(trader);
    setShowVsScreen(false);
    setTimeout(() => {
      setChallengeDialogOpen(true);
    }, 200);
  };
  
  const handleVsClose = () => {
    setShowVsScreen(false);
    setTimeout(() => {
      if (!challengeDialogOpen) {
        setVsMatch(null);
      }
    }, 200);
  };

  const currentMatch = matches[currentIndex];
  const nextMatch = matches[currentIndex + 1];

  // Calculate swipe indicators
  const swipeProgress = Math.min(Math.abs(dragX) / 150, 1);
  const isSwipingRight = dragX > 30;
  const isSwipingLeft = dragX < -30;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 animate-pulse" />
          <Loader2 className="absolute inset-0 m-auto h-10 w-10 text-white animate-spin" />
        </div>
        <p className="text-gray-400 mt-6 text-lg">Finding traders to match...</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center mb-6">
          <Users className="h-12 w-12 text-gray-600" />
        </div>
        <h3 className="text-2xl font-bold text-gray-200 mb-3">No Traders Found</h3>
        <p className="text-gray-500 text-center max-w-md mb-8">
          There are no other traders available to match with right now. Check back later!
        </p>
        <Button onClick={fetchMatches} size="lg" className="bg-gradient-to-r from-pink-500 to-purple-600">
          <RefreshCw className="h-5 w-5 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  if (currentIndex >= matches.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-24 h-24 rounded-full bg-gradient-to-r from-yellow-500/20 to-amber-500/20 flex items-center justify-center mb-6">
          <Sparkles className="h-12 w-12 text-yellow-500" />
        </div>
        <h3 className="text-2xl font-bold text-gray-200 mb-3">You&apos;ve seen everyone!</h3>
        <p className="text-gray-500 text-center max-w-md mb-8">
          You&apos;ve browsed through all available traders. Refresh to see new traders or use auto-match!
        </p>
        <div className="flex gap-4">
          <Button onClick={() => setCurrentIndex(0)} variant="outline" size="lg">
            <RefreshCw className="h-5 w-5 mr-2" />
            Start Over
          </Button>
          <Button onClick={handleFindBestMatch} disabled={findingMatch} size="lg" className="bg-gradient-to-r from-pink-500 to-purple-600">
            {findingMatch ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5 mr-2" />
            )}
            Auto Match
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full px-4 py-6">
      {/* Auto Match Button */}
      <div className="mb-5 w-full max-w-md">
        <Button
          onClick={handleFindBestMatch}
          disabled={findingMatch}
          className="w-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:from-pink-600 hover:via-purple-600 hover:to-indigo-600 text-white font-bold py-4 text-lg shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 hover:scale-[1.02]"
        >
          {findingMatch ? (
            <Loader2 className="h-6 w-6 mr-3 animate-spin" />
          ) : (
            <Sparkles className="h-6 w-6 mr-3" />
          )}
          Find Best Match
        </Button>
        <p className="text-xs text-gray-500 text-center mt-2">
          Auto-matches you with a trader of similar skill level
        </p>
      </div>

      {/* Swipe Instructions */}
      <div className="flex items-center justify-center gap-8 mb-4 w-full max-w-md">
        <div className={cn(
          "flex items-center gap-2 transition-all duration-300",
          isSwipingLeft ? "text-red-400 scale-110" : "text-gray-500"
        )}>
          <ChevronLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Swipe to Skip</span>
        </div>
        <div className={cn(
          "flex items-center gap-2 transition-all duration-300",
          isSwipingRight ? "text-green-400 scale-110" : "text-gray-500"
        )}>
          <span className="text-sm font-medium">Swipe to Challenge</span>
          <ChevronRight className="h-5 w-5" />
        </div>
      </div>

      {/* Card Stack - Tall enough to show all content without scrolling */}
      <div className="relative w-full max-w-md h-[520px]">
        {/* Next card (behind) */}
        {nextMatch && (
          <div className="absolute inset-0 transform scale-[0.92] translate-y-3 opacity-40 pointer-events-none">
            <TraderCard match={nextMatch} />
          </div>
        )}

        {/* Current card */}
        <AnimatePresence mode="wait">
          {currentMatch && (
            <motion.div
              key={currentMatch.trader.userId}
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{
                scale: 1,
                opacity: 1,
                y: 0,
                x: direction === 'left' ? -400 : direction === 'right' ? 400 : 0,
                rotate: direction === 'left' ? -20 : direction === 'right' ? 20 : dragX * 0.05,
              }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
              style={{ touchAction: 'pan-y' }}
            >
              <TraderCard match={currentMatch} swipeProgress={swipeProgress} isSwipingRight={isSwipingRight} isSwipingLeft={isSwipingLeft} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Swipe Overlays */}
        <AnimatePresence>
          {direction === 'left' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute top-8 left-8 z-20"
            >
              <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-8 py-3 rounded-xl text-2xl font-black transform -rotate-12 shadow-2xl shadow-red-500/50 border-2 border-red-400">
                SKIP ✕
              </div>
            </motion.div>
          )}
          {direction === 'right' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute top-8 right-8 z-20"
            >
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-8 py-3 rounded-xl text-2xl font-black transform rotate-12 shadow-2xl shadow-green-500/50 border-2 border-green-400">
                ⚔️ BATTLE!
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-5 mt-4 w-full max-w-md">
        {/* Skip Button */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => handleSwipe('left')}
          className="group flex flex-col items-center gap-1"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-red-500/50 flex items-center justify-center shadow-lg shadow-red-500/20 group-hover:border-red-500 group-hover:shadow-red-500/40 transition-all">
            <X className="h-7 w-7 text-red-500" />
          </div>
          <span className="text-[10px] text-gray-500 font-semibold group-hover:text-red-400 transition-colors uppercase tracking-wide">Skip</span>
        </motion.button>

        {/* Back Button */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="group flex flex-col items-center gap-1 disabled:opacity-30 disabled:pointer-events-none"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-600 flex items-center justify-center shadow-lg group-hover:border-gray-500 transition-all">
            <RefreshCw className="h-4 w-4 text-gray-400" />
          </div>
          <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-wide">Undo</span>
        </motion.button>

        {/* Challenge Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          onClick={handleDirectChallenge}
          className="group flex flex-col items-center gap-1"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 flex items-center justify-center shadow-xl shadow-green-500/30 group-hover:shadow-green-500/50 transition-all ring-4 ring-green-500/20 group-hover:ring-green-500/40">
            <Swords className="h-8 w-8 text-white" />
          </div>
          <span className="text-[10px] text-gray-400 font-bold group-hover:text-green-400 transition-colors uppercase tracking-wide">Challenge</span>
        </motion.button>
      </div>

      {/* Progress */}
      <div className="mt-4 w-full max-w-md">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">
            {currentIndex + 1} of {matches.length} traders
          </span>
          <span className="text-xs text-gray-500">
            {Math.round(((currentIndex + 1) / matches.length) * 100)}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / matches.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Challenge Dialog */}
      <ChallengeCreateDialog
        open={challengeDialogOpen}
        onOpenChange={(open) => {
          setChallengeDialogOpen(open);
          if (!open) {
            setVsMatch(null);
          }
        }}
        challengedUser={selectedTrader}
      />
      
      {/* VS Screen */}
      {vsMatch && (
        <VsScreen
          show={showVsScreen}
          player1Name={currentUserName}
          player1Image={currentUserImage}
          opponent={{
            username: vsMatch.trader.username,
            profileImage: vsMatch.trader.profileImage,
            level: getLevelNumber(vsMatch.trader.level),
            winRate: vsMatch.trader.winRate,
            totalTrades: vsMatch.trader.totalTrades,
            challengesEntered: vsMatch.trader.challengesEntered,
            matchScore: vsMatch.matchScore,
          }}
          onChallenge={handleVsChallenge}
          onClose={handleVsClose}
        />
      )}
    </div>
  );
}

// Trader Card Component
function TraderCard({ match, swipeProgress = 0, isSwipingRight = false, isSwipingLeft = false }: { 
  match: MatchResult; 
  swipeProgress?: number;
  isSwipingRight?: boolean;
  isSwipingLeft?: boolean;
}) {
  const { trader, matchScore, matchReasons } = match;
  const levelInfo = LEVEL_INFO[trader.level];
  const [imageError, setImageError] = useState(false);

  return (
    <div className="w-full h-full relative overflow-hidden rounded-3xl">
      {/* Card Border Glow Effect */}
      <div className={cn(
        "absolute -inset-0.5 rounded-3xl transition-all duration-300",
        isSwipingRight && "bg-gradient-to-r from-green-500 to-emerald-500 opacity-60 blur-sm",
        isSwipingLeft && "bg-gradient-to-r from-red-500 to-pink-500 opacity-60 blur-sm",
        !isSwipingRight && !isSwipingLeft && "bg-gradient-to-r from-purple-500/30 via-pink-500/30 to-indigo-500/30"
      )} />
      
      {/* Main Card */}
      <div className="relative w-full h-full bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 rounded-3xl border border-gray-800 overflow-hidden flex flex-col">
        {/* Decorative Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-500/10 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-pink-500/10 to-transparent rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-800/20 via-transparent to-transparent" />
        </div>
        
        {/* Content Container */}
        <div className="relative h-full flex flex-col overflow-hidden">
          {/* Header - Always visible */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 bg-gray-900/50">
            {/* Match Score */}
            <motion.div 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-400/30 backdrop-blur-sm"
              animate={{ scale: isSwipingRight ? 1.1 : 1 }}
            >
              <Heart className="h-4 w-4 text-pink-400 fill-pink-400/50" />
              <span className="text-lg font-black bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                {matchScore.toFixed(0)}%
              </span>
            </motion.div>
            
            {/* Online Status */}
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-sm",
              trader.isOnline 
                ? "bg-green-500/20 border border-green-400/30" 
                : "bg-gray-700/50 border border-gray-600/50"
            )}>
              <div className={cn(
                "w-2.5 h-2.5 rounded-full",
                trader.isOnline ? "bg-green-400 animate-pulse shadow-lg shadow-green-400/50" : "bg-gray-500"
              )} />
              <span className={cn(
                "text-xs font-semibold",
                trader.isOnline ? "text-green-400" : "text-gray-500"
              )}>
                {trader.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Profile Section - More vertical space */}
          <div className="flex-shrink-0 px-4 pt-2 pb-4 text-center">
            {/* Profile Image */}
            <div className="relative w-18 h-18 mx-auto mb-2" style={{ width: '72px', height: '72px' }}>
              <div className={cn(
                "absolute -inset-1 rounded-full bg-gradient-to-r",
                levelInfo.gradient,
                "animate-pulse opacity-60"
              )} />
              <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-gray-800 bg-gradient-to-br from-gray-700 to-gray-800">
                {trader.profileImage && !imageError ? (
                  <Image
                    src={trader.profileImage}
                    alt={trader.username}
                    fill
                    className="object-cover"
                    onError={() => setImageError(true)}
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-400">
                      {trader.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Name */}
            <h3 className="text-xl font-black text-white mb-2 drop-shadow-lg">{trader.username}</h3>
            
            {/* Level Badge - More margin below */}
            <div className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold shadow-lg text-sm",
              levelInfo.bgColor,
              levelInfo.borderColor,
              levelInfo.color,
              "border backdrop-blur-sm"
            )}>
              <span>{levelInfo.icon}</span>
              <span>{levelInfo.label}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="flex-shrink-0 mx-4 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
          
          {/* Stats Content Area - No scroll needed */}
          <div className="flex-1 px-3 pt-3">
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {/* Win Rate */}
              <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-lg p-2 border border-green-500/20 text-center">
                <Target className="h-3.5 w-3.5 mx-auto mb-0.5 text-green-400/80" />
                <p className={cn(
                  "text-lg font-black",
                  trader.winRate >= 50 ? "text-green-400" : "text-red-400"
                )}>
                  {trader.winRate.toFixed(0)}%
                </p>
                <span className="text-[8px] text-gray-500 uppercase">Win</span>
              </div>
              
              {/* P&L */}
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg p-2 border border-blue-500/20 text-center">
                <TrendingUp className="h-3.5 w-3.5 mx-auto mb-0.5 text-blue-400/80" />
                <p className={cn(
                  "text-lg font-black",
                  trader.totalPnl >= 0 ? "text-green-400" : "text-red-400"
                )}>
                  {trader.totalPnl >= 0 ? '+' : ''}{trader.totalPnl.toFixed(0)}
                </p>
                <span className="text-[8px] text-gray-500 uppercase">P&L</span>
              </div>
              
              {/* Competitions */}
              <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 rounded-lg p-2 border border-yellow-500/20 text-center">
                <Trophy className="h-3.5 w-3.5 mx-auto mb-0.5 text-yellow-400/80" />
                <p className="text-lg font-black text-yellow-400">{trader.competitionsEntered}</p>
                <span className="text-[8px] text-gray-500 uppercase">Comps</span>
              </div>
              
              {/* Challenges */}
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-lg p-2 border border-purple-500/20 text-center">
                <Swords className="h-3.5 w-3.5 mx-auto mb-0.5 text-purple-400/80" />
                <p className="text-lg font-black text-purple-400">{trader.challengesEntered}</p>
                <span className="text-[8px] text-gray-500 uppercase">1v1</span>
              </div>
            </div>

            {/* Quick Stats Row */}
            <div className="flex justify-center gap-4 py-2 px-3 bg-gray-800/30 rounded-lg border border-gray-700/30 mb-2">
              <div className="text-center">
                <p className="text-sm font-bold text-white">{trader.totalTrades}</p>
                <p className="text-[8px] text-gray-500 uppercase">Trades</p>
              </div>
              <div className="w-px h-8 bg-gray-700 self-center" />
              <div className="text-center">
                <p className={cn(
                  "text-sm font-bold",
                  trader.profitFactor >= 1.5 ? 'text-green-400' : trader.profitFactor >= 1 ? 'text-yellow-400' : 'text-red-400'
                )}>
                  {trader.profitFactor.toFixed(1)}
                </p>
                <p className="text-[8px] text-gray-500 uppercase">P.Factor</p>
              </div>
              <div className="w-px h-8 bg-gray-700 self-center" />
              <div className="text-center">
                <p className="text-sm font-bold text-white">{trader.totalBadges}</p>
                <p className="text-[8px] text-gray-500 uppercase">Badges</p>
              </div>
            </div>

            {/* Match Reasons */}
            {matchReasons.length > 0 && (
              <div>
                <p className="text-[9px] text-gray-500 mb-1 uppercase tracking-wider font-medium text-center">Why you match</p>
                <div className="flex flex-wrap justify-center gap-1">
                  {matchReasons.slice(0, 3).map((reason, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-[9px] font-medium bg-primary-500/10 text-primary-300 border border-primary-500/20"
                    >
                      ✓ {reason}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer - Always visible */}
          <div className="flex-shrink-0 px-3 py-2.5 bg-gray-900/80 border-t border-gray-800/50">
            <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-gray-800/80 to-gray-800/60 rounded-lg border border-gray-700/50 shadow-lg">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-gradient-to-br from-primary-500/40 to-purple-500/40 border border-primary-500/30">
                  <Shield className="h-4 w-4 text-primary-400" />
                </div>
                <span className="text-xs text-gray-200 font-semibold">Score</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black text-primary-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                  {trader.overallScore.toFixed(0)}
                </span>
                <span className="text-[10px] text-gray-500 font-medium">pts</span>
              </div>
            </div>
            
            {/* Availability Warning */}
            {!trader.acceptingChallenges && (
              <div className="mt-1.5 py-1.5 px-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-center">
                <p className="text-[10px] text-yellow-400 font-semibold">⚠️ Not accepting challenges</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
