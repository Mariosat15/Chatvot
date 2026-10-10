/**
 * Net wallet movement for the last seven days and the seven before, for the
 * Overview "credits this week" delta.
 *
 * Reason: lives here rather than in lib/services/games/ because invariant 6 of
 * __tests__/services/round-lifecycle.test.ts bans every money import from that
 * folder, reads included - an import grants writes as readily as reads. The
 * dashboard action composes this with getOverviewStanding, the same shape as
 * the results page composing findUnscoredRefund (13 s6.1a).
 */
import WalletTransaction from "@/database/models/trading/wallet-transaction.model";

export interface WeeklyCreditNet {
  thisWeek: number;
  lastWeek: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

async function netSince(userId: string, from: Date, to?: Date): Promise<number> {
  const createdAt = to ? { $gte: from, $lt: to } : { $gte: from };
  const rows = await WalletTransaction.aggregate<{ net: number }>([
    { $match: { userId, createdAt } },
    { $group: { _id: null, net: { $sum: "$amount" } } },
  ]);
  return rows[0]?.net ?? 0;
}

/** Returns null when the ledger cannot be read, so the delta renders as unknown. */
export async function getWeeklyCreditNet(
  userId: string,
  now = Date.now(),
): Promise<WeeklyCreditNet | null> {
  const thisWeekStart = new Date(now - 7 * DAY_MS);
  const lastWeekStart = new Date(now - 14 * DAY_MS);
  try {
    const [thisWeek, lastWeek] = await Promise.all([
      netSince(userId, thisWeekStart),
      netSince(userId, lastWeekStart, thisWeekStart),
    ]);
    return { thisWeek, lastWeek };
  } catch {
    return null;
  }
}
