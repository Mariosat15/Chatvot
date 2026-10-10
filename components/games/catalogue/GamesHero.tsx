import Image from "next/image";
import type { ReactNode } from "react";
import { AnalyticsPageHeadline } from "@/components/dashboard/AnalyticsPageHeadline";

/**
 * Catalogue title block — left-weighted over the full-page arena.
 *
 * Reason (8 Oct 2026 polish pass 2): match Wallet Analytics — neon plate icon +
 * two-tone "Games Catalog" via AnalyticsPageHeadline. The 3D GAMES wordmark is gone.
 * Reason (mobile polish): `compact` shrinks type/icon for phones; same lead/accent/
 * icon asset so mobile cannot drift from desktop again.
 */

/** Owner glass-neon gamepad plate for the catalogue header. */
const HEADER_ICON = "/assets/neon/games-catalogue-header-r1.png";

export function GamesHero({
  children,
  compact = false,
}: {
  children?: ReactNode;
  /** Phone launcher — same chrome, smaller type. */
  compact?: boolean;
}) {
  return (
    <section className={`relative ${compact ? "pt-1" : "pt-4 sm:pt-5"}`}>
      <AnalyticsPageHeadline
        tag="h1"
        lead="Games"
        accentWord="Catalog"
        accent="cyan"
        compact={compact}
        subtitle={
          compact
            ? "Pick a game, check the rules, and jump into the action."
            : "Pick a game, read the rules, and join a contest from its page. Competitions stay available when you want everything starting soon in one list."
        }
        icon={
          <span
            className={
              compact
                ? "relative h-12 w-12 shrink-0 overflow-hidden rounded-[11px] shadow-[0_0_18px_rgba(0,229,255,0.38)] ring-1 ring-cyan-400/55"
                : "relative h-14 w-14 shrink-0 overflow-hidden rounded-[12px] shadow-[0_0_22px_rgba(0,229,255,0.4)] ring-1 ring-cyan-400/55 sm:h-16 sm:w-16"
            }
          >
            <Image
              src={HEADER_ICON}
              alt=""
              fill
              priority
              sizes={compact ? "48px" : "64px"}
              className="object-contain object-center"
            />
          </span>
        }
      />
      {children ? <div className={compact ? "mt-4" : "mt-5"}>{children}</div> : null}
    </section>
  );
}
