"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import NavItems from "@/components/NavItems";

/**
 * Overview dashboard tab strip.
 *
 * Logo, level chip, notifications and profile live in the sidebar / UserSidebar —
 * duplicating them here was the owner's "X" on the banner (29 Sep 2026 polish).
 * NavItems still reads `?tab=` so deep links work.
 */
const Header = ({ user: _user }: { user: User }) => {
  return (
    <header className="sticky top-0 z-40 border-b border-[#1B2540]/80 bg-[#050B18]/90 backdrop-blur-md">
      <div className="mx-auto hidden h-16 max-w-[1400px] items-center justify-center px-3 sm:px-4 md:flex lg:px-6">
        <nav className="hidden min-w-0 w-full justify-center md:flex">
          {/* Reason: useSearchParams requires a Suspense boundary in the App Router. */}
          <Suspense fallback={<div className="h-8 w-80" aria-hidden />}>
            <NavItems variant="header" />
          </Suspense>
        </nav>
      </div>

      <Suspense fallback={null}>
        <MobileTabStrip />
      </Suspense>
    </header>
  );
};

/**
 * Phone tab strip. Hidden on the dashboard Overview, whose mobile tree is
 * the owner's phone layout with its own bottom nav (29 Sep 2026); every other
 * dashboard tab keeps it so a player can get back to Overview.
 */
function MobileTabStrip() {
  const pathname = usePathname() ?? "";
  const tab = useSearchParams()?.get("tab");
  const onOverview =
    pathname === "/dashboard" && (!tab || tab === "overview");
  if (onOverview) return null;
  return (
    <div className="border-t border-[#1B2540]/60 px-2 pb-2 pt-1 md:hidden">
      <NavItems variant="header" />
    </div>
  );
}

export default Header;
