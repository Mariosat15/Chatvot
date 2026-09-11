import Link from "next/link";
import { ArrowLeft, Gift } from "lucide-react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import {
  isCompetitionIdShaped,
  logMalformedCompetitionId,
} from "@/lib/utils/competition-id";
import { auth } from "@/lib/better-auth/auth";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import AppSettingsModel from "@/database/models/app-settings.model";
import { getPlayState } from "@/lib/services/games/round-status.service";
import { getGamePresentation } from "@/lib/services/games/game-presentation.service";
import { getArenaStandings } from "@/lib/services/games/arena-standings.service";
import { ProviderRoundHost } from "@/components/games/ProviderRoundHost";
import PrizeTable from "@/components/competitions/PrizeTable";
import { GameArenaLayout } from "@/components/games/arena/GameArenaLayout";
import { ArenaContestPanel } from "@/components/games/arena/ArenaContestPanel";
import { ArenaHighlights } from "@/components/games/arena/ArenaHighlights";
import {
  ArenaLiveBoard,
  ArenaLiveCount,
  ArenaLiveFeed,
  ArenaLiveProvider,
} from "@/components/games/arena/ArenaLiveStandings";
import GameRulesPanel from "@/components/games/GameRulesPanel";
import { NeonCountPill, NeonHeadedPanel } from "@/components/neon/Cards";
import { Button } from "@/components/ui/button";

/**
 * Where a player actually plays a provider game.
 *
 * NOTHING HERE STARTS A ROUND, AND THAT IS THE MOST IMPORTANT PROPERTY OF THE FILE. An attempt
 * is consumed when a round is CREATED (chapter 03 section 1.3), so creating one from a server
 * component would make it a side effect of a GET - and Next.js prefetches `<Link>` targets on
 * hover, browsers re-issue GETs, and a bot follows every link it finds. A paying player would
 * lose their only attempt to a mouse movement. The page reads state and renders a button; the
 * POST happens on the click, in `ProviderRoundHost`.
 *
 * IT IS NOT `/competitions/[id]/trade`, AND THAT IS THE LIVE DEFECT THIS ROUTE FIXES. That route
 * is the forex trading workspace - charts, an order form, positions, margin - and it is
 * meaningless for a puzzle or a quiz. A player who joined a provider contest was sent there by a
 * button labelled "Start Trading", arrived at a trading terminal for a game with no market, and
 * nothing errored. Same shape as the trading-shaped services in `matchmaking.service.ts` and the
 * admin competitions list rendering drafts in the grey it uses for finished contests.
 *
 * THIS PATH IS THE ONE CHAPTER 13 SECTION 1 SPECIFIES, and it was worth moving here before
 * shipping. `09` E6 calls it `/play/[contestId]` and `13` calls it `/competitions/[id]/play`;
 * `13` is the routing chapter and it is right, because a contest's gameplay belongs under the
 * contest. Building it at the wrong path would have meant either renaming a URL players had
 * already bookmarked, or keeping two play routes for ever.
 *
 * IT IS ONLY HALF OF THE DISPATCHER `13` DESCRIBES, deliberately. The finished design branches on
 * game type and renders the trading gameplay here too, with `/trade` reduced to a permanent
 * redirect *into* this route. That means moving `TradingPageContent` and its six context
 * providers, which is a change to the live trading path and carries R18 (mounting a price feed
 * for a chess player) and R19. So for now the branch runs the other way: a trading contest that
 * reaches this route is redirected OUT to `/trade`. When X7 builds the trading branch, the
 * redirect flips direction and no URL changes.
 */

interface PlayPageProps {
  params: Promise<{ id: string }>;
}

export default async function PlayPage({ params }: PlayPageProps) {
  // Reason: attempts remaining and the live round change with every play, so a cached render
  // would offer a Play button to a player who has none left, or hide a round they could resume.
  noStore();

  const { id: competitionId } = await params;

  // A junk id is refused before the session read, because a crawler following a bad link has no
  // session and would otherwise be bounced to `/sign-in` for a contest that cannot exist.
  if (!isCompetitionIdShaped(competitionId)) {
    logMalformedCompetitionId("/competitions/[id]/play", competitionId);
    notFound();
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/sign-in");
  }

  // The authoritative check, and it does all the refusing: the contest exists, it is a provider
  // contest, the caller holds a paid seat, and its round settings are usable. The route handler
  // uses the very same function, so the page and the API cannot disagree about who may play.
  const outcome = await getPlayState(competitionId, session.user.id);

  if (!outcome.success) {
    if (outcome.refusal === "not_found") {
      notFound();
    }

    // A trading contest goes to the trading workspace. This is the HALF-BUILT DISPATCHER
    // described in the header: eventually the trading gameplay renders here and `/trade`
    // redirects inwards, but until the six trading context providers move, the redirect points
    // outwards. Either way the player lands on the gameplay for their game, which is the
    // property that has to hold now.
    if (outcome.refusal === "not_provider_contest") {
      redirect(`/competitions/${competitionId}/trade`);
    }

    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link
          href={`/competitions/${competitionId}`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to the competition
        </Link>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
          <h1 className="font-semibold text-amber-300">You cannot play this yet</h1>
          <p className="mt-2 text-sm text-amber-200/80">{outcome.error}</p>
          <Link href={`/competitions/${competitionId}`}>
            <Button variant="outline" className="mt-4">
              View the competition
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  await connectToDatabase();

  // The contest's own facts, so a player who has pressed Play can still see what they are
  // playing for. Every field here is one the lobby already reads; none is new data.
  const contest = await Competition.findById(competitionId)
    .select(
      "name gameKey gameConfig entryFee prizePool prizePoolCredits currentParticipants maxParticipants minParticipants prizeDistribution platformFeePercentage",
    )
    .lean<{
      name?: string;
      gameKey?: string;
      gameConfig?: { providerKey?: string; gameCode?: string };
      entryFee?: number;
      prizePool?: number;
      // Reason: `projectPrizeDistribution` falls back to this when `prizePool` is absent, so
      // omitting it from the projection would show every prize as zero on a credits contest.
      prizePoolCredits?: number;
      currentParticipants?: number;
      maxParticipants?: number;
      minParticipants?: number;
      prizeDistribution?: { percentage: number; rank?: number }[];
      platformFeePercentage?: number;
    } | null>();

  // The player-facing identity of the game comes from the catalogue, which is the editable
  // content layer an operator owns - never from the provider key, and never from `gameKey`,
  // which is an internal join key that happens to be human-readable and would leak our own
  // naming into a player screen.
  const [presentation, standings, settings] = await Promise.all([
    getGamePresentation(contest?.gameConfig?.providerKey, contest?.gameConfig?.gameCode),
    /*
      THE BOARD, WHAT EACH PLAYER HAS BEEN DOING, AND THE CALLER'S OWN RANK, from one shared
      producer. `GET /api/competitions/[id]/standings` calls the same function, so the figure a
      player sees fifteen seconds after this render was produced by this code rather than by a
      second reader that can drift from it.

      This used to be a bare `getCompetitionLeaderboard` with a note saying the rail was
      deliberately not polled "because a live ticker needs an endpoint that does not exist
      yet". The endpoint exists now. The reasoning that mattered survives and is recorded on
      `ArenaLiveProvider`: the rail refreshes through a fetch and never through
      `router.refresh()`, because this page hosts a round a player has paid for.
    */
    getArenaStandings(competitionId, session.user.id, {
      limit: 25,
      recentLimit: 6,
    }),
    // `credits.symbol`, not `currency.symbol`. A prize pool is a credit amount, so the fiat
    // symbol was the wrong field - and its fallback here was `$`, which is not even the
    // configured fiat currency.
    //
    // Reason: the projection must name the same field the read below does. A `.select()` that
    // still named `credits.name` returned a document with no `symbol`, so every amount on this
    // screen silently fell back to the default rather than the operator's configured emoji.
    AppSettingsModel.findOne()
      .select("credits.symbol")
      .lean<{ credits?: { symbol?: string } } | null>(),
  ]);

  const competitionName = contest?.name ?? "this competition";
  const creditSymbol = settings?.credits?.symbol || undefined;

  const prizePositions = Array.isArray(contest?.prizeDistribution)
    ? contest.prizeDistribution.length
    : 0;

  return (
    /*
      THE RAIL REFRESHES; THE GAME DOES NOT. The provider takes the rest of the arena as its
      `children`, and a `children` element handed down from a server component is the same
      object on every re-render - so React reconciles it by identity and never descends into
      it. Only the two consumers below re-draw, and the iframe is in neither of their subtrees.

      Which is why `ProviderRoundHost` must stay a child rather than become a consumer: making
      it read this context would turn a board refresh into a reloaded game, under a player who
      has paid for the attempt.
    */
    <ArenaLiveProvider
      competitionId={competitionId}
      currentUserId={session.user.id}
      initial={{
        rows: standings.rows,
        activity: standings.activity,
        feed: standings.feed,
      }}
      // The STORED status, never a clock here: a contest whose end time has passed is still
      // `active` until a cron finalizes it, so deciding in the browser would stop the refresh
      // exactly while the last rounds are landing.
      active={outcome.state.contestStatus === "active"}
    >
      <GameArenaLayout
        competitionId={competitionId}
        competitionName={competitionName}
        presentation={presentation}
        minParticipants={contest?.minParticipants}
        maxParticipants={contest?.maxParticipants}
        standingsCount={<ArenaLiveCount />}
        standings={<ArenaLiveBoard scoreLabel="Score" />}
        stage={
          <ProviderRoundHost
            competitionId={competitionId}
            competitionName={competitionName}
            gameName={presentation.gameName}
            initialState={outcome.state}
          />
        }
        sidebar={
          <>
            <ArenaContestPanel
              facts={{
                prizePool: contest?.prizePool,
                entryFee: contest?.entryFee,
                currentParticipants: contest?.currentParticipants,
                maxParticipants: contest?.maxParticipants,
                creditSymbol,
              }}
              state={outcome.state}
              presentation={presentation}
              rank={standings.yourRank}
            />
            {/*
              The ONE implementation of what each place is paid, shared with both lobbies. It is
              not reimplemented here, and it must not be: the four expressions inside it have
              survived two moves character for character, which is the only evidence that no
              payout figure has changed.

              THE HEADING IS THE CALLER'S, and it was missing entirely until 11 Sep 2026 - the
              prize rows sat under the contest panel with nothing saying what they were, so the
              amounts read as a continuation of the facts above them. `PrizeTable` deliberately
              renders no heading of its own, because the lobby puts it inside an accordion that
              already has one; two headings is worse than none.
            */}
            {prizePositions > 0 && (
              <NeonHeadedPanel
                icon={Gift}
                title="Prize breakdown"
                action={<NeonCountPill>Top {prizePositions} win</NeonCountPill>}
                bodyClassName="p-4"
              >
                <PrizeTable competition={contest} creditSymbol={creditSymbol} />
              </NeonHeadedPanel>
            )}

            {/*
              IN THE SIDEBAR RATHER THAN THE REFERENCE'S BOTTOM BAND, and that is a deviation
              worth recording rather than absorbing. The reference puts Recent Players in a
              three-panel row across the foot of the page beside How It Works and Game Tips. Two
              of those three render nothing at all until the catalogue is re-synced, and a CSS
              grid cannot see that its child returned `null` - so a two-thirds column holding a
              null child is still a two-thirds column, and the common case is a band with one
              panel adrift in it. The same attempt was made and reverted on 11 Sep 2026.

              Here it sits under the prize breakdown in a column that already stacks, so the
              panel simply is not there when nobody has played.

              A CONSUMER OF THE SAME FETCH AS THE BOARD, not a second read: two polls of one
              endpoint is two answers, so the board could name a rival's finished round while
              the feed beside it had not heard of it.
            */}
            <ArenaLiveFeed />
          </>
        }
        rules={<GameRulesPanel presentation={presentation} layout="wide" />}
        highlights={<ArenaHighlights highlights={presentation.highlights} />}
      />
    </ArenaLiveProvider>
  );
}
