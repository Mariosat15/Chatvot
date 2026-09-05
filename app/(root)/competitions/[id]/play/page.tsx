import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { auth } from "@/lib/better-auth/auth";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { getPlayState } from "@/lib/services/games/round-status.service";
import { ProviderRoundHost } from "@/components/games/ProviderRoundHost";
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

  const contest = await Competition.findById(competitionId)
    .select("name gameKey gameConfig")
    .lean<{
      name?: string;
      gameKey?: string;
      gameConfig?: { providerKey?: string; gameCode?: string };
    } | null>();

  // The player-facing name of the game comes from the catalogue, which is the editable content
  // layer - never from the provider key, and never from `gameKey`, which is an internal join key
  // that happens to be human-readable and would leak our own naming into a player screen.
  const title = await ProviderGame.findOne({
    providerKey: contest?.gameConfig?.providerKey,
    gameCode: contest?.gameConfig?.gameCode,
  })
    .select("displayName")
    .lean<{ displayName?: string } | null>();

  const competitionName = contest?.name ?? "this competition";
  const gameName = title?.displayName ?? "this game";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/competitions/${competitionId}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" />
        {competitionName}
      </Link>

      <ProviderRoundHost
        competitionId={competitionId}
        competitionName={competitionName}
        gameName={gameName}
        initialState={outcome.state}
      />
    </div>
  );
}
