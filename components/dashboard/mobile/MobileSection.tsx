import Link from "next/link";
import type { ReactNode } from "react";
import { NEON_HEADING } from "@/components/neon/tokens";

/** Glass card shell shared by every mobile Overview section. */
export const MOBILE_CARD =
  "rounded-[18px] border border-[#1E2A4D] bg-[linear-gradient(160deg,rgba(12,22,44,0.92)_0%,rgba(5,10,22,0.96)_100%)]";

/** Horizontal swipe row: snap to each card, no visible scrollbar. */
export const MOBILE_CAROUSEL =
  "-mx-3 flex snap-x snap-mandatory scroll-px-3 gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export default function MobileSection({
  title,
  href,
  linkLabel = "See all",
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className={`${NEON_HEADING} text-xs tracking-[0.16em] text-white`}>
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="inline-flex min-h-[44px] items-center text-xs font-semibold text-cyan-300"
          >
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
