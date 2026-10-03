import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, GalleryHorizontalEnd } from "lucide-react";
import { NEON_HEADING } from "@/components/neon/tokens";

/** Glass card shell shared by every mobile Overview section. */
export const MOBILE_CARD =
  "rounded-[18px] border border-[#1E2A4D] bg-[linear-gradient(160deg,rgba(12,22,44,0.92)_0%,rgba(5,10,22,0.96)_100%)]";

/**
 * Horizontal swipe row — soft snap + momentum scrolling.
 * Reason: snap-mandatory felt clunky on phones (owner 3 Oct 2026); proximity
 * + scroll-smooth + touch momentum keeps cards aligned without fighting the finger.
 */
export const MOBILE_CAROUSEL =
  "-mx-3 flex snap-x snap-proximity scroll-smooth scroll-px-3 gap-3 overflow-x-auto overscroll-x-contain px-3 pb-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden";

export default function MobileSection({
  title,
  href,
  linkLabel = "See all",
  linkAsButton = false,
  iconSrc,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  /** Render the header link as a pill button so it reads as pressable. */
  linkAsButton?: boolean;
  /** Optional neon plate — same glyph as the desktop section header. */
  iconSrc?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {iconSrc && (
            <span className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-transparent">
              <Image
                src={iconSrc}
                alt=""
                fill
                sizes="32px"
                // Reason: owner plates are black-canvas exports — match desktop knock-out.
                className="object-contain mix-blend-screen"
              />
            </span>
          )}
          <h2 className={`${NEON_HEADING} text-xs tracking-[0.16em] text-white`}>
            {title}
          </h2>
        </div>
        {href && linkAsButton && (
          <Link
            href={href}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border border-violet-400/70 bg-gradient-to-r from-indigo-700/80 to-violet-600/80 px-3.5 text-xs font-semibold text-white shadow-[0_0_14px_rgba(139,92,246,0.55)] transition-transform duration-200 ease-out active:scale-95"
          >
            <GalleryHorizontalEnd className="h-3.5 w-3.5" aria-hidden />
            {linkLabel}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
        {href && !linkAsButton && (
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
