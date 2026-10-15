import { COMPETITIONS_ARENA_BG } from "@/lib/competitions/game-definitions";

/**
 * Desktop chrome for provider-game competition lobbies (not trading).
 *
 * THREE COLUMNS match the owner's arena redesign: leaderboard ~23%, play stage
 * ~55%, contest info ~22%. How it works + tips sit under the columns so the
 * page does not leave a tall empty band.
 *
 * Kind-agnostic: no game code, no trading panels. Trading stays on
 * `CompetitionDetailShell`.
 */

/**
 * Side-column glow (owner, 15 Oct 2026: "the cards are not glowing"). A `drop-shadow`
 * filter on each child rather than a brighter `NEON_PANEL`: the base shell is what the
 * trading lobby renders, and a filter composes with each card's own box-shadow instead of
 * fighting it for `--tw-shadow`.
 */
const SIDE_GLOW = "[&>*]:drop-shadow-[0_0_16px_rgba(34,211,238,0.22)]";

export function GameCompetitionArenaShell({
  nav,
  hero,
  summary,
  left,
  center,
  right,
  footer,
}: {
  nav?: React.ReactNode;
  hero: React.ReactNode;
  /** Prize / entry / players / clock cards under the hero, as on the trading lobby. */
  summary?: React.ReactNode;
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen w-full"
      style={{
        backgroundImage: `linear-gradient(rgba(1,7,20,.45), rgba(1,7,20,.72)), url(${COMPETITIONS_ARENA_BG})`,
        backgroundSize: "cover",
        backgroundPosition: "top center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-4 overflow-x-hidden px-5 py-5 sm:gap-5 sm:px-7 sm:py-6 md:px-8 md:pb-10">
        {nav}
        {hero}
        {summary}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(240px,23fr)_minmax(0,55fr)_minmax(240px,22fr)] xl:items-start xl:gap-5">
          <aside className={`min-w-0 space-y-4 ${SIDE_GLOW}`}>{left}</aside>
          <section className="min-w-0 space-y-4">{center}</section>
          <aside className={`min-w-0 space-y-4 ${SIDE_GLOW}`}>{right}</aside>
        </div>
        {footer ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
