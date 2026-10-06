"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWhiteLabelImages } from "@/hooks/useWhiteLabelImages";
import { useUserProfileImage } from "@/hooks/useUserProfileImage";
import { signOut } from "@/lib/actions/auth.actions";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";
import { GameIcon } from "@/components/ui/GameIcon";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { GM_SUBSCRIPTION_CHANGED } from "@/lib/events/gm-subscription";
import { useTerms } from "@/contexts/TerminologyContext";
import type { TerminologyPack } from "@/lib/constants/terminology";
import { isValidGameIconName } from "@/lib/constants/game-icons";
import {
  Menu,
  X,
  ChevronRight,
} from "lucide-react";

interface SidebarUser {
  id: string;
  name: string;
  /** Username (or the stable `Player_XXXXXX` fallback) - what other players see. */
  publicName?: string;
  email: string;
}

interface UserSidebarProps {
  user: SidebarUser;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  badge?: string;
  numericBadge?: number;
}

/**
 * Labels that are renameable nouns come from the terminology pack (X8 pass 1).
 *
 * // Reason: a module-level constant cannot call `useTerms`, and hard-coding "Competitions"
 * // beside a provider that can rename it is exactly the silence the token layer exists to
 * // end. Routes stay `/competitions` etc. — identifiers are never-rename.
 */
const NAV_ICON = "!h-full !w-full";

/** Neon shell tokens — match the owner sidebar mock (cyan frame, glass plates). */
const SHELL =
  "bg-[linear-gradient(180deg,#07101f_0%,#050b16_55%,#03070f_100%)]";
const FRAME_GLOW =
  "shadow-[0_0_0_1px_rgba(0,242,255,0.55),0_0_24px_rgba(0,180,255,0.28),inset_0_0_40px_rgba(0,120,200,0.08)]";

function buildMainNavItems(terms: TerminologyPack): NavItem[] {
  return [
    {
      // Reason: bare /dashboard restores the last ?tab= from localStorage, so a
      // player who left Wallet Analytics would never land on Overview. Always pin it.
      href: "/dashboard?tab=overview",
      label: "Dashboard",
      icon: <GameIcon name="headset" size={40} className={NAV_ICON} />,
      color: "text-blue-400",
      gradient: "from-cyan-500/25 to-blue-600/10",
    },
    {
      href: "/games",
      // Reason: X11 Slice 1 — games-first discovery. HOT moves here from Competitions;
      // `/competitions` stays for "what starts soonest" browsing.
      label: "Games",
      icon: <GameIcon name="joystick1" size={40} className={NAV_ICON} />,
      color: "text-sky-400",
      gradient: "from-sky-500/20 to-cyan-600/5",
      badge: "HOT",
    },
    {
      href: "/competitions",
      label: terms.contests,
      icon: <GameIcon name="trophy" size={40} className={NAV_ICON} />,
      color: "text-yellow-400",
      gradient: "from-yellow-500/20 to-yellow-600/5",
    },
    {
      href: "/challenges",
      // Reason: keep the "1v1 " prefix — it is format, not the noun; the noun is the token.
      label: `1v1 ${terms.challenges}`,
      icon: <GameIcon name="sword" size={40} className={NAV_ICON} />,
      color: "text-red-400",
      gradient: "from-red-500/20 to-red-600/5",
    },
    {
      href: "/marketplace",
      label: "Marketplace",
      icon: <GameIcon name="pouch1" size={40} className={NAV_ICON} />,
      color: "text-purple-400",
      gradient: "from-purple-500/20 to-purple-600/5",
    },
    {
      href: "/leaderboard",
      label: terms.leaderboard,
      icon: <GameIcon name="goldMedal" size={40} className={NAV_ICON} />,
      color: "text-emerald-400",
      gradient: "from-emerald-500/20 to-emerald-600/5",
    },
    {
      href: "/arena",
      label: "Live Arena",
      icon: <GameIcon name="crown" size={40} className={NAV_ICON} />,
      color: "text-cyan-300",
      gradient: "from-cyan-500/20 to-blue-600/5",
      badge: "LIVE",
    },
    {
      href: "/messaging",
      label: "Messages",
      icon: <GameIcon name="flag" size={40} className={NAV_ICON} />,
      color: "text-pink-400",
      gradient: "from-pink-500/20 to-pink-600/5",
    },
  ];
}

const accountNavItems: NavItem[] = [
  {
    href: "/profile",
    label: "Profile",
    icon: <GameIcon name="helmet1" size={40} className={NAV_ICON} />,
    color: "text-cyan-400",
    gradient: "from-cyan-500/20 to-cyan-600/5",
  },
  {
    href: "/wallet",
    label: "Wallet",
    icon: <GameIcon name="chest1" size={40} className={NAV_ICON} />,
    color: "text-green-400",
    gradient: "from-green-500/20 to-green-600/5",
  },
  {
    href: "/help",
    label: "Help Center",
    icon: <GameIcon name="guideBook" size={40} className={NAV_ICON} />,
    color: "text-orange-400",
    gradient: "from-orange-500/20 to-orange-600/5",
  },
];

function SectionHeader({
  label,
  collapsed,
  accent = "cyan",
}: {
  label: string;
  collapsed: boolean;
  accent?: "cyan" | "amber";
}) {
  if (collapsed) return null;
  const line =
    accent === "amber"
      ? "from-amber-400/70 via-amber-300/20 to-transparent"
      : "from-cyan-400/70 via-cyan-300/20 to-transparent";
  return (
    <div className="mb-2 flex items-center gap-2 px-1">
      <span
        className={cn(
          "text-[10px] font-bold uppercase tracking-[0.2em]",
          accent === "amber" ? "text-amber-300/90" : "text-cyan-300/90",
        )}
      >
        {label}
      </span>
      <span className={cn("h-px flex-1 bg-gradient-to-r", line)} />
      <span
        className={cn(
          "h-1.5 w-1.5 rotate-45 border",
          accent === "amber"
            ? "border-amber-400/60 bg-amber-400/20"
            : "border-cyan-400/60 bg-cyan-400/20",
        )}
      />
    </div>
  );
}

const UserSidebar = ({ user }: UserSidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const terms = useTerms();
  const mainNavItems = buildMainNavItems(terms);
  const { images } = useWhiteLabelImages();
  const { profileImage: avatarSrc, hasCustomImage } = useUserProfileImage();
  const { unreadCount: unreadMessages } = useUnreadMessages();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isGameMaster, setIsGameMaster] = useState(false);
  const [arenaEnabled, setArenaEnabled] = useState(true);
  const [userLevel, setUserLevel] = useState<{
    title: string;
    level: number;
    color: string;
    icon: string;
  } | null>(null);

  // Reason: Pulled out so we can re-invoke it from the GM_SUBSCRIPTION_CHANGED
  // event listener below without re-doing all the other fetches.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const checkGameMasterStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/gamemaster/status");
      const data = await response.json();
      if (!isMountedRef.current) return;
      setIsGameMaster(data.success && data.isGameMaster);
    } catch {
      if (!isMountedRef.current) return;
      setIsGameMaster(false);
    }
  }, []);

  // Fetch feature flags and game master status on mount
  useEffect(() => {
    const fetchFeatureFlags = async () => {
      try {
        const response = await fetch("/api/settings");
        const data = await response.json();
        if (data.success && data.settings) {
          setArenaEnabled(data.settings.arenaEnabled ?? true);
        }
      } catch {
        // Default to enabled if settings fetch fails
      }
    };
    const fetchUserLevel = async () => {
      try {
        const response = await fetch("/api/user/level");
        if (response.ok) {
          const data = await response.json();
          setUserLevel({
            // Reason: X8 pass 1 — fallback title is the `player` token, never hard-coded "Trader".
            title: data.currentTitle || terms.player,
            level: data.currentLevel || 1,
            color: data.currentColor || "#22c55e",
            icon: data.currentIcon || "⚔️",
          });
        }
      } catch {
        /* Silent fail */
      }
    };
    checkGameMasterStatus();
    fetchFeatureFlags();
    fetchUserLevel();
  }, [checkGameMasterStatus, terms.player]);

  // Refresh GM status when something elsewhere mutates it (purchase,
  // renewal, deletion) and when the tab regains focus (catches cross-tab
  // / admin-side changes on the next visit).
  useEffect(() => {
    const handleGmChanged = () => {
      void checkGameMasterStatus();
    };
    window.addEventListener(GM_SUBSCRIPTION_CHANGED, handleGmChanged);
    window.addEventListener("focus", handleGmChanged);
    return () => {
      window.removeEventListener(GM_SUBSCRIPTION_CHANGED, handleGmChanged);
      window.removeEventListener("focus", handleGmChanged);
    };
  }, [checkGameMasterStatus]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileMenuOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    // Reason: Dashboard href carries ?tab=overview; pathname has no query string.
    const pathOnly = path.split("?")[0] || path;
    return pathname.startsWith(pathOnly);
  };

  const handleSignOut = async () => {
    if (!confirm("Are you sure you want to sign out?")) return;
    await signOut();
    router.push("/sign-in");
  };

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.href);
    return (
      <Link href={item.href} className="block cursor-pointer">
        <div
          className={cn(
            "group relative flex cursor-pointer items-center rounded-xl transition-all duration-200",
            "active:scale-[0.98]",
            isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2.5",
            active
              ? cn(
                  `bg-gradient-to-r ${item.gradient}`,
                  "border border-cyan-400/70",
                  "shadow-[0_0_18px_rgba(0,200,255,0.35),inset_0_0_20px_rgba(0,160,255,0.12)]",
                )
              : cn(
                  "border border-transparent",
                  "hover:border-cyan-400/35 hover:bg-cyan-500/5",
                  "hover:shadow-[0_0_14px_rgba(0,180,255,0.2)]",
                ),
          )}
        >
          {active && (
            <div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
          )}

          <div className="relative shrink-0">
            <div
              className={cn(
                // Reason: neon nav PNGs are transparent — glass plate, not a black tile.
                "flex items-center justify-center overflow-hidden rounded-lg transition-all duration-200",
                "bg-white/[0.04] ring-1 ring-white/10",
                "group-hover:ring-cyan-400/40 group-hover:shadow-[0_0_12px_rgba(0,200,255,0.25)]",
                isCollapsed ? "h-9 w-9" : "h-10 w-10",
                active && "ring-cyan-400/50 bg-cyan-400/10 shadow-[0_0_14px_rgba(0,200,255,0.3)]",
              )}
            >
              {item.icon}
            </div>
            {item.numericBadge != null && item.numericBadge > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white shadow-[0_0_8px_rgba(249,115,22,0.7)]">
                {item.numericBadge > 9 ? "9+" : item.numericBadge}
              </span>
            )}
          </div>

          {!isCollapsed && (
            <>
              <span
                className={cn(
                  "flex-1 font-medium tracking-wide transition-colors duration-200",
                  active
                    ? "text-cyan-50"
                    : "text-slate-200 group-hover:text-white",
                )}
              >
                {item.label}
              </span>

              {item.badge && (
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide",
                    item.badge === "HOT"
                      ? "bg-gradient-to-r from-orange-500 to-amber-400 text-black shadow-[0_0_10px_rgba(249,115,22,0.55)]"
                      : "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-[0_0_10px_rgba(34,211,238,0.45)]",
                  )}
                >
                  {item.badge}
                </span>
              )}

              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-all duration-200",
                  active
                    ? "translate-x-0 text-cyan-300 opacity-100"
                    : "-translate-x-1 text-slate-500 opacity-0 group-hover:translate-x-0 group-hover:opacity-100",
                )}
              />
            </>
          )}
        </div>
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Brand mark — kept compact so the profile card can lead like the mock */}
      <div
        className={cn(
          "border-b border-cyan-500/15",
          isCollapsed ? "p-2" : "px-3 py-3",
        )}
      >
        <Link
          href="/dashboard"
          className={cn(
            "flex w-full cursor-pointer items-center justify-center",
            isCollapsed ? "min-h-12" : "min-h-14",
          )}
        >
          {isCollapsed ? (
            /* Reason: collapsed rail is ~80px — only the square Brand Icon
               (favicon) fits. The wide App Logo wordmark crops into gibberish
               inside a circle. Expanded state below still uses appLogo. */
            <div className="relative flex h-12 w-12 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-cyan-500/25 blur-xl" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={images.favicon}
                alt="logo"
                width={48}
                height={48}
                className="relative z-10 h-11 w-11 cursor-pointer object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "/assets/images/brand-icon.jpg";
                }}
              />
            </div>
          ) : (
            /* Reason: 40px left a wide ChartVolt wordmark looking postage-stamp
               sized and left-aligned in a ~256px rail. Fill the rail width and
               centre it so the mark reads as the brand, not a corner icon. */
            <div className="relative flex w-full max-w-[220px] items-center justify-center">
              <div className="absolute inset-0 bg-cyan-500/15 blur-2xl" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={images.appLogo}
                alt="logo"
                width={220}
                height={64}
                className="relative z-10 h-12 w-auto max-w-full cursor-pointer object-contain sm:h-14"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/assets/icons/logo.svg";
                }}
              />
            </div>
          )}
        </Link>
      </div>

      {/* User Profile Card — cyan/purple ring + Lv badge per owner mock */}
      <div
        className={cn(
          "border-b border-cyan-500/15",
          isCollapsed ? "p-2" : "p-3",
        )}
      >
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border border-cyan-400/25",
            "bg-gradient-to-br from-[#0c1830]/90 via-[#0a1424]/80 to-[#060d18]/95",
            "shadow-[inset_0_0_24px_rgba(0,160,255,0.08)]",
            isCollapsed ? "p-2" : "p-3.5",
          )}
        >
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-fuchsia-500/15 blur-2xl" />
          <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-cyan-500/15 blur-2xl" />

          <div
            className={cn(
              "relative flex items-center gap-3",
              isCollapsed && "justify-center",
            )}
          >
            <div className="group relative">
              <div
                className={cn(
                  "absolute rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-fuchsia-500 opacity-80 blur-[2px] transition-opacity group-hover:opacity-100",
                  isCollapsed ? "-inset-0.5" : "-inset-[3px]",
                )}
              />
              <Avatar
                className={cn(
                  "relative ring-2 ring-[#050b16] transition-all duration-300",
                  isCollapsed ? "h-11 w-11" : "h-14 w-14",
                )}
              >
                <AvatarImage
                  src={avatarSrc}
                  // Reason: brand icon is square art — contain keeps the mark
                  // intact; a personal photo should cover the circle.
                  className={
                    hasCustomImage
                      ? "object-cover"
                      : "bg-black object-contain"
                  }
                />
                <AvatarFallback
                  className={cn(
                    "bg-gradient-to-br from-cyan-500 to-blue-600 font-bold text-white",
                    isCollapsed ? "text-sm" : "text-lg",
                  )}
                >
                  {user?.publicName?.[0]?.toUpperCase() ||
                    user?.email?.[0]?.toUpperCase() ||
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "absolute rounded-full border-2 border-[#050b16] bg-emerald-400 shadow-[0_0_8px_#34d399]",
                  isCollapsed
                    ? "-bottom-0.5 -right-0.5 h-3 w-3"
                    : "-bottom-0.5 -right-0.5 h-3.5 w-3.5",
                )}
              />
            </div>

            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold text-white">
                  {user?.publicName || terms.player}
                </h3>
                <p className="truncate text-xs text-slate-400">{user?.email}</p>
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-1.5 py-0.5">
                  <GameIcon
                    name={
                      userLevel?.icon && isValidGameIconName(userLevel.icon)
                        ? userLevel.icon
                        : "sword"
                    }
                    size={12}
                  />
                  <span className="text-[11px] font-semibold text-cyan-200">
                    {userLevel
                      ? `Lv. ${userLevel.level}`
                      : "Loading..."}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div
        className={cn(
          "custom-scrollbar flex-1 overflow-y-auto py-4",
          isCollapsed ? "px-2" : "px-3",
        )}
      >
        <div className="space-y-1">
          <SectionHeader
            label={terms.games}
            collapsed={isCollapsed}
          />
          {mainNavItems
            .filter((item) => item.href !== "/arena" || arenaEnabled)
            .map((item) => (
              <NavLink
                key={item.href}
                item={
                  item.href === "/messaging"
                    ? { ...item, numericBadge: unreadMessages }
                    : item
                }
              />
            ))}
        </div>

        {isGameMaster && (
          <div className="mt-6 space-y-1">
            <SectionHeader
              label="Game Master"
              collapsed={isCollapsed}
              accent="amber"
            />
            <NavLink
              item={{
                href: "/gamemaster",
                label: "GM Dashboard",
                icon: <GameIcon name="crown" size={40} className={NAV_ICON} />,
                color: "text-yellow-400",
                gradient: "from-yellow-500/20 to-amber-600/5",
                badge: "GM",
              }}
            />
          </div>
        )}

        <div className="mt-6 space-y-1">
          <SectionHeader label="Account" collapsed={isCollapsed} />
          {accountNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
      </div>

      {/* Footer — Notifications + SignOut as neon rows */}
      <div
        className={cn(
          "space-y-2 border-t border-cyan-500/15",
          isCollapsed ? "p-2" : "p-3",
        )}
      >
        <div
          className={cn(
            "hidden items-center overflow-visible rounded-xl border border-white/10 bg-white/[0.03] lg:flex",
            "hover:border-cyan-400/35 hover:bg-cyan-500/5 hover:shadow-[0_0_14px_rgba(0,180,255,0.18)]",
            "transition-all duration-200",
            isCollapsed ? "justify-center px-1 py-1" : "justify-between gap-2 px-3 py-2",
          )}
        >
          {!isCollapsed && (
            <span className="text-sm font-medium text-slate-200">
              Notifications
            </span>
          )}
          <NotificationDropdown />
        </div>

        <Button
          type="button"
          onClick={handleSignOut}
          variant="ghost"
          className={cn(
            "group flex w-full cursor-pointer items-center rounded-xl border border-transparent",
            "text-slate-300 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300",
            "hover:shadow-[0_0_14px_rgba(239,68,68,0.25)]",
            "active:scale-[0.98] transition-all duration-200",
            isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2.5",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-center overflow-hidden rounded-lg bg-white/[0.04] ring-1 ring-white/10",
              "group-hover:bg-red-500/15 group-hover:ring-red-400/40",
              isCollapsed ? "h-9 w-9" : "h-10 w-10",
            )}
          >
            <GameIcon
              name="logout"
              size={40}
              className={cn(NAV_ICON, "pointer-events-none")}
              alt="Sign out"
            />
          </div>
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left font-medium">SignOut</span>
              <ChevronRight className="h-4 w-4 text-slate-600 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar — cyan chamfered glow frame */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-[60] hidden h-screen flex-col transition-all duration-300 lg:flex pointer-events-auto",
          // Reason: no clip-path — the collapse control sits outside the rail (-right-3)
          // and would be cut off; cyan border + glow still matches the mock frame.
          "rounded-r-2xl border-r border-cyan-400/50",
          SHELL,
          FRAME_GLOW,
          isCollapsed ? "w-20" : "w-72",
        )}
      >
        <SidebarContent />

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCollapsed}
          className="absolute -right-3 top-20 z-50 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-cyan-400/40 bg-[#0a1424] shadow-[0_0_10px_rgba(0,200,255,0.35)] transition-colors hover:bg-cyan-500/20"
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 text-cyan-300 transition-transform",
              isCollapsed ? "" : "rotate-180",
            )}
          />
        </button>
      </aside>

      {/* Mobile Header */}
      <header className="fixed left-0 right-0 top-0 z-[100] flex h-16 items-center justify-between border-b border-cyan-500/20 bg-[#050b16]/95 px-4 backdrop-blur-xl lg:hidden pointer-events-auto">
        <Link href="/dashboard" className="flex cursor-pointer items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images.appLogo}
            alt="logo"
            width={180}
            height={44}
            className="object-contain"
            style={{ width: "auto", height: "40px", maxWidth: "180px" }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/assets/icons/logo.svg";
            }}
          />
        </Link>

        <div className="flex items-center gap-2">
          <NotificationDropdown />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            className="h-10 w-10 cursor-pointer rounded-xl border border-cyan-400/30 bg-cyan-500/10 hover:border-cyan-400/60 hover:bg-cyan-500/20"
          >
            <Menu className="h-5 w-5 text-cyan-200" />
          </Button>
        </div>
      </header>

      {/*
        Reason: owner 6 Oct 2026 — a closed overlay that still has
        backdrop-blur can eat taps on iOS even with pointer-events-none, which
        is why the menu / SignOut only seemed to work on Overview. Unmount the
        blur when closed.
      */}
      <div
        className={cn(
          "fixed inset-0 z-[100] bg-black/60 transition-opacity duration-300 lg:hidden",
          isMobileMenuOpen
            ? "pointer-events-auto opacity-100 backdrop-blur-sm"
            : "hidden pointer-events-none opacity-0",
        )}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Mobile Menu Drawer — same neon chrome as desktop */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-[110] h-full w-80 max-w-[85vw] transition-transform duration-300 ease-out lg:hidden",
          "rounded-l-2xl border-l border-cyan-400/50",
          SHELL,
          FRAME_GLOW,
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-cyan-500/20 px-4">
          <span className="font-semibold tracking-wide text-cyan-100">
            Menu
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(false)}
            className="h-9 w-9 cursor-pointer rounded-xl hover:bg-cyan-500/15"
          >
            <X className="h-5 w-5 text-slate-300" />
          </Button>
        </div>

        {/*
          Reason: owner 3 Oct 2026 — menu scrolling felt clunky. Touch momentum
          + contain stops the drawer fighting the page underneath.
        */}
        <div className="h-[calc(100%-4rem)] overflow-y-auto overscroll-contain scroll-smooth [-webkit-overflow-scrolling:touch]">
          <SidebarContent />
        </div>
      </aside>

      {/* Spacer for content - adjusts based on sidebar state */}
      <div
        className={cn(
          "hidden transition-all duration-300 lg:block",
          isCollapsed ? "w-20" : "w-72",
        )}
      />
    </>
  );
};

export default UserSidebar;
