import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, GalleryHorizontalEnd } from "lucide-react";
import { NEON_HEADING } from "@/components/neon/tokens";
import { OVERVIEW_ACTION_BUTTON_INLINE } from "@/components/dashboard/overview/overview-actions";

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
            // Reason: owner, 5 Oct 2026 - same sharp cyan CTA as desktop Compete;
            // the violet glow pill was the blurry / off-theme one.
            className={OVERVIEW_ACTION_BUTTON_INLINE}
          >
            <GalleryHorizontalEnd className="h-3.5 w-3.5" aria-hidden />
            {linkLabel}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
        {href && !linkAsButton && (
          <Link
            href={href}
            className={OVERVIEW_ACTION_BUTTON_INLINE}
          >
            {linkLabel}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
