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
  PROVIDER_OBSERVED_DOWN_FILTER,
  providerBlocksEntries,
  providerKeyFromContest,
  providerObservedDown,
  shouldHideUpcomingEmptyDuringOutage,
} from "../../lib/services/game-providers/provider-entry-gate";

const ROOT = process.cwd();

function readCode(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const DOWN_SINCE = new Date("2026-09-20T09:00:00.000Z");

describe("providerBlocksEntries", () => {
  it("blocks an observed-down provider and a disabled one, admits healthy and degraded", () => {
    expect(
      providerBlocksEntries({
        enabled: true,
        healthStatus: "down",
        healthDownSince: DOWN_SINCE,
      }),
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
    // Reason: missing provider → fail closed (cannot verify health). Unlike the
    // default-status case below, that is recoverable: register the provider.
    expect(providerBlocksEntries(null)).toBe(true);
  });

  /**
   * THE DEFECT THIS PINS (R111, 20 Sep 2026). `healthStatus` defaults to
   * `"down"` and the kill-switch worker passes the previous status through on
   * `no_evidence`, so a provider that has never produced a scored round keeps
   * the default for ever. Reading the status alone refused every entry, which
   * stopped the first round being created, which is what would have produced
   * the evidence — a deadlock no operator could break from inside the product.
   *
   * This assertion was FLIPPED, not added: the original test above asserted
   * that `{ enabled: true, healthStatus: "down" }` blocks.
   */
  it("admits entry to a provider that has never been health checked", () => {
    expect(
      providerBlocksEntries({ enabled: true, healthStatus: "down" }),
    ).toBe(false);
    expect(
      providerBlocksEntries({
        enabled: true,
        healthStatus: "down",
        healthDownSince: null,
      }),
    ).toBe(false);
  });
});

describe("providerObservedDown", () => {
  it("requires the stamp as well as the status", () => {
    expect(
      providerObservedDown({
        healthStatus: "down",
        healthDownSince: DOWN_SINCE,
      }),
    ).toBe(true);
    expect(providerObservedDown({ healthStatus: "down" })).toBe(false);
    // Reason: a stamp left behind on a recovered provider must not block. The
    // worker `$unset`s it, but the status is the authority on direction.
    expect(
      providerObservedDown({
        healthStatus: "healthy",
        healthDownSince: DOWN_SINCE,
      }),
    ).toBe(false);
  });

  it("the query form matches both shapes of an unstamped field in one clause", () => {
    // Reason: absent and explicitly null are the two shapes an unstamped date
    // takes, and `$type: "date"` excludes both. A `$ne: null` spelling would
    // admit an absent field on some driver versions.
    expect(PROVIDER_OBSERVED_DOWN_FILTER).toEqual({
      healthStatus: "down",
      healthDownSince: { $type: "date" },
    });
  });

  it("both readers of the stored status go through the shared rule", () => {
    const gate = readCode(
      "lib/services/game-providers/provider-entry-gate.ts",
    );
    const pause = readCode(
      "lib/services/game-providers/provider-outage-pause.service.ts",
    );
    // The bare status query is what R111 was: neither file may carry one.
    // Reason: the gate's own delegation is asserted BEHAVIOURALLY above rather
    // than here — a `toContain("providerObservedDown(")` is satisfied by the
    // function's own declaration, so it would pass against a gate that defines
    // the rule and then tests the raw status itself.
    expect(gate).not.toMatch(/\{\s*healthStatus:\s*"down"\s*\}/);
    expect(pause).not.toMatch(/\{\s*healthStatus:\s*"down"\s*\}/);
    expect(pause).toContain("PROVIDER_OBSERVED_DOWN_FILTER");
    // The single-provider read must project the stamp, or the predicate can
    // only ever answer "not down" and the gate stops working entirely.
    expect(gate).toMatch(
      /\.select\("enabled healthStatus healthDownSince"\)/,
    );
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
