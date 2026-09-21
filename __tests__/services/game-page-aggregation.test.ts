import { describe, expect, it } from "vitest";
import { deriveHowItWorksSteps } from "@/lib/services/games/game-page.service";

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
