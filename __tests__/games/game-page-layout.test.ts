/**
 * Player game page chrome — structural guards for the premium redesign.
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
  const hero = readCode("components/game-page/GamePageHero.tsx");
  const howItWorks = readCode("components/game-page/GamePageHowItWorks.tsx");
  const sidebar = readCode("components/game-page/GamePageInfoSidebar.tsx");
  const page = readCode("app/(root)/games/[slug]/page.tsx");

  it("does not render a top Play Now control beside the tabs", () => {
    // Reason: PlayNowButton beside the tab strip was the old layout; ENTER
    // CTAs live in the hero, sidebar, and sticky bar instead.
    expect(view).not.toContain("PlayNowButton");
    const tabsBlock = view.slice(
      view.indexOf("<GamePageTabs"),
      view.indexOf("<GamePageTabs") + 200,
    );
    expect(tabsBlock).not.toMatch(/PlayNow|Enter Now|Enter Competition/i);
  });

  it("allows ENTER COMPETITION / ENTER NOW CTAs in hero, sidebar, and sticky bar", () => {
    expect(hero).toMatch(/Enter Competition/i);
    expect(sidebar).toMatch(/Enter Now/i);
    expect(view).toContain("StickyEnterBar");
    expect(view).toMatch(/Enter Now/i);
  });

  it("does not render the Ready to Play CTA panel on overview", () => {
    expect(overview).not.toMatch(/Ready to Play/i);
    expect(overview).not.toContain("PlayNowButton");
  });

  it("includes Competitions and Leaderboard tabs", () => {
    for (const id of [
      "overview",
      "how-it-works",
      "competitions",
      "leaderboards",
      "prizes",
      "challenges",
      "rules",
      "gallery",
    ]) {
      expect(tabs).toContain(`"${id}"`);
      expect(page).toContain(`"${id}"`);
    }
    expect(view).toContain("leaderboards");
    expect(view).toContain("competitions");
  });

  it("uses a wider shell and cinematic hero", () => {
    expect(view).toContain("max-w-[1480px]");
    expect(hero).toMatch(/min-h-\[300px\]/);
    expect(hero).toMatch(/md:min-h-\[340px\]/);
  });

  it("uses a 65/35 overview with play-mode cards", () => {
    expect(overview).toContain("lg:grid-cols-[1.65fr_1fr]");
    expect(overview).toContain("GamePageInfoSidebar");
    expect(sidebar).toMatch(/Play Modes/i);
    expect(sidebar).toContain("hover:border-[var(--gp-gold");
  });

  it("places How It Works as a full-width step band", () => {
    expect(overview).toContain("GamePageHowItWorks");
    expect(howItWorks).toContain("HowItWorksSteps");
    // Reason: a 3-column step grid is what gives steps room; a left-column
    // nest was crushing them (owner annotation).
    expect(howItWorks).toMatch(/lg:grid-cols-3/);
  });
});
