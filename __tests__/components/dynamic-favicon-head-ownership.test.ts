import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Reason (15 Oct 2026): app/layout.tsx renders the icon <link>s from
// generateMetadata, so React owns them. DynamicFavicon used to remove every
// link[rel*='icon'] — the next client navigation then crashed committing the
// head and every link needed a second press. It may only touch its own link.
function readCode(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("DynamicFavicon never removes React-owned head links", () => {
  const code = readCode("components/DynamicFavicon.tsx");

  it("does not remove or replace any node", () => {
    expect(code).not.toMatch(/\.remove\(\)/);
    expect(code).not.toMatch(/removeChild|replaceWith|replaceChild/);
  });

  it("only queries its own tagged link, never every icon link", () => {
    expect(code).not.toMatch(/querySelectorAll\(\s*["'`]link\[rel/);
    expect(code).toMatch(/querySelector<HTMLLinkElement>\(\s*`link\[\$\{OWN_LINK_ATTR\}\]`/);
  });

  it("the root layout still serves the icon in the first HTML", () => {
    expect(readCode("app/layout.tsx")).toMatch(/icons:\s*\{/);
  });
});
