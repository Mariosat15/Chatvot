import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { webpAliasFilename } from "@/lib/utils/webp-alias-filename";

describe("webpAliasFilename", () => {
  it("maps raster names to the sibling .webp", () => {
    expect(
      webpAliasFilename(
        "game-gallery-chartvolt-games-circuit-sprint-1790056608558.png",
      ),
    ).toBe("game-gallery-chartvolt-games-circuit-sprint-1790056608558.webp");
    expect(webpAliasFilename("hero.JPEG")).toBe("hero.webp");
    expect(webpAliasFilename("a.gif?t=1")).toBe("a.webp");
  });

  it("returns null for non-raster or already-webp names", () => {
    expect(webpAliasFilename("logo.webp")).toBeNull();
    expect(webpAliasFilename("logo.svg")).toBeNull();
    expect(webpAliasFilename("")).toBeNull();
  });

  it("both apps' helpers agree byte-for-byte", () => {
    const main = readFileSync(
      path.join(process.cwd(), "lib/utils/webp-alias-filename.ts"),
      "utf8",
    );
    const admin = readFileSync(
      path.join(
        process.cwd(),
        "apps/admin/lib/utils/webp-alias-filename.ts",
      ),
      "utf8",
    );
    // Reason: strip the one-line "Mirrored from/into" comment difference.
    const stripMirrorNote = (src: string) =>
      src.replace(/\r\n/g, "\n").replace(/^ \* Mirrored (from|into).*\n/m, "");
    expect(stripMirrorNote(admin)).toBe(stripMirrorNote(main));
  });

  it("main and admin asset routes call the alias helper", () => {
    const main = readFileSync(
      path.join(
        process.cwd(),
        "app/api/assets/images/[filename]/route.ts",
      ),
      "utf8",
    );
    const admin = readFileSync(
      path.join(
        process.cwd(),
        "apps/admin/app/api/assets/images/[filename]/route.ts",
      ),
      "utf8",
    );
    expect(main).toMatch(/webpAliasFilename\(/);
    expect(admin).toMatch(/webpAliasFilename\(/);
  });

  it("tab strip pins overflow-y hidden so a vertical scrollbar cannot appear", () => {
    const tabs = readFileSync(
      path.join(process.cwd(), "components/game-page/GamePageTabs.tsx"),
      "utf8",
    );
    expect(tabs).toMatch(/overflow-x-auto\s+overflow-y-hidden/);
  });
});
