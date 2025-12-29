'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, Loader2, CheckCircle, AlertCircle, DollarSign, History, Ban, Skull, Lock, TrendingUp } from 'lucide-react';
import { enterCompetition } from '@/lib/actions/trading/competition.actions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';

// Level names for display
const LEVEL_NAMES: Record<number, { icon: string; title: string }> = {
  1: { icon: '🌱', title: 'Novice Trader' },
  2: { icon: '📚', title: 'Apprentice Trader' },
  3: { icon: '⚔️', title: 'Skilled Trader' },
  4: { icon: '🎯', title: 'Expert Trader' },
  5: { icon: '💎', title: 'Elite Trader' },
  6: { icon: '👑', title: 'Master Trader' },
  7: { icon: '🔥', title: 'Grand Master' },
  8: { icon: '⚡', title: 'Trading Champion' },
  9: { icon: '🌟', title: 'Market Legend' },
  10: { icon: '👑', title: 'Trading God' },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
interface CompetitionEntryButtonProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  userBalance: number;
  isUserIn: boolean;
  isFull: boolean;
  participantStatus?: string; // 'active' | 'liquidated' | 'disqualified' | 'completed' | 'cancelled'
  userLevel?: { level: number; title: string; icon: string };
}

export default function CompetitionEntryButton({
  competition,
  userBalance,
  isUserIn,
  isFull,
  participantStatus,
  userLevel = { level: 1, title: 'Novice Trader', icon: '🌱' },
}: CompetitionEntryButtonProps) {
  const [entering, setEntering] = useState(false);
  const router = useRouter();

  const entryFee = competition.entryFee || competition.entryFeeCredits || 0;
  const startingCapital = competition.startingCapital || competition.startingTradingPoints || 0;
  const canAfford = userBalance >= entryFee;
  const isActive = competition.status === 'active';
  const isUpcoming = competition.status === 'upcoming';
  const isCompleted = competition.status === 'completed';
  
  // Check level requirements
  const levelReq = competition.levelRequirement;
  const hasLevelReq = levelReq?.enabled;
  const minLevel = levelReq?.minLevel || 1;
  const maxLevel = levelReq?.maxLevel;
  
  // Determine if user meets level requirements
  const meetsMinLevel = !hasLevelReq || userLevel.level >= minLevel;
  const meetsMaxLevel = !hasLevelReq || !maxLevel || userLevel.level <= maxLevel;
  const meetsLevelReq = meetsMinLevel && meetsMaxLevel;
  
  // Get level requirement message
  const getLevelReqMessage = () => {
    if (!hasLevelReq) return null;
    
    const minLevelInfo = LEVEL_NAMES[minLevel] || { icon: '🌱', title: `Level ${minLevel}` };
    const maxLevelInfo = maxLevel ? LEVEL_NAMES[maxLevel] : null;
    
    if (!meetsMinLevel) {
      return {
        type: 'too_low',
        message: `Requires ${minLevelInfo.icon} ${minLevelInfo.title} or higher`,
        detail: `Your level: ${userLevel.icon} ${userLevel.title}`,
      };
    }
    
    if (!meetsMaxLevel && maxLevelInfo) {
      return {
        type: 'too_high',
        message: `Only for traders up to ${maxLevelInfo.icon} ${maxLevelInfo.title}`,
        detail: `Your level: ${userLevel.icon} ${userLevel.title}`,
      };
    }
    
    return null;
  };
  
  const levelReqMessage = getLevelReqMessage();
  
  const canEnter = (isActive || isUpcoming) && !isFull && canAfford && !isUserIn && meetsLevelReq;
  
  // Check if user is disqualified (liquidated or disqualified status)
  const isDisqualified = participantStatus === 'liquidated' || participantStatus === 'disqualified';
  
  // Get disqualification reason for display
  const getDisqualificationReason = () => {
    switch (participantStatus) {
      case 'liquidated':
        return 'Your account was liquidated due to margin call.';
      case 'disqualified':
        return 'You were disqualified from this competition.';
      default:
        return 'You are no longer eligible for prizes.';
    }
  };

  const handleEnter = async () => {
    if (!canAfford) {
      toast.error(`Insufficient balance. Need €${entryFee}`);
      return;
    }

    if (isFull) {
      toast.error('Competition is full');
      return;
    }

    if (isUserIn) {
      toast.info('You are already in this competition');
      return;
    }

    setEntering(true);

    try {
      // Device fingerprinting happens globally via FingerprintProvider
      // Server-side restriction checks happen in enterCompetition action
      await enterCompetition(competition._id);
      toast.success('Successfully entered competition!');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to enter competition');
      setEntering(false);
    }
  };

  return (
    <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-6">
      {/* Already Entered */}
      {isUserIn ? (
        <div className="space-y-4">
          {/* Disqualified State */}
          {isDisqualified ? (
            <>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                {participantStatus === 'liquidated' ? (
                  <Skull className="h-5 w-5 text-red-500 shrink-0" />
                ) : (
                  <Ban className="h-5 w-5 text-red-500 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-red-400">You are disqualified</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {getDisqualificationReason()}
                  </p>
                </div>
              </div>

              <Link href={`/competitions/${competition._id}/trade?viewOnly=true`}>
                <Button className="w-full bg-purple-500 hover:bg-purple-600 cursor-pointer active:scale-95 transition-all duration-150 shadow-lg hover:shadow-purple-500/25">
                  <History className="mr-2 h-4 w-4" />
                  View Trade History
                </Button>
              </Link>
            </>
          ) : (
            /* Active Participant */
            <>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-400">You&apos;re in this competition!</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {isActive ? 'Start trading now' : isCompleted ? 'Competition has ended' : 'Competition will start soon'}
                  </p>
                </div>
              </div>

              {isActive ? (
                <Link href={`/competitions/${competition._id}/trade`}>
                  <Button className="w-full bg-blue-500 hover:bg-blue-600 cursor-pointer active:scale-95 transition-all duration-150 shadow-lg hover:shadow-blue-500/25">
                    <Trophy className="mr-2 h-4 w-4" />
                    Start Trading
                  </Button>
                </Link>
              ) : isUpcoming ? (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-xs text-yellow-400 text-center">
                    ⏰ Trading will unlock when the competition starts
                  </p>
                </div>
              ) : isCompleted ? (
                <Link href={`/competitions/${competition._id}/trade?viewOnly=true`}>
                  <Button className="w-full bg-purple-500 hover:bg-purple-600 cursor-pointer active:scale-95 transition-all duration-150 shadow-lg hover:shadow-purple-500/25">
                    <History className="mr-2 h-4 w-4" />
                    View Trade History
                  </Button>
                </Link>
              ) : null}
            </>
          )}
        </div>
      ) : (
        /* Entry Section */
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-100 mb-2">Entry Requirements</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
                <span className="text-sm text-gray-400">Entry Fee</span>
                <span className="text-sm font-semibold text-gray-100">
                  €{entryFee}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
                <span className="text-sm text-gray-400">Your Balance</span>
                <span
                  className={`text-sm font-semibold ${
                    canAfford ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  €{userBalance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Entry Button */}
          <Button
            onClick={handleEnter}
            disabled={!canEnter || entering}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold 
              disabled:opacity-50 disabled:cursor-not-allowed
              cursor-pointer active:scale-95 transition-all duration-150
              shadow-lg hover:shadow-yellow-500/25"
          >
            {entering ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Entering...
              </>
            ) : !meetsLevelReq ? (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Level Restricted
              </>
            ) : isFull ? (
              'Competition Full'
            ) : !canAfford ? (
              <>
                <DollarSign className="mr-2 h-4 w-4" />
                Need €{Math.abs(entryFee - userBalance).toFixed(2)} More
              </>
            ) : (
              <>
                <Trophy className="mr-2 h-4 w-4" />
                Enter Competition
              </>
            )}
          </Button>

          {/* Level Requirement Warning */}
          {levelReqMessage && (
            <div className={`flex items-start gap-2 p-3 rounded-lg ${
              levelReqMessage.type === 'too_low' 
                ? 'bg-purple-500/10 border border-purple-500/20' 
                : 'bg-orange-500/10 border border-orange-500/20'
            }`}>
              {levelReqMessage.type === 'too_low' ? (
                <TrendingUp className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
              ) : (
                <Lock className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`text-xs font-medium ${
                  levelReqMessage.type === 'too_low' ? 'text-purple-400' : 'text-orange-400'
                }`}>
                  {levelReqMessage.message}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {levelReqMessage.detail}
                </p>
                {levelReqMessage.type === 'too_low' && (
                  <Link href="/profile">
                    <Button
                      variant="link"
                      className="h-auto p-0 text-xs text-purple-400 underline mt-1 cursor-pointer hover:text-purple-300 active:scale-95 transition-all"
                    >
                      Level Up Your Account →
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Warnings */}
          {!canAfford && meetsLevelReq && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-red-400">
                  Insufficient balance. Deposit more credits to enter.
                </p>
                <Link href="/wallet">
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs text-red-400 underline mt-1 cursor-pointer hover:text-red-300 active:scale-95 transition-all"
                  >
                    Go to Wallet
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {isFull && meetsLevelReq && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-400">
                This competition has reached maximum participants.
              </p>
            </div>
          )}

          {/* Info */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-blue-300">
              ℹ️ Entry fee is non-refundable. You will receive{' '}
              ${startingCapital.toLocaleString()} in trading capital to compete.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

