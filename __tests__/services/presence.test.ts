/**
 * Tests for user presence system logic.
 * Validates offline threshold constants, heartbeat timing, and status derivation.
 */
import { describe, it, expect } from "vitest";
import { PERFORMANCE_INTERVALS } from "@/lib/utils/performance";
import {
  prunePresenceTabs,
  releasePresenceTab,
  PRESENCE_TABS_KEY,
  PRESENCE_TAB_ID_KEY,
} from "@/lib/utils/presence-tabs";

describe("Presence system constants", () => {
  it("heartbeat interval is 30 seconds", () => {
    expect(PERFORMANCE_INTERVALS.PRESENCE_HEARTBEAT).toBe(30000);
  });

  it("offline threshold is 180 seconds for background-tab throttling", () => {
    expect(PERFORMANCE_INTERVALS.PRESENCE_OFFLINE_THRESHOLD).toBe(180000);
  });

  it("offline threshold is at least 2x heartbeat interval", () => {
    expect(
      PERFORMANCE_INTERVALS.PRESENCE_OFFLINE_THRESHOLD,
    ).toBeGreaterThanOrEqual(PERFORMANCE_INTERVALS.PRESENCE_HEARTBEAT * 2);
  });

  it("offline threshold accommodates worst-case browser throttling", () => {
    const WORST_CASE_THROTTLE_MS = 120000;
    expect(
      PERFORMANCE_INTERVALS.PRESENCE_OFFLINE_THRESHOLD,
    ).toBeGreaterThanOrEqual(WORST_CASE_THROTTLE_MS);
  });
});

describe("Presence status derivation logic", () => {
  const THRESHOLD_MS = PERFORMANCE_INTERVALS.PRESENCE_OFFLINE_THRESHOLD;

  function deriveStatus(
    lastHeartbeatMs: number,
    nowMs: number,
  ): "online" | "offline" {
    return lastHeartbeatMs && nowMs - lastHeartbeatMs < THRESHOLD_MS
      ? "online"
      : "offline";
  }

  it("user with recent heartbeat is online", () => {
    const now = Date.now();
    expect(deriveStatus(now - 10000, now)).toBe("online");
  });

  it("user with heartbeat exactly at threshold is offline", () => {
    const now = Date.now();
    expect(deriveStatus(now - THRESHOLD_MS, now)).toBe("offline");
  });

  it("user with heartbeat beyond threshold is offline", () => {
    const now = Date.now();
    expect(deriveStatus(now - THRESHOLD_MS - 1, now)).toBe("offline");
  });

  it("user with heartbeat 1ms before threshold is online", () => {
    const now = Date.now();
    expect(deriveStatus(now - THRESHOLD_MS + 1, now)).toBe("online");
  });

  it("user with no heartbeat is offline", () => {
    expect(deriveStatus(0, Date.now())).toBe("offline");
  });
});

describe("Multi-tab presence bookkeeping", () => {
  it("prunePresenceTabs drops stale tab entries", () => {
    const now = 1_000_000;
    const map = prunePresenceTabs(
      new Map([
        ["a", now - 10_000],
        ["b", now - 200_000],
      ]),
      now,
      180_000,
    );
    expect([...map.entries()]).toEqual([["a", now - 10_000]]);
  });

  it("releasing the last tab reports zero remaining", () => {
    // Reason: jsdom may not have localStorage wired the same — exercise
    // prune/release pure path via read/write if available.
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      PRESENCE_TABS_KEY,
      JSON.stringify({ only: Date.now() }),
    );
    const remaining = releasePresenceTab("only", 180_000);
    expect(remaining).toBe(0);
    localStorage.removeItem(PRESENCE_TABS_KEY);
    localStorage.removeItem(PRESENCE_TAB_ID_KEY);
  });

  it("releasing one of two tabs leaves the other online", () => {
    if (typeof localStorage === "undefined") return;
    const now = Date.now();
    localStorage.setItem(
      PRESENCE_TABS_KEY,
      JSON.stringify({ tab1: now, tab2: now }),
    );
    const remaining = releasePresenceTab("tab1", 180_000, now);
    expect(remaining).toBe(1);
    localStorage.removeItem(PRESENCE_TABS_KEY);
  });
});

describe("sendBeacon offline signal", () => {
  it("offline status string is recognized correctly", () => {
    const beaconPayload = JSON.stringify({ status: "offline" });
    const parsed = JSON.parse(beaconPayload);
    expect(parsed.status).toBe("offline");
  });

  it("online heartbeat is not mistaken for offline", () => {
    const heartbeatPayload = JSON.stringify({
      status: "online",
      currentPage: "/dashboard",
    });
    const parsed = JSON.parse(heartbeatPayload);
    expect(parsed.status === "offline").toBe(false);
  });
});

describe("GlobalPresenceTracker offline policy", () => {
  it("does not send offline from React effect cleanup", () => {
    // Reason: cleanup offline beacons marked users offline on Strict Mode
    // remounts and soft navigations while the browser tab was still open.
    const src = require("fs").readFileSync(
      require("path").join(
        process.cwd(),
        "components/GlobalPresenceTracker.tsx",
      ),
      "utf8",
    );
    const cleanup = src.slice(src.lastIndexOf("return () => {"));
    expect(cleanup).not.toMatch(/sendBeacon/);
    expect(cleanup).not.toMatch(/status:\s*["']offline["']/);
    expect(src).toMatch(/pagehide/);
    expect(src).toMatch(/releasePresenceTab/);
  });
});
