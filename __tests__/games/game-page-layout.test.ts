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
      "challenges",
      "rules",
      "gallery",
    ]) {
      expect(tabs).toContain(`"${id}"`);
      expect(page).toContain(`"${id}"`);
    }
    // Reason: Prizes duplicated Rules content — removed from the strip.
    expect(tabs).not.toContain('"prizes"');
    expect(view).not.toMatch(/current === "prizes"/);
    expect(view).toContain("leaderboards");
    expect(view).toContain("competitions");
  });

  it("uses a cinematic hero whose banner fills the backdrop", () => {
    expect(view).toContain("max-w-[1480px]");
    expect(hero).toMatch(/min-h-\[300px\]/);
    expect(hero).toMatch(/md:min-h-\[340px\]/);
    // Reason: owner Sep 2026 — banner must fill the hero as a background
    // (auto-adjust). object-contain left empty bands; cover fills edge to edge.
    // Logo wordmark still uses contain (separate rule below).
    expect(hero).toMatch(/object-cover object-right/);
    expect(hero).toMatch(/gpDisplay/);
    expect(hero).toMatch(/gpSans/);
    // Reason: game/trading logo is a wide wordmark — full-width of the copy
    // column with natural height, never a fixed square that letterboxes it.
    expect(hero).toMatch(/max-w-xl/);
    expect(hero).toMatch(/h-auto w-full/);
    expect(hero).not.toMatch(/lg:h-48 lg:w-48/);
    expect(hero).not.toMatch(/h-16 w-28/);
  });

  it("uses a 65/35 overview with play-mode cards", () => {
    expect(overview).toMatch(/lg:grid-cols-\[1\.85fr_1fr\]/);
    expect(overview).toContain("GamePageInfoSidebar");
    expect(sidebar).toMatch(/Play Modes/i);
    expect(sidebar).toContain("hover:border-[var(--gp-gold");
  });

  it("lets the overview preview image grow to the sidebar height", () => {
    // Reason: a fixed aspect-* box left a dark empty band under the image
    // whenever Game Info was taller — trading and provider pages both hit it.
    // object-contain (not cover) so operator artwork is not cropped while the
    // panel still flex-grows to match the sidebar.
    expect(overview).not.toMatch(/aspect-\[16\/10\]|aspect-video/);
    expect(overview).toMatch(/flex-1/);
    expect(overview).toMatch(/object-contain/);
    expect(overview).toMatch(/absolute inset-0/);
  });

  it("fills the tips banner edge to edge without distorting", () => {
    const contests = readCode("components/game-page/GamePageContests.tsx");
    const tips = readCode("components/game-page/GamePageTips.tsx");
    // Reason: contest banners still use natural height + contain (baked-in
    // copy). Tips artwork sits beside a short tip list in a wide flex column —
    // contain left black side gaps; cover fills left→right without stretch.
    expect(contests).toMatch(/object-contain/);
    expect(contests).toMatch(/h-auto w-full/);
    expect(tips).toMatch(/object-cover/);
    expect(tips).not.toMatch(/object-contain/);
    expect(tips).toMatch(/flex-1/);
    expect(tips).toMatch(/lg:flex-row/);
  });

  it("places How It Works as a full-width step band", () => {
    expect(overview).toContain("GamePageHowItWorks");
    expect(howItWorks).toContain("HowItWorksSteps");
    // Reason: a 3-column step grid is what gives steps room; a left-column
    // nest was crushing them (owner annotation).
    expect(howItWorks).toMatch(/lg:grid-cols-3/);
  });
});
