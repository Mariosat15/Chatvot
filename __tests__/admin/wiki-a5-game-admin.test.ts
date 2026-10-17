import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A5 (X6.5) — admin wiki describes a multi-game platform, not a trading-only one.
 *
 * Owner decision 15 Sep 2026: engineering delivers the reword plus empty
 * Game Administration topic skeletons; body authoring is owner work.
 */

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const WIKI = path.join(
  REPO_ROOT,
  "apps",
  "admin",
  "components",
  "admin",
  "AdminWikiSection.tsx",
);
const SKELETON = path.join(
  REPO_ROOT,
  "apps",
  "admin",
  "components",
  "admin",
  "wiki",
  "game-administration-skeleton.tsx",
);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("A5 — admin wiki multi-game pass", () => {
  it("overview must not call the platform a trading competition platform", () => {
    const source = stripComments(fs.readFileSync(WIKI, "utf8"));
    expect(source).not.toMatch(/trading competition platform/i);
    expect(source).toMatch(/multi-game competition platform/i);
  });

  it("spreads the Game Administration skeleton topics into the wiki", () => {
    const source = stripComments(fs.readFileSync(WIKI, "utf8"));
    expect(source).toMatch(
      /import\s*\{\s*GAME_ADMIN_WIKI_TOPICS\s*\}\s*from\s*["']@\/components\/admin\/wiki\/game-administration-skeleton["']/,
    );
    expect(source).toMatch(/\.\.\.GAME_ADMIN_WIKI_TOPICS,/);
    expect(source.indexOf("...GAME_ADMIN_WIKI_TOPICS")).toBeLessThan(
      source.indexOf('id: "fraud-overview"'),
    );
    expect(source.indexOf('id: "competitions-manage"')).toBeLessThan(
      source.indexOf("...GAME_ADMIN_WIKI_TOPICS"),
    );
  });

  it("skeleton module declares ten Game Administration topics", () => {
    const source = stripComments(fs.readFileSync(SKELETON, "utf8"));
    const ids = [
      "games-admin-overview",
      "game-providers-register",
      "provider-catalogue",
      "external-games-switch",
      "provider-contest-create",
      "provider-contest-publish",
      "provider-contest-edit",
      "round-inspector",
      "play-modes-contest-shape",
      "scoring-rules-eligibility",
    ];
    for (const id of ids) {
      expect(source).toContain(`id: "${id}"`);
    }
    expect(source).toContain('GAME_ADMIN_CATEGORY = "Game Administration"');
    // Reason: every skeleton must say it is unfinished — a filled-looking page
    // with invented guidance is worse than an empty outline.
    expect(source).toMatch(/To be completed/);
  });
});
