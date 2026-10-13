"use client";

import { useState } from "react";
import Image from "next/image";
import { CandlestickChart, Gamepad2 } from "lucide-react";
import { NeonStatusBadge } from "@/components/neon/Hero";
import type { NeonHeroBanner } from "@/components/neon/Hero";

/**
 * Phone competition hero (Complobyymobile §5).
 *
 * Art strip is shallow (120–170px); title and description sit in an opaque block below so the
 * name never crops across detailed logo art. Title wraps 2–3 lines; description clamps with
 * Read more. Desktop `NeonHero` is unchanged.
 */

export function MobileLobbyHero({
  title,
  description,
  banner,
  kind,
  status,
  isCancelled,
  cancellationReason,
}: {
  title: string;
  description?: string | null;
  banner?: NeonHeroBanner;
  kind: "trading" | "game";
  status: string;
  isCancelled: boolean;
  cancellationReason?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const text = typeof description === "string" ? description.trim() : "";
  const needsClamp = text.length > 140;
  const KindIcon = kind === "trading" ? CandlestickChart : Gamepad2;

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[#1B2540] bg-[#0A0F1F]">
      <div className="relative h-[140px] w-full max-w-full overflow-hidden sm:h-[160px]">
        {banner ? (
          <Image
            src={banner.src}
            alt={banner.alt}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 430px"
            className="object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A1028] via-[#12183A] to-violet-900/40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070F] via-[#05070F]/55 to-transparent" />
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <NeonStatusBadge status={status} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-200">
            <KindIcon className="h-3.5 w-3.5" aria-hidden />
            {kind === "trading" ? "Trading" : "Game"}
          </span>
        </div>

        <h1 className="text-[22px] font-bold leading-snug text-white break-words">
          {title}
        </h1>

        {text ? (
          <div>
            <p
              className={`text-[14px] leading-relaxed text-gray-300 ${
                !expanded && needsClamp ? "line-clamp-3" : ""
              }`}
            >
              {text}
            </p>
            {needsClamp ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1.5 min-h-11 text-sm font-semibold text-cyan-300"
              >
                {expanded ? "Show less" : "Read more"}
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
