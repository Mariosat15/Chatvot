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
  });

  it("pulls the score on finished and keeps the iframe open until exit", () => {
    // Reason: voiding on finished tore the Circuit result screen down before the player
    // could read it, and wiped the score from the recent list (owner, 6 Oct 2026).
    const code = read("components/games/PracticeRoundHost.tsx");
    expect(code).toMatch(/method:\s*["']PATCH["']/);
    expect(code).toMatch(/scoredRoundId/);
    expect(code).toMatch(/finishingRoundId/);
    expect(code).toMatch(/FINISH_PULL_ATTEMPTS/);
    expect(code).toMatch(/onFinished=\{\(\)\s*=>\s*void handleFinished/);
    expect(code).toMatch(/onExit=\{\(\)\s*=>\s*handleExit/);
  });

  it("does not void a practice round while the finish pull is still running", () => {
    // Reason: Velocity posts exit ~1s after finished; voiding mid-pull left Ended/- rows
    // after a refresh (owner, 6 Oct 2026).
    const code = read("components/games/PracticeRoundHost.tsx");
    expect(code).toMatch(/finishingRoundId\.current === id/);
    expect(code).toMatch(/stillFinishing/);
    expect(code).toMatch(/goIdleAfterResult/);
  });
});

describe("Volt Velocity hands practice back after the race", () => {
  it("posts exit after finished and offers a Close control", () => {
    // Reason: practice kept the host iframe; without exit the player sat on
    // "Race complete. Your result is being confirmed." forever.
    const host = read("games-service/public/play/volt-velocity/velocity-host.js");
    const page = read("games-service/public/play/volt-velocity/index.html");
    expect(host).toMatch(/scheduleHandBack/);
    expect(host).toMatch(/handBackToPlatform/);
    expect(host).toMatch(/tellPlatform\(\s*["']exit["']\s*\)/);
    expect(host).toMatch(/HANDOFF_MS/);
    expect(page).toContain('id="close"');
    expect(page).toContain("velocity-host.js?v=20261006e");
  });
});

describe("practice recent list shows scores with delete controls", () => {
  it("renders scores through formatGameScore and offers clear-all", () => {
    const code = read("components/games/PracticeRecentList.tsx");
    expect(code).toMatch(/formatGameScore/);
    expect(code).toMatch(/Clear all/);
    expect(code).toMatch(/onForget/);
  });
});

describe("Round Inspector ends practice in place", () => {
  it("passes isPractice from the row's contestType", () => {
    const code = read("apps/admin/components/admin/games/RoundInspectorSection.tsx");
    expect(code).toMatch(/isPractice=\{round\.contestType === ["']practice["']\}/);
    expect(code).toMatch(/practice/);
  });
});

describe("Volt Velocity practice hangar is not squeezed", () => {
  it("lays ships in two rows of four and shows a host load bar", () => {
    // Reason (6 Oct 2026, owner): eight 1fr columns clipped ship names; load copy
    // had no bar so waiting looked stuck.
    const hangar = read("velocity-server/client-patches/root/chartvolt.css");
    expect(hangar).toMatch(
      /\.ship-picker\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/,
    );
    expect(hangar).not.toMatch(
      /\.ship-picker\{[^}]*grid-template-columns:repeat\(8,minmax\(0,1fr\)\)/,
    );
    const host = read("games-service/public/play/volt-velocity/index.html");
    expect(host).toContain('id="loadbar"');
    expect(host).toContain("@keyframes vv-load");
    const page = read("app/(root)/games/[slug]/practice/page.tsx");
    expect(page).toContain("88rem");
    expect(page).not.toMatch(/max-w-5xl/);
  });
});
