import Image from "next/image";
import { DesktopGamesCatalogue } from "@/components/games/catalogue/DesktopGamesCatalogue";
import { MobileGamesCatalogue } from "@/components/games/catalogue/mobile/MobileGamesCatalogue";
import type { CatalogueFilterOption } from "@/components/games/catalogue/GameCatalogueFilters";
import {
  listBrowsableGames,
  type BrowsableGame,
} from "@/lib/services/games/player-catalogue.service";
import { loadCatalogueCardStats } from "@/lib/services/games/catalogue-card-stats.service";

export const dynamic = "force-dynamic";

/**
 * Games catalogue hub (X11 Slice 1 + thin merchandising + task 9 discovery filter).
 *
 * Server component only — listing is a read. Never launches a round.
 *
 * Reason (8 Oct 2026): full-bleed arena + wide desktop shell.
 * Reason (mobile launcher, same day): below md uses a dedicated one-card-per-row
 * tree (`MobileGamesCatalogue`); desktop stays in `DesktopGamesCatalogue` and must
 * not be redesigned when phones change (design-reference/game catalog mobile).
 */

/** Cache-busted arena plate from Menuitems `Neon Cyberpunk Trophy Arena.png`. */
const ARENA_BG = "/assets/neon/games-catalogue-arena-r1.webp";

interface GamesCataloguePageProps {
  searchParams: Promise<{ category?: string }>;
}

function collectFilterOptions(games: BrowsableGame[]): CatalogueFilterOption[] {
  const seen = new Map<string, string>();
  for (const game of games) {
    if (!game.categorySlug || !game.category) continue;
    if (!seen.has(game.categorySlug)) {
      seen.set(game.categorySlug, game.category);
    }
  }
  return [...seen.entries()]
    .map(([slug, label]) => ({ slug, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export default async function GamesCataloguePage({
  searchParams,
}: GamesCataloguePageProps) {
  const { category: rawCategory } = await searchParams;

  const games = await listBrowsableGames();
  const filterOptions = collectFilterOptions(games);
  // Reason: accept any slug that appears on a live card (including custom genres), refuse
  // invented ones so a bad bookmark does not look like an empty catalogue.
  const activeSlug =
    typeof rawCategory === "string" &&
    filterOptions.some((o) => o.slug === rawCategory)
      ? rawCategory
      : undefined;

  const filtered = activeSlug
    ? games.filter((g) => g.categorySlug === activeSlug)
    : games;

  const statsByKey = await loadCatalogueCardStats(filtered.map((g) => g.gameKey));

  const catalogueProps = {
    games: filtered,
    filterOptions,
    activeSlug,
    statsByKey,
  };

  return (
    <div className="games-catalogue-page relative isolate -mx-3 min-h-[100dvh] bg-[#020B1A] sm:-mx-4 md:-mx-5 lg:-mx-6">
      {/*
        Reason: fixed to the viewport, not the content height. Shared by desktop and
        mobile so a short filter list never exposes a hard edge under the plate.
      */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <Image
          src={ARENA_BG}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_22%] md:object-[center_28%]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(1,8,25,.14)_0%,rgba(1,8,25,.32)_42%,rgba(2,11,26,.82)_78%,#020B1A_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_88%_8%,rgba(0,190,255,.12),transparent_70%),radial-gradient(40%_35%_at_12%_70%,rgba(152,92,255,.08),transparent_70%)]" />
      </div>

      <div className="hidden md:block">
        <DesktopGamesCatalogue {...catalogueProps} />
      </div>
      <div className="md:hidden">
        <MobileGamesCatalogue {...catalogueProps} />
      </div>
    </div>
  );
}
