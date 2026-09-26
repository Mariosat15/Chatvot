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
 * Activity collections cleared by RAW NAME rather than through a model.
 *
 * Most of these have no Mongoose model at all (Better Auth's own collections,
 * the messaging feature's), and the rest are declared only in the MAIN app —
 * `apps/admin` has no copy to import, which is the whole reason a raw name is
 * used. Note it is also the dangerous direction: `deleteMany` against a name
 * that does not exist returns 0 and the reset still reports success, so a typo
 * or a renamed collection is indistinguishable from an empty one. Every name
 * here is checked against the collections the two apps' models actually declare
 * by `__tests__/admin/user-data-reset-coverage.test.ts`.
 */
const ACTIVITY_RAW_COLLECTIONS: string[] = [
  // Auth session state (NOT "account" — that holds login credentials)
  "session",
  "accountlockouts",
  "verifications",
  // Consent and agreement records the player signed
  "termsacceptances",
  // Stored payment instruments (user side)
  "nuveiuserpaymentoptions",
  // Payment disputes raised against a player's deposits.
  //
  // Reason: R87. These are per-user case files with evidence, notes and a
  // clawback history, and they outlived every reset — which is what the owner
  // reported. They also reference `wallettransactions` rows the reset deletes,
  // so keeping them leaves a case pointing at a ledger that no longer exists.
  "chargebacks",
  // Presence / profile activity.
  //
  // `userpresences` is cleared through the UserPresence model above. The
  // messaging feature declares its OWN `user_presence` collection, which is a
  // different collection with a near-identical name — so it survived every
  // reset while the list looked complete.
  "user_presence",
  "useronlinestatuses",
  // Price/system alerts fired to users
  "pricehealthalerts",
  "securityalerts",
  // Messaging activity
  "conversations",
  "messages",
  "friend_requests",
  "friendships",
  "blocked_users",
  // Game activity (rounds a player played, and the provider deliveries that
  // resolved them — a kept event points at a round that no longer exists)
  "game_round",
  "provider_event",
  "user_game_preference",
  // Per-player cross-game standings written at settlement (X7) — earned data,
  // not catalogue design, so it clears with the rest of activity
  "user_game_stats",
  // Game-master / referral activity
  "gamemastersubscriptions",
  "userreferrals",
  "gamemasterearnings",
  // Admin operational activity / logs (admin actions are deleted too)
  "customer_assignments",
  "customer_audit_trail",
  "employee_notifications",
  "incidents",
  "aiagentaudits",
  "securitylogs",
  // Dev-zone run history. The CONFIGS these ran from (`simulatorconfigs`,
  // `attack_suite_configs`, `testschedules`) are preserved — only the record of
  // what was run is activity.
  "simulatorruns",
  "attackruns",
  "testruns",
  "tutorialuploadsessions",
  // LEGACY NAMES — matched by no model in either app today.
  //
  // Kept deliberately rather than tidied away: an older deployment may still
  // hold rows under these names, and a `deleteMany` against a collection that
  // does not exist costs one no-op round trip. They are listed separately so
  // the list does not read as though every name in it is live — which is
  // exactly how `"alerts"` sat here for months deleting nothing while the real
  // collection (`pricehealthalerts`) was never touched.
  "userprofiles",
  "botexecutions",
  "adminoperations",
];

/**
 * Names in ACTIVITY_RAW_COLLECTIONS that intentionally match no declared model.
 * Exported so the coverage guard can tell a legacy name from a typo.
 */
export const LEGACY_RAW_COLLECTIONS: string[] = [
  "userprofiles",
  "botexecutions",
  "adminoperations",
  // Better Auth owns these; they have no Mongoose model by design.
  "session",
  "verifications",
  "useronlinestatuses",
];

/**
 * Collections the reset neither deletes nor leaves alone: the DOCUMENT survives
 * and counters on it are zeroed.
 *
 * A third category rather than a shade of "preserved", because calling a wallet
 * preserved would hide the thing R86 was about — the counters on it are money
 * figures reconciliation compares against a ledger the reset empties, so a
 * counter left behind invents a mismatch for activity that no longer exists.
 */
export const ZEROED_COLLECTIONS: string[] = [
  "creditwallets", // balance + all 14 lifetime counters (deleted outright when accounts are)
  "landingpages", // visit counters
  "marketplaceitems", // purchase counter
];

/**
 * Configuration and identity that is intentionally PRESERVED, by collection
 * name. Every collection either app's models declare must appear either in the
 * delete lists above or here — enforced by
 * `__tests__/admin/user-data-reset-coverage.test.ts`, so a model added later
 * cannot quietly end up in neither.
 */
export const PRESERVED_CONFIG_COLLECTIONS: string[] = [
  // Settings — one document each, the whole point of preserving them
  "appsettings",
  "assignment_settings",
  "challengesettings",
  "companysettings",
  "competitionrules",
  "cookieconsents", // the consent BANNER's settings, not per-user consent
  "creditconversionsettings",
  "fraudsettings",
  "herosettings",
  "invoicesettings",
  "kycsettings",
  "market_data_settings",
  "marketsettings",
  "mdbclustersettings",
  "messaging_settings",
  "tradingrisksettings",
  "whitelabels",
  "withdrawalsettings",
  // Employee / admin identity and permissions
  "admins",
  "adminemployees",
  "adminroletemplates",
  "adminbankaccounts",
  // Content and templates
  "announcementtemplates",
  "emailtemplates",
  "employeeemailtemplates",
  "landingpagetemplates",
  "notificationtemplates",
  "sitepages",
  "systemannouncements",
  "branding_asset",
  "tutorialvideos",
  "aiknowledgechunks",
  "aiknowledgesettings",
  "aiknowledgesources",
  // Gamification and journey DESIGN (earned progress is deleted above)
  "badgeconfigs",
  "xpconfigs",
  "journeymapconfigs",
  "journeymilestones",
  // Whether the shipped defaults are suppressed after a wipe (R102) — operator
  // config, not player data. Mongoose pluralises GamificationDefaultsState.
  "gamificationdefaultsstates",
  // Catalogue and commercial config
  "game_provider",
  "provider_game",
  "paymentproviders",
  "tradingsymbols",
  "vendorsubscriptions",
  "vendorpayments",
  // Visitor rules (the visits themselves are deleted above)
  "blockedvisitors",
  // Dev-zone configuration (the runs are deleted above)
  "simulatorconfigs",
  "attack_suite_configs",
  "testschedules",
  // Price / market data and system infrastructure
  "candles_1m",
  "pricecaches",
  "pricelogs",
  "pricesnapshots",
  "historical_fetch_status",
  "servers",
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

    // EVERY numeric counter on CreditWallet is zeroed here, not just the seven
    // this list originally carried.
    //
    // Reason: R86. The five below were added to the model after this reset was
    // written, and the list was never extended — they are exactly the counters
    // declared without `required: true`, which is what makes them easy to miss.
    // The reset deletes `wallettransactions`, `gamemasterearnings` and
    // `incidents`, so leaving a stale non-zero value here makes the ledger sum
    // 0 while the wallet still claims a total: reconciliation then reports an
    // `incident_compensation_mismatch` and a `gm_earnings_mismatch` on every
    // affected wallet, for activity that no longer exists anywhere. A reset that
    // manufactures reconciliation issues is worse than one that refuses, because
    // the issues look real.
    //
    // If a counter is added to the model, it belongs in this list. The guard is
    // `__tests__/admin/reconciliation-money-guards.test.ts`, which compares this
    // `$set` against the model's own numeric paths.
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
          totalAdminCredits: 0,
          totalAdminDebits: 0,
          totalIncidentCompensation: 0,
          totalGmEarnings: 0,
          totalRefunded: 0,
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
