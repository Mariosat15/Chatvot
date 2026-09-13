import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { auth } from "@/lib/better-auth/auth";
import { connectToDatabase } from "@/database/mongoose";
import Challenge from "@/database/models/trading/challenge.model";
import { getChallengePlayState } from "@/lib/services/games/challenge-round-status.service";
import { getGamePresentation } from "@/lib/services/games/game-presentation.service";
import { ChallengeRoundHost } from "@/components/games/ChallengeRoundHost";
import { Button } from "@/components/ui/button";

/**
 * Where a player plays a provider-game 1v1 challenge - the challenge-side sibling of
 * `/competitions/[id]/play`.
 *
 * DELIBERATELY MINIMAL, AND THAT IS A SCOPE DECISION RATHER THAN AN OVERSIGHT. A challenge is
 * exactly two players; it has no leaderboard rail, no live-activity feed, no highlights band and
 * no prize table with several positions - all of that machinery on the competition arena exists
 * to answer questions ("who else is playing", "where do I rank among a hundred entrants") that a
 * 1v1 does not ask. What this page keeps is the one thing both share: the round itself, hosted by
 * `ChallengeRoundHost`, which is a challenge-specific copy of `ProviderRoundHost` rather than a
 * generalisation of it, for the reasoning recorded on that file.
 *
 * NOTHING HERE STARTS A ROUND, for the same reason as the competition page: an attempt is
 * consumed on round CREATION, so a server component that launched one on render would spend a
 * paying player's only attempt on a prefetch. The POST happens on the click, inside
 * `ChallengeRoundHost`.
 */

interface ChallengePlayPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChallengePlayPage({ params }: ChallengePlayPageProps) {
  // Reason: attempts remaining and the live round change with every play, so a cached render
  // would offer a Play button to a player who has none left, or hide a round they could resume.
  noStore();

  const { id: challengeId } = await params;

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

    // A trading challenge belongs on the trading workspace, not here.
    if (outcome.refusal === "not_provider_challenge") {
      redirect(`/challenges/${challengeId}/trade`);
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

  const challenge = await Challenge.findById(challengeId)
    .select("challengerId challengerName challengedId challengedName gameConfig")
    .lean<{
      challengerId?: string;
      challengerName?: string;
      challengedId?: string;
      challengedName?: string;
      gameConfig?: { providerKey?: string; gameCode?: string };
    } | null>();

  const isChallenger = challenge?.challengerId === session.user.id;
  const opponentName = isChallenger
    ? challenge?.challengedName || "your opponent"
    : challenge?.challengerName || "your opponent";

  const presentation = await getGamePresentation(
    challenge?.gameConfig?.providerKey,
    challenge?.gameConfig?.gameCode,
  );

  const challengeName = `Challenge vs ${opponentName}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <Link
        href={`/challenges/${challengeId}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to the challenge
      </Link>

      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider text-gray-500">{presentation.gameName}</p>
        <h1 className="text-2xl font-bold text-light-900">{challengeName}</h1>
      </div>

      <ChallengeRoundHost
        challengeId={challengeId}
        challengeName={challengeName}
        gameName={presentation.gameName}
        initialState={outcome.state}
      />
    </div>
  );
}
