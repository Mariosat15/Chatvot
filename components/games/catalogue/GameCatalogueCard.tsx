import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Gamepad2 } from "lucide-react";
import { NEON_HEADING, NEON_LABEL, NEON_PANEL } from "@/components/neon/tokens";
import type { BrowsableGame } from "@/lib/services/games/player-catalogue.service";
import { providerBanner } from "@/components/neon/banners";

/**
 * One card on the `/games` hub.
 *
 * Links to `/games/[slug]` only — never to a round-launch URL. Prefetching a launch
 * URL would spend a paying player's attempt (13 s1.1a).
 *
 * Uses `NEON_PANEL` token directly (not `NeonPanel`) so the artwork can be edge-to-edge;
 * `NeonPanel` always pads its body.
 */

export function GameCatalogueCard({ game }: { game: BrowsableGame }) {
  const banner =
    game.bannerUrl || game.thumbnailUrl
      ? {
          src: (game.bannerUrl || game.thumbnailUrl) as string,
          alt: `${game.displayName} artwork`,
        }
      : providerBanner(game.gameCode);

  return (
    <Link
      href={`/games/${game.slug}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 rounded-2xl"
    >
      <div
        className={`${NEON_PANEL} overflow-hidden p-0 transition-colors group-hover:border-sky-500/40`}
      >
        <div className="relative h-36 w-full overflow-hidden bg-[#07101F]">
          <Image
            src={banner.src}
            alt={banner.alt}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0F1F] via-[#0A0F1F]/40 to-transparent" />
          {game.category ? (
            <span
              className={`absolute left-3 top-3 rounded-md border border-[#1B2540] bg-[#0A0F1F]/85 px-2 py-0.5 ${NEON_LABEL} text-[10px]`}
            >
              {game.category}
            </span>
          ) : null}
        </div>
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0 space-y-1">
            <h2 className={`${NEON_HEADING} text-lg truncate`}>
              {game.displayName}
            </h2>
            {game.tagline ? (
              <p className="text-sm text-gray-400 line-clamp-2">{game.tagline}</p>
            ) : (
              <p className="text-sm text-gray-500 flex items-center gap-1.5">
                <Gamepad2 className="h-3.5 w-3.5 shrink-0" />
                Open game page
              </p>
            )}
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-gray-500 transition-colors group-hover:text-sky-400" />
        </div>
      </div>
    </Link>
  );
}
