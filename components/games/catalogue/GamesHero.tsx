import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Hero artwork. The `-r1` suffix is a cache key: a replacement written over the same filename is
 * served from returning visitors' caches for hours (R54), so a new picture takes a new name.
 */
const HERO_ART = "/assets/neon/games-hero-arena-r1.webp";

/** Title block of the catalogue: label, gradient heading, subtitle, then the filter row. */
export function GamesHero({ children }: { children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-full md:w-[68%]" aria-hidden>
        <Image
          src={HERO_ART}
          alt=""
          fill
          priority
          sizes="(max-width: 767px) 100vw, 68vw"
          className="object-cover object-[center_30%]"
        />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,8,23,.98)_0%,rgba(2,8,23,.92)_35%,rgba(2,8,23,.55)_65%,rgba(2,8,23,.25)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,#020817)]"
      />

      <div className="relative mx-auto w-full max-w-[1400px] space-y-5 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <p className="text-[13px] font-semibold uppercase tracking-[0.32em] text-[#00d8ff] sm:text-[14px]">
          Catalogue
        </p>
        <h1 className="bg-[linear-gradient(90deg,#fff_0%,#78f3ff_55%,#00d8ff_100%)] bg-clip-text text-[44px] font-extrabold uppercase leading-none tracking-[0.02em] text-transparent [filter:drop-shadow(0_0_18px_rgba(0,216,255,.35))] sm:text-[64px] lg:text-[72px]">
          Games
        </h1>
        <p className="max-w-[620px] text-[15px] leading-[1.55] text-gray-300 sm:text-[16px]">
          Pick a game, <span className="text-[#78f3ff]">read the rules</span>, and join a contest
          from its page. Competitions stays available when you want everything starting soon in
          one list.
        </p>
        {children ? <div className="pt-2">{children}</div> : null}
      </div>
    </section>
  );
}
