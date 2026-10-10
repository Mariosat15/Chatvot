import { describe, expect, it } from "vitest";
import { deriveHowItWorksSteps } from "@/lib/services/games/game-page.service";
import {
  CIRCUIT_SPRINT_PAGE_DEFAULTS,
  isCircuitSprintGameCode,
} from "@/lib/services/games/circuit-sprint-page-defaults";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("game-page aggregation guards", () => {
  it("deriveHowItWorksSteps returns [] for absent how-to-play", () => {
    // Reason: production 21 Sep 2026 crashed on undefined.gallery.slice in the
    // overview; the same class hits howToPlayLines.filter/slice if callers pass
    // nothing. Empty must be [], never a throw.
    expect(deriveHowItWorksSteps(undefined)).toEqual([]);
    expect(deriveHowItWorksSteps(null)).toEqual([]);
    expect(deriveHowItWorksSteps([])).toEqual([]);
  });

  it("deriveHowItWorksSteps still builds steps from how-to-play lines", () => {
    expect(
      deriveHowItWorksSteps([
        "Connect — join matching terminals",
        "Avoid crossings on the board",
        "Submit before the clock",
      ]),
    ).toEqual([
      { title: "Connect", detail: "join matching terminals" },
      { title: "Step 2", detail: "Avoid crossings on the board" },
      { title: "Step 3", detail: "Submit before the clock" },
    ]);
  });
});

describe("Circuit Sprint page chrome defaults", () => {
  it("keys off gameCode circuit-sprint, never a display name", () => {
    expect(isCircuitSprintGameCode("circuit-sprint")).toBe(true);
    expect(isCircuitSprintGameCode("CIRCUIT-SPRINT")).toBe(true);
    expect(isCircuitSprintGameCode("Circuit Sprint")).toBe(false);
    expect(isCircuitSprintGameCode(undefined)).toBe(false);
  });

  it("carries the mock quote, theme and three steps", () => {
    expect(CIRCUIT_SPRINT_PAGE_DEFAULTS.pageThemeId).toBe("circuit-neon");
    expect(CIRCUIT_SPRINT_PAGE_DEFAULTS.stylizedQuote).toMatch(/Connect the paths/i);
    expect(CIRCUIT_SPRINT_PAGE_DEFAULTS.howItWorksSteps).toHaveLength(3);
    expect(CIRCUIT_SPRINT_PAGE_DEFAULTS.howItWorksSteps[0].title).toBe(
      "Connect",
    );
  });

  it("buildProviderPage applies them only when fields are empty", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/services/games/game-page.service.ts"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(source).toMatch(/isCircuitSprintGameCode\(title\.gameCode\)/);
    expect(source).toMatch(/CIRCUIT_SPRINT_PAGE_DEFAULTS/);
    // Operator-authored steps still win — defaults only when authoredSteps is empty.
    expect(source).toMatch(
      /authoredSteps\.length > 0[\s\S]*?sprintDefaults/,
    );
  });
});
