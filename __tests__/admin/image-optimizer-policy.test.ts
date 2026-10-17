/**
 * Image Optimizer policy — type-aware "already optimized" ceilings.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  ARTWORK_OPTIMIZED_MAX_BYTES,
  DEFAULT_OPTIMIZED_MAX_BYTES,
  canOptimizeImage,
  isImageOptimized,
  optimizedSizeLimitBytes,
} from "@/apps/admin/lib/admin/image-optimizer-policy";

const ROOT = process.cwd();

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("image-optimizer-policy", () => {
  it("treats a 300KB artwork WebP as already optimized", () => {
    const size = 300 * 1024;
    expect(isImageOptimized(".webp", size, "artwork")).toBe(true);
    expect(canOptimizeImage(".webp", size, "artwork")).toBe(false);
  });

  it("still flags a 300KB avatar WebP as needing work", () => {
    const size = 300 * 1024;
    expect(isImageOptimized(".webp", size, "avatar")).toBe(false);
    expect(canOptimizeImage(".webp", size, "avatar")).toBe(true);
  });

  it("never treats a PNG as optimized, even when tiny for artwork", () => {
    expect(isImageOptimized(".png", 80 * 1024, "artwork")).toBe(false);
    expect(canOptimizeImage(".png", 80 * 1024, "artwork")).toBe(true);
  });

  it("uses a higher ceiling for artwork than the default", () => {
    expect(optimizedSizeLimitBytes("artwork")).toBe(
      ARTWORK_OPTIMIZED_MAX_BYTES,
    );
    expect(optimizedSizeLimitBytes("default")).toBe(
      DEFAULT_OPTIMIZED_MAX_BYTES,
    );
    expect(ARTWORK_OPTIMIZED_MAX_BYTES).toBeGreaterThan(
      DEFAULT_OPTIMIZED_MAX_BYTES,
    );
  });

  it("route uses the shared policy instead of a flat 150KB check", () => {
    const route = stripComments(
      readFileSync(
        join(ROOT, "apps/admin/app/api/dev-zone/optimize-images/route.ts"),
        "utf8",
      ),
    );
    expect(route).toMatch(/from\s+["']@\/lib\/admin\/image-optimizer-policy["']/);
    expect(route).toMatch(/isImageOptimized\s*\(/);
    expect(route).toMatch(/canOptimizeImage\s*\(/);
    // Reason: the old literal is what kept healthy Featured WebPs in the queue forever.
    expect(route).not.toMatch(/150\s*\*\s*1024/);
  });
});

describe("artwork retarget covers gallery URLs", () => {
  it("rewrites gallery[].url as well as scalar artwork fields", () => {
    const code = stripComments(
      readFileSync(
        join(ROOT, "apps/admin/lib/admin/image-optimizer-artwork.ts"),
        "utf8",
      ),
    );
    expect(code).toMatch(/rewriteGalleryUrls/);
    expect(code).toMatch(/gallery\.url/);
    expect(code).toMatch(/\$map/);
  });
});
