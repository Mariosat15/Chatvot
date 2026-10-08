import Image from "next/image";
import { AnalyticsPageHeadline } from "@/components/dashboard/AnalyticsPageHeadline";

/**
 * Compact mobile catalogue hero — same Games Catalog + gamepad as desktop.
 *
 * Reason (8 Oct 2026 polish): owner reported the 3D wordmark missing the desktop
 * title; reuse AnalyticsPageHeadline so both breakpoints share one chrome.
 */

/** Same glass-neon gamepad plate as GamesHero. */
const HEADER_ICON = "/assets/neon/games-catalogue-header-r1.png";

export function MobileGamesHeader() {
  return (
    <header className="relative pt-1">
      <AnalyticsPageHeadline
        tag="h1"
        lead="Games"
        accentWord="Catalog"
        accent="cyan"
        subtitle="Pick a game, check the rules, and jump into the action."
        icon={
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[11px] shadow-[0_0_18px_rgba(0,229,255,0.38)] ring-1 ring-cyan-400/55">
            <Image
              src={HEADER_ICON}
              alt=""
              fill
              priority
              sizes="48px"
              className="object-contain object-center"
            />
          </span>
        }
      />
    </header>
  );
}
