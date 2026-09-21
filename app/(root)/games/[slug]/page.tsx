import { notFound } from "next/navigation";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { NeonGridBackdrop } from "@/components/neon/Cards";
import { NeonHero } from "@/components/neon/Hero";
import { NeonPill } from "@/components/neon/Buttons";
import GameRulesPanel from "@/components/games/GameRulesPanel";
import { GameContestList } from "@/components/games/catalogue/GameContestList";
import { GameEmptyContests } from "@/components/games/catalogue/GameEmptyContests";
import {
  getBrowsableGameBySlug,
  listContestsForGame,
} from "@/lib/services/games/player-catalogue.service";
import { providerBanner } from "@/components/neon/banners";

export const dynamic = "force-dynamic";

/**
 * Per-game page (X11 Slice 1).
 *
 * Presentation + live/upcoming contests. Links into existing lobbies only.
 * MUST NOT create or launch a round on GET — Next.js prefetches Link targets.
 */

export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await getBrowsableGameBySlug(slug);
  if (!game) notFound();

  const contests = await listContestsForGame(game.gameKey);

  const banner = game.bannerUrl
    ? { src: game.bannerUrl, alt: `${game.displayName} banner` }
    : providerBanner(game.gameCode);

  const presentation = {
    gameName: game.displayName,
    rulesSummary: game.rulesSummary,
    howToPlay: game.howToPlay,
    howToPlayImageUrl: undefined as string | undefined,
  };

  const hasRules = Boolean(
    presentation.rulesSummary?.trim() || presentation.howToPlay?.trim(),
  );

  return (
    <div className="relative mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <NeonGridBackdrop />

      <div className="flex flex-wrap items-center gap-3">
        <NeonPill href="/games" icon={ArrowLeft} label="All games" />
      </div>

      <NeonHero
        banner={banner}
        badge={{
          icon: Gamepad2,
          label: game.category || (game.kind === "trading" ? "Trading" : "Game"),
        }}
        title={game.displayName}
        subtitle={game.tagline || game.description || null}
      />

      {game.description && game.tagline ? (
        <p className="max-w-3xl text-sm text-gray-300 leading-relaxed">
          {game.description}
        </p>
      ) : null}

      {hasRules ? (
        <GameRulesPanel presentation={presentation} layout="wide" />
      ) : null}

      {contests.length > 0 ? (
        <GameContestList contests={contests} />
      ) : (
        <GameEmptyContests game={game} />
      )}
    </div>
  );
}
