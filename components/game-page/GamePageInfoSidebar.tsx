"use client";

import Link from "next/link";
import {
  BarChart3,
  Gamepad2,
  GraduationCap,
  Monitor,
  Play,
  Smartphone,
  Swords,
  Tablet,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import {
  challengeCreateHref,
  competitionBrowseHref,
  getGameModes,
  resolvePlayNowHref,
} from "@/lib/services/games/game-page-helpers";
import type { GamePageData } from "@/lib/services/games/game-page.types";
import { GamePagePanel, GP_CTA_GREEN } from "./GamePageChrome";

function playersLabel(game: GamePageData): string {
  const min = game.minPlayers ?? 1;
  const max = game.maxPlayers ?? 100;
  return `${min}–${max}`;
}

function marketsLabel(game: GamePageData): string {
  const tags = game.descriptionTags ?? [];
  if (tags.length > 0) return tags.slice(0, 4).join(" / ");
  if (game.kind === "trading") return "Forex / Crypto / Stocks / Indices";
  return "—";
}

export function GamePageInfoSidebar({ game }: { game: GamePageData }) {
  const modes = getGameModes(game);
  const enterHref =
    resolvePlayNowHref(game, game.joinableContests) ??
    competitionBrowseHref(game.slug);
  const devices = game.supportedDevices ?? {
    desktop: true,
    tablet: true,
    mobile: true,
  };

  const tiles = [
    {
      label: "Game Type",
      value: game.genre || "Game",
      Icon: Gamepad2,
    },
    {
      label: "Modes",
      value: modes.length > 0 ? modes.join(" / ") : "—",
      Icon: Trophy,
    },
    {
      label: "Skill Level",
      value: game.skillLevelLabel || "All Levels",
      Icon: BarChart3,
    },
    {
      label: "Markets",
      value: marketsLabel(game),
      Icon: BarChart3,
    },
    {
      label: "Players",
      value: playersLabel(game),
      Icon: Users,
    },
    {
      label: "Currency",
      value: "Volts",
      Icon: Zap,
      gold: true,
    },
  ];

  return (
    <aside className="flex h-full min-h-full flex-col gap-3">
      <GamePagePanel>
        <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--gp-accent)]">
          Game Info
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="rounded-[10px] border border-[var(--gp-border)] bg-[var(--gp-panel-2,#091b35)]/70 p-3"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--gp-muted)]">
                <tile.Icon className="h-3.5 w-3.5 text-[var(--gp-accent)]" />
                {tile.label}
              </div>
              <p
                className={`mt-2 text-[15px] font-bold leading-snug ${
                  tile.gold
                    ? "text-[var(--gp-gold,#ffd33d)]"
                    : "text-white"
                }`}
              >
                {tile.value}
                {tile.gold ? " ⚡" : ""}
              </p>
            </div>
          ))}
        </div>
      </GamePagePanel>

      <GamePagePanel className="space-y-3">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--gp-accent)]">
          Play Modes
        </h2>
        {game.formats.competition ? (
          <Link
            href={competitionBrowseHref(game.slug)}
            className="group flex items-start gap-4 rounded-[12px] border border-[var(--gp-border)] bg-[var(--gp-panel-2,#091b35)]/60 p-4 transition hover:border-[var(--gp-gold,#ffd33d)] hover:shadow-[0_0_24px_rgba(255,211,61,.2)]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border border-[var(--gp-gold,#ffd33d)]/40 bg-black/30">
              <Trophy className="h-6 w-6 text-[var(--gp-gold,#ffd33d)]" />
            </div>
            <div>
              <p className="text-[17px] font-bold text-white">Competition</p>
              <p className="mt-1 text-[14px] text-[var(--gp-muted)]">
                Compete with many {game.kind === "trading" ? "traders" : "players"}.
              </p>
            </div>
          </Link>
        ) : null}
        {game.formats.challenge ? (
          <Link
            href={challengeCreateHref(game.slug)}
            className="group flex items-start gap-4 rounded-[12px] border border-[var(--gp-border)] bg-[var(--gp-panel-2,#091b35)]/60 p-4 transition hover:border-[var(--gp-accent-2)] hover:shadow-[0_0_24px_rgba(168,85,247,.25)]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border border-[var(--gp-accent-2)]/40 bg-black/30">
              <Swords className="h-6 w-6 text-[var(--gp-accent-2)]" />
            </div>
            <div>
              <p className="text-[17px] font-bold text-white">1v1 Challenge</p>
              <p className="mt-1 text-[14px] text-[var(--gp-muted)]">
                Challenge another {game.kind === "trading" ? "trader" : "player"}{" "}
                directly.
              </p>
            </div>
          </Link>
        ) : null}
        {game.formats.practice ? (
          <Link
            href={`/games/${game.slug}/practice`}
            className="group flex items-start gap-4 rounded-[12px] border border-[var(--gp-border)] bg-[var(--gp-panel-2,#091b35)]/60 p-4 transition hover:border-[var(--gp-accent)]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] border border-[var(--gp-accent)]/40 bg-black/30">
              <GraduationCap className="h-6 w-6 text-[var(--gp-accent)]" />
            </div>
            <div>
              <p className="text-[17px] font-bold text-white">Practice</p>
              <p className="mt-1 text-[14px] text-[var(--gp-muted)]">
                Play solo and improve your skills.
              </p>
            </div>
          </Link>
        ) : null}
      </GamePagePanel>

      <GamePagePanel>
        <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--gp-accent)]">
          Available On
        </h2>
        <div className="mt-3 flex flex-wrap gap-4 text-[var(--gp-muted)]">
          {devices.desktop ? (
            <span className="inline-flex items-center gap-1.5 text-[14px]">
              <Monitor className="h-4 w-4 text-[var(--gp-accent)]" /> Desktop
            </span>
          ) : null}
          {devices.tablet ? (
            <span className="inline-flex items-center gap-1.5 text-[14px]">
              <Tablet className="h-4 w-4 text-[var(--gp-accent)]" /> Tablet
            </span>
          ) : null}
          {devices.mobile ? (
            <span className="inline-flex items-center gap-1.5 text-[14px]">
              <Smartphone className="h-4 w-4 text-[var(--gp-accent)]" /> Mobile
            </span>
          ) : null}
        </div>
      </GamePagePanel>

      <div className="mt-auto space-y-2">
        <Link href={enterHref} className={GP_CTA_GREEN}>
          <Play className="h-5 w-5 fill-current" />
          Enter Now
        </Link>
        <p className="text-center text-[13px] text-[var(--gp-muted)]">
          Join thousands of players already competing!
        </p>
      </div>
    </aside>
  );
}
