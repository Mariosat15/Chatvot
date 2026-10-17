import { describe, expect, it } from "vitest";
import Competition from "@/database/models/trading/competition.model";

// Reason: the schema capped both level fields at 10 while the configured
// ladder ships twenty rungs, so creating a trading contest gated at rung 18
// failed validation and the admin saw a generic Server Components error.
function levelError(minLevel: number, maxLevel?: number) {
  const doc = new Competition({
    levelRequirement: { enabled: true, minLevel, maxLevel },
  });
  const errors = doc.validateSync()?.errors ?? {};
  return {
    min: "levelRequirement.minLevel" in errors,
    max: "levelRequirement.maxLevel" in errors,
  };
}

describe("Competition.levelRequirement bounds", () => {
  it("accepts rungs above 10 on a twenty-rung ladder", () => {
    expect(levelError(12, 18)).toEqual({ min: false, max: false });
    expect(levelError(20, 20)).toEqual({ min: false, max: false });
  });

  it("still refuses values outside 1-100", () => {
    expect(levelError(0, 101)).toEqual({ min: true, max: true });
  });
});
