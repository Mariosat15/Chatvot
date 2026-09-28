import { describe, it, expect } from "vitest";
import {
  applyChallengeValues,
  parseConfigSchema,
} from "@/lib/services/games/config-schema";
import { resolveChallengeDefaults } from "@/lib/services/games/challenge-defaults";

/**
 * `challengeValue` - requirements HTML 1.22. A title may declare, per setting, the value it ALWAYS
 * takes in a 1v1 challenge (Volt Velocity: `laps` is 3 in every challenge, 1-10 in a competition).
 *
 * The keyword is generic on purpose: the platform learns "this setting is fixed in a challenge"
 * from the schema and never from a game code, the same way it learns the play clock from
 * `format: "duration-seconds"`. Three halves are pinned here: the parser accepts only a value the
 * field itself would accept (failing closed otherwise, like every other keyword), the server pins
 * it whatever the player sent, and the challenge form's defaults open on it - so the form never
 * shows a value the server is about to replace.
 */

const lapsSchema = (challengeValue: unknown) => ({
  type: "object",
  properties: {
    laps: { type: "integer", minimum: 1, maximum: 10, default: 3, challengeValue },
  },
});

describe("challengeValue in a title's configSchema", () => {
  it("is parsed onto the field when it is a valid value for it", () => {
    const parsed = parseConfigSchema(lapsSchema(3));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("unreachable");
    expect(parsed.fields[0].challengeValue).toBe(3);
  });

  it.each([
    ["out of range", 11],
    ["the wrong type", "3"],
    ["not an integer", 2.5],
  ])("refuses the whole schema when the pinned value is %s", (_label, value) => {
    const parsed = parseConfigSchema(lapsSchema(value));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error("unreachable");
    expect(parsed.error).toContain("challengeValue");
  });

  it("an absent challengeValue leaves the field free, exactly as before 1.22", () => {
    const parsed = parseConfigSchema({
      type: "object",
      properties: { laps: { type: "integer", minimum: 1, maximum: 10, default: 3 } },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("unreachable");
    expect(parsed.fields[0].challengeValue).toBeUndefined();
    expect(applyChallengeValues(parsed.fields, { laps: 7 })).toEqual({ laps: 7 });
  });

  it("the server pins the value whatever the player sent, without touching other settings", () => {
    const parsed = parseConfigSchema({
      type: "object",
      properties: {
        laps: { type: "integer", minimum: 1, maximum: 10, default: 3, challengeValue: 3 },
        trackId: { type: "string", enum: ["auto", "a"], default: "auto" },
      },
    });
    if (!parsed.ok) throw new Error(parsed.error);
    const input = { laps: 9, trackId: "a" };
    expect(applyChallengeValues(parsed.fields, input)).toEqual({ laps: 3, trackId: "a" });
    expect(input.laps).toBe(9);
  });

  it("the challenge form's defaults open on the pinned value, even over a stored answer", () => {
    const parsed = parseConfigSchema(lapsSchema(3));
    if (!parsed.ok) throw new Error(parsed.error);
    const resolved = resolveChallengeDefaults({
      fields: parsed.fields,
      stored: { durationMinutes: 30, settings: { laps: 8 } },
      bounds: { minMinutes: 5, maxMinutes: 120 },
      fallbackMinutes: 30,
    });
    expect(resolved.settings.laps).toBe(3);
  });
});
