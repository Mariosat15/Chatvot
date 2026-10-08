import type { ReactNode } from "react";

/**
 * Catalogue title block — left-weighted over the full-page arena (no separate right panel).
 * Reason (8 Oct 2026, Rebuild theGame Area): Image 1 lets the background carry the trophy /
 * displays; the hero is copy + filters only.
 */
export function GamesHero({ children }: { children?: ReactNode }) {
  return (
    <section className="relative pt-5 sm:pt-6">
      <p className="text-[14px] font-semibold uppercase tracking-[0.32em] text-[#13dfff] sm:text-[15px]">
        Catalogue
      </p>
      {/* Reason: small cyan rule under the eyebrow, as in Image 1. */}
      <span
        aria-hidden
        className="mt-2 block h-[2px] w-12 rounded-full bg-[#13dfff] shadow-[0_0_10px_rgba(19,223,255,.7)]"
      />
      <h1 className="mt-3 bg-[linear-gradient(100deg,#FFFFFF_0%,#C9F8FF_45%,#6BD8FF_72%,#E65BFF_100%)] bg-clip-text text-[clamp(48px,6vw,64px)] font-black uppercase leading-none tracking-[0.02em] text-transparent [filter:drop-shadow(0_0_14px_rgba(107,216,255,.28))]">
        Games
      </h1>
      <p className="mt-4 max-w-[620px] text-[15px] leading-[1.5] text-[#d5e0f2] sm:text-[16px]">
        Pick a game, <span className="text-[#78f3ff]">read the rules</span>, and join a contest
        from its page. Competitions stay available when you want everything starting soon in one
        list.
      </p>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
