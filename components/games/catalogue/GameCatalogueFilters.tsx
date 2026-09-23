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
    <div className="flex flex-wrap items-center gap-2" role="navigation" aria-label="Filter by genre">
      <Link
        href={hrefFor(null)}
        className={cn(
          "rounded-full border px-3 py-1 text-xs transition-colors",
          !activeSlug
            ? "border-sky-500/60 bg-sky-500/20 text-sky-200"
            : "border-[#1B2540] bg-[#0A0F1F]/80 text-gray-400 hover:text-gray-200",
        )}
      >
        All
      </Link>
      {options.map((opt) => (
        <Link
          key={opt.slug}
          href={hrefFor(opt.slug)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            activeSlug === opt.slug
              ? "border-sky-500/60 bg-sky-500/20 text-sky-200"
              : "border-[#1B2540] bg-[#0A0F1F]/80 text-gray-400 hover:text-gray-200",
          )}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );
}
