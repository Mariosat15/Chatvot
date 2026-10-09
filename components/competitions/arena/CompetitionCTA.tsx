import Link from "next/link";
import Image from "next/image";
import { COMPETITION_CTA_ASSET } from "@/lib/competitions/game-artwork";
import type { CompetitionCta, CtaVariant } from "@/lib/competitions/types";

/** Variants that reuse the supplied Join pill chrome with a tint + label overlay. */
const PILL_VARIANTS = new Set<CtaVariant>([
  "join",
  "reserve",
  "join_gm",
  "play",
  "terms",
]);

// Reason: Map lookup — object indexing trips security/detect-object-injection.
const PILL_TINT = new Map<CtaVariant, string>([
  ["join", ""],
  ["reserve", "hue-rotate-[-25deg] saturate-125"],
  ["join_gm", "hue-rotate-[85deg] saturate-125"],
  ["play", ""],
  ["terms", "hue-rotate-[90deg] saturate-110"],
]);

const CSS_VARIANT = new Map<CtaVariant, string>([
  [
    "results",
    "border-sky-400/60 bg-gradient-to-r from-sky-600/90 to-blue-700/85 text-white shadow-[0_0_16px_rgba(56,189,248,.35)]",
  ],
  [
    "details",
    "border-slate-400/40 bg-slate-700/80 text-slate-100 hover:bg-slate-600/80",
  ],
  [
    "disabled",
    "border-white/10 bg-white/5 text-white/40 cursor-not-allowed",
  ],
]);

function PillCta({
  cta,
  className,
}: {
  cta: CompetitionCta;
  className: string;
}) {
  const tint = PILL_TINT.get(cta.variant) ?? "";
  const inner = (
    <>
      <Image
        src={COMPETITION_CTA_ASSET.join}
        alt=""
        fill
        className={`object-fill ${tint}`}
        sizes="320px"
      />
      <span className="relative z-[1] px-3 text-center text-[14px] font-extrabold uppercase tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.85)] sm:text-[15px]">
        {cta.label}
      </span>
      <span className="sr-only">{cta.label}</span>
    </>
  );

  const shell = `competitionCta relative inline-flex h-[48px] w-full items-center justify-center overflow-hidden rounded-xl ${className}`;

  if (cta.disabled) {
    return (
      <button type="button" disabled className={`${shell} opacity-50`}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={cta.href} className={`${shell} transition hover:brightness-110`}>
      {inner}
    </Link>
  );
}

function CssCta({
  cta,
  className,
}: {
  cta: CompetitionCta;
  className: string;
}) {
  const variantClass =
    CSS_VARIANT.get(cta.variant) ??
    CSS_VARIANT.get("details") ??
    "border-white/20 bg-white/10 text-white";
  const classes = `inline-flex h-[48px] w-full items-center justify-center gap-2 rounded-xl border px-4 text-[14px] font-extrabold uppercase tracking-wide transition sm:text-[15px] ${variantClass} ${className}`;

  if (cta.disabled) {
    return (
      <button type="button" disabled className={classes}>
        {cta.label}
      </button>
    );
  }

  return (
    <Link href={cta.href} className={classes}>
      {cta.label}
      <span aria-hidden>→</span>
    </Link>
  );
}

export function CompetitionCTA({
  cta,
  className = "",
}: {
  cta: CompetitionCta;
  className?: string;
}) {
  const usePill = PILL_VARIANTS.has(cta.variant);

  return (
    <div>
      {usePill ? (
        <PillCta cta={cta} className={className} />
      ) : (
        <CssCta cta={cta} className={className} />
      )}
      {cta.reason ? (
        <p className="mt-1.5 text-center text-[12px] text-white/50">
          {cta.reason}
        </p>
      ) : null}
    </div>
  );
}
