import { describe, expect, it } from "vitest";
import {
  formatRoundTimeLabel,
  getGameModes,
  resolvePlayNowHref,
} from "@/lib/services/games/game-page-helpers";

describe("game-page-helpers", () => {
  describe("getGameModes", () => {
    it("lists only the formats the title supports", () => {
      expect(
        getGameModes({
          formats: { competition: true, challenge: false, practice: true },
        }),
      ).toEqual(["Competition", "Practice"]);
    });

    it("returns an empty list when nothing is enabled", () => {
      expect(
        getGameModes({
          formats: { competition: false, challenge: false, practice: false },
        }),
      ).toEqual([]);
    });
  });

  describe("formatRoundTimeLabel", () => {
    it("formats a typical–max range in minutes", () => {
      expect(formatRoundTimeLabel(120, 300)).toBe("2–5 min");
    });

    it("formats a single duration with a tilde", () => {
      expect(formatRoundTimeLabel(90, null)).toBe("~2 min");
      expect(formatRoundTimeLabel(undefined, 60)).toBe("~1 min");
    });

    it("returns null when nothing usable is provided", () => {
      expect(formatRoundTimeLabel(undefined, undefined)).toBeNull();
      expect(formatRoundTimeLabel(0, 0)).toBeNull();
    });
  });

  describe("resolvePlayNowHref", () => {
    const base = {
      slug: "circuit-sprint",
      formats: { competition: true, challenge: true, practice: true },
    };

    it("prefers a live contest", () => {
      expect(
        resolvePlayNowHref(base, [
          {
            id: "up1",
            name: "Soon",
            status: "upcoming",
            entryFee: 10,
            prizePool: 100,
            currentParticipants: 1,
            maxParticipants: 10,
            startTime: "",
            endTime: "",
          },
          {
            id: "live1",
            name: "Now",
            status: "active",
            entryFee: 10,
            prizePool: 100,
            currentParticipants: 2,
            maxParticipants: 10,
            startTime: "",
            endTime: "",
          },
        ]),
      ).toBe("/competitions/live1");
    });

    it("falls back to upcoming, then practice, then challenge", () => {
      expect(
        resolvePlayNowHref(base, [
          {
            id: "up1",
            name: "Soon",
            status: "upcoming",
            entryFee: 10,
            prizePool: 100,
            currentParticipants: 1,
            maxParticipants: 10,
            startTime: "",
            endTime: "",
          },
        ]),
      ).toBe("/competitions/up1");

      expect(resolvePlayNowHref(base, [])).toBe(
        "/games/circuit-sprint/practice",
      );

      expect(
        resolvePlayNowHref(
          {
            slug: "circuit-sprint",
            formats: {
              competition: false,
              challenge: true,
              practice: false,
            },
          },
          [],
        ),
      ).toBe("/challenges?create=1&game=circuit-sprint");
    });

    it("returns null when nothing is available", () => {
      expect(
        resolvePlayNowHref(
          {
            slug: "circuit-sprint",
            formats: {
              competition: false,
              challenge: false,
              practice: false,
            },
          },
          [],
        ),
      ).toBeNull();
    });
  });
});
