/**
 * X7 step 5 — Game Master earnings stamped with gameKey and rolled up by game.
 *
 * Pins:
 * 1. distribute insertOne payload includes gameKey (absent → trading)
 * 2. challenge-outcome passes challenge.gameKey onto SettlementContest
 * 3. summariseEarningsByGame coalesces blank/absent to trading
 * 4. earningsByGameGroupStages uses the same coalescing
 * 5. backfill refuses to touch a row that already has a gameKey
 * 6. main and admin distribute.ts / earnings-by-game.ts stay byte-identical
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  resolveEarningGameKey,
  summariseEarningsByGame,
  earningsByGameGroupStages,
  TRADING_GAME_KEY,
} from "@/lib/services/gamemaster/earnings-by-game";
import { missingStringFilter } from "../../tools/games/backfill-game-labels-core";

const ROOT = join(__dirname, "../..");

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("X7 step 5 — GM earnings by game", () => {
  it("resolveEarningGameKey treats absent, null, blank as trading", () => {
    expect(resolveEarningGameKey(undefined)).toBe(TRADING_GAME_KEY);
    expect(resolveEarningGameKey(null)).toBe(TRADING_GAME_KEY);
    expect(resolveEarningGameKey("")).toBe(TRADING_GAME_KEY);
    expect(resolveEarningGameKey("   ")).toBe(TRADING_GAME_KEY);
    expect(resolveEarningGameKey("provider:cv:circuit-sprint")).toBe(
      "provider:cv:circuit-sprint",
    );
  });

  it("summariseEarningsByGame groups on coalesced key and sorts by net desc", () => {
    const rows = summariseEarningsByGame([
      { gameKey: undefined, netEarning: 10 },
      { gameKey: "trading", netEarning: 5 },
      { gameKey: "provider:cv:circuit-sprint", netEarning: 20 },
      { gameKey: "", netEarning: 3 },
      { gameKey: "provider:cv:circuit-sprint", netEarning: 4 },
    ]);
    expect(rows).toEqual([
      {
        gameKey: "provider:cv:circuit-sprint",
        netEarning: 24,
        count: 2,
      },
      { gameKey: "trading", netEarning: 18, count: 3 },
    ]);
  });

  it("earningsByGameGroupStages coalesces blank gameKey to trading", () => {
    const stages = JSON.stringify(earningsByGameGroupStages());
    expect(stages).toContain(TRADING_GAME_KEY);
    expect(stages).toContain("$gameKey");
    // Reason: must not filter by enabled games — R29.
    expect(stages).not.toMatch(/getEnabledGameTypes|enabledGame/);
  });

  it("main distribute stamps gameKey with trading fallback", () => {
    const src = stripComments(
      readFileSync(
        join(ROOT, "lib/services/settlement/game-master-fees/distribute.ts"),
        "utf8",
      ),
    );
    expect(src).toMatch(/gameKey\s*:/);
    expect(src).toMatch(/"trading"/);
    expect(src).toMatch(/insertOne/);
  });

  it("challenge-outcome passes challenge.gameKey onto the settlement contest", () => {
    const src = stripComments(
      readFileSync(
        join(ROOT, "lib/services/settlement/challenge-outcome.ts"),
        "utf8",
      ),
    );
    // Reason: assert the assignment, not merely the identifier in a comment.
    expect(src).toMatch(/gameKey\s*:\s*challenge\.gameKey/);
  });

  it("GameMasterEarning schema declares gameKey without a default", () => {
    const src = stripComments(
      readFileSync(
        join(ROOT, "database/models/gamemaster/gamemaster-earning.model.ts"),
        "utf8",
      ),
    );
    expect(src).toMatch(/gameKey\s*:\s*\{/);
    // A default would mask pre-X7 rows as deliberately trading.
    const gameKeyBlock = src.slice(src.indexOf("gameKey:"));
    const block = gameKeyBlock.slice(0, gameKeyBlock.indexOf("referredUserId"));
    expect(block).not.toMatch(/default\s*:/);
  });

  it("backfill missing filter matches absent, null and blank", () => {
    const filter = missingStringFilter("gameKey");
    expect(filter).toEqual({
      $or: [
        { gameKey: { $exists: false } },
        { gameKey: null },
        { gameKey: "" },
      ],
    });
  });

  it("backfill core re-asserts the missing filter on write", () => {
    const src = stripComments(
      readFileSync(
        join(ROOT, "tools/gamemaster/backfill-gm-earning-gamekey-core.ts"),
        "utf8",
      ),
    );
    // Reason: the count filter alone is not enough — the write must re-assert
    // missing so a concurrent stamp is not overwritten. Match updateOne's filter.
    expect(src).toMatch(
      /updateOne\s*\(\s*\{\s*_id:\s*row\._id,\s*\.\.\.missingStringFilter\("gameKey"\)\s*\}/,
    );
    expect(src).toMatch(/\$set:\s*\{\s*gameKey/);
  });

  it("main and admin distribute.ts stay byte-identical on the stamp", () => {
    const main = readFileSync(
      join(ROOT, "lib/services/settlement/game-master-fees/distribute.ts"),
      "utf8",
    );
    const admin = readFileSync(
      join(
        ROOT,
        "apps/admin/lib/services/settlement/game-master-fees/distribute.ts",
      ),
      "utf8",
    );
    expect(admin).toBe(main);
  });

  it("main and admin earnings-by-game.ts stay byte-identical", () => {
    const main = readFileSync(
      join(ROOT, "lib/services/gamemaster/earnings-by-game.ts"),
      "utf8",
    );
    const admin = readFileSync(
      join(ROOT, "apps/admin/lib/services/gamemaster/earnings-by-game.ts"),
      "utf8",
    );
    expect(admin).toBe(main);
  });

  it("player earnings route returns byGame from summariseEarningsByGame", () => {
    const src = stripComments(
      readFileSync(join(ROOT, "app/api/gamemaster/earnings/route.ts"), "utf8"),
    );
    // Reason: an import is not a use — match the call with its argument.
    expect(src).toMatch(/summariseEarningsByGame\s*\(\s*allFilteredEarnings\s*\)/);
    expect(src).toMatch(/\bbyGame\b/);
    expect(src).not.toMatch(/getEnabledGameTypes/);
  });

  it("dashboard route aggregates with earningsByGameGroupStages", () => {
    const src = stripComments(
      readFileSync(join(ROOT, "app/api/gamemaster/dashboard/route.ts"), "utf8"),
    );
    // Reason: an import is not a use — match the call.
    expect(src).toMatch(/\.\.\.earningsByGameGroupStages\s*\(\s*\)/);
    expect(src).toMatch(/\bearningsByGame\b/);
    expect(src).not.toMatch(/getEnabledGameTypes/);
  });
});
