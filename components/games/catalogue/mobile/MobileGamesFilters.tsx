"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import type { CatalogueFilterOption } from "../GameCatalogueFilters";

/**
 * Horizontally swipeable genre chips for the mobile launcher.
 *
 * Same `?category=` source as desktop — layout only differs (spec §9 / §25).
 */

const CHIP =
  "inline-flex h-11 shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold tracking-wide transition-[border-color,box-shadow,background-color] duration-200";
const CHIP_ACTIVE =
  "border-[#00d8ff] bg-[linear-gradient(180deg,rgba(0,216,255,.22),rgba(0,120,255,.12))] text-white shadow-[0_0_14px_rgba(0,210,255,.32)]";
const CHIP_IDLE =
  "border-[rgba(70,170,255,.38)] bg-[rgba(6,18,48,.62)] text-gray-200";

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

export function MobileGamesFilters({
  options,
  activeSlug,
}: {
  options: CatalogueFilterOption[];
  activeSlug?: string;
}) {
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
      className="-mx-1 flex items-center gap-2.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] snap-x snap-proximity [&::-webkit-scrollbar]:hidden"
      role="navigation"
      aria-label="Filter by genre"
    >
      <Link
        href={hrefFor(null)}
        className={cn(CHIP, !activeSlug ? CHIP_ACTIVE : CHIP_IDLE)}
        aria-current={!activeSlug ? "true" : undefined}
      >
        <LayoutGrid className="h-4 w-4 text-[#13dfff]" aria-hidden />
        All
      </Link>
      {options.map((opt) => {
        const icon = FILTER_ICONS.get(opt.slug);
        const selected = activeSlug === opt.slug;
        return (
          <Link
            key={opt.slug}
            href={hrefFor(opt.slug)}
            className={cn(CHIP, selected ? CHIP_ACTIVE : CHIP_IDLE)}
            aria-current={selected ? "true" : undefined}
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
