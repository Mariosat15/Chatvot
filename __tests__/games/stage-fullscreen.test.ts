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
});
