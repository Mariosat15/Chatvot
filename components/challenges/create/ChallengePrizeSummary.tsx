"use client";

import { Trophy, Zap } from "lucide-react";

interface ChallengePrizeSummaryProps {
  prizePool: number;
  platformFeePercentage: number;
  platformFeeAmount: number;
  winnerPrize: number;
}

/**
 * What the two entry fees add up to, and what is left after the platform's cut.
 *
 * The arithmetic is NOT done here - it is passed in, because the same three figures are
 * recomputed server-side by the create route from the stored `ChallengeSettings`, and a second
 * calculation in the browser is a second answer to "what does the winner take". This component
 * renders numbers; it does not produce them.
 */
export default function ChallengePrizeSummary({
  prizePool,
  platformFeePercentage,
  platformFeeAmount,
  winnerPrize,
}: ChallengePrizeSummaryProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-orange-500/25 bg-gradient-to-br from-orange-950/40 via-gray-900/80 to-red-950/30">
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />
      <div className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                Total Prize Pool
              </p>
              <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500">
                {prizePool} credits
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-center">
              <p className="text-[10px] text-gray-500 uppercase">Platform Fee</p>
              <p className="text-sm font-bold text-red-400">
                -{platformFeeAmount}
              </p>
              <p className="text-[10px] text-gray-600">
                ({platformFeePercentage}%)
              </p>
            </div>
            <div className="w-px h-8 bg-gray-700" />
            <div className="text-center">
              <p className="text-[10px] text-gray-500 uppercase flex items-center gap-1 justify-center">
                <Zap className="h-3 w-3 text-yellow-500" />
                Winner Takes
              </p>
              <p className="text-lg font-black text-green-400">{winnerPrize}</p>
              <p className="text-[10px] text-gray-600">credits</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
