/**
 * Presence API surface — client responses must never include connection forensics.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("Presence GET security surface", () => {
  const route = stripComments(
    readFileSync(join(ROOT, "app/api/user/presence/route.ts"), "utf8"),
  );

  it("batch and list selects omit ipAddress and userAgent", () => {
    // Reason: presence POST stores IP for admin live-ops; player GET must not echo it.
    const getStart = route.indexOf("export async function GET");
    const postStart = route.indexOf("export async function POST");
    const getFn = route.slice(getStart, postStart);
    const postFn = route.slice(postStart);
    expect(getFn).toMatch(/\.select\(/);
    expect(getFn).not.toMatch(/ipAddress/);
    expect(getFn).not.toMatch(/userAgent/);
    expect(postFn).toMatch(/ipAddress/);
  });

  it("caps online list and batch userIds", () => {
    expect(route).toMatch(/\.limit\(\s*100\s*\)/);
    expect(route).toMatch(/\.slice\(\s*0\s*,\s*20\s*\)/);
  });
});

describe("Dashboard live-stats does not log wallet figures", () => {
  it("omits console.log of balances and competition counts", () => {
    const src = stripComments(
      readFileSync(join(ROOT, "app/api/dashboard/live-stats/route.ts"), "utf8"),
    );
    expect(src).not.toMatch(/console\.log/);
    expect(src).toMatch(/getSession/);
  });
});
