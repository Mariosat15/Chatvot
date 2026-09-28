"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Discovery filter by genre (task 9 leftover).
 *
 * Withheld while the catalogue had one title — a filter with one value is a control that
 * appears to work and does nothing. Merchandising made a second title real, so the chips
 * render only when two or more distinct slugs are present among the games on screen.
 *
 * Filter state lives in `?category=` so a link is shareable and a refresh keeps the choice.
 * The slug is the vocabulary key, never the display label (Racing/racing/race).
 */

export interface CatalogueFilterOption {
  slug: string;
  label: string;
}

const PILL =
  "inline-flex h-[42px] shrink-0 items-center whitespace-nowrap rounded-full border px-[22px] text-[14px] font-semibold tracking-wide transition-[transform,border-color,color,box-shadow] duration-200 hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:translate-y-0";
const PILL_ACTIVE =
  "border-[#00d8ff] bg-[linear-gradient(180deg,rgba(0,216,255,.22),rgba(0,120,255,.12))] text-white shadow-[0_0_18px_rgba(0,216,255,.35)]";
const PILL_IDLE =
  "border-[rgba(38,171,255,.30)] bg-[rgba(6,16,36,.85)] text-gray-300 hover:border-[rgba(0,220,255,.6)] hover:text-white";
interface GameCatalogueFiltersProps {
  options: CatalogueFilterOption[];
  /** Current `?category=` value, or undefined for "all". */
  activeSlug?: string;
}

export function GameCatalogueFilters({
  options,
  activeSlug,
}: GameCatalogueFiltersProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefFor = useMemo(() => {
    return (slug: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (slug) next.set("category", slug);
      else next.delete("category");
      const qs = next.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    };
  }, [pathname, searchParams]);

  // Reason: one chip means every card is already in that bucket — greying out is not enough;
  // hiding the control is the feature (same as withholding Play Style when length < 2).
  if (options.length < 2) return null;

  return (
    // Reason: one row that scrolls sideways on a phone, rather than wrapping into a stack of pills.
    <div className="-mx-1 flex items-center gap-3 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="navigation" aria-label="Filter by genre">
      <Link
        href={hrefFor(null)}
        className={cn(
          PILL,
          !activeSlug
            ? PILL_ACTIVE
            : PILL_IDLE,
        )}
      >
        All
      </Link>
      {options.map((opt) => (
        <Link
          key={opt.slug}
          href={hrefFor(opt.slug)}
          className={cn(
            PILL,
            activeSlug === opt.slug
              ? PILL_ACTIVE
              : PILL_IDLE,
          )}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );
}
