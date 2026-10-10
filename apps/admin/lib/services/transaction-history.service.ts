/**
 * Transaction History Service
 *
 * Single source of truth for building the admin "all transactions" view.
 * Both the paginated list (`/api/transactions`) and the CSV export
 * (`/api/transactions/export`) call into here so the table and the downloaded
 * report ALWAYS apply identical filters and merge the same data sources.
 *
 * Sources merged:
 * - WalletTransaction  (user-facing credit movements)
 * - PlatformTransaction (admin withdrawals, fees, unclaimed pools, expenses)
 * - VATPayment         (VAT remittances)
 * - VendorPayment      (operational vendor payouts)
 */

import mongoose from "mongoose";
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";
import WithdrawalRequest from "@/database/models/withdrawal-request.model";
import { PlatformTransaction } from "@/database/models/platform-financials.model";
import VATPayment from "@/database/models/vat-payment.model";
import VendorPayment from "@/database/models/vendor-payment.model";
import { getUsersByIds } from "@/lib/utils/user-lookup";

// Reason: MongoDB $regex treats the search string as a regular expression.
// Characters like + . * ? ( ) [ ] { } ^ $ | \ are metacharacters. Unescaped,
// they cause MongoServerError or unintended wildcard matches — e.g.
// "user+tag@example.com" → + means "one or more" → parse error → 500 crash.
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface TransactionFilters {
  type?: string | null;
  status?: string | null;
  userId?: string | null;
  competitionId?: string | null;
  search?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  minAmount?: string | null;
  maxAmount?: string | null;
  sortBy?: string | null;
  sortOrder?: string | null;
}

// Platform transaction types that live in the PlatformTransaction collection.
// Reason: must cover EVERY PlatformTransaction.transactionType so that
// filtering by any of these returns its platform rows (previously
// challenge_platform_fee / retained_gm_fee / refund / chargeback_loss were
// missing here, so selecting those filters silently returned nothing).
const PLATFORM_TYPES = [
  "admin_withdrawal",
  "platform_fee",
  "challenge_platform_fee",
  "unclaimed_pool",
  "deposit_fee",
  "withdrawal_fee",
  "admin_balance_add",
  "custom_expense",
  "retained_gm_fee",
  "refund",
  "refund_clawback",
  "chargeback_loss",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MergedTransaction = Record<string, any>;

// Reason: coerce metadata values that may arrive as numbers OR strings
// (Stripe stores vat/fee metadata as strings, Nuvei/Atlas as numbers).
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? parseFloat(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) ? n : null;
}

export interface FeeBreakdown {
  vatEUR: number | null;
  feeEUR: number | null;
  totalChargedEUR: number | null;
}

/**
 * Extract the per-transaction fee breakdown (VAT, platform fee, gross total) in
 * EUR from a merged transaction's metadata. Provider-agnostic — Nuvei, Atlas and
 * Stripe deposits all store the same metadata keys. Returns nulls for rows that
 * carry no fee data so reports can leave those cells blank (and Excel SUM skips
 * them) rather than emitting misleading zeros.
 *
 * - deposit:    VAT = metadata.vatAmount, Fee = metadata.platformFeeAmount,
 *               Total Charged = metadata.totalCharged (= base + VAT + fee).
 * - withdrawal: Fee = platformFee + bankFee deducted, Total = gross amountEUR
 *               debited (no VAT on payouts).
 */
export function extractFeeBreakdown(tx: MergedTransaction): FeeBreakdown {
  const m = tx?.metadata || {};
  const txType = tx?.transactionType;

  if (txType === "deposit" || txType === "manual_deposit_credit") {
    return {
      vatEUR: toNumberOrNull(m.vatAmount),
      feeEUR: toNumberOrNull(m.platformFeeAmount),
      totalChargedEUR: toNumberOrNull(m.totalCharged),
    };
  }

  if (txType === "withdrawal") {
    const platformFee = toNumberOrNull(m.platformFee);
    const bankFee = toNumberOrNull(m.bankFee);
    const fee =
      platformFee !== null || bankFee !== null ? (platformFee ?? 0) + (bankFee ?? 0) : null;
    return {
      vatEUR: null,
      feeEUR: fee,
      totalChargedEUR: toNumberOrNull(m.amountEUR),
    };
  }

  return { vatEUR: null, feeEUR: null, totalChargedEUR: null };
}

export interface MergedTransactionsResult {
  transactions: MergedTransaction[];
  // The exact WalletTransaction query used — reused by the list route for
  // type/status aggregation stats so they match the displayed rows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletQuery: Record<string, any>;
  sortOrder: "asc" | "desc";
}

/**
 * Build the WalletTransaction query from filters. Also resolves user search
 * terms (email/name/id) to userIds. Returns whether the search narrowed to a
 * specific set of users (so platform-level rows can be excluded).
 */
async function buildWalletQuery(
  filters: TransactionFilters,
  exactDates = false,
): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: Record<string, any>;
  searchIsUserScoped: boolean;
}> {
  const { type, status, userId, competitionId, search, startDate, endDate, minAmount, maxAmount } = filters;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {};
  let searchIsUserScoped = false;

  if (type && type !== "all") query.transactionType = type;
  if (userId) query.userId = userId;
  if (competitionId) query.competitionId = competitionId;

  // Conditions AND-ed together. Kept in an array so the search filter and the
  // withdrawal-aware status filter below don't clobber each other's `$or`.
  const andConditions: Record<string, unknown>[] = [];

  // Reason: a withdrawal's DISPLAYED status is re-derived from its
  // WithdrawalRequest (the source of truth) AFTER this query runs (see the
  // enrichment in fetchMergedTransactions). Filtering withdrawals by their raw
  // WalletTransaction.status HERE would both (a) leak failed/cancelled
  // withdrawals into a "completed" report and (b) hide truly-completed ones
  // whose raw row still says pending. So withdrawals are NOT status-constrained
  // at the DB level — the final status filter is applied post-enrichment.
  // Non-withdrawal rows are still filtered here for efficiency.
  if (status && status !== "all") {
    if (type === "withdrawal") {
      // no DB status constraint; filtered on enriched status post-fetch
    } else if (!type || type === "all") {
      andConditions.push({
        $or: [
          { transactionType: { $ne: "withdrawal" }, status },
          { transactionType: "withdrawal" },
        ],
      });
    } else {
      query.status = status;
    }
  }

  if (search && search.trim()) {
    // Reason: userInfo.email/name are NOT stored on WalletTransaction — they're
    // enriched after fetch. Pre-resolve matching userIds from the user
    // collection first, then query by userId. Escape the raw search to avoid
    // MongoServerError from regex metacharacters.
    const safeSearch = escapeRegex(search.trim());
    const db = mongoose.connection.db;
    const resolvedUserIds: string[] = [];

    if (db) {
      try {
        const matchingUsers = await db
          .collection("user")
          .find(
            {
              $or: [
                { email: { $regex: safeSearch, $options: "i" } },
                { name: { $regex: safeSearch, $options: "i" } },
                { id: search.trim() },
              ],
            },
            { projection: { id: 1, _id: 1 } },
          )
          .limit(500)
          .toArray();

        matchingUsers.forEach((u) => {
          if (u.id) resolvedUserIds.push(String(u.id));
          if (u._id) resolvedUserIds.push(u._id.toString());
        });
      } catch (userLookupError) {
        console.warn("⚠️ Transaction search: user lookup error:", userLookupError);
      }
    }

    const searchConditions: Record<string, unknown>[] = [
      { description: { $regex: safeSearch, $options: "i" } },
      { "metadata.paymentIntentId": { $regex: safeSearch, $options: "i" } },
    ];

    if (resolvedUserIds.length > 0) {
      searchConditions.push({ userId: { $in: [...new Set(resolvedUserIds)] } });
      searchIsUserScoped = true;
    } else {
      searchConditions.push({ userId: { $regex: safeSearch, $options: "i" } });
    }

    andConditions.push({ $or: searchConditions });
  }

  // Reason: endDate is inclusive of the whole day. Without end-of-day, a raw
  // `new Date(endDate)` resolves to 00:00:00 and silently drops every row on
  // the end date itself. When exactDates is true (streaming chunker), the
  // caller passes precise ISO timestamps and we must NOT expand to end-of-day.
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      if (!exactDates) end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  if (minAmount || maxAmount) {
    query.amount = {};
    if (minAmount) query.amount.$gte = parseFloat(minAmount);
    if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
  }

  if (andConditions.length > 0) query.$and = andConditions;

  return { query, searchIsUserScoped };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDateRange(
  startDate?: string | null,
  endDate?: string | null,
  exactDates = false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> | null {
  if (!startDate && !endDate) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const range: Record<string, any> = {};
  if (startDate) range.$gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    if (!exactDates) end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return range;
}

/**
 * Fetch, merge, enrich and sort all transaction sources for the given filters.
 * No pagination — callers slice (list) or stream the whole set (export).
 */
export async function fetchMergedTransactions(
  filters: TransactionFilters,
  options: { maxRecords?: number; exactDates?: boolean } = {},
): Promise<MergedTransactionsResult> {
  const maxRecords = options.maxRecords ?? 1000;
  const exactDates = options.exactDates ?? false;
  const { type, status, userId, startDate, endDate, sortBy, sortOrder: rawSortOrder } = filters;
  const sortOrder: "asc" | "desc" = rawSortOrder === "asc" ? "asc" : "desc";

  const { query, searchIsUserScoped } = await buildWalletQuery(filters, exactDates);

  // Reason: allowlist sort field to prevent injection via dynamic key.
  const allowedSortFields = new Set(["createdAt", "amount", "transactionType", "status", "userId"]);
  const safeSortBy = sortBy && allowedSortFields.has(sortBy) ? sortBy : "createdAt";
  const sort: Record<string, 1 | -1> = { [safeSortBy]: sortOrder === "asc" ? 1 : -1 };

  // Reason: Platform/VAT/vendor rows are always "completed". Only include them
  // when the search isn't user-scoped, no single userId is targeted, the type
  // filter allows them, AND the status filter is "all" or "completed" (otherwise
  // a status=pending/failed filter would wrongly surface these completed rows).
  const statusAllowsAdminTx = !status || status === "all" || status === "completed";
  const includeAdminTx =
    statusAllowsAdminTx &&
    !searchIsUserScoped &&
    !userId &&
    (!type ||
      type === "all" ||
      PLATFORM_TYPES.includes(type) ||
      type === "vat_payment" ||
      type === "vendor_payment");

  const walletTransactions = await WalletTransaction.find(query)
    .sort(sort)
    .limit(maxRecords)
    .lean();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let platformTransactions: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let vatPayments: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let vendorPayments: any[] = [];

  const dateRange = buildDateRange(startDate, endDate, exactDates);

  if (includeAdminTx) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const platformQuery: any = {};
    if (type && type !== "all" && PLATFORM_TYPES.includes(type)) {
      platformQuery.transactionType = type;
    }
    if (dateRange) platformQuery.createdAt = dateRange;

    platformTransactions = await PlatformTransaction.find(platformQuery)
      .sort(sort)
      .limit(maxRecords)
      .lean();

    if (!type || type === "all" || type === "vat_payment") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vatQuery: any = { status: "paid" };
      if (dateRange) vatQuery.paidAt = dateRange;
      vatPayments = await VATPayment.find(vatQuery).sort({ paidAt: -1 }).limit(maxRecords).lean();
    }

    if (!type || type === "all" || type === "vendor_payment") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vendorQuery: any = { status: "paid" };
      if (dateRange) vendorQuery.paidAt = dateRange;
      vendorPayments = await VendorPayment.find(vendorQuery).sort({ paidAt: -1 }).limit(maxRecords).lean();
    }
  }

  // Enrich wallet transactions with user info + withdrawal fee details.
  const userIds = [
    ...new Set(walletTransactions.map((t) => t.userId).filter((id) => id !== "platform")),
  ];
  const usersMap = await getUsersByIds(userIds);

  const withdrawalRequestIds = walletTransactions
    .filter((t) => t.transactionType === "withdrawal" && t.metadata?.withdrawalRequestId)
    .map((t) => t.metadata?.withdrawalRequestId)
    .filter(Boolean);
  const withdrawalRequests =
    withdrawalRequestIds.length > 0
      ? await WithdrawalRequest.find({ _id: { $in: withdrawalRequestIds } }).lean()
      : [];
  const withdrawalRequestMap = new Map(
    withdrawalRequests.map((w) => [w._id.toString(), w]),
  );

  const enrichedWalletTransactions = walletTransactions.map((t) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enriched: any = {
      ...t,
      source: "wallet" as const,
      userInfo:
        t.userId === "platform"
          ? { id: "platform", name: "Platform", email: "system" }
          : usersMap.get(t.userId) || { id: t.userId, name: "Unknown", email: "Unknown" },
    };

    if (t.transactionType === "withdrawal" && t.metadata?.withdrawalRequestId) {
      const withdrawalReq = withdrawalRequestMap.get(t.metadata.withdrawalRequestId.toString());
      if (withdrawalReq) {
        if (withdrawalReq.status === "completed") enriched.status = "completed";
        else if (withdrawalReq.status === "rejected" || withdrawalReq.status === "failed")
          enriched.status = "failed";
        else if (withdrawalReq.status === "cancelled") enriched.status = "cancelled";
        else enriched.status = "pending";

        enriched.metadata = {
          ...enriched.metadata,
          amountEUR: withdrawalReq.amountEUR,
          platformFee: withdrawalReq.platformFee,
          bankFee: withdrawalReq.bankFee,
          netAmountEUR: withdrawalReq.netAmountEUR,
          withdrawalStatus: withdrawalReq.status,
        };
      }
    }

    return enriched;
  });

  const enrichedPlatformTransactions = platformTransactions.map((t) => ({
    _id: t._id,
    userId: "admin",
    transactionType: t.transactionType,
    amount: t.amount,
    amountEUR: t.amountEUR,
    status: "completed",
    description: t.description,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    source: "platform" as const,
    metadata: {
      bankDetails: t.bankDetails,
      feeDetails: t.feeDetails,
      sourceType: t.sourceType,
      sourceId: t.sourceId,
      sourceName: t.sourceName,
      unclaimedReason: t.unclaimedReason,
      processedBy: t.processedBy,
      processedByEmail: t.processedByEmail,
    },
    userInfo: {
      id: "admin",
      name: t.processedByEmail || "Admin",
      email: t.processedByEmail || "admin@system",
    },
  }));

  const enrichedVatPayments = vatPayments.map((v) => ({
    _id: v._id,
    userId: "admin",
    transactionType: "vat_payment",
    amount: -v.vatAmountEUR,
    amountEUR: v.vatAmountEUR,
    status: "completed",
    description: `VAT Payment for ${new Date(v.periodStart).toLocaleDateString()} - ${new Date(v.periodEnd).toLocaleDateString()}`,
    createdAt: v.paidAt || v.createdAt,
    updatedAt: v.updatedAt,
    source: "vat" as const,
    metadata: {
      periodStart: v.periodStart,
      periodEnd: v.periodEnd,
      transactionCount: v.transactionCount,
      reference: v.reference,
      paidByEmail: v.paidByEmail,
    },
    userInfo: {
      id: "admin",
      name: v.paidByEmail || "Admin",
      email: v.paidByEmail || "admin@system",
    },
  }));

  const enrichedVendorPayments = vendorPayments.map((v) => ({
    _id: v._id,
    userId: "admin",
    transactionType: "vendor_payment",
    amount: -v.amount,
    amountEUR: v.amount,
    status: "completed",
    description: `Vendor Payment to ${v.vendorName} (${v.serviceType})`,
    createdAt: v.paidAt || v.createdAt,
    updatedAt: v.updatedAt,
    source: "vendor" as const,
    metadata: {
      vendorId: v.vendorId,
      vendorName: v.vendorName,
      serviceType: v.serviceType,
      reference: v.reference,
      invoiceNumber: v.invoiceNumber,
      paidByEmail: v.paidByEmail,
      billingCycle: v.billingCycle,
    },
    userInfo: {
      id: "admin",
      name: v.paidByEmail || "Admin",
      email: v.paidByEmail || "admin@system",
    },
  }));

  const transactions = [
    ...enrichedWalletTransactions,
    ...enrichedPlatformTransactions,
    ...enrichedVatPayments,
    ...enrichedVendorPayments,
  ].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
  });

  // Reason: apply the status filter on the FINAL (post-enrichment) status so a
  // "completed" report shows only genuinely completed rows — withdrawals whose
  // displayed status was re-derived from the WithdrawalRequest are now correctly
  // included/excluded. Without this, raw-status DB filtering leaked
  // failed/cancelled withdrawals into the "completed" view and export.
  const finalStatus = status && status !== "all" ? status : null;
  const finalTransactions = finalStatus
    ? transactions.filter((t) => t.status === finalStatus)
    : transactions;

  return { transactions: finalTransactions, walletQuery: query, sortOrder };
}

/**
 * Stream ALL matching transactions in bounded date-window batches.
 *
 * Reason: a single in-memory fetch is capped (to avoid OOM), which can truncate
 * very large exports. This generator walks the matching date range and yields
 * batches. If a window holds more rows than `chunkCap`, it recursively splits
 * the window in half by time until each batch fits — so it can stream an
 * unlimited number of rows while never holding more than ~chunkCap×sources in
 * memory at once. Completeness is guaranteed for any realistic data
 * distribution (you would need >chunkCap rows within an unsplittable 1ms window
 * to truncate, which is effectively impossible).
 */
export async function* streamMergedTransactions(
  filters: TransactionFilters,
  options: { chunkCap?: number } = {},
): AsyncGenerator<MergedTransaction[]> {
  const chunkCap = options.chunkCap ?? 5000;

  // Lower bound: explicit startDate, else epoch (recursion quickly discards
  // empty older windows, so an early floor costs only a few extra queries).
  const startMs = filters.startDate ? new Date(filters.startDate).getTime() : 0;

  // Upper bound: explicit endDate (inclusive end-of-day), else now.
  let endMs: number;
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999);
    endMs = end.getTime();
  } else {
    endMs = Date.now();
  }

  const ascending = filters.sortOrder === "asc";
  yield* chunkByDate(filters, startMs, endMs, chunkCap, ascending);
}

async function* chunkByDate(
  filters: TransactionFilters,
  startMs: number,
  endMs: number,
  chunkCap: number,
  ascending: boolean,
): AsyncGenerator<MergedTransaction[]> {
  if (startMs > endMs) return;

  // Reason: fetch one more than the cap so we can detect an overflowing window.
  const { transactions } = await fetchMergedTransactions(
    {
      ...filters,
      startDate: new Date(startMs).toISOString(),
      endDate: new Date(endMs).toISOString(),
    },
    { maxRecords: chunkCap + 1, exactDates: true },
  );

  if (transactions.length <= chunkCap) {
    if (transactions.length > 0) yield transactions;
    return;
  }

  const mid = Math.floor((startMs + endMs) / 2);
  if (mid <= startMs || mid >= endMs) {
    // Window is a single instant and still overflows — emit as-is to avoid an
    // infinite loop. Practically unreachable.
    yield transactions;
    return;
  }

  // Reason: preserve global ordering — for descending (default) emit the newer
  // half first; for ascending emit the older half first.
  if (ascending) {
    yield* chunkByDate(filters, startMs, mid, chunkCap, ascending);
    yield* chunkByDate(filters, mid + 1, endMs, chunkCap, ascending);
  } else {
    yield* chunkByDate(filters, mid + 1, endMs, chunkCap, ascending);
    yield* chunkByDate(filters, startMs, mid, chunkCap, ascending);
  }
}
