import { describe, it, expect } from "vitest";
import { resolveGameCardAccent } from "@/components/games/catalogue/game-card-accent";
import {
  formatCatalogueCount,
  formatPositiveRate,
} from "@/components/games/catalogue/format-catalogue-stat";

describe("resolveGameCardAccent", () => {
  it("gives each known title its own neon identity", () => {
    expect(
      resolveGameCardAccent({
        kind: "provider",
        gameKey: "provider:chartvolt:volt-velocity",
        gameCode: "volt-velocity",
      }).accent,
    ).toBe("#55C8FF");
    expect(
      resolveGameCardAccent({
        kind: "provider",
        gameKey: "provider:chartvolt:volt-stack",
        gameCode: "volt-stack",
      }).accent,
    ).toBe("#C678FF");
    expect(
      resolveGameCardAccent({
        kind: "provider",
        gameKey: "provider:chartvolt:circuit-sprint",
        gameCode: "circuit-sprint",
      }).accent,
    ).toBe("#FFB040");
    expect(
      resolveGameCardAccent({ kind: "trading", gameKey: "trading" }).objectPosition,
    ).toBe("center 42%");
  });

  it("does not invent a positive rate string for missing data", () => {
    expect(formatCatalogueCount(0)).toBe("");
    expect(formatCatalogueCount(12400)).toBe("12.4K");
    expect(formatPositiveRate(96)).toBe("96%");
    expect(formatPositiveRate(-1)).toBe("");
  });
});
