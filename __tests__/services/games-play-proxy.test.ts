/**
 * The rewrites that put the first-party game provider's play surface on this app's origin.
 *
 * WHY THESE NEED A TEST AT ALL
 * ----------------------------
 * Three of the four properties below fail INVISIBLY, and all three produce the same symptom: a
 * blank frame in the player's browser with nothing in any server log.
 *
 *   - Mount the page anywhere but `/play` and its stylesheet and scripts 404, because the
 *     service's own HTML references them absolutely.
 *   - Let `/play/:path*` match before the artwork rule and every thumbnail 404s.
 *   - Claim `/assets/` and this app's existing `public/assets` directory is shadowed for any
 *     missing file and shadows the game for any present one.
 *
 * None of them throws, and none is visible in a build. A test that reads the config is the only
 * cheap place to catch them.
 *
 * WHY IT ASSERTS THE ORDER AND NOT JUST THE CONTENTS
 * -------------------------------------------------
 * Next.js matches rewrites in order, first match wins. A reordering that looks like tidying -
 * grouping the two `/play` rules together, say - silently breaks artwork while every rule is
 * still present and correct in isolation. Contents alone cannot see that.
 */

import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

/** The three rules, resolved. `rewrites` is a function, so it has to be called. */
async function loadRewrites(): Promise<{ source: string; destination: string }[]> {
  const { rewrites } = nextConfig;
  expect(typeof rewrites).toBe("function");

  const resolved = await (rewrites as () => Promise<unknown>)();
  // Reason for asserting the ARRAY form specifically: Next.js treats a bare array as
  // `afterFiles`, so real pages and `public/` files are matched first and always win. The
  // object form with `beforeFiles` would invert that and let these rules override live routes.
  expect(Array.isArray(resolved)).toBe(true);
  return resolved as { source: string; destination: string }[];
}

describe("the game provider play-surface rewrites", () => {
  it("serves the play page at /play, because the service's HTML uses absolute asset paths", async () => {
    const rules = await loadRewrites();
    const page = rules.find((rule) => rule.source === "/play");

    expect(page, "the launch URL points at /play; moving it blanks the frame").toBeTruthy();
    expect(page?.destination).toMatch(/\/play$/);
  });

  it("covers the assets and the four /play/api/* calls the board makes", async () => {
    const rules = await loadRewrites();
    const wildcard = rules.find((rule) => rule.source === "/play/:path*");

    // Without this the page loads and then cannot fetch its own state or submit a solution -
    // the board renders and the Submit button does nothing.
    expect(wildcard).toBeTruthy();
    expect(wildcard?.destination).toContain("/play/:path*");
  });

  it("matches artwork BEFORE the /play wildcard, or every thumbnail 404s", async () => {
    const rules = await loadRewrites();
    const artwork = rules.findIndex((rule) => rule.source.startsWith("/play/assets/"));
    const wildcard = rules.findIndex((rule) => rule.source === "/play/:path*");

    expect(artwork).toBeGreaterThanOrEqual(0);
    expect(wildcard).toBeGreaterThanOrEqual(0);
    // Reason this is an ordering assertion and not a contents one: rewrites match in order, so
    // `/play/:path*` placed first swallows `/play/assets/...` and forwards it to a path the
    // service does not serve. Both rules remain present and individually correct.
    expect(
      artwork,
      "the artwork rule must precede the /play wildcard that would otherwise swallow it",
    ).toBeLessThan(wildcard);
  });

  it("strips the /play prefix off artwork, because the service serves it at /assets", async () => {
    const rules = await loadRewrites();
    const artwork = rules.find((rule) => rule.source.startsWith("/play/assets/"));

    // The prefix exists only to avoid this app's `public/assets`; the service knows nothing
    // about it. Forwarding it unchanged would ask for /play/assets/... upstream, which 404s.
    expect(artwork?.destination).toContain("/assets/:gameCode/:asset");
    expect(artwork?.destination).not.toContain("/play/assets");
  });

  it("never claims the bare /assets prefix, which this app already owns", async () => {
    const rules = await loadRewrites();

    // `public/assets` exists in this repository. A rewrite on `/assets/:path*` would be shadowed
    // by it for any file that exists and would shadow the game for any that does not - a
    // half-working prefix, which is worse than either outcome on its own.
    for (const rule of rules) {
      expect(
        rule.source.startsWith("/assets"),
        `rewrite "${rule.source}" claims /assets, which public/assets already owns`,
      ).toBe(false);
    }
  });

  it("proxies over loopback, so provider API traffic never leaves the machine", async () => {
    const rules = await loadRewrites();

    // The player reaches the game through this origin; the platform reaches the provider's API
    // directly. Both stay on the local interface, which is why no firewall or DNS change is
    // needed to run the first-party provider.
    //
    // Parsed rather than pattern-matched: a regex covering an optional port after a host
    // alternation is the shape ESLint flags as catastrophically backtrackable, and `URL` answers
    // the question exactly instead of approximately.
    for (const rule of rules) {
      expect(["127.0.0.1", "localhost", "[::1]", "::1"]).toContain(
        new URL(rule.destination).hostname,
      );
    }
  });

  it("takes the upstream from one place, so the port cannot drift between rules", async () => {
    const rules = await loadRewrites();
    const origins = new Set(rules.map((rule) => new URL(rule.destination).origin));

    // Three rules with two ports is a configuration where the page loads from a live service and
    // its scripts from a dead one. One shared constant is the fix; this pins it.
    expect(origins.size).toBe(1);
  });
});
