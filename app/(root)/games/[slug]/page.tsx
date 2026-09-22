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
  // Reason: Prizes was removed — it duplicated Rules. Old ?tab=prizes links land on Rules.
  const normalised =
    rawTab === "prizes" ? "rules" : rawTab;
  const tab =
    normalised && ALLOWED_TABS.has(normalised) ? normalised : "overview";

  const game = await getGamePageData(slug);
  if (!game) notFound();

  return <GamePageView game={game} tab={tab} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await getGamePageData(slug);
  if (!game) return {};
  return {
    title: game.seoTitle || game.title,
    description: game.seoDescription || game.tagline || game.description,
  };
}
