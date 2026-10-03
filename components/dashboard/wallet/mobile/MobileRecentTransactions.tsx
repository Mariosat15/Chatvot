"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatVolts } from "@/lib/utils/format-volts";
import { getWalletTransactions } from "@/lib/actions/trading/wallet.actions";

type TxRow = {
  _id: string;
  transactionType: string;
  amount: number;
  createdAt: string;
  description?: string;
};

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  manual_deposit_credit: "Deposit",
  withdrawal: "Withdrawal",
  withdrawal_fee: "Withdrawal Fee",
  withdrawal_refund: "Withdrawal Refund",
  competition_entry: "Competition Entry",
  competition_win: "Prize Won",
  competition_refund: "Competition Refund",
  challenge_entry: "Challenge Entry",
  challenge_win: "Prize Won",
  challenge_refund: "Challenge Refund",
  marketplace_purchase: "Marketplace Purchase",
  gamemaster_earning: "Game Earnings",
  gamemaster_challenge_referral: "Game Earnings",
  platform_fee: "Platform Fee",
  admin_adjustment: "Adjustment",
  incident_compensation: "Compensation",
};

function toneFor(type: string, amount: number): string {
  if (
    type === "competition_win" ||
    type === "challenge_win" ||
    type.includes("prize")
  ) {
    return "text-amber-300";
  }
  if (type.includes("gamemaster") || type.includes("earning")) {
    return "text-cyan-300";
  }
  if (amount >= 0) return "text-emerald-300";
  return "text-rose-300";
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Latest five ledger rows — fetched via the same server action as `/wallet`.
 * Detail sheet deferred; See All opens the full wallet page.
 */
export default function MobileRecentTransactions() {
  const [rows, setRows] = useState<TxRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = (await getWalletTransactions(5)) as TxRow[];
        if (!cancelled) setRows(Array.isArray(list) ? list.slice(0, 5) : []);
      } catch {
        if (!cancelled) setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-label="Recent transactions">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white">
          Recent Transactions
        </h2>
        <Link
          href="/wallet"
          className="text-xs font-semibold text-cyan-300 active:opacity-80"
        >
          See All
        </Link>
      </div>

      <ul className="overflow-hidden rounded-[18px] border border-[#1E2A4D] bg-[linear-gradient(160deg,rgba(12,22,44,0.92)_0%,rgba(5,10,22,0.96)_100%)]">
        {rows === null && (
          <li className="px-4 py-6 text-center text-sm text-slate-500">
            Loading…
          </li>
        )}
        {rows && rows.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-slate-500">
            No transactions yet
          </li>
        )}
        {rows?.map((tx, i) => {
          const label =
            TYPE_LABELS[tx.transactionType] ||
            tx.description ||
            tx.transactionType;
          const amount = Number(tx.amount) || 0;
          return (
            <li
              key={tx._id}
              className={`flex min-h-[60px] items-center justify-between gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-white/5" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {label}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {formatWhen(tx.createdAt)}
                </p>
              </div>
              <p
                className={`shrink-0 text-sm font-bold tabular-nums ${toneFor(tx.transactionType, amount)}`}
              >
                {amount >= 0 ? "+" : ""}
                {formatVolts(amount)}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
