import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toAbsoluteAssetUrl } from "@/lib/admin/images";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

/**
 * Owner, 15 Oct 2026: Google shows a grey globe because the favicon was only
 * injected by client JS. Brand Icon (WhiteLabel.favicon) must appear in the
 * first HTML via generateMetadata so crawlers and white-labels both work.
 */
describe("branding favicon reaches the first HTML", () => {
  it("generateMetadata sets icons from the white-label Brand Icon", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain("getFaviconAbsolute");
    expect(layout).toContain("icons:");
    expect(layout).toContain("shortcut:");
    expect(layout).toContain("apple:");
    // Reason: og:image is the share card — must not be the only image path.
    expect(layout).toContain("ogImageUrl");
  });

  it("admin Brand Icon card names Google and white-label", () => {
    const section = read("apps/admin/components/admin/ImagesSection.tsx");
    expect(section).toContain('field="favicon"');
    expect(section).toMatch(/Google/i);
    expect(section).toMatch(/white-label/i);
    expect(section).toMatch(/og:image/i);
  });

  it("toAbsoluteAssetUrl keeps http(s) and joins relative paths", () => {
    expect(
      toAbsoluteAssetUrl(
        "https://cdn.example.com/a.png",
        "https://chartvolt.com",
      ),
    ).toBe("https://cdn.example.com/a.png");
    expect(
      toAbsoluteAssetUrl("/assets/images/brand-icon.jpg", "https://chartvolt.com/"),
    ).toBe("https://chartvolt.com/assets/images/brand-icon.jpg");
    expect(toAbsoluteAssetUrl("assets/x.png", "https://tenant.example")).toBe(
      "https://tenant.example/assets/x.png",
    );
  });
});
