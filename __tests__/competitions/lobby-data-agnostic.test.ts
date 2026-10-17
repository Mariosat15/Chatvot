import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  contestFeatures,
  contestHowItWorks,
} from "@/components/competitions/lobby/contest-lobby-copy";
import { buildTradingOverviewCopy } from "@/components/competitions/lobby/trading-overview-copy";
import { buildGameOverviewCopy } from "@/components/games/lobby/game-overview-copy";

/**
 * Competition lobbies (game + trading) must describe THIS contest from stored
 * fields — never invent a title, or claim "P&L wins" for every trading contest.
 *
 * Owner, 17 Oct 2026: "make sure the game comp lobby and trading comp lobby are
 * data agnostic meaning the data that comes from competitions rules data etc".
 */

const ROOT = process.cwd();

const LOBBY_TREES = [
  "components/competitions/lobby",
  "components/competitions/detail",
  "components/games/lobby",
  "components/trading/lobby",
  "components/games/ProviderContestLobby.tsx",
];

function readCode(relative: string): string {
  const source = readFileSync(join(ROOT, relative), "utf8");
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function walkTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name).replace(/\\/g, "/");
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) walkTs(rel, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(rel);
  }
  return out;
}

function lobbyFiles(): string[] {
  const files: string[] = [];
  for (const entry of LOBBY_TREES) {
    const st = statSync(join(ROOT, entry));
    if (st.isDirectory()) walkTs(entry, files);
    else files.push(entry.replace(/\\/g, "/"));
  }
  return files;
}

describe("competition lobby data is contest-agnostic (owner, 17 Oct 2026)", () => {
  it("never names a catalogue title or branches on a game/provider key in lobby trees", () => {
    const offenders: string[] = [];
    for (const f of lobbyFiles()) {
      const text = readCode(f);
      if (
        /circuit-sprint|circuitSprint|volt-velocity|voltVelocity|providerKey\s*===|gameCode\s*===/i.test(
          text,
        )
      ) {
        offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("game lobby Overview + rules tabs come from catalogue / contest fields", () => {
    const lobby = readCode("components/games/ProviderContestLobby.tsx");
    expect(lobby).toMatch(/buildGameOverviewCopy\(/);
    expect(lobby).toMatch(/buildGameLobbySections\(/);
    expect(lobby).toMatch(/rulesSummary:\s*presentation\.rulesSummary/);
    expect(lobby).toMatch(/howToPlay:\s*presentation\.howToPlay/);
    expect(lobby).toMatch(/scoringSummary\(\s*presentation\.scoreType/);
    expect(lobby).toMatch(/playModePlayerRule\(\s*playMode/);
    expect(lobby).not.toContain("<ContestOverviewPanel");
  });

  it("trading lobby Overview is built once from the contest document", () => {
    const page = readCode("app/(root)/competitions/[id]/page.tsx");
    expect(page.match(/buildTradingOverviewCopy\(/g)?.length).toBe(1);
    expect(page).toMatch(/overview=\{lobbyOverview\}/);
    const desktop = readCode(
      "components/competitions/detail/DesktopTradingLobby.tsx",
    );
    const mobile = readCode(
      "components/competitions/lobby/mobile/MobileCompetitionLobby.tsx",
    );
    expect(desktop).toMatch(/overview=\{overview\}/);
    expect(mobile).toMatch(/overview=\{overview\}/);
    expect(desktop).not.toContain("buildTradingOverviewCopy(");
    expect(mobile).not.toContain("buildTradingOverviewCopy(");
  });

  it("trading Overview copy follows the stored ranking method, not a P&L default", () => {
    const pnl = buildTradingOverviewCopy({
      competition: {
        rules: { rankingMethod: "pnl" },
        assetClasses: ["forex"],
        startingCapital: 10000,
        prizePool: 500,
        entryFee: 50,
        prizeDistribution: [{ rank: 1, percentage: 100 }],
      },
      creditSymbol: "⚡",
    });
    const roi = buildTradingOverviewCopy({
      competition: {
        rules: { rankingMethod: "roi" },
        assetClasses: ["forex"],
        startingCapital: 10000,
        prizePool: 500,
        entryFee: 50,
        prizeDistribution: [{ rank: 1, percentage: 100 }],
      },
      creditSymbol: "⚡",
    });

    const pnlClimb =
      pnl.steps.find((s) => s.title === "Climb the ranks")?.detail ?? "";
    const roiClimb =
      roi.steps.find((s) => s.title === "Climb the ranks")?.detail ?? "";
    expect(pnlClimb).toMatch(/profit/i);
    expect(roiClimb).toMatch(/%/);
    expect(roiClimb).not.toMatch(/most profit/i);

    const pnlWin = pnl.features.find((f) => /wins$/i.test(f.title))?.title ?? "";
    const roiWin = roi.features.find((f) => /wins$/i.test(f.title))?.title ?? "";
    expect(pnlWin).toMatch(/P&L/i);
    expect(roiWin).toMatch(/ROI/i);
    expect(pnlWin).not.toEqual(roiWin);
  });

  it("game Overview copy uses play-mode and score inputs, never a title name", () => {
    const timeTrial = buildGameOverviewCopy({
      playModeLabel: "Play anytime",
      playModeDetail: "Start when you are ready",
      scoreLabel: "Time",
      scoringNote: "Fastest time wins",
      roundSeconds: 120,
      attemptsShort: "Best counts",
    });
    const points = buildGameOverviewCopy({
      playModeLabel: "All together",
      playModeDetail: "Everyone starts at the gun",
      scoreLabel: "Score",
      scoringNote: "Highest score wins",
      roundSeconds: 60,
    });

    expect(
      timeTrial.features
        .flatMap((f) => f.facts)
        .some((f) => f.strong === "Fastest time"),
    ).toBe(true);
    expect(
      points.features
        .flatMap((f) => f.facts)
        .some((f) => f.strong === "Highest score"),
    ).toBe(true);

    const blob = JSON.stringify(timeTrial) + JSON.stringify(points);
    expect(blob).not.toMatch(/circuit-sprint|volt-velocity|tetris/i);
  });

  it("kind fallbacks never hard-code P&L as the ranking rule", () => {
    const tradingSteps = contestHowItWorks("trading")
      .map((s) => s.detail)
      .join(" ");
    const tradingFeatures = contestFeatures("trading")
      .map((f) => f.detail)
      .join(" ");
    expect(tradingSteps).not.toMatch(/\bP&L\b/i);
    expect(tradingFeatures).not.toMatch(/\bP&L\b/i);
    expect(tradingSteps).toMatch(/ranking rule/i);
  });
});
