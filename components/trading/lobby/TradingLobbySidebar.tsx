import { CalendarDays } from "lucide-react";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import type { DifficultyLevel } from "@/lib/utils/competition-difficulty";
import type { TitleLevel } from "@/lib/constants/levels";
import { NeonNote, NeonPanel } from "@/components/neon/Cards";
import CompetitionEntryButton from "@/components/trading/CompetitionEntryButton";
import LiveCountdown from "@/components/trading/LiveCountdown";
import PrizeTable from "@/components/competitions/PrizeTable";
import { resolveLevelName } from "@/lib/utils/level-title";

/**
 * The trading lobby's right-hand column.
 *
 * THE ORDER IS THE DESIGN, and it is the one thing to preserve if this file is ever
 * reorganised: act, then time, then decide, then read. The entry control comes first because it
 * is why a player opened the page; the countdown and schedule follow because they decide whether
 * to act now; the difficulty and the prize table follow because they decide whether to act at
 * all. Reference material a trader merely needs to *know* (assets, rules, scoring, risk,
 * disqualification, prize mechanics) is no longer here: since 12 Oct 2026 it is the tab bar
 * under the leaderboard (`TradingDetailTabs`), on the owner's mark-up.
 *
 * WHAT IS DELIBERATELY NOT COLLAPSED: the entry control, the countdown, the schedule, the level
 * requirement, the difficulty and the prize table. The prize table in particular is the figure
 * a trader is deciding on, and burying it would be the same error as an aggregate that quietly
 * means trading only - correct-looking and wrong where it matters.
 */

interface DifficultyData {
  level: DifficultyLevel;
  label: string;
  score: number;
}

/**
 * The difficulty tint. A `Map` keyed by level, holding the label class the card needs written
 * out in full - an interpolated `bg-${colour}-500` compiles to nothing, because Tailwind only
 * emits classes it can see in the source.
 */
const DIFFICULTY_STYLES = new Map<
  DifficultyLevel,
  { text: string }
>([
  ["Novice", { text: "text-emerald-300" }],
  ["Apprentice", { text: "text-emerald-300" }],
  ["Skilled", { text: "text-sky-300" }],
  ["Expert", { text: "text-sky-300" }],
  ["Elite", { text: "text-amber-300" }],
  ["Master", { text: "text-amber-300" }],
  ["Grand Master", { text: "text-orange-300" }],
  ["Champion", { text: "text-orange-300" }],
  ["Legend", { text: "text-rose-300" }],
  ["Trading God", { text: "text-rose-300" }],
]);

/**
 * One schedule line: a coloured dot, the label, and the date in a pill (owner reference,
 * 12 Oct 2026). The dot is the only thing that differs between Start and End.
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

const DIFFICULTY_DESCRIPTIONS = new Map<DifficultyLevel, string>([
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

export interface TradingLobbySidebarProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  difficultyData: DifficultyData;
  /** `AppSettings.credits.symbol`. Replaced a `currSymbol` prop handed the fiat symbol. */
  creditSymbol?: string;
  walletBalance: number;
  isUserIn: boolean;
  isFull: boolean;
  isActive: boolean;
  isUpcoming: boolean;
  isCompleted: boolean;
  participantStatus?: string;
  userLevel: { level: number; title: string; icon: string };
  registrationClosed: boolean;
  formatUTCDate: (date: Date) => string;
  /** The operator's level ladder, passed straight through to the entry button (R88/R90). */
  levelLadder: TitleLevel[];
  /** Viewer id for the own-contest entry ban. */
  currentUserId?: string;
}

export default function TradingLobbySidebar({
  competition,
  difficultyData,
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
  formatUTCDate,
  levelLadder,
  currentUserId,
}: TradingLobbySidebarProps) {
  const difficulty =
    DIFFICULTY_STYLES.get(difficultyData.level) ?? {
      text: "text-gray-300",
      bar: "bg-gray-500",
    };

  return (
    <>
      {/* Act → time → schedule → difficulty → prizes (spec trading sidebar). */}
      {(!isCompleted || isUserIn) && (
        <CompetitionEntryButton
          competition={competition}
          userBalance={walletBalance}
          isUserIn={isUserIn}
          isFull={isFull}
          participantStatus={participantStatus}
          userLevel={userLevel}
          registrationClosed={registrationClosed}
          levelLadder={levelLadder}
          currentUserId={currentUserId}
        />
      )}

      {isUpcoming && (
        <LiveCountdown
          targetDate={new Date(competition.startTime)}
          label="Starts in"
          type="start"
          status="upcoming"
          size="showcase"
        />
      )}
      {isActive && (
        <LiveCountdown
          targetDate={new Date(competition.endTime)}
          label="Time left"
          type="end"
          status="active"
          size="showcase"
        />
      )}

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
          <span className={`text-base font-black ${difficulty.text}`}>
            {difficultyData.label}
          </span>
        }
      >
        {/* Reason: the track carries the whole easy-to-hard gradient and the fill reveals it up
            to the score, so the colour under the end of the fill IS how hard this one is. */}
        <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-black/40">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-rose-500 shadow-[0_0_10px_rgba(56,189,248,0.5)] transition-all"
            style={{ width: `${Math.min(100, Math.max(0, difficultyData.score))}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs font-semibold text-gray-400">
          <span>Easier</span>
          <span className={`font-bold ${difficulty.text}`}>{difficultyData.score}/100</span>
          <span>Harder</span>
        </div>
        <NeonNote>
          {DIFFICULTY_DESCRIPTIONS.get(difficultyData.level) ??
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
          <p className="text-base font-medium text-gray-100">
            {(() => {
              const min = Number(competition.levelRequirement.minLevel);
              const max = competition.levelRequirement.maxLevel
                ? Number(competition.levelRequirement.maxLevel)
                : null;
              /*
                R90: the third site to carry its own ten-entry name map. It named rung 3
                "Skilled" where the ladder says "Trainee", and had no name at all for rungs
                11-20, so a contest gated at level 12 read "Level 12" while the gate itself
                admitted "Market Legend". `resolveLevelName` answers from the operator's
                ladder - the same one the entry button beside this card already reads, which
                is the point: two panels on one page must not disagree about one rung.
              */
              return max
                ? `${resolveLevelName(min, levelLadder)} to ${resolveLevelName(max, levelLadder)}`
                : `${resolveLevelName(min, levelLadder)} or higher`;
            })()}
          </p>
        </NeonPanel>
      )}

      <NeonPanel
        iconSrc={NEON_ICON("trophy-green")}
        accent="prize"
        title="Who wins what"
        size="lg"
        action={
          competition.platformFeePercentage > 0 ? (
            <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-300">
              Fee {competition.platformFeePercentage}%
            </span>
          ) : undefined
        }
      >
        <PrizeTable competition={competition} creditSymbol={creditSymbol} size="lg" />
      </NeonPanel>
    </>
  );
}
