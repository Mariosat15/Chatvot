"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { GameIcon } from "@/components/ui/GameIcon";

/**
 * Shared leaderboard page chrome — title, board picker, profile link.
 *
 * Reason: every board must feel like the same product surface. Glow and pulse
 * were dialled back so the trophy marks the page without competing with the
 * table for attention.
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
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-3 rounded-2xl shadow-lg shadow-amber-500/20">
            <GameIcon name="trophy" size={28} className="drop-shadow-sm" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white">
              {title}
            </h1>
            <p className="text-sm text-gray-400 font-medium mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {boardPicker}
          {actions}
          <Link
            href="/profile"
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-semibold text-sm transition-colors"
          >
            My Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
