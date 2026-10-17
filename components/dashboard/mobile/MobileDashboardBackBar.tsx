"use client";

import { NeonBackLink } from "@/components/neon/Buttons";

/**
 * Phone-only way back to Overview when Header tabs are withheld.
 *
 * Reason: Quick Access deep-links into Wallet / Performance / Tutorials, and
 * the sidebar "Dashboard" entry used to reopen the last saved tab via
 * localStorage — so a player could land on Wallet Analytics with no visible
 * path home. This bar is that path.
 */
export default function MobileDashboardBackBar({
  label = "Overview",
}: {
  label?: string;
}) {
  return (
    <div className="mb-3 md:hidden">
      <NeonBackLink href="/dashboard?tab=overview" label={label} />
    </div>
  );
}
