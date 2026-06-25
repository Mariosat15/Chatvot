"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  Trophy,
  RefreshCw,
  ShieldAlert,
  UserCog,
  Zap,
  FileText,
  Swords,
  Gift,
  Filter,
  Crown,
  Calendar,
  ChevronDown,
  X,
  Download,
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Escape a CSV field: wrap in quotes if it contains comma, quote, or newline */
function csvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export transactions as a CSV file (opens natively in Excel).
 * Reason: We use CSV instead of xlsx to avoid adding a heavy dependency.
 * CSV opens in Excel by default on Windows and is universally compatible.
 */
function exportTransactionsToCSV(
  transactions: Transaction[],
  creditName: string,
  currencySymbol: string,
  creditsToEUR: (c: number) => number,
) {
  const headers = [
    "Date",
    "Type",
    "Description",
    `Amount (${creditName})`,
    `Amount (${currencySymbol})`,
    "Status",
    "Payment Method",
  ];

  const typeLabels: Record<string, string> = {
    deposit: "Deposit",
    withdrawal: "Withdrawal",
    withdrawal_fee: "Withdrawal Fee",
    withdrawal_refund: "Withdrawal Refund",
    manual_deposit_credit: "Manual Credit",
    competition_entry: "Competition Entry",
    competition_win: "Competition Win",
    competition_refund: "Competition Refund",
    platform_fee: "Platform Fee",
    admin_adjustment: "Admin Adjustment",
    challenge_entry: "Challenge Entry",
    challenge_win: "Challenge Win",
    challenge_refund: "Challenge Refund",
    challenge_declined: "Challenge Declined",
    challenge_expired: "Challenge Expired",
    marketplace_purchase: "Marketplace Purchase",
    gamemaster_subscription: "GM Subscription",
    gamemaster_subscription_refund: "GM Subscription Refund",
    incident_compensation: "Compensation",
    chargeback_clawback: "Chargeback Reversal",
    gamemaster_earning: "Referral Earning",
    gamemaster_challenge_referral: "Challenge Referral",
  };

  const statusLabels: Record<string, string> = {
    completed: "Completed",
    pending: "Pending",
    failed: "Failed",
    cancelled: "Cancelled",
    disputed: "Disputed",
  };

  const rows = transactions.map((tx) => {
    // Reason: toLocaleString produces commas (e.g. "23/03/2026, 08:58:15") which
    // would split the date across two CSV columns. We format without commas.
    const d = new Date(tx.createdAt);
    const date = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
    const type = typeLabels[tx.transactionType] || tx.transactionType;
    const desc = tx.description || "";
    const amount = tx.amount.toFixed(2);
    const eurAmount = creditsToEUR(Math.abs(tx.amount)).toFixed(2);
    const eurSigned = tx.amount >= 0 ? eurAmount : `-${eurAmount}`;
    const status = statusLabels[tx.status] || tx.status;
    return [
      csvField(date),
      csvField(type),
      csvField(desc),
      amount,
      eurSigned,
      status,
      tx.paymentMethod || "",
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  // Reason: BOM prefix tells Excel to interpret the file as UTF-8
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Transaction {
  _id: string;
  transactionType:
    | "deposit"
    | "withdrawal"
    | "withdrawal_fee"
    | "withdrawal_refund"
    | "manual_deposit_credit"
    | "competition_entry"
    | "competition_win"
    | "competition_refund"
    | "platform_fee"
    | "admin_adjustment"
    | "challenge_entry"
    | "challenge_win"
    | "challenge_refund"
    | "challenge_declined"
    | "challenge_expired"
    | "marketplace_purchase"
    | "gamemaster_subscription"
    | "gamemaster_subscription_refund"
    | "incident_compensation"
    | "chargeback_clawback"
    | "gamemaster_earning"
    | "gamemaster_challenge_referral";
  amount: number;
  status: "pending" | "completed" | "failed" | "cancelled";
  description: string;
  createdAt: string;
  paymentMethod?: string;
  exchangeRate?: number;
  paymentId?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
  onFilteredStatsChange?: (stats: FilteredStats) => void;
}

export interface FilteredStats {
  totalDeposited: number;
  totalWithdrawn: number;
  totalSpent: number;
  totalWinnings: number;
  totalGMEarnings: number;
  totalAdminAdjustments: number;
}

type FilterType =
  | "all"
  | "deposits"
  | "withdrawals"
  | "competitions"
  | "challenges"
  | "marketplace"
  | "referrals"
  | "adjustments";
type StatusFilter = "all" | "completed" | "pending" | "failed" | "cancelled";
type DatePreset = "all" | "30" | "60" | "90" | "120" | "custom";

// Reason: Single source of truth mapping every wallet transaction type to a
// filter category, so the tabs are EXHAUSTIVE — no type can be orphaned and
// invisible to filtering. "all" intentionally bypasses this and shows them all.
const FILTER_CATEGORIES: Record<
  Exclude<FilterType, "all">,
  Transaction["transactionType"][]
> = {
  deposits: ["deposit", "manual_deposit_credit"],
  withdrawals: ["withdrawal", "withdrawal_fee", "withdrawal_refund"],
  competitions: ["competition_entry", "competition_win", "competition_refund"],
  challenges: [
    "challenge_entry",
    "challenge_win",
    "challenge_refund",
    "challenge_declined",
    "challenge_expired",
  ],
  marketplace: [
    "marketplace_purchase",
    "gamemaster_subscription",
    "gamemaster_subscription_refund",
  ],
  referrals: ["gamemaster_earning", "gamemaster_challenge_referral"],
  adjustments: [
    "admin_adjustment",
    "incident_compensation",
    "platform_fee",
    "chargeback_clawback",
  ],
};

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "deposits", label: "Deposits" },
  { value: "withdrawals", label: "Withdrawals" },
  { value: "competitions", label: "Competitions" },
  { value: "challenges", label: "Challenges" },
  { value: "marketplace", label: "Marketplace" },
  { value: "referrals", label: "Referrals" },
  { value: "adjustments", label: "Adjustments" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string; color: string }[] = [
  { value: "all", label: "All Status", color: "text-gray-300" },
  { value: "completed", label: "Completed", color: "text-green-400" },
  { value: "pending", label: "Pending", color: "text-yellow-400" },
  { value: "failed", label: "Failed", color: "text-red-400" },
  { value: "cancelled", label: "Cancelled", color: "text-gray-400" },
];

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "30", label: "Last 30 Days" },
  { value: "60", label: "Last 60 Days" },
  { value: "90", label: "Last 90 Days" },
  { value: "120", label: "Last 120 Days" },
  { value: "custom", label: "Custom Range" },
];

const PAGE_SIZE = 25;

export default function TransactionHistory({
  transactions,
  onFilteredStatsChange,
}: TransactionHistoryProps) {
  const { settings, creditsToEUR } = useAppSettings();
  const [filter, setFilter] = useState<FilterType>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  // Reason: Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setShowStatusDropdown(false);
      }
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setShowDateDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Batch invoice lookup ─────────────────────────────────────────────
  // Instead of each TransactionItem fetching /api/user/invoices/by-transaction/X
  // independently (N+1 pattern: 20 deposits = 20 calls), we do ONE batch call.
  const [invoiceMap, setInvoiceMap] = useState<Record<string, string>>({});
  useEffect(() => {
    const depositIds = transactions
      .filter(
        (t) =>
          t.transactionType === "deposit" && t.status === "completed",
      )
      .map((t) => t._id);

    if (depositIds.length === 0) return;

    fetch("/api/user/invoices/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionIds: depositIds }),
    })
      .then((res) => (res.ok ? res.json() : { invoiceMap: {} }))
      .then((data) => setInvoiceMap(data.invoiceMap || {}))
      .catch(() => {});
  }, [transactions]);

  // Date filter state
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  // Filter transactions by date
  const dateFilteredTransactions = useMemo(() => {
    if (datePreset === "all") return transactions;

    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (datePreset !== "custom") {
      const days = parseInt(datePreset);
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
    } else {
      if (customStartDate) {
        startDate = new Date(customStartDate);
        startDate.setHours(0, 0, 0, 0);
      }
      if (customEndDate) {
        endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    return transactions.filter((tx) => {
      const txDate = new Date(tx.createdAt);
      if (startDate && txDate < startDate) return false;
      if (endDate && txDate > endDate) return false;
      return true;
    });
  }, [transactions, datePreset, customStartDate, customEndDate]);

  // Filter transactions by status
  const statusFilteredTransactions = useMemo(() => {
    if (statusFilter === "all") return dateFilteredTransactions;
    return dateFilteredTransactions.filter((tx) => tx.status === statusFilter);
  }, [dateFilteredTransactions, statusFilter]);

  // Filter transactions based on selected type
  const filteredTransactions = useMemo(() => {
    if (filter === "all") return statusFilteredTransactions;

    // eslint-disable-next-line security/detect-object-injection -- `filter` is a typed FilterType (not user input)
    const categoryTypes = FILTER_CATEGORIES[filter];
    return statusFilteredTransactions.filter((tx) =>
      categoryTypes.includes(tx.transactionType),
    );
  }, [statusFilteredTransactions, filter]);

  // Calculate filtered stats and notify parent
  // Reason: Uses statusFilteredTransactions so stats respect both date AND status filters.
  // When statusFilter is "all", only completed transactions are counted (real money moved).
  // When a specific status is selected, ALL transactions with that status are counted
  // so totals match exactly what the user sees in the list.
  useEffect(() => {
    if (!onFilteredStatsChange) return;

    const countOnlyCompleted = statusFilter === "all";

    const stats = statusFilteredTransactions.reduce(
      (acc, tx) => {
        // When viewing all statuses, only count completed for accurate financial totals.
        // When filtered to a specific status, count everything shown.
        if (countOnlyCompleted && tx.status !== "completed") return acc;

        switch (tx.transactionType) {
          case "deposit":
            acc.totalDeposited += tx.amount;
            break;
          case "withdrawal":
            acc.totalWithdrawn += Math.abs(tx.amount);
            break;
          case "competition_entry":
          case "challenge_entry":
            acc.totalSpent += Math.abs(tx.amount);
            break;
          case "competition_win":
          case "challenge_win":
            acc.totalWinnings += tx.amount;
            break;
          case "gamemaster_earning":
          case "gamemaster_challenge_referral":
            acc.totalGMEarnings += tx.amount;
            break;
          case "admin_adjustment":
            acc.totalAdminAdjustments += tx.amount;
            break;
        }
        return acc;
      },
      {
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalSpent: 0,
        totalWinnings: 0,
        totalGMEarnings: 0,
        totalAdminAdjustments: 0,
      },
    );

    onFilteredStatsChange(stats);
  }, [statusFilteredTransactions, statusFilter, onFilteredStatsChange]);

  // Count transactions per status for filter badges
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: dateFilteredTransactions.length,
      completed: 0,
      pending: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const tx of dateFilteredTransactions) {
      if (tx.status in counts) {
        counts[tx.status as StatusFilter]++;
      }
    }
    return counts;
  }, [dateFilteredTransactions]);

  // Check which optional filter tabs should be visible
  const hasReferralTransactions = useMemo(
    () =>
      transactions.some((tx) =>
        ["gamemaster_earning", "gamemaster_challenge_referral"].includes(
          tx.transactionType,
        ),
      ),
    [transactions],
  );
  const hasMarketplaceTransactions = useMemo(
    () =>
      transactions.some((tx) =>
        ["marketplace_purchase", "gamemaster_subscription", "gamemaster_subscription_refund"].includes(
          tx.transactionType,
        ),
      ),
    [transactions],
  );
  const hasAdjustmentTransactions = useMemo(
    () =>
      transactions.some((tx) =>
        FILTER_CATEGORIES.adjustments.includes(tx.transactionType),
      ),
    [transactions],
  );

  // Only show filter tabs for categories that have transactions
  const availableFilters = useMemo(
    () =>
      FILTER_OPTIONS.filter((f) => {
        if (f.value === "referrals") return hasReferralTransactions;
        if (f.value === "marketplace") return hasMarketplaceTransactions;
        if (f.value === "adjustments") return hasAdjustmentTransactions;
        return true;
      }),
    [hasReferralTransactions, hasMarketplaceTransactions, hasAdjustmentTransactions],
  );

  // Reason: Reset pagination when filter/date/status changes so user always sees first page
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, statusFilter, datePreset, customStartDate, customEndDate]);

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== "custom") {
      setShowDateDropdown(false);
    }
  };

  const handleCustomDateApply = () => {
    setShowDateDropdown(false);
  };

  const clearDateFilter = () => {
    setDatePreset("all");
    setCustomStartDate("");
    setCustomEndDate("");
  };

  const getDateFilterLabel = () => {
    if (datePreset === "all") return "All Time";
    if (datePreset === "custom" && (customStartDate || customEndDate)) {
      const start = customStartDate
        ? new Date(customStartDate).toLocaleDateString()
        : "Start";
      const end = customEndDate
        ? new Date(customEndDate).toLocaleDateString()
        : "Now";
      return `${start} - ${end}`;
    }
    return (
      DATE_PRESETS.find((p) => p.value === datePreset)?.label || "All Time"
    );
  };

  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <Zap className="h-8 w-8 text-yellow-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-300 mb-2">
          No transactions yet
        </h3>
        <p className="text-sm text-gray-500">
          Buy your first {settings?.credits.name || "credits"} to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="flex flex-col gap-3">
        {/* Top row: Type filter + Date/Status */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Type Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <div className="flex gap-1.5">
              {availableFilters.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                    filter === option.value
                      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right side: Status + Date filters */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Status Filter Dropdown */}
            <div className="relative" ref={statusDropdownRef}>
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors border",
                  statusFilter !== "all"
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-700",
                )}
              >
                <span className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  statusFilter === "all" ? "bg-gray-500" :
                  statusFilter === "completed" ? "bg-green-400" :
                  statusFilter === "pending" ? "bg-yellow-400" :
                  statusFilter === "failed" ? "bg-red-400" : "bg-gray-400",
                )} />
                <span className="hidden sm:inline">
                  {STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label || "All Status"}
                </span>
                <span className="sm:hidden">
                  {statusFilter === "all" ? "Status" : STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label || "Status"}
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    showStatusDropdown && "rotate-180",
                  )}
                />
                {statusFilter !== "all" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setStatusFilter("all");
                      setShowStatusDropdown(false);
                    }}
                    className="ml-0.5 p-0.5 rounded hover:bg-gray-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </button>

              {showStatusDropdown && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 rounded-xl border border-gray-700 shadow-xl z-50">
                  <div className="p-1.5">
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setStatusFilter(option.value);
                          setShowStatusDropdown(false);
                        }}
                        className={cn(
                          "w-full px-3 py-2 rounded-lg text-sm text-left transition-colors flex items-center justify-between",
                          statusFilter === option.value
                            ? "bg-blue-500/20 text-blue-400"
                            : "text-gray-300 hover:bg-gray-700",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            option.value === "all" ? "bg-gray-500" :
                            option.value === "completed" ? "bg-green-400" :
                            option.value === "pending" ? "bg-yellow-400" :
                            option.value === "failed" ? "bg-red-400" : "bg-gray-400",
                          )} />
                          <span>{option.label}</span>
                        </div>
                        <span className="text-xs text-gray-500 tabular-nums">
                          {statusCounts[option.value]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

        {/* Date Filter */}
        <div className="relative flex-shrink-0" ref={dateDropdownRef}>
          <button
            onClick={() => setShowDateDropdown(!showDateDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors border border-gray-700"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">{getDateFilterLabel()}</span>
            <span className="sm:hidden">
              {datePreset === "all"
                ? "All"
                : datePreset === "custom"
                  ? "Custom"
                  : `${datePreset}d`}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                showDateDropdown && "rotate-180",
              )}
            />
            {datePreset !== "all" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearDateFilter();
                }}
                className="ml-1 p-0.5 rounded hover:bg-gray-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </button>

          {showDateDropdown && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 rounded-xl border border-gray-700 shadow-xl z-50">
              <div className="p-2">
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handleDatePresetChange(preset.value)}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg text-sm text-left transition-colors",
                      datePreset === preset.value
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "text-gray-300 hover:bg-gray-700",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {datePreset === "custom" && (
                <div className="border-t border-gray-700 p-4 space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-yellow-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:border-yellow-500"
                    />
                  </div>
                  <button
                    onClick={handleCustomDateApply}
                    className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded-lg text-sm font-medium transition-colors"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
          </div>{/* end Status + Date filters */}
        </div>{/* end Top row */}
      </div>{/* end Filters Row */}

      {/* Transaction count + Download */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Showing {Math.min(visibleCount, filteredTransactions.length)} of {filteredTransactions.length} transactions
        </p>
        {filteredTransactions.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportTransactionsToCSV(
                filteredTransactions,
                settings?.credits.name || "Credits",
                settings?.currency.symbol || "€",
                creditsToEUR,
              )
            }
            className="text-xs gap-1.5 h-7"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        )}
      </div>

      {/* Transaction List */}
      {filteredTransactions.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-500">
            No {filter === "all" ? "" : filter} transactions found
            {datePreset !== "all" ? " for selected period" : ""}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.slice(0, visibleCount).map((transaction) => (
            <TransactionItem
              key={transaction._id}
              transaction={transaction}
              preloadedInvoiceId={invoiceMap[transaction._id] || null}
            />
          ))}

          {/* Show More / Show All */}
          {filteredTransactions.length > visibleCount && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="text-xs"
              >
                Show More ({filteredTransactions.length - visibleCount} remaining)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVisibleCount(filteredTransactions.length)}
                className="text-xs text-gray-400"
              >
                Show All
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TransactionItem({
  transaction,
  preloadedInvoiceId,
}: {
  transaction: Transaction;
  preloadedInvoiceId: string | null;
}) {
  const { settings, creditsToEUR } = useAppSettings();

  // Invoice ID is now provided by the parent via a single batch API call
  // instead of each row making its own request (was N+1 pattern).
  const invoiceId = preloadedInvoiceId;
  const loadingInvoice = false;

  const handleViewInvoice = () => {
    if (invoiceId) {
      window.open(`/api/user/invoices/${invoiceId}/html`, "_blank");
    }
  };

  const getTransactionIcon = () => {
    switch (transaction.transactionType) {
      case "deposit":
      case "manual_deposit_credit":
        return <ArrowDownCircle className="h-5 w-5 text-green-500" />;
      case "withdrawal":
        return <ArrowUpCircle className="h-5 w-5 text-red-500" />;
      case "withdrawal_fee":
        return <ShieldAlert className="h-5 w-5 text-orange-500" />;
      case "withdrawal_refund":
        return <RefreshCw className="h-5 w-5 text-green-500" />;
      case "chargeback_clawback":
        return <ShieldAlert className="h-5 w-5 text-red-500" />;
      case "competition_entry":
        return <ShieldAlert className="h-5 w-5 text-blue-500" />;
      case "competition_win":
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case "competition_refund":
        return <RefreshCw className="h-5 w-5 text-purple-500" />;
      case "platform_fee":
        return <ShieldAlert className="h-5 w-5 text-orange-500" />;
      case "admin_adjustment":
        return <UserCog className="h-5 w-5 text-gray-500" />;
      // Challenge transactions
      case "challenge_entry":
        return <Swords className="h-5 w-5 text-orange-500" />;
      case "challenge_win":
        return <Swords className="h-5 w-5 text-yellow-500" />;
      case "challenge_refund":
        return <Swords className="h-5 w-5 text-purple-500" />;
      case "challenge_declined":
        return <Swords className="h-5 w-5 text-gray-400" />;
      case "challenge_expired":
        return <Swords className="h-5 w-5 text-gray-500" />;
      case "incident_compensation":
        return <Gift className="h-5 w-5 text-green-500" />;
      // Marketplace purchases
      case "marketplace_purchase":
      case "gamemaster_subscription":
      case "gamemaster_subscription_refund":
        return <Zap className="h-5 w-5 text-pink-500" />;
      // GM Referral earnings
      case "gamemaster_earning":
      case "gamemaster_challenge_referral":
        return <Crown className="h-5 w-5 text-amber-400" />;
      default:
        return <ArrowDownCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTransactionLabel = () => {
    const creditName = settings?.credits.name || "Credits";
    switch (transaction.transactionType) {
      case "deposit":
        return `Buy ${creditName}`;
      case "manual_deposit_credit":
        return "Manual Credit";
      case "withdrawal":
        return "Withdrawal";
      case "withdrawal_fee":
        return "Withdrawal Fee";
      case "withdrawal_refund":
        return "Withdrawal Refund";
      case "chargeback_clawback":
        return "Chargeback Reversal";
      case "marketplace_purchase":
        return "Marketplace Purchase";
      case "gamemaster_subscription":
        return "GM Subscription";
      case "gamemaster_subscription_refund":
        return "GM Subscription Refund";
      case "competition_entry":
        return "Competition Entry";
      case "competition_win":
        return "Competition Prize";
      case "competition_refund":
        return "Competition Refund";
      case "platform_fee":
        return "Platform Fee";
      case "admin_adjustment":
        return "Admin Adjustment";
      // Challenge transactions
      case "challenge_entry":
        return "⚔️ Challenge Entry";
      case "challenge_win":
        return "⚔️ Challenge Win";
      case "challenge_refund":
        return "⚔️ Challenge Refund";
      case "challenge_declined":
        return "⚔️ Challenge Declined";
      case "challenge_expired":
        return "⚔️ Challenge Expired";
      case "incident_compensation":
        return "💰 Compensation";
      // GM Referral earnings
      case "gamemaster_earning":
        return "👑 Referral Earnings";
      case "gamemaster_challenge_referral":
        return "👑 Challenge Referral";
      default:
        return "Transaction";
    }
  };

  const getStatusBadge = () => {
    // For withdrawals, show more detailed status
    if (transaction.transactionType === "withdrawal") {
      switch (transaction.status) {
        case "completed":
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
              ✓ Sent to Bank
            </span>
          );
        case "pending":
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
              Processing
            </span>
          );
        case "failed":
          return (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20"
              title={transaction.failureReason}
            >
              Rejected
            </span>
          );
        case "cancelled":
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
              Cancelled
            </span>
          );
      }
    }

    // Default status badges for other transaction types
    switch (transaction.status) {
      case "completed":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            Completed
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            Pending
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            Failed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const isPositive = transaction.amount > 0;
  const creditsAmount = Math.abs(transaction.amount);
  const eurAmount = creditsToEUR(creditsAmount);

  if (!settings) return null;

  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-gray-800/30 border border-gray-700/50 hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Icon */}
        <div className="shrink-0 w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
          {getTransactionIcon()}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-gray-100 truncate">
              {getTransactionLabel()}
            </p>
            {getStatusBadge()}
            {/* Reason: refunded deposits get a clear label so the customer
                understands this charge was returned to their card. Reads the
                deposit's refund metadata — no separate ledger row is created. */}
            {transaction.transactionType === "deposit" &&
              transaction.metadata?.refundStatus === "completed" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  ↩ Refunded
                </span>
              )}
          </div>
          {/* Enhanced description for withdrawals showing fees */}
          {transaction.transactionType === "withdrawal" &&
          transaction.metadata ? (
            <p className="text-xs text-gray-500 truncate">
              {creditsAmount.toFixed(settings?.credits.decimals || 0)}{" "}
              {settings?.credits.name || "credits"}
              {transaction.metadata.netAmountEUR &&
              transaction.metadata.platformFee ? (
                <span className="text-gray-400">
                  {" "}
                  (You receive: {settings?.currency?.symbol || "€"}
                  {Number(transaction.metadata.netAmountEUR).toFixed(2)}, Fee:{" "}
                  {settings?.currency?.symbol || "€"}
                  {Number(transaction.metadata.platformFee).toFixed(2)})
                </span>
              ) : null}
            </p>
          ) : (
            <p className="text-xs text-gray-500 truncate">
              {transaction.description}
            </p>
          )}

          {/* Show failure/cancel reason for failed transactions */}
          {(transaction.status === "failed" ||
            transaction.status === "cancelled") && (
            <p
              className="text-xs text-red-400 mt-1 truncate max-w-md"
              title={
                transaction.failureReason ||
                (transaction.metadata?.cancelReason as string) ||
                (transaction.metadata?.clientErrorDescription as string) ||
                (transaction.metadata?.errorReason as string) ||
                "No details available"
              }
            >
              ❌{" "}
              {transaction.failureReason ||
                (transaction.metadata?.cancelReason as string) ||
                (transaction.metadata?.clientErrorDescription as string) ||
                (transaction.metadata?.errorReason as string) ||
                (transaction.status === "cancelled"
                  ? "Payment was cancelled by user"
                  : "Payment was declined by card issuer")}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-600" suppressHydrationWarning>
              {new Date(transaction.createdAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </p>
            {transaction.paymentMethod && (
              <>
                <span className="text-gray-700">•</span>
                <p className="text-xs text-gray-600 capitalize">
                  {transaction.paymentMethod}
                </p>
              </>
            )}
            {/* Show bank transfer for withdrawals */}
            {transaction.transactionType === "withdrawal" && (
              <>
                <span className="text-gray-700">•</span>
                <p className="text-xs text-gray-600">Bank Transfer</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Amount & Invoice */}
      <div className="flex items-center gap-3 shrink-0 ml-4">
        {/* Invoice Button (only for completed deposits with invoice) */}
        {transaction.transactionType === "deposit" &&
          transaction.status === "completed" && (
            <div className="shrink-0">
              {loadingInvoice ? (
                <div className="w-9 h-9 rounded-lg bg-gray-800/50 flex items-center justify-center">
                  <RefreshCw className="h-4 w-4 text-gray-500 animate-spin" />
                </div>
              ) : invoiceId ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleViewInvoice}
                  className="h-9 w-9 p-0 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:border-amber-500/50 rounded-lg"
                  title="View Invoice"
                >
                  <FileText className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          )}

        {/* Amount */}
        <div className="text-right">
          <div className="flex items-baseline gap-1.5 justify-end">
            {/* Show amount differently for failed/cancelled transactions */}
            {transaction.status === "failed" ||
            transaction.status === "cancelled" ? (
              <>
                <p className="text-lg font-bold tabular-nums text-gray-500 line-through">
                  {isPositive ? "+" : "-"}
                  {creditsAmount.toFixed(settings.credits.decimals)}
                </p>
                <span className="text-sm font-semibold text-gray-500 line-through">
                  {settings.credits.symbol}
                </span>
              </>
            ) : (
              <>
                <p
                  className={`text-lg font-bold tabular-nums ${isPositive ? "text-green-500" : "text-red-500"}`}
                >
                  {isPositive ? "+" : "-"}
                  {creditsAmount.toFixed(settings.credits.decimals)}
                </p>
                <span
                  className={`text-sm font-semibold ${isPositive ? "text-green-500" : "text-red-500"}`}
                >
                  {settings.credits.symbol}
                </span>
              </>
            )}
          </div>
          {settings.credits.showEUREquivalent && (
            <p
              className={`text-xs tabular-nums ${transaction.status === "failed" || transaction.status === "cancelled" ? "text-gray-600 line-through" : "text-gray-500"}`}
            >
              ≈ {isPositive ? "+" : "-"}
              {settings.currency.symbol}
              {eurAmount.toFixed(2)}
            </p>
          )}
          {/* Show "Not charged" for failed/cancelled */}
          {(transaction.status === "failed" ||
            transaction.status === "cancelled") && (
            <p className="text-[11px] text-gray-500 mt-0.5">
              {transaction.status === "cancelled"
                ? "Cancelled"
                : "Not processed"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
