import { COMPETITIONS_ARENA_BG } from "@/lib/competitions/game-definitions";

/**
 * Shared desktop competition-detail page chrome.
 *
 * Spec: `External game plans/ChartVolt_Desktop_Competition_Detail_Cursor_Spec.md`.
 * Hero and summary sit full-width; main (~2fr) and sidebar (~0.9fr) sit below.
 * Kind-specific content is passed as slots — this shell never branches on game code.
 */

export function CompetitionDetailShell({
  nav,
  hero,
  summary,
  main,
  sidebar,
  footer,
}: {
  nav?: React.ReactNode;
  hero: React.ReactNode;
  summary: React.ReactNode;
  main: React.ReactNode;
  sidebar: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    // Reason: same arena backdrop as the competitions hub (`CompetitionsArena`), so the detail
    // page reads as part of that section rather than a bare dark admin screen (owner, 12 Oct 2026).
    <div
      className="min-h-screen w-full"
      style={{
        backgroundImage: `linear-gradient(rgba(1,7,20,.28), rgba(1,7,20,.50)), url(${COMPETITIONS_ARENA_BG})`,
        backgroundSize: "cover",
        backgroundPosition: "top center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-5 overflow-x-hidden px-5 py-6 sm:gap-6 sm:px-7 sm:py-8 md:px-8 md:pb-10">
        {nav}
        {hero}
        {summary}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(340px,0.9fr)] lg:gap-6">
          <div className="min-w-0 space-y-5 sm:space-y-6">{main}</div>
          <aside className="min-w-0 space-y-5 sm:space-y-6">{sidebar}</aside>
        </div>
        {footer}
      </div>
    </div>
  );
}
