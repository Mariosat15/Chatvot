import { describe, it, expect } from "vitest";
import {
  affiliationConversionPercent,
  formatPhoneDisplay,
  formatRelativeActivity,
} from "../../apps/admin/lib/admin/gm-report-display";

describe("affiliationConversionPercent", () => {
  it("is currently affiliated ÷ referred, capped at 100", () => {
    expect(affiliationConversionPercent(100, 42)).toBe(42);
    expect(affiliationConversionPercent(10, 10)).toBe(100);
    expect(affiliationConversionPercent(10, 15)).toBe(100);
  });

  it("returns 0 when there are no referred players", () => {
    expect(affiliationConversionPercent(0, 0)).toBe(0);
    expect(affiliationConversionPercent(0, 5)).toBe(0);
  });
});

describe("formatRelativeActivity", () => {
  const now = Date.parse("2026-10-01T12:00:00.000Z");

  it("says No activity for absent or unparseable stamps", () => {
    expect(formatRelativeActivity(null, now)).toBe("No activity");
    expect(formatRelativeActivity("not-a-date", now)).toBe("No activity");
  });

  it("uses minutes, hours and days in that order", () => {
    expect(formatRelativeActivity(new Date(now - 30_000).toISOString(), now)).toBe("Just now");
    expect(formatRelativeActivity(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5m ago");
    expect(formatRelativeActivity(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("3h ago");
    expect(formatRelativeActivity(new Date(now - 4 * 86_400_000).toISOString(), now)).toBe("4d ago");
  });
});

describe("formatPhoneDisplay", () => {
  it("groups an E.164 number without inventing a format for free text", () => {
    expect(formatPhoneDisplay("+35795854589")).toMatch(/^\+357 /);
    expect(formatPhoneDisplay("not-e164")).toBe("not-e164");
    expect(formatPhoneDisplay(null)).toBeNull();
  });
});
