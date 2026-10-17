"use client";

import { NAV_ITEMS, type DashboardNavTab } from "@/lib/constants";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  BarChart3,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TAB_ICONS = new Map<DashboardNavTab, typeof LayoutDashboard>([
  ["overview", LayoutDashboard],
  ["wallet", Wallet],
  ["performance", BarChart3],
  ["tutorials", GraduationCap],
]);

/**
 * Dashboard destinations for Overview / Wallet / Performance / Tutorials.
 * Active state follows `?tab=` on `/dashboard` so Header deep links and the
 * in-page tabs stay one fact. Competitions lives on `/competitions`, not here.
 *
 * Lucide icon + label pills (29 Sep 2026 owner preference after rejecting neon
 * HUD plates / shared frame). Active = gold pill; inactive = white.
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

  return (
    <ul
      className={cn(
        variant === "header"
          ? "flex flex-row items-center gap-2 sm:gap-3 lg:gap-4"
          : "flex flex-col gap-1 p-1",
      )}
    >
      {NAV_ITEMS.map(({ href, label, tab }) => {
        const Icon = TAB_ICONS.get(tab) ?? LayoutDashboard;
        const isActive = onDashboard && activeTab === tab;
        return (
          <li key={href} className={variant === "header" ? "shrink-0" : undefined}>
            <Link
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors sm:px-4 sm:py-2 sm:text-[13px]",
                isActive
                  ? "bg-amber-500/10 text-amber-300 ring-1 ring-amber-400/90"
                  : "text-white/90 hover:bg-white/5 hover:text-white",
                variant === "menu" &&
                  "w-full rounded-lg px-3 py-2.5 normal-case tracking-normal",
                variant === "menu" &&
                  !isActive &&
                  "text-gray-400 hover:text-gray-100",
              )}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4",
                  isActive ? "text-amber-300" : "text-current",
                )}
                aria-hidden
              />
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

export default NavItems;
