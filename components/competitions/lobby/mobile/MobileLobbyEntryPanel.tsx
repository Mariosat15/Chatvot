import type { TitleLevel } from "@/lib/constants/levels";
import CompetitionEntryButton from "@/components/trading/CompetitionEntryButton";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import { MobileLobbyCard } from "./MobileLobbyCard";

/**
 * "Your entry" - the status, the Reserve / Join button, the fee and balance and the entry
 * deadline in one card (mobile fix guide, point 5).
 *
 * Same `CompetitionEntryButton` as desktop: every eligibility rule, sentence and the button
 * itself live there, and `layout="mobile"` changes only how they are arranged.
 */

export function MobileLobbyEntryPanel({
  competition,
  walletBalance,
  isUserIn,
  isFull,
  registrationClosed,
  userParticipant,
  userLevel,
  levelLadder,
  currentUserId,
  show,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  walletBalance: number;
  isUserIn: boolean;
  isFull: boolean;
  registrationClosed: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userParticipant: any;
  userLevel: { level: number; title: string; icon: string };
  levelLadder: TitleLevel[];
  currentUserId?: string;
  show: boolean;
}) {
  if (!show) return null;

  return (
    <MobileLobbyCard id="lobby-entry" iconSrc={NEON_ICON("wallet-blue")} title="Your entry">
      <CompetitionEntryButton
        competition={competition}
        userBalance={walletBalance}
        isUserIn={isUserIn}
        isFull={isFull}
        participantStatus={userParticipant?.status}
        userLevel={userLevel}
        registrationClosed={registrationClosed}
        levelLadder={levelLadder}
        currentUserId={currentUserId}
        layout="mobile"
      />
    </MobileLobbyCard>
  );
}
