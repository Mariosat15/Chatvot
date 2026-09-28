import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { auth } from "@/lib/better-auth/auth";
import {
  getPracticeAvailability,
  listPracticeRounds,
} from "@/lib/services/games/practice-round.service";
import { PracticeRoundHost } from "@/components/games/PracticeRoundHost";
import { NEON_PANEL } from "@/components/neon/tokens";

export const dynamic = "force-dynamic";

/**
 * The practice area for every catalogue game: free, unranked, prize-less, and only the player
 * plays. Whether a game can be practised is the catalogue's answer (`supportsPractice`), never a
 * branch on game code, so a new title that declares practice gets this area with no code.
 *
 * Reason: rendering this page creates nothing. The round is created by the Start button's POST,
 * because Next.js prefetches `<Link>` targets and a round created on GET would be created on hover.
 */
export default async function GamePracticePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");

  const availability = await getPracticeAvailability(slug);
  if (!availability) notFound();

  if (!availability.available) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className={`${NEON_PANEL} space-y-4 p-8 text-center`}>
          <GraduationCap className="mx-auto h-10 w-10 text-violet-400" aria-hidden />
          <h1 className="text-2xl font-bold text-white">Practice: {availability.gameName}</h1>
          <p className="text-sm text-gray-400">{availability.reason}</p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              href={`/games/${slug}`}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
            >
              Back to game page
            </Link>
            <Link
              href={`/competitions?game=${encodeURIComponent(slug)}`}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Browse contests
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const rounds = (await listPracticeRounds(slug, session.user.id)) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <header className="space-y-1 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Practice area
        </p>
        <h1 className="text-3xl font-bold text-white">{availability.gameName}</h1>
      </header>
      <PracticeRoundHost
        slug={slug}
        gameName={availability.gameName}
        scoreType={availability.scoreType}
        initialRounds={rounds}
      />
    </div>
  );
}
