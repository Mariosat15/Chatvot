/**
 * Shared chrome for `/games/[slug]` — panel shell and CTA button classes.
 * Model-free; safe for client components.
 */

import type { ReactNode } from "react";

export const GP_PANEL =
  "rounded-[12px] border border-[var(--gp-card-border,rgba(40,130,255,.35))] bg-[linear-gradient(180deg,#07172f,#051124)] p-5 shadow-[var(--gp-card-shadow,inset_0_0_24px_rgba(0,130,255,.05))]";

export const GP_CTA_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-[var(--gp-cta-from)] to-[var(--gp-cta-to)] px-6 py-3 text-[15px] font-bold uppercase tracking-wide text-white shadow-[0_0_28px_var(--gp-glow)] transition hover:brightness-110";

export const GP_CTA_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-[12px] border border-[var(--gp-accent-2)] bg-[var(--gp-panel-2,#091b35)]/80 px-6 py-3 text-[15px] font-bold uppercase tracking-wide text-white transition hover:border-[var(--gp-accent)] hover:shadow-[0_0_20px_rgba(168,85,247,.35)]";

export const GP_CTA_GREEN =
  "inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--gp-green,#15e89d)] px-6 py-3.5 text-[16px] font-bold uppercase tracking-wide text-[#021018] shadow-[0_0_32px_rgba(21,232,157,.45)] transition hover:brightness-110";

export function GamePagePanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`${GP_PANEL} ${className}`}>{children}</section>;
}

export function PlayNowButton({
  href,
  className = "",
  label = "Play Now",
}: {
  href: string | null;
  className?: string;
  label?: string;
}) {
  if (!href) {
    return (
      <button
        type="button"
        disabled
        className={`inline-flex cursor-not-allowed items-center gap-2 rounded-[12px] bg-white/10 px-5 py-2.5 text-sm font-semibold text-white/40 ${className}`}
      >
        No session available
      </button>
    );
  }
  return (
    <a href={href} className={`${GP_CTA_PRIMARY} ${className}`}>
      {label}
    </a>
  );
}
