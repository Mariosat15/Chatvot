import { Crown, Target, Trophy } from "lucide-react";
import type { DifficultyLevel } from "@/lib/utils/competition-difficulty";
import { NeonAccordion } from "@/components/neon/Accordion";
import { NeonNote, NeonPanel, NeonRow } from "@/components/neon/Cards";
import CompetitionEntryButton from "@/components/trading/CompetitionEntryButton";
import LiveCountdown from "@/components/trading/LiveCountdown";
import { buildTradingLobbySections } from "@/components/trading/lobby/trading-lobby-accordions";
import TradingPrizeTable from "@/components/trading/lobby/TradingPrizeTable";

/**
 * The trading lobby's right-hand column.
 *
 * THE ORDER IS THE DESIGN, and it is the one thing to preserve if this file is ever
 * reorganised: act, then time, then decide, then read. The entry control comes first because it
 * is why a player opened the page; the countdown and schedule follow because they decide whether
 * to act now; the difficulty and the prize table follow because they decide whether to act at
 * all; and everything a trader merely needs to *know* is last and collapsed.
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

interface RiskSettings {
  maxLeverage: number;
  marginLiquidation: number;
  marginCall: number;
  marginWarning: number;
  marginSafe: number;
}

/* The level names, moved here with the card that renders them and nothing else. */
const LEVEL_NAMES = [
  "",
  "Novice",
  "Apprentice",
  "Skilled",
  "Expert",
  "Elite",
  "Master",
  "Grand Master",
  "Champion",
  "Legend",
  "Trading God",
];

function levelName(value: number): string {
  /*
    `at()` rather than `[]`, because the value comes from a competition document. Array indexing
    with an unchecked number is the same class of sink as object indexing with an unchecked key,
    and the original code needed an eslint suppression on each of the two reads to say so.
  */
  return LEVEL_NAMES.at(value) || `Level ${value}`;
}

/**
 * The difficulty tint. A `Map` keyed by level, holding the two classes the card needs written
 * out in full - an interpolated `bg-${colour}-500` compiles to nothing, because Tailwind only
 * emits classes it can see in the source.
 */
const DIFFICULTY_STYLES = new Map<
  DifficultyLevel,
  { text: string; bar: string }
>([
  ["Novice", { text: "text-emerald-300", bar: "bg-emerald-500" }],
  ["Apprentice", { text: "text-emerald-300", bar: "bg-emerald-400" }],
  ["Skilled", { text: "text-sky-300", bar: "bg-sky-500" }],
  ["Expert", { text: "text-sky-300", bar: "bg-sky-400" }],
  ["Elite", { text: "text-amber-300", bar: "bg-amber-500" }],
  ["Master", { text: "text-amber-300", bar: "bg-amber-400" }],
  ["Grand Master", { text: "text-orange-300", bar: "bg-orange-500" }],
  ["Champion", { text: "text-orange-300", bar: "bg-orange-400" }],
  ["Legend", { text: "text-rose-300", bar: "bg-rose-500" }],
  ["Trading God", { text: "text-rose-300", bar: "bg-rose-600" }],
]);

const DIFFICULTY_DESCRIPTIONS = new Map<DifficultyLevel, string>([
  ["Novice", "Perfect for new traders learning the basics."],
  ["Apprentice", "Building your trading skills with room to grow."],
  ["Skilled", "Moderate challenge with balanced risk."],
  ["Expert", "Higher stakes for experienced traders."],
  ["Elite", "Challenging competition for skilled traders."],
  ["Master", "Professional level competition."],
  [
    "Grand Master",
    "Very challenging. Expert risk management required.",
  ],
  ["Champion", "Elite competition with high pressure."],
  ["Legend", "Extreme difficulty for the best traders only."],
  ["Trading God", "Ultimate challenge. Only legends survive."],
]);

export interface TradingLobbySidebarProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  competition: any;
  riskSettings: RiskSettings;
  difficultyData: DifficultyData;
  currSymbol: string;
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
}

export default function TradingLobbySidebar({
  competition,
  riskSettings,
  difficultyData,
  currSymbol,
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
}: TradingLobbySidebarProps) {
  const difficulty =
    DIFFICULTY_STYLES.get(difficultyData.level) ?? {
      text: "text-gray-300",
      bar: "bg-gray-500",
    };

  const sections = buildTradingLobbySections({
    competition,
    riskSettings,
    currSymbol,
  });

  return (
    <div className="space-y-4">
      {/* Act. */}
      {(!isCompleted || isUserIn) && (
        <CompetitionEntryButton
          competition={competition}
          userBalance={walletBalance}
          isUserIn={isUserIn}
          isFull={isFull}
          participantStatus={participantStatus}
          userLevel={userLevel}
          registrationClosed={registrationClosed}
        />
      )}

      {isUpcoming && (
        <LiveCountdown
          targetDate={new Date(competition.startTime)}
          label="Competition starts in"
          type="start"
          status="upcoming"
        />
      )}
      {isActive && (
        <LiveCountdown
          targetDate={new Date(competition.endTime)}
          label="Time remaining"
          type="end"
          status="active"
        />
      )}

      {/* When. */}
      <NeonPanel icon={Target} accent="players" title="Schedule (UTC)">
        <div className="space-y-2">
          <NeonRow
            label="Start"
            value={formatUTCDate(new Date(competition.startTime))}
          />
          <NeonRow
            label="End"
            value={formatUTCDate(new Date(competition.endTime))}
          />
        </div>
      </NeonPanel>

      {/* Decide. */}
      <NeonPanel
        icon={Target}
        accent="score"
        title="Difficulty"
        action={
          <span className={`text-xs font-bold ${difficulty.text}`}>
            {difficultyData.label}
          </span>
        }
      >
        <div className="h-2 overflow-hidden rounded-full bg-[#080C18]">
          <div
            className={`h-full transition-all ${difficulty.bar}`}
            style={{ width: `${difficultyData.score}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-gray-500">
          <span>Easier</span>
          <span className={difficulty.text}>{difficultyData.score}/100</span>
          <span>Harder</span>
        </div>
        <NeonNote>
          {DIFFICULTY_DESCRIPTIONS.get(difficultyData.level) ??
            "Moderate challenge with balanced risk."}
        </NeonNote>
      </NeonPanel>

      {competition.levelRequirement?.enabled && (
        <NeonPanel icon={Crown} accent="score" title="Level requirement">
          <p className="text-sm font-medium text-gray-100">
            {(() => {
              const min = Number(competition.levelRequirement.minLevel);
              const max = competition.levelRequirement.maxLevel
                ? Number(competition.levelRequirement.maxLevel)
                : null;
              return max
                ? `${levelName(min)} to ${levelName(max)}`
                : `${levelName(min)} or higher`;
            })()}
          </p>
        </NeonPanel>
      )}

      <NeonPanel
        icon={Trophy}
        accent="prize"
        title="Prize distribution"
        action={
          competition.platformFeePercentage > 0 ? (
            <span className="text-[11px] text-sky-300">
              Fee {competition.platformFeePercentage}%
            </span>
          ) : undefined
        }
      >
        <TradingPrizeTable competition={competition} currSymbol={currSymbol} />
      </NeonPanel>

      {/* Read. */}
      <NeonAccordion sections={sections} />
    </div>
  );
}
