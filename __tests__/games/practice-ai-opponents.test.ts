import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { practiceOpponentsFor } from "@/lib/services/games/practice-opponents";

/**
 * Computer opponents in a free practice round (owner, 14 Oct 2026).
 *
 * The property that matters is the one a summary would drop: the count reaches the provider
 * from the PRACTICE launcher only, and `createRound` forwards it only on a practice round - so
 * no paid contest can be sent one. The game service refuses it on a ranked round as well.
 */

const read = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("practiceOpponentsFor", () => {
  it("accepts whole numbers 1-15 and nothing else", () => {
    expect(practiceOpponentsFor({ practiceAiPilots: 1 })).toBe(1);
    expect(practiceOpponentsFor({ practiceAiPilots: 15 })).toBe(15);
    for (const bad of [undefined, null, 0, 16, -1, 2.5, "3", Number.NaN]) {
      expect(practiceOpponentsFor({ practiceAiPilots: bad })).toBeUndefined();
    }
  });
});

describe("the count travels only on a practice round", () => {
  it("the practice launcher reads the title's setting and passes it on", () => {
    const code = read("lib/services/games/practice-round.service.ts");
    expect(code).toMatch(/supportsPractice practiceAiPilots"/);
    expect(code).toMatch(/practiceOpponents:\s*practiceOpponentsFor\(title\)/);
  });

  it("createRound forwards it to the provider only when the round is practice", () => {
    const code = read("lib/services/games/round.service.ts");
    expect(code).toMatch(
      /input\.contestType === "practice" && input\.practiceOpponents\s*\?\s*\{ practiceOpponents: input\.practiceOpponents \}/,
    );
    expect(code.match(/practiceOpponents/g)?.length).toBe(3);
  });

  it("no other platform caller of createRound supplies it", () => {
    for (const file of [
      "lib/services/games/round-launch.service.ts",
      "lib/services/games/challenge-round-launch.service.ts",
    ]) {
      expect(read(file)).not.toMatch(/practiceOpponents/);
    }
  });

  it("the adapter omits the field when absent, so a ranked body is unchanged", () => {
    const code = read("lib/services/game-providers/adapters/chartvolt-games.adapter.ts");
    expect(code).toMatch(
      /\.\.\.\(request\.practiceOpponents \? \{ practiceOpponents: request\.practiceOpponents \} : \{\}\)/,
    );
  });

  it("the mirrored contract, types and adapter stay byte-identical", () => {
    for (const f of [
      "lib/services/game-providers/contract.ts",
      "lib/services/games/round-types.ts",
      "lib/services/game-providers/adapters/chartvolt-games.adapter.ts",
      "database/models/games/provider-game.model.ts",
    ]) {
      expect(readFileSync(`apps/admin/${f}`, "utf8")).toBe(readFileSync(f, "utf8"));
    }
  });
});

describe("the admin control", () => {
  it("the model stores it with no default and a 0-15 range", () => {
    const code = readFileSync("database/models/games/provider-game.model.ts", "utf8");
    expect(code).toMatch(/practiceAiPilots: \{ type: Number, min: 0, max: 15 \}/);
  });

  it("is in no catalogue sync list, so a sync never overwrites it", () => {
    const sync = read("lib/services/game-providers/catalogue.service.ts");
    expect(sync).not.toMatch(/practiceAiPilots/);
  });

  it("is barred from the content editor and saved on its own audited decision", () => {
    expect(read("apps/admin/lib/admin/game-content-fields.ts")).toMatch(/\["practiceAiPilots",/);
    const route = read("apps/admin/app/api/games/providers/[providerKey]/games/play-style/route.ts");
    expect(route).toMatch(/"practiceAiPilots" in body/);
    expect(route).toMatch(/\[setsStyle, setsSupported, setsLobby, setsAi\]/);
  });

  it("the service clears with $unset and refuses a title without practice", () => {
    const svc = read("apps/admin/lib/services/game-providers/game-play-style.service.ts");
    expect(svc).toMatch(/\$unset: \{ practiceAiPilots: "" \}/);
    expect(svc).toMatch(/if \(!title\.supportsPractice\)/);
  });

  it("is shown in the Formats & play style card only for a practice title", () => {
    const editor = read("apps/admin/components/admin/games/GamesWorkspaceEditor.tsx");
    expect(editor).toMatch(/title\.supportsPractice && \(\s*<div[^>]*>\s*<GamePracticeAiControl/);
  });
});
