"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { GameIcon } from "@/components/ui/GameIcon";

/**
 * The one definition of the leaderboard page's chrome.
 *
 * Reason: there are now four boards behind one screen (Global, Trading, Games,
 * and one per game). A header written per board is four places for the title,
 * the profile link and the board picker to drift apart, and the picker going
 * missing on one board is how a player loses the ability to find the others.
 * Every literal here must appear in this file and in NO consumer.
 */
export default function LeaderboardPageHeader({
  title,
  subtitle,
  boardPicker,
  actions,
}: {
  title: string;
  subtitle: string;
  boardPicker?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="relative">
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-primary-500/20 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl blur-lg opacity-60 animate-pulse" />
            <div className="relative bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 p-3 rounded-2xl shadow-2xl">
              <GameIcon name="trophy" size={32} className="drop-shadow-lg" />
            </div>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400">
              {title}
            </h1>
            <p className="text-sm text-gray-500 font-medium">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {boardPicker}
          {actions}
          <Link
            href="/profile"
            className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40"
          >
            My Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
