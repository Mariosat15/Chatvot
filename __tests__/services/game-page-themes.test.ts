import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  listGamePageThemes,
  resolveGamePageTheme,
} from "@/lib/services/games/game-page-themes";

const ROOT = path.resolve(__dirname, "../..");

describe("game-page-themes", () => {
  it("includes circuit-neon in the ready-made list", () => {
    const ids = listGamePageThemes().map((t) => t.id);
    expect(ids).toContain("circuit-neon");
  });

  it("maps puzzle category to circuit-neon when no theme id is set", () => {
    expect(resolveGamePageTheme(undefined, "puzzle").id).toBe("circuit-neon");
  });

  it("lets an explicit theme id win over the category", () => {
    expect(resolveGamePageTheme("racing-heat", "puzzle").id).toBe("racing-heat");
  });

  it("falls through an unknown id to category, then to default", () => {
    expect(resolveGamePageTheme("not-a-real-theme", "puzzle").id).toBe(
      "circuit-neon",
    );
    expect(resolveGamePageTheme("not-a-real-theme", "no-such-category").id).toBe(
      "default",
    );
    expect(resolveGamePageTheme(undefined, undefined).id).toBe("default");
  });

  it("keeps the admin copy byte-identical to the main one", () => {
    // Reason: check:mirrors compares models only. These two files are the single
    // source of player-page look; a drifted admin copy would show operators one
    // preset while players get another.
    const main = readFileSync(
      path.join(ROOT, "lib/services/games/game-page-themes.ts"),
      "utf8",
    );
    const admin = readFileSync(
      path.join(ROOT, "apps/admin/lib/services/games/game-page-themes.ts"),
      "utf8",
    );
    expect(admin).toBe(main);
  });
});
