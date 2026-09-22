import { notFound } from "next/navigation";
import { getGamePageData } from "@/lib/services/games/game-page.service";
import { GamePageView } from "@/components/game-page/GamePageView";

export const dynamic = "force-dynamic";

/**
 * Per-game product page (game_page.md).
 *
 * MUST NOT create or launch a round on GET — Next.js prefetches Link targets.
 * Content and theme come from Admin → All Games.
 */

const ALLOWED_TABS = new Set([
  "overview",
  "how-it-works",
  "competitions",
  "leaderboards",
  "prizes",
  "challenges",
  "rules",
  "gallery",
]);

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const rawTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const tab =
    rawTab && ALLOWED_TABS.has(rawTab) ? rawTab : "overview";

  const game = await getGamePageData(slug);
  if (!game) notFound();

  return <GamePageView game={game} tab={tab} />;
}
