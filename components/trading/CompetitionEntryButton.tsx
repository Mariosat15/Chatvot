'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, Loader2, CheckCircle, AlertCircle, DollarSign } from 'lucide-react';
import { enterCompetition } from '@/lib/actions/trading/competition.actions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';

interface CompetitionEntryButtonProps {
  competition: any;
  userBalance: number;
  isUserIn: boolean;
  isFull: boolean;
}

export default function CompetitionEntryButton({
  competition,
  userBalance,
  isUserIn,
  isFull,
}: CompetitionEntryButtonProps) {
  const [entering, setEntering] = useState(false);
  const router = useRouter();

  const entryFee = competition.entryFee || competition.entryFeeCredits || 0;
  const startingCapital = competition.startingCapital || competition.startingTradingPoints || 0;
  const canAfford = userBalance >= entryFee;
  const isActive = competition.status === 'active';
  const isUpcoming = competition.status === 'upcoming';
  const canEnter = (isActive || isUpcoming) && !isFull && canAfford && !isUserIn;

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
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-400">You're in this competition!</p>
              <p className="text-xs text-gray-400 mt-1">
                {isActive ? 'Start trading now' : 'Competition will start soon'}
              </p>
            </div>
          </div>

          {isActive ? (
            <Link href={`/competitions/${competition._id}/trade`}>
              <Button className="w-full bg-blue-500 hover:bg-blue-600">
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
          ) : null}
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
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {entering ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Entering...
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

          {/* Warnings */}
          {!canAfford && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-red-400">
                  Insufficient balance. Deposit more credits to enter.
                </p>
                <Link href="/wallet">
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs text-red-400 underline mt-1"
                  >
                    Go to Wallet
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {isFull && (
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

