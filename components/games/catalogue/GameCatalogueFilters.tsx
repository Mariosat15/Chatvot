"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { NEON_ICON } from "@/lib/services/games/overview-assets";

/**
 * Discovery filter by genre (task 9 leftover).
 *
 * Withheld while fewer than two genres are present. State lives in `?category=`.
 * Reason (8 Oct 2026): Image 1 filters are large premium chips with real icons, not tiny pills.
 */

export interface CatalogueFilterOption {
  slug: string;
  label: string;
}

const CHIP =
  "inline-flex h-11 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full border px-[22px] text-[14px] font-semibold tracking-wide transition-[transform,border-color,color,box-shadow,background-color] duration-200 hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:translate-y-0";
const CHIP_ACTIVE =
  "border-[#00d8ff] bg-[linear-gradient(180deg,rgba(0,216,255,.24),rgba(0,120,255,.14))] text-white shadow-[0_0_16px_rgba(0,210,255,.35)]";
const CHIP_IDLE =
  "border-[rgba(70,170,255,.55)] bg-[rgba(6,18,48,.72)] text-gray-200 hover:border-[rgba(0,220,255,.75)] hover:text-white";

/** Genre slug → Menuitems neon plate. Unknown genres get no plate (label only). */
const FILTER_ICONS: ReadonlyMap<string, string> = new Map([
  ["arcade", NEON_ICON("gamepad-blue")],
  ["puzzle", NEON_ICON("cubes")],
  ["racing", NEON_ICON("rocket")],
  ["trading", NEON_ICON("candles")],
  ["circuit", NEON_ICON("cubes")],
  ["reflex", NEON_ICON("bolt-blue")],
  ["strategy", NEON_ICON("target-purple")],
  ["sports", NEON_ICON("trophy-blue")],
]);

interface GameCatalogueFiltersProps {
  options: CatalogueFilterOption[];
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

  if (options.length < 2) return null;

  return (
    <div
      className="-mx-1 flex items-center gap-3.5 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="navigation"
      aria-label="Filter by genre"
    >
      <Link
        href={hrefFor(null)}
        className={cn(CHIP, !activeSlug ? CHIP_ACTIVE : CHIP_IDLE)}
      >
        <LayoutGrid className="h-4 w-4 text-[#13dfff]" aria-hidden />
        All
      </Link>
      {options.map((opt) => {
        const icon = FILTER_ICONS.get(opt.slug);
        return (
          <Link
            key={opt.slug}
            href={hrefFor(opt.slug)}
            className={cn(
              CHIP,
              activeSlug === opt.slug ? CHIP_ACTIVE : CHIP_IDLE,
            )}
          >
            {icon ? (
              <span className="relative h-5 w-5 shrink-0" aria-hidden>
                <Image src={icon} alt="" fill sizes="20px" className="object-contain" />
              </span>
            ) : null}
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
