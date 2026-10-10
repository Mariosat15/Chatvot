/**
 * Provider Outage Pause Job (X9 / E7)
 *
 * Pauses live provider contests when the provider is down; resumes and extends
 * the play window when evidence recovers. Thin wrapper over
 * `runProviderOutagePause`.
 */

import { connectToDatabase } from "../config/database";
import type { OutagePauseSummary } from "../../lib/services/game-providers/provider-outage-pause.service";

export type ProviderOutagePauseJobResult = OutagePauseSummary;

export async function runProviderOutagePauseCheck(): Promise<ProviderOutagePauseJobResult> {
  await connectToDatabase();

  const { runProviderOutagePause } = await import(
    "../../lib/services/game-providers/provider-outage-pause.service"
  );

  return runProviderOutagePause();
}
