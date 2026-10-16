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
  meta,
  children,
}: {
  banner?: NeonHeroBanner;
  /** The small pill above the title - the game's name, or the contest type. */
  badge?: { icon: LucideIcon; label: string };
  title: string;
  subtitle?: string | null;
  /** The lifecycle badge, rendered above everything else when there is one. */
  status?: React.ReactNode;
  /**
   * Optional right-side hero chrome (event id, mini timer). Competition-detail
   * summary stats live BELOW the hero in `CompetitionDetailShell`, not here.
   */
  meta?: React.ReactNode;
  /** Optional extra body under the title — keep light; do not use for the metric row. */
  children?: React.ReactNode;
}) {
  const BadgeIcon = badge?.icon;

  return (
    <div className="relative min-h-[200px] overflow-hidden rounded-2xl border border-[#1B2540] bg-[#0A0F1F] sm:min-h-[240px] md:min-h-[280px]">
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

        Reason (16 Oct 2026): on phone widths the art filled the whole card and the old
        lighter right edge left white title letters washed out ("invisible"). Keep the left
        copy field opaque on small screens; ease the right wash only from md up.
      */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#05070F] via-[#05070F]/95 to-[#05070F]/85 md:via-[#05070F]/92 md:to-[#05070F]/45" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#05070F]/55 via-transparent to-[#05070F]/70 md:from-transparent md:to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-violet-600/25" />

      <div className="relative z-10 flex flex-col justify-end gap-4 p-6 sm:p-8 md:min-h-[280px] md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {status}
              {badge && BadgeIcon && (
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 backdrop-blur-sm">
                  <BadgeIcon className="h-3.5 w-3.5 text-violet-300" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-violet-200">
                    {badge.label}
                  </span>
                </div>
              )}
            </div>

            <h1 className="text-3xl font-bold leading-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.95)] sm:text-4xl md:text-[42px]">
              {title}
            </h1>

            {subtitle && (
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-100 drop-shadow-[0_1px_10px_rgba(0,0,0,0.95)] line-clamp-3 sm:line-clamp-none sm:text-[17px] sm:text-gray-200">
                {subtitle}
              </p>
            )}
          </div>
          {meta ? <div className="shrink-0">{meta}</div> : null}
        </div>

        {children && <div className="mt-2">{children}</div>}
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
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-300 backdrop-blur-sm">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        Live now
      </span>
    );
  }

  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-rose-300 backdrop-blur-sm">
        Cancelled
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-[#2A3766] bg-[#0A0F1F]/80 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gray-300 backdrop-blur-sm">
        Completed
      </span>
    );
  }

  if (status === "upcoming" || status === "registration") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400/40 bg-yellow-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-yellow-300 backdrop-blur-sm">
        Starting soon
      </span>
    );
  }

  /*
    The three below exist for challenges, which a competition never reaches: nothing here
    contradicts the reasoning above the `draft` note, since a challenge's `pending`/`declined`/
    `expired` states ARE player-visible (to the two people party to it) rather than admin-only.
  */
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400/40 bg-yellow-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-yellow-300 backdrop-blur-sm">
        Awaiting response
      </span>
    );
  }

  if (status === "declined") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-rose-300 backdrop-blur-sm">
        Declined
      </span>
    );
  }

  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-rose-300 backdrop-blur-sm">
        Expired
      </span>
    );
  }

  /*
    A competition and a challenge both pass through this state while the optimistic lock holds
    it - see the pre-lock/post-lock gate note in the settlement services. Distinct from
    "completed" because nothing has been paid yet; a player refreshing mid-settlement should not
    read "Completed" over a screen with no results on it.
  */
  if (status === "finalizing") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-300 backdrop-blur-sm">
        <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
        Finalizing
      </span>
    );
  }

  return null;
}
