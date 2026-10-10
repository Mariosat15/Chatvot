/**
 * Tasks 15–16: game artwork is optimised on upload (WebP + per-slot resize).
 *
 * Existing files are deliberately not bulk-rewritten here — that was the owner
 * decision of 9 Sep 2026. The Image Optimizer may still retarget URLs when an
 * operator opts in; new uploads never need that path.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import {
  ARTWORK_SLOT_OPTIMIZE,
  artworkOptimizeSpec,
  optimizeGameArtworkBuffer,
} from "@/apps/admin/lib/admin/game-artwork-optimize";
import { ARTWORK_SLOTS, type ArtworkSlot } from "@/apps/admin/lib/admin/game-artwork-slots";

const ROOT = process.cwd();

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

async function solidPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 40, b: 80 },
    },
  })
    .png()
    .toBuffer();
}

describe("artworkOptimizeSpec", () => {
  it("covers every ArtworkSlot exactly once", () => {
    const keys = [...ARTWORK_SLOT_OPTIMIZE.keys()] as ArtworkSlot[];
    expect(keys.sort()).toEqual([...ARTWORK_SLOTS].sort());
  });

  it("logo is square and smaller than a banner", () => {
    const logo = artworkOptimizeSpec("logo");
    const banner = artworkOptimizeSpec("banner");
    expect(logo.maxWidth).toBe(logo.maxHeight);
    expect(logo.maxWidth).toBeLessThan(banner.maxWidth);
    expect(banner.maxWidth).toBe(1920);
  });
});

describe("optimizeGameArtworkBuffer", () => {
  it("encodes as WebP and shrinks an oversized banner", async () => {
    const input = await solidPng(2400, 1400);
    const out = await optimizeGameArtworkBuffer(input, "banner");

    expect(out.extension).toBe("webp");
    expect(out.contentType).toBe("image/webp");
    expect(out.optimizedBytes).toBeLessThan(out.originalBytes);
    expect(out.optimizedBytes).toBe(out.buffer.length);

    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBeLessThanOrEqual(1920);
    expect(meta.height).toBeLessThanOrEqual(1080);
  }, 15_000);

  it("does not enlarge a small logo", async () => {
    const input = await solidPng(64, 64);
    const out = await optimizeGameArtworkBuffer(input, "logo");
    const meta = await sharp(out.buffer).metadata();
    expect(meta.width).toBe(64);
    expect(meta.height).toBe(64);
  }, 15_000);

  it("fits a wide logo inside the square ceiling without cropping to a square", async () => {
    // fit: "inside" — a 800×200 logo becomes ≤512 on the long edge, not a 512×512 crop.
    const input = await solidPng(800, 200);
    const out = await optimizeGameArtworkBuffer(input, "logo");
    const meta = await sharp(out.buffer).metadata();
    expect(meta.width).toBeLessThanOrEqual(512);
    expect(meta.height).toBeLessThanOrEqual(512);
    expect(meta.width).toBeGreaterThan(meta.height!);
  }, 15_000);
});

describe("storeGameArtwork wires optimize before write", () => {
  const storage = join(ROOT, "apps/admin/lib/admin/game-artwork-storage.ts");

  it("imports optimizeGameArtworkBuffer and always names the file .webp", () => {
    const code = stripComments(readFileSync(storage, "utf8"));
    expect(code).toMatch(/optimizeGameArtworkBuffer/);
    // Reason: the filename template must end in `.webp`, never `${extension}` — that
    // would store WebP bytes under a .png name after optimize.
    expect(code).toMatch(/\.webp`/);
    expect(code).not.toMatch(/\$\{extension\}/);
  });

  it("passes optimized.contentType to putBrandingAsset, not the upload mime", () => {
    const code = stripComments(readFileSync(storage, "utf8"));
    expect(code).toMatch(
      /putBrandingAsset\(\s*filename,\s*optimized\.buffer,\s*optimized\.contentType\s*\)/,
    );
  });
});
