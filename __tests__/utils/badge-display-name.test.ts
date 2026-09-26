import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  humanizeBadgeId,
  resolveBadgeDisplayName,
} from "@/lib/utils/badge-display-name";

describe("humanizeBadgeId", () => {
  it("turns a blueprint trading flag id into a title", () => {
    expect(humanizeBadgeId("trading_beat_top_trader_flag")).toBe("Beat Top Trader");
  });

  it("strips platform / pf prefixes and numeric tiers", () => {
    expect(humanizeBadgeId("pf_podium_finishes_5")).toBe("Podium Finishes");
    expect(humanizeBadgeId("platform_first_place_finishes_1")).toBe(
      "First Place Finishes",
    );
  });

  it("returns empty for blank input", () => {
    expect(humanizeBadgeId("")).toBe("");
  });
});

describe("resolveBadgeDisplayName", () => {
  it("prefers an explicit known name", () => {
    expect(
      resolveBadgeDisplayName("trading_beat_top_trader_flag", "Beat Top Player"),
    ).toBe("Beat Top Player");
  });

  it("uses the catalogue map before humanising", () => {
    const map = new Map([["trading_beat_top_trader_flag", "Giant Killer"]]);
    expect(
      resolveBadgeDisplayName("trading_beat_top_trader_flag", null, map),
    ).toBe("Giant Killer");
  });

  it("never falls through to the raw snake_case id when it can humanise", () => {
    expect(resolveBadgeDisplayName("trading_beat_top_trader_flag")).toBe(
      "Beat Top Trader",
    );
  });
});

describe("badge-display-name mirror", () => {
  it("keeps the admin copy byte-identical", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const root = path.resolve(here, "../../lib/utils/badge-display-name.ts");
    const admin = path.resolve(
      here,
      "../../apps/admin/lib/utils/badge-display-name.ts",
    );
    expect(readFileSync(admin, "utf8")).toBe(readFileSync(root, "utf8"));
  });
});
