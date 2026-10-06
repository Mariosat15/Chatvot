import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Practice rounds must close when the player leaves, and stuck ones must be endable from
 * Round Inspector without raising an incident.
 */

function strip(raw: string): string {
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(relative: string): string {
  return strip(readFileSync(join(process.cwd(), relative), "utf8"));
}

describe("practice rounds end when the player leaves", () => {
  it("listens for pagehide and beforeunload, not only React unmount", () => {
    // Reason: React's cleanup does not run when the tab closes or the app is killed.
    // Without pagehide a practice round stays launched until an operator ends it by hand.
    const code = read("components/games/PracticeRoundHost.tsx");
    expect(code).toMatch(/addEventListener\(\s*["']pagehide["']/);
    expect(code).toMatch(/addEventListener\(\s*["']beforeunload["']/);
    expect(code).toMatch(/keepalive:\s*true/);
    expect(code).toMatch(/method:\s*["']DELETE["']/);
    expect(code).not.toMatch(/formatGameScore/);
  });
});

describe("Round Inspector ends practice in place", () => {
  it("passes isPractice from the row's contestType", () => {
    const code = read("apps/admin/components/admin/games/RoundInspectorSection.tsx");
    expect(code).toMatch(/isPractice=\{round\.contestType === ["']practice["']\}/);
    expect(code).toMatch(/practice/);
  });
});
