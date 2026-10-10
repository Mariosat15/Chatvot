"use client";

import { Gamepad2 } from "lucide-react";
import type { GamePageData } from "@/lib/services/games/game-page.types";
import { CircuitSprintFallbackArt } from "./CircuitSprintFallbackArt";
import { GamePagePanel } from "./GamePageChrome";
import { GamePageContests } from "./GamePageContests";
import { GamePageFeatured } from "./GamePageFeatured";
import { GamePageHowItWorks } from "./GamePageHowItWorks";
import { GamePageInfoSidebar } from "./GamePageInfoSidebar";
import { GamePageTips } from "./GamePageTips";

export function GamePageOverview({ game }: { game: GamePageData }) {
  const useCircuitArt =
    game.slug === "circuit-sprint" ||
    game.categorySlug === "puzzle" ||
    game.categorySlug === "circuit";
  const marketingUrl =
    game.gameplayPreviewUrl || (game.gallery ?? [])[0]?.url;

  return (
    <div className="space-y-4">
      {/*
        Reason: stretch both columns to the same height so the info sidebar's
        Enter Now sits at the bottom with no dark band under it, and the left
        preview grows to match. A wide left track + tight gap closes the empty
        strip between the marketing art and the sidebar (owner annotation).
      */}
      <div className="grid items-stretch gap-3 lg:grid-cols-[1.85fr_1fr]">
        <div className="flex h-full min-h-0 flex-col gap-3">
          <GamePagePanel className="shrink-0">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--gp-accent)]">
              About {game.title}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--gp-muted)] md:text-[16px]">
              {game.description ||
                game.tagline ||
                "Details for this game will appear here once an operator adds them."}
            </p>
            {(game.descriptionTags ?? []).length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {(game.descriptionTags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-[var(--gp-border)] px-2.5 py-1 text-[12px] font-medium text-[var(--gp-text)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </GamePagePanel>

          <GamePagePanel className="flex min-h-[240px] flex-1 flex-col overflow-hidden p-0 sm:min-h-[280px]">
            <div className="relative min-h-[200px] flex-1 bg-black">
              {marketingUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={marketingUrl}
                  alt={`${game.title} preview`}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              ) : useCircuitArt ? (
                <div className="absolute inset-0">
                  <CircuitSprintFallbackArt />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[var(--gp-muted)]">
                  <Gamepad2 className="h-16 w-16 opacity-40" />
                </div>
              )}
            </div>
            {game.gameplayVideoUrl ? (
              <div className="shrink-0 border-t border-[var(--gp-border)] px-5 py-3">
                <a
                  href={game.gameplayVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13px] font-semibold text-[var(--gp-accent)] hover:underline"
                >
                  Watch gameplay
                </a>
              </div>
            ) : null}
          </GamePagePanel>
        </div>

        <GamePageInfoSidebar game={game} />
      </div>

      <GamePageHowItWorks game={game} />
      <GamePageContests game={game} />
      <GamePageTips game={game} />
      <GamePageFeatured game={game} />
    </div>
  );
}
