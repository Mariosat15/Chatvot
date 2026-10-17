import Link from "next/link";
import Image from "next/image";
import {
  COMPETITION_CTA_ASSET,
  resolveCtaAsset,
} from "@/lib/competitions/game-artwork";
import type { CompetitionCta } from "@/lib/competitions/types";
import { ART_BUTTON_HOVER, PRESS_EFFECT } from "@/components/ui/press-effect";

/**
 * Owner-supplied CTA PNGs â€” text and icon are baked into the asset.
 *
 * Reason: every state uses the supplied artwork, never a CSS pill. The PNGs are
 * RGBA with clear corners (checked 9 Oct 2026), so no blend mode is needed; the
 * old `mix-blend-darken` was a workaround for an earlier white-canvas file.
 * A state with no asset of its own (disabled) shows the Join artwork greyed out
 * with the reason underneath, so the player still learns why it is unavailable.
 */
export function CompetitionCTA({
  cta,
  glow,
  fillCell = false,
  className = "",
}: {
  cta: CompetitionCta;
  /** Game accent glow (rgba) behind the button */
  glow?: string;
  /**
   * Occupy a metric cell's footprint. The artwork stays `object-contain`:
   * stretching it distorts the baked-in text and icon.
   */
  fillCell?: boolean;
  className?: string;
}) {
  const asset = resolveCtaAsset(cta.variant) ?? COMPETITION_CTA_ASSET.join;
  const unavailable = cta.variant === "disabled" || cta.disabled;
  const greyed = unavailable && cta.variant !== "already_in";
  // Reason: in-grid CTAs already match other cards' height; a caption under
  // "Join GM to Enter" shrinks the artwork and duplicates the Private ribbon.
  const caption =
    fillCell ? "" : cta.reason || (greyed ? cta.label : "");

  const shell = `competitionCta relative block w-full ${
    fillCell ? "h-full max-w-none" : "aspect-[3/1] max-w-[300px]"
  } ${
    greyed
      ? "cursor-not-allowed opacity-45 grayscale"
      : `${PRESS_EFFECT} ${ART_BUTTON_HOVER}`
  }`;

  const inner = (
    <>
      <Image
        src={asset}
        alt=""
        fill
        loading="lazy"
        className="object-contain"
        // Reason: the drop-shadow glow haloes the baked-in text so the small
        // in-grid button reads as blurred; only the standalone size keeps it.
        style={
          !greyed && glow && !fillCell
            ? { filter: `drop-shadow(0 0 10px ${glow})` }
            : undefined
        }
        sizes="300px"
      />
      <span className="sr-only">{cta.label}</span>
    </>
  );
  // Reason: the greyed Join artwork has "Join Competition" baked in, and the in-grid cell has no
  // room for a caption - so "Registration Closed" read as a broken Join button. Overlay the real
  // label on the cell; the artwork is the only state cue left otherwise.
  const overlay =
    greyed && fillCell ? (
      <span className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-md border border-white/15 bg-black/75 px-1.5 py-1 text-center text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white/85">
        {cta.label}
      </span>
    ) : null;

  return (
    <div
      className={`flex w-full flex-col items-center ${
        fillCell ? "h-full" : ""
      } ${className}`}
    >
      {unavailable ? (
        <div className={`relative flex w-full justify-center ${fillCell ? "h-full" : ""}`}>
          <button type="button" disabled className={shell}>
            {inner}
          </button>
          {overlay}
        </div>
      ) : (
        <Link href={cta.href} className={shell}>
          {inner}
        </Link>
      )}
      {caption ? (
        <p className="mt-1 w-full max-w-[300px] text-center text-[11px] leading-tight text-white/55">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
