"use client";

import { Suspense } from "react";
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
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-center px-3 sm:h-16 sm:px-4 lg:px-6">
        <nav className="hidden min-w-0 w-full justify-center md:flex">
          {/* Reason: useSearchParams requires a Suspense boundary in the App Router. */}
          <Suspense fallback={<div className="h-8 w-80" aria-hidden />}>
            <NavItems variant="header" />
          </Suspense>
        </nav>
      </div>

      <div className="border-t border-[#1B2540]/60 px-2 pb-2 pt-1 md:hidden">
        <Suspense fallback={null}>
          <NavItems variant="header" />
        </Suspense>
      </div>
    </header>
  );
};

export default Header;
