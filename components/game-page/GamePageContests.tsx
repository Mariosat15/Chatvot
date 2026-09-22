"use client";

import Link from "next/link";
import { Clock, Swords, Trophy, Users } from "lucide-react";
import { formatVolts } from "@/lib/utils/format-volts";
import {
  challengeCreateHref,
  competitionBrowseHref,
} from "@/lib/services/games/game-page-helpers";
import type { GamePageData } from "@/lib/services/games/game-page.types";
import { GamePagePanel, GP_CTA_PRIMARY, GP_CTA_SECONDARY } from "./GamePageChrome";

function timeLabel(iso: string, status: "active" | "upcoming"): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const diff = t - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  if (mins < 60) {
    return status === "active"
      ? `${mins}m left`
      : `Starts in ${mins}m`;
  }
  const hours = Math.round(mins / 60);
  if (hours < 48) {
    return status === "active"
      ? `${hours}h left`
      : `Starts in ${hours}h`;
  }
  const days = Math.round(hours / 24);
  return status === "active" ? `${days}d left` : `Starts in ${days}d`;
}

export function GamePageContests({ game }: { game: GamePageData }) {
  if (game.joinableContests.length === 0) {
    return (
      <GamePagePanel>
        <h2 className="text-[20px] font-bold uppercase tracking-wide text-white md:text-[22px]">
          No Contests Open Yet
        </h2>
        <p className="mt-2 text-[15px] text-[var(--gp-muted)]">
          There are no live or upcoming contests for {game.title} right now.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={competitionBrowseHref(game.slug)}
            className={`${GP_CTA_SECONDARY} !px-4 !py-2.5 !text-[13px]`}
          >
            <Trophy className="h-4 w-4" />
            Browse all contests
          </Link>
          {game.formats.challenge ? (
            <Link
              href={challengeCreateHref(game.slug)}
              className={`${GP_CTA_SECONDARY} !px-4 !py-2.5 !text-[13px]`}
            >
              <Swords className="h-4 w-4" />
              Create a Challenge
            </Link>
          ) : null}
        </div>
      </GamePagePanel>
    );
  }

  return (
    <GamePagePanel>
      <h2 className="text-[20px] font-bold uppercase tracking-wide text-white md:text-[22px]">
        <span className="text-[var(--gp-accent)]">
          {game.kind === "trading" ? "Live Trading Competitions" : "Competitions"}
        </span>
        <span className="ml-2 text-[15px] font-medium normal-case tracking-normal text-[var(--gp-muted)]">
          Compete now and win big
        </span>
      </h2>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {game.joinableContests.map((c) => {
          const live = c.status === "active";
          const clockIso = live ? c.endTime : c.startTime;
          return (
            <li
              key={c.id}
              className="flex flex-col overflow-hidden rounded-[12px] border border-[var(--gp-border)] bg-[var(--gp-panel-2,#091b35)]/70"
            >
              {/*
                Reason: contest banners are operator artwork with baked-in copy
                (titles, icons, taglines). A fixed 16:9 + object-cover box
                sliced those off. Natural height + contain auto-supports
                whatever ratio the upload is.
              */}
              <div className="relative bg-gradient-to-br from-[var(--gp-accent)]/20 to-[var(--gp-accent-2)]/20">
                {game.bannerUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={game.bannerUrl}
                    alt=""
                    className="block h-auto w-full object-contain opacity-90"
                  />
                ) : (
                  <div className="aspect-[16/9]" aria-hidden />
                )}
                <span
                  className={`absolute left-3 top-3 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white ${
                    live
                      ? "bg-[var(--gp-green,#15e89d)] text-[#021018]"
                      : "bg-[var(--gp-accent-2)]"
                  }`}
                >
                  {live ? "Live" : "Upcoming"}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <p className="text-[17px] font-bold leading-snug text-white">
                  {c.name}
                </p>
                <div className="space-y-1.5 text-[14px] text-[var(--gp-muted)]">
                  <p className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {c.currentParticipants} / {c.maxParticipants} Players
                  </p>
                  <p>
                    Entry{" "}
                    <span className="font-semibold text-[var(--gp-gold,#ffd33d)]">
                      {formatVolts(c.entryFee)}
                    </span>
                  </p>
                  <p>
                    Prize{" "}
                    <span className="font-semibold text-[var(--gp-gold,#ffd33d)]">
                      {formatVolts(c.prizePool)}
                    </span>
                  </p>
                  <p className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {timeLabel(clockIso, c.status)}
                  </p>
                </div>
                <Link
                  href={`/competitions/${c.id}`}
                  className={`${GP_CTA_PRIMARY} mt-auto !py-2.5 !text-[13px]`}
                >
                  {live ? "Join Competition" : "View Competition"}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </GamePagePanel>
  );
}
