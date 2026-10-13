import type { ReactNode } from "react";

/**
 * The one card shell for every block on the phone lobby (mobile fix guide, 13 Oct 2026).
 *
 * Deliberately quieter than the desktop `NeonPanel`: one hairline border, no outer glow,
 * the same 16px padding and heading row everywhere, so the page reads as one column of
 * evenly spaced blocks rather than a stack of competing frames.
 */

/** The frame without padding, for cards whose rows run edge to edge. */
export const MOBILE_CARD_SHELL =
  "min-w-0 rounded-2xl border border-white/[0.07] bg-[#0A1024]/85";

export const MOBILE_CARD = `${MOBILE_CARD_SHELL} p-4`;

export function MobileLobbyCard({
  id,
  iconSrc,
  title,
  action,
  children,
  className = "",
}: {
  id?: string;
  iconSrc?: string;
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-4 ${MOBILE_CARD} ${className}`}>
      {title ? (
        <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
          <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-bold text-white">
            {iconSrc ? <MobileIcon src={iconSrc} className="h-6 w-6" /> : null}
            <span className="min-w-0 truncate">{title}</span>
          </h2>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Fixed local icon art, the same `<img>` the neon kit uses for its panel icons. */
export function MobileIcon({
  src,
  className,
}: {
  src: string;
  className: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed local icon art
    <img
      src={src}
      alt=""
      draggable={false}
      aria-hidden
      className={`shrink-0 object-contain ${className}`}
    />
  );
}

/** Small rounded label used in card headers ("3 traders", "Fee 10%"). */
export function MobileChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "cyan";
}) {
  const toneClass =
    tone === "gold"
      ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
      : tone === "cyan"
        ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-200"
        : "border-white/10 bg-white/[0.04] text-gray-300";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}
    >
      {children}
    </span>
  );
}
