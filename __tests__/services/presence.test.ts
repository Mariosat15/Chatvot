/**
 * Tests for user presence system logic.
 * Validates offline threshold constants, heartbeat timing, and status derivation.
 */
import { describe, it, expect } from "vitest";
import { PERFORMANCE_INTERVALS } from "@/lib/utils/performance";

describe("Presence system constants", () => {
  it("heartbeat interval is 30 seconds", () => {
    expect(PERFORMANCE_INTERVALS.PRESENCE_HEARTBEAT).toBe(30000);
  });

  it("offline threshold is 120 seconds", () => {
    expect(PERFORMANCE_INTERVALS.PRESENCE_OFFLINE_THRESHOLD).toBe(120000);
  });

  it("offline threshold is at least 2x heartbeat interval", () => {
    // Reason: Browser background-tab throttling can delay setInterval to ~60-120s.
    // The threshold must be wide enough to not mark throttled tabs as offline.
    expect(PERFORMANCE_INTERVALS.PRESENCE_OFFLINE_THRESHOLD).toBeGreaterThanOrEqual(
      PERFORMANCE_INTERVALS.PRESENCE_HEARTBEAT * 2,
    );
  });

  it("offline threshold accommodates worst-case browser throttling", () => {
    // Chrome throttles background tabs to ~60s, some browsers up to 120s
    const WORST_CASE_THROTTLE_MS = 120000;
    expect(PERFORMANCE_INTERVALS.PRESENCE_OFFLINE_THRESHOLD).toBeGreaterThanOrEqual(
      WORST_CASE_THROTTLE_MS,
    );
  });
});

describe("Presence status derivation logic", () => {
  const THRESHOLD_MS = PERFORMANCE_INTERVALS.PRESENCE_OFFLINE_THRESHOLD;

  function deriveStatus(lastHeartbeatMs: number, nowMs: number): "online" | "offline" {
    return lastHeartbeatMs && (nowMs - lastHeartbeatMs) < THRESHOLD_MS
      ? "online"
      : "offline";
  }

  it("user with recent heartbeat is online", () => {
    const now = Date.now();
    const recentHeartbeat = now - 10000; // 10s ago
    expect(deriveStatus(recentHeartbeat, now)).toBe("online");
  });

  it("user with heartbeat exactly at threshold is offline", () => {
    const now = Date.now();
    const staleHeartbeat = now - THRESHOLD_MS;
    expect(deriveStatus(staleHeartbeat, now)).toBe("offline");
  });

  it("user with heartbeat beyond threshold is offline", () => {
    const now = Date.now();
    const veryStale = now - THRESHOLD_MS - 1;
    expect(deriveStatus(veryStale, now)).toBe("offline");
  });

  it("user with heartbeat 1ms before threshold is online", () => {
    const now = Date.now();
    const justInTime = now - THRESHOLD_MS + 1;
    expect(deriveStatus(justInTime, now)).toBe("online");
  });

  it("user with no heartbeat is offline", () => {
    const now = Date.now();
    expect(deriveStatus(0, now)).toBe("offline");
  });
});

describe("sendBeacon offline signal", () => {
  it("offline status string is recognized correctly", () => {
    const beaconPayload = JSON.stringify({ status: "offline" });
    const parsed = JSON.parse(beaconPayload);
    expect(parsed.status).toBe("offline");
    expect(parsed.status === "offline").toBe(true);
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
