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
    expect(code).toMatch(/practice-history__list/);
    expect(code).toMatch(/VIEWPORT_MAX|practice-history__viewport/);
  });

  it("slides with arrows and mouse drag, never a native scrollbar", () => {
    // Reason (8 Oct 2026, owner): native scrollbar looked wrong on the HUD; drag + arrows.
    const code = read("components/games/PracticeRecentList.tsx");
    const css = read("components/games/practice-area.css");
    expect(code).toMatch(/practice-history__arrow/);
    expect(code).toMatch(/ChevronUp/);
    expect(code).toMatch(/ChevronDown/);
    expect(code).toMatch(/onPointerDown/);
    expect(code).toMatch(/pointermove/);
    expect(code).toMatch(/translateY/);
    expect(code).not.toMatch(/overflow-y:\s*auto|overflow-y-auto/);
    expect(css).toMatch(/\.practice-history__viewport[\s\S]*?overflow:\s*hidden/);
    expect(css).not.toMatch(/practice-history__list[\s\S]*?overflow-y:\s*auto/);
  });
});

describe("practice area matches the cyber HUD lobby", () => {
  it("uses rounded glass panels without clip-path cutoffs", () => {
    const page = read("app/(root)/games/[slug]/practice/page.tsx");
    const host = read("components/games/PracticeRoundHost.tsx");
    const css = read("components/games/practice-area.css");
    expect(page).toContain("practice-page");
    expect(page).not.toMatch(/DashboardBackdrop/);
    expect(page).not.toMatch(/NEON_PANEL_LIT/);
    expect(host).toMatch(/practice-hero/);
    expect(host).toMatch(/practice-features/);
    expect(host).toMatch(/practice-cta/);
    expect(css).toContain("practice-background.png");
    expect(css).toMatch(/border-radius:\s*22px/);
    expect(css).toMatch(/grid-template-columns:\s*repeat\(4/);
    expect(css).not.toMatch(/NEON_PANEL/);
    // Reason: chamfered clip-path cards read as cut-off boxes on the live build.
    expect(css).not.toMatch(/clip-path\s*:/);
  });

  it("keeps four pill badges and a custom Start Practice CTA", () => {
    const host = read("components/games/PracticeRoundHost.tsx");
    const css = read("components/games/practice-area.css");
    expect(host).toContain("Solo Mode");
    expect(host).toContain("Free to Play");
    expect(host).toContain("No Ranking Impact");
    expect(host).toContain("Unlimited Practice");
    expect(host).toMatch(/Start practice/);
    expect(host).toMatch(/practice-feature__glyph/);
    expect(host).toMatch(/UserRound/);
    expect(host).toMatch(/Gift/);
    expect(host).toMatch(/ChartNoAxesColumn/);
    expect(host).toMatch(/InfinityIcon/);
    expect(host).not.toMatch(/badge-solo\.png|badge-gift\.png|badge-rank\.png/);
    expect(css).toMatch(/\.practice-feature[\s\S]*?border-radius:\s*999px/);
    expect(host).toMatch(/practice-cta-wrap/);
  });
});

describe("Volt Stack practice result offers a way back", () => {
  it("shows Back to practice beside Play Again and finishes before exit", () => {
    // Reason (8 Oct 2026, owner): result panel had Retry/Play Again only; exit-before-finished
    // voided practice scores so history showed Ended / "-".
    const html = read("games-service/public/play/volt-stack/index.html");
    const shell = read("games-service/public/play/volt-stack/shell.js");
    const host = read("games-service/public/play/volt-stack/chartvolt-host.js");
    expect(html).toContain('id="backToPracticeBtn"');
    expect(html).toContain("Back to practice");
    expect(shell).toMatch(/backToPracticeBtn/);
    expect(host).toMatch(/tellPlatform\(\s*["']finished["']\s*\)/);
    expect(host).toMatch(/setTimeout\(\s*\(\)\s*=>\s*tellPlatform\(\s*["']exit["']\s*\)/);
    expect(host).toMatch(/\/play\/api\/leave/);
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
    const velocityPage = read("games-service/public/play/volt-velocity/index.html");
    expect(velocityPage).toContain('id="loadbar"');
    expect(velocityPage).toContain("@keyframes vv-load");
    // Reason (8 Oct 2026): idle lobby is a centered HUD (~1180px); hangar width lives on the
    // playing-phase stage so Start Practice no longer stretches flat dashboard panels.
    const practiceHost = read("components/games/PracticeRoundHost.tsx");
    expect(practiceHost).toContain("88rem");
    expect(practiceHost).toMatch(/phase\.name === ["']playing["']/);
    const page = read("app/(root)/games/[slug]/practice/page.tsx");
    expect(page).toContain("practice-page");
    expect(page).not.toMatch(/DashboardBackdrop/);
    expect(page).not.toMatch(/max-w-5xl/);
  });

  it("keeps mute/pause/settings clear of the ship panel in fullscreen", () => {
    // Reason (6 Oct 2026, owner): large viewports scaled action buttons to 68px while
    // hangar padding stayed 88px, so they overlapped VANGUARD.
    const hangar = read("velocity-server/client-patches/root/chartvolt.css");
    const packed = read("games-service/vendor/volt-velocity/client.html");
    for (const source of [hangar, packed]) {
      expect(source).toMatch(/--cv-hangar-top/);
      expect(source).toMatch(/data-state=hangar\]\s*header\s*\.actions\s*button/);
      expect(source).not.toMatch(/padding:88px 28px 18px/);
    }
  });
});
