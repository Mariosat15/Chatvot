import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Full screen control on the game stage (owner, 28 Sep 2026: "that button must be for all
 * games and agnostic").
 *
 * Reason these are structural: the behaviour needs a real browser's Fullscreen API, and what can
 * go wrong silently is WHERE the button is wired - on the iframe (which needs the provider's
 * cooperation), on one game only, or with no fallback for iPhone Safari, which has no element
 * Fullscreen API at all.
 */
const read = (path: string) =>
  readFileSync(resolve(__dirname, "../..", path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const FRAME = "components/games/ProviderGameFrame.tsx";
const HOOK = "components/games/use-stage-fullscreen.ts";

describe("the game stage full screen control", () => {
  it("enlarges the element hosting the frame, never the iframe itself", () => {
    const frame = read(FRAME);
    expect(frame).toMatch(/useStageFullscreen\(stageRef\)/);
    expect(frame).toMatch(/<div\s+ref=\{stageRef\}/);
    expect(frame).not.toMatch(/useStageFullscreen\(frameRef\)/);
  });

  it("is a real button that toggles and reports its state", () => {
    const frame = read(FRAME);
    expect(frame).toMatch(/onClick=\{fullscreen\.toggle\}/);
    expect(frame).toMatch(/aria-pressed=\{fullscreen\.active\}/);
  });

  it("names no game, provider or game-specific control", () => {
    const hook = read(HOOK);
    const bar = read(FRAME);
    for (const source of [hook, bar]) {
      expect(source).not.toMatch(/velocity|circuit|gameCode|providerKey/i);
    }
  });

  it("falls back to a window-sized view where the Fullscreen API is missing or refuses", () => {
    const hook = read(HOOK);
    const enter = hook.slice(hook.indexOf("const enter"), hook.indexOf("const exit"));
    expect(enter.length).toBeGreaterThan(50);
    expect(enter).toMatch(/requestFullscreen/);
    expect(enter).toMatch(/setPseudo\(true\)/);
    expect(enter.indexOf("setPseudo(true)")).toBeGreaterThan(enter.indexOf("catch"));
  });

  it("stops the game's own height request pushing the stage past the screen", () => {
    expect(read(FRAME)).toMatch(/minHeight:\s*fullscreen\.active\s*\?\s*0/);
  });

  // Owner, 13 Oct 2026: "We need to see the game in mobile full screen and adjusted correctly".
  it("opens pinned over the whole window on a phone, after mount, and only on a phone", () => {
    const hook = read(HOOK);
    const effect = hook.slice(hook.indexOf("PHONE_STAGE_QUERY).matches"), hook.indexOf("}, []);"));
    expect(effect.length).toBeGreaterThan(20);
    expect(effect).toMatch(/setPseudo\(true\)/);
    // A tablet or touch laptop keeps the in-page stage: the query needs a short side of 500px.
    expect(hook).toMatch(/pointer: coarse\) and \(max-width: 500px\), \(pointer: coarse\) and \(max-height: 500px\)/);
    // Reading the media query during render would disagree with the server render.
    expect(hook).not.toMatch(/useState\(\s*\(\)\s*=>\s*window/);
  });

  // Owner, 13 Oct 2026: "the game must take the whole mobile screen when full screen either
  // portrait or landscape" and "in desktop ... the game takes the full screen" (like F11).
  // Flipped from the landscape-only rule: full screen now shows only the game on every device.
  it("shows only the game in full screen: no bar, no bezel, on every device", () => {
    const frame = read(FRAME);
    expect(frame).toMatch(/fullscreen\.active \? "hidden" : ""/);
    expect(frame).not.toMatch(/landscape:hidden/);
    const pinned = frame.match(/"fixed inset-0 z-\[9999\] h-\[100dvh\] w-\[100dvw\][^"]*"/)?.[0] ?? "";
    expect(pinned).toMatch(/border-0/);
    expect(pinned).toMatch(/\bp-0\b/);
    expect(pinned).not.toMatch(/NEON_STAGE_FRAME|shadow-\[/);
  });

  // Reason (owner, 13 Oct 2026: "it shows half and cant go down to view it"): the compiled CSS
  // emits `.relative` after `.fixed`, so a stage carrying both was never pinned - it sat in the
  // page at full-screen height under a locked scroll. The pinned branch must not carry `relative`.
  it("never puts relative and fixed on the stage together", () => {
    const frame = read(FRAME);
    const stage = frame.slice(frame.indexOf("ref={stageRef}"), frame.indexOf("style={fullscreen.active"));
    expect(stage.length).toBeGreaterThan(50);
    expect(stage).toMatch(/fullscreen\.active\s*\?\s*"fixed inset-0/);
    const pinned = stage.slice(stage.indexOf('"fixed inset-0'), stage.indexOf(":", stage.indexOf('"fixed inset-0')));
    expect(pinned).not.toMatch(/\brelative\b/);
    expect(stage).toMatch(/: `relative flex-1 \$\{NEON_STAGE_FRAME\}`/);
  });
});
