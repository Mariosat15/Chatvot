import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";

// --- Activity models (have a Mongoose model) ---------------------------------
import Competition from "@/database/models/trading/competition.model";
import CompetitionParticipant from "@/database/models/trading/competition-participant.model";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import TradingPosition from "@/database/models/trading/trading-position.model";
import TradeHistory from "@/database/models/trading/trade-history.model";
import TradingOrder from "@/database/models/trading/trading-order.model";
import PositionEvent from "@/database/models/position-event.model";
import CreditWallet from "@/database/models/trading/credit-wallet.model";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import WithdrawalRequest from "@/database/models/withdrawal-request.model";
import UserBankAccount from "@/database/models/user-bank-account.model";
import ReconciliationLog from "@/database/models/reconciliation-log.model";
import {
  PlatformTransaction,
  PlatformBalanceSnapshot,
} from "@/database/models/platform-financials.model";
import VATPayment from "@/database/models/vat-payment.model";
import Invoice from "@/database/models/invoice.model";
import DeviceFingerprint from "@/database/models/fraud/device-fingerprint.model";
import FraudAlert from "@/database/models/fraud/fraud-alert.model";
import { FraudHistory } from "@/database/models/fraud/fraud-history.model";
import SuspicionScore from "@/database/models/fraud/suspicion-score.model";
import PaymentFingerprint from "@/database/models/fraud/payment-fingerprint.model";
import BehavioralSimilarity from "@/database/models/fraud/behavioral-similarity.model";
import TradingBehaviorProfile from "@/database/models/fraud/trading-behavior-profile.model";
import UserLevel from "@/database/models/user-level.model";
import UserBadge from "@/database/models/user-badge.model";
import { UserPurchase } from "@/database/models/marketplace/user-purchase.model";
import { MarketplaceItem } from "@/database/models/marketplace/marketplace-item.model";
import UserJourneyProgress from "@/database/models/user-journey-progress.model";
import UserRestriction from "@/database/models/user-restriction.model";
import UserNotificationPreferences from "@/database/models/user-notification-preferences.model";
import Notification from "@/database/models/notification.model";
import UserNote from "@/database/models/user-notes.model";
import KYCSession from "@/database/models/kyc-session.model";
import UserPresence from "@/database/models/user-presence.model";
import AuditLog from "@/database/models/audit-log.model";
import SiteVisit from "@/database/models/site-visit.model";
import LandingPageVisit from "@/database/models/landing-page-visit.model";
import LandingPage from "@/database/models/landing-page.model";

/**
 * Single source of truth for the "reset" feature.
 *
 * RULE (confirmed with product owner):
 *   Delete ALL activity — both user actions AND admin actions (trades, financials,
 *   fraud data, notifications, sessions, audit trails, admin operation logs,
 *   visitor analytics, platform earnings, etc.).
 *   Preserve ALL configuration + identity so the admin panel keeps working exactly
 *   as-is after a reset (no need to re-enter any setting):
 *     - every *settings collection (app / fee / KYC / challenge / white-label / …)
 *     - employee & admin accounts (adminemployees), role templates
 *     - marketplace ITEMS (definitions/keys) — only the purchase counter is zeroed
 *     - vendors (vendor subscriptions + vendor payments)
 *     - notification TEMPLATES
 *     - journey milestones + journey map configs (journey design)
 *     - badge configs + XP/level configs (gamification design)
 *     - landing PAGES (only visit counters zeroed) + blocked-visitor rules
 *     - assignment_settings (auto-assign config)
 *     - price/market data + worker job scheduler (system infrastructure)
 *
 * Two entry modes share this logic:
 *   - "Reset All Data"  → deleteAccounts:false  (keep user accounts, zero wallets)
 *   - "Reset All Users" → deleteAccounts:true   (also delete user accounts+wallets)
 *
 * Idempotent and additive-safe: when a new activity collection is introduced,
 * add it to ACTIVITY_MODELS or ACTIVITY_RAW_COLLECTIONS and BOTH resets cover it.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous Mongoose models share only deleteMany()
type AnyModel = mongoose.Model<any>;

/**
 * Activity collections that have a Mongoose model.
 * The tuple key is the reporting label used in the API response.
 */
const ACTIVITY_MODELS: Array<[string, AnyModel]> = [
  // Trading activity
  ["competitions", Competition],
  ["participants", CompetitionParticipant],
  ["challenges", Challenge],
  ["challengeParticipants", ChallengeParticipant],
  ["positions", TradingPosition],
  ["tradeHistory", TradeHistory],
  ["orders", TradingOrder],
  ["positionEvents", PositionEvent],
  // Financial activity (user + platform earnings derived from user activity)
  ["walletTransactions", WalletTransaction],
  ["withdrawalRequests", WithdrawalRequest],
  ["userBankAccounts", UserBankAccount],
  ["reconciliationLogs", ReconciliationLog],
  ["platformTransactions", PlatformTransaction],
  ["platformSnapshots", PlatformBalanceSnapshot],
  ["vatPayments", VATPayment],
  ["invoices", Invoice],
  // Fraud / risk activity
  ["deviceFingerprints", DeviceFingerprint],
  ["fraudAlerts", FraudAlert],
  ["fraudHistory", FraudHistory],
  ["suspicionScores", SuspicionScore],
  ["paymentFingerprints", PaymentFingerprint],
  ["behavioralSimilarity", BehavioralSimilarity],
  ["tradingBehaviorProfiles", TradingBehaviorProfile],
  // Progress / rewards (earned, not the config)
  ["userLevels", UserLevel],
  ["userBadges", UserBadge],
  ["marketplacePurchases", UserPurchase],
  ["userJourneyProgress", UserJourneyProgress],
  // Misc user activity
  ["userRestrictions", UserRestriction],
  ["notificationPreferences", UserNotificationPreferences],
  ["notifications", Notification],
  ["userNotes", UserNote],
  ["kycSessions", KYCSession],
  ["userPresence", UserPresence],
  // Audit / operational logs (admin actions are activity too)
  ["auditLogs", AuditLog],
  // Visitor analytics (pages themselves are preserved below)
  ["siteVisits", SiteVisit],
  ["landingPageVisits", LandingPageVisit],
];

/**
 * Activity collections WITHOUT a dedicated Mongoose model — cleared by raw name.
 * (Names verified against the existing reset routes.)
 */
const ACTIVITY_RAW_COLLECTIONS: string[] = [
  // Auth session state (NOT "account" — that holds login credentials)
  "session",
  "accountlockouts",
  "verifications",
  // Stored payment instruments (user side)
  "nuveiuserpaymentoptions",
  // Presence / profile activity
  "useronlinestatuses",
  "userprofiles",
  // Price/system alerts fired to users
  "alerts",
  // Messaging activity
  "conversations",
  "messages",
  "friend_requests",
  "friendships",
  // Game-master / referral activity
  "gamemastersubscriptions",
  "userreferrals",
  "gamemasterearnings",
  // Automation activity
  "botexecutions",
  // Admin operational activity / logs (admin actions are deleted too)
  "customer_assignments",
  "customer_audit_trail",
  "employee_notifications",
  "incidents",
  "adminoperations",
  "aiagentaudits",
  "securitylogs",
];

/**
 * Documentation-only: configuration/identity that is intentionally PRESERVED.
 * Kept here so the preserve contract is explicit and reviewable in one place.
 */
export const PRESERVED_CONFIG_COLLECTIONS: string[] = [
  "*settings (app / fee / kyc / challenge / white-label / assignment_settings / …)",
  "adminemployees (employee + admin accounts)",
  "roletemplates",
  "marketplaceitems (item definitions/keys — purchase counter zeroed)",
  "vendorsubscriptions + vendorpayments (vendors)",
  "notificationtemplates",
  "journeymilestones + journeymapconfigs",
  "badgeconfigs + xpconfigs",
  "landingpages (visit counters zeroed) + blockedvisitors",
  "price/market data + worker jobs (system infrastructure)",
];

export interface WipeUserDataOptions {
  /** true = also delete user accounts + wallets; false = keep accounts, zero wallets. */
  deleteAccounts: boolean;
}

export interface WipeUserDataResult {
  deleted: Record<string, number>;
  walletsReset: number;
  accountsDeleted: number;
}

async function deleteViaModel(
  deleted: Map<string, number>,
  label: string,
  model: AnyModel,
): Promise<void> {
  try {
    const res = await model.deleteMany({});
    deleted.set(label, res?.deletedCount ?? 0);
  } catch (error) {
    console.warn(
      `⚠️ [RESET] Could not clear ${label}:`,
      error instanceof Error ? error.message : "Unknown error",
    );
    deleted.set(label, 0);
  }
}

async function deleteViaCollection(
  db: mongoose.mongo.Db,
  deleted: Map<string, number>,
  name: string,
): Promise<void> {
  try {
    const res = await db.collection(name).deleteMany({});
    deleted.set(name, res?.deletedCount ?? 0);
  } catch (error) {
    console.warn(
      `⚠️ [RESET] Could not clear ${name}:`,
      error instanceof Error ? error.message : "Unknown error",
    );
    deleted.set(name, 0);
  }
}

/**
 * Wipe all activity, preserve all configuration.
 * @throws if the database connection cannot be established.
 */
export async function wipeUserData(
  opts: WipeUserDataOptions,
): Promise<WipeUserDataResult> {
  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection failed");
  }

  const deleted = new Map<string, number>();

  // 1) Delete every activity collection (user + admin activity).
  for (const [label, model] of ACTIVITY_MODELS) {
    await deleteViaModel(deleted, label, model);
  }
  for (const name of ACTIVITY_RAW_COLLECTIONS) {
    await deleteViaCollection(db, deleted, name);
  }

  // 2) Zero activity-derived counters on preserved config docs.
  try {
    await MarketplaceItem.updateMany({}, { $set: { totalPurchases: 0 } });
  } catch (error) {
    console.warn(
      "⚠️ [RESET] Could not reset marketplace purchase counts:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
  try {
    await LandingPage.updateMany(
      {},
      { $set: { totalVisits: 0, uniqueVisitors: 0, totalSignups: 0 } },
    );
  } catch (error) {
    console.warn(
      "⚠️ [RESET] Could not reset landing page counters:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  // 3) Accounts + wallets.
  let walletsReset = 0;
  let accountsDeleted = 0;

  if (opts.deleteAccounts) {
    // "Reset All Users": remove the accounts and their wallets outright.
    await deleteViaModel(deleted, "creditWallets", CreditWallet);
    await deleteViaCollection(db, deleted, "account");
    const userRes = await db.collection("user").deleteMany({});
    accountsDeleted = userRes?.deletedCount ?? 0;
    deleted.set("user", accountsDeleted);
  } else {
    // "Reset All Data": keep accounts + login credentials, but wipe wallet activity.
    // Remove orphan wallets (owner no longer exists), then zero the rest.
    const userCol = db.collection("user");
    const existingUsers = await userCol
      .find({}, { projection: { _id: 1 } })
      .toArray();
    const existingUserIds = new Set(
      existingUsers.map((u) => u._id.toString()),
    );
    const allWallets = await CreditWallet.find({}, { userId: 1 }).lean();
    const orphanWalletIds = allWallets
      .filter((w) => !existingUserIds.has(String(w.userId)))
      .map((w) => w._id);
    if (orphanWalletIds.length > 0) {
      const orphanRes = await CreditWallet.deleteMany({
        _id: { $in: orphanWalletIds },
      });
      deleted.set("orphanWallets", orphanRes?.deletedCount ?? 0);
    } else {
      deleted.set("orphanWallets", 0);
    }

    const walletResetResult = await CreditWallet.updateMany(
      {},
      {
        $set: {
          creditBalance: 0,
          totalDeposited: 0,
          totalWithdrawn: 0,
          totalSpentOnCompetitions: 0,
          totalWonFromCompetitions: 0,
          totalSpentOnChallenges: 0,
          totalWonFromChallenges: 0,
          totalSpentOnMarketplace: 0,
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
    walletsReset = walletResetResult?.modifiedCount ?? 0;

    // Clear referral links (the GM data they pointed to has been deleted).
    await userCol.updateMany(
      { referredByGameMasterId: { $exists: true } },
      {
        $unset: {
          referredByGameMasterId: "",
          referredByReferralCode: "",
          referredAt: "",
        },
      },
    );
  }

  return {
    deleted: Object.fromEntries(deleted),
    walletsReset,
    accountsDeleted,
  };
}
