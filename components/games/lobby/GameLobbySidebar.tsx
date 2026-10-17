import { CalendarDays } from "lucide-react";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import type { TitleLevel } from "@/lib/constants/levels";
import { NeonPanel } from "@/components/neon/Cards";
import ContestCountdown from "@/components/games/ContestCountdown";
import {
  LobbyLiveEntryButton,
  LobbyLivePrizePanel,
} from "@/components/games/LobbyLiveParts";
import { CompetitionRulesFairPlay } from "@/components/competitions/detail/CompetitionRulesFairPlay";
import { resolveLevelName } from "@/lib/utils/level-title";

/**
 * Right-hand column for the desktop game lobby — same order as
 * `TradingLobbySidebar`: act → time → schedule → level (if any) → prizes → fair play.
 *
 * Difficulty is trading-only and deliberately omitted. The clock is `ContestCountdown`
 * (server-anchored), not trading's browser `LiveCountdown`.
 */

function ScheduleLine({
  label,
  value,
  dotClassName,
}: {
  label: string;
  value: string;
  dotClassName: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2.5 text-sm font-semibold text-gray-300">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClassName}`} aria-hidden />
        {label}
      </span>
      <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/35 px-3 py-1.5 text-sm font-semibold tabular-nums text-white">
        <CalendarDays className="h-4 w-4 text-sky-300" aria-hidden />
        {value}
      </span>
    </div>
  );
}

export interface GameLobbySidebarProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  creditSymbol?: string;
  walletBalance: number;
  isUserIn: boolean;
  isFull: boolean;
  isActive: boolean;
  isUpcoming: boolean;
  isCompleted: boolean;
  participantStatus?: string;
  userLevel?: { level: number; title: string; icon: string };
  registrationClosed?: boolean;
  levelLadder: TitleLevel[];
  currentUserId?: string;
  /** Formatted UTC strings for the schedule card. */
  startLabel: string | null;
  endLabel: string | null;
  countdownTarget?: Date | string | number | null;
  countdownLabel: string;
  countdownVariant: "start" | "end";
  serverNow?: string;
  showCountdown: boolean;
  /** Optional note under the schedule (play-mode rule). */
  scheduleNote?: React.ReactNode;
  /** Missing launch keys — shown under the entry control. */
  launchBlocked?: React.ReactNode;
}

export function GameLobbySidebar({
  competition,
  creditSymbol,
  walletBalance,
  isUserIn,
  isFull,
  isActive,
  isUpcoming,
  isCompleted,
  participantStatus,
  userLevel,
  registrationClosed,
  levelLadder,
  currentUserId,
  startLabel,
  endLabel,
  countdownTarget,
  countdownLabel,
  countdownVariant,
  serverNow,
  showCountdown,
  scheduleNote,
  launchBlocked,
}: GameLobbySidebarProps) {
  return (
    <>
      {(!isCompleted || isUserIn) && (
        <>
          <LobbyLiveEntryButton
            competition={competition}
            userBalance={walletBalance}
            isUserIn={isUserIn}
            isFull={isFull}
            participantStatus={participantStatus}
            userLevel={userLevel}
            registrationClosed={registrationClosed}
            levelLadder={levelLadder}
            currentUserId={currentUserId}
            appearance="default"
          />
          {launchBlocked}
        </>
      )}

      {showCountdown && countdownTarget != null && (isUpcoming || isActive) && (
        <ContestCountdown
          target={countdownTarget}
          serverNow={serverNow}
          label={countdownLabel}
          variant={countdownVariant}
          size="showcase"
        />
      )}

      {(startLabel || endLabel) && (
        <NeonPanel
          iconSrc={NEON_ICON("calendar-blue")}
          accent="players"
          title="Schedule (UTC)"
          size="lg"
        >
          <div className="space-y-3">
            {startLabel && (
              <ScheduleLine
                label="Start"
                value={startLabel}
                dotClassName="bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
              />
            )}
            {endLabel && (
              <ScheduleLine
                label="End"
                value={endLabel}
                dotClassName="bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]"
              />
            )}
          </div>
          {scheduleNote ? <div className="mt-3">{scheduleNote}</div> : null}
        </NeonPanel>
      )}

      {competition.levelRequirement?.enabled && (
        <NeonPanel
          iconSrc={NEON_ICON("crown")}
          accent="score"
          title="Level requirement"
          size="lg"
        >
          <p className="text-base font-medium text-gray-100">
            {(() => {
              const min = Number(competition.levelRequirement.minLevel);
              const max = competition.levelRequirement.maxLevel
                ? Number(competition.levelRequirement.maxLevel)
                : null;
              return max
                ? `${resolveLevelName(min, levelLadder)} to ${resolveLevelName(max, levelLadder)}`
                : `${resolveLevelName(min, levelLadder)} or higher`;
            })()}
          </p>
        </NeonPanel>
      )}

      <LobbyLivePrizePanel
        initialCompetition={competition}
        creditSymbol={creditSymbol}
        title="Who wins what"
        size="lg"
      />

      <CompetitionRulesFairPlay />
    </>
  );
}
