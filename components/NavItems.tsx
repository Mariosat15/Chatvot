"use client";

import { NAV_ITEMS, type DashboardNavTab } from "@/lib/constants";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  BarChart3,
  Trophy,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TAB_ICONS = new Map<DashboardNavTab, typeof LayoutDashboard>([
  ["overview", LayoutDashboard],
  ["wallet", Wallet],
  ["performance", BarChart3],
  ["contests", Trophy],
  ["tutorials", GraduationCap],
]);

/**
 * Dashboard destinations for Overview / Wallet / Performance / Competitions /
 * Tutorials. Active state follows `?tab=` on `/dashboard` so Header deep links
 * and the in-page tabs stay one fact.
 */
const NavItems = ({
  variant = "header",
}: {
  /** "header" = horizontal mock chrome; "menu" = stacked for the avatar menu. */
  variant?: "header" | "menu";
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const activeTab = (searchParams.get("tab") as DashboardNavTab | null) ?? "overview";

  return (
    <ul
      className={cn(
        variant === "header"
          ? "flex flex-row items-center gap-1 sm:gap-1.5"
          : "flex flex-col gap-1 p-1",
      )}
    >
      {NAV_ITEMS.map(({ href, label, tab }) => {
        const Icon = TAB_ICONS.get(tab) ?? LayoutDashboard;
        const isActive = onDashboard && activeTab === tab;
        return (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors sm:px-3.5 sm:text-[13px]",
                isActive
                  ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/50"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-100",
                variant === "menu" && "w-full rounded-lg px-3 py-2.5 normal-case tracking-normal",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

export default NavItems;
