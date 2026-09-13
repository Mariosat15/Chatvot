import Image from "next/image";
import type { LucideIcon } from "lucide-react";

/**
 * The wide banner header both lobbies wear, from the top row of the owner's style sheet.
 *
 * THE BANNER IS AN IMAGE WITH A GRADIENT FALLBACK, and the fallback is the part worth
 * explaining. The sheet's four banners are illustrations - a neon racetrack, a neon car, a
 * galaxy, a gold trophy - and `public/` contained none of them before this slice (821 images,
 * every one an icon, an avatar or a journey map). They are generated assets now, but a contest
 * can always name a banner that has been deleted, or a game we have no art for yet, so the
 * component renders the gradient alone rather than a broken image box. **A hero that fails to
 * an empty rectangle takes the page's whole identity with it**, and nothing logs.
 *
 * THE OVERLAY IS NOT DECORATION. White text on an arbitrary illustration is unreadable at some
 * point in the image, which is a contrast failure rather than a taste one, so the gradient
 * scrim is always drawn over the art and is what the text actually sits on.
 */

export interface NeonHeroBanner {
  /** A path under `public/`. */
  src: string;
  /** Describes the artwork, never the contest - the contest name is the visible h1 beside it. */
  alt: string;
}

export function NeonHero({
  banner,
  badge,
  title,
  subtitle,
  status,
  children,
}: {
  banner?: NeonHeroBanner;
  /** The small pill above the title - the game's name, or the contest type. */
  badge?: { icon: LucideIcon; label: string };
  title: string;
  subtitle?: string | null;
  /** The lifecycle badge, rendered above everything else when there is one. */
  status?: React.ReactNode;
  /** The stat strip. Passed in rather than built here, because the two lobbies count different
      things and this component must not learn what a contest is. */
  children?: React.ReactNode;
}) {
  const BadgeIcon = badge?.icon;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1B2540] bg-[#0A0F1F]">
      {banner && (
        <div className="absolute inset-0">
          <Image
            src={banner.src}
            alt={banner.alt}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        </div>
      )}

      {/*
        Drawn over the art whether or not there is any: with a banner it guarantees the text is
        legible, and without one it IS the hero. The violet-to-transparent wash on the right is
        the sheet's glow treatment.
      */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#05070F] via-[#05070F]/90 to-[#05070F]/40" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-violet-600/20" />

      <div className="relative z-10 p-5 sm:p-7 md:p-8">
        {status}

        {badge && BadgeIcon && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 backdrop-blur-sm">
            <BadgeIcon className="h-3.5 w-3.5 text-violet-300" />
            <span className="text-xs font-semibold text-violet-200">
              {badge.label}
            </span>
          </div>
        )}

        <h1 className="text-2xl font-bold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] sm:text-3xl md:text-4xl">
          {title}
        </h1>

        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm text-gray-300 drop-shadow-[0_1px_8px_rgba(0,0,0,0.8)]">
            {subtitle}
          </p>
        )}

        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}

/**
 * The lifecycle badge. One component for both lobbies so a player with a trading contest and a
 * game contest open in two tabs does not have to work out which convention each tab is using.
 *
 * `draft` deliberately returns nothing. A draft is invisible to players, so the only way to
 * reach it is an operator following a direct link, and inventing a player-facing label for a
 * state players cannot see is how the admin competitions list ended up rendering drafts in the
 * grey it uses for finished contests.
 */
export function NeonStatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-300 backdrop-blur-sm">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        Live now
      </span>
    );
  }

  if (status === "cancelled") {
    return (
      <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-rose-300 backdrop-blur-sm">
        Cancelled
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#2A3766] bg-[#0A0F1F]/80 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gray-300 backdrop-blur-sm">
        Completed
      </span>
    );
  }

  if (status === "upcoming" || status === "registration") {
    return (
      <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/40 bg-yellow-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-yellow-300 backdrop-blur-sm">
        Starting soon
      </span>
    );
  }

  return null;
}
