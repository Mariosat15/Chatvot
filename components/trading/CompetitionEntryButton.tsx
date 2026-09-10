"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Loader2,
  CheckCircle,
  AlertCircle,
  DollarSign,
  History,
  Ban,
  Skull,
  Lock,
  TrendingUp,
  Flag,
  Clock,
} from "lucide-react";
import { enterCompetition } from "@/lib/actions/trading/competition.actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { GameIcon } from "@/components/ui/GameIcon";
import { GAME_ICONS, type GameIconName } from "@/lib/constants/game-icons";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import ActionTermsDialog, {
  ACTION_TERM_SLUGS,
} from "@/components/ActionTermsDialog";
import { isProviderContest } from "@/lib/services/games/contest-config";
import InlineCountdown from "@/components/trading/InlineCountdown";
import {
  describeEntryClose,
  resolveRegistrationDeadline,
} from "@/lib/utils/registration-deadline";
import { formatRemaining } from "@/hooks/useServerClock";
import { formatVolts } from "@/lib/utils/format-volts";

// Level names for display
const LEVEL_NAMES: Record<number, { icon: string; title: string }> = {
  1: { icon: "🌱", title: "Novice Trader" },
  2: { icon: "📚", title: "Apprentice Trader" },
  3: { icon: "⚔️", title: "Skilled Trader" },
  4: { icon: "🎯", title: "Expert Trader" },
  5: { icon: "💎", title: "Elite Trader" },
  6: { icon: "👑", title: "Master Trader" },
  7: { icon: "🔥", title: "Grand Master" },
  8: { icon: "⚡", title: "Trading Champion" },
  9: { icon: "🌟", title: "Market Legend" },
  10: { icon: "👑", title: "Trading God" },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
interface CompetitionEntryButtonProps {
   
  competition: any;
  userBalance: number;
  isUserIn: boolean;
  isFull: boolean;
  participantStatus?: string; // 'active' | 'liquidated' | 'disqualified' | 'completed' | 'cancelled'
  userLevel?: { level: number; title: string; icon: string };
  registrationClosed?: boolean; // Whether registration deadline has passed
}

export default function CompetitionEntryButton({
  competition,
  userBalance,
  isUserIn,
  isFull,
  participantStatus,
  userLevel = { level: 1, title: "Novice Trader", icon: "🌱" },
  registrationClosed = false,
}: CompetitionEntryButtonProps) {
  const [entering, setEntering] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const router = useRouter();
  const { settings } = useAppSettings();
  // Reason: an entry fee and a wallet balance are both credits. `settings.currency.symbol` is
  // the fiat symbol configured for deposits and invoices, and prefixing it here told a player
  // they were paying euros for something the ledger debits in credits.
  const creditSymbol = settings?.credits?.symbol;
  const volts = (amount: number) => formatVolts(amount, { symbol: creditSymbol });

  const entryFee = competition.entryFee || competition.entryFeeCredits || 0;
  const startingCapital =
    competition.startingCapital || competition.startingTradingPoints || 0;
  const canAfford = userBalance >= entryFee;

  /**
   * Whether this contest is played through an external game provider rather than by trading.
   *
   * Reason it uses the strict helper rather than `gameType === "provider"`: this decides where
   * the button SENDS the player, and `/play` can do nothing without a provider key and a game
   * code. A contest labelled provider but missing them would land the player on a screen that
   * can only refuse, whereas leaving them on the contest page at least tells them the truth.
   * That is the opposite of the admin list's question, which is only "how should this row be
   * labelled" and therefore uses the looser `hasProviderGameLabel`.
   *
   * `contest-config.ts` is model-free, so importing it into a client component pulls no database
   * code into the browser bundle - its only import is a type.
   */
  const isProviderGame = isProviderContest(competition);

  const isActive = competition.status === "active";
  const isUpcoming = competition.status === "upcoming";
  const isCompleted = competition.status === "completed";

  // Check level requirements
  const levelReq = competition.levelRequirement;
  const hasLevelReq = levelReq?.enabled;
  const minLevel = levelReq?.minLevel || 1;
  const maxLevel = levelReq?.maxLevel;

  // Determine if user meets level requirements
  const meetsMinLevel = !hasLevelReq || userLevel.level >= minLevel;
  const meetsMaxLevel =
    !hasLevelReq || !maxLevel || userLevel.level <= maxLevel;
  const meetsLevelReq = meetsMinLevel && meetsMaxLevel;

  // Get level requirement message
  const getLevelReqMessage = () => {
    if (!hasLevelReq) return null;

    const minLvl = Number(minLevel);
    // eslint-disable-next-line security/detect-object-injection
    const minLevelInfo = LEVEL_NAMES[minLvl] || {
      icon: "🌱",
      title: `Level ${minLevel}`,
    };
    const maxLvl = maxLevel ? Number(maxLevel) : null;
    // eslint-disable-next-line security/detect-object-injection
    const maxLevelInfo = maxLvl ? LEVEL_NAMES[maxLvl] : null;

    if (!meetsMinLevel) {
      return {
        type: "too_low",
        message: `Requires ${minLevelInfo.icon} ${minLevelInfo.title} or higher`,
        detailText: `Your level: `,
        detailIcon: userLevel.icon,
        detailTitle: userLevel.title,
      };
    }

    if (!meetsMaxLevel && maxLevelInfo) {
      return {
        type: "too_high",
        message: `Only for traders up to ${maxLevelInfo.icon} ${maxLevelInfo.title}`,
        detailText: `Your level: `,
        detailIcon: userLevel.icon,
        detailTitle: userLevel.title,
      };
    }

    return null;
  };

  const levelReqMessage = getLevelReqMessage();

  // Reason: Block entry if registration deadline has passed, even if competition is still "active"
  const canEnter =
    (isActive || isUpcoming) &&
    !isFull &&
    canAfford &&
    !isUserIn &&
    meetsLevelReq &&
    !registrationClosed;

  /*
    HOW LONG IS LEFT TO JOIN, which this panel never said.

    The owner's report: a player could see that a competition started in four minutes and had
    no way to know that four minutes was also all the time they had to enter. The panel said
    "Registration Closed" once the door had already shut, which is the one moment the fact is
    of no use to them.

    It reads the SAME instant the gate compares against - `resolveRegistrationDeadline` was
    split out of `isRegistrationClosed` for this, rather than the deadline being recomputed
    here. Recomputing it would mean a countdown reaching zero while the button stayed open, or
    the reverse, the first time that function's clamp against `startTime` changed. That clamp is
    not hypothetical: it exists because an old bug wrote deadlines an hour BEFORE the start, and
    a copy of this rule that forgot it would tell those players entry closed before it opened.

    A contest with no deadline is a real configuration rather than a missing value, so it gets
    its own sentence instead of a countdown to a substituted `startTime`. Saying nothing would
    leave a player who has seen the countdown on one competition assuming this one has a hidden
    deadline too.
  */
  const entryDeadline = resolveRegistrationDeadline(competition);
  const showEntryCountdown =
    !isUserIn && !registrationClosed && (isActive || isUpcoming);

  /*
    WHY THE DOOR SHUTS WHEN IT DOES, which the panel stated wrongly rather than not at all.

    The old sentence - "after that no new entries are accepted, whether or not the competition
    is still running" - is unconditional, and on a game contest it is wrong in both directions.
    Under `until_window_closes` the deadline IS the moment play stops, so the clause describes
    a gap that does not exist. Under `reserve_full_round` the gap is real and the sentence
    never gives the reason, so a player who can see time left on the clock reads an arbitrary
    lock-out rather than the rule that protects them: entry closes early precisely so that
    nobody pays to join a contest they would have too little time to finish a round in.

    Resolved from the same module as the deadline, so the countdown and the sentence under it
    cannot disagree.
  */
  const entryClose = describeEntryClose(competition);

  // Check if user is disqualified (liquidated or disqualified status)
  const isDisqualified =
    participantStatus === "liquidated" || participantStatus === "disqualified";

  // Get disqualification reason for display
  const getDisqualificationReason = () => {
    switch (participantStatus) {
      case "liquidated":
        return "Your account was liquidated due to margin call.";
      case "disqualified":
        return "You were disqualified from this competition.";
      default:
        return "You are no longer eligible for prizes.";
    }
  };

  // Reason: Show terms dialog before entering a competition
  const handleEnter = async () => {
    if (!canAfford) {
      toast.error(`Insufficient balance. Need ${volts(entryFee)}`);
      return;
    }

    if (isFull) {
      toast.error("Competition is full");
      return;
    }

    if (isUserIn) {
      toast.info("You are already in this competition");
      return;
    }

    // Show terms dialog before proceeding
    setShowTerms(true);
  };

  /** Called after user accepts terms — proceeds with competition entry */
  const proceedAfterTerms = async () => {
    setShowTerms(false);
    setEntering(true);

    try {
      // Device fingerprinting happens globally via FingerprintProvider
      // Server-side restriction checks happen in enterCompetition action
      const result = await enterCompetition(competition._id);
      if (result.success) {
        toast.success("Successfully entered competition!");
        router.refresh();
      } else {
        toast.error("Entry blocked", {
          description: result.error || "Unable to enter competition. Please try again.",
        });
        setEntering(false);
      }
    } catch (error) {
      const description =
        error instanceof Error && error.message
          ? error.message
          : "Something went wrong. Please try again or contact support if the issue persists.";
      toast.error("Failed to enter competition", { description });
      setEntering(false);
    }
  };

  return (
    <div className="rounded-xl bg-gray-800/50 border border-gray-700 p-6">
      {/* Already Entered */}
      {isUserIn ? (
        <div className="space-y-4">
          {/* Disqualified State */}
          {isDisqualified ? (
            <>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                {participantStatus === "liquidated" ? (
                  <Skull className="h-5 w-5 text-red-500 shrink-0" />
                ) : (
                  <Ban className="h-5 w-5 text-red-500 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-red-400">
                    You are disqualified
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {getDisqualificationReason()}
                  </p>
                </div>
              </div>

              {/*
                Withheld from a provider contest, not relabelled: there are no trades to show,
                so the destination has nothing in it. The page's own "View Results" link already
                covers what a provider player wants here, and offering a history button that
                opens an empty trading terminal would read as their rounds having been lost.
              */}
              {!isProviderGame && (
                <Link
                  href={`/competitions/${competition._id}/trade?viewOnly=true`}
                >
                  <Button className="w-full bg-purple-500 hover:bg-purple-600 cursor-pointer active:scale-95 transition-all duration-150 shadow-lg hover:shadow-purple-500/25">
                    <History className="mr-2 h-4 w-4" />
                    View Trade History
                  </Button>
                </Link>
              )}
            </>
          ) : (
            /* Active Participant */
            <>
              {/*
                Reason the heading moves with the status rather than being a fixed
                "You're in this competition!": on a finished contest that sentence is
                present tense about something over, and it sat above a green tick, which
                reads as a state the player can still act on. The subtitle already said
                "Competition has ended" underneath, so the card contradicted itself. The
                tick is kept only while there is something to do.
              */}
              <div
                className={`flex items-center gap-3 p-4 rounded-lg ${
                  isCompleted
                    ? "bg-gray-500/10 border border-gray-500/30"
                    : "bg-green-500/10 border border-green-500/20"
                }`}
              >
                {isCompleted ? (
                  <Flag className="h-5 w-5 text-gray-400 shrink-0" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                )}
                <div>
                  <p
                    className={`text-sm font-medium ${
                      isCompleted ? "text-gray-300" : "text-green-400"
                    }`}
                  >
                    {isCompleted ? (
                      "Competition ended"
                    ) : (
                      <>You&apos;re in this competition!</>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {isActive
                      ? isProviderGame
                        ? "Play your round now"
                        : "Start trading now"
                      : isCompleted
                        ? "Final results are in - see how you placed"
                        : "Competition will start soon"}
                  </p>
                </div>
              </div>

              {isActive ? (
                /*
                  A provider contest is played at /play, never at /trade. Reason this is a
                  branch and not a redirect on the trade page alone: the trade route guards
                  itself too, but a player who is shown a button labelled "Start Trading" for a
                  puzzle has already been told something false, and a bounce afterwards does not
                  unsay it.
                */
                <Link
                  href={
                    isProviderGame
                      ? `/competitions/${competition._id}/play`
                      : `/competitions/${competition._id}/trade`
                  }
                >
                  <Button className="w-full bg-blue-500 hover:bg-blue-600 cursor-pointer active:scale-95 transition-all duration-150 shadow-lg hover:shadow-blue-500/25">
                    <Trophy className="mr-2 h-4 w-4" />
                    {isProviderGame ? "Play" : "Start Trading"}
                  </Button>
                </Link>
              ) : isUpcoming ? (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-xs text-yellow-400 text-center">
                    ⏰{" "}
                    {isProviderGame
                      ? "Play will unlock when the competition starts"
                      : "Trading will unlock when the competition starts"}
                  </p>
                </div>
              ) : isCompleted && !isProviderGame ? (
                /* See the disqualified branch above for why a provider contest gets no
                   trade-history button. */
                <Link
                  href={`/competitions/${competition._id}/trade?viewOnly=true`}
                >
                  <Button className="w-full bg-purple-500 hover:bg-purple-600 cursor-pointer active:scale-95 transition-all duration-150 shadow-lg hover:shadow-purple-500/25">
                    <History className="mr-2 h-4 w-4" />
                    View Trade History
                  </Button>
                </Link>
              ) : null}
            </>
          )}
        </div>
      ) : (
        /* Entry Section */
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-100 mb-2">
              Entry Requirements
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
                <span className="text-sm text-gray-400">Entry Fee</span>
                <span className="text-sm font-semibold text-gray-100">
                  {volts(entryFee)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50">
                <span className="text-sm text-gray-400">Your Balance</span>
                <span
                  className={`text-sm font-semibold ${
                    canAfford ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {volts(userBalance)}
                </span>
              </div>
            </div>
          </div>

          {/*
            THE DOOR, ABOVE THE CONTROL THAT OPENS IT.

            Placed before the button rather than under it because it is the fact that decides
            whether to press it now, and a player who scrolls no further has still seen it.

            The absolute time sits beside the countdown for a player planning when to come back,
            the same pairing the play screen uses - a bare countdown cannot be written down and
            a bare timestamp asks them to subtract two times in their head, one of them in a
            zone they do not live in.

            `zeroLabel` matters more than it looks. This page is server-rendered, so an open tab
            cannot learn that `registrationClosed` has flipped; without it the countdown would
            reach zero and read "Started", which is wrong twice over - the competition may not
            have started, and what happened is that entry closed.
          */}
          {showEntryCountdown && (
            <div className="flex items-start gap-2 rounded-lg border border-gray-700 bg-gray-900/60 p-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              {entryDeadline ? (
                <p className="text-xs text-gray-300">
                  Entry closes in{" "}
                  <InlineCountdown
                    targetDate={entryDeadline.toISOString()}
                    type="end"
                    zeroLabel="Closed"
                    className="font-semibold text-amber-300"
                  />
                  <span className="ml-1 text-gray-500">
                    ({entryDeadline.toUTCString()})
                  </span>
                  {/*
                    THREE SENTENCES FOR THREE RULES, and the middle one is the owner's report.
                    They must not be collapsed: each names a different consequence of joining
                    late, and the wrong one is worse than none because a player acts on it.
                  */}
                  {entryClose.kind === "reserves_round" ? (
                    <span className="mt-1 block text-gray-500">
                      Entry shuts{" "}
                      <span className="tabular-nums">
                        {formatRemaining(entryClose.reservedMs)}
                      </span>{" "}
                      before play ends, so everyone who joins still gets a full
                      round. After that no new entries are accepted.
                    </span>
                  ) : entryClose.kind === "runs_to_the_end" ? (
                    <span className="mt-1 block text-gray-500">
                      You can join right up to the end. Joining late leaves you
                      less time, and a round still running when the competition
                      closes is scored on what you managed.
                    </span>
                  ) : (
                    <span className="mt-1 block text-gray-500">
                      After that no new entries are accepted, whether or not the
                      competition is still running.
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-gray-300">
                  Entry stays open for as long as this competition is running.
                  {isProviderGame
                    ? " Joining later leaves you less time to play."
                    : " Joining later leaves you less time to trade."}
                </p>
              )}
            </div>
          )}

          {/* Entry Button */}
          <Button
            onClick={handleEnter}
            disabled={!canEnter || entering}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold 
              disabled:opacity-50 disabled:cursor-not-allowed
              cursor-pointer active:scale-95 transition-all duration-150
              shadow-lg hover:shadow-yellow-500/25"
          >
            {entering ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Entering...
              </>
            ) : registrationClosed ? (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Registration Closed
              </>
            ) : !meetsLevelReq ? (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Level Restricted
              </>
            ) : isFull ? (
              "Competition Full"
            ) : !canAfford ? (
              <>
                <DollarSign className="mr-2 h-4 w-4" />
                Need {volts(Math.abs(entryFee - userBalance))} More
              </>
            ) : (
              <>
                <Trophy className="mr-2 h-4 w-4" />
                Enter Competition
              </>
            )}
          </Button>

          {/* Registration Closed Warning */}
          {registrationClosed && !isUserIn && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <Lock className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">
                Registration for this competition has closed. No new entries are being accepted.
              </p>
            </div>
          )}

          {/* Level Requirement Warning */}
          {levelReqMessage && (
            <div
              className={`flex items-start gap-2 p-3 rounded-lg ${
                levelReqMessage.type === "too_low"
                  ? "bg-purple-500/10 border border-purple-500/20"
                  : "bg-orange-500/10 border border-orange-500/20"
              }`}
            >
              {levelReqMessage.type === "too_low" ? (
                <TrendingUp className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
              ) : (
                <Lock className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
              )}
              <div>
                <p
                  className={`text-xs font-medium ${
                    levelReqMessage.type === "too_low"
                      ? "text-purple-400"
                      : "text-orange-400"
                  }`}
                >
                  {levelReqMessage.message}
                </p>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  {levelReqMessage.detailText}
                  {levelReqMessage.detailIcon && levelReqMessage.detailIcon in GAME_ICONS ? (
                    <GameIcon name={levelReqMessage.detailIcon as GameIconName} size={12} />
                  ) : levelReqMessage.detailIcon ? (
                    <span>{levelReqMessage.detailIcon}</span>
                  ) : null}
                  {levelReqMessage.detailTitle}
                </p>
                {levelReqMessage.type === "too_low" && (
                  <Link href="/profile">
                    <Button
                      variant="link"
                      className="h-auto p-0 text-xs text-purple-400 underline mt-1 cursor-pointer hover:text-purple-300 active:scale-95 transition-all"
                    >
                      Level Up Your Account →
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Warnings */}
          {!canAfford && meetsLevelReq && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-red-400">
                  Insufficient balance. Deposit more credits to enter.
                </p>
                <Link href="/wallet">
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs text-red-400 underline mt-1 cursor-pointer hover:text-red-300 active:scale-95 transition-all"
                  >
                    Go to Wallet
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {isFull && meetsLevelReq && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-400">
                This competition has reached maximum participants.
              </p>
            </div>
          )}

          {/*
            Info.

            THE CAPITAL SENTENCE IS WITHHELD FROM A GAME, NOT RELABELLED, and it was a live
            defect rather than a tidy-up. `startingCapital` is `required` only while the
            contest is trading - the model says in as many words that "an invented number is
            worse than an absent one: it renders in any summary that has not yet learned about
            games" - and this panel was such a summary. The `|| 0` above turned the absent
            field into a promise of "$0 in trading capital to compete", shown to every player
            about to pay to enter a puzzle.

            Withheld rather than replaced with a game equivalent: what a player gets for their
            fee is attempts, and the attempts line already sits on the play screen where it is
            derived from the contest rather than guessed here.
          */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-blue-300">
              ℹ️ Entry fee is non-refundable.
              {!isProviderGame && (
                <>
                  {" "}
                  You will receive ${startingCapital.toLocaleString()} in trading
                  capital to compete.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Action Terms Dialog — shown before entering competition */}
      <ActionTermsDialog
        slug={ACTION_TERM_SLUGS.COMPETITION_ENTRY}
        open={showTerms}
        onAccept={proceedAfterTerms}
        onDecline={() => setShowTerms(false)}
      />
    </div>
  );
}
