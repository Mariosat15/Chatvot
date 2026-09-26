/**
 * Provider Kill Switch Job (X9 / E7)
 *
 * Every minute: probe enabled providers for sustained failure evidence, persist
 * health streak / down-since, and after 15 minutes continuously down set
 * `enabled: false` so new contests and rounds refuse. Live contests continue.
 *
 * Thin wrapper over `runProviderKillSwitch` — same shape as round-reconciliation.
 */

import { connectToDatabase } from "../config/database";
import type { RunProviderKillSwitchSummary } from "../../lib/services/game-providers/provider-kill-switch.service";

export type ProviderKillSwitchJobResult = RunProviderKillSwitchSummary;

export async function runProviderKillSwitchCheck(): Promise<ProviderKillSwitchJobResult> {
  await connectToDatabase();

  const { runProviderKillSwitch } = await import(
    "../../lib/services/game-providers/provider-kill-switch.service"
  );

  return runProviderKillSwitch();
}
