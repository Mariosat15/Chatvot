"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";
import type { DashboardNavTab } from "@/lib/constants";

/** Tailwind `md` — the Overview splits into two trees here. */
export const DASHBOARD_DESKTOP_QUERY = "(min-width: 768px)";

export type DashboardViewport = "mobile" | "desktop";

export interface DashboardOverviewValue {
  data: ComprehensiveDashboardData;
  activeTab: DashboardNavTab;
  accountOk: boolean;
  /** Null until mounted — neither tree polls before the viewport is known. */
  viewport: DashboardViewport | null;
}

const DashboardOverviewContext = createContext<DashboardOverviewValue | null>(
  null,
);

function useViewport(): DashboardViewport | null {
  const [viewport, setViewport] = useState<DashboardViewport | null>(null);
  useEffect(() => {
    const mql = window.matchMedia(DASHBOARD_DESKTOP_QUERY);
    const sync = () => setViewport(mql.matches ? "desktop" : "mobile");
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);
  return viewport;
}

export function DashboardOverviewProvider({
  data,
  activeTab,
  children,
}: {
  data: ComprehensiveDashboardData;
  activeTab: DashboardNavTab;
  children: ReactNode;
}) {
  const viewport = useViewport();
  const { accountStatus } = data;
  const accountOk =
    !accountStatus.hasActiveRestriction &&
    !accountStatus.isLocked &&
    !accountStatus.hasOpenAlert;

  const value = useMemo(
    () => ({ data, activeTab, accountOk, viewport }),
    [data, activeTab, accountOk, viewport],
  );

  return (
    <DashboardOverviewContext.Provider value={value}>
      {children}
    </DashboardOverviewContext.Provider>
  );
}

export function useDashboardOverview(): DashboardOverviewValue {
  const value = useContext(DashboardOverviewContext);
  if (!value) {
    throw new Error("useDashboardOverview must be used inside DashboardOverviewProvider");
  }
  return value;
}

/**
 * True only for the tree the visitor can actually see.
 *
 * Reason: `hidden md:block` / `md:hidden` hide with CSS and do not unmount, so both
 * trees are live. Without this gate each would poll the same endpoints twice.
 */
export function useOverviewLive(tree: DashboardViewport): boolean {
  const { activeTab, viewport } = useDashboardOverview();
  return activeTab === "overview" && viewport === tree;
}
