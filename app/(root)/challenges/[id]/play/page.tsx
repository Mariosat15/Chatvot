import Link from "next/link";
import { ArrowLeft, Gift } from "lucide-react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { auth } from "@/lib/better-auth/auth";
import { connectToDatabase } from "@/database/mongoose";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import AppSettingsModel from "@/database/models/app-settings.model";
import { getChallengePlayState } from "@/lib/services/games/challenge-round-status.service";
import { getGamePresentation } from "@/lib/services/games/game-presentation.service";
import { getContestActivity } from "@/lib/services/games/contest-activity.service";
import { ChallengeRoundHost } from "@/components/games/ChallengeRoundHost";
import { GameArenaLayout } from "@/components/games/arena/GameArenaLayout";
import { ArenaContestPanel } from "@/components/games/arena/ArenaContestPanel";
import { ArenaHighlights } from "@/components/games/arena/ArenaHighlights";
import ChallengeStandingsPanel, {
  type ChallengeArenaSeat,
} from "@/components/games/arena/ChallengeStandingsPanel";
import GameRulesPanel from "@/components/games/GameRulesPanel";
import { NeonCountPill, NeonHeadedPanel, NeonRow } from "@/components/neon/Cards";
import { NeonRankBadge } from "@/components/neon/LeaderboardRow";
import { resolveProviderBanner } from "@/components/neon/banners";
import { formatVolts } from "@/lib/utils/format-volts";
import { Button } from "@/components/ui/button";
import ChallengeTradingWorkspace from "@/components/trading/ChallengeTradingWorkspace";

/**
 * Where a player plays a provider-game 1v1 challenge - the challenge-side sibling of
 * `/competitions/[id]/play`. Also the dispatcher for trading challenges: when the challenge
 * is not a provider game, `ChallengeTradingWorkspace` renders here and `/trade` redirects in.
 *
 * ON THE SAME ARENA AS THE COMPETITION, since 13 September 2026 (owner instruction: "the game
 * screen doesn't have all the elements on like when we play in competitions - use the same
 * layout"). It was a single narrow column holding the board and nothing else, and the reasoning
 * recorded here for that - that a 1v1 asks none of the questions a leaderboard rail answers -
 * was wrong in the part that mattered: a player who pressed Play could no longer see the pot,
 * the entry fee, their attempts, the rules of the game or what their opponent had scored. Those
 * are exactly the facts the arena puts beside the board, and every one of them exists on a
 * challenge.
 *
 * WHAT IS GENUINELY DIFFERENT IS THE RAIL, AND ONLY THE RAIL. `ArenaLeaderboardPanel` is built
 * around a rank - a plate, a crown, tie markers, and a poll of the competition standings route -
 * and a challenge has no rank until it settles. `ChallengeStandingsPanel` reports the two seats
 * without ordering them, for the reasoning on that file. Everything else in the layout is reused
 * unchanged: the hero, the contest facts, the rules strip, the highlights (the activity feed was removed from the band on 25 September 2026).
 *
 * THE FEED IS THE COMPETITION'S OWN PRODUCER. `getContestActivity` is queried by contest id and
 * a list of players and knows nothing about which kind of contest it is holding, so a challenge
 * needs no second copy of it - which is the point, because two readers of one fact are two
 * answers to it.
 *
 * NOTHING HERE STARTS A ROUND, for the same reason as the competition page: an attempt is
 * consumed on round CREATION, so a server component that launched one on render would spend a
 * paying player's only attempt on a prefetch. The POST happens on the click, inside
 * `ChallengeRoundHost`.
 */

interface ChallengePlayPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ viewOnly?: string }>;
}

export default async function ChallengePlayPage({
  params,
  searchParams,
}: ChallengePlayPageProps) {
  // Reason: attempts remaining and the live round change with every play, so a cached render
  // would offer a Play button to a player who has none left, or hide a round they could resume.
  noStore();

  const { id: challengeId } = await params;
  const { viewOnly } = await searchParams;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/sign-in");
  }

  // The authoritative check, exactly as the competition page uses `getPlayState`: it confirms
  // the challenge exists, is a provider challenge, the caller holds a seat, and its round
  // settings are usable. `GET /api/challenges/[id]/rounds` calls the same function, so the page
  // and the route cannot disagree about who may play.
  const outcome = await getChallengePlayState(challengeId, session.user.id);

  if (!outcome.success) {
    if (outcome.refusal === "not_found") {
      notFound();
    }

    // Trading branch of the challenge dispatcher. `/trade` redirects inwards onto this route.
    if (outcome.refusal === "not_provider_challenge") {
      return (
        <ChallengeTradingWorkspace
          challengeId={challengeId}
          viewOnly={viewOnly === "true"}
        />
      );
    }

    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link
          href={`/challenges/${challengeId}`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to the challenge
        </Link>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
          <h1 className="font-semibold text-amber-300">You cannot play this yet</h1>
          <p className="mt-2 text-sm text-amber-200/80">{outcome.error}</p>
          <Link href={`/challenges/${challengeId}`}>
            <Button variant="outline" className="mt-4">
              View the challenge
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  await connectToDatabase();

  // Every field here is one the challenge lobby already reads; none of it is new data.
  const challenge = await Challenge.findById(challengeId)
    .select(
      "challengerId challengerName challengedId challengedName gameConfig entryFee prizePool winnerPrize platformFeePercentage platformFeeAmount",
    )
    .lean<{
      challengerId?: string;
      challengerName?: string;
      challengedId?: string;
      challengedName?: string;
      gameConfig?: { providerKey?: string; gameCode?: string };
      entryFee?: number;
      prizePool?: number;
      winnerPrize?: number;
      platformFeePercentage?: number;
      platformFeeAmount?: number;
    } | null>();

  const isChallenger = challenge?.challengerId === session.user.id;
  const opponentName = isChallenger
    ? challenge?.challengedName || "your opponent"
    : challenge?.challengerName || "your opponent";

  const [presentation, participants, settings] = await Promise.all([
    getGamePresentation(
      challenge?.gameConfig?.providerKey,
      challenge?.gameConfig?.gameCode,
    ),
    // Both seats' scores as STORED. Nothing is aggregated or ranked here: the score on a seat is
    // `participant-score.service.ts`'s answer, written at ingestion, and the winner is
    // finalization's.
    ChallengeParticipant.find({ challengeId })
      .select("userId username score")
      .lean<{ userId: string; username?: string; score?: number }[]>(),
    // `credits.symbol`, never `currency.symbol`: a prize pool is a credit amount, so the fiat
    // symbol is the wrong field.
    AppSettingsModel.findOne()
      .select("credits.symbol")
      .lean<{ credits?: { symbol?: string } } | null>(),
  ]);

  const creditSymbol = settings?.credits?.symbol || undefined;

  /*
    THE SEATS ARE BUILT FROM THE CHALLENGE, NOT FROM THE PARTICIPANT ROWS ALONE, because a seat
    must appear before it has a score and the two seats are named on the challenge itself. A
    participant row supplies the score when there is one; its absence is a player who has not
    finished a round, which renders as a dash rather than a nought (R50's read side).

    THE VIEWER IS FIRST AND THERE IS NO SORT. See `ChallengeStandingsPanel`.
  */
  const seatIds = [
    { userId: session.user.id, name: "You", isViewer: true },
    {
      userId: (isChallenger ? challenge?.challengedId : challenge?.challengerId) ?? "",
      name: opponentName,
      isViewer: false,
    },
  ].filter((seat) => seat.userId.length > 0);

  /*
    THE COMPETITION'S OWN PRODUCER, queried by contest id. `game_round.contestId` holds the
    challenge's `_id` for a challenge round, and the id goes in as the string from the URL
    because this is a Mongoose query underneath and Mongoose casts it - the raw driver does
    not, which is the boundary that has produced three separate defects in this codebase.
  */
  const activity = await getContestActivity(
    challengeId,
    seatIds.map((seat) => seat.userId),
    { recentLimit: 6 },
  );

  const seats: ChallengeArenaSeat[] = seatIds.map((seat) => ({
    ...seat,
    score: participants.find((row) => String(row.userId) === seat.userId)?.score,
    activity: activity.latestByUser[seat.userId],
  }));

  const challengeName = `Challenge vs ${opponentName}`;
  const scoreLabel = presentation.scoreType === "duration_ms" ? "Time" : "Score";

  /*
    THE ARTWORK IS CHOSEN HERE RATHER THAN IN THE LAYOUT, and that is a guard rather than a
    preference: `game-content-editor.test.ts` forbids a game code anywhere in the arena folder,
    because a screen that can name a game is a screen that can special-case one. This page
    already knows which game it is, so it picks via the shared helper.
  */
  const banner = resolveProviderBanner({
    bannerUrl: presentation.bannerUrl,
    gameName: presentation.gameName,
    gameCode: challenge?.gameConfig?.gameCode,
  });

  return (
    <GameArenaLayout
      backHref={`/challenges/${challengeId}`}
      competitionName="the challenge"
      presentation={presentation}
      banner={banner}
      minParticipants={2}
      maxParticipants={2}
      standings={
        <ChallengeStandingsPanel seats={seats} scoreLabel={scoreLabel} />
      }
      stage={
        <ChallengeRoundHost
          challengeId={challengeId}
          challengeName={challengeName}
          gameName={presentation.gameName}
          initialState={outcome.state}
        />
      }
      sidebar={
        <>
          {/*
            NO RANK IS PASSED, deliberately: a challenge has no position while it is being
            played, and the panel renders a dash rather than inventing one. See its `rank` prop.
          */}
          <ArenaContestPanel
            facts={{
              prizePool: challenge?.prizePool,
              entryFee: challenge?.entryFee,
              currentParticipants: seats.length,
              maxParticipants: 2,
              creditSymbol,
            }}
            state={outcome.state}
            presentation={presentation}
          />

          {/*
            SAME CHROME AS THE COMPETITION PRIZE PANEL (owner 26 Sep 2026: "all the graphics
            that are in competition must also be in challenges"). A 1v1 has one paying place —
            the arithmetic is still the stored `winnerPrize`, never a second copy of
            `projectPrizeDistribution` — but the shell, gift heading, count pill and medal row
            match `PrizeTable` so the two arenas do not look like different products.
          */}
          <NeonHeadedPanel
            icon={Gift}
            title="Prize breakdown"
            action={<NeonCountPill>Winner takes all</NeonCountPill>}
            bodyClassName="flex h-full flex-col p-4"
          >
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              <Gift className="h-3.5 w-3.5 shrink-0" />
              <span>1 of 1 paid positions — winner takes the pool less the platform fee</span>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-lg border border-[#1B2540] bg-[#080C18]/80 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <NeonRankBadge rank={1} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight text-gray-100">
                    Winner
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-300">
                      {challenge?.platformFeePercentage != null
                        ? `${100 - (challenge.platformFeePercentage || 0)}%`
                        : "Net"}
                    </span>
                  </div>
                </div>
              </div>
              <span className="shrink-0 text-base font-bold text-amber-300">
                {formatVolts(challenge?.winnerPrize, { symbol: creditSymbol })}
              </span>
            </div>

            <div className="mt-3 space-y-1.5">
              <NeonRow
                label="Total pool"
                value={formatVolts(challenge?.prizePool, { symbol: creditSymbol })}
              />
              <NeonRow
                label={`Platform fee (${challenge?.platformFeePercentage ?? 0}%)`}
                value={`-${formatVolts(challenge?.platformFeeAmount, { symbol: creditSymbol })}`}
              />
            </div>

            <p className="mt-auto pt-3 text-[11px] leading-relaxed text-gray-500">
              The winner is decided when both players have finished. The amount above is what
              settles into their wallet — the pool less the platform fee.
            </p>
          </NeonHeadedPanel>
        </>
      }
      rules={<GameRulesPanel presentation={presentation} layout="strip" />}
      highlights={
        <ArenaHighlights
          highlights={presentation.highlights}
          imageUrl={presentation.highlightsImageUrl}
        />
      }
    />
  );
}
