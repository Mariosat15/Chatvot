"use client";

import { ShieldCheck } from "lucide-react";
import AccessFundingFields from "@/components/gamemaster/AccessFundingFields";
import FreePrivateReserveSummary from "@/components/gamemaster/FreePrivateReserveSummary";
import type { CompetitionVisibility } from "@/lib/services/gamemaster/competition-visibility";
import type { FundingMode } from "@/lib/services/gamemaster/free-private-competition";

/**
 * Step 3 of the trading Game Master wizard: who can join and who pays the entry fee.
 *
 * It is a step rather than a strip above the wizard (owner, 2 Oct 2026) so the Game Master
 * must make the choice before Next works; `accessFundingStepError` is the gate.
 */
export default function TradingAccessFundingStep({
  visibilityOptions,
  visibility,
  onVisibility,
  fundingOffered,
  fundingMode,
  onFundingMode,
  entryFee,
  maxParticipants,
  walletBalance,
  currencySymbol,
}: {
  visibilityOptions: readonly CompetitionVisibility[];
  visibility: CompetitionVisibility | undefined;
  onVisibility: (next: CompetitionVisibility) => void;
  fundingOffered: boolean;
  fundingMode: FundingMode | undefined;
  onFundingMode?: (next: FundingMode) => void;
  entryFee: number;
  maxParticipants: number;
  walletBalance: number | null;
  currencySymbol: string;
}) {
  const funded = fundingOffered && fundingMode === "gm_funded";
  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-blue-500/50 rounded-2xl shadow-2xl shadow-blue-500/10 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Access &amp; Funding</h2>
            <p className="text-blue-100 text-sm">Who can join, and who pays the entry fee</p>
          </div>
        </div>
      </div>
      <div className="p-8 space-y-6">
        <AccessFundingFields
          visibilityOptions={visibilityOptions}
          visibility={visibility}
          onVisibility={onVisibility}
          fundingOffered={fundingOffered}
          fundingMode={fundingMode}
          onFundingMode={onFundingMode}
        />
        {funded && (
          <FreePrivateReserveSummary
            entryFee={entryFee}
            maxParticipants={maxParticipants}
            walletBalance={walletBalance}
            currencySymbol={currencySymbol}
          />
        )}
      </div>
    </div>
  );
}
