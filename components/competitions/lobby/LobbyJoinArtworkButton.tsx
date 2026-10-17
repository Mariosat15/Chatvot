"use client";

import Image from "next/image";
import {
  COMPETITION_CTA_ASSET,
  resolveCtaAsset,
} from "@/lib/competitions/game-artwork";
import type { CtaVariant } from "@/lib/competitions/types";
import { ART_BUTTON_HOVER, PRESS_EFFECT } from "@/components/ui/press-effect";

/**
 * Menuitems join / reserve / already-in artwork as a real clickable button.
 *
 * WHY NOT `CompetitionCTA`. That component is a `<Link>` for the competitions
 * browser. The lobby's entry control POSTs (and may open terms), so it must be
 * a `<button>` with a handler — same asset family, different element.
 *
 * Press + hand: `PRESS_EFFECT` (owner, 17 Oct 2026 — same on every control).
 */

export function LobbyJoinArtworkButton({
  variant,
  label,
  onClick,
  disabled = false,
  busy = false,
}: {
  variant: CtaVariant;
  /** Accessible name — the PNG already paints the visible label. */
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const asset = resolveCtaAsset(variant) ?? COMPETITION_CTA_ASSET.join;
  const greyed = disabled || busy;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={greyed}
      aria-busy={busy || undefined}
      className={`competitionCta relative mx-auto block w-full max-w-[320px] aspect-[3/1] ${
        greyed
          ? "cursor-not-allowed opacity-45 grayscale"
          : `${PRESS_EFFECT} ${ART_BUTTON_HOVER}`
      }`}
    >
      <Image
        src={asset}
        alt=""
        fill
        className="object-contain"
        sizes="320px"
        priority={false}
      />
      <span className="sr-only">{busy ? `Working… ${label}` : label}</span>
    </button>
  );
}
