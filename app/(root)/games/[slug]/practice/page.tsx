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
import DashboardBackdrop from "@/components/dashboard/DashboardBackdrop";
import { NEON_PANEL_LIT } from "@/components/neon/tokens";

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
      <div className="mx-auto max-w-lg px-4 py-10">
        <DashboardBackdrop>
          <div className={`${NEON_PANEL_LIT} space-y-4 p-8 text-center`}>
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
        </DashboardBackdrop>
      </div>
    );
  }

  const rounds = (await listPracticeRounds(slug, session.user.id)) ?? [];

  // Reason (6 Oct 2026, owner): max-w-5xl left Velocity's hangar squeezed in a
  // ~1000px column; ship names truncated. Give practice the room a race needs.
  return (
    <div className="mx-auto w-full max-w-[min(100%,88rem)] px-3 py-6 sm:px-4 sm:py-8">
      <DashboardBackdrop>
        <header className="space-y-1 pb-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Practice area
          </p>
          <h1 className="bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
            {availability.gameName}
          </h1>
        </header>
        <PracticeRoundHost
          slug={slug}
          gameName={availability.gameName}
          scoreType={availability.scoreType}
          initialRounds={rounds}
        />
      </DashboardBackdrop>
    </div>
  );
}
