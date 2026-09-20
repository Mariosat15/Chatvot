/**
 * X9 leftover — pre-start outage responses (07 s3.2).
 *
 * Pins: refuse new entry while provider is down/disabled; hide empty upcoming
 * from discovery; cancel-at-gun uses the shared cancel reason string.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PROVIDER_OUTAGE_CANCEL_REASON,
  PROVIDER_OUTAGE_ENTRY_MESSAGE,
  providerBlocksEntries,
  providerKeyFromContest,
  shouldHideUpcomingEmptyDuringOutage,
} from "../../lib/services/game-providers/provider-entry-gate";

const ROOT = process.cwd();

function readCode(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("providerBlocksEntries", () => {
  it("blocks down and disabled, admits healthy and degraded", () => {
    expect(
      providerBlocksEntries({ enabled: true, healthStatus: "down" }),
    ).toBe(true);
    expect(
      providerBlocksEntries({ enabled: false, healthStatus: "healthy" }),
    ).toBe(true);
    expect(
      providerBlocksEntries({ enabled: true, healthStatus: "healthy" }),
    ).toBe(false);
    expect(
      providerBlocksEntries({ enabled: true, healthStatus: "degraded" }),
    ).toBe(false);
    // Reason: missing provider → fail closed (cannot verify health).
    expect(providerBlocksEntries(null)).toBe(true);
  });
});

describe("shouldHideUpcomingEmptyDuringOutage", () => {
  const down = new Set(["acme"]);

  it("hides empty upcoming provider contests for a down provider", () => {
    expect(
      shouldHideUpcomingEmptyDuringOutage(
        {
          status: "upcoming",
          gameType: "provider",
          currentParticipants: 0,
          gameConfig: { providerKey: "acme" },
        },
        down,
      ),
    ).toBe(true);
  });

  it("keeps contests that already have seats, are active, or are trading", () => {
    expect(
      shouldHideUpcomingEmptyDuringOutage(
        {
          status: "upcoming",
          gameType: "provider",
          currentParticipants: 3,
          gameConfig: { providerKey: "acme" },
        },
        down,
      ),
    ).toBe(false);
    expect(
      shouldHideUpcomingEmptyDuringOutage(
        {
          status: "active",
          gameType: "provider",
          currentParticipants: 0,
          gameConfig: { providerKey: "acme" },
        },
        down,
      ),
    ).toBe(false);
    expect(
      shouldHideUpcomingEmptyDuringOutage(
        {
          status: "upcoming",
          gameType: "trading",
          currentParticipants: 0,
        },
        down,
      ),
    ).toBe(false);
  });
});

describe("providerKeyFromContest", () => {
  it("returns the key only for labelled provider contests", () => {
    expect(
      providerKeyFromContest({
        gameType: "provider",
        gameConfig: { providerKey: "acme" },
      }),
    ).toBe("acme");
    expect(providerKeyFromContest({ gameType: "trading" })).toBeNull();
    expect(
      providerKeyFromContest({
        gameType: "provider",
        gameConfig: {},
      }),
    ).toBeNull();
  });
});

describe("wiring", () => {
  it("enterContest refuses with provider_unavailable after the seat check", () => {
    const src = readCode("lib/services/contest-entry.service.ts");
    const seatIdx = src.indexOf("alreadyEntered: true");
    // Reason: lastIndexOf — the import also names the helper near the top of the file.
    const gateIdx = src.lastIndexOf("providerBlocksContestEntry(");
    expect(seatIdx).toBeGreaterThan(0);
    expect(gateIdx).toBeGreaterThan(seatIdx);
    expect(src).toContain('fail("provider_unavailable"');
    expect(src).toContain("PROVIDER_OUTAGE_ENTRY_MESSAGE");
  });

  it("join route maps provider_unavailable to 503", () => {
    const src = readCode("app/api/competitions/[id]/join/route.ts");
    expect(src).toMatch(/provider_unavailable:\s*503/);
  });

  it("Inngest start loop and getCompetitionById cancel at gun for outage", () => {
    const inngest = readCode("lib/inngest/functions.ts");
    const byId = readCode("lib/actions/trading/competition.actions.ts");
    expect(inngest).toContain("PROVIDER_OUTAGE_CANCEL_REASON");
    expect(inngest).toContain("providerBlocksContestEntry");
    expect(byId).toContain("PROVIDER_OUTAGE_CANCEL_REASON");
    expect(byId).toContain("providerBlocksContestEntry");
    expect(PROVIDER_OUTAGE_CANCEL_REASON).toMatch(/before play started/i);
    expect(PROVIDER_OUTAGE_ENTRY_MESSAGE).toMatch(/outage/i);
  });

  it("discovery surfaces filter empty upcoming via the shared helper", () => {
    for (const file of [
      "lib/actions/trading/competition.actions.ts",
      "app/api/landing/competitions/route.ts",
      "app/api/dashboard/competitions/route.ts",
    ]) {
      const src = readCode(file);
      expect(src).toContain("shouldHideUpcomingEmptyDuringOutage");
      expect(src).toContain("listProvidersBlockingEntries");
    }
  });
});
