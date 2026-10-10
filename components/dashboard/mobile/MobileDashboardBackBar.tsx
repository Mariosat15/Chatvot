"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
      <Link
        href="/dashboard?tab=overview"
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-3.5 py-2 text-sm font-semibold text-cyan-100 transition active:scale-95 hover:border-cyan-300/70 hover:bg-cyan-500/20"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back to {label}
      </Link>
    </div>
  );
}
