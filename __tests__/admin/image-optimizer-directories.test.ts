/**
 * Image Optimizer must scan game/trading artwork, not only marketplace cosmetics.
 *
 * Until this slice, IMAGE_DIRECTORIES listed marketplace and a few upload folders —
 * never `public/assets/images`, where game banners, logos and trading page art land
 * (`game-artwork-storage.ts`). Scan Images therefore reported only cosmetics while
 * player screens loaded multi-megabyte PNGs. Renaming those files without rewriting
 * `provider_game` / `game_page_content` / `branding_asset` would also break every
 * title — covered by `isReferencedArtworkDir` + the retarget call in the POST route.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { IMAGE_DIRECTORIES } from "@/apps/admin/lib/admin/image-optimizer-directories";
import { isReferencedArtworkDir } from "@/apps/admin/lib/admin/image-optimizer-artwork";

const ROOT = process.cwd();

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("Image Optimizer directories", () => {
  it("lists public/assets/images under both production roots and development", () => {
    const prodPaths = IMAGE_DIRECTORIES.production.map((d) => d.path);
    expect(prodPaths.some((p) => p.endsWith("/public/assets/images"))).toBe(
      true,
    );
    expect(
      prodPaths.filter((p) => p.includes("/public/assets/images")).length,
    ).toBeGreaterThanOrEqual(2);

    const devPaths = IMAGE_DIRECTORIES.development.map((d) => d.path);
    expect(
      devPaths.some(
        (p) =>
          p.includes(`${join("public", "assets", "images")}`) ||
          p.replace(/\\/g, "/").endsWith("public/assets/images"),
      ),
    ).toBe(true);
  });

  it("lists hero and profile upload folders", () => {
    const labels = [
      ...IMAGE_DIRECTORIES.production,
      ...IMAGE_DIRECTORIES.development,
    ].map((d) => d.label);
    expect(labels).toContain("Hero Uploads");
    expect(labels).toContain("Profile Uploads");
    expect(labels).toContain("Game & Branding Artwork");
  });

  it("does not list neon kit art (fingerprinted, git-tracked)", () => {
    const labels = [
      ...IMAGE_DIRECTORIES.production,
      ...IMAGE_DIRECTORIES.development,
    ].map((d) => d.label.toLowerCase());
    expect(labels.some((l) => l.includes("neon"))).toBe(false);
  });

  it("route imports the shared directory list rather than an inline copy", () => {
    const route = readFileSync(
      join(ROOT, "apps/admin/app/api/dev-zone/optimize-images/route.ts"),
      "utf8",
    );
    const code = stripComments(route);
    expect(code).toMatch(
      /from\s+["']@\/lib\/admin\/image-optimizer-directories["']/,
    );
    // Reason: an inline `const IMAGE_DIRECTORIES = {` would drift from the module.
    expect(code).not.toMatch(/const\s+IMAGE_DIRECTORIES\s*=/);
  });

  it("POST retargets referenced artwork after a rename", () => {
    const route = readFileSync(
      join(ROOT, "apps/admin/app/api/dev-zone/optimize-images/route.ts"),
      "utf8",
    );
    const code = stripComments(route);
    expect(code).toMatch(/retargetArtworkAfterOptimize\s*\(/);
    expect(code).toMatch(/isReferencedArtworkDir\s*\(/);
    expect(code).toMatch(/image-optimizer-policy/);
  });
});

describe("isReferencedArtworkDir", () => {
  it("matches assets/images paths and artwork labels", () => {
    expect(
      isReferencedArtworkDir(
        "/var/www/chartvolt/public/assets/images",
        "Game & Branding Artwork",
      ),
    ).toBe(true);
    expect(
      isReferencedArtworkDir(
        "C:\\repo\\public\\assets\\images",
        "Admin Game Artwork",
      ),
    ).toBe(true);
    expect(
      isReferencedArtworkDir(
        "/var/www/chartvolt/public/uploads/marketplace",
        "Marketplace Uploads",
      ),
    ).toBe(false);
  });
});
