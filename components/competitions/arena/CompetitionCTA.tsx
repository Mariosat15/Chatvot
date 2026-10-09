import Link from "next/link";
import Image from "next/image";
import {
  COMPETITION_CTA_ASSET,
  resolveCtaAsset,
} from "@/lib/competitions/game-artwork";
import type { CompetitionCta } from "@/lib/competitions/types";

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
  const caption = cta.reason || (greyed ? cta.label : "");

  const shell = `competitionCta relative block w-full ${
    fillCell ? "h-full max-w-none" : "aspect-[3/1] max-w-[300px]"
  } ${
    greyed
      ? "cursor-not-allowed opacity-45 grayscale"
      : "transition hover:-translate-y-px hover:brightness-110"
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

  return (
    <div
      className={`flex w-full flex-col items-center ${
        fillCell ? "h-full" : ""
      } ${className}`}
    >
      {unavailable ? (
        <button type="button" disabled className={shell}>
          {inner}
        </button>
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
