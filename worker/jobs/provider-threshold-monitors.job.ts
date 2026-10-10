/**
 * Provider Threshold Monitors Job (X9 / E7)
 *
 * Every minute: chapter 06 s10 threshold scans (stuck finalizing, prize mismatch,
 * callback failure rate, latency p95, catalogue stale, repeat challenge pairing).
 */

import { connectToDatabase } from "../config/database";
import type { ThresholdMonitorSummary } from "../../lib/services/game-providers/provider-threshold-monitors.service";

export type ProviderThresholdMonitorsJobResult = ThresholdMonitorSummary;

export async function runProviderThresholdMonitorsCheck(): Promise<ProviderThresholdMonitorsJobResult> {
  await connectToDatabase();

  const { runProviderThresholdMonitors } = await import(
    "../../lib/services/game-providers/provider-threshold-monitors.service"
  );

  return runProviderThresholdMonitors();
}
