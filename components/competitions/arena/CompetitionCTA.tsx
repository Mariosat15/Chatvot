import Link from "next/link";
import type { CompetitionCta, CtaVariant } from "@/lib/competitions/types";

const VARIANT: Record<CtaVariant, string> = {
  join: "border-cyan-400/70 bg-gradient-to-r from-cyan-500/90 to-emerald-500/80 text-white shadow-[0_0_18px_rgba(0,216,255,.35)] hover:brightness-110",
  reserve:
    "border-amber-400/70 bg-gradient-to-r from-amber-500/90 to-orange-500/80 text-gray-950 shadow-[0_0_18px_rgba(255,176,32,.35)] hover:brightness-110",
  join_gm:
    "border-fuchsia-400/70 bg-gradient-to-r from-fuchsia-500/90 to-purple-600/80 text-white shadow-[0_0_18px_rgba(217,76,255,.35)] hover:brightness-110",
  terms:
    "border-fuchsia-300/60 bg-gradient-to-r from-purple-600/80 to-fuchsia-500/70 text-white",
  play: "border-cyan-300/80 bg-gradient-to-r from-cyan-400 to-sky-500 text-gray-950 shadow-[0_0_20px_rgba(0,216,255,.45)] hover:brightness-110",
  results:
    "border-sky-400/60 bg-gradient-to-r from-sky-600/80 to-blue-700/80 text-white",
  details:
    "border-slate-400/40 bg-slate-700/70 text-slate-100 hover:bg-slate-600/80",
  disabled: "border-white/10 bg-white/5 text-white/40 cursor-not-allowed",
};

export function CompetitionCTA({
  cta,
  className = "",
}: {
  cta: CompetitionCta;
  className?: string;
}) {
  const classes = `inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-extrabold uppercase tracking-wide transition ${VARIANT[cta.variant]} ${className}`;

  if (cta.disabled) {
    return (
      <div>
        <button type="button" disabled className={classes}>
          {cta.label}
        </button>
        {cta.reason ? (
          <p className="mt-1.5 text-center text-[11px] text-white/45">
            {cta.reason}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <Link href={cta.href} className={classes}>
        {cta.label}
        <span aria-hidden>→</span>
      </Link>
      {cta.reason ? (
        <p className="mt-1.5 text-center text-[11px] text-white/45">{cta.reason}</p>
      ) : null}
    </div>
  );
}
