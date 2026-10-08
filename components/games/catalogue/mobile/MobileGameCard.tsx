import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { providerBanner } from "@/components/neon/banners";
import type { CatalogueCardStats } from "@/lib/services/games/catalogue-card-stats.service";
import { GameCategoryBadge } from "../GameCategoryBadge";
import { resolveGameCardAccent } from "../game-card-accent";
import type { GameCardData } from "../catalogue-types";
import { MobileGameStats } from "./MobileGameStats";

/**
 * One full-width mobile launcher tile — not the desktop card stacked.
 *
 * Links to `/games/[slug]` only. Featured variant bumps glow (spec §10–21).
 * Reason (8 Oct polish): `object-contain` in a fixed 16/11 frame — same fix as
 * desktop pass 2 so banners show whole, not centre-cropped.
 */

export function MobileGameCard({
  game,
  stats,
  priority = false,
}: {
  game: GameCardData;
  stats?: CatalogueCardStats | null;
  /** First card (usually featured) loads eagerly. */
  priority?: boolean;
}) {
  const banner =
    game.bannerUrl || game.thumbnailUrl
      ? {
          src: (game.bannerUrl || game.thumbnailUrl) as string,
          alt: `${game.displayName} artwork`,
        }
      : providerBanner(game.gameCode);
  const blurb = game.tagline || game.description;
  const accent = resolveGameCardAccent(game);
  const featured = Boolean(game.isFeatured);

  return (
    <article
      className="overflow-hidden rounded-[17px] border bg-[linear-gradient(180deg,rgba(5,18,45,.96),rgba(2,10,26,.98))]"
      style={
        {
          "--game-accent": accent.accent,
          "--game-accent-soft": accent.accentSecondary,
          borderColor: featured
            ? "color-mix(in srgb, var(--game-accent) 78%, transparent)"
            : "color-mix(in srgb, var(--game-accent) 58%, transparent)",
          boxShadow: featured
            ? `0 14px 36px rgba(0,0,0,.38), 0 0 22px color-mix(in srgb, var(--game-accent) 28%, transparent)`
            : `0 12px 28px rgba(0,0,0,.32), 0 0 14px color-mix(in srgb, var(--game-accent) 18%, transparent)`,
        } as CSSProperties
      }
    >
      {/*
        Reason: fixed 16/11 + object-contain matches desktop — cover was cropping sides.
      */}
      <div className="relative aspect-[16/11] w-full overflow-hidden bg-[#07101F]">
        <Image
          src={banner.src}
          alt={banner.alt}
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, 430px"
          className="object-contain object-center"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_62%,rgba(3,10,25,.4))]" />
        {game.category ? (
          <div className="absolute left-3 top-3">
            <GameCategoryBadge slug={game.categorySlug} label={game.category} />
          </div>
        ) : null}
        {featured || game.comingSoon ? (
          <div className="absolute right-3 top-3 flex gap-1.5">
            {featured ? (
              <span className="inline-flex h-[30px] items-center rounded-lg border border-[#FFC928]/6 bg-[rgba(3,14,35,.85)] px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#FFC928] backdrop-blur-md">
                Featured
              </span>
            ) : null}
            {game.comingSoon ? (
              <span className="inline-flex h-[30px] items-center rounded-lg border border-[rgba(0,220,255,.45)] bg-[rgba(3,14,35,.8)] px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#78f3ff] backdrop-blur-md">
                Coming soon
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3.5 px-4 pb-4 pt-3.5">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-[21px] font-extrabold uppercase tracking-[0.04em] text-white">
            {game.displayName}
          </h2>
          <p className="line-clamp-2 text-[13.5px] leading-[1.4] text-gray-400">
            {blurb || "Open the game page to read the rules and join a contest."}
          </p>
        </div>

        <MobileGameStats stats={stats} />

        <Link
          href={`/games/${game.slug}`}
          aria-label={`View ${game.displayName}`}
          className="inline-flex h-[50px] w-full touch-manipulation items-center justify-center gap-2 rounded-xl border-2 text-[15px] font-bold uppercase tracking-[0.06em] text-white transition-[transform,box-shadow] active:scale-[0.99] motion-reduce:transition-none"
          style={{
            borderColor: "var(--game-accent)",
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--game-accent) 28%, transparent), color-mix(in srgb, var(--game-accent) 12%, rgba(0,0,0,.35)))",
            boxShadow: "0 0 16px color-mix(in srgb, var(--game-accent) 35%, transparent)",
          }}
        >
          View Game
          <ArrowRight className="h-5 w-5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
