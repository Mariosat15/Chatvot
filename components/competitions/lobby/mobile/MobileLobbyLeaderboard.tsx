"use client";

import { useState } from "react";
import CompetitionLeaderboard from "@/components/trading/CompetitionLeaderboard";
import { NeonCountPill, NeonPanel } from "@/components/neon/Cards";
import { NEON_ICON } from "@/lib/services/games/overview-assets";

const PREVIEW_ROWS = 5;

/**
 * Compact top standings + View all (Complobyymobile §11).
 * Empty state comes from CompetitionLeaderboard; no fabricated rows.
 */

export function MobileLobbyLeaderboard({
  leaderboard,
  userParticipantId,
  prizeDistribution,
  minimumTrades,
  competitionStatus,
  playersLabel = "traders",
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leaderboard: any[];
  userParticipantId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prizeDistribution: any;
  minimumTrades: number;
  competitionStatus: string;
  playersLabel?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const preview = leaderboard.slice(0, PREVIEW_ROWS);
  const rows = showAll ? leaderboard : preview;
  const canExpand = leaderboard.length > PREVIEW_ROWS;

  return (
    <div id="competition-leaderboard-mobile" className="scroll-mt-24">
      <NeonPanel
        iconSrc={NEON_ICON("trophy-blue")}
        accent="prize"
        title="Leaderboard"
        size="lg"
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            <NeonCountPill>
              {leaderboard.length} {playersLabel}
            </NeonCountPill>
            {canExpand ? (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="min-h-11 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 text-xs font-bold text-cyan-200"
              >
                {showAll ? "Show less" : "View all"}
              </button>
            ) : null}
          </div>
        }
      >
        <CompetitionLeaderboard
          leaderboard={rows}
          userParticipantId={userParticipantId}
          prizeDistribution={prizeDistribution}
          minimumTrades={minimumTrades}
          competitionStatus={competitionStatus}
        />
      </NeonPanel>
    </div>
  );
}
