"use client";

import Link from "next/link";
import {
  Gamepad2,
  GraduationCap,
  Monitor,
  Smartphone,
  Swords,
  Tablet,
  Trophy,
} from "lucide-react";
import { formatVolts } from "@/lib/utils/format-volts";
import {
  challengeCreateHref,
  competitionBrowseHref,
  formatRoundTimeLabel,
  getGameModes,
} from "@/lib/services/games/game-page-helpers";
import type { GamePageData } from "@/lib/services/games/game-page.types";
import { CircuitSprintFallbackArt } from "./CircuitSprintFallbackArt";
import { GamePagePanel } from "./GamePageChrome";

function HowItWorksSteps({ game }: { game: GamePageData }) {
  const steps = game.howItWorksSteps ?? [];
  if (steps.length === 0) {
    return (
      <p className="text-sm text-[var(--gp-muted)]">
        How-to steps will appear when rules are published for this title.
      </p>
    );
  }
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((step, i) => (
        <li
          key={`${step.title}-${i}`}
          className="relative flex flex-col gap-3 rounded-xl border border-[var(--gp-border)] bg-black/25 p-4"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--gp-accent)] text-sm font-bold text-[var(--gp-accent)] shadow-[0_0_14px_var(--gp-glow)]">
            {i + 1}
          </span>
          <div>
            <p className="text-sm font-semibold text-white">{step.title}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--gp-muted)]">
              {step.detail}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function GamePageOverview({ game }: { game: GamePageData }) {
  const modes = getGameModes(game);
  const roundLabel = formatRoundTimeLabel(
    game.typicalDurationSeconds,
    game.maxDurationSeconds,
  );
  const featured = (game.gallery ?? []).slice(0, 3);
  const devices = game.supportedDevices ?? {
    desktop: true,
    tablet: true,
    mobile: true,
  };
  const useCircuitArt =
    game.slug === "circuit-sprint" ||
    game.categorySlug === "puzzle" ||
    game.categorySlug === "circuit";

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.9fr]">
        <div className="space-y-5">
          <GamePagePanel>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--gp-accent)]">
              Game Description
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--gp-muted)]">
              {game.description ||
                game.tagline ||
                "Details for this game will appear here once an operator adds them."}
            </p>
            {(game.descriptionTags ?? []).length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {(game.descriptionTags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-[var(--gp-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--gp-text)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </GamePagePanel>

          <GamePagePanel className="overflow-hidden p-0">
            <div className="relative aspect-[16/10] bg-black/50 sm:aspect-video">
              {game.gameplayPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={game.gameplayPreviewUrl}
                  alt="Gameplay preview"
                  className="h-full w-full object-cover"
                />
              ) : useCircuitArt ? (
                <CircuitSprintFallbackArt />
              ) : (
                <div className="flex h-full items-center justify-center text-[var(--gp-muted)]">
                  <Gamepad2 className="h-16 w-16 opacity-40" />
                </div>
              )}
            </div>
            {game.gameplayVideoUrl ? (
              <div className="border-t border-[var(--gp-border)] px-5 py-3">
                <a
                  href={game.gameplayVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-[var(--gp-accent)] hover:underline"
                >
                  Watch gameplay
                </a>
              </div>
            ) : null}
          </GamePagePanel>
        </div>

        <aside className="space-y-5">
          <GamePagePanel>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--gp-accent)]">
              Game Info
            </h2>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex items-baseline justify-between gap-3 border-b border-[var(--gp-border)] pb-2">
                <dt className="text-[var(--gp-muted)]">Game Type</dt>
                <dd className="font-semibold text-white">
                  {game.genre || "Game"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-[var(--gp-border)] pb-2">
                <dt className="text-[var(--gp-muted)]">Skill Level</dt>
                <dd className="font-semibold text-white">
                  {game.skillLevelLabel || "All Levels"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-[var(--gp-border)] pb-2">
                <dt className="text-[var(--gp-muted)]">Modes</dt>
                <dd className="text-right font-semibold text-white">
                  {modes.length > 0 ? modes.join(", ") : "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[var(--gp-muted)]">Avg. Round Time</dt>
                <dd className="font-semibold text-white">
                  {roundLabel || "—"}
                </dd>
              </div>
            </dl>
          </GamePagePanel>

          <div className="space-y-2.5">
            <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-[var(--gp-muted)]">
              Play modes
            </p>
            {game.formats.competition ? (
              <Link
                href={competitionBrowseHref(game.slug)}
                className="flex items-start gap-3 rounded-xl border border-[var(--gp-border)] bg-[var(--gp-panel)] p-3.5 transition hover:border-[var(--gp-accent)]"
              >
                <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gp-accent)]" />
                <div>
                  <p className="text-sm font-bold text-white">Competition</p>
                  <p className="mt-0.5 text-xs text-[var(--gp-muted)]">
                    Compete with others for Volts.
                  </p>
                </div>
              </Link>
            ) : null}
            {game.formats.challenge ? (
              <Link
                href={challengeCreateHref(game.slug)}
                className="flex items-start gap-3 rounded-xl border border-[var(--gp-border)] bg-[var(--gp-panel)] p-3.5 transition hover:border-[var(--gp-accent)]"
              >
                <Swords className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gp-accent-3)]" />
                <div>
                  <p className="text-sm font-bold text-white">1v1 Challenge</p>
                  <p className="mt-0.5 text-xs text-[var(--gp-muted)]">
                    Challenge another player directly.
                  </p>
                </div>
              </Link>
            ) : null}
            {game.formats.practice ? (
              <Link
                href={`/games/${game.slug}/practice`}
                className="flex items-start gap-3 rounded-xl border border-[var(--gp-border)] bg-[var(--gp-panel)] p-3.5 transition hover:border-[var(--gp-accent)]"
              >
                <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gp-accent-2)]" />
                <div>
                  <p className="text-sm font-bold text-white">Practice</p>
                  <p className="mt-0.5 text-xs text-[var(--gp-muted)]">
                    Play solo and improve your skills.
                  </p>
                </div>
              </Link>
            ) : null}
          </div>

          <GamePagePanel>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--gp-accent)]">
              Available On
            </h2>
            <div className="mt-3 flex flex-wrap gap-4 text-[var(--gp-muted)]">
              {devices.desktop ? (
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <Monitor className="h-4 w-4 text-[var(--gp-accent)]" /> Desktop
                </span>
              ) : null}
              {devices.tablet ? (
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <Tablet className="h-4 w-4 text-[var(--gp-accent)]" /> Tablet
                </span>
              ) : null}
              {devices.mobile ? (
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <Smartphone className="h-4 w-4 text-[var(--gp-accent)]" />{" "}
                  Mobile
                </span>
              ) : null}
            </div>
          </GamePagePanel>
        </aside>
      </div>

      {/* Reason: steps need a full-width band — a narrow column crushes 3 cards
          into unreadable stubs (owner annotation 21 Sep 2026). */}
      <GamePagePanel>
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--gp-accent)]">
          How It Works
        </h2>
        <div className="mt-4">
          <HowItWorksSteps game={game} />
        </div>
      </GamePagePanel>

      <GamePagePanel>
        {game.joinableContests.length === 0 ? (
          <>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--gp-accent)]">
              No Contests Open Yet
            </h2>
            <p className="mt-2 text-sm text-[var(--gp-muted)]">
              There are no live or upcoming contests for {game.title} right now.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={competitionBrowseHref(game.slug)}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--gp-border)] px-3 py-2 text-xs font-semibold text-white hover:bg-white/5"
              >
                <Trophy className="h-3.5 w-3.5" />
                Browse all contests
              </Link>
              {game.formats.challenge ? (
                <Link
                  href={challengeCreateHref(game.slug)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--gp-border)] px-3 py-2 text-xs font-semibold text-white hover:bg-white/5"
                >
                  <Swords className="h-3.5 w-3.5" />
                  Create a Challenge
                </Link>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--gp-accent)]">
              Contests
            </h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {game.joinableContests.map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-[var(--gp-border)] bg-black/20 p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{c.name}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--gp-muted)]">
                        {c.status === "active" ? "Live" : "Upcoming"} ·{" "}
                        {c.currentParticipants}/{c.maxParticipants} players
                      </p>
                      <p className="mt-1 text-xs text-[var(--gp-accent)]">
                        Entry {formatVolts(c.entryFee)} · Pool{" "}
                        {formatVolts(c.prizePool)}
                      </p>
                    </div>
                    <Link
                      href={`/competitions/${c.id}`}
                      className="shrink-0 rounded-lg bg-gradient-to-r from-[var(--gp-cta-from)] to-[var(--gp-cta-to)] px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Join
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </GamePagePanel>

      {featured.length > 0 ? (
        <GamePagePanel>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--gp-accent)]">
            Featured
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {featured.map((item) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={item.id}
                src={item.url}
                alt={item.title || "Screenshot"}
                className="aspect-video rounded-lg border border-[var(--gp-border)] object-cover"
              />
            ))}
          </div>
        </GamePagePanel>
      ) : null}
    </div>
  );
}

export { HowItWorksSteps };
