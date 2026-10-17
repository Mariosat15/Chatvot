/**
 * Provider contest schedule is UTC wall-clock, matching the trading wizard.
 *
 * The previous `datetime-local` control painted as 12-hour AM/PM with no zone. An
 * operator who set start 23:56 and end 12:10 on the same calendar day got a play window
 * of zero seconds and "must end after it starts" on Launch — correct arithmetic on the
 * wrong times. These tests pin the conversion and the defaults, not the React tree.
 */

import { describe, it, expect } from "vitest";
import {
  defaultUpcomingUtcWindow,
  isoToUtcDraft,
  toRequestBody,
  emptyDraft,
  type ContestDraft,
} from "../../apps/admin/components/admin/games/contest-draft";
import {
  joinUtcDraft,
  splitUtcDraft,
} from "../../apps/admin/components/admin/games/UtcScheduleFields";

function draftWith(overrides: Partial<ContestDraft> = {}): ContestDraft {
  return {
    ...emptyDraft,
    providerKey: "chartvolt",
    gameCode: "circuit-sprint",
    name: "UTC contest",
    startTime: "2026-09-20T09:00",
    endTime: "2026-09-20T10:00",
    ...overrides,
  };
}

describe("utc draft conversion", () => {
  it("treats the draft string as UTC, not the browser zone", () => {
    const body = toRequestBody(draftWith());
    expect(body.startTime).toBe("2026-09-20T09:00:00.000Z");
    expect(body.endTime).toBe("2026-09-20T10:00:00.000Z");
    expect(body.playWindowStart).toBe(body.startTime);
    expect(body.playWindowEnd).toBe(body.endTime);
  });

  it("round-trips a stored ISO through UTC getters", () => {
    // A UTC+3 operator must see 09:00, not 12:00, or the next untouched save moves the gun.
    expect(isoToUtcDraft("2026-09-20T09:00:00.000Z")).toBe("2026-09-20T09:00");
    expect(isoToUtcDraft(new Date("2026-09-20T21:30:00.000Z"))).toBe(
      "2026-09-20T21:30",
    );
  });

  it("seeds an upcoming one-hour window in UTC", () => {
    const now = new Date("2026-09-20T08:00:00.000Z");
    const window = defaultUpcomingUtcWindow(now);
    expect(window.startTime).toBe("2026-09-20T09:00");
    expect(window.endTime).toBe("2026-09-20T10:00");
    const body = toRequestBody(draftWith(window));
    expect(
      new Date(body.endTime as string).getTime() -
        new Date(body.startTime as string).getTime(),
    ).toBe(60 * 60 * 1000);
  });
});

describe("utc schedule field helpers", () => {
  it("splits and joins without inventing a zone", () => {
    expect(splitUtcDraft("2026-09-20T14:05")).toEqual({
      date: "2026-09-20",
      time: "14:05",
    });
    expect(joinUtcDraft("2026-09-20", "14:05")).toBe("2026-09-20T14:05");
    expect(joinUtcDraft("", "14:05")).toBe("");
  });
});
