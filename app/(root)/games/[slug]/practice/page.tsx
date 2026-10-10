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
import "@/components/games/practice-area.css";

export const dynamic = "force-dynamic";

/**
 * The practice area for every catalogue game: free, unranked, prize-less, and only the player
 * plays. Whether a game can be practised is the catalogue's answer (`supportsPractice`), never a
 * branch on game code, so a new title that declares practice gets this area with no code.
 *
 * Reason: rendering this page creates nothing. The round is created by the Start button's POST,
 * because Next.js prefetches `<Link>` targets and a round created on GET would be created on hover.
 *
 * Visual (8 Oct 2026): full-bleed cyber background. Desktop and mobile lobbies are separate
 * trees inside PracticeRoundHost — desktop proportions stay; mobile is touch-first.
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
      <div className="practice-page">
        <div className="practice-page__inner">
          <div className="practice-hud practice-unavailable">
            <div className="practice-hud__glow" aria-hidden />
            <GraduationCap className="mx-auto h-10 w-10 text-violet-300" aria-hidden />
            <h1>Practice: {availability.gameName}</h1>
            <p>{availability.reason}</p>
            <div className="practice-unavailable__actions">
              <Link href={`/games/${slug}`}>Back to game page</Link>
              <Link href={`/competitions?game=${encodeURIComponent(slug)}`}>
                Browse contests
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const rounds = (await listPracticeRounds(slug, session.user.id)) ?? [];

  return (
    <div className="practice-page">
      <div className="practice-page__inner practice-page__inner--host">
        <PracticeRoundHost
          slug={slug}
          gameName={availability.gameName}
          scoreType={availability.scoreType}
          initialRounds={rounds}
        />
      </div>
    </div>
  );
}
