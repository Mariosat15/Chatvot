/**
 * Atlas Refund Reconciliation Job
 *
 * Fallback for refunds Atlas does NOT call back on (e.g. provider-side refunds
 * initiated directly with Atlas, outside ChartVolt). Periodically pulls recent
 * Atlas refunds and runs each through the same idempotent reconciliation path
 * the callback uses — so a deposit that was refunded without a matching
 * `refundStatus`/clawback gets flagged for admin review and the customer is
 * notified. Anything already recorded by the callback is a no-op (duplicate).
 *
 * Schedule: hourly (see worker/index.ts). Window: last LOOKBACK_HOURS hours.
 */

import { connectToDatabase } from "../config/database";
import { atlasService } from "../../lib/services/atlas.service";
import { applyAtlasRefundRecord } from "../../lib/services/atlas-refund-reconcile.service";

const SOURCE = "scheduler:atlas-refund-reconcile";
const LOOKBACK_HOURS = 48; // re-scan a generous window to catch delayed refunds
const PAGE_SIZE = 100;
const MAX_PAGES = 5; // safety cap (≤ 500 refunds per run)

interface ReconcileResult {
  enabled: boolean;
  scanned: number;
  newlyReconciled: number;
  duplicates: number;
  notFound: number;
  errors: string[];
}

export async function runAtlasRefundReconcile(): Promise<ReconcileResult> {
  const result: ReconcileResult = {
    enabled: false,
    scanned: 0,
    newlyReconciled: 0,
    duplicates: 0,
    notFound: 0,
    errors: [],
  };

  try {
    await connectToDatabase();

    // Skip cleanly when Atlas isn't configured/active.
    if (!(await atlasService.isEnabled())) {
      return result;
    }
    result.enabled = true;

    const afterDate = new Date(
      Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000,
    ).toISOString();

    for (let page = 0; page < MAX_PAGES; page++) {
      const list = await atlasService.listRefunds({
        afterDate,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });

      if (!Array.isArray(list)) {
        result.errors.push(list.error);
        break;
      }
      if (list.length === 0) break;

      for (const record of list) {
        result.scanned++;
        try {
          // Only completed refunds move money / require reconciliation. Other
          // statuses are still applied (status annotation) but don't count as
          // "newly reconciled".
          const outcome = await applyAtlasRefundRecord(record, SOURCE);
          if (outcome.outcome === "completed") {
            result.newlyReconciled++;
            console.log(
              `   💸 Reconciled missed Atlas refund ${outcome.refundId} → deposit ${outcome.transactionId}`,
            );
          } else if (outcome.outcome === "duplicate") {
            result.duplicates++;
          } else if (outcome.outcome === "not_found") {
            result.notFound++;
          }
        } catch (error) {
          result.errors.push(
            `refund ${record.refund_id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      // Last page reached.
      if (list.length < PAGE_SIZE) break;
    }

    if (result.newlyReconciled > 0) {
      console.log(
        `✅ Atlas refund reconcile: ${result.newlyReconciled} missed refund(s) reconciled, ${result.duplicates} already recorded, ${result.scanned} scanned`,
      );
    }
  } catch (error) {
    result.errors.push(
      `Global error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return result;
}
