/**
 * Atlas Pending Deposit Cleanup Job
 *
 * Atlas checkout is a full-page redirect with no client "close" event, so a user
 * who opens the hosted page and abandons it leaves a `pending` deposit behind.
 * The fail_url handler catches most of these, but this job is the safety net for
 * the rest (user closed the tab, lost connection, never returned).
 *
 * For each stale pending Atlas deposit we VERIFY with Atlas before touching it,
 * so we never cancel money that was actually paid:
 *   - COMPLETED at Atlas  → leave pending (missed webhook — admin/complete flow
 *                           or reconcile handles crediting; never cancel).
 *   - PROCESSING at Atlas → leave pending (payment still in flight).
 *   - DECLINED at Atlas   → mark failed.
 *   - NEW / not found     → cancel (user never paid).
 *   - Verification error  → skip this run (retry next time; avoid clobbering
 *                           during an Atlas outage).
 * Deposits don't grant credits until completion, so cancelling has no wallet
 * impact. Status flips are atomic (only act while still `pending`).
 *
 * Schedule: every 15 minutes (see worker/index.ts).
 */

import { connectToDatabase } from "../config/database";
import WalletTransaction from "../../database/models/trading/wallet-transaction.model";
import { atlasService, ATLAS_STATUS } from "../../lib/services/atlas.service";

const STALE_MINUTES = 30;
const MAX_PER_RUN = 200;

interface CleanupResult {
  enabled: boolean;
  scanned: number;
  cancelled: number;
  failed: number;
  keptInFlight: number;
  keptCompleted: number;
  skipped: number;
  errors: string[];
}

export async function runAtlasPendingCleanup(): Promise<CleanupResult> {
  const result: CleanupResult = {
    enabled: false,
    scanned: 0,
    cancelled: 0,
    failed: 0,
    keptInFlight: 0,
    keptCompleted: 0,
    skipped: 0,
    errors: [],
  };

  try {
    await connectToDatabase();

    if (!(await atlasService.isEnabled())) {
      return result;
    }
    result.enabled = true;

    const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
    const stale = await WalletTransaction.find({
      transactionType: "deposit",
      status: "pending",
      $or: [{ provider: "atlas" }, { "metadata.paymentProvider": "atlas" }],
      createdAt: { $lt: cutoff },
    })
      .sort({ createdAt: 1 })
      .limit(MAX_PER_RUN);

    for (const tx of stale) {
      result.scanned++;
      try {
        const paymentId =
          (tx.providerTransactionId as string) ||
          (tx.metadata?.atlasPaymentId as string) ||
          "";

        // Verify with Atlas when we have a payment id.
        if (paymentId) {
          const status = await atlasService.getPaymentStatus(paymentId);
          if ("error" in status) {
            // Couldn't verify — leave it for the next run (don't risk a real payment).
            result.skipped++;
            continue;
          }
          const code = Number(status.transaction_status_code);
          if (code === ATLAS_STATUS.COMPLETED) {
            // Paid at Atlas but still pending here → missed webhook. Do NOT
            // cancel; leave for the complete-pending / reconcile path.
            result.keptCompleted++;
            console.warn(
              `⚠️ Atlas deposit ${tx._id} COMPLETED at Atlas but still pending — left for completion (missed webhook?)`,
            );
            continue;
          }
          if (code === ATLAS_STATUS.PROCESSING) {
            result.keptInFlight++;
            continue;
          }
          if (code === ATLAS_STATUS.DECLINED) {
            const updated = await WalletTransaction.findOneAndUpdate(
              { _id: tx._id, status: "pending" },
              {
                $set: {
                  status: "failed",
                  failureReason: "Atlas reported the payment as declined",
                  processedAt: new Date(),
                  "metadata.cancelReason": "atlas_declined",
                },
              },
            );
            if (updated) result.failed++;
            continue;
          }
          // code === NEW (0) → fall through to cancel (user never paid).
        }

        // No payment id, or Atlas reports NEW → treat as abandoned.
        const updated = await WalletTransaction.findOneAndUpdate(
          { _id: tx._id, status: "pending" },
          {
            $set: {
              status: "cancelled",
              failureReason: "Abandoned Atlas checkout (auto-expired)",
              processedAt: new Date(),
              "metadata.cancelReason": "atlas_pending_cleanup",
            },
          },
        );
        if (updated) result.cancelled++;
      } catch (error) {
        result.errors.push(
          `tx ${tx._id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  } catch (error) {
    result.errors.push(
      `Global error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return result;
}
