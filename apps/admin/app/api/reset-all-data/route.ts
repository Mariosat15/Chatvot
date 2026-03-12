import { NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import mongoose from "mongoose";
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import TradingPosition from "@/database/models/trading/trading-position.model";
import TradeHistory from "@/database/models/trading/trade-history.model";
import TradingOrder from "@/database/models/trading/trading-order.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import UserLevel from "@/database/models/user-level.model";
import UserBadge from "@/database/models/user-badge.model";
import UserRestriction from "@/database/models/user-restriction.model";
import DeviceFingerprint from "@/database/models/fraud/device-fingerprint.model";
import FraudAlert from "@/database/models/fraud/fraud-alert.model";
import { FraudHistory } from "@/database/models/fraud/fraud-history.model";
import SuspicionScore from "@/database/models/fraud/suspicion-score.model";
import PaymentFingerprint from "@/database/models/fraud/payment-fingerprint.model";
import BehavioralSimilarity from "@/database/models/fraud/behavioral-similarity.model";
import TradingBehaviorProfile from "@/database/models/fraud/trading-behavior-profile.model";
import {
  PlatformTransaction,
  PlatformBalanceSnapshot,
} from "@/database/models/platform-financials.model";
import VendorPayment from "@/database/models/vendor-payment.model";
import VendorSubscription from "@/database/models/vendor-subscription.model";
import VATPayment from "@/database/models/vat-payment.model";
import Invoice from "@/database/models/invoice.model";
import AuditLog from "@/database/models/audit-log.model";
import Notification from "@/database/models/notification.model";
import NotificationTemplate from "@/database/models/notification-template.model";
import { UserPurchase } from "@/database/models/marketplace/user-purchase.model";
import { MarketplaceItem } from "@/database/models/marketplace/marketplace-item.model";
import WithdrawalRequest from "@/database/models/withdrawal-request.model";
import UserBankAccount from "@/database/models/user-bank-account.model";
import ReconciliationLog from "@/database/models/reconciliation-log.model";
import KYCSession from "@/database/models/kyc-session.model";
import UserNote from "@/database/models/user-notes.model";
import PositionEvent from "@/database/models/position-event.model";
import UserNotificationPreferences from "@/database/models/user-notification-preferences.model";
import UserPresence from "@/database/models/user-presence.model";
import JourneyMilestone from "@/database/models/journey-milestone.model";
import JourneyMapConfig from "@/database/models/journey-map-config.model";
import UserJourneyProgress from "@/database/models/user-journey-progress.model";
import { resetBadgeAndXPConfigs } from "@/lib/services/badge-config-seed.service";
import { seedMilestonesFromDefaults } from "@/lib/services/whitelabel-defaults.service";
import { auditLogService } from "@/lib/services/audit-log.service";
import { getAdminSession } from "@/lib/admin/auth";
import SiteVisit from "@/database/models/site-visit.model";
import BlockedVisitor from "@/database/models/blocked-visitor.model";
import LandingPageVisit from "@/database/models/landing-page-visit.model";
import LandingPage from "@/database/models/landing-page.model";

/**
 * ⚠️ DANGER: Reset ALL trading data
 * This will DELETE everything except user accounts and settings:
 * - All competitions and competition participants
 * - All 1v1 challenges and challenge participants
 * - All trading positions
 * - All trade history
 * - All orders
 * - All wallet transactions (keeps wallets, resets balance)
 * - All user badges and XP progress
 * - All fraud alerts, device fingerprints, and fraud history
 * - All suspicion scores, payment fingerprints, behavioral similarity
 * - All trading behavior profiles
 * - All user restrictions
 * - All platform financial data (fees, unclaimed pools, earnings, etc.)
 * - All vendor payment records (keeps vendor subscriptions, clears payment history)
 * - All account lockouts
 * - All invoices
 * - All audit logs
 * - All sent notifications
 * - All marketplace user purchases (keeps items, removes user purchases)
 * - All withdrawal requests
 * - All user bank accounts
 * - All Nuvei payment options (stored UPOs)
 * - All auth sessions (Better Auth 'session' collection - keeps login credentials)
 * - All orphan credit wallets (where user no longer exists)
 * - All reconciliation logs (audit history)
 * - All KYC sessions and resets KYC status on all wallets
 * - All user notes (admin notes about users)
 * - All position events
 * - All user notification preferences
 * - All user presence data
 * - All chat conversations (support and user-to-user)
 * - All chat messages
 * - All friend requests
 * - All friendships
 * - All journey milestones (all 10 maps)
 * - All journey map configurations
 * - All user journey progress
 *
 * ✅ PRESERVES (will NOT delete):
 * - User accounts (the actual users in 'user' collection)
 * - WhiteLabel settings (environment variables, API keys)
 * - Payment provider configurations
 * - Admin settings (including fee settings, challenge settings)
 * - Marketplace items created by admin (only resets purchase counts)
 * - Dashboard layouts and preferences
 * - All settings collections (appsettings, challengesettings, etc.)
 * - KYC settings configuration (provider settings stay, session data deleted)
 *
 * ✅ RESETS TO DEFAULTS:
 * - Badge configurations
 * - XP and level progression settings
 * - Notification templates (reseeds defaults, preserves custom)
 * - Marketplace item purchase counts
 * - KYC verification status on all wallets (reset to 'none')
 *
 * POST /api/admin/reset-all-data
 */
export async function POST(request: Request) {
  try {
    const { confirmationCode } = await request.json();

    // Require confirmation code to prevent accidental deletion
    if (confirmationCode !== "RESET_ALL_DATA") {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid confirmation code. Must be exactly: RESET_ALL_DATA",
        },
        { status: 400 },
      );
    }

    await connectToDatabase();

    console.log("🚨🚨🚨 STARTING FULL DATA RESET 🚨🚨🚨");

    // Get collections directly via mongoose (for collections without explicit models)
    const sessionCollection = mongoose.connection.collection("session"); // Auth sessions (NOT account - that has credentials!)
    const userCollection = mongoose.connection.collection("user");
    const alertsCollection = mongoose.connection.collection("alerts");
    const botExecutionsCollection =
      mongoose.connection.collection("botexecutions");
    const nuveiPaymentOptionsCollection = mongoose.connection.collection(
      "nuveiuserpaymentoptions",
    );
    const customerAssignmentsCollection = mongoose.connection.collection(
      "customer_assignments",
    );
    const customerAuditTrailsCollection = mongoose.connection.collection(
      "customer_audit_trail",
    );
    const assignmentSettingsCollection = mongoose.connection.collection(
      "assignment_settings",
    );
    const employeeNotificationsCollection = mongoose.connection.collection(
      "employee_notifications",
    );
    // Messaging collections
    const conversationsCollection =
      mongoose.connection.collection("conversations");
    const messagesCollection = mongoose.connection.collection("messages");
    const friendRequestsCollection =
      mongoose.connection.collection("friend_requests");
    const friendshipsCollection = mongoose.connection.collection("friendships");
    // Additional collections to reset
    const userProfilesCollection =
      mongoose.connection.collection("userprofiles");
    const workerJobsCollection = mongoose.connection.collection("worker_jobs");

    // Get all existing user IDs
    const existingUsers = await userCollection
      .find({}, { projection: { _id: 1 } })
      .toArray();
    const existingUserIds = new Set(existingUsers.map((u) => u._id.toString()));

    // Count orphan wallets (wallets where userId doesn't exist in user collection)
    const allWallets = await CreditWallet.find({}, { userId: 1 }).lean();
    const orphanWalletIds = allWallets
      .filter((w) => !existingUserIds.has(w.userId.toString()))
      .map((w) => w._id);

    // Count documents before deletion
    // Use estimatedDocumentCount() (O(1) metadata read) instead of countDocuments() (full scan)
    // These are unfiltered counts — estimatedDocumentCount is accurate for total collection size
    const before = {
      competitions: await Competition.estimatedDocumentCount(),
      participants: await CompetitionParticipant.estimatedDocumentCount(),
      challenges: await Challenge.estimatedDocumentCount(),
      challengeParticipants: await ChallengeParticipant.estimatedDocumentCount(),
      positions: await TradingPosition.estimatedDocumentCount(),
      tradeHistory: await TradeHistory.estimatedDocumentCount(),
      orders: await TradingOrder.estimatedDocumentCount(),
      walletTransactions: await WalletTransaction.estimatedDocumentCount(),
      wallets: await CreditWallet.estimatedDocumentCount(),
      orphanWallets: orphanWalletIds.length,
      userLevels: await UserLevel.estimatedDocumentCount(),
      userBadges: await UserBadge.estimatedDocumentCount(),
      fraudAlerts: await FraudAlert.estimatedDocumentCount(),
      deviceFingerprints: await DeviceFingerprint.estimatedDocumentCount(),
      userRestrictions: await UserRestriction.estimatedDocumentCount(),
      fraudHistory: await FraudHistory.estimatedDocumentCount(),
      suspicionScores: await SuspicionScore.estimatedDocumentCount(),
      paymentFingerprints: await PaymentFingerprint.estimatedDocumentCount(),
      behavioralSimilarity: await BehavioralSimilarity.estimatedDocumentCount(),
      tradingBehaviorProfiles: await TradingBehaviorProfile.estimatedDocumentCount(),
      platformTransactions: await PlatformTransaction.estimatedDocumentCount(),
      platformSnapshots: await PlatformBalanceSnapshot.estimatedDocumentCount(),
      vendorPayments: await VendorPayment.estimatedDocumentCount(),
      vatPayments: await VATPayment.estimatedDocumentCount(),
      invoices: await Invoice.estimatedDocumentCount(),
      auditLogs: await AuditLog.estimatedDocumentCount(),
      notifications: await Notification.estimatedDocumentCount(),
      marketplacePurchases: await UserPurchase.estimatedDocumentCount(),
      withdrawalRequests: await WithdrawalRequest.estimatedDocumentCount(),
      userBankAccounts: await UserBankAccount.estimatedDocumentCount(),
      nuveiPaymentOptions: await nuveiPaymentOptionsCollection.estimatedDocumentCount(),
      authSessions: await sessionCollection.estimatedDocumentCount(),
      alerts: await alertsCollection.estimatedDocumentCount(),
      botExecutions: await botExecutionsCollection.estimatedDocumentCount(),
      reconciliationLogs: await ReconciliationLog.estimatedDocumentCount(),
      kycSessions: await KYCSession.estimatedDocumentCount(),
      userNotes: await UserNote.estimatedDocumentCount(),
      positionEvents: await PositionEvent.estimatedDocumentCount(),
      notificationPreferences:
        await UserNotificationPreferences.estimatedDocumentCount(),
      userPresence: await UserPresence.estimatedDocumentCount(),
      customerAssignments: await customerAssignmentsCollection.estimatedDocumentCount(),
      customerAuditTrails: await customerAuditTrailsCollection.estimatedDocumentCount(),
      // Messaging data
      conversations: await conversationsCollection.estimatedDocumentCount(),
      messages: await messagesCollection.estimatedDocumentCount(),
      friendRequests: await friendRequestsCollection.estimatedDocumentCount(),
      friendships: await friendshipsCollection.estimatedDocumentCount(),
      // Additional collections
      userProfiles: await userProfilesCollection.estimatedDocumentCount(),
      workerJobs: await workerJobsCollection.estimatedDocumentCount(),
      // Journey data
      journeyMilestones: await JourneyMilestone.estimatedDocumentCount(),
      journeyMapConfigs: await JourneyMapConfig.estimatedDocumentCount(),
      userJourneyProgress: await UserJourneyProgress.estimatedDocumentCount(),
      // Visitor tracking data
      siteVisits: await SiteVisit.estimatedDocumentCount(),
      blockedVisitors: await BlockedVisitor.estimatedDocumentCount(),
      landingPageVisits: await LandingPageVisit.estimatedDocumentCount(),
    };

    console.log("📊 Before deletion:", before);

    // Delete all trading data
    await Competition.deleteMany({});
    console.log("✅ Deleted all competitions");

    await CompetitionParticipant.deleteMany({});
    console.log("✅ Deleted all competition participants");

    // Delete all challenge data
    await Challenge.deleteMany({});
    console.log("✅ Deleted all 1v1 challenges");

    await ChallengeParticipant.deleteMany({});
    console.log("✅ Deleted all challenge participants");

    await TradingPosition.deleteMany({});
    console.log("✅ Deleted all positions");

    await TradeHistory.deleteMany({});
    console.log("✅ Deleted all trade history");

    await TradingOrder.deleteMany({});
    console.log("✅ Deleted all orders");

    await WalletTransaction.deleteMany({});
    console.log("✅ Deleted all wallet transactions");

    // Delete user progress data
    await UserLevel.deleteMany({});
    console.log("✅ Deleted all user XP and levels");

    await UserBadge.deleteMany({});
    console.log("✅ Deleted all user badges");

    // Delete fraud detection data
    await FraudAlert.deleteMany({});
    console.log("✅ Deleted all fraud alerts");

    await DeviceFingerprint.deleteMany({});
    console.log("✅ Deleted all device fingerprints");

    await UserRestriction.deleteMany({});
    console.log("✅ Deleted all user restrictions");

    // Delete fraud history
    await FraudHistory.deleteMany({});
    console.log("✅ Deleted all fraud history");

    // Delete suspicion scores
    await SuspicionScore.deleteMany({});
    console.log("✅ Deleted all suspicion scores");

    // Delete payment fingerprints
    await PaymentFingerprint.deleteMany({});
    console.log("✅ Deleted all payment fingerprints");

    // Delete behavioral similarity
    await BehavioralSimilarity.deleteMany({});
    console.log("✅ Deleted all behavioral similarity records");

    // Delete trading behavior profiles
    await TradingBehaviorProfile.deleteMany({});
    console.log("✅ Deleted all trading behavior profiles");

    // Delete platform financial data (fees, unclaimed pools, etc.)
    await PlatformTransaction.deleteMany({});
    console.log("✅ Deleted all platform transactions (fees, unclaimed pools)");

    await PlatformBalanceSnapshot.deleteMany({});
    console.log("✅ Deleted all platform balance snapshots");

    // Delete vendor payment records (keeps vendor subscriptions, clears payment history)
    await VendorPayment.deleteMany({});
    console.log("✅ Deleted all vendor payment records");

    // Clear payment history from vendor subscriptions and reset last payment date
    await VendorSubscription.updateMany(
      {},
      { $set: { paymentHistory: [], reminderSent: false }, $unset: { lastPaymentDate: "" } },
    );
    console.log("✅ Cleared vendor subscription payment history");

    // Delete account lockouts
    const accountLockoutsCollection = mongoose.connection.collection("accountlockouts");
    try {
      const lockoutsDeleted = await accountLockoutsCollection.deleteMany({});
      console.log(`✅ Deleted ${lockoutsDeleted.deletedCount} account lockouts`);
    } catch (e) {
      console.log("⚠️ No account lockouts collection found");
    }

    // Delete VAT payments
    await VATPayment.deleteMany({});
    console.log("✅ Deleted all VAT payments");

    // Delete invoices
    await Invoice.deleteMany({});
    console.log("✅ Deleted all invoices");

    // Delete audit logs
    await AuditLog.deleteMany({});
    console.log("✅ Deleted all audit logs");

    // Delete notifications (sent notifications, NOT templates)
    await Notification.deleteMany({});
    console.log("✅ Deleted all notifications");

    // Delete marketplace user purchases (keeps marketplace items, just clears user purchases)
    await UserPurchase.deleteMany({});
    console.log("✅ Deleted all marketplace user purchases");

    // Delete all withdrawal requests
    await WithdrawalRequest.deleteMany({});
    console.log("✅ Deleted all withdrawal requests");

    // Delete all user bank accounts
    await UserBankAccount.deleteMany({});
    console.log("✅ Deleted all user bank accounts");

    // Delete all Nuvei payment options (stored UPOs)
    const nuveiDeleted = await nuveiPaymentOptionsCollection.deleteMany({});
    console.log(
      `✅ Deleted ${nuveiDeleted.deletedCount} Nuvei payment options`,
    );

    // Delete all auth sessions (Better Auth 'session' collection - NOT 'account' which has credentials!)
    const authSessionsDeleted = await sessionCollection.deleteMany({});
    console.log(`✅ Deleted ${authSessionsDeleted.deletedCount} auth sessions`);

    // Delete alerts collection data (price alerts, system alerts)
    const alertsDeleted = await alertsCollection.deleteMany({});
    console.log(`✅ Deleted ${alertsDeleted.deletedCount} alerts`);

    // Delete bot executions collection data
    const botExecutionsDeleted = await botExecutionsCollection.deleteMany({});
    console.log(
      `✅ Deleted ${botExecutionsDeleted.deletedCount} bot executions`,
    );

    // Delete reconciliation logs (audit data)
    await ReconciliationLog.deleteMany({});
    console.log("✅ Deleted all reconciliation logs");

    // Delete ALL KYC sessions
    await KYCSession.deleteMany({});
    console.log("✅ Deleted all KYC sessions");

    // Delete all user notes
    await UserNote.deleteMany({});
    console.log("✅ Deleted all user notes");

    // Delete all position events
    await PositionEvent.deleteMany({});
    console.log("✅ Deleted all position events");

    // Delete all user notification preferences
    await UserNotificationPreferences.deleteMany({});
    console.log("✅ Deleted all user notification preferences");

    // Delete all user presence data
    await UserPresence.deleteMany({});
    console.log("✅ Deleted all user presence data");

    // Delete all customer assignments (employee-customer relationships)
    const customerAssignmentsDeleted =
      await customerAssignmentsCollection.deleteMany({});
    console.log(
      `✅ Deleted ${customerAssignmentsDeleted.deletedCount} customer assignments`,
    );

    // Delete all customer audit trails (employee actions on customers)
    const customerAuditTrailsDeleted =
      await customerAuditTrailsCollection.deleteMany({});
    console.log(
      `✅ Deleted ${customerAuditTrailsDeleted.deletedCount} customer audit trail entries`,
    );

    // Reset assignment settings to defaults
    await assignmentSettingsCollection.deleteMany({});
    console.log("✅ Reset assignment settings");

    // Delete all employee notifications
    const employeeNotificationsDeleted =
      await employeeNotificationsCollection.deleteMany({});
    console.log(
      `✅ Deleted ${employeeNotificationsDeleted.deletedCount} employee notifications`,
    );

    // Delete all messaging data (conversations, messages, friends)
    const conversationsDeleted = await conversationsCollection.deleteMany({});
    console.log(
      `✅ Deleted ${conversationsDeleted.deletedCount} chat conversations`,
    );

    const messagesDeleted = await messagesCollection.deleteMany({});
    console.log(`✅ Deleted ${messagesDeleted.deletedCount} chat messages`);

    const friendRequestsDeleted = await friendRequestsCollection.deleteMany({});
    console.log(
      `✅ Deleted ${friendRequestsDeleted.deletedCount} friend requests`,
    );

    const friendshipsDeleted = await friendshipsCollection.deleteMany({});
    console.log(`✅ Deleted ${friendshipsDeleted.deletedCount} friendships`);

    // Delete user profiles
    const userProfilesDeleted = await userProfilesCollection.deleteMany({});
    console.log(`✅ Deleted ${userProfilesDeleted.deletedCount} user profiles`);

    // Delete worker jobs
    const workerJobsDeleted = await workerJobsCollection.deleteMany({});
    console.log(`✅ Deleted ${workerJobsDeleted.deletedCount} worker jobs`);

    // ============================================
    // DELETE JOURNEY DATA
    // ============================================

    // Delete all journey milestones
    const journeyMilestonesDeleted = await JourneyMilestone.deleteMany({});
    console.log(`✅ Deleted ${journeyMilestonesDeleted.deletedCount} journey milestones`);

    // Delete all journey map configs
    const journeyMapConfigsDeleted = await JourneyMapConfig.deleteMany({});
    console.log(`✅ Deleted ${journeyMapConfigsDeleted.deletedCount} journey map configs`);

    // Delete all user journey progress
    const userJourneyProgressDeleted = await UserJourneyProgress.deleteMany({});
    console.log(`✅ Deleted ${userJourneyProgressDeleted.deletedCount} user journey progress records`);

    // Reseed milestones from saved white-label defaults (if available)
    const milestonesReseeded = await seedMilestonesFromDefaults();
    if (milestonesReseeded) {
      console.log("✅ Journey milestones reseeded from saved white-label defaults");
    } else {
      console.log("ℹ️ No saved milestone defaults found — milestones will be empty until regenerated");
    }

    // ============================================
    // DELETE GAME MASTER DATA
    // ============================================

    // Delete all GM subscriptions
    const gmSubscriptionsCollection = mongoose.connection.collection(
      "gamemastersubscriptions",
    );
    const gmSubsDeleted = await gmSubscriptionsCollection.deleteMany({});
    console.log(`✅ Deleted ${gmSubsDeleted.deletedCount} GM subscriptions`);

    // Delete all user referrals
    const userReferralsCollection =
      mongoose.connection.collection("userreferrals");
    const userRefsDeleted = await userReferralsCollection.deleteMany({});
    console.log(`✅ Deleted ${userRefsDeleted.deletedCount} user referrals`);

    // Delete all GM earnings
    const gmEarningsCollection =
      mongoose.connection.collection("gamemasterearnings");
    const gmEarningsDeleted = await gmEarningsCollection.deleteMany({});
    console.log(`✅ Deleted ${gmEarningsDeleted.deletedCount} GM earnings`);

    // Clear referredByGameMasterId from all users
    await userCollection.updateMany(
      { referredByGameMasterId: { $exists: true } },
      {
        $unset: {
          referredByGameMasterId: "",
          referredByReferralCode: "",
          referredAt: "",
        },
      },
    );
    console.log("✅ Cleared referral data from all users");

    // ============================================
    // DELETE ADMIN OPERATIONS DATA
    // ============================================

    // Delete all incidents
    const incidentsCollection = mongoose.connection.collection("incidents");
    const incidentsDeleted = await incidentsCollection.deleteMany({});
    console.log(`✅ Deleted ${incidentsDeleted.deletedCount} incidents`);

    // Delete price snapshots
    const priceSnapshotsCollection =
      mongoose.connection.collection("pricesnapshots");
    const priceSnapshotsDeleted = await priceSnapshotsCollection.deleteMany({});
    console.log(
      `✅ Deleted ${priceSnapshotsDeleted.deletedCount} price snapshots`,
    );

    // Delete price health records
    const priceHealthCollection =
      mongoose.connection.collection("pricehealthrecords");
    try {
      const priceHealthDeleted = await priceHealthCollection.deleteMany({});
      console.log(
        `✅ Deleted ${priceHealthDeleted.deletedCount} price health records`,
      );
    } catch (e) {
      console.log("⚠️ No price health records collection found");
    }

    // Delete admin operation logs (if separate from audit logs)
    const adminOperationsCollection =
      mongoose.connection.collection("adminoperations");
    try {
      const adminOpsDeleted = await adminOperationsCollection.deleteMany({});
      console.log(
        `✅ Deleted ${adminOpsDeleted.deletedCount} admin operations`,
      );
    } catch (e) {
      console.log("⚠️ No admin operations collection found");
    }

    // Delete AI agent audits
    const aiAgentAuditsCollection =
      mongoose.connection.collection("aiagentaudits");
    try {
      const aiAuditsDeleted = await aiAgentAuditsCollection.deleteMany({});
      console.log(`✅ Deleted ${aiAuditsDeleted.deletedCount} AI agent audits`);
    } catch (e) {
      console.log("⚠️ No AI agent audits collection found");
    }

    // Delete historical fetch status
    const historicalFetchStatusCollection = mongoose.connection.collection(
      "historical_fetch_status",
    );
    try {
      const historicalFetchDeleted =
        await historicalFetchStatusCollection.deleteMany({});
      console.log(
        `✅ Deleted ${historicalFetchDeleted.deletedCount} historical fetch status records`,
      );
    } catch (e) {
      console.log("⚠️ No historical fetch status collection found");
    }

    // Delete price caches
    const priceCachesCollection = mongoose.connection.collection("pricecaches");
    try {
      const priceCachesDeleted = await priceCachesCollection.deleteMany({});
      console.log(`✅ Deleted ${priceCachesDeleted.deletedCount} price caches`);
    } catch (e) {
      console.log("⚠️ No price caches collection found");
    }

    // Delete price health alerts
    const priceHealthAlertsCollection =
      mongoose.connection.collection("pricehealthalerts");
    try {
      const priceHealthAlertsDeleted =
        await priceHealthAlertsCollection.deleteMany({});
      console.log(
        `✅ Deleted ${priceHealthAlertsDeleted.deletedCount} price health alerts`,
      );
    } catch (e) {
      console.log("⚠️ No price health alerts collection found");
    }

    // Delete price logs
    const priceLogsCollection = mongoose.connection.collection("pricelogs");
    try {
      const priceLogsDeleted = await priceLogsCollection.deleteMany({});
      console.log(`✅ Deleted ${priceLogsDeleted.deletedCount} price logs`);
    } catch (e) {
      console.log("⚠️ No price logs collection found");
    }

    // Delete security logs
    const securityLogsCollection =
      mongoose.connection.collection("securitylogs");
    try {
      const securityLogsDeleted = await securityLogsCollection.deleteMany({});
      console.log(
        `✅ Deleted ${securityLogsDeleted.deletedCount} security logs`,
      );
    } catch (e) {
      console.log("⚠️ No security logs collection found");
    }

    // ============================================
    // DELETE VISITOR TRACKING DATA
    // ============================================

    // Delete all site visits
    const siteVisitsDeleted = await SiteVisit.deleteMany({});
    console.log(`✅ Deleted ${siteVisitsDeleted.deletedCount} site visits`);

    // Delete all blocked visitor rules
    const blockedVisitorsDeleted = await BlockedVisitor.deleteMany({});
    console.log(`✅ Deleted ${blockedVisitorsDeleted.deletedCount} blocked visitor rules`);

    // Delete all landing page visits
    const lpVisitsDeleted = await LandingPageVisit.deleteMany({});
    console.log(`✅ Deleted ${lpVisitsDeleted.deletedCount} landing page visits`);

    // Reset landing page counters
    await LandingPage.updateMany(
      {},
      { $set: { totalVisits: 0, uniqueVisitors: 0, totalSignups: 0 } },
    );
    console.log("✅ Reset landing page visit counters");

    // Delete orphan credit wallets (where user no longer exists)
    if (orphanWalletIds.length > 0) {
      const orphanDeleteResult = await CreditWallet.deleteMany({
        _id: { $in: orphanWalletIds },
      });
      console.log(
        `✅ Deleted ${orphanDeleteResult.deletedCount} orphan credit wallets`,
      );
    }

    // Reset marketplace item purchase counts
    await MarketplaceItem.updateMany({}, { $set: { totalPurchases: 0 } });
    console.log("✅ Reset marketplace item purchase counts");

    // Reseed default notification templates (preserves custom templates)
    await NotificationTemplate.seedDefaults();
    console.log("✅ Reseeded default notification templates");

    // Reset all wallet balances to 0 (keep wallets, just reset all financial data)
    const walletResetResult = await CreditWallet.updateMany(
      {},
      {
        $set: {
          creditBalance: 0, // Reset current balance
          totalDeposited: 0, // Reset total deposits
          totalWithdrawn: 0, // Reset total withdrawals
          totalSpentOnCompetitions: 0, // Reset competition spending
          totalWonFromCompetitions: 0, // Reset competition winnings (Volt Won)
          totalSpentOnChallenges: 0, // Reset challenge spending
          totalWonFromChallenges: 0, // Reset challenge winnings
          totalSpentOnMarketplace: 0, // Reset marketplace spending
          // Reset KYC status fields
          kycVerified: false,
          kycStatus: "none",
          kycAttempts: 0,
        },
        $unset: {
          kycVerifiedAt: "",
          kycExpiresAt: "",
          lastKYCSessionId: "",
        },
      },
    );
    console.log(
      `✅ Reset ${walletResetResult.modifiedCount} wallet balances to 0 (including balances, competition/challenge winnings, KYC status)`,
    );

    // Reset badge and XP configurations to defaults
    await resetBadgeAndXPConfigs();
    console.log("✅ Reset badge and XP configurations to defaults");

    // Count documents after deletion (O(1) metadata reads)
    const after = {
      competitions: await Competition.estimatedDocumentCount(),
      participants: await CompetitionParticipant.estimatedDocumentCount(),
      challenges: await Challenge.estimatedDocumentCount(),
      challengeParticipants: await ChallengeParticipant.estimatedDocumentCount(),
      positions: await TradingPosition.estimatedDocumentCount(),
      tradeHistory: await TradeHistory.estimatedDocumentCount(),
      orders: await TradingOrder.estimatedDocumentCount(),
      walletTransactions: await WalletTransaction.estimatedDocumentCount(),
      wallets: await CreditWallet.estimatedDocumentCount(),
      orphanWallets: 0, // All orphans deleted
      userLevels: await UserLevel.estimatedDocumentCount(),
      userBadges: await UserBadge.estimatedDocumentCount(),
      fraudAlerts: await FraudAlert.estimatedDocumentCount(),
      deviceFingerprints: await DeviceFingerprint.estimatedDocumentCount(),
      userRestrictions: await UserRestriction.estimatedDocumentCount(),
      fraudHistory: await FraudHistory.estimatedDocumentCount(),
      suspicionScores: await SuspicionScore.estimatedDocumentCount(),
      paymentFingerprints: await PaymentFingerprint.estimatedDocumentCount(),
      behavioralSimilarity: await BehavioralSimilarity.estimatedDocumentCount(),
      tradingBehaviorProfiles: await TradingBehaviorProfile.estimatedDocumentCount(),
      platformTransactions: await PlatformTransaction.estimatedDocumentCount(),
      platformSnapshots: await PlatformBalanceSnapshot.estimatedDocumentCount(),
      vendorPayments: await VendorPayment.estimatedDocumentCount(),
      vatPayments: await VATPayment.estimatedDocumentCount(),
      invoices: await Invoice.estimatedDocumentCount(),
      auditLogs: await AuditLog.estimatedDocumentCount(),
      notifications: await Notification.estimatedDocumentCount(),
      marketplacePurchases: await UserPurchase.estimatedDocumentCount(),
      withdrawalRequests: await WithdrawalRequest.estimatedDocumentCount(),
      userBankAccounts: await UserBankAccount.estimatedDocumentCount(),
      nuveiPaymentOptions: await nuveiPaymentOptionsCollection.estimatedDocumentCount(),
      authSessions: await sessionCollection.estimatedDocumentCount(),
      alerts: await alertsCollection.estimatedDocumentCount(),
      botExecutions: await botExecutionsCollection.estimatedDocumentCount(),
      reconciliationLogs: await ReconciliationLog.estimatedDocumentCount(),
      kycSessions: await KYCSession.estimatedDocumentCount(),
      userNotes: await UserNote.estimatedDocumentCount(),
      positionEvents: await PositionEvent.estimatedDocumentCount(),
      notificationPreferences:
        await UserNotificationPreferences.estimatedDocumentCount(),
      userPresence: await UserPresence.estimatedDocumentCount(),
      customerAssignments: await customerAssignmentsCollection.estimatedDocumentCount(),
      customerAuditTrails: await customerAuditTrailsCollection.estimatedDocumentCount(),
      // Messaging data
      conversations: await conversationsCollection.estimatedDocumentCount(),
      messages: await messagesCollection.estimatedDocumentCount(),
      friendRequests: await friendRequestsCollection.estimatedDocumentCount(),
      friendships: await friendshipsCollection.estimatedDocumentCount(),
      // Additional collections
      userProfiles: await userProfilesCollection.estimatedDocumentCount(),
      workerJobs: await workerJobsCollection.estimatedDocumentCount(),
      // Journey data
      journeyMilestones: await JourneyMilestone.estimatedDocumentCount(),
      journeyMapConfigs: await JourneyMapConfig.estimatedDocumentCount(),
      userJourneyProgress: await UserJourneyProgress.estimatedDocumentCount(),
      // Visitor tracking data
      siteVisits: await SiteVisit.estimatedDocumentCount(),
      blockedVisitors: await BlockedVisitor.estimatedDocumentCount(),
      landingPageVisits: await LandingPageVisit.estimatedDocumentCount(),
    };

    console.log("📊 After deletion:", after);
    console.log("🎉 DATA RESET COMPLETE");

    // Log this action to audit log
    try {
      const admin = await getAdminSession();
      if (admin) {
        await auditLogService.logDatabaseReset(
          {
            id: admin.id,
            email: admin.email,
            name: admin.email.split("@")[0],
            role: "admin",
          },
          before,
        );
      }
    } catch (auditError) {
      console.error("Failed to log audit action:", auditError);
    }

    return NextResponse.json({
      success: true,
      message:
        "All trading data has been reset and badge/XP configs restored to defaults",
      before,
      after,
      deleted: {
        competitions: before.competitions,
        participants: before.participants,
        challenges: before.challenges,
        challengeParticipants: before.challengeParticipants,
        positions: before.positions,
        tradeHistory: before.tradeHistory,
        orders: before.orders,
        walletTransactions: before.walletTransactions,
        orphanWallets: before.orphanWallets,
        userLevels: before.userLevels,
        userBadges: before.userBadges,
        fraudAlerts: before.fraudAlerts,
        deviceFingerprints: before.deviceFingerprints,
        userRestrictions: before.userRestrictions,
        fraudHistory: before.fraudHistory,
        suspicionScores: before.suspicionScores,
        paymentFingerprints: before.paymentFingerprints,
        behavioralSimilarity: before.behavioralSimilarity,
        tradingBehaviorProfiles: before.tradingBehaviorProfiles,
        platformTransactions: before.platformTransactions,
        platformSnapshots: before.platformSnapshots,
        vendorPayments: before.vendorPayments,
        vatPayments: before.vatPayments,
        invoices: before.invoices,
        auditLogs: before.auditLogs,
        marketplacePurchases: before.marketplacePurchases,
        withdrawalRequests: before.withdrawalRequests,
        userBankAccounts: before.userBankAccounts,
        nuveiPaymentOptions: before.nuveiPaymentOptions,
        authSessions: before.authSessions,
        alerts: before.alerts,
        botExecutions: before.botExecutions,
        reconciliationLogs: before.reconciliationLogs,
        kycSessions: before.kycSessions,
        userNotes: before.userNotes,
        positionEvents: before.positionEvents,
        notificationPreferences: before.notificationPreferences,
        userPresence: before.userPresence,
        customerAssignments: before.customerAssignments,
        customerAuditTrails: before.customerAuditTrails,
        // Messaging data
        conversations: before.conversations,
        messages: before.messages,
        friendRequests: before.friendRequests,
        friendships: before.friendships,
        // Additional collections
        userProfiles: before.userProfiles,
        workerJobs: before.workerJobs,
        // Journey data
        journeyMilestones: before.journeyMilestones,
        journeyMapConfigs: before.journeyMapConfigs,
        userJourneyProgress: before.userJourneyProgress,
        // Visitor tracking data
        siteVisits: before.siteVisits,
        blockedVisitors: before.blockedVisitors,
        landingPageVisits: before.landingPageVisits,
      },
      walletsReset: walletResetResult.modifiedCount,
    });
  } catch (error) {
    console.error("❌ Error resetting data:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to reset data",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
