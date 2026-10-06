/**
 * Sticky Enter bar slogans — pick + two-tone split.
 */

import { describe, expect, it } from "vitest";
import {
  pickStickyEnterSlogan,
  splitSloganTone,
  STICKY_ENTER_SLOGANS,
} from "@/components/game-page/sticky-enter-slogans";

describe("sticky enter slogans", () => {
  it("lists every owner slogan exactly once", () => {
    expect(STICKY_ENTER_SLOGANS).toHaveLength(21);
    expect(new Set(STICKY_ENTER_SLOGANS).size).toBe(21);
  });

  it("picks by the injected random so every index is reachable", () => {
    expect(pickStickyEnterSlogan(() => 0)).toBe(STICKY_ENTER_SLOGANS[0]);
    expect(pickStickyEnterSlogan(() => 0.999)).toBe(
      STICKY_ENTER_SLOGANS[STICKY_ENTER_SLOGANS.length - 1],
    );
  });

  it("splits multi-phrase slogans for the gold / accent halves", () => {
    expect(splitSloganTone("Skill In. Victory Out.")).toEqual({
      lead: "Skill In.",
      trail: "Victory Out.",
    });
    expect(splitSloganTone("Play. Compete. Conquer.")).toEqual({
      lead: "Play. Compete.",
      trail: "Conquer.",
    });
    expect(splitSloganTone("Compete Beyond Limits.")).toEqual({
      lead: "Compete Beyond Limits.",
      trail: null,
    });
  });
});
