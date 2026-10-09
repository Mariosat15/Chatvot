import Link from "next/link";
import Image from "next/image";
import { resolveCtaAsset } from "@/lib/competitions/game-artwork";
import type { CompetitionCta } from "@/lib/competitions/types";

/**
 * Owner-supplied CTA PNGs — text/icons are baked into the asset.
 * Reason: Image 1 requires real Join / Reserve / Join GM / View Results / Already In
 * chrome, not CSS gradients tinting one Join pill.
 */
export function CompetitionCTA({
  cta,
  className = "",
}: {
  cta: CompetitionCta;
  className?: string;
}) {
  const asset = resolveCtaAsset(cta.variant);
  const muted =
    cta.variant === "disabled" ||
    cta.variant === "details" ||
    (cta.disabled && cta.variant !== "already_in");

  if (!asset || cta.variant === "disabled") {
    const classes = `inline-flex h-[48px] w-full items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 text-[13px] font-extrabold uppercase tracking-wide text-white/55 ${className}`;
    if (cta.disabled) {
      return (
        <div>
          <button type="button" disabled className={classes}>
            {cta.label}
          </button>
          {cta.reason ? (
            <p className="mt-1.5 text-center text-[12px] text-white/50">
              {cta.reason}
            </p>
          ) : null}
        </div>
      );
    }
    return (
      <div>
        <Link href={cta.href} className={`${classes} hover:bg-white/10`}>
          {cta.label}
        </Link>
        {cta.reason ? (
          <p className="mt-1.5 text-center text-[12px] text-white/50">
            {cta.reason}
          </p>
        ) : null}
      </div>
    );
  }

  const shell = `competitionCta relative block h-[52px] w-full max-w-[300px] overflow-hidden ${muted ? "opacity-70 grayscale-[.25]" : "transition hover:brightness-110"} ${className}`;

  // Reason: JoinComp PNG ships on a white canvas — darken knocks white out on the
  // dark card. Black-canvas assets (Reserve / GM / Results / Already In) need no blend.
  const blend =
    cta.variant === "join" || cta.variant === "play"
      ? "mix-blend-darken"
      : "";

  const inner = (
    <>
      <Image
        src={asset}
        alt=""
        fill
        className={`object-contain object-center ${blend}`}
        sizes="300px"
        priority={false}
      />
      <span className="sr-only">{cta.label}</span>
    </>
  );

  return (
    <div className="flex flex-col items-end">
      {cta.disabled ? (
        <button type="button" disabled className={`${shell} cursor-not-allowed`}>
          {inner}
        </button>
      ) : (
        <Link href={cta.href} className={shell}>
          {inner}
        </Link>
      )}
      {cta.reason ? (
        <p className="mt-1.5 w-full text-center text-[12px] text-white/50 sm:text-right">
          {cta.reason}
        </p>
      ) : null}
    </div>
  );
}
