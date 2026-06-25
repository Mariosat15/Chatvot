import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import WithdrawalRequest from "@/database/models/withdrawal-request.model";
import UserBankAccount from "@/database/models/user-bank-account.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import { PlatformTransaction } from "@/database/models/platform-financials.model";
import { verifyAdminAuth } from "@/lib/admin/auth";
import { auditLogService } from "@/lib/services/audit-log.service";

/**
 * GET /api/withdrawals/[id]
 * Get a specific withdrawal request with bank details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectToDatabase();

    const withdrawal = await WithdrawalRequest.findById(id).lean();
    if (!withdrawal) {
      return NextResponse.json(
        { success: false, error: "Withdrawal not found" },
        { status: 404 },
      );
    }

    // Get user's bank details
    const bankAccount = await UserBankAccount.findOne({
      userId: withdrawal.userId,
      isDefault: true,
      isActive: true,
    }).lean();

    return NextResponse.json({
      success: true,
      withdrawal: {
        ...withdrawal,
        userBankDetails: bankAccount
          ? {
              accountHolderName: bankAccount.accountHolderName,
              iban: bankAccount.iban,
              bankName: bankAccount.bankName,
              swiftBic: bankAccount.swiftBic,
              country: bankAccount.country,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error fetching withdrawal:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch withdrawal" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/withdrawals/[id]
 * Update withdrawal status
 *
 * MANUAL WITHDRAWAL FLOW:
 * - pending → approved: Admin approves, ready for bank transfer
 * - approved → completed: Admin has transferred money via bank
 * - pending/approved → rejected: Refund credits to user
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, reason, bankTransferRef, adminNote, companyBankUsed } =
      body;

    await connectToDatabase();

    const withdrawal = await WithdrawalRequest.findById(id).session(session);
    if (!withdrawal) {
      await session.abortTransaction();
      return NextResponse.json(
        { success: false, error: "Withdrawal not found" },
        { status: 404 },
      );
    }

    const validTransitions: Record<string, string[]> = {
      pending: ["approved", "rejected", "cancelled"],
      approved: ["processing", "completed", "rejected", "cancelled"],
      processing: ["completed", "failed"],
      failed: ["processing", "rejected"],
    };

    if (!validTransitions[withdrawal.status]?.includes(action)) {
      await session.abortTransaction();
      return NextResponse.json(
        {
          success: false,
          error: `Cannot transition from ${withdrawal.status} to ${action}`,
        },
        { status: 400 },
      );
    }

    // Handle each action
    switch (action) {
      case "approved":
        // Generate reference for admin tracking
        const referenceId = `WD-${Date.now()}-${withdrawal._id.toString().slice(-6).toUpperCase()}`;

        withdrawal.status = "approved";
        withdrawal.processedBy = admin.adminId;
        withdrawal.processedByEmail = admin.email;
        withdrawal.processedAt = new Date();
        withdrawal.payoutId = referenceId;
        // Preserve original payout method, only set provider to manual
        withdrawal.payoutProvider = "manual";
        if (adminNote) withdrawal.adminNote = adminNote;

        // Log details based on payout method
        const isCardRefund = withdrawal.payoutMethod === "original_method";

        if (isCardRefund) {
          console.log(
            `\n💳 WITHDRAWAL APPROVED (Card Refund) - Reference: ${referenceId}`,
          );
          console.log(`   Amount: €${withdrawal.netAmountEUR.toFixed(2)}`);
          console.log(`   User: ${withdrawal.userEmail}`);
          if (withdrawal.originalCardDetails) {
            console.log(
              `   Card: ${withdrawal.originalCardDetails.brand} •••• ${withdrawal.originalCardDetails.last4}`,
            );
          }
          console.log(
            `   Original Payment: ${withdrawal.originalPaymentId || "Look up in Stripe"}`,
          );
          console.log(
            `\n   📋 Issue refund of €${withdrawal.netAmountEUR.toFixed(2)} via payment provider, then mark as COMPLETED\n`,
          );
        } else {
          // Bank transfer
          const bankAccount = await UserBankAccount.findOne({
            userId: withdrawal.userId,
            isDefault: true,
            isActive: true,
          }).session(session);

          if (bankAccount) {
            console.log(
              `\n🏦 WITHDRAWAL APPROVED (Bank Transfer) - Reference: ${referenceId}`,
            );
            console.log(`   Amount: €${withdrawal.netAmountEUR.toFixed(2)}`);
            console.log(`   User: ${withdrawal.userEmail}`);
            console.log(`   IBAN: ${bankAccount.iban}`);
            console.log(`   Bank: ${bankAccount.bankName || "N/A"}`);
            console.log(
              `\n   📋 Transfer €${withdrawal.netAmountEUR.toFixed(2)} to above IBAN, then mark as COMPLETED\n`,
            );
          }
        }
        break;

      case "rejected":
      case "cancelled":
        // Reason: With /payout.do, payouts are processed immediately — no pending Nuvei request to decline.
        // If a payout was already submitted, it cannot be reversed here (would need a refund).
        if (withdrawal.metadata?.nuveiTransactionId) {
          console.warn(
            `⚠️ Withdrawal ${withdrawal._id} has Nuvei transaction ${withdrawal.metadata.nuveiTransactionId} — payout already processed, may need manual refund`,
          );
          withdrawal.adminNote =
            (withdrawal.adminNote || "") +
            `\n⚠️ Nuvei payout ${withdrawal.metadata.nuveiTransactionId} was already processed. May require manual refund.`;
        } else if (withdrawal.metadata?.nuveiWdRequestId) {
          // Legacy: old-style withdrawal request — log for manual follow-up
          console.warn(
            `⚠️ Legacy Nuvei WD request ${withdrawal.metadata.nuveiWdRequestId} — verify if it needs manual cancellation`,
          );
          withdrawal.adminNote =
            (withdrawal.adminNote || "") +
            `\nℹ️ Legacy Nuvei request — verify manually in Nuvei dashboard`;
        }

        withdrawal.status = action === "rejected" ? "rejected" : "cancelled";
        withdrawal.rejectedBy = admin.adminId;
        withdrawal.rejectedAt = new Date();
        withdrawal.rejectionReason = reason || `${action} by admin`;
        if (adminNote) withdrawal.adminNote = adminNote;

        // Refund credits to user wallet
        const wallet = await CreditWallet.findOne({
          userId: withdrawal.userId,
        }).session(session);
        if (wallet) {
          const _balanceBefore = wallet.creditBalance;
          wallet.creditBalance += withdrawal.amountCredits;
          await wallet.save({ session });
          withdrawal.walletBalanceAfter = wallet.creditBalance;
        }

        // CRITICAL: Update the original wallet transaction - make it "completed" with 0 amount
        // This way the reconciliation counts it correctly (no effect on balance since amount=0)
        // and we maintain the audit trail
        await WalletTransaction.updateOne(
          {
            userId: withdrawal.userId,
            transactionType: "withdrawal",
            status: "pending",
            $or: [
              { "metadata.withdrawalRequestId": withdrawal._id },
              { "metadata.withdrawalRequestId": withdrawal._id.toString() },
            ],
          },
          {
            $set: {
              status: "completed", // Mark as completed so it's counted
              amount: 0, // Set amount to 0 since withdrawal was reversed
              processedAt: new Date(),
              description: `Withdrawal ${action} - credits returned to wallet`,
              "metadata.originalAmount": withdrawal.amountCredits,
              "metadata.refundReason": withdrawal.rejectionReason,
              "metadata.wasReversed": true,
            },
          },
          { session },
        );

        console.log(
          `💰 Refunded ${withdrawal.amountCredits} credits to user ${withdrawal.userId} (withdrawal ${action})`,
        );
        break;

      case "processing":
        withdrawal.status = "processing";
        withdrawal.processedAt = new Date();

        // Reason: payout execution now goes through the plug-and-play payout
        // router. It decides between (a) manual/internal processing when the
        // admin has disabled outgoing PSP payouts, or (b) dispatching to the
        // selected provider's adapter. Adding a new provider requires no
        // change here — only a new adapter + registry entry.
        if (!withdrawal.metadata?.nuveiTransactionId) {
          try {
            const WithdrawalSettings = (
              await import("@/database/models/withdrawal-settings.model")
            ).default;
            const { resolveWithdrawalRouting } = await import(
              "@/lib/services/payout/withdrawal-routing"
            );
            const wSettings = await WithdrawalSettings.getSingleton();
            const routing = resolveWithdrawalRouting(wSettings);

            // Decide whether to call the payout provider for this admin-processed
            // withdrawal. Reason: "Use <provider> for Manual Withdrawals"
            // (usePaymentProcessorForManual) is the switch that controls whether
            // the PSP runs in the manual workflow. We only call the provider when:
            //   • the master switch is ON, AND
            //   • automatic processing is enabled for the provider, OR the admin
            //     explicitly opted to route MANUAL withdrawals through it.
            // Otherwise this is a pure-manual payout — the admin sends the money
            // by hand and then marks the withdrawal COMPLETED (no PSP call).
            const useProvider =
              routing.sendToProvider &&
              (routing.canAutoProcess ||
                wSettings.usePaymentProcessorForManual === true);

            if (!useProvider) {
              const why = !routing.sendToProvider
                ? "outgoing provider payouts are disabled"
                : `${routing.providerLabel} is not used for manual withdrawals`;
              console.log(
                `🛠️ Withdrawal ${withdrawal._id} processed in manual mode (${why}).`,
              );
              withdrawal.payoutProvider = "manual";
              withdrawal.adminNote =
                (withdrawal.adminNote || "") +
                `\nℹ️ Manual payout — pay this withdrawal yourself (bank transfer / card refund to the user's details), then mark COMPLETED. No payment provider was called.`;
            } else {
              const { getPayoutAdapter } = await import(
                "@/lib/services/payout/payout-adapter-registry"
              );
              const adapter = getPayoutAdapter(routing.providerId);

              if (!adapter || !adapter.supportsPayout) {
                console.log(
                  `⚠️ Provider "${routing.providerId}" cannot execute payouts for withdrawal ${withdrawal._id} — manual handling required.`,
                );
                withdrawal.adminNote =
                  (withdrawal.adminNote || "") +
                  `\n⚠️ Provider "${routing.providerLabel}" cannot execute payouts — process manually, then mark COMPLETED.`;
              } else {
                console.log(
                  `🏦 Submitting ${routing.providerLabel} payout for withdrawal ${withdrawal._id}...`,
                );
                const result = await adapter.executePayout({ withdrawal });

                withdrawal.metadata = withdrawal.metadata || {};
                if (result.outcome === "submitted") {
                  // Reason: keep the legacy `nuveiTransactionId` key so the
                  // downstream "completed" step (which checks it) keeps working.
                  withdrawal.metadata.nuveiTransactionId = result.transactionId;
                  withdrawal.metadata.providerTransactionId =
                    result.transactionId;
                  withdrawal.metadata.nuveiTransactionStatus =
                    result.transactionStatus;
                  withdrawal.metadata.payoutProviderId = routing.providerId;
                  withdrawal.metadata.usePaymentProcessor = true;
                  withdrawal.payoutProvider = routing.providerId;
                  if (result.metadata) {
                    Object.assign(withdrawal.metadata, result.metadata);
                  }
                }
                withdrawal.adminNote =
                  (withdrawal.adminNote || "") + `\n${result.note}`;
              }
            }
          } catch (payoutError) {
            console.error(
              "❌ Error during payout processing:",
              payoutError,
            );
            withdrawal.adminNote =
              (withdrawal.adminNote || "") +
              `\n⚠️ Payout provider error — manual follow-up may be needed`;
          }
        } else {
          console.log(
            `🏦 Withdrawal ${withdrawal._id} already has a payout reference: ${withdrawal.metadata.nuveiTransactionId}`,
          );
        }
        break;

      case "completed":
        // Reason: If payout was already submitted via /payout.do during the "processing" step,
        // no additional Nuvei call is needed — the money was already sent.
        // The /payout.do endpoint directly processes the payout (no separate approve step).
        if (withdrawal.metadata?.nuveiTransactionId) {
          console.log(
            "✅ Nuvei payout already processed during 'processing' step:",
            withdrawal.metadata.nuveiTransactionId,
            "Status:",
            withdrawal.metadata.nuveiTransactionStatus,
          );
          withdrawal.adminNote =
            (withdrawal.adminNote || "") +
            `\n✅ Nuvei payout already processed (txn: ${withdrawal.metadata.nuveiTransactionId})`;
        } else if (withdrawal.metadata?.nuveiWdRequestId) {
          // Backward compat: old-style withdrawal requests that used /withdraw.do
          console.log(
            "ℹ️ Legacy withdrawal request found:",
            withdrawal.metadata.nuveiWdRequestId,
            "— no auto-approve available for legacy requests",
          );
          withdrawal.adminNote =
            (withdrawal.adminNote || "") +
            `\nℹ️ Legacy Nuvei request ${withdrawal.metadata.nuveiWdRequestId} — verify payout manually`;
        }

        withdrawal.status = "completed";
        withdrawal.completedAt = new Date();
        withdrawal.payoutStatus = "completed";
        if (bankTransferRef) {
          withdrawal.adminNote =
            (withdrawal.adminNote || "") + `\nBank ref: ${bankTransferRef}`;
        }
        if (adminNote) {
          withdrawal.adminNote =
            (withdrawal.adminNote || "") +
            (withdrawal.adminNote ? "\n" : "") +
            adminNote;
        }

        // Save company bank used for this withdrawal
        if (companyBankUsed && companyBankUsed.bankId) {
          // Store the bank details - IBAN should come pre-masked from frontend or mask it here
          const maskIban = (iban: string | undefined) => {
            if (!iban) return undefined;
            // If already masked, don't re-mask
            if (iban.startsWith("****")) return iban;
            // Show last 4 chars
            return `****${iban.slice(-4)}`;
          };

          const bankDataToSave = {
            bankId: companyBankUsed.bankId,
            accountName: companyBankUsed.accountName,
            accountHolderName: companyBankUsed.accountHolderName,
            bankName: companyBankUsed.bankName,
            iban: maskIban(companyBankUsed.iban),
            accountNumber: companyBankUsed.accountNumber
              ? companyBankUsed.accountNumber.startsWith("****")
                ? companyBankUsed.accountNumber
                : `****${companyBankUsed.accountNumber.slice(-4)}`
              : undefined,
            country: companyBankUsed.country,
            currency: companyBankUsed.currency,
          };

          withdrawal.companyBankUsed = bankDataToSave;

          // Update admin bank account statistics
          try {
            const AdminBankAccount = (
              await import("@/database/models/admin-bank-account.model")
            ).default;
            await AdminBankAccount.findByIdAndUpdate(
              companyBankUsed.bankId,
              {
                $inc: {
                  totalWithdrawals: 1,
                  totalAmount: withdrawal.netAmountEUR,
                },
                $set: { lastUsedAt: new Date() },
              },
              { session },
            );
          } catch (bankUpdateError) {
            console.error(
              "Failed to update admin bank stats:",
              bankUpdateError,
            );
            // Don't fail the withdrawal for this
          }
        }

        // Update wallet's total withdrawn (only if not already counted)
        const alreadyCounted =
          withdrawal.metadata?.totalWithdrawnUpdated === true;
        if (!alreadyCounted) {
          const userWallet = await CreditWallet.findOne({
            userId: withdrawal.userId,
          }).session(session);
          if (userWallet) {
            userWallet.totalWithdrawn =
              (userWallet.totalWithdrawn || 0) + withdrawal.amountCredits;
            await userWallet.save({ session });
          }

          // Mark as counted to prevent duplicates
          withdrawal.metadata = withdrawal.metadata || {};
          withdrawal.metadata.totalWithdrawnUpdated = true;
          console.log(
            `💸 Updated totalWithdrawn: +${withdrawal.amountCredits} credits for user ${withdrawal.userId}`,
          );
        } else {
          console.log(
            `💸 totalWithdrawn already updated for withdrawal ${withdrawal._id}, skipping`,
          );
        }

        // Calculate bank fee from settings (what bank charges us for the payout)
        const CreditConversionSettings = (
          await import("@/database/models/credit-conversion-settings.model")
        ).default;
        const feeSettings = await CreditConversionSettings.getSingleton();

        // Bank fee is calculated on the net amount (what we actually transfer to user)
        const withdrawalNetAmount = withdrawal.netAmountEUR || 0;
        const calculatedBankFee =
          (withdrawalNetAmount *
            (feeSettings.bankWithdrawalFeePercentage || 0)) /
            100 +
          (feeSettings.bankWithdrawalFeeFixed || 0);

        // Update withdrawal with calculated bank fee
        withdrawal.bankFee = calculatedBankFee;

        // Platform fee is what we charge user, bank fee is what bank charges us
        // Net earning = platform fee - bank fee
        const platformFeeCharged = withdrawal.platformFee || 0;
        const netEarning = platformFeeCharged - calculatedBankFee;

        console.log(`💵 Withdrawal fee breakdown:`);
        console.log(
          `   Net amount transferred: €${withdrawalNetAmount.toFixed(2)}`,
        );
        console.log(
          `   Platform fee (we charged): €${platformFeeCharged.toFixed(2)}`,
        );
        console.log(
          `   Bank fee (${feeSettings.bankWithdrawalFeePercentage}% + €${feeSettings.bankWithdrawalFeeFixed}): €${calculatedBankFee.toFixed(2)}`,
        );
        console.log(`   Net platform earning: €${netEarning.toFixed(2)}`);

        // Record platform transaction for withdrawal fee
        await PlatformTransaction.create(
          [
            {
              transactionType: "withdrawal_fee",
              amount: withdrawal.platformFeeCredits || 0,
              amountEUR: platformFeeCharged,
              sourceType: "user_withdrawal",
              sourceId: withdrawal._id.toString(),
              sourceName: withdrawal.userEmail,
              userId: withdrawal.userId,
              feeDetails: {
                withdrawalAmount: withdrawal.amountEUR,
                platformFee: platformFeeCharged, // What we charged user
                bankFee: calculatedBankFee, // What bank takes from us
                netEarning: netEarning, // What we actually keep
                netAmount: withdrawalNetAmount, // What user receives
              },
              description: `Withdrawal fee from ${withdrawal.userEmail}`,
              processedBy: admin.adminId,
              processedByEmail: admin.email,
            },
          ],
          { session },
        );

        // CRITICAL: Update the wallet transaction to 'completed' for reconciliation
        const walletTxUpdate = await WalletTransaction.updateOne(
          {
            userId: withdrawal.userId,
            transactionType: "withdrawal",
            status: "pending",
            $or: [
              { "metadata.withdrawalRequestId": withdrawal._id },
              { "metadata.withdrawalRequestId": withdrawal._id.toString() },
            ],
          },
          {
            $set: {
              status: "completed",
              processedAt: new Date(),
              paymentId: withdrawal.payoutId || `manual_${Date.now()}`,
              description: `Withdrawal completed - €${withdrawalNetAmount.toFixed(2)} sent to ${withdrawal.payoutMethod === "bank_transfer" ? "bank" : "card"}`,
            },
          },
          { session },
        );
        console.log(
          `   📝 Updated wallet transaction: ${walletTxUpdate.modifiedCount} record(s) updated`,
        );

        console.log(
          `✅ Withdrawal ${withdrawal._id} marked as COMPLETED by ${admin.email}`,
        );
        break;

      case "failed":
        withdrawal.status = "failed";
        withdrawal.failureReason = reason || "Bank transfer failed";
        withdrawal.failedAt = new Date();
        if (adminNote) withdrawal.adminNote = adminNote;

        // CRITICAL: Refund credits when withdrawal fails
        const walletForRefund = await CreditWallet.findOne({
          userId: withdrawal.userId,
        }).session(session);
        if (walletForRefund) {
          const _balanceBeforeRefund = walletForRefund.creditBalance;
          walletForRefund.creditBalance += withdrawal.amountCredits;
          await walletForRefund.save({ session });
          withdrawal.walletBalanceAfter = walletForRefund.creditBalance;
        }

        // CRITICAL: Update the original wallet transaction - make it "completed" with 0 amount
        // This way the reconciliation counts it correctly (no effect on balance since amount=0)
        await WalletTransaction.updateOne(
          {
            userId: withdrawal.userId,
            transactionType: "withdrawal",
            status: "pending",
            $or: [
              { "metadata.withdrawalRequestId": withdrawal._id },
              { "metadata.withdrawalRequestId": withdrawal._id.toString() },
            ],
          },
          {
            $set: {
              status: "completed", // Mark as completed so it's counted
              amount: 0, // Set amount to 0 since withdrawal was reversed
              processedAt: new Date(),
              description: `Withdrawal failed - credits returned to wallet: ${withdrawal.failureReason}`,
              "metadata.originalAmount": withdrawal.amountCredits,
              "metadata.failureReason": withdrawal.failureReason,
              "metadata.wasReversed": true,
            },
          },
          { session },
        );

        console.log(
          `💰 Refunded ${withdrawal.amountCredits} credits to user ${withdrawal.userId} due to failed withdrawal`,
        );
        break;
    }

    await withdrawal.save({ session });
    await session.commitTransaction();

    // Log action to audit log (after successful commit)
    const adminInfo = {
      id: admin.adminId || "unknown",
      email: admin.email || "unknown",
      name: admin.adminId,
      role: "admin" as const,
    };
    const userName = withdrawal.userName || withdrawal.userEmail || "Unknown";

    try {
      switch (action) {
        case "approved":
          await auditLogService.logWithdrawalApproved(
            adminInfo,
            withdrawal._id.toString(),
            withdrawal.userId,
            userName,
            withdrawal.amountEUR,
          );
          break;
        case "rejected":
          await auditLogService.logWithdrawalRejected(
            adminInfo,
            withdrawal._id.toString(),
            withdrawal.userId,
            userName,
            withdrawal.amountEUR,
            reason,
          );
          break;
        case "cancelled":
          await auditLogService.logWithdrawalCancelled(
            adminInfo,
            withdrawal._id.toString(),
            withdrawal.userId,
            userName,
            withdrawal.amountEUR,
            reason,
          );
          break;
        case "processing":
          await auditLogService.logWithdrawalProcessing(
            adminInfo,
            withdrawal._id.toString(),
            withdrawal.userId,
            userName,
            withdrawal.amountEUR,
          );
          break;
        case "completed":
          await auditLogService.logWithdrawalCompleted(
            adminInfo,
            withdrawal._id.toString(),
            withdrawal.userId,
            userName,
            withdrawal.amountEUR,
            withdrawal.netAmountEUR,
            withdrawal.payoutMethod || "manual",
          );
          break;
        case "failed":
          await auditLogService.logWithdrawalFailed(
            adminInfo,
            withdrawal._id.toString(),
            withdrawal.userId,
            userName,
            withdrawal.amountEUR,
            reason,
          );
          break;
      }
    } catch (logError) {
      console.error("Failed to log withdrawal action to audit log:", logError);
      // Don't fail the request if audit logging fails
    }

    // Send withdrawal completed email to user
    if (action === "completed" && withdrawal.userEmail) {
      try {
        const { sendWithdrawalCompletedEmail } =
          await import("@/lib/nodemailer");

        // Determine payment method display name
        let paymentMethodDisplay = "Bank Transfer";
        if (
          withdrawal.withdrawalMethod === "card_refund" ||
          withdrawal.payoutMethod === "card_refund" ||
          withdrawal.withdrawalMethod === "card_payout" ||
          withdrawal.payoutMethod === "card_payout" ||
          withdrawal.payoutMethod === "nuvei_card_payout"
        ) {
          paymentMethodDisplay = "Card Refund";
        } else if (
          withdrawal.payoutMethod === "sepa" ||
          withdrawal.withdrawalMethod === "bank_transfer"
        ) {
          paymentMethodDisplay = "Bank Transfer (SEPA)";
        }

        await sendWithdrawalCompletedEmail({
          email: withdrawal.userEmail,
          name: withdrawal.userName || withdrawal.userEmail.split("@")[0],
          credits: withdrawal.amountCredits,
          netAmount: withdrawal.netAmountEUR,
          fee: withdrawal.platformFee || 0,
          paymentMethod: paymentMethodDisplay,
          withdrawalId: withdrawal._id.toString().slice(-8).toUpperCase(),
          remainingBalance: withdrawal.walletBalanceAfter || 0,
        });
        console.log(
          `📧 Withdrawal completed email sent to ${withdrawal.userEmail}`,
        );
      } catch (emailError) {
        console.error("❌ Error sending withdrawal email:", emailError);
        // Don't fail the withdrawal if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: `Withdrawal ${action} successfully`,
      withdrawal,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error updating withdrawal:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update withdrawal" },
      { status: 500 },
    );
  } finally {
    session.endSession();
  }
}
