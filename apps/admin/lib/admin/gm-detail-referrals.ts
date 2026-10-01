import type { ReferredPlayerRow } from "@/lib/services/gamemaster/referral-read-model";

/**
 * The search on the Manage Game Masters Referrals tab: name, email, phone, country or player id.
 * Kept out of the component so it can be tested without importing the client screen (R58).
 */
export function filterDetailReferrals<T extends ReferredPlayerRow>(rows: T[], search: string): T[] {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) =>
    [r.userName, r.userEmail, r.phone, r.country, r.userId].some((v) =>
      typeof v === "string" ? v.toLowerCase().includes(q) : false,
    ),
  );
}
