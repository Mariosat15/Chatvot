import { describe, it, expect } from "vitest";
import {
  roundCloseRemainingMs,
  serverDeadlineCutsRoundShort,
} from "../../components/games/round-close-time";

/**
 * "Round closes in" must read the same digits as the game's own timer once the game reports
 * it, and must never be pushed LATER than the server's deadline by an untrusted frame.
 */
describe("round close countdown", () => {
  const serverNowMs = 1_000_000;
  const expiresAtMs = serverNowMs + 420_000; // 7:00 including the server's headroom

  it("counts to expiresAt until the game reports its clock", () => {
    expect(
      roundCloseRemainingMs({ expiresAtMs, serverNowMs, gameEndsAtMs: null, browserNowMs: 5 }),
    ).toBe(420_000);
  });

  it("follows the game's clock on the browser's time, rounded up like the game", () => {
    const browserNowMs = 50_000;
    // The game shows ceil(299.4s) = 5:00.
    expect(
      roundCloseRemainingMs({
        expiresAtMs,
        serverNowMs,
        gameEndsAtMs: browserNowMs + 299_400,
        browserNowMs,
      }),
    ).toBe(300_000);
  });

  it("never lets a frame push the panel past the server's deadline", () => {
    expect(
      roundCloseRemainingMs({
        expiresAtMs,
        serverNowMs,
        gameEndsAtMs: 10 * 3_600_000,
        browserNowMs: 0,
      }),
    ).toBe(420_000);
  });

  it("shows nothing once either clock has run out, or with no deadline at all", () => {
    expect(
      roundCloseRemainingMs({ expiresAtMs, serverNowMs, gameEndsAtMs: 10, browserNowMs: 20 }),
    ).toBeNull();
    expect(
      roundCloseRemainingMs({ expiresAtMs: Number.NaN, serverNowMs, browserNowMs: 0 }),
    ).toBeNull();
  });
});

/**
 * Owner, 15 Oct 2026: the Round time tile read the competition's 13:12 on the resume screen.
 * Without the game's clock, the server deadline (capped at the competition end) may only be
 * counted when it leaves less than a whole round.
 */
describe("when the tile may count to the server deadline", () => {
  it("does not while the competition outlasts a full round", () => {
    expect(serverDeadlineCutsRoundShort(13 * 60_000, 300)).toBe(false);
  });

  it("does once the competition ends before a full round could", () => {
    expect(serverDeadlineCutsRoundShort(120_000, 300)).toBe(true);
  });

  it("never does when the round length is unknown", () => {
    expect(serverDeadlineCutsRoundShort(10_000, null)).toBe(false);
    expect(serverDeadlineCutsRoundShort(10_000, Number.NaN)).toBe(false);
  });
});

it("the host remembers the game's clock per round and reads it back for the resume screen", async () => {
  const { readFileSync } = await import("fs");
  const host = readFileSync("components/games/ProviderRoundHost.tsx", "utf8");
  expect(host).toMatch(/rememberGameClock\(phase\.roundId,\s*endsAtMs\)/);
  expect(host).toMatch(/recallGameClock\(clockRoundId\)/);
});
