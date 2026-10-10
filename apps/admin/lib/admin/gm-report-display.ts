/**
 * Pure display helpers for the Manage Game Masters report UI.
 *
 * Model-free: the screen is `"use client"` (R58). Conversion and relative-time
 * answers live here so the KPI cards and the breakdown table cannot disagree.
 */

/** Affiliated players / referred players, as a 0–100 percentage. Absent players → 0. */
export function affiliationConversionPercent(players: number, current: number): number {
  if (!(players > 0) || !(current >= 0)) return 0;
  return Math.min(100, Math.round((current / players) * 100));
}

/** "2h ago" / "3d ago" / "No activity" for the Last activity column. */
export function formatRelativeActivity(iso: string | null, nowMs: number = Date.now()): string {
  if (!iso) return "No activity";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "No activity";
  const delta = Math.max(0, nowMs - then);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

/** Compact E.164 for the player cell: +35795854589 → +357 95 854 589 when possible. */
export function formatPhoneDisplay(phone: string | null): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.slice(1).replace(/\D/g, "");
  if (digits.length < 8) return trimmed;
  // Reason: country code length varies; keep the leading '+' and group the national tail in
  // threes from the right so Cyprus (+357) and US (+1) both read, without claiming a full
  // libphonenumber format pass on every row.
  const ccLen = digits.length > 10 ? 3 : digits.length > 9 ? 2 : 1;
  const cc = digits.slice(0, ccLen);
  const national = digits.slice(ccLen);
  const groups: string[] = [];
  for (let i = national.length; i > 0; i -= 3) {
    groups.unshift(national.slice(Math.max(0, i - 3), i));
  }
  return `+${cc} ${groups.join(" ")}`;
}
