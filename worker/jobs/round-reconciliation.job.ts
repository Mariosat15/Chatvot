/**
 * Round Reconciliation Job (X9 / E7)
 *
 * Runs the provider-result safety net every minute: poll lost webhooks, final-sweep
 * inside grace, then apply the contest's unresolved policy and alert/notify.
 *
 * Thin wrapper over `runRoundReconciliation` — same shape as competition-end.job.
 */

import { connectToDatabase } from "../config/database";
import type { RunRoundReconciliationSummary } from "../../lib/services/games/run-round-reconciliation";

export type RoundReconciliationJobResult = RunRoundReconciliationSummary;

export async function runRoundReconciliationCheck(): Promise<RoundReconciliationJobResult> {
  await connectToDatabase();

  // Dynamic import so the worker bundle does not pull the games graph at module load.
  const { runRoundReconciliation } = await import(
    "../../lib/services/games/run-round-reconciliation"
  );

  return runRoundReconciliation();
}
