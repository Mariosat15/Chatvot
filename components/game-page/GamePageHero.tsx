"use client";

import Link from "next/link";
import { ArrowRight, Swords, Zap, Target, Trophy, LineChart } from "lucide-react";
import type { GamePageData } from "@/lib/services/games/game-page.types";
import {
  challengeCreateHref,
  competitionBrowseHref,
  resolvePlayNowHref,
} from "@/lib/services/games/game-page-helpers";
import { GP_CTA_PRIMARY, GP_CTA_SECONDARY } from "./GamePageChrome";

const TRADING_CHIPS = [
  { title: "REAL MARKETS", icon: LineChart },
  { title: "SKILL BASED", icon: Target },
  { title: "LIVE LEADERBOARD", icon: Trophy },
  { title: "WIN VOLTS", icon: Zap },
] as const;

function heroChips(game: GamePageData) {
  const fromData = game.bannerFeatures ?? game.heroFeatures ?? [];
  if (fromData.length > 0) {
    return fromData.map((f) => ({ title: f.title.toUpperCase(), Icon: Zap }));
  }
  if (game.kind === "trading") {
    return TRADING_CHIPS.map((c) => ({ title: c.title, Icon: c.icon }));
  }
  return [];
}

export function GamePageHero({ game }: { game: GamePageData }) {
  const chips = heroChips(game);
  const enterHref =
    resolvePlayNowHref(game, game.joinableContests) ??
    competitionBrowseHref(game.slug);
  const challengeHref = game.formats.challenge
    ? challengeCreateHref(game.slug)
    : null;

  return (
    <div className="relative min-h-[300px] overflow-hidden rounded-[12px] border border-[var(--gp-card-border,rgba(40,130,255,.35))] md:min-h-[340px]">
      <div className="absolute inset-0 bg-black">
        {game.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.bannerUrl}
            alt=""
            className="h-full w-full object-contain object-right"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[var(--gp-accent-2)]/50 via-[var(--gp-bg)] to-[var(--gp-accent)]/30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#020817] via-[#020817]/92 to-[#020817]/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020817]/90 via-transparent to-[#020817]/40" />
      </div>

      <div className="relative flex min-h-[300px] flex-col justify-between gap-6 p-6 md:min-h-[340px] md:flex-row md:items-end md:p-8 lg:p-10">
        <div className="max-w-3xl space-y-4">
          {/*
            Reason: logos are often wide wordmarks. A fixed square left black
            letterbox bars (owner). Full-width of the copy column, height from
            the image aspect — no crop, no stretch.
          */}
          <div className="w-full max-w-xl overflow-hidden rounded-[14px] border border-[var(--gp-border)] bg-black/55">
            {game.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={game.logoUrl}
                alt={`${game.title} logo`}
                className="block h-auto w-full object-contain"
              />
            ) : (
              <div className="flex min-h-[7rem] w-full items-center justify-center text-4xl font-black text-[var(--gp-accent)] sm:min-h-[8rem] sm:text-5xl">
                {(game.title || "?").slice(0, 1)}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {game.genre ? (
              <span
                className="inline-flex rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white"
                style={{ background: "var(--gp-badge)" }}
              >
                {game.genre}
              </span>
            ) : null}
            <h1 className="text-[32px] font-black italic leading-[1.05] tracking-tight text-white sm:text-[40px] lg:text-[46px]">
              {game.tagline ? (
                <>
                  <span className="text-[var(--gp-gold,#ffd33d)]">
                    {game.title}
                  </span>
                  <span className="mt-1 block text-white">{game.tagline}</span>
                </>
              ) : (
                game.title
              )}
            </h1>
          </div>

          {game.description ? (
            <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--gp-muted)] md:text-[16px]">
              {game.description}
            </p>
          ) : null}

          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {chips.map(({ title, Icon }) => (
                <span
                  key={title}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--gp-border)] bg-[#07152c]/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--gp-text)]"
                >
                  <Icon className="h-3.5 w-3.5 text-[var(--gp-accent)]" />
                  {title}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <Link href={enterHref} className={GP_CTA_PRIMARY}>
              Enter Competition
              <ArrowRight className="h-4 w-4" />
            </Link>
            {challengeHref ? (
              <Link href={challengeHref} className={GP_CTA_SECONDARY}>
                <Swords className="h-4 w-4 text-[var(--gp-accent-2)]" />
                1v1 Challenge
              </Link>
            ) : null}
          </div>
        </div>

        {game.stylizedQuote ? (
          <p className="max-w-[11rem] self-end text-right text-lg font-black italic leading-tight text-[var(--gp-accent)] drop-shadow-[0_0_16px_var(--gp-glow)] md:self-center md:text-xl">
            {game.stylizedQuote}
          </p>
        ) : null}
      </div>
    </div>
  );
}
