"use client";

import Link from "next/link";
import { challengeCreateHref } from "@/lib/services/games/game-page-helpers";
import type { GamePageData } from "@/lib/services/games/game-page.types";
import { themeCssVariables } from "@/lib/services/games/game-page-themes";
import { GamePageTabs } from "./GamePageTabs";
import { GamePageOverview, HowItWorksSteps } from "./GamePageOverview";
import { GamePagePanel } from "./GamePageChrome";

function Hero({ game }: { game: GamePageData }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--gp-border)]">
      <div className="absolute inset-0">
        {game.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.bannerUrl}
            alt=""
            className="h-full w-full object-cover opacity-45"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[var(--gp-accent-2)]/40 via-[var(--gp-bg)] to-[var(--gp-accent)]/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--gp-bg)] via-[var(--gp-bg)]/88 to-[var(--gp-bg)]/40" />
      </div>

      <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_1fr_auto] lg:items-end">
        <div className="h-24 w-24 overflow-hidden rounded-2xl border border-[var(--gp-border)] bg-black/40 sm:h-28 sm:w-28">
          {game.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={game.logoUrl}
              alt={`${game.title} logo`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-black text-[var(--gp-accent)]">
              {(game.title || "?").slice(0, 1)}
            </div>
          )}
        </div>

        <div className="max-w-2xl space-y-3">
          {game.genre ? (
            <span
              className="inline-flex rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white"
              style={{ background: "var(--gp-badge)" }}
            >
              {game.genre}
            </span>
          ) : null}
          <h1 className="text-3xl font-black italic tracking-tight text-white sm:text-5xl">
            {game.title}
          </h1>
          {game.tagline ? (
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gp-accent)]">
              {game.tagline}
            </p>
          ) : null}
          {game.description ? (
            <p className="line-clamp-2 text-sm text-[var(--gp-muted)]">
              {game.description}
            </p>
          ) : null}
          {game.bannerFeatures && game.bannerFeatures.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {game.bannerFeatures.map((f) => (
                <span
                  key={f.title}
                  className="rounded-full border border-[var(--gp-border)] bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--gp-text)]"
                >
                  {f.title}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {game.stylizedQuote ? (
          <p className="max-w-[10rem] text-right text-lg font-black italic leading-tight text-[var(--gp-accent)] drop-shadow-[0_0_12px_var(--gp-glow)] lg:self-center">
            {game.stylizedQuote}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function RulesTab({ game }: { game: GamePageData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GamePagePanel>
        <h2 className="text-sm font-bold text-[var(--gp-accent)]">Rules</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--gp-muted)]">
          {game.rulesSummary || "Rules will appear here when published."}
        </p>
      </GamePagePanel>
      <GamePagePanel>
        <h2 className="text-sm font-bold text-[var(--gp-accent)]">How to play</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--gp-muted)]">
          {game.howToPlay || "How-to-play text will appear here when published."}
        </p>
      </GamePagePanel>
      {game.prizeEligibility ? (
        <GamePagePanel className="lg:col-span-2">
          <h2 className="text-sm font-bold text-[var(--gp-accent)]">
            Prize eligibility
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--gp-muted)]">
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
        <p className="text-sm text-[var(--gp-muted)]">
          No screenshots yet. Upload gallery assets in All Games → Assets.
        </p>
      </GamePagePanel>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {gallery.map((item) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={item.id}
          src={item.url}
          alt={item.title || "Gallery image"}
          className="aspect-video w-full rounded-xl border border-[var(--gp-border)] object-cover"
        />
      ))}
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
      className="min-h-[70vh] text-[var(--gp-text)]"
      style={{ ...vars, background: "var(--gp-bg)" } as React.CSSProperties}
    >
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <nav className="text-xs text-[var(--gp-muted)]">
          <Link href="/games" className="hover:text-white">
            Games
          </Link>
          <span className="mx-2 opacity-50">/</span>
          <span className="text-white">{game.title}</span>
        </nav>

        <Hero game={game} />

        <GamePageTabs slug={game.slug} active={current} />

        {current === "overview" ? <GamePageOverview game={game} /> : null}
        {current === "how-it-works" ? (
          <GamePagePanel>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--gp-accent)]">
              How It Works
            </h2>
            <div className="mt-4">
              <HowItWorksSteps game={game} />
            </div>
          </GamePagePanel>
        ) : null}
        {current === "prizes" ? <RulesTab game={game} /> : null}
        {current === "challenges" ? (
          <GamePagePanel className="space-y-3">
            <h2 className="text-sm font-bold text-[var(--gp-accent)]">
              Challenges
            </h2>
            {game.formats.challenge ? (
              <>
                <p className="text-sm text-[var(--gp-muted)]">
                  Start a 1v1 at {game.title}. Entry amounts follow what
                  operators configured for this title.
                </p>
                <Link
                  href={challengeCreateHref(game.slug)}
                  className="inline-flex rounded-xl bg-gradient-to-r from-[var(--gp-cta-from)] to-[var(--gp-cta-to)] px-4 py-2 text-sm font-semibold text-white"
                >
                  Create 1v1 Challenge
                </Link>
              </>
            ) : (
              <p className="text-sm text-[var(--gp-muted)]">
                This title is not available as a 1v1 challenge.
              </p>
            )}
          </GamePagePanel>
        ) : null}
        {current === "rules" ? <RulesTab game={game} /> : null}
        {current === "gallery" ? <GalleryTab game={game} /> : null}
      </div>
    </div>
  );
}
