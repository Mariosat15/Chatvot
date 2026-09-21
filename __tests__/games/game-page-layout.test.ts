/**
 * Player game page chrome — structural guards for the 21 Sep layout pass.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../..");

function readCode(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    "",
  );
}

describe("player game page layout", () => {
  const view = readCode("components/game-page/GamePageView.tsx");
  const overview = readCode("components/game-page/GamePageOverview.tsx");
  const tabs = readCode("components/game-page/GamePageTabs.tsx");

  it("does not render a top Play Now control beside the tabs", () => {
    expect(view).not.toContain("PlayNowButton");
    expect(view).not.toContain("resolvePlayNowHref");
  });

  it("does not render the Ready to Play CTA panel on overview", () => {
    expect(overview).not.toMatch(/Ready to Play/i);
    expect(overview).not.toContain("PlayNowButton");
  });

  it("drops Leaderboards from the game page tabs", () => {
    expect(tabs).not.toContain("leaderboards");
    expect(view).not.toContain("leaderboards");
    for (const id of [
      "overview",
      "how-it-works",
      "prizes",
      "challenges",
      "rules",
      "gallery",
    ]) {
      expect(tabs).toContain(`"${id}"`);
    }
  });

  it("places How It Works as a full-width step band on overview", () => {
    expect(overview).toContain("HowItWorksSteps");
    // Reason: a 3-column step grid is what gives steps room; a left-column
    // nest was crushing them (owner annotation).
    expect(overview).toMatch(/lg:grid-cols-3/);
  });
});
