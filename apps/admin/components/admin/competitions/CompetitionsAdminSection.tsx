"use client";

import CompetitionsListSection from "@/components/admin/CompetitionsListSection";

/**
 * The Competitions destination: the competitions list.
 *
 * Reason: it used to carry a Settings tab holding the Game Master Competition Defaults. Those
 * moved to Manage Game Masters -> Settings on 2 Oct 2026 (owner request), beside the other
 * Game Master switches, so every Game Master setting is in one place.
 */
export default function CompetitionsAdminSection() {
  return <CompetitionsListSection />;
}
