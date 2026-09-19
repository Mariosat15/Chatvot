import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { TERMS } from "@/lib/constants/terminology";
import { buildGettingStartedSteps } from "@/lib/utils/getting-started-steps";

/**
 * X8 pass 5 — dashboard section titles and getting-started steps read the pack.
 *
 * Trading chrome (PnL charts, "Active Traders", etc.) stays literal — chapter 14 s5.
 */

const ROOT = join(__dirname, "..", "..");

function readCode(relativePath: string): string {
  const source = readFileSync(join(ROOT, relativePath), "utf8");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const LAYOUT = "components/dashboard/DashboardLayout.tsx";
const SIDEBAR = "components/dashboard/ContestsSidebar.tsx";
const STATS = "components/dashboard/ContestStatsCards.tsx";
const PERF = "components/dashboard/PlayerGamePerformancePanel.tsx";
const SUMMARY = "components/dashboard/GameSummaryCards.tsx";
const STARTED = "components/dashboard/GettingStartedCard.tsx";
const STEPS = "lib/utils/getting-started-steps.ts";

const SURFACE = [LAYOUT, SIDEBAR, STATS, PERF, SUMMARY, STARTED, STEPS];

const emptyFacts = {
  tradingEnabled: true,
  hasFundedWallet: false,
  hasJoinedCompetition: false,
  hasPlacedTrade: false,
  hasPlayedGame: false,
  hasCompletedMilestone: false,
  hasChallengedUser: false,
};

describe("X8 pass 5 dashboard reaches the pack", () => {
  it("reads every file", () => {
    for (const file of SURFACE) {
      expect(readCode(file).length).toBeGreaterThan(200);
    }
  });

  it("client shells call useTerms", () => {
    for (const file of [LAYOUT, SIDEBAR, STATS, PERF, SUMMARY, STARTED]) {
      expect(readCode(file)).toMatch(/\buseTerms\(\)/);
    }
  });

  it("DashboardLayout Contests tab uses terms.contests", () => {
    const code = readCode(LAYOUT);
    expect(code).toContain("terms.contests");
    expect(code).not.toMatch(/>\s*Contests\s*</);
  });

  it("ContestsSidebar tabs use contests / challenges", () => {
    const code = readCode(SIDEBAR);
    expect(code).toContain("terms.contests");
    expect(code).toContain("terms.challenges");
    expect(code).not.toMatch(/>\s*Competitions\s*</);
    expect(code).not.toMatch(/>\s*Challenges\s*</);
  });

  it("ContestStatsCards headings use contests / challenges / prizes", () => {
    const code = readCode(STATS);
    expect(code).toContain("terms.contests");
    expect(code).toContain("terms.challenges");
    expect(code).toContain("terms.prizes");
  });

  it("PlayerGamePerformancePanel uses game / contests / challenge tokens", () => {
    const code = readCode(PERF);
    expect(code).toContain("terms.game");
    expect(code).toContain("terms.contests");
    expect(code).toContain("terms.challenge");
    expect(code).not.toMatch(/["']Contests["']/);
    expect(code).not.toMatch(/Game Performance/);
  });

  it("GameSummaryCards heading uses terms.game", () => {
    const code = readCode(SUMMARY);
    expect(code).toContain("terms.game");
    expect(code).not.toMatch(/By game/);
  });

  it("GettingStartedCard passes terms into buildGettingStartedSteps", () => {
    const code = readCode(STARTED);
    expect(code).toMatch(/buildGettingStartedSteps\(\s*facts\s*,\s*terms\s*\)/);
  });

  it("buildGettingStartedSteps uses pack nouns (behavioural)", () => {
    const custom = {
      ...TERMS,
      contest: "Tournament",
      contests: "Tournaments",
      challenge: "Duel",
      player: "Racer",
      players: "Racers",
    };
    const steps = buildGettingStartedSteps(emptyFacts, custom);
    const titles = steps.map((s) => s.title);
    expect(titles).toContain("Join a Tournament");
    expect(titles).toContain("Play Your First Tournament");
    expect(titles).toContain("Duel a Racer");
    expect(titles).not.toContain("Join a Competition");
  });

  it("never case-folds a token on the surface", () => {
    for (const file of SURFACE) {
      expect(readCode(file)).not.toMatch(
        /\bterms\.[a-zA-Z]+\s*\.\s*(toLowerCase|toUpperCase|toLocaleLowerCase|toLocaleUpperCase)\s*\(/,
      );
    }
  });
});
