import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Catalogue title block — left-weighted over the full-page arena (no separate right panel).
 * Reason (8 Oct 2026, Rebuild theGame Area): Image 1 lets the background carry the trophy /
 * displays; the hero is copy + filters only.
 * Reason (polish, same day): owner 3D wordmark replaces the CSS-gradient "Games" text.
 */

/** Owner wordmark — cyan→magenta chrome with neon rim. */
const GAMES_TITLE = "/assets/neon/games-catalogue-title-r1.png";

export function GamesHero({ children }: { children?: ReactNode }) {
  return (
    <section className="relative pt-4 sm:pt-5">
      <p className="text-[13px] font-semibold uppercase tracking-[0.32em] text-[#13dfff] sm:text-[14px]">
        Catalogue
      </p>
      <span
        aria-hidden
        className="mt-2 block h-[2px] w-12 rounded-full bg-[#13dfff] shadow-[0_0_10px_rgba(19,223,255,.7)]"
      />
      <h1 className="mt-2">
        <span className="sr-only">Games</span>
        <span className="relative mx-[-6px] block h-[72px] w-[min(420px,72vw)] sm:h-[88px] sm:w-[min(520px,58vw)] lg:h-[104px] lg:w-[min(620px,48vw)]">
          <Image
            src={GAMES_TITLE}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 72vw, (max-width: 1024px) 520px, 620px"
            className="object-contain object-left drop-shadow-[0_0_28px_rgba(0,180,255,.35)]"
          />
        </span>
      </h1>
      <p className="mt-3 max-w-[640px] text-[15px] leading-[1.55] text-[#d5e0f2] sm:mt-4 sm:text-[16px]">
        Pick a game, <span className="text-[#78f3ff]">read the rules</span>, and join a contest
        from its page. Competitions stay available when you want everything starting soon in one
        list.
      </p>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
