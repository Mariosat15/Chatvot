import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isGamePlayRoute } from "@/lib/utils/game-play-route";

// Owner, 14 Oct 2026: "when in game the notes on top shouldn't be shown - nothing should disturb
// the game view", and the pinned phone stage sat under the page chrome with scrolling locked.

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("game play routes", () => {
  it.each(["/competitions/abc/play", "/challenges/abc/play", "/games/volt-velocity/practice", "/games/x/practice/"])(
    "%s is a game screen",
    (path) => expect(isGamePlayRoute(path)).toBe(true),
  );

  it.each(["/competitions/abc", "/competitions/abc/results", "/games/x", "/dashboard", "", null, undefined])(
    "%s is not a game screen",
    (path) => expect(isGamePlayRoute(path)).toBe(false),
  );
});

describe("page chrome is withheld while a game is played", () => {
  it.each(["components/Header.tsx", "components/AnnouncementBanner.tsx"])("%s returns nothing on a game screen", (file) => {
    const source = read(file);
    expect(source).toMatch(/isGamePlayRoute\(pathname\)/);
    expect(source).toMatch(/const pathname = usePathname\(\)/);
  });
});

describe("the pinned stage escapes its ancestors", () => {
  const source = read("components/games/use-stage-fullscreen.ts");

  it("neutralises every property that would trap position:fixed or z-index", () => {
    for (const property of ["transform", "filter", "backdrop-filter", "contain", "will-change", "z-index"]) {
      expect(source).toContain(`el.style.setProperty("${property}"`);
    }
  });

  it("restores each ancestor's own inline style when the pin ends", () => {
    expect(source).toMatch(/for \(const \[el, css\] of neutralised\) el\.style\.cssText = css;/);
  });
});
