import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { getGamePageData } from "@/lib/services/games/game-page.service";

export const dynamic = "force-dynamic";

/**
 * Practice entry for a catalogue game.
 *
 * Practice rounds exist in the round model, but there is no free-play launcher UI yet.
 * This page is the honest destination for Play Now / Practice mode cards so we never
 * invent a paid contest or burn an attempt on GET.
 */
export default async function GamePracticePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await getGamePageData(slug);
  if (!game || !game.formats.practice) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
      <GraduationCap className="mx-auto h-10 w-10 text-violet-400" />
      <h1 className="text-2xl font-bold text-white">Practice — {game.title}</h1>
      <p className="text-sm text-gray-400">
        Free practice for this title is not launchable from the game page yet.
        Join a contest or start a challenge to play for real, or check back when
        practice sessions are enabled for players.
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Link
          href={`/games/${game.slug}`}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white hover:bg-white/5"
        >
          Back to game page
        </Link>
        <Link
          href={`/competitions?game=${encodeURIComponent(game.slug)}`}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Browse contests
        </Link>
      </div>
    </div>
  );
}
