import { describe, it, expect } from "vitest";
import {
  clampFrameHeight,
  frameOriginOf,
  MAX_FRAME_HEIGHT,
  MIN_FRAME_HEIGHT,
  parseProviderFrameMessage,
  PROVIDER_FRAME_MESSAGE_TYPES,
} from "../../components/games/provider-frame-messages";

/**
 * The boundary between a provider's game running in a browser and anything we believe.
 *
 * These are real unit tests rather than the structural source-reading kind used elsewhere for
 * UI, because the functions are pure and the properties are behavioural. Structural tests would
 * assert that a check is *written*; these assert that it *works*, which for the score rule is
 * the difference that matters.
 */

describe("what a provider's game frame is allowed to tell us", () => {
  it("accepts exactly the four agreed message types and nothing else", () => {
    expect(PROVIDER_FRAME_MESSAGE_TYPES).toEqual([
      "ready",
      "finished",
      "exit",
      "resize",
    ]);

    for (const type of PROVIDER_FRAME_MESSAGE_TYPES) {
      expect(parseProviderFrameMessage({ type })?.type).toBe(type);
    }

    // A type we never agreed on is not a partial success - it is dropped entirely.
    expect(parseProviderFrameMessage({ type: "score" })).toBeNull();
    expect(parseProviderFrameMessage({ type: "award_prize" })).toBeNull();
    expect(parseProviderFrameMessage({ type: "round.completed" })).toBeNull();
  });

  /**
   * THE MOST IMPORTANT TEST IN THIS FILE.
   *
   * A `postMessage` is attacker-controlled by construction: the player has a developer console,
   * so anything the game can send, they can send. The provider spec states it to providers as
   * "we will ignore any score arriving from the browser". This proves the parsed message has no
   * route to carry one, whatever the sender attaches.
   */
  it("strips a score off a finished message, however it is spelled", () => {
    const parsed = parseProviderFrameMessage({
      type: "finished",
      score: 999999,
      rawScore: 999999,
      points: 999999,
      prize: 500,
      rank: 1,
      playerId: "someone-else",
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe("finished");

    // Nothing but the type and a height survives. Asserting the whole object rather than a few
    // fields is deliberate: a field we did not think to check is exactly the one that would
    // slip through, which is how the admin credential rotation bug was caught.
    expect(Object.keys(parsed as object).sort()).toEqual(["height", "type"]);
    expect((parsed as Record<string, unknown>).score).toBeUndefined();
  });

  it("rejects prototype-chain keys instead of treating them as message types", () => {
    // `in` and object indexing both walk the prototype chain, so an object-keyed allowlist
    // would let these through - and `ACTIONS["__proto__"]` is truthy, so a `!target` guard does
    // not catch it either. Found the hard way in the admin round inspector on 5 Sep 2026.
    expect(parseProviderFrameMessage({ type: "__proto__" })).toBeNull();
    expect(parseProviderFrameMessage({ type: "toString" })).toBeNull();
    expect(parseProviderFrameMessage({ type: "constructor" })).toBeNull();
    expect(parseProviderFrameMessage({ type: "hasOwnProperty" })).toBeNull();
  });

  it("rejects anything that is not an object with a string type", () => {
    expect(parseProviderFrameMessage(null)).toBeNull();
    expect(parseProviderFrameMessage(undefined)).toBeNull();
    expect(parseProviderFrameMessage("finished")).toBeNull();
    expect(parseProviderFrameMessage(42)).toBeNull();
    expect(parseProviderFrameMessage([])).toBeNull();
    expect(parseProviderFrameMessage({})).toBeNull();
    expect(parseProviderFrameMessage({ type: 7 })).toBeNull();
  });
});

describe("the one number a frame may influence", () => {
  it("clamps a height into a range a page can survive", () => {
    // Reason an upper bound exists: a units mistake produces a request for millions of pixels
    // and hangs the page. It does not need malice.
    expect(clampFrameHeight(10_000_000)).toBe(MAX_FRAME_HEIGHT);
    expect(clampFrameHeight(0)).toBe(MIN_FRAME_HEIGHT);
    expect(clampFrameHeight(-500)).toBe(MIN_FRAME_HEIGHT);
    expect(clampFrameHeight(700)).toBe(700);
    expect(clampFrameHeight(700.6)).toBe(701);
  });

  it("falls back to the minimum for every non-finite height, infinity included", () => {
    // `Number.isFinite` is false for all three, so all three take the same path. That is worth
    // pinning rather than assuming: `Math.min(MAX, Math.max(MIN, Infinity))` would give the
    // maximum, and the guard runs first precisely so garbage input has ONE outcome instead of
    // one per special value.
    //
    // The minimum is the right fallback because 320px is a usable frame, not a collapsed one -
    // the game is visible and the player can see something is there, which is not true of zero.
    expect(clampFrameHeight(Number.NaN)).toBe(MIN_FRAME_HEIGHT);
    expect(clampFrameHeight(Number.POSITIVE_INFINITY)).toBe(MIN_FRAME_HEIGHT);
    expect(clampFrameHeight(Number.NEGATIVE_INFINITY)).toBe(MIN_FRAME_HEIGHT);
  });
});

describe("the origin we will accept messages from", () => {
  it("takes the origin of the launch URL, not its path or query", () => {
    expect(frameOriginOf("https://play.acme.com/launch?t=abc123")).toBe(
      "https://play.acme.com",
    );
    // A different port is a different origin, and the browser agrees, so we must too.
    expect(frameOriginOf("https://play.acme.com:8443/launch")).toBe(
      "https://play.acme.com:8443",
    );
  });

  it("refuses a launch URL that is not absolute http(s)", () => {
    // A URL we cannot turn into an origin is one whose messages we cannot verify, so the caller
    // refuses to render the frame at all rather than hosting an unsupervised game.
    expect(frameOriginOf("javascript:alert(1)")).toBeNull();
    expect(frameOriginOf("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(frameOriginOf("/launch?t=abc")).toBeNull();
    expect(frameOriginOf("")).toBeNull();
    expect(frameOriginOf("not a url")).toBeNull();
  });
});
