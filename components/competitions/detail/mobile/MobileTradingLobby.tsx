import { ArrowLeft, BarChart3, CalendarDays } from "lucide-react";
import { COMPETITIONS_ARENA_BG } from "@/lib/competitions/game-definitions";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import type { DifficultyLevel } from "@/lib/utils/competition-difficulty";
import type { TitleLevel } from "@/lib/constants/levels";
import CompetitionEntryButton from "@/components/trading/CompetitionEntryButton";
import LiveCountdown from "@/components/trading/LiveCountdown";
import CompetitionLeaderboard from "@/components/trading/CompetitionLeaderboard";
import CompetitionDashboard from "@/components/trading/CompetitionDashboard";
import TradingLobbyHero from "@/components/trading/lobby/TradingLobbyHero";
import type { NeonAccordionSection } from "@/components/neon/Accordion";
import type { TradingOverviewCopy } from "@/components/competitions/lobby/trading-overview-copy";
import PrizeTable from "@/components/competitions/PrizeTable";
import { NeonCountPill, NeonNote, NeonPanel } from "@/components/neon/Cards";
import { NeonPill } from "@/components/neon/Buttons";
import { resolveLevelName } from "@/lib/utils/level-title";
import { MobileTradingStats } from "./MobileTradingStats";
import { MobileTradingInfo } from "./MobileTradingInfo";

/**
 * Dedicated phone trading competition detail (below `md`).
 *
 * Order on a 360–430px screen: header → stats → register → countdown → info →
 * leaderboard → schedule/difficulty → prizes. Desktop stays in `DesktopTradingLobby`
 * (`hidden md:block`); this tree must never import that shell's two-column layout.
 */

const DIFFICULTY_TEXT = new Map<DifficultyLevel, string>([
  ["Novice", "text-emerald-300"],
  ["Apprentice", "text-emerald-300"],
  ["Skilled", "text-sky-300"],
  ["Expert", "text-sky-300"],
  ["Elite", "text-amber-300"],
  ["Master", "text-amber-300"],
  ["Grand Master", "text-orange-300"],
  ["Champion", "text-orange-300"],
  ["Legend", "text-rose-300"],
  ["Trading God", "text-rose-300"],
]);

const DIFFICULTY_COPY = new Map<DifficultyLevel, string>([
  ["Novice", "Great first game - learn as you go!"],
  ["Apprentice", "Easy going, with room to grow."],
  ["Skilled", "A fair fight - not too easy, not too hard."],
  ["Expert", "Tougher rivals. Bring your A-game!"],
  ["Elite", "Hard. Only sharp traders will shine."],
  ["Master", "Very hard. The pros come here."],
  ["Grand Master", "Brutal! Guard your money every move."],
  ["Champion", "Huge pressure, huge glory."],
  ["Legend", "Only the very best survive this one."],
  ["Trading God", "The final boss. Good luck!"],
]);

export type MobileTradingLobbyProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leaderboard: any[];
  creditSymbol?: string;
  bannerUrl?: string | null;
  isCancelled: boolean;
  isActive: boolean;
  isUpcoming: boolean;
  isCompleted: boolean;
  isUserIn: boolean;
  isFull: boolean;
  registrationClosed: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userParticipant: any;
  competitionId: string;
  walletBalance: number;
  userLevel: { level: number; title: string; icon: string };
  levelLadder: TitleLevel[];
  currentUserId?: string;
  difficultyData: {
    level: DifficultyLevel;
    label: string;
    score: number;
  };
  formatUTCDate: (date: Date) => string;
  /** Built once on the page and shared with the desktop tree. */
  sections: NeonAccordionSection[];
  overview: TradingOverviewCopy;
};

export function MobileTradingLobby({
  competition,
  leaderboard,
  creditSymbol,
  bannerUrl,
  isCancelled,
  isActive,
  isUpcoming,
  isCompleted,
  isUserIn,
  isFull,
  registrationClosed,
  userParticipant,
  competitionId,
  walletBalance,
  userLevel,
  levelLadder,
  currentUserId,
  difficultyData,
  formatUTCDate,
  sections,
  overview,
}: MobileTradingLobbyProps) {
  const difficultyTone =
    DIFFICULTY_TEXT.get(difficultyData.level) ?? "text-gray-300";

  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundImage: `linear-gradient(rgba(1,7,20,.35), rgba(1,7,20,.55)), url(${COMPETITIONS_ARENA_BG})`,
        backgroundSize: "cover",
        backgroundPosition: "top center",
      }}
    >
      <div
        className="mx-auto flex w-full max-w-[430px] flex-col gap-4 px-3 pt-4"
        style={{
          paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
        }}
      >
        {/* 1 — Nav + header */}
        <div className="flex flex-wrap items-center gap-2">
          <NeonPill
            href="/competitions"
            icon={ArrowLeft}
            label="Competitions"
          />
          {isCompleted && isUserIn && (
            <NeonPill
              href={`/competitions/${competitionId}/results`}
              icon={BarChart3}
              label="Results"
            />
          )}
        </div>

        <TradingLobbyHero
          competition={competition}
          bannerUrl={bannerUrl}
          isCancelled={isCancelled}
        />

        {/* 2 — Stats */}
        <MobileTradingStats
          competition={competition}
          creditSymbol={creditSymbol}
          isActive={isActive}
          isUpcoming={isUpcoming}
          isCompleted={isCompleted}
          isCancelled={isCancelled}
        />

        {/* 3 — Registration (act first) */}
        {(!isCompleted || isUserIn) && (
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
        )}

        {/* 4 — Countdown */}
        {isUpcoming && (
          <LiveCountdown
            targetDate={new Date(competition.startTime)}
            label="Starts in"
            type="start"
            status="upcoming"
          />
        )}
        {isActive && (
          <LiveCountdown
            targetDate={new Date(competition.endTime)}
            label="Time left"
            type="end"
            status="active"
          />
        )}

        {/* 5 — Overview / Battle plan / rules */}
        <MobileTradingInfo
          description={competition.description}
          sections={sections}
          overview={overview}
        />

        {/* 6 — Leaderboard */}
        <div id="competition-leaderboard-mobile" className="scroll-mt-20">
          <NeonPanel
            iconSrc={NEON_ICON("trophy-blue")}
            accent="prize"
            title="Leaderboard"
            size="lg"
            action={
              <div className="flex flex-wrap items-center gap-1.5">
                <NeonCountPill>{leaderboard.length} traders</NeonCountPill>
                {competition.rules?.minimumTrades > 0 && (
                  <NeonCountPill tone="warn">
                    Min {competition.rules.minimumTrades}
                  </NeonCountPill>
                )}
              </div>
            }
          >
            <CompetitionLeaderboard
              leaderboard={leaderboard}
              userParticipantId={userParticipant?._id}
              prizeDistribution={competition.prizeDistribution}
              minimumTrades={competition.rules?.minimumTrades || 0}
              competitionStatus={competition.status}
            />
          </NeonPanel>
        </div>

        {isUserIn && userParticipant && (
          <CompetitionDashboard
            competitionId={competitionId}
            initialParticipant={{
              _id: userParticipant._id.toString(),
              currentCapital: userParticipant.currentCapital,
              pnl: userParticipant.pnl,
              pnlPercentage: userParticipant.pnlPercentage,
              totalTrades: userParticipant.totalTrades,
              currentRank: userParticipant.currentRank,
              winningTrades: userParticipant.winningTrades,
              losingTrades: userParticipant.losingTrades,
              status: userParticipant.status,
            }}
            competitionStatus={
              isCancelled
                ? "cancelled"
                : isCompleted
                  ? "completed"
                  : isActive
                    ? "active"
                    : "upcoming"
            }
            startTime={new Date(competition.startTime).toISOString()}
            endTime={new Date(competition.endTime).toISOString()}
            startingCapital={
              competition.startingCapital ||
              competition.startingTradingPoints ||
              10000
            }
            competitionRules={
              competition.rules
                ? {
                    minimumTrades: competition.rules.minimumTrades,
                    minimumWinRate: competition.rules.minimumWinRate,
                    disqualifyOnLiquidation:
                      competition.rules.disqualifyOnLiquidation,
                  }
                : undefined
            }
            totalParticipants={competition.currentParticipants}
            competitionName={competition.name}
            rankingMethod={competition.rankingMethod}
            entryFee={competition.entryFee ?? competition.entryFeeCredits}
            creditSymbol={creditSymbol}
          />
        )}

        {/* 7 — Schedule + difficulty */}
        <NeonPanel
          iconSrc={NEON_ICON("calendar-blue")}
          accent="players"
          title="Schedule (UTC)"
          size="lg"
        >
          <div className="space-y-3">
            <ScheduleLine
              label="Start"
              value={formatUTCDate(new Date(competition.startTime))}
              dotClassName="bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
            />
            <ScheduleLine
              label="End"
              value={formatUTCDate(new Date(competition.endTime))}
              dotClassName="bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]"
            />
          </div>
        </NeonPanel>

        <NeonPanel
          iconSrc={NEON_ICON("target-purple")}
          accent="score"
          title="Difficulty"
          size="lg"
          action={
            <span className={`text-sm font-black ${difficultyTone}`}>
              {difficultyData.label}
            </span>
          }
        >
          <div className="h-2.5 overflow-hidden rounded-full border border-white/10 bg-black/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-rose-500"
              style={{
                width: `${Math.min(100, Math.max(0, difficultyData.score))}%`,
              }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-semibold text-gray-400">
            <span>Easier</span>
            <span className={`font-bold ${difficultyTone}`}>
              {difficultyData.score}/100
            </span>
            <span>Harder</span>
          </div>
          <NeonNote>
            {DIFFICULTY_COPY.get(difficultyData.level) ??
              "A fair fight - not too easy, not too hard."}
          </NeonNote>
        </NeonPanel>

        {competition.levelRequirement?.enabled && (
          <NeonPanel
            iconSrc={NEON_ICON("crown")}
            accent="score"
            title="Level requirement"
            size="lg"
          >
            <p className="text-sm font-medium text-gray-100">
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

        {/* 8 — Winner rewards */}
        <NeonPanel
          iconSrc={NEON_ICON("trophy-green")}
          accent="prize"
          title="Who wins what"
          size="lg"
          action={
            competition.platformFeePercentage > 0 ? (
              <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-bold text-sky-300">
                Fee {competition.platformFeePercentage}%
              </span>
            ) : undefined
          }
        >
          <PrizeTable competition={competition} creditSymbol={creditSymbol} />
        </NeonPanel>
      </div>
    </div>
  );
}

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
    <div className="flex items-start justify-between gap-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-gray-300">
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotClassName}`}
          aria-hidden
        />
        {label}
      </span>
      <span className="inline-flex max-w-[62%] items-center gap-1.5 rounded-lg border border-white/10 bg-black/35 px-2.5 py-1.5 text-right text-xs font-semibold tabular-nums text-white">
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-sky-300" aria-hidden />
        <span className="min-w-0 break-words">{value}</span>
      </span>
    </div>
  );
}
