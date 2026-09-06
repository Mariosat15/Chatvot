import type { AdminSection } from "@/database/models/admin-employee.model";

/**
 * Which admin sections belong to a specific game, and which belong to contest
 * management in general.
 *
 * Reason: the admin menu used to have one "Trading" group that mixed the two.
 * `competitions`, `challenges` and `analytics` are not trading screens — they
 * administer contests, and a contest will soon belong to any game. Keeping the
 * split in one place stops the sidebar and the in-page tab bar from drifting
 * apart, and gives the games work a single list to extend.
 */

export interface GameSectionTab {
  /** Must be an existing `AdminSection` id. Reason: RBAC grants per section, and
   *  deep links use `?activeTab=<id>`, so ids are a compatibility surface. */
  id: AdminSection;
  label: string;
}

/**
 * The trading game's own screens, in the order they appear as tabs.
 *
 * `trading-risk` used to be buried under Settings and `price-health` under
 * Operations, which meant an operator had to know three places to run one game.
 */
export const TRADING_SECTION_TABS: readonly GameSectionTab[] = [
  { id: "symbols", label: "Symbols" },
  { id: "market", label: "Market Hours" },
  { id: "market-data", label: "Market Data" },
  { id: "trading-risk", label: "Risk & Margin" },
  { id: "price-health", label: "Price Health" },
  { id: "trading-history", label: "Trading History" },
] as const;

export const TRADING_SECTION_IDS: readonly string[] = TRADING_SECTION_TABS.map(
  (tab) => tab.id,
);

export function isTradingSection(sectionId: string): boolean {
  return TRADING_SECTION_IDS.includes(sectionId);
}
