"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  BarChart3,
  Trophy,
  GraduationCap,
} from "lucide-react";
import { NAV_ITEMS, type DashboardNavTab } from "@/lib/constants";
import { OVERVIEW_NAV_TAB_ART } from "@/lib/services/games/overview-assets";
import { cn } from "@/lib/utils";

const TAB_ICONS = new Map<DashboardNavTab, typeof LayoutDashboard>([
  ["overview", LayoutDashboard],
  ["wallet", Wallet],
  ["performance", BarChart3],
  ["contests", Trophy],
  ["tutorials", GraduationCap],
]);

const TAB_ART = new Map<DashboardNavTab, string>([
  ["overview", OVERVIEW_NAV_TAB_ART.overview],
  ["wallet", OVERVIEW_NAV_TAB_ART.wallet],
  ["performance", OVERVIEW_NAV_TAB_ART.performance],
  ["contests", OVERVIEW_NAV_TAB_ART.contests],
  ["tutorials", OVERVIEW_NAV_TAB_ART.tutorials],
]);

// Reason: same loom as Matching Cards / View Leaderboard — brighten + grow on
// hover, shrink + dim on press. Width stays flexible so five plates fit one row.
const ART_TAB =
  "relative block h-11 w-full min-w-0 max-w-[11.5rem] cursor-pointer transition-[transform,filter] duration-200 ease-out hover:brightness-125 hover:scale-[1.04] active:scale-[0.96] active:brightness-90 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 lg:h-12";

/**
 * Dashboard destinations for Overview / Wallet / Performance / Competitions /
 * Tutorials. Active state follows `?tab=` on `/dashboard` so Header deep links
 * and the in-page tabs stay one fact.
 *
 * Desktop Header uses the owner neon HUD plates. Phone keeps compact Lucide
 * pills — five full neon frames at ~375px is the busy chrome the Mobile
 * Dashboard brief forbids (large desktop top navigation).
 */
const NavItems = ({
  variant = "header",
}: {
  /** "header" = horizontal mock chrome; "menu" = stacked for the avatar menu. */
  variant?: "header" | "menu";
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onDashboard =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const activeTab =
    (searchParams.get("tab") as DashboardNavTab | null) ?? "overview";

  if (variant === "menu") {
    return (
      <ul className="flex flex-col gap-1 p-1">
        {NAV_ITEMS.map(({ href, label, tab }) => {
          const Icon = TAB_ICONS.get(tab) ?? LayoutDashboard;
          const isActive = onDashboard && activeTab === tab;
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors",
                  isActive
                    ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/50"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-100",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      {/* Desktop — neon HUD plates */}
      <ul
        className="hidden w-full max-w-5xl flex-row items-center justify-center gap-1 md:flex lg:gap-1.5"
        role="list"
      >
        {NAV_ITEMS.map(({ href, label, tab }) => {
          const art = TAB_ART.get(tab) ?? OVERVIEW_NAV_TAB_ART.overview;
          const isActive = onDashboard && activeTab === tab;
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                aria-label={label}
                className={cn(
                  ART_TAB,
                  "mx-auto",
                  isActive
                    ? "drop-shadow-[0_0_14px_rgba(34,211,238,0.55)]"
                    : "opacity-70 brightness-75 hover:opacity-100",
                )}
              >
                <Image
                  src={art}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 184px, 160px"
                  className="object-contain"
                  priority={tab === "overview"}
                />
                <span className="sr-only">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Phone — compact Lucide pills (neon plates withheld on purpose) */}
      <ul className="flex flex-row items-center gap-1 overflow-x-auto sm:gap-1.5 md:hidden">
        {NAV_ITEMS.map(({ href, label, tab }) => {
          const Icon = TAB_ICONS.get(tab) ?? LayoutDashboard;
          const isActive = onDashboard && activeTab === tab;
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors sm:px-3.5 sm:text-[13px]",
                  isActive
                    ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/50"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-100",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
};

export default NavItems;
