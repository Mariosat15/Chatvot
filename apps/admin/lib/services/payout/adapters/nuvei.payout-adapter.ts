/**
 * Nuvei payout adapter.
 *
 * Wraps the Nuvei /payout.do call that was previously inlined in the admin
 * withdrawal-processing route. Behaviour is intentionally identical — it has
 * just been moved behind the PayoutAdapter interface so other providers can
 * be added without touching the route.
 */

import type {
  PayoutAdapter,
  PayoutExecutionContext,
  PayoutExecutionResult,
} from "../payout-adapter";

/**
 * Resolve the Nuvei User Payment Option (UPO) id needed to send a payout.
 * Mirrors the original fallback chain: saved UPO → card details → bank details
 * → most-recent active UPO from the NuveiUserPaymentOption collection.
 */
async function resolveUserPaymentOptionId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withdrawal: any,
): Promise<string | undefined> {
  if (withdrawal.metadata?.savedUpoId) {
    return String(withdrawal.metadata.savedUpoId);
  }
  if (withdrawal.originalCardDetails?.userPaymentOptionId) {
    return String(withdrawal.originalCardDetails.userPaymentOptionId);
  }
  if (withdrawal.bankDetails?.nuveiUpoId) {
    return String(withdrawal.bankDetails.nuveiUpoId);
  }

  if (withdrawal.userId) {
    try {
      const mongoose = (await import("mongoose")).default;
      // Reason: avoid registering the model twice; reuse if already registered.
      const NuveiUPO =
        mongoose.models?.NuveiUserPaymentOption ||
        mongoose.model(
          "NuveiUserPaymentOption",
          new mongoose.Schema({
            userId: String,
            userPaymentOptionId: String,
            type: String,
            isActive: Boolean,
            lastUsed: Date,
          }),
        );
      const upo = await NuveiUPO.findOne({
        userId: withdrawal.userId,
        isActive: true,
      })
        .sort({ lastUsed: -1 })
        .lean();
      if (upo && (upo as Record<string, unknown>).userPaymentOptionId) {
        return String((upo as Record<string, unknown>).userPaymentOptionId);
      }
    } catch (err) {
      console.warn(
        "⚠️ Failed to look up UPO from NuveiUserPaymentOption:",
        err,
      );
    }
  }
  return undefined;
}

export const nuveiPayoutAdapter: PayoutAdapter = {
  id: "nuvei",
  label: "Nuvei",
  supportsPayout: true,

  async executePayout({
    withdrawal,
  }: PayoutExecutionContext): Promise<PayoutExecutionResult> {
    const userPaymentOptionId = await resolveUserPaymentOptionId(withdrawal);

    if (!userPaymentOptionId) {
      return {
        outcome: "skipped",
        note: "⚠️ No Nuvei payment option — process via manual bank transfer",
      };
    }

    // Reason: default export is the singleton instance, not the class.
    const nuveiService = (await import("@/lib/services/nuvei.service")).default;

    // Reason: /payout.do uses clientUniqueId (not merchantWDRequestId).
    const clientUniqueId = `wd_${String(withdrawal.userId).slice(-8)}_${Date.now()}`;
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      "https://chartvolt.app";

    const nuveiResult = await nuveiService.submitPayout({
      userTokenId: `user_${withdrawal.userId}`,
      amount: (withdrawal.netAmountEUR || withdrawal.amountEUR).toFixed(2),
      currency: "EUR",
      clientUniqueId,
      userPaymentOptionId,
      email: withdrawal.userEmail || undefined,
      firstName: withdrawal.userName?.split(" ")[0] || undefined,
      lastName:
        withdrawal.userName?.split(" ").slice(1).join(" ") || undefined,
      notificationUrl: `${origin}/api/nuvei/webhook`,
    });

    if ("error" in nuveiResult && nuveiResult.error) {
      return {
        outcome: "error",
        error: nuveiResult.error,
        note: `⚠️ Nuvei payout failed: ${nuveiResult.error}. Manual bank transfer required.`,
      };
    }

    if ("transactionId" in nuveiResult && nuveiResult.transactionId) {
      return {
        outcome: "submitted",
        transactionId: nuveiResult.transactionId,
        transactionStatus: nuveiResult.transactionStatus,
        note: `✅ Nuvei payout submitted: ${nuveiResult.transactionId} (${nuveiResult.transactionStatus})`,
        metadata: {
          nuveiClientUniqueId: clientUniqueId,
          // Reason: payout.do processes immediately — no separate approve step.
          payoutMethod: "payout_api",
        },
      };
    }

    return {
      outcome: "error",
      error: "Unexpected Nuvei response",
      note: "⚠️ Unexpected Nuvei response — manual follow-up may be needed",
    };
  },
};
