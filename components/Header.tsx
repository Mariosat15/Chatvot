"use client";

import { Suspense } from "react";
import NavItems from "@/components/NavItems";

/**
 * Overview dashboard tab strip — desktop only.
 *
 * Logo, level chip, notifications and profile live in the sidebar / UserSidebar —
 * duplicating them here was the owner's "X" on the banner (29 Sep 2026 polish).
 * NavItems still reads `?tab=` so deep links work.
 *
 * Mobile: the Overview/Wallet/Performance/Competitions/Tutorials strip is
 * withheld on every page until the owner asks to bring it back (30 Sep 2026).
 * Phones use the sidebar drawer for navigation.
 */
const Header = ({ user: _user }: { user: User }) => {
  return (
    <header className="sticky top-16 lg:top-0 z-40 hidden border-b border-[#1B2540]/80 bg-[#050B18]/90 backdrop-blur-md md:block">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-center px-3 sm:px-4 lg:px-6">
        <nav className="flex min-w-0 w-full justify-center">
          {/* Reason: useSearchParams requires a Suspense boundary in the App Router. */}
          <Suspense fallback={<div className="h-8 w-80" aria-hidden />}>
            <NavItems variant="header" />
          </Suspense>
        </nav>
      </div>
    </header>
  );
};

export default Header;
