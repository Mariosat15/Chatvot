import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { readFileSync } from "node:fs";

/**
 * X8 pass 6 — profile tabs/headings and shared profile card read the pack.
 *
 * Trading chrome (TradingPerformanceCard, Trading Stats on the card, Arsenal)
 * stays literal — chapter 14 s5.
 */

const ROOT = join(__dirname, "..", "..");

function readCode(relativePath: string): string {
  const source = readFileSync(join(ROOT, relativePath), "utf8");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

const HEADER = "components/profile/ProfileHeader.tsx";
const XP = "components/profile/XPProgressBar.tsx";
const STANDING = "components/profile/CrossGameStanding.tsx";
const CHARTS = "components/profile/ProfileOverviewCharts.tsx";
const AVAIL = "components/profile/ChallengeAvailabilitySection.tsx";
const CARD = "components/profile/ProfileCard.tsx";

const SURFACE = [HEADER, XP, STANDING, CHARTS, AVAIL, CARD];

describe("X8 pass 6 profile reaches the pack", () => {
  it("reads every file", () => {
    for (const file of SURFACE) {
      expect(readCode(file).length).toBeGreaterThan(200);
    }
  });

  it("every surface calls useTerms", () => {
    for (const file of SURFACE) {
      expect(readCode(file)).toMatch(/\buseTerms\(\)/);
    }
  });

  it("ProfileHeader fallback name and quick-stat labels use the pack", () => {
    const code = readCode(HEADER);
    expect(code).toContain("terms.player");
    expect(code).toContain("terms.contests");
    expect(code).toContain("terms.challenges");
    expect(code).not.toMatch(/\|\|\s*"Trader"/);
    expect(code).not.toMatch(/label=\{?"Competitions"/);
    expect(code).not.toMatch(/label=\{?"Challenges"/);
  });

  it("XPProgressBar heading uses player + level tokens", () => {
    const code = readCode(XP);
    expect(code).toContain("terms.player");
    expect(code).toContain("terms.level");
    expect(code).not.toMatch(/Trader Level & Title/);
  });

  it("CrossGameStanding uses contests / game / level / contest", () => {
    const code = readCode(STANDING);
    expect(code).toContain("terms.contests");
    expect(code).toContain("terms.game");
    expect(code).toContain("terms.level");
    expect(code).toContain("terms.contest");
    expect(code).not.toMatch(/"Contests entered"/);
    // Reason: no case-folding on tokens — chapter 14.
    expect(code).not.toMatch(/terms\.\w+\.toLowerCase\(\)/);
  });

  it("ProfileOverviewCharts headings and empty CTA use the pack", () => {
    const code = readCode(CHARTS);
    expect(code).toContain("terms.contests");
    expect(code).toContain("terms.challenges");
    expect(code).toContain("terms.prizes");
    expect(code).toContain("terms.leaderboard");
    expect(code).toContain("terms.opponent");
    expect(code).not.toMatch(/>Competitions</);
    expect(code).not.toMatch(/Ready to Start Trading\?/);
    expect(code).not.toMatch(/Browse Competitions/);
  });

  it("ChallengeAvailabilitySection headings use challenge / players / games", () => {
    const code = readCode(AVAIL);
    expect(code).toContain("terms.challenge");
    expect(code).toContain("terms.challenges");
    expect(code).toContain("terms.players");
    expect(code).toContain("terms.games");
    expect(code).not.toMatch(/>Challenge Requests</);
  });

  it("ProfileCard default tier and action use player / challenge tokens", () => {
    const code = readCode(CARD);
    expect(code).toContain("terms.player");
    expect(code).toContain("terms.challenge");
    expect(code).toContain("terms.challenges");
    expect(code).toContain("terms.rank");
    expect(code).toContain("terms.score");
    expect(code).not.toMatch(/tagLabel:\s*"Trader"/);
    expect(code).not.toMatch(/Chartvolt Trader Card/);
  });

  it("TradingPerformanceCard stays trading-literal", () => {
    const code = readCode("components/profile/TradingPerformanceCard.tsx");
    expect(code).not.toMatch(/\buseTerms\b/);
    expect(code).toMatch(/Trading/);
  });

  it("does not import getTerms in client surfaces", () => {
    for (const file of SURFACE) {
      expect(readCode(file)).not.toMatch(/\bgetTerms\b/);
    }
  });
});
