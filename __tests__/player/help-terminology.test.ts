import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { TERMS } from "@/lib/constants/terminology";

/**
 * X8 pass 10 — help centre TOC and section H2s read the pack.
 *
 * Body prose is largely left alone (challenge section already corrected in
 * `13` s9.1a). Trading Guide / Arsenal stay trading-literal — chapter 14 s5.
 */

const ROOT = join(__dirname, "..", "..");
const HELP = "app/(root)/help/page-content.tsx";

function readCode(): string {
  const source = readFileSync(join(ROOT, HELP), "utf8");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

describe("X8 pass 10 help centre reaches the pack", () => {
  it("reads the help page", () => {
    expect(readCode().length).toBeGreaterThan(1000);
  });

  it("calls useTerms and builds the TOC from the pack", () => {
    const code = readCode();
    expect(code).toMatch(/\buseTerms\(\)/);
    expect(code).toContain("buildMenuSections(terms)");
    expect(code).toContain("terms.contests");
    expect(code).toContain("terms.challenges");
    expect(code).toContain("terms.leaderboard");
    expect(code).toContain("terms.player");
    expect(code).toContain("terms.levels");
    expect(code).toContain("terms.score");
  });

  it("TOC and FAQ group titles build from the pack", () => {
    const code = readCode();
    expect(code).toContain("buildMenuSections(terms)");
    expect(code).toContain("`🏆 ${terms.contests}`");
    expect(code).toContain("`⚔️ 1v1 ${terms.challenges}`");
    expect(code).toContain("`🥇 ${terms.leaderboard}`");
    expect(code).not.toMatch(/title:\s*"🏆 Competitions"/);
    expect(code).not.toMatch(/title:\s*"⚔️ 1v1 Challenges"/);
    expect(code).not.toMatch(/title:\s*"🗺️ Trader's Journey"/);
    expect(code).not.toMatch(/title:\s*"👑 Trader Levels"/);
    expect(code).not.toMatch(/title:\s*"🗺️ Journey, Badges & Trader Levels"/);
  });

  it("section H2s use the pack for contest / challenge / leaderboard / player", () => {
    const code = readCode();
    expect(code).toMatch(/🏆 \{terms\.contests\}/);
    expect(code).toMatch(/1v1 \{terms\.challenges\}/);
    expect(code).toMatch(/🥇 \{terms\.leaderboard\}/);
    expect(code).toMatch(/\{terms\.player\}&apos;s Journey/);
    expect(code).toMatch(/\{terms\.player\} \{terms\.levels\}/);
  });

  it("quick-nav and welcome links use contest / challenge / leaderboard tokens", () => {
    const code = readCode();
    // Reason: assert the tokenised call sites, not the absence of the word —
    // body prose still says Competitions in many places (pass 10 is chrome).
    const quickNavStart = code.indexOf("Quick Navigation");
    const quickNav = code.slice(quickNavStart, quickNavStart + 2500);
    expect(quickNav).toContain('href="/competitions"');
    expect(quickNav).toContain("{terms.contests}");
    expect(quickNav).toContain('href="/challenges"');
    expect(quickNav).toContain("{terms.challenges}");
    expect(quickNav).toContain('href="/leaderboard"');
    expect(quickNav).toContain("{terms.leaderboard}");
  });

  it("Trading Guide TOC entry stays trading-literal", () => {
    const code = readCode();
    expect(code).toMatch(/title:\s*"📈 Trading Guide"/);
    expect(code).toMatch(/title:\s*"🎯 Trading Arsenal"/);
  });

  it("default TERMS still match today's help nouns", () => {
    expect(TERMS.contests).toBe("Competitions");
    expect(TERMS.challenges).toBe("Challenges");
    expect(TERMS.leaderboard).toBe("Leaderboard");
    expect(TERMS.player).toBe("Player");
  });
});
