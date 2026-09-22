"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { Zap } from "lucide-react";
import {
  challengeCreateHref,
  competitionBrowseHref,
  resolvePlayNowHref,
} from "@/lib/services/games/game-page-helpers";
import type { GamePageData } from "@/lib/services/games/game-page.types";
import { themeCssVariables } from "@/lib/services/games/game-page-themes";
import { GamePageTabs } from "./GamePageTabs";
import { GamePageOverview } from "./GamePageOverview";
import { GamePageHero } from "./GamePageHero";
import { GamePageContests } from "./GamePageContests";
import { GamePageHowItWorks } from "./GamePageHowItWorks";
import { GamePageFeatured } from "./GamePageFeatured";
import { GamePagePanel, GP_CTA_PRIMARY, GP_CTA_GREEN } from "./GamePageChrome";
import { gpSans } from "./game-page-fonts";

function RulesTab({ game }: { game: GamePageData }) {
  const howTo =
    Array.isArray(game.howToPlay) && game.howToPlay.length > 0
      ? game.howToPlay.join("\n")
      : "";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GamePagePanel>
        <h2 className="text-[18px] font-bold text-[var(--gp-accent)]">Rules</h2>
        <p className="mt-3 whitespace-pre-wrap text-[15px] text-[var(--gp-muted)]">
          {game.rulesSummary || "Rules will appear here when published."}
        </p>
      </GamePagePanel>
      <GamePagePanel>
        <h2 className="text-[18px] font-bold text-[var(--gp-accent)]">
          How to play
        </h2>
        <p className="mt-3 whitespace-pre-wrap text-[15px] text-[var(--gp-muted)]">
          {howTo || "How-to-play text will appear here when published."}
        </p>
      </GamePagePanel>
      {game.prizeEligibility ? (
        <GamePagePanel className="lg:col-span-2">
          <h2 className="text-[18px] font-bold text-[var(--gp-accent)]">
            Prize eligibility
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[15px] text-[var(--gp-muted)]">
            <li>
              A score of zero{" "}
              {game.prizeEligibility.zeroScoreEligible
                ? "can count as a result"
                : "does not win a prize"}
              .
            </li>
            {typeof game.prizeEligibility.minimumScore === "number" ? (
              <li>
                Scores must clear {game.prizeEligibility.minimumScore}
                {game.prizeEligibility.scoreUnit
                  ? ` ${game.prizeEligibility.scoreUnit}`
                  : ""}{" "}
                to be eligible.
              </li>
            ) : null}
            <li>
              Disqualified players keep nothing. Unfilled ranks redistribute when
              at least one valid result remains.
            </li>
          </ul>
        </GamePagePanel>
      ) : null}
    </div>
  );
}

function GalleryTab({ game }: { game: GamePageData }) {
  const gallery = game.gallery ?? [];
  if (gallery.length === 0) {
    return (
      <GamePagePanel>
        <p className="text-[15px] text-[var(--gp-muted)]">
          No screenshots yet. Upload gallery assets in All Games → Assets.
        </p>
      </GamePagePanel>
    );
  }
  return <GamePageFeatured game={game} />;
}

function StickyEnterBar({ game }: { game: GamePageData }) {
  if (game.comingSoon) {
    return (
      <div className="sticky bottom-3 z-40 mt-6 overflow-hidden rounded-[12px] border border-sky-500/30 bg-[var(--gp-panel,#07152c)]/95 px-4 py-3 shadow-[0_0_40px_rgba(0,0,0,.5)] backdrop-blur">
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-sky-300">
          Coming soon — contests and challenges are not open yet for this game.
        </p>
      </div>
    );
  }
  const href =
    resolvePlayNowHref(game, game.joinableContests) ??
    competitionBrowseHref(game.slug);
  return (
    <div className="sticky bottom-3 z-40 mt-6 overflow-hidden rounded-[12px] border border-[var(--gp-card-border,rgba(40,130,255,.35))] bg-[var(--gp-panel,#07152c)]/95 px-4 py-3 shadow-[0_0_40px_rgba(0,0,0,.5)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--gp-accent)] to-[var(--gp-accent-2)] text-sm font-black text-[#021018]">
            CV
          </div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--gp-muted)]">
            <span className="text-[var(--gp-gold,#ffd33d)]">Better traders</span>{" "}
            <span className="text-[var(--gp-accent)]">brighter tomorrow</span>
          </p>
        </div>
        <Link href={href} className={`${GP_CTA_PRIMARY} !px-4 !py-2 !text-[13px]`}>
          <Zap className="h-4 w-4" />
          Enter Now
        </Link>
      </div>
    </div>
  );
}

export function GamePageView({
  game,
  tab,
}: {
  game: GamePageData;
  tab: string;
}) {
  const vars = themeCssVariables(game.theme);
  const current = tab || "overview";

  return (
    <div
      className={`${gpSans.className} min-h-[70vh] text-[15px] text-[var(--gp-text)]`}
      style={{ ...vars, background: "var(--gp-bg)" } as CSSProperties}
    >
      <div className="mx-auto max-w-[1480px] space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <nav className="text-[13px] text-[var(--gp-muted)]">
          <Link href="/games" className="hover:text-white">
            Games
          </Link>
          <span className="mx-2 opacity-50">/</span>
          <span className="text-white">{game.title}</span>
        </nav>

        <GamePageHero game={game} />
        <GamePageTabs slug={game.slug} active={current} />

        {current === "overview" ? <GamePageOverview game={game} /> : null}
        {current === "how-it-works" ? <GamePageHowItWorks game={game} /> : null}
        {current === "competitions" ? <GamePageContests game={game} /> : null}
        {current === "leaderboards" ? (
          <GamePagePanel className="space-y-4">
            <h2 className="text-[20px] font-bold text-white">Leaderboard</h2>
            <p className="text-[15px] text-[var(--gp-muted)]">
              See how you rank across ChartVolt. Open the live leaderboard to
              compare results for {game.title}.
            </p>
            <Link href="/leaderboard" className={GP_CTA_GREEN + " !w-auto"}>
              Open Leaderboard
            </Link>
          </GamePagePanel>
        ) : null}
        {current === "challenges" ? (
          <GamePagePanel className="space-y-3">
            <h2 className="text-[18px] font-bold text-[var(--gp-accent)]">
              Challenges
            </h2>
            {game.comingSoon ? (
              <p className="text-[15px] text-[var(--gp-muted)]">
                Challenges will open when this game leaves coming soon.
              </p>
            ) : game.formats.challenge ? (
              <>
                <p className="text-[15px] text-[var(--gp-muted)]">
                  Start a 1v1 at {game.title}. Entry amounts follow what
                  operators configured for this title.
                </p>
                <Link
                  href={challengeCreateHref(game.slug)}
                  className={GP_CTA_PRIMARY}
                >
                  Create 1v1 Challenge
                </Link>
              </>
            ) : (
              <p className="text-[15px] text-[var(--gp-muted)]">
                This title is not available as a 1v1 challenge.
              </p>
            )}
          </GamePagePanel>
        ) : null}
        {current === "rules" ? <RulesTab game={game} /> : null}
        {current === "gallery" ? <GalleryTab game={game} /> : null}

        <StickyEnterBar game={game} />
      </div>
    </div>
  );
}

// Re-export for callers that imported steps from the view.
export { HowItWorksSteps } from "./GamePageHowItWorks";
