"use client";

import type { ReactNode } from "react";
import DashboardBackdrop from "../DashboardBackdrop";

/** Wallet Analytics backdrop — same wash as Performance. */
export default function WalletBackdrop({ children }: { children: ReactNode }) {
  return <DashboardBackdrop>{children}</DashboardBackdrop>;
}
