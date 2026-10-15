"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Gamepad2 } from "lucide-react";
import { NeonStatusBadge } from "@/components/neon/Hero";
import type { NeonHeroBanner } from "@/components/neon/Hero";
import { splitGameTitle } from "@/components/games/arena/arena-facts";

/**
 * Phone hero for a game competition lobby
 * (`ChartVolt_Game_Competition_Lobby_Mobile_Cursor_Guide`).
 *
 * Tall cover art (≈210–280px) with a bottom fade so the title stays readable.
 * Desktop `NeonHero` is unchanged. Category and status are separate badges.
 */

export function MobileGameLobbyHero({
  title,
  tagline,
  description,
  banner,
  categoryLabel,
  status,
  scoringNote,
}: {
  title: string;
  tagline?: string | null;
  description?: string | null;
  banner?: NeonHeroBanner;
  /** e.g. "Puzzle competition" — never hardcode Circuit Sprint. */
  categoryLabel?: string | null;
  status: string;
  scoringNote?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const name = splitGameTitle(title ?? "");
  const blurb = (tagline || description || "").trim();
  const needsClamp = blurb.length > 90;

  return (
    <section className="relative min-h-[220px] min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#060A18] sm:min-h-[250px]">
      <div className="absolute inset-0" aria-hidden>
        {banner ? (
          <Image
            src={banner.src}
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 430px"
            className="object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#12183A] to-cyan-950/50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#040814] via-[#040814]/55 to-transparent" />
      </div>

      <div className="relative flex min-h-[220px] flex-col justify-end gap-2.5 p-4 sm:min-h-[250px]">
        <div className="flex flex-wrap items-center gap-2">
          {categoryLabel ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/35 bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-100">
              <Gamepad2 className="h-3.5 w-3.5" aria-hidden />
              {categoryLabel}
            </span>
          ) : null}
          <NeonStatusBadge status={status} />
        </div>

        <h1 className="max-w-[22ch] text-[26px] font-extrabold leading-tight break-words text-white sm:text-[28px]">
          {name.subtitle ? (
            <>
              <span className="block">{name.title}</span>
              <span className="block text-[20px] font-bold text-amber-300 sm:text-[22px]">
                {name.subtitle}
              </span>
            </>
          ) : (
            name.title
          )}
        </h1>

        {blurb ? (
          <div>
            <p
              className={`text-[14px] leading-relaxed text-gray-200 ${
                !expanded && needsClamp ? "line-clamp-2" : ""
              }`}
            >
              {blurb}
            </p>
            {needsClamp ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-cyan-300"
              >
                {expanded ? "Show less" : "Read more"}
                {!expanded ? <ArrowRight className="h-3.5 w-3.5" aria-hidden /> : null}
              </button>
            ) : null}
          </div>
        ) : null}

        {scoringNote ? (
          <span className="inline-flex w-fit rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1 text-[12px] font-semibold text-amber-100">
            {scoringNote}
          </span>
        ) : null}
      </div>
    </section>
  );
}
