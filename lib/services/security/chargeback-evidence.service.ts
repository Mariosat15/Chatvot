/**
 * Chargeback defense packet builder.
 *
 * Aggregates everything we need to defend against a cardholder dispute:
 * transaction log, KYC, terms, sessions, positions, prior undisputed
 * deposits, reason-code hints, and a pre-filled rebuttal letter.
 *
 * Every data source is wrapped in `try / catch` so a missing or failing
 * upstream source never blocks the defense packet.
 *
 * Renderers (Markdown, rebuttal letter, reason-code hints) live in the
 * sibling file `chargeback-evidence.markdown.ts` to keep this one focused
 * on data gathering.
 */

// Reason: relative imports so this service resolves from both the main app
// and the `apps/admin` app (different `@/` aliases).
import { connectToDatabase } from "../../../database/mongoose";
import WalletTransaction from "../../../database/models/trading/wallet-transaction.model";
import CreditWallet from "../../../database/models/trading/credit-wallet.model";
import UserPresence from "../../../database/models/user-presence.model";
import {
  buildMarkdownReport,
  buildRebuttalLetter,
  resolveReasonHint,
  type EvidenceSnapshot,
} from "./chargeback-evidence.markdown";

export interface DefensePacketInput {
  userId: string;
  walletTransactionId?: string;
  chargeback: {
    id: string;
    provider: string;
    providerTransactionId?: string;
    chargebackCaseId?: string;
    reasonCode?: string;
    amount: number;
    currency: string;
    receivedAt: Date;
  };
}

export interface DefensePacketOutput {
  snapshot: EvidenceSnapshot;
  rebuttalLetter: string;
  markdown: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- metadata blob
function pickMeta(md: Record<string, any> | undefined, keys: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  if (!md) return out;
  for (const k of keys) {
    // eslint-disable-next-line security/detect-object-injection -- `keys` is a caller-provided allow-list of PSP metadata field names
    const v = md[k];
    // eslint-disable-next-line security/detect-object-injection -- same allow-list
    out[k] = v === null || v === undefined ? undefined : String(v);
  }
  return out;
}

export async function buildDefensePacket(
  input: DefensePacketInput,
): Promise<DefensePacketOutput> {
  await connectToDatabase();

  // 1) Original transaction.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose lean shape
  let depositTx: any = null;
  try {
    if (input.walletTransactionId) {
      depositTx = await WalletTransaction.findById(
        input.walletTransactionId,
      ).lean();
    }
    if (!depositTx && input.chargeback.providerTransactionId) {
      depositTx = await WalletTransaction.findOne({
        providerTransactionId: input.chargeback.providerTransactionId,
      }).lean();
    }
  } catch (err) {
    console.error("⚠️ [evidence] fetch deposit tx failed:", err);
  }

  const txMeta = depositTx?.metadata || {};
  const txFacts = {
    transactionId: depositTx?._id ? String(depositTx._id) : undefined,
    amount: depositTx?.amount,
    currency: depositTx?.currency,
    status: depositTx?.status,
    provider: depositTx?.provider,
    providerTransactionId: depositTx?.providerTransactionId,
    paymentMethod: depositTx?.paymentMethod,
    description: depositTx?.description,
    processedAt: depositTx?.processedAt || depositTx?.createdAt,
    ...pickMeta(txMeta, [
      "clientIp",
      "clientCountry",
      "clientCity",
      "clientRegion",
      "cardLast4",
      "cardBrand",
      "cardBin",
      "avsResult",
      "cvvResult",
      "threeDSStatus",
      "threeDSEci",
      "authCode",
      "userAgent",
      "deviceFingerprint",
    ]),
  };

  // 2) Wallet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let walletFacts: any = null;
  try {
    const wallet = await CreditWallet.findOne({ userId: input.userId }).lean();
    if (wallet) {
      walletFacts = {
        creditBalance: (wallet as { creditBalance?: number }).creditBalance,
        totalDeposited: (wallet as { totalDeposited?: number }).totalDeposited,
        totalWithdrawn: (wallet as { totalWithdrawn?: number }).totalWithdrawn,
        totalRefunded: (wallet as { totalRefunded?: number }).totalRefunded,
      };
    }
  } catch (err) {
    console.error("⚠️ [evidence] fetch wallet failed:", err);
  }

  // 3) Prior undisputed deposits.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let priorDeposits: any[] = [];
  try {
    priorDeposits = await WalletTransaction.find({
      userId: input.userId,
      transactionType: "deposit",
      status: "completed",
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    priorDeposits = priorDeposits.filter(
      (t) => String(t._id) !== String(input.walletTransactionId || ""),
    );
  } catch (err) {
    console.error("⚠️ [evidence] fetch prior deposits failed:", err);
  }

  // 4) Recent sessions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recentSessions: any[] = [];
  try {
    recentSessions = await UserPresence.find({ userId: input.userId })
      .sort({ updatedAt: -1 })
      .limit(15)
      .lean();
  } catch (err) {
    console.error("⚠️ [evidence] fetch presence failed:", err);
  }

  // 5) KYC + terms (dynamic; tolerate missing models).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let kycFacts: any = null;
  try {
    const KYCSession = (
      await import("../../../database/models/kyc-session.model")
    ).default;
    const kyc = await KYCSession.findOne({
      userId: input.userId,
      status: { $in: ["approved", "submitted", "pending_review"] },
    })
      .sort({ decisionTime: -1, createdAt: -1 })
      .lean();
    if (kyc) {
      kycFacts = {
        status: (kyc as { status?: string }).status,
        decisionTime: (kyc as { decisionTime?: Date }).decisionTime,
        fullName: (kyc as { personData?: { fullName?: string } }).personData
          ?.fullName,
        nationality: (kyc as { personData?: { nationality?: string } })
          .personData?.nationality,
        documentType: (kyc as { documentData?: { type?: string } }).documentData
          ?.type,
        documentCountry: (kyc as { documentData?: { country?: string } })
          .documentData?.country,
      };
    }
  } catch (err) {
    console.warn("⚠️ [evidence] KYC lookup skipped:", err);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let termsFacts: any = null;
  try {
    const TermsAcceptance = (
      await import("../../../database/models/terms-acceptance.model")
    ).default;
    const t = await TermsAcceptance.findOne({ userId: input.userId })
      .sort({ createdAt: -1 })
      .lean();
    if (t) {
      termsFacts = {
        acceptedAt:
          (t as { acceptedAt?: Date; createdAt?: Date }).acceptedAt ||
          (t as { createdAt?: Date }).createdAt,
        ipAddress: (t as { ipAddress?: string }).ipAddress,
        version: (t as { version?: string }).version,
      };
    }
  } catch (err) {
    console.warn("⚠️ [evidence] terms acceptance lookup skipped:", err);
  }

  // 6) Trading activity.
  let positionsCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recentPositions: any[] = [];
  try {
    const Position = (
      await import("../../../database/models/trading/trading-position.model")
    ).default;
    positionsCount = await Position.countDocuments({ userId: input.userId });
    recentPositions = await Position.find({ userId: input.userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
  } catch (err) {
    console.warn("⚠️ [evidence] positions lookup skipped:", err);
  }

  // 7) Reason-code hint.
  const hint = resolveReasonHint(input.chargeback.reasonCode);

  // 8) Snapshot.
  const snapshot: EvidenceSnapshot = {
    chargeback: input.chargeback,
    generatedAt: new Date(),
    transaction: txFacts,
    wallet: walletFacts,
    priorDeposits: priorDeposits.map((d) => ({
      id: String(d._id),
      amount: d.amount,
      currency: d.currency,
      status: d.status,
      provider: d.provider,
      providerTransactionId: d.providerTransactionId,
      processedAt: d.processedAt || d.createdAt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- metadata blob
      ...pickMeta((d as { metadata?: Record<string, any> }).metadata, [
        "clientIp",
        "clientCountry",
        "cardLast4",
      ]),
    })),
    sessions: recentSessions.map((s) => ({
      status: s.status,
      lastSeen: s.lastSeen,
      ipAddress: s.ipAddress,
      country: s.country,
      city: s.city,
      region: s.region,
      userAgent: s.userAgent,
    })),
    kyc: kycFacts,
    termsAcceptance: termsFacts,
    trading: {
      positionsTotal: positionsCount,
      recentPositions: recentPositions.map((p) => ({
        id: String(p._id),
        symbol: p.symbol,
        side: p.side,
        size: p.size,
        status: p.status,
        openedAt: p.openedAt || p.createdAt,
        closedAt: p.closedAt,
      })),
    },
    reasonHint: hint,
  };

  const rebuttalLetter = buildRebuttalLetter(input.chargeback, snapshot);
  const markdown = buildMarkdownReport(
    input.chargeback,
    snapshot,
    rebuttalLetter,
  );

  return { snapshot, rebuttalLetter, markdown };
}
