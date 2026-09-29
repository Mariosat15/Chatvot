"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { GameIcon } from "@/components/ui/GameIcon";
import type { GameIconName } from "@/lib/constants/game-icons";
import { useTerms } from "@/contexts/TerminologyContext";
import type { TerminologyPack } from "@/lib/constants/terminology";

interface NavItem {
  href: string;
  label: string;
  iconName: GameIconName;
  /** Extra route prefixes that also light this tab. */
  alsoActive?: string[];
}

/**
 * Five-tab phone nav — owner "Mobile Dashboard" spec (29 Sep 2026):
 * Home, Games, Compete, Wallet, Profile.
 *
 * Reason: the previous eight items plus Logout gave each tab ~40px, under the
 * 44px touch minimum at 360px. Challenges, Leaderboard, Marketplace and Sign
 * out stay reachable from the UserSidebar drawer (top bar menu) and the
 * Overview's Quick Access grid, so nothing became unreachable.
 *
 * Renameable nouns still come from the terminology pack (X8 pass 1) — a
 * module-level constant cannot call `useTerms`.
 */
function buildNavItems(terms: TerminologyPack): NavItem[] {
  return [
    { href: "/dashboard", label: "Home", iconName: "headset" },
    { href: "/games", label: terms.games, iconName: "joystick1" },
    {
      href: "/competitions",
      // Reason: "Compete" is the verb for the whole hub, so contests,
      // 1v1 challenges and the leaderboard all light this one tab.
      label: "Compete",
      iconName: "trophy",
      alsoActive: ["/challenges", "/leaderboard"],
    },
    { href: "/wallet", label: "Wallet", iconName: "chest1" },
    { href: "/profile", label: "Profile", iconName: "helmet1" },
  ];
}

export default function MobileBottomNav() {
  const pathname = usePathname() ?? "";
  const terms = useTerms();
  const navItems = buildNavItems(terms);
  const isActive = (item: NavItem) =>
    [item.href, ...(item.alsoActive ?? [])].some((p) => pathname.startsWith(p));

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-cyan-400/15 bg-[#050B18]/95 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="flex h-[72px] items-stretch justify-around px-1">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl"
            >
              {active && (
                <span
                  className="absolute top-0 h-[3px] w-8 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.9)]"
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
                  active && "bg-cyan-400/15",
                )}
              >
                <GameIcon
                  name={item.iconName}
                  size={24}
                  className={cn(
                    "transition-all duration-200",
                    active
                      ? "drop-shadow-[0_0_8px_rgba(34,211,238,0.75)]"
                      : "opacity-60 grayscale",
                  )}
                />
              </span>
              <span
                className={cn(
                  "max-w-full truncate px-0.5 text-[11px] font-semibold",
                  active ? "text-cyan-300" : "text-gray-500",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
