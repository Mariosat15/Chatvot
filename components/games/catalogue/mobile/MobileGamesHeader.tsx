import Image from "next/image";

/**
 * Compact mobile catalogue hero — CATALOGUE + GAMES wordmark + short copy.
 *
 * Reason: design-reference/game catalog mobile §§7–8. Desktop keeps Games Catalog
 * via AnalyticsPageHeadline; this tree must not import that layout.
 */

const GAMES_WORDMARK = "/assets/neon/games-catalogue-title-r1.png";

export function MobileGamesHeader() {
  return (
    <header className="relative">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#13dfff]">
        Catalogue
      </p>
      <h1 className="mt-1.5">
        <span className="sr-only">Games</span>
        <span className="relative mx-[-4px] block h-[48px] w-[min(280px,78vw)]">
          <Image
            src={GAMES_WORDMARK}
            alt=""
            fill
            priority
            sizes="280px"
            className="object-contain object-left drop-shadow-[0_0_22px_rgba(0,180,255,.32)]"
          />
        </span>
      </h1>
      <p className="mt-2.5 max-w-[34ch] text-[13.5px] leading-[1.45] text-[#d5e0f2]">
        Pick a game, check the rules, and jump into the action.
      </p>
    </header>
  );
}
