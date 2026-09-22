"use client";

import { ChevronRight, FileText, LineChart, Trophy } from "lucide-react";
import type {
  GamePageData,
  GamePageHowItWorksStep,
} from "@/lib/services/games/game-page.types";
import { GamePagePanel } from "./GamePageChrome";

const TRADING_DEFAULT_STEPS: GamePageHowItWorksStep[] = [
  {
    title: "JOIN",
    detail: "Choose a trading competition and enter with Volts.",
    icon: "join",
  },
  {
    title: "TRADE",
    detail: "Trade live markets using virtual competition capital.",
    icon: "trade",
  },
  {
    title: "WIN",
    detail: "Finish high on the leaderboard and earn rewards.",
    icon: "win",
  },
];

function stepIcon(index: number, icon?: string) {
  const key = (icon || "").toLowerCase();
  if (key.includes("win") || index === 2) return Trophy;
  if (key.includes("trade") || index === 1) return LineChart;
  return FileText;
}

export function resolveHowItWorksSteps(
  game: GamePageData,
): GamePageHowItWorksStep[] {
  const steps = game.howItWorksSteps ?? [];
  if (steps.length > 0) return steps;
  if (game.kind === "trading") return TRADING_DEFAULT_STEPS;
  return [];
}

export function HowItWorksSteps({ game }: { game: GamePageData }) {
  const steps = resolveHowItWorksSteps(game);
  if (steps.length === 0) {
    return (
      <p className="text-[15px] text-[var(--gp-muted)]">
        How-to steps will appear when rules are published for this title.
      </p>
    );
  }

  return (
    <ol className="grid gap-4 lg:grid-cols-3">
      {steps.map((step, i) => {
        const Icon = stepIcon(i, step.icon);
        const num = String(i + 1).padStart(2, "0");
        return (
          <li key={`${step.title}-${i}`} className="relative">
            {i < steps.length - 1 ? (
              <ChevronRight className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 text-[var(--gp-accent)] lg:block" />
            ) : null}
            <div className="flex h-full flex-col gap-3 rounded-[12px] border border-[var(--gp-border)] bg-[var(--gp-panel-2,#091b35)]/50 p-5">
              <div className="flex items-center gap-3">
                <span className="text-[22px] font-black italic text-[var(--gp-accent)]">
                  {num}
                </span>
                <Icon className="h-6 w-6 text-[var(--gp-accent)]" />
              </div>
              <p className="text-[18px] font-bold uppercase tracking-wide text-white">
                {step.title}
              </p>
              <p className="text-[14px] leading-relaxed text-[var(--gp-muted)] md:text-[15px]">
                {step.detail}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function GamePageHowItWorks({ game }: { game: GamePageData }) {
  return (
    <GamePagePanel className="relative overflow-hidden">
      {game.howItWorksImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={game.howItWorksImageUrl}
          alt=""
          className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-1/3 object-cover opacity-25 lg:block"
        />
      ) : null}
      <div className="relative">
        <h2 className="text-[20px] font-bold uppercase tracking-wide text-white md:text-[22px]">
          <span className="text-[var(--gp-accent)]">How It Works</span>
          <span className="ml-2 text-[15px] font-medium normal-case tracking-normal text-[var(--gp-muted)]">
            Simple. Play. Win.
          </span>
        </h2>
        <div className="mt-5">
          <HowItWorksSteps game={game} />
        </div>
      </div>
    </GamePagePanel>
  );
}
