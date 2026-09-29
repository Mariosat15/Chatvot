"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import NavItems from "@/components/NavItems";
import UserDropdown from "@/components/UserDropdown";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";
import { useAppSettings } from "@/contexts/AppSettingsContext";

/**
 * Dashboard top chrome matching the Overview mock: logo, five tab destinations,
 * notifications, level chip, avatar. NavItems reads `?tab=` so deep links work.
 *
 * Level is fetched client-side so the root layout stays free of XP I/O.
 */
const Header = ({ user }: { user: User }) => {
  const { settings } = useAppSettings();
  const [imgError, setImgError] = useState(false);
  const [levelLabel, setLevelLabel] = useState<string | null>(null);

  const logoSrc =
    !imgError && settings?.branding?.appLogo
      ? settings.branding.appLogo
      : "/assets/icons/logo.svg";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/level")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const level =
          typeof data.currentLevel === "number" ? data.currentLevel : null;
        const title =
          typeof data.currentTitle === "string" && data.currentTitle.trim()
            ? data.currentTitle.trim()
            : null;
        if (level != null) {
          setLevelLabel(title ? `Lv. ${level} · ${title}` : `Lv. ${level}`);
        }
      })
      .catch(() => {
        /* fail soft — chip is decorative */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-[#1B2540]/80 bg-[#050B18]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-3 sm:h-16 sm:px-4 lg:px-6">
        <Link href="/dashboard?tab=overview" className="shrink-0">
          <Image
            src={logoSrc}
            alt="logo"
            width={200}
            height={48}
            priority
            className="cursor-pointer object-contain"
            style={{ width: "auto", height: "40px", maxWidth: "180px" }}
            onError={() => setImgError(true)}
            unoptimized
          />
        </Link>

        <nav className="hidden min-w-0 flex-1 justify-center md:flex">
          {/* Reason: useSearchParams requires a Suspense boundary in the App Router. */}
          <Suspense fallback={<div className="h-8 w-80" aria-hidden />}>
            <NavItems variant="header" />
          </Suspense>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {levelLabel ? (
            <span className="hidden rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 lg:inline-flex">
              {levelLabel}
            </span>
          ) : null}
          <NotificationDropdown />
          <UserDropdown user={user} />
        </div>
      </div>

      {/* Mobile: same five destinations under the logo row */}
      <div className="border-t border-[#1B2540]/60 px-2 pb-2 pt-1 md:hidden">
        <Suspense fallback={null}>
          <NavItems variant="header" />
        </Suspense>
      </div>
    </header>
  );
};

export default Header;
