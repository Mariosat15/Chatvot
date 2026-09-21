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
  resolvePlayNowHref,
} from "@/lib/services/games/game-page-helpers";
import type { GamePageData } from "@/lib/services/games/game-page.types";
import { CircuitSprintFallbackArt } from "./CircuitSprintFallbackArt";
import { GamePagePanel, PlayNowButton } from "./GamePageChrome";

export function GamePageOverview({ game }: { game: GamePageData }) {
  const playHref = resolvePlayNowHref(game, game.joinableContests);
  const modes = getGameModes(game);
  const roundLabel = formatRoundTimeLabel(
    game.typicalDurationSeconds,
    game.maxDurationSeconds,
  );
  const featured = game.gallery.slice(0, 3);
  const useCircuitArt =
    game.slug === "circuit-sprint" ||
    game.categorySlug === "puzzle" ||
    game.categorySlug === "circuit";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr_0.85fr]">
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
          {game.descriptionTags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {game.descriptionTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-[var(--gp-border)] px-2 py-0.5 text-[11px] text-[var(--gp-text)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </GamePagePanel>

        <GamePagePanel>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--gp-accent)]">
            How It Works
          </h2>
          {game.howItWorksSteps.length > 0 ? (
            <ol className="mt-4 grid gap-3 sm:grid-cols-3">
              {game.howItWorksSteps.map((step, i) => (
                <li
                  key={`${step.title}-${i}`}
                  className="relative flex flex-col items-start gap-2 rounded-xl border border-[var(--gp-border)] bg-black/20 p-3"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--gp-accent)] text-xs font-bold text-[var(--gp-accent)] shadow-[0_0_12px_var(--gp-glow)]">
                    {i + 1}
                  </span>
                  <p className="text-sm font-semibold text-white">{step.title}</p>
                  <p className="text-xs text-[var(--gp-muted)]">{step.detail}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-[var(--gp-muted)]">
              How-to steps will appear when rules are published for this title.
            </p>
          )}
        </GamePagePanel>

        <GamePagePanel>
          {game.joinableContests.length === 0 ? (
            <>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--gp-accent)]">
                No Contests Open Yet
              </h2>
              <p className="mt-2 text-sm text-[var(--gp-muted)]">
                There are no live or upcoming contests for {game.title} right
                now.
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
              <ul className="mt-3 space-y-3">
                {game.joinableContests.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-[var(--gp-border)] bg-black/20 p-3"
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
      </div>

      <div className="space-y-5">
        <GamePagePanel className="relative overflow-hidden p-0">
          <div className="relative aspect-video bg-black/50">
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
            <div className="p-4">
              <a
                href={game.gameplayVideoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-[var(--gp-accent)] hover:underline"
              >
                Watch Gameplay
              </a>
            </div>
          ) : null}
        </GamePagePanel>

        <div className="grid gap-3">
          {game.formats.competition ? (
            <Link
              href={competitionBrowseHref(game.slug)}
              className="flex items-start gap-3 rounded-2xl border border-[var(--gp-border)] bg-[var(--gp-panel)] p-4 transition hover:border-[var(--gp-accent)]"
            >
              <Trophy className="mt-0.5 h-5 w-5 text-[var(--gp-accent)]" />
              <div>
                <p className="text-sm font-bold text-white">Competition</p>
                <p className="text-xs text-[var(--gp-muted)]">
                  Play against multiple players and compete for Volts.
                </p>
              </div>
            </Link>
          ) : null}
          {game.formats.challenge ? (
            <Link
              href={challengeCreateHref(game.slug)}
              className="flex items-start gap-3 rounded-2xl border border-[var(--gp-border)] bg-[var(--gp-panel)] p-4 transition hover:border-[var(--gp-accent)]"
            >
              <Swords className="mt-0.5 h-5 w-5 text-[var(--gp-accent-3)]" />
              <div>
                <p className="text-sm font-bold text-white">1v1 Challenge</p>
                <p className="text-xs text-[var(--gp-muted)]">
                  Challenge another player directly.
                </p>
              </div>
            </Link>
          ) : null}
          {game.formats.practice ? (
            <Link
              href={`/games/${game.slug}/practice`}
              className="flex items-start gap-3 rounded-2xl border border-[var(--gp-border)] bg-[var(--gp-panel)] p-4 transition hover:border-[var(--gp-accent)]"
            >
              <GraduationCap className="mt-0.5 h-5 w-5 text-[var(--gp-accent-2)]" />
              <div>
                <p className="text-sm font-bold text-white">Practice</p>
                <p className="text-xs text-[var(--gp-muted)]">
                  Play solo and improve your skills.
                </p>
              </div>
            </Link>
          ) : null}
        </div>

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

      <div className="space-y-5">
        <GamePagePanel>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--gp-accent)]">
            Game Info
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-[var(--gp-muted)]">Game Type</dt>
              <dd className="mt-0.5 font-semibold text-white">
                {game.genre || "Game"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--gp-muted)]">Skill Level</dt>
              <dd className="mt-0.5 font-semibold text-white">
                {game.skillLevelLabel || "All Levels"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--gp-muted)]">Modes</dt>
              <dd className="mt-0.5 font-semibold text-white">
                {modes.length > 0 ? modes.join(", ") : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--gp-muted)]">Avg. Round Time</dt>
              <dd className="mt-0.5 font-semibold text-white">
                {roundLabel || "—"}
              </dd>
            </div>
          </dl>
        </GamePagePanel>

        <GamePagePanel className="space-y-3 text-center">
          <h2 className="text-lg font-bold text-white">Ready to Play?</h2>
          <p className="text-xs text-[var(--gp-muted)]">
            Join a competition, challenge a friend or practice your skills.
          </p>
          <PlayNowButton href={playHref} className="w-full justify-center" />
        </GamePagePanel>

        <GamePagePanel>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--gp-accent)]">
            Available On
          </h2>
          <div className="mt-3 flex flex-wrap gap-3 text-[var(--gp-muted)]">
            {game.supportedDevices.desktop ? (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <Monitor className="h-4 w-4 text-[var(--gp-accent)]" /> Desktop
              </span>
            ) : null}
            {game.supportedDevices.tablet ? (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <Tablet className="h-4 w-4 text-[var(--gp-accent)]" /> Tablet
              </span>
            ) : null}
            {game.supportedDevices.mobile ? (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <Smartphone className="h-4 w-4 text-[var(--gp-accent)]" /> Mobile
              </span>
            ) : null}
          </div>
        </GamePagePanel>
      </div>
    </div>
  );
}
