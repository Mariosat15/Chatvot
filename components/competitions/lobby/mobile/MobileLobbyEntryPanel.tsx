import type { TitleLevel } from "@/lib/constants/levels";
import CompetitionEntryButton from "@/components/trading/CompetitionEntryButton";
import { NeonPanel } from "@/components/neon/Cards";
import { NEON_ICON } from "@/lib/services/games/overview-assets";

/**
 * Full-width entry card above long rules (Complobyymobile §7).
 * Same `CompetitionEntryButton` as desktop — eligibility stays server-side.
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
    <NeonPanel
      iconSrc={NEON_ICON("wallet-blue")}
      accent="entry"
      title="Your entry"
      size="lg"
    >
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
      />
    </NeonPanel>
  );
}
