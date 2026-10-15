import { COMPETITIONS_ARENA_BG } from "@/lib/competitions/game-definitions";

/**
 * Dedicated phone layout for provider-game competition lobbies.
 *
 * Order (owner redesign): banner → title/info → countdown/PLAY → stats →
 * leaderboard → prizes → how it works / tips. Never a squeezed desktop grid.
 *
 * Breakpoint shared with trading phone lobby: show below 769px.
 */

export function MobileGameCompetitionLobby({
  nav,
  hero,
  summary,
  center,
  stats,
  leaderboard,
  prizes,
  howItWorks,
  tips,
  footer,
}: {
  nav?: React.ReactNode;
  hero: React.ReactNode;
  /** Same prize / entry / players / clock cards as desktop (one shared component). */
  summary?: React.ReactNode;
  center: React.ReactNode;
  stats: React.ReactNode;
  leaderboard: React.ReactNode;
  prizes?: React.ReactNode;
  howItWorks?: React.ReactNode;
  tips?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundImage: `linear-gradient(rgba(1,7,20,.55), rgba(1,7,20,.78)), url(${COMPETITIONS_ARENA_BG})`,
        backgroundSize: "cover",
        backgroundPosition: "top center",
      }}
    >
      <div
        className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col gap-4 overflow-x-hidden px-3 py-4"
        style={{
          paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
        }}
      >
        {nav}
        {hero}
        {summary}
        {center}
        {stats}
        {leaderboard}
        {prizes}
        {howItWorks}
        {tips}
        {footer}
      </div>
    </div>
  );
}
