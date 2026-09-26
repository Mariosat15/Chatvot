import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
import { listFriendUserIds } from "@/lib/services/messaging/friend-ids.service";
import { getTerms } from "@/lib/services/terminology.service";
import { ProviderRoundHost } from "@/components/games/ProviderRoundHost";
import { GameArenaLayout } from "@/components/games/arena/GameArenaLayout";
import { ArenaHighlights } from "@/components/games/arena/ArenaHighlights";
import { ArenaLiveProvider } from "@/components/games/arena/ArenaLiveStandings";
import { ArenaLiveSidebar } from "@/components/games/arena/ArenaLiveSidebar";
import ArenaLeaderboardPanel from "@/components/games/arena/ArenaLeaderboardPanel";
import GameRulesPanel from "@/components/games/GameRulesPanel";
import { resolveProviderBanner } from "@/components/neon/banners";
import { Button } from "@/components/ui/button";
import CompetitionTradingWorkspace from "@/components/trading/CompetitionTradingWorkspace";

/**
 * Where a player actually plays — the `/play` dispatcher for every contest.
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
 * THE DISPATCHER IS COMPLETE. Trading contests render `CompetitionTradingWorkspace` here;
 * provider contests render the provider host. `/trade` permanently redirects inwards. R18 is
 * held by only mounting the trading providers after `not_provider_contest` — a chess player
 * never opens a price feed. R19 was a character-for-character move of the old trade page.
 */

interface PlayPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ viewOnly?: string }>;
}

export default async function PlayPage({ params, searchParams }: PlayPageProps) {
  // Reason: attempts remaining and the live round change with every play, so a cached render
  // would offer a Play button to a player who has none left, or hide a round they could resume.
  noStore();

  const { id: competitionId } = await params;
  const { viewOnly } = await searchParams;

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

    // Trading branch of the dispatcher. Providers never reach here (R18). `/trade` redirects
    // inwards onto this same route, so a trading entrant always plays under `/play`.
    if (outcome.refusal === "not_provider_contest") {
      return (
        <CompetitionTradingWorkspace
          competitionId={competitionId}
          viewOnly={viewOnly === "true"}
        />
      );
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
  const [presentation, standings, settings, friendIds, terms] = await Promise.all([
    getGamePresentation(contest?.gameConfig?.providerKey, contest?.gameConfig?.gameCode),
    /*
      THE BOARD, WHAT EACH PLAYER HAS BEEN DOING, THE CALLER'S OWN RANK, AND THE CONTEST
      SNAPSHOT (seats / pot / prize shares), from one shared producer. The standings poll
      calls the same function, so joins and live ranks stay in agreement with the first paint
      without `router.refresh()` under a paid iframe.
    */
    getArenaStandings(competitionId, session.user.id, {
      limit: 25,
      recentLimit: 6,
    }),
    AppSettingsModel.findOne()
      .select("credits.symbol")
      .lean<{ credits?: { symbol?: string } } | null>(),
    listFriendUserIds(session.user.id),
    getTerms(),
  ]);

  const competitionName = contest?.name ?? "this competition";
  const creditSymbol = settings?.credits?.symbol || undefined;

  /*
    THE HERO ARTWORK IS CHOSEN HERE, NOT IN THE LAYOUT, and the reason is a guard rather than
    a preference. `GameArenaLayout` used to resolve it and got it wrong - it called
    `providerBanner(undefined)`, because `GamePresentation` carries no game code, so the arena
    drew the generic trophy for every title while the lobby drew the game's own. Passing the
    code down would fix the picture and break the rule that keeps the arena game-agnostic:
    `game-content-editor.test.ts` forbids a game code anywhere in that folder, because a
    screen that can name a game is a screen that can special-case one.

    This is the one place that legitimately knows which game it is, so it picks via the shared
    helper (operator upload → neon map → championship trophy).
  */
  const banner = resolveProviderBanner({
    bannerUrl: presentation.bannerUrl,
    gameName: presentation.gameName,
    gameCode: contest?.gameConfig?.gameCode,
  });

  return (
    /*
      THE RAIL REFRESHES; THE GAME DOES NOT. The provider takes the rest of the arena as its
      `children`, and a `children` element handed down from a server component is the same
      object on every re-render - so React reconciles it by identity and never descends into
      it. Only the context consumers re-draw, and the iframe is in none of their subtrees.

      Which is why `ProviderRoundHost` must stay a child rather than become a consumer: making
      it read this context would turn a board refresh into a reloaded game, under a player who
      has paid for the attempt.
    */
    <ArenaLiveProvider
      competitionId={competitionId}
      currentUserId={session.user.id}
      friendIds={friendIds}
      initial={{
        rows: standings.rows,
        activity: standings.activity,
        feed: standings.feed,
        countries: standings.countries,
        contest: standings.contest,
        yourRank: standings.yourRank,
      }}
      // The STORED status, never a clock here: a contest whose end time has passed is still
      // `active` until a cron finalizes it, so deciding in the browser would stop the refresh
      // exactly while the last rounds are landing.
      active={outcome.state.contestStatus === "active"}
    >
      <GameArenaLayout
        backHref={`/competitions/${competitionId}`}
        competitionName={competitionName}
        presentation={presentation}
        banner={banner}
        minParticipants={contest?.minParticipants}
        maxParticipants={contest?.maxParticipants}
        standings={
          <ArenaLeaderboardPanel
            competitionId={competitionId}
            scoreLabel="Score"
          />
        }
        stage={
          <ProviderRoundHost
            competitionId={competitionId}
            competitionName={competitionName}
            gameName={presentation.gameName}
            initialState={outcome.state}
          />
        }
        sidebar={
          <ArenaLiveSidebar
            initialFacts={{
              prizePool: contest?.prizePool,
              entryFee: contest?.entryFee,
              currentParticipants: contest?.currentParticipants,
              maxParticipants: contest?.maxParticipants,
              creditSymbol,
            }}
            initialCompetition={contest}
            state={outcome.state}
            presentation={presentation}
            terms={terms}
            initialRank={standings.yourRank}
            creditSymbol={creditSymbol}
          />
        }
        /*
          THE BAND, CARD BY CARD, in the reference's order: how it works, game tips, who has
          just played.

          BOTH TAKE `strip`, WHICH IS A DIFFERENT PANEL AND NOT A NARROWER ONE. The band is a
          fixed 96px row, so each card draws a capped number of one-line items rather than the
          full copy - see the notes on `GameArenaLayout`'s band and on `STRIP_STEP_LIMIT`. The
          lobby renders the same two components at their full size, which is where a player
          reads the whole thing before they pay.

          THE RECENT-PLAYERS FEED WAS REMOVED FROM THE BAND on 25 September 2026 (owner: "the
          last part recent players remove"). The leaderboard rail beside the board still shows
          every player and what they have done, from the same live fetch.
        */
        rules={<GameRulesPanel presentation={presentation} layout="strip" />}
        highlights={
          <ArenaHighlights
            highlights={presentation.highlights}
            imageUrl={presentation.highlightsImageUrl}
          />
        }
      />
    </ArenaLiveProvider>
  );
}
