"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, CandlestickChart, Gamepad2 } from "lucide-react";
import { NeonStatusBadge } from "@/components/neon/Hero";
import type { NeonHeroBanner } from "@/components/neon/Hero";
import { splitGameTitle } from "@/components/games/arena/arena-facts";

/**
 * Phone competition hero (competition-lobby-mobile-target.jpg, 13 Oct 2026).
 *
 * The art fills the right of the card behind a left-to-right fade, so the copy sits on a
 * dark field and never runs across detailed artwork. The name is split at its first colon
 * (the same rule as the arena hero): the first half white, the rest gold. Nothing is cut:
 * the description clamps to three lines with Read more. Desktop `NeonHero` is unchanged.
 */

export function MobileLobbyHero({
  title,
  description,
  banner,
  kind,
  status,
  isCancelled,
  cancellationReason,
  kindLabel,
}: {
  title: string;
  description?: string | null;
  banner?: NeonHeroBanner;
  kind: "trading" | "game";
  /** Overrides the badge word, e.g. a game's genre. Falls back to Trading / Game. */
  kindLabel?: string | null;
  status: string;
  isCancelled: boolean;
  cancellationReason?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const text = typeof description === "string" ? description.trim() : "";
  const needsClamp = text.length > 110;
  const KindIcon = kind === "trading" ? CandlestickChart : Gamepad2;
  const name = splitGameTitle(title ?? "");

  return (
    <section className="relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#060A18]">
      <div className="absolute inset-y-0 right-0 w-[68%]" aria-hidden>
        {banner ? (
          <Image
            src={banner.src}
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 70vw, 300px"
            className="object-cover object-right"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#12183A] to-violet-900/40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#060A18] via-[#060A18]/80 to-transparent" />
      </div>

      <div className="relative space-y-3 p-4 pr-[26%]">
        <div className="flex flex-wrap items-center gap-2">
          <NeonStatusBadge status={status} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-200">
            <KindIcon className="h-3.5 w-3.5" aria-hidden />
            {kindLabel?.trim() || (kind === "trading" ? "Trading" : "Game")}
          </span>
        </div>

        <h1 className="text-[22px] font-extrabold leading-tight break-words">
          {name.subtitle ? (
            <>
              <span className="block text-white">{name.title}:</span>
              <span className="block text-amber-300">{name.subtitle}</span>
            </>
          ) : (
            <span className="text-white">{name.title}</span>
          )}
        </h1>

        {text ? (
          <div>
            <p
              className={`text-[13px] leading-relaxed text-gray-300 ${
                !expanded && needsClamp ? "line-clamp-3" : ""
              }`}
            >
              {text}
            </p>
            {needsClamp ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 inline-flex min-h-10 items-center gap-1 text-[13px] font-semibold text-cyan-300"
              >
                {expanded ? "Show less" : "Read more"}
                {!expanded ? <ArrowRight className="h-3.5 w-3.5" aria-hidden /> : null}
              </button>
            ) : null}
          </div>
        ) : null}

        {isCancelled && cancellationReason ? (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            <strong className="font-semibold">Reason:</strong>{" "}
            {cancellationReason}
          </p>
        ) : null}
      </div>
    </section>
  );
}
