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

/** Chamfered HUD plate — matches the owner's assembled bar active chip. */
const ACTIVE_CHIP =
  "[clip-path:polygon(7px_0,calc(100%-7px)_0,100%_7px,100%_calc(100%-7px),calc(100%-7px)_100%,7px_100%,0_calc(100%-7px),0_7px)]";

/**
 * Dashboard destinations for Overview / Wallet / Performance / Competitions /
 * Tutorials. Active state follows `?tab=` on `/dashboard` so Header deep links
 * and the in-page tabs stay one fact.
 *
 * Desktop Header is ONE shared neon frame (`nav-frame.png`) with the five tabs
 * inside — owner's assembled mock (29 Sep 2026). Five separate floating plates
 * were the wrong reading of the individual button assets. Phone keeps compact
 * Lucide pills (neon frame withheld — too busy at phone width).
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
      {/* Desktop — one shared HUD frame, tabs inside (owner image 2) */}
      <div className="relative mx-auto hidden h-14 w-full max-w-5xl md:block lg:h-[3.75rem]">
        <Image
          src={OVERVIEW_NAV_TAB_ART.frame}
          alt=""
          fill
          sizes="(min-width: 1024px) 1024px, 90vw"
          className="pointer-events-none object-fill"
          priority
        />
        <ul
          className="relative z-10 flex h-full items-stretch px-4 sm:px-6 lg:px-9"
          role="list"
        >
          {NAV_ITEMS.map(({ href, label, tab }, index) => {
            const Icon = TAB_ICONS.get(tab) ?? LayoutDashboard;
            const isActive = onDashboard && activeTab === tab;
            return (
              <li key={href} className="flex min-w-0 flex-1 items-center">
                {index > 0 ? (
                  <span
                    aria-hidden
                    className="mx-0.5 h-6 w-px shrink-0 bg-gradient-to-b from-transparent via-cyan-400/75 to-transparent shadow-[0_0_8px_rgba(34,211,238,0.85)] lg:h-7"
                  />
                ) : null}
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "mx-0.5 flex h-[68%] w-full min-w-0 cursor-pointer items-center justify-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-[transform,filter,color,box-shadow] duration-200 sm:text-[11px] lg:mx-1 lg:gap-2 lg:px-2 lg:text-xs lg:tracking-[0.14em]",
                    "hover:brightness-125 active:scale-[0.97] active:brightness-90 motion-reduce:hover:brightness-100 motion-reduce:active:scale-100",
                    isActive
                      ? cn(
                          ACTIVE_CHIP,
                          "bg-orange-500/15 text-orange-300 shadow-[0_0_18px_rgba(251,146,60,0.55),inset_0_0_14px_rgba(251,146,60,0.12)] ring-1 ring-orange-400/90",
                        )
                      : "text-cyan-50/90 hover:text-white",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 lg:h-4 lg:w-4",
                      isActive
                        ? "text-orange-300 drop-shadow-[0_0_8px_rgba(251,146,60,0.95)]"
                        : "text-cyan-300 drop-shadow-[0_0_7px_rgba(34,211,238,0.85)]",
                    )}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "truncate",
                      isActive
                        ? "drop-shadow-[0_0_8px_rgba(251,146,60,0.75)]"
                        : "drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]",
                    )}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Phone — compact Lucide pills (shared frame withheld on purpose) */}
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
