"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  RefreshCw,
  Search,
  Download,
  AlertTriangle,
  Banknote,
  PiggyBank,
  ArrowRightLeft,
  History,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Building2,
  ShieldAlert,
  Target,
  FileText,
  Calendar,
  FileArchive,
  FileSpreadsheet,
  Loader2,
  Info,
} from "lucide-react";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import ReconciliationSection from "./ReconciliationSection";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface WalletData {
  userId: string;
  userName: string;
  userEmail: string;
  creditBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalWonFromCompetitions: number;
  totalSpentOnCompetitions: number;
  totalWonFromChallenges: number;
  totalSpentOnChallenges: number;
  totalSpentOnMarketplace: number;
}

interface PendingWithdrawal {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  amountEUR: number;
  status: string;
  createdAt: string;
  platformFee: number;
  bankFee: number;
  netAmountEUR: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

interface LiabilityMetrics {
  totalUserCredits: number;
  totalUserCreditsEUR: number;
  pendingWithdrawals: number;
  pendingWithdrawalsEUR: number;
  totalLiability: number;
  theoreticalBankBalance: number;
  coverageRatio: number;
  platformNetCredits: number;
  platformNetEUR: number;
}

interface PlatformFinancials {
  totalUnclaimedPools: number;
  totalPlatformFees: number;
  totalChallengeFees: number; // Challenge platform fees
  totalGameMasterFees: number; // Fees paid to game masters
  totalRetainedGmFees: number; // GM fees retained due to inactive subscriptions
  retainedGmFeesCount: number; // Number of retained GM fee instances

  // Competition fee breakdown by creator (admin vs GM)
  competitionFeeBreakdown?: {
    adminCompetitionFees: number;
    adminCompetitionFeeCount: number;
    gmCompetitionFees: number;
    gmCompetitionFeeCount: number;
  };

  // Marketplace revenue
  totalMarketplaceSales: number;
  marketplacePurchases: number;

  // Gross fees (what platform charges users)
  totalDepositFeesGross: number;
  totalWithdrawalFeesGross: number;

  // Bank fees (what providers charge platform)
  totalBankDepositFees: number;
  totalBankWithdrawalFees: number;
  totalBankFees: number;

  // Net earnings (what platform actually keeps)
  netDepositEarnings: number;
  netWithdrawalEarnings: number;
  totalGrossEarnings: number;
  totalNetEarnings: number;
  totalNetEarningsEUR: number;

  // VAT Tracking
  totalVATCollected: number;
  totalVATPaid: number;
  outstandingVAT: number;

  // Vendor Payments
  totalVendorPayments?: number;
  vendorPaymentCount?: number;

  // Admin Balance Additions
  totalAdminBalanceAdded?: number;
  adminBalanceAddCount?: number;

  // Custom Expenses
  totalCustomExpenses?: number;
  customExpenseCount?: number;

  // Net Operating Balance
  netOperatingBalance?: number;

  // User deposits/withdrawals (actual money flow)
  totalUserDeposits: number; // Base EUR deposited by users for credits
  totalUserWithdrawals: number; // EUR withdrawn by users

  // GM fee breakdowns by source
  gmFeesFromCompetitions?: number;
  gmFeesFromChallenges?: number;
  gmCompetitionPaymentCount?: number;
  gmChallengePaymentCount?: number;

  // Legacy fields for backward compatibility
  totalDepositFees?: number;
  totalWithdrawalFees?: number;
  totalEarnings?: number;
  totalEarningsEUR?: number;

  totalAdminWithdrawals: number;
  totalAdminWithdrawalsEUR: number;

  // Incident Compensations (platform expense)
  totalIncidentCompensations: number;
  totalIncidentCompensationsEUR: number;
  incidentCompensationsCount: number;

  unclaimedPools: {
    totalAmount: number;
    totalAmountEUR: number;
    byReason: Record<string, { count: number; amount: number }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recentPools: any[];
  };
}

interface VATData {
  currentPeriod: {
    start: Date;
    end: Date;
    vatCollected: number;
    transactionCount: number;
  };
  outstanding: {
    total: number;
    fromPreviousPeriods: number;
    currentPeriod: number;
  };
  allTime: {
    collected: number;
    paid: number;
    outstanding: number;
  };
  paymentHistory: VATPayment[];
}

interface VATPayment {
  _id: string;
  periodStart: string;
  periodEnd: string;
  vatAmountEUR: number;
  transactionCount: number;
  status: "pending" | "paid";
  paidAt?: string;
  paidByEmail?: string;
  reference?: string;
  createdAt: string;
}

interface VendorSubscription {
  _id: string;
  name: string;
  serviceType: string;
  description?: string;
  amount: number;
  currency: string;
  billingCycle: "monthly" | "quarterly" | "yearly" | "one-time";
  nextPaymentDate: string;
  lastPaymentDate?: string;
  isActive: boolean;
  vendorUrl?: string;
}

interface VendorPaymentRecord {
  _id: string;
  vendorId: string;
  vendorName: string;
  serviceType: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded";
  paidAt?: string;
  paidByEmail?: string;
  reference?: string;
  invoiceNumber?: string;
  notes?: string;
  createdAt: string;
}

interface VendorPaymentData {
  payments: VendorPaymentRecord[];
  summary: {
    totalPaid: number;
    paymentCount: number;
    byServiceType: { _id: string; total: number; count: number }[];
    byVendor: { _id: string; total: number; count: number }[];
    monthlyTotals: { _id: number; total: number; count: number }[];
  };
  upcoming: {
    vendors: VendorSubscription[];
    total: number;
    count: number;
  };
}

interface Transaction {
  _id: string;
  userId: string;
  userName?: string;
  transactionType: string;
  amount: number;
  amountEUR?: number;
  status: string;
  createdAt: string;
  description?: string;
  competitionId?: string;
  paymentMethod?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  source?: "wallet" | "platform" | "vat";
  userInfo?: {
    id: string;
    name: string;
    email: string;
  };
}

export default function FinancialDashboard() {
  const { settings } = useAppSettings();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Data states
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<
    PendingWithdrawal[]
  >([]);
  const [liabilityMetrics, setLiabilityMetrics] =
    useState<LiabilityMetrics | null>(null);
  const [platformFinancials, setPlatformFinancials] =
    useState<PlatformFinancials | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    [],
  );
  const [conversionRate, setConversionRate] = useState(100);

  // Transaction history states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [txLoading, setTxLoading] = useState(false);
  const [txFilters, setTxFilters] = useState({
    type: "all",
    status: "all",
    search: "",
    startDate: "",
    endDate: "",
  });
  const [exportingTransactions, setExportingTransactions] = useState(false);

  // Admin Funds states
  const [adminFundsData, setAdminFundsData] = useState<{
    transactions: Array<{
      _id: string;
      transactionType: string;
      amountEUR: number;
      description: string;
      notes?: string;
      createdAt: string;
      processedByEmail?: string;
      balanceAddDetails?: { source: string; reference?: string };
      expenseDetails?: {
        category: string;
        vendor?: string;
        invoiceNumber?: string;
      };
    }>;
    summary: {
      totalBalanceAdded: number;
      balanceAddCount: number;
      totalExpenses: number;
      expenseCount: number;
      netOperatingBalance: number;
      expensesByCategory: Array<{ _id: string; total: number; count: number }>;
    };
  } | null>(null);
  const [showAddBalanceDialog, setShowAddBalanceDialog] = useState(false);
  const [showAddExpenseDialog, setShowAddExpenseDialog] = useState(false);
  const [adminFundsProcessing, setAdminFundsProcessing] = useState(false);
  const [balanceAddForm, setBalanceAddForm] = useState({
    amount: "",
    source: "",
    reference: "",
    notes: "",
    description: "",
  });
  const [expenseForm, setExpenseForm] = useState({
    amount: "",
    category: "other",
    vendor: "",
    invoiceNumber: "",
    paymentMethod: "",
    notes: "",
    description: "",
  });

  // Analytics states
  const [analyticsData, setAnalyticsData] = useState<{
    period: { startDate: string; endDate: string; days: number };
    summary: {
      totalIncome: number;
      totalExpenses: number;
      netProfit: number;
      totalDeposits: number;
      totalWithdrawals: number;
      profitMargin: number;
      incomeGrowth: number;
      expenseGrowth: number;
    };
    timeSeries: Array<{
      date: string;
      deposits: number;
      withdrawals: number;
      competitionFees: number;
      challengeFees: number;
      depositFees: number;
      withdrawalFees: number;
      unclaimedPools: number;
      adminWithdrawals: number;
      vendorPayments: number;
      vatPayments: number;
      customExpenses: number;
      adminBalanceAdded: number;
      totalIncome: number;
      totalExpenses: number;
      netProfit: number;
      cumulativeIncome: number;
      cumulativeExpenses: number;
      cumulativeProfit: number;
    }>;
    revenuePieData: Array<{ name: string; value: number; color: string }>;
    expensePieData: Array<{ name: string; value: number; color: string }>;
  } | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState("30");
  const [analyticsCustomStart, setAnalyticsCustomStart] = useState("");
  const [analyticsCustomEnd, setAnalyticsCustomEnd] = useState("");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // VAT states
  const [vatEnabled, setVatEnabled] = useState<boolean>(false);
  const [vatData, setVatData] = useState<VATData | null>(null);
  const [vatDateRange, setVatDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [showVatPayDialog, setShowVatPayDialog] = useState(false);
  const [vatPaymentProcessing, setVatPaymentProcessing] = useState(false);
  const [vatPaymentRef, setVatPaymentRef] = useState("");
  const [vatPaymentNotes, setVatPaymentNotes] = useState("");

  // Vendor Payment states
  const [vendorPaymentData, setVendorPaymentData] =
    useState<VendorPaymentData | null>(null);
  const [showVendorPayDialog, setShowVendorPayDialog] = useState(false);
  const [selectedVendor, setSelectedVendor] =
    useState<VendorSubscription | null>(null);
  const [vendorPaymentProcessing, setVendorPaymentProcessing] = useState(false);
  const [vendorPaymentRef, setVendorPaymentRef] = useState("");
  const [vendorPaymentInvoice, setVendorPaymentInvoice] = useState("");
  const [vendorPaymentNotes, setVendorPaymentNotes] = useState("");
  const [vendorPaymentAmount, setVendorPaymentAmount] = useState("");

  // Invoice export states
  const [invoiceDateRange, setInvoiceDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [invoiceSummary, setInvoiceSummary] = useState<{
    count: number;
    totalAmount: number;
    totalVAT: number;
    totalSubtotal: number;
  } | null>(null);
  const [loadingInvoiceSummary, setLoadingInvoiceSummary] = useState(false);
  const [exportingInvoices, setExportingInvoices] = useState(false);

  // Admin withdrawal dialog
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBank, setWithdrawBank] = useState("");
  const [withdrawAccount, setWithdrawAccount] = useState("");
  const [withdrawReference, setWithdrawReference] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  // Backfill state
  const [backfilling, setBackfilling] = useState(false);

  // Search states
  const [walletSearch, setWalletSearch] = useState("");

  // Transaction detail dialog
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [transactionInvoice, setTransactionInvoice] = useState<any>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Get dynamic currency settings
  const creditName = settings?.credits?.name || "Credits";
  const creditSymbol = settings?.credits?.symbol || "⚡";
  const currencySymbol = settings?.currency?.symbol || "€";
  const currencyCode = settings?.currency?.code || "EUR";

  const fetchVatEnabled = useCallback(async () => {
    try {
      const response = await fetch("/api/invoice-settings");
      if (response.ok) {
        const result = await response.json();
        // API returns invoiceSettings object directly, not wrapped in 'data'
        const isVatEnabled =
          result.invoiceSettings?.vatEnabled || result.shouldApplyVat || false;
        setVatEnabled(isVatEnabled);
      }
    } catch (error) {
      console.error("Failed to fetch VAT settings:", error);
    }
  }, []);

  const fetchVatData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        startDate: vatDateRange.start,
        endDate: vatDateRange.end,
      });
      const response = await fetch(`/api/vat?${params}`);
      if (!response.ok) throw new Error("Failed to fetch VAT data");

      const result = await response.json();
      setVatData(result.data);
    } catch (error) {
      console.error("Failed to load VAT data:", error);
    }
  }, [vatDateRange]);

  const fetchVendorPaymentData = useCallback(async () => {
    try {
      const response = await fetch("/api/vendor-payments");
      if (!response.ok) throw new Error("Failed to fetch vendor payment data");

      const result = await response.json();
      setVendorPaymentData(result.data);
    } catch (error) {
      console.error("Failed to load vendor payment data:", error);
    }
  }, []);

  const fetchAdminFundsData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin-funds");
      if (!response.ok) throw new Error("Failed to fetch admin funds data");

      const result = await response.json();
      setAdminFundsData(result.data);
    } catch (error) {
      console.error("Failed to load admin funds data:", error);
    }
  }, []);

  const fetchAnalyticsData = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const params = new URLSearchParams({ period: analyticsPeriod });
      if (
        analyticsPeriod === "custom" &&
        analyticsCustomStart &&
        analyticsCustomEnd
      ) {
        params.set("startDate", analyticsCustomStart);
        params.set("endDate", analyticsCustomEnd);
      }

      const response = await fetch(`/api/financial-analytics?${params}`);
      if (!response.ok) throw new Error("Failed to fetch analytics data");

      const result = await response.json();
      setAnalyticsData(result.data);
    } catch (error) {
      console.error("Failed to load analytics data:", error);
      toast.error("Failed to load analytics data");
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsPeriod, analyticsCustomStart, analyticsCustomEnd]);

  const handleExportTransactions = async () => {
    setExportingTransactions(true);
    try {
      const params = new URLSearchParams();
      if (txFilters.type !== "all") params.set("type", txFilters.type);
      if (txFilters.status !== "all") params.set("status", txFilters.status);
      if (txFilters.search) params.set("search", txFilters.search);
      if (txFilters.startDate) params.set("startDate", txFilters.startDate);
      if (txFilters.endDate) params.set("endDate", txFilters.endDate);

      const response = await fetch(`/api/transactions/export?${params}`);
      if (!response.ok) throw new Error("Failed to export transactions");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Transactions exported successfully");
    } catch (error) {
      toast.error("Failed to export transactions");
      console.error(error);
    } finally {
      setExportingTransactions(false);
    }
  };

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/financial-dashboard");
      if (!response.ok) throw new Error("Failed to fetch data");

      const result = await response.json();
      setWallets(result.data.wallets);
      setPendingWithdrawals(result.data.pendingWithdrawals);
      setLiabilityMetrics(result.data.liabilityMetrics);
      setPlatformFinancials(result.data.platformFinancials);
      setRecentTransactions(result.data.recentTransactions);
      setConversionRate(result.data.conversionRate);

      // Fetch VAT enabled status first
      await fetchVatEnabled();

      // Also fetch VAT data (for historical data even if VAT is now disabled)
      await fetchVatData();

      // Fetch vendor payment data
      await fetchVendorPaymentData();

      // Fetch admin funds data
      await fetchAdminFundsData();
    } catch (error) {
      toast.error("Failed to load financial data");
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    fetchVatData,
    fetchVatEnabled,
    fetchVendorPaymentData,
    fetchAdminFundsData,
  ]);

  const fetchTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const params = new URLSearchParams({
        page: txPage.toString(),
        limit: "50",
        type: txFilters.type,
        status: txFilters.status,
        search: txFilters.search,
      });
      if (txFilters.startDate) params.set("startDate", txFilters.startDate);
      if (txFilters.endDate) params.set("endDate", txFilters.endDate);

      const response = await fetch(`/api/transactions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch transactions");

      const result = await response.json();
      setTransactions(result.data.transactions);
      setTxTotal(result.data.pagination.total);
    } catch (error) {
      toast.error("Failed to load transactions");
      console.error(error);
    } finally {
      setTxLoading(false);
    }
  }, [txPage, txFilters]);

  // Handle transaction click - fetch details and invoice if deposit
  const handleTransactionClick = async (tx: Transaction) => {
    setSelectedTransaction(tx);
    setTransactionInvoice(null);

    // If it's a deposit transaction, try to fetch the associated invoice
    if (tx.transactionType === "deposit" && tx.status === "completed") {
      setLoadingInvoice(true);
      try {
        // Try to find invoice by payment ID or user ID + date
        const response = await fetch(
          `/api/invoices/by-transaction?transactionId=${tx._id}&userId=${tx.userId}&paymentId=${tx.metadata?.paymentIntentId || ""}`,
        );
        if (response.ok) {
          const result = await response.json();
          if (result.invoice) {
            setTransactionInvoice(result.invoice);
          }
        }
      } catch (error) {
        console.error("Failed to fetch invoice:", error);
      } finally {
        setLoadingInvoice(false);
      }
    }
  };

  // Fetch invoice summary for export
  const fetchInvoiceSummary = useCallback(async () => {
    setLoadingInvoiceSummary(true);
    try {
      const response = await fetch("/api/invoices/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: invoiceDateRange.start,
          endDate: invoiceDateRange.end,
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch invoice summary");

      const result = await response.json();
      setInvoiceSummary({
        count: result.count,
        totalAmount: result.totalAmount,
        totalVAT: result.totalVAT,
        totalSubtotal: result.totalSubtotal,
      });
    } catch (error) {
      console.error("Failed to fetch invoice summary:", error);
      setInvoiceSummary(null);
    } finally {
      setLoadingInvoiceSummary(false);
    }
  }, [invoiceDateRange]);

  // Export invoices as ZIP
  const handleExportInvoices = async (format: "zip" | "csv") => {
    setExportingInvoices(true);
    try {
      const params = new URLSearchParams({
        startDate: invoiceDateRange.start,
        endDate: invoiceDateRange.end,
        format,
      });

      const response = await fetch(`/api/invoices/export?${params}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Export failed");
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        format === "zip"
          ? `invoices_${invoiceDateRange.start}_to_${invoiceDateRange.end}.zip`
          : `invoices_${invoiceDateRange.start}_to_${invoiceDateRange.end}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(
        `Invoices exported successfully as ${format.toUpperCase()}`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export invoices",
      );
    } finally {
      setExportingInvoices(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === "transactions") {
      fetchTransactions();
    }
  }, [activeTab, fetchTransactions]);

  useEffect(() => {
    if (activeTab === "invoices") {
      fetchInvoiceSummary();
    }
  }, [activeTab, invoiceDateRange, fetchInvoiceSummary]);

  useEffect(() => {
    if (activeTab === "analytics") {
      fetchAnalyticsData();
    }
  }, [activeTab, fetchAnalyticsData]);

  const handleAdminWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const amountEUR = parseFloat(withdrawAmount);
    const maxWithdrawable = Math.max(
      0,
      (liabilityMetrics?.theoreticalBankBalance || 0) -
        (liabilityMetrics?.totalUserCreditsEUR || 0) -
        (vatEnabled ? platformFinancials?.outstandingVAT || 0 : 0),
    );

    if (amountEUR > maxWithdrawable) {
      toast.error(
        `Cannot withdraw more than ${currencySymbol}${maxWithdrawable.toFixed(2)} (available after obligations)`,
      );
      return;
    }

    const amount = amountEUR * conversionRate; // Convert EUR to credits

    setWithdrawing(true);
    try {
      const response = await fetch("/api/platform-financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          amountEUR,
          bankName: withdrawBank,
          accountLastFour: withdrawAccount,
          reference: withdrawReference,
          notes: withdrawNotes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to record withdrawal");
        return;
      }

      toast.success(
        `Successfully recorded withdrawal of ${currencySymbol}${amountEUR.toFixed(2)}`,
      );
      setShowWithdrawDialog(false);
      setWithdrawAmount("");
      setWithdrawBank("");
      setWithdrawAccount("");
      setWithdrawReference("");
      setWithdrawNotes("");
      fetchData();
    } catch (error) {
      toast.error("Failed to process withdrawal");
      console.error(error);
    } finally {
      setWithdrawing(false);
    }
  };

  const handleVatPayment = async () => {
    if (!vatData?.outstanding.total || vatData.outstanding.total <= 0) {
      toast.error("No outstanding VAT to pay");
      return;
    }

    setVatPaymentProcessing(true);
    try {
      const response = await fetch("/api/vat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart: vatDateRange.start,
          periodEnd: vatDateRange.end,
          amount: vatData.outstanding.total,
          reference: vatPaymentRef,
          notes: vatPaymentNotes,
        }),
      });

      if (!response.ok) throw new Error("Failed to record VAT payment");

      toast.success(
        `VAT payment of ${currencySymbol}${vatData.outstanding.total.toFixed(2)} recorded successfully`,
      );
      setShowVatPayDialog(false);
      setVatPaymentRef("");
      setVatPaymentNotes("");
      fetchData();
    } catch (error) {
      toast.error("Failed to record VAT payment");
      console.error(error);
    } finally {
      setVatPaymentProcessing(false);
    }
  };

  const handleVendorPayment = async () => {
    if (!selectedVendor) {
      toast.error("No vendor selected");
      return;
    }

    const amount = parseFloat(vendorPaymentAmount) || selectedVendor.amount;
    if (amount <= 0) {
      toast.error("Invalid payment amount");
      return;
    }

    setVendorPaymentProcessing(true);
    try {
      const response = await fetch("/api/vendor-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: selectedVendor._id,
          amount,
          reference: vendorPaymentRef,
          invoiceNumber: vendorPaymentInvoice,
          notes: vendorPaymentNotes,
        }),
      });

      if (!response.ok) throw new Error("Failed to record vendor payment");

      const result = await response.json();
      toast.success(
        result.message ||
          `Payment of ${currencySymbol}${amount.toFixed(2)} to ${selectedVendor.name} recorded successfully`,
      );
      setShowVendorPayDialog(false);
      setSelectedVendor(null);
      setVendorPaymentRef("");
      setVendorPaymentInvoice("");
      setVendorPaymentNotes("");
      setVendorPaymentAmount("");
      fetchData();
    } catch (error) {
      toast.error("Failed to record vendor payment");
      console.error(error);
    } finally {
      setVendorPaymentProcessing(false);
    }
  };

  const openVendorPayDialog = (vendor: VendorSubscription) => {
    setSelectedVendor(vendor);
    setVendorPaymentAmount(vendor.amount.toString());
    setShowVendorPayDialog(true);
  };

  const handleAddBalance = async () => {
    const amount = parseFloat(balanceAddForm.amount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!balanceAddForm.source) {
      toast.error("Please specify the source of funds");
      return;
    }

    setAdminFundsProcessing(true);
    try {
      const response = await fetch("/api/admin-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_balance",
          amount,
          source: balanceAddForm.source,
          reference: balanceAddForm.reference,
          notes: balanceAddForm.notes,
          description: balanceAddForm.description,
        }),
      });

      if (!response.ok) throw new Error("Failed to add balance");

      const result = await response.json();
      toast.success(
        result.message || `${currencySymbol}${amount.toFixed(2)} added to operating funds`,
      );
      setShowAddBalanceDialog(false);
      setBalanceAddForm({
        amount: "",
        source: "",
        reference: "",
        notes: "",
        description: "",
      });
      fetchData();
    } catch (error) {
      toast.error("Failed to add balance");
      console.error(error);
    } finally {
      setAdminFundsProcessing(false);
    }
  };

  const handleAddExpense = async () => {
    const amount = parseFloat(expenseForm.amount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setAdminFundsProcessing(true);
    try {
      const response = await fetch("/api/admin-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_expense",
          amount,
          category: expenseForm.category,
          vendor: expenseForm.vendor,
          invoiceNumber: expenseForm.invoiceNumber,
          paymentMethod: expenseForm.paymentMethod,
          notes: expenseForm.notes,
          description: expenseForm.description,
        }),
      });

      if (!response.ok) throw new Error("Failed to record expense");

      const result = await response.json();
      toast.success(result.message || `${currencySymbol}${amount.toFixed(2)} expense recorded`);
      setShowAddExpenseDialog(false);
      setExpenseForm({
        amount: "",
        category: "other",
        vendor: "",
        invoiceNumber: "",
        paymentMethod: "",
        notes: "",
        description: "",
      });
      fetchData();
    } catch (error) {
      toast.error("Failed to record expense");
      console.error(error);
    } finally {
      setAdminFundsProcessing(false);
    }
  };

  const handleBackfillFees = async () => {
    if (
      !confirm(
        "This will calculate and record fees for all existing deposits/withdrawals. Continue?",
      )
    ) {
      return;
    }

    setBackfilling(true);
    try {
      const response = await fetch("/api/platform-financials/backfill", {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to backfill fees");

      const result = await response.json();
      toast.success(
        `Backfilled ${result.depositsBackfilled} deposits and ${result.withdrawalsBackfilled} withdrawals`,
      );
      fetchData();
    } catch (error) {
      toast.error("Failed to backfill fees");
      console.error(error);
    } finally {
      setBackfilling(false);
    }
  };

  const creditsToEUR = (credits: number) =>
    (credits / conversionRate).toFixed(2);

  const filteredWallets = wallets.filter(
    (w) =>
      w.userId.toLowerCase().includes(walletSearch.toLowerCase()) ||
      w.userName.toLowerCase().includes(walletSearch.toLowerCase()) ||
      w.userEmail.toLowerCase().includes(walletSearch.toLowerCase()),
  );

  const getTransactionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      deposit: "bg-green-500",
      withdrawal: "bg-blue-500",
      competition_entry: "bg-orange-500",
      competition_win: "bg-yellow-500",
      competition_refund: "bg-purple-500",
      platform_fee: "bg-red-500",
      admin_adjustment: "bg-gray-500",
      withdrawal_fee: "bg-pink-500",
      // Admin transactions
      admin_withdrawal: "bg-cyan-500",
      vat_payment: "bg-indigo-500",
      vendor_payment: "bg-purple-500",
      admin_balance_add: "bg-teal-500",
      custom_expense: "bg-rose-500",
      unclaimed_pool: "bg-amber-500",
      deposit_fee: "bg-emerald-500",
      // Challenge transactions
      challenge_entry: "bg-orange-600",
      challenge_win: "bg-yellow-600",
      challenge_platform_fee: "bg-orange-500",
      challenge_refund: "bg-purple-400",
      challenge_declined: "bg-gray-400",
      challenge_expired: "bg-gray-500",
      // GM-related transactions
      retained_gm_fee: "bg-cyan-500",
      gamemaster_referral: "bg-amber-500",
      gamemaster_earning: "bg-amber-500",
      gamemaster_challenge_referral: "bg-amber-400",
    };
    // Reason: Use Map to avoid ESLint object-injection-sink warning
    const colorMap = new Map(Object.entries(colors));
    return colorMap.get(type) || "bg-gray-500";
  };

  const txTypeLabelMap = new Map<string, string>([
    ["deposit", "User Deposit"], ["withdrawal", "User Withdrawal"],
    ["competition_entry", "Competition Entry"], ["competition_win", "Competition Win"],
    ["competition_refund", "Refund"], ["platform_fee", "Competition Fee"],
    ["admin_adjustment", "Admin Adjustment"], ["withdrawal_fee", "Withdrawal Fee"],
    ["admin_withdrawal", "💰 Admin Withdrawal"], ["vat_payment", "🏛️ VAT Payment"],
    ["vendor_payment", "🏢 Vendor Payment"], ["admin_balance_add", "💵 Balance Addition"],
    ["custom_expense", "📝 Custom Expense"], ["unclaimed_pool", "🎯 Unclaimed Pool"],
    ["deposit_fee", "Deposit Fee"],
    ["challenge_entry", "⚔️ Challenge Entry"], ["challenge_win", "⚔️ Challenge Win"],
    ["challenge_platform_fee", "⚔️ Challenge Fee"], ["challenge_refund", "⚔️ Challenge Refund"],
    ["challenge_declined", "⚔️ Challenge Declined"], ["challenge_expired", "⚔️ Challenge Expired"],
    ["retained_gm_fee", "🎮 Retained GM Fee"], ["gamemaster_referral", "🎮 GM Referral (Comp)"],
    ["gamemaster_earning", "🎮 GM Referral (Comp)"], ["gamemaster_challenge_referral", "🎮 GM Referral (Challenge)"],
  ]);
  const getTransactionTypeLabel = (type: string) =>
    txTypeLabelMap.get(type) || type.replace(/_/g, " ");

  const statusColorMap = new Map<string, string>([
    ["completed", "bg-green-500"], ["pending", "bg-yellow-500"],
    ["failed", "bg-red-500"], ["cancelled", "bg-gray-500"],
  ]);
  const getStatusColor = (status: string) =>
    statusColorMap.get(status) || "bg-gray-500";

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-12">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-400 mr-3" />
          <div className="text-emerald-400 text-lg">
            Loading financial data...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gray-900 border border-emerald-500/50 rounded-2xl shadow-2xl shadow-emerald-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
                <div className="relative h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-xl">
                  <DollarSign className="h-8 w-8 text-emerald-600" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                  💼 Financial Dashboard
                </h2>
                <p className="text-emerald-100 mt-1">
                  Platform finances, liabilities, and transaction history
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleBackfillFees}
                disabled={backfilling}
                variant="outline"
                size="sm"
                className="bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30 text-yellow-400"
                title="Calculate and record fees for existing deposits/withdrawals"
              >
                {backfilling ? (
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <History className="h-3 w-3 mr-1" />
                )}
                Backfill Fees
              </Button>
              <Button
                onClick={() => setShowWithdrawDialog(true)}
                className="bg-white/10 hover:bg-white/20 border border-white/30 text-white backdrop-blur-sm"
              >
                <Banknote className="h-4 w-4 mr-2" />
                Record Withdrawal
              </Button>
              <Button
                onClick={fetchData}
                disabled={refreshing}
                className="bg-white/10 hover:bg-white/20 border border-white/30 text-white backdrop-blur-sm"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="bg-gray-900 border border-gray-700">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="liabilities">Bank & Liabilities</TabsTrigger>
          <TabsTrigger value="earnings">Platform Earnings</TabsTrigger>
          {vatEnabled && <TabsTrigger value="vat">VAT</TabsTrigger>}
          <TabsTrigger value="vendor-payments">Vendor Payments</TabsTrigger>
          <TabsTrigger value="admin-funds">Admin Funds</TabsTrigger>
          <TabsTrigger value="wallets">User Wallets</TabsTrigger>
          <TabsTrigger value="transactions">All Transactions</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="analytics">📊 Analytics</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          {/* TOP SUMMARY - 3 Key Numbers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-green-900/40 to-gray-900 border border-green-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">🏦 Theoretical Bank Balance</p>
                    <p className="text-3xl font-bold text-green-400">
                      {currencySymbol}
                      {(liabilityMetrics?.theoreticalBankBalance || 0).toFixed(
                        2,
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      All deposits − all withdrawals − bank fees
                    </p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-green-500/30" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-900/40 to-gray-900 border border-red-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">⚠️ Total Obligations</p>
                    <p className="text-3xl font-bold text-red-400">
                      {currencySymbol}
                      {(
                        (liabilityMetrics?.totalUserCreditsEUR || 0) +
                        (vatEnabled ? platformFinancials?.outstandingVAT || 0 : 0)
                      ).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {liabilityMetrics?.totalUserCredits?.toLocaleString() || 0}{" "}
                      {creditName} owed to users
                      {vatEnabled && (platformFinancials?.outstandingVAT || 0) > 0
                        ? ` + ${currencySymbol}${(platformFinancials?.outstandingVAT || 0).toFixed(2)} VAT`
                        : ""}
                    </p>
                  </div>
                  <ShieldAlert className="h-10 w-10 text-red-500/30" />
                </div>
              </CardContent>
            </Card>

            {(() => {
              const safeToSpend = Math.max(
                0,
                (liabilityMetrics?.theoreticalBankBalance || 0) -
                  (liabilityMetrics?.totalUserCreditsEUR || 0) -
                  (vatEnabled ? platformFinancials?.outstandingVAT || 0 : 0),
              );
              const isPositive = safeToSpend > 0;
              return (
                <Card
                  className={`bg-gradient-to-br ${
                    isPositive
                      ? "from-cyan-900/40 to-gray-900 border-cyan-500/30"
                      : "from-orange-900/40 to-gray-900 border-orange-500/30"
                  } border`}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">
                          💰 Safe to Spend / Withdraw
                        </p>
                        <p
                          className={`text-3xl font-bold ${
                            isPositive ? "text-cyan-400" : "text-orange-400"
                          }`}
                        >
                          {currencySymbol}
                          {safeToSpend.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Bank − obligations · Coverage:{" "}
                          {((liabilityMetrics?.coverageRatio || 1) * 100).toFixed(0)}%
                          {(liabilityMetrics?.coverageRatio || 1) >= 1 ? " ✅" : " ⚠️"}
                        </p>
                      </div>
                      <Wallet className="h-10 w-10 text-cyan-500/30" />
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          {/* TWO-COLUMN MONEY FLOW */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-blue-400" />
                Money Flow Summary
              </CardTitle>
              <CardDescription>
                Complete view of money in vs money out
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* MONEY IN Column */}
                <div className="bg-green-950/20 border border-green-500/20 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    💰 MONEY IN
                  </h3>
                  <div className="space-y-3">
                    {/* User Deposits */}
                    <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                      <span className="text-gray-300">User Deposits</span>
                      <span className="text-green-400 font-semibold">
                        +{currencySymbol}
                        {(platformFinancials?.totalUserDeposits || 0).toFixed(
                          2,
                        )}
                      </span>
                    </div>
                    {/* Deposit Fees */}
                    <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                      <span className="text-gray-300">
                        Deposit Fees Collected
                      </span>
                      <span className="text-green-400 font-semibold">
                        +{currencySymbol}
                        {(
                          platformFinancials?.totalDepositFeesGross || 0
                        ).toFixed(2)}
                      </span>
                    </div>
                    {/* Competition Fees */}
                    <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                      <div>
                        <span className="text-gray-300">Competition Fees</span>
                        {/* Reason: Show admin vs GM breakdown so admins can see revenue attribution */}
                        {platformFinancials?.competitionFeeBreakdown && (
                          <div className="text-xs text-gray-500">
                            Admin: {currencySymbol}
                            {(
                              platformFinancials.competitionFeeBreakdown
                                .adminCompetitionFees || 0
                            ).toFixed(2)}{" "}
                            ({platformFinancials.competitionFeeBreakdown.adminCompetitionFeeCount || 0})
                            {" | "}
                            GM: {currencySymbol}
                            {(
                              platformFinancials.competitionFeeBreakdown
                                .gmCompetitionFees || 0
                            ).toFixed(2)}{" "}
                            ({platformFinancials.competitionFeeBreakdown.gmCompetitionFeeCount || 0})
                          </div>
                        )}
                      </div>
                      <span className="text-green-400 font-semibold">
                        +{currencySymbol}
                        {(platformFinancials?.totalPlatformFees || 0).toFixed(
                          2,
                        )}
                      </span>
                    </div>
                    {/* Challenge Fees */}
                    <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                      <span className="text-gray-300">Challenge Fees</span>
                      <span className="text-green-400 font-semibold">
                        +{currencySymbol}
                        {(platformFinancials?.totalChallengeFees || 0).toFixed(
                          2,
                        )}
                      </span>
                    </div>
                    {/* Withdrawal Fees */}
                    <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                      <span className="text-gray-300">
                        Withdrawal Fees Collected
                      </span>
                      <span className="text-green-400 font-semibold">
                        +{currencySymbol}
                        {(
                          platformFinancials?.totalWithdrawalFeesGross || 0
                        ).toFixed(2)}
                      </span>
                    </div>
                    {/* Marketplace */}
                    {(platformFinancials?.totalMarketplaceSales || 0) > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                        <span className="text-gray-300">Marketplace Sales</span>
                        <span className="text-green-400 font-semibold">
                          +{currencySymbol}
                          {(
                            platformFinancials?.totalMarketplaceSales || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {/* Unclaimed Pools */}
                    {(platformFinancials?.totalUnclaimedPools || 0) > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                        <span className="text-gray-300">Unclaimed Pools</span>
                        <span className="text-green-400 font-semibold">
                          +{currencySymbol}
                          {(
                            platformFinancials?.totalUnclaimedPools || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {/* Retained GM Fees */}
                    {(platformFinancials?.totalRetainedGmFees || 0) > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                        <span className="text-gray-300">Retained GM Fees</span>
                        <span className="text-green-400 font-semibold">
                          +{currencySymbol}
                          {(
                            platformFinancials?.totalRetainedGmFees || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {/* VAT Collected */}
                    {vatEnabled &&
                      (platformFinancials?.totalVATCollected || 0) > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                          <span className="text-gray-300">VAT Collected</span>
                          <span className="text-green-400 font-semibold">
                            +{currencySymbol}
                            {(
                              platformFinancials?.totalVATCollected || 0
                            ).toFixed(2)}
                          </span>
                        </div>
                      )}
                    {/* Admin Balance Added */}
                    {(platformFinancials?.totalAdminBalanceAdded || 0) > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-green-500/10 bg-teal-500/10 -mx-2 px-2 rounded">
                        <span className="text-teal-300">
                          💵 Admin Balance Injected
                        </span>
                        <span className="text-teal-400 font-semibold">
                          +{currencySymbol}
                          {(
                            platformFinancials?.totalAdminBalanceAdded || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {/* TOTAL IN */}
                    <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-green-500/30">
                      <span className="text-white font-bold">TOTAL IN</span>
                      <span className="text-green-400 font-bold text-xl">
                        +{currencySymbol}
                        {(
                          (platformFinancials?.totalUserDeposits || 0) +
                          (platformFinancials?.totalDepositFeesGross || 0) +
                          (platformFinancials?.totalAdminBalanceAdded || 0) +
                          (vatEnabled
                            ? platformFinancials?.totalVATCollected || 0
                            : 0)
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* MONEY OUT Column */}
                <div className="bg-red-950/20 border border-red-500/20 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
                    <TrendingDown className="h-5 w-5" />
                    💸 MONEY OUT
                  </h3>
                  <div className="space-y-3">
                    {/* User Withdrawals */}
                    <div className="flex justify-between items-center py-2 border-b border-red-500/10">
                      <span className="text-gray-300">User Withdrawals</span>
                      <span className="text-red-400 font-semibold">
                        -{currencySymbol}
                        {(
                          platformFinancials?.totalUserWithdrawals || 0
                        ).toFixed(2)}
                      </span>
                    </div>
                    {/* Bank/Stripe Fees */}
                    <div className="flex justify-between items-center py-2 border-b border-red-500/10">
                      <span className="text-gray-300">Stripe/Bank Fees</span>
                      <span className="text-red-400 font-semibold">
                        -{currencySymbol}
                        {(platformFinancials?.totalBankFees || 0).toFixed(2)}
                      </span>
                    </div>
                    {/* Admin Withdrawals */}
                    {(platformFinancials?.totalAdminWithdrawalsEUR || 0) >
                      0 && (
                      <div className="flex justify-between items-center py-2 border-b border-red-500/10">
                        <span className="text-gray-300">Admin Withdrawals</span>
                        <span className="text-red-400 font-semibold">
                          -{currencySymbol}
                          {(
                            platformFinancials?.totalAdminWithdrawalsEUR || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {/* Vendor Payments */}
                    {(platformFinancials?.totalVendorPayments || 0) > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-red-500/10">
                        <span className="text-gray-300">
                          🏢 Vendor Payments
                        </span>
                        <span className="text-purple-400 font-semibold">
                          -{currencySymbol}
                          {(
                            platformFinancials?.totalVendorPayments || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {/* Custom Expenses */}
                    {(platformFinancials?.totalCustomExpenses || 0) > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-red-500/10">
                        <span className="text-gray-300">
                          📝 Custom Expenses
                        </span>
                        <span className="text-rose-400 font-semibold">
                          -{currencySymbol}
                          {(
                            platformFinancials?.totalCustomExpenses || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {/* VAT Paid */}
                    {vatEnabled &&
                      (platformFinancials?.totalVATPaid || 0) > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-red-500/10">
                          <span className="text-gray-300">VAT Paid to Gov</span>
                          <span className="text-red-400 font-semibold">
                            -{currencySymbol}
                            {(platformFinancials?.totalVATPaid || 0).toFixed(2)}
                          </span>
                        </div>
                      )}
                    {/* Incident Compensations */}
                    {(platformFinancials?.totalIncidentCompensationsEUR || 0) >
                      0 && (
                      <div className="flex justify-between items-center py-2 border-b border-red-500/10">
                        <span className="text-gray-300">
                          Incident Compensations
                        </span>
                        <span className="text-red-400 font-semibold">
                          -{currencySymbol}
                          {(
                            platformFinancials?.totalIncidentCompensationsEUR ||
                            0
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {/* TOTAL OUT */}
                    <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-red-500/30">
                      <span className="text-white font-bold">TOTAL OUT</span>
                      <span className="text-red-400 font-bold text-xl">
                        -{currencySymbol}
                        {(
                          (platformFinancials?.totalUserWithdrawals || 0) +
                          (platformFinancials?.totalBankFees || 0) +
                          (platformFinancials?.totalAdminWithdrawalsEUR || 0) +
                          (platformFinancials?.totalVendorPayments || 0) +
                          (platformFinancials?.totalCustomExpenses || 0) +
                          (vatEnabled
                            ? platformFinancials?.totalVATPaid || 0
                            : 0) +
                          (platformFinancials?.totalIncidentCompensationsEUR ||
                            0)
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* GM Fees Info (internal credit movement, not bank outflow) */}
              {(platformFinancials?.totalGameMasterFees || 0) > 0 && (
                <div className="mt-4 p-3 bg-amber-950/20 border border-amber-500/20 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-amber-300 text-sm font-medium">
                        👑 Game Master Referral Fees (internal credits)
                      </span>
                      <p className="text-xs text-gray-500">
                        Paid to GMs from prize pools — not a bank outflow, increases user liabilities
                      </p>
                      <p className="text-xs text-gray-500">
                        Comp: {currencySymbol}
                        {(platformFinancials?.gmFeesFromCompetitions || 0).toFixed(2)}{" "}
                        | Chall: {currencySymbol}
                        {(platformFinancials?.gmFeesFromChallenges || 0).toFixed(2)}
                      </p>
                    </div>
                    <span className="text-amber-400 font-semibold">
                      {currencySymbol}
                      {(platformFinancials?.totalGameMasterFees || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Bottom Summary Bar */}
              <div className="mt-4 p-4 bg-gradient-to-r from-cyan-900/30 to-emerald-900/30 border border-cyan-500/30 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-400">
                      Theoretical Bank Balance
                    </p>
                    <p className="text-2xl font-bold text-green-400">
                      {currencySymbol}
                      {(liabilityMetrics?.theoreticalBankBalance || 0).toFixed(
                        2,
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      Total IN − Total OUT
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">
                      Must Reserve for Users
                    </p>
                    <p className="text-2xl font-bold text-red-400">
                      -{currencySymbol}
                      {(
                        (liabilityMetrics?.totalUserCreditsEUR || 0) +
                        (vatEnabled ? platformFinancials?.outstandingVAT || 0 : 0)
                      ).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      User balances{vatEnabled && (platformFinancials?.outstandingVAT || 0) > 0 ? " + outstanding VAT" : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">
                      Safe to Spend / Withdraw
                    </p>
                    <p className="text-2xl font-bold text-cyan-400">
                      {currencySymbol}
                      {Math.max(
                        0,
                        (liabilityMetrics?.theoreticalBankBalance || 0) -
                          (liabilityMetrics?.totalUserCreditsEUR || 0) -
                          (vatEnabled ? platformFinancials?.outstandingVAT || 0 : 0),
                      ).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      After all obligations
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Items Alert (if any) */}
          {(pendingWithdrawals.length > 0 ||
            (vatEnabled && (platformFinancials?.outstandingVAT || 0) > 0)) && (
            <Card className="bg-yellow-950/20 border border-yellow-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-yellow-400 text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Pending Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingWithdrawals.length > 0 && (
                    <div className="flex justify-between items-center p-3 bg-yellow-900/20 rounded-lg">
                      <div>
                        <span className="text-yellow-300 font-medium">
                          {pendingWithdrawals.length} Pending Withdrawal(s)
                        </span>
                        <p className="text-xs text-gray-400">
                          Net to users: {currencySymbol}
                          {pendingWithdrawals
                            .reduce((sum, w) => sum + (w.netAmountEUR || 0), 0)
                            .toFixed(2)}
                        </p>
                      </div>
                      <span className="text-yellow-400 font-semibold">
                        {currencySymbol}
                        {(liabilityMetrics?.pendingWithdrawalsEUR || 0).toFixed(
                          2,
                        )}
                      </span>
                    </div>
                  )}
                  {vatEnabled &&
                    (platformFinancials?.outstandingVAT || 0) > 0 && (
                      <div className="flex justify-between items-center p-3 bg-orange-900/20 rounded-lg">
                        <span className="text-orange-300 font-medium">
                          Outstanding VAT
                        </span>
                        <span className="text-orange-400 font-semibold">
                          {currencySymbol}
                          {(platformFinancials?.outstandingVAT || 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Transactions (Compact) */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <History className="h-5 w-5 text-cyan-400" />
                    Recent Transactions
                  </CardTitle>
                  <CardDescription>Last 10 transactions</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("transactions")}
                  className="text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10"
                >
                  View All →
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {recentTransactions.slice(0, 10).map((tx) => (
                  <div
                    key={tx._id}
                    className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        className={`${getTransactionTypeColor(tx.transactionType)} text-white text-xs`}
                      >
                        {getTransactionTypeLabel(tx.transactionType)}
                      </Badge>
                      <span className="text-sm text-gray-300 truncate max-w-[200px]">
                        {tx.userName || tx.userId.substring(0, 8)}
                      </span>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-semibold text-sm ${tx.amount >= 0 ? "text-green-400" : "text-red-400"}`}
                      >
                        {tx.amount >= 0 ? "+" : ""}
                        {tx.amount.toLocaleString()} {creditSymbol}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LIABILITIES TAB - Bank Related Data Only */}
        <TabsContent value="liabilities" className="space-y-6">
          {/* Top Summary - 3 Key Numbers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-green-900/40 to-gray-900 border border-green-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">💰 Bank Balance</p>
                    <p className="text-3xl font-bold text-green-400">
                      {currencySymbol}
                      {(liabilityMetrics?.theoreticalBankBalance || 0).toFixed(
                        2,
                      )}
                    </p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-green-500/30" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-900/40 to-gray-900 border border-red-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">⚠️ User Liabilities</p>
                    <p className="text-3xl font-bold text-red-400">
                      {currencySymbol}
                      {(liabilityMetrics?.totalUserCreditsEUR || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {liabilityMetrics?.totalUserCredits?.toLocaleString() ||
                        0}{" "}
                      {creditName}
                    </p>
                  </div>
                  <ShieldAlert className="h-10 w-10 text-red-500/30" />
                </div>
              </CardContent>
            </Card>

            {(() => {
              const availableToSpend = Math.max(
                0,
                (liabilityMetrics?.theoreticalBankBalance || 0) -
                  (liabilityMetrics?.totalUserCreditsEUR || 0) -
                  (vatEnabled ? platformFinancials?.outstandingVAT || 0 : 0),
              );
              const isPositive = availableToSpend > 0;
              return (
                <Card
                  className={`bg-gradient-to-br ${
                    isPositive
                      ? "from-cyan-900/40 to-gray-900 border-cyan-500/30"
                      : "from-orange-900/40 to-gray-900 border-orange-500/30"
                  } border`}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">
                          💰 Available to Spend
                        </p>
                        <p
                          className={`text-3xl font-bold ${
                            isPositive ? "text-cyan-400" : "text-orange-400"
                          }`}
                        >
                          {currencySymbol}
                          {availableToSpend.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Bank − user credits{vatEnabled && (platformFinancials?.outstandingVAT || 0) > 0 ? " − VAT" : ""}
                        </p>
                      </div>
                      <Wallet className="h-10 w-10 text-cyan-500/30" />
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          {/* Two-Column: EUR IN vs EUR OUT */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-blue-400" />
                Bank Money Flow
              </CardTitle>
              <CardDescription>
                Real money in and out of bank account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* EUR IN Column */}
                <div className="bg-green-950/20 border border-green-500/20 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    💰 MONEY IN
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                      <span className="text-gray-300">
                        User Deposits (Base)
                      </span>
                      <span className="text-green-400 font-semibold">
                        +{currencySymbol}
                        {(platformFinancials?.totalUserDeposits || 0).toFixed(
                          2,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                      <span className="text-gray-300">
                        Deposit Fees Charged
                      </span>
                      <span className="text-green-400 font-semibold">
                        +{currencySymbol}
                        {(
                          platformFinancials?.totalDepositFeesGross || 0
                        ).toFixed(2)}
                      </span>
                    </div>
                    {vatEnabled &&
                      (platformFinancials?.totalVATCollected || 0) > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                          <span className="text-gray-300">VAT Collected</span>
                          <span className="text-green-400 font-semibold">
                            +{currencySymbol}
                            {(
                              platformFinancials?.totalVATCollected || 0
                            ).toFixed(2)}
                          </span>
                        </div>
                      )}
                    {(platformFinancials?.totalAdminBalanceAdded || 0) > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-green-500/10 bg-teal-500/10 -mx-2 px-2 rounded">
                        <span className="text-teal-300">💵 Admin Injected</span>
                        <span className="text-teal-400 font-semibold">
                          +{currencySymbol}
                          {(
                            platformFinancials?.totalAdminBalanceAdded || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {/* Total */}
                    <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-green-500/30">
                      <span className="text-white font-bold">TOTAL IN</span>
                      <span className="text-green-400 font-bold text-xl">
                        +{currencySymbol}
                        {(
                          (platformFinancials?.totalUserDeposits || 0) +
                          (platformFinancials?.totalDepositFeesGross || 0) +
                          (platformFinancials?.totalAdminBalanceAdded || 0) +
                          (vatEnabled
                            ? platformFinancials?.totalVATCollected || 0
                            : 0)
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* EUR OUT Column */}
                <div className="bg-red-950/20 border border-red-500/20 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
                    <TrendingDown className="h-5 w-5" />
                    💸 MONEY OUT
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-red-500/10">
                      <span className="text-gray-300">User Withdrawals</span>
                      <span className="text-red-400 font-semibold">
                        -{currencySymbol}
                        {(
                          platformFinancials?.totalUserWithdrawals || 0
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-red-500/10">
                      <span className="text-gray-300">Stripe/Bank Fees</span>
                      <span className="text-orange-400 font-semibold">
                        -{currencySymbol}
                        {(platformFinancials?.totalBankFees || 0).toFixed(2)}
                      </span>
                    </div>
                    {(platformFinancials?.totalAdminWithdrawalsEUR || 0) >
                      0 && (
                      <div className="flex justify-between items-center py-2 border-b border-red-500/10">
                        <span className="text-gray-300">Admin Withdrawals</span>
                        <span className="text-red-400 font-semibold">
                          -{currencySymbol}
                          {(
                            platformFinancials?.totalAdminWithdrawalsEUR || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {vatEnabled &&
                      (platformFinancials?.totalVATPaid || 0) > 0 && (
                        <div className="flex justify-between items-center py-2 border-b border-red-500/10">
                          <span className="text-gray-300">VAT Paid to Gov</span>
                          <span className="text-red-400 font-semibold">
                            -{currencySymbol}
                            {(platformFinancials?.totalVATPaid || 0).toFixed(2)}
                          </span>
                        </div>
                      )}
                    {(platformFinancials?.totalVendorPayments || 0) > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-red-500/10">
                        <span className="text-gray-300">
                          🏢 Vendor Payments
                        </span>
                        <span className="text-purple-400 font-semibold">
                          -{currencySymbol}
                          {(
                            platformFinancials?.totalVendorPayments || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {(platformFinancials?.totalCustomExpenses || 0) > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-red-500/10">
                        <span className="text-gray-300">
                          📝 Custom Expenses
                        </span>
                        <span className="text-rose-400 font-semibold">
                          -{currencySymbol}
                          {(
                            platformFinancials?.totalCustomExpenses || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {/* Total */}
                    <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-red-500/30">
                      <span className="text-white font-bold">TOTAL OUT</span>
                      <span className="text-red-400 font-bold text-xl">
                        -{currencySymbol}
                        {(
                          (platformFinancials?.totalUserWithdrawals || 0) +
                          (platformFinancials?.totalBankFees || 0) +
                          (platformFinancials?.totalAdminWithdrawalsEUR || 0) +
                          (platformFinancials?.totalVendorPayments || 0) +
                          (platformFinancials?.totalCustomExpenses || 0) +
                          (vatEnabled
                            ? platformFinancials?.totalVATPaid || 0
                            : 0)
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Summary */}
              <div className="mt-6 p-4 bg-gradient-to-r from-cyan-900/30 to-emerald-900/30 border border-cyan-500/30 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-400">Bank Balance</p>
                    <p className="text-2xl font-bold text-green-400">
                      {currencySymbol}
                      {(liabilityMetrics?.theoreticalBankBalance || 0).toFixed(
                        2,
                      )}
                    </p>
                    <p className="text-xs text-gray-500">IN - OUT</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">User Liabilities</p>
                    <p className="text-2xl font-bold text-red-400">
                      -{currencySymbol}
                      {(liabilityMetrics?.totalUserCreditsEUR || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Must reserve for users
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Available to Spend</p>
                    <p className="text-2xl font-bold text-cyan-400">
                      {currencySymbol}
                      {Math.max(
                        0,
                        (liabilityMetrics?.theoreticalBankBalance || 0) -
                          (liabilityMetrics?.totalUserCreditsEUR || 0) -
                          (vatEnabled ? platformFinancials?.outstandingVAT || 0 : 0),
                      ).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      After user credits{vatEnabled && (platformFinancials?.outstandingVAT || 0) > 0 ? " + VAT" : ""}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Items */}
          {(pendingWithdrawals.length > 0 ||
            (vatEnabled && (platformFinancials?.outstandingVAT || 0) > 0)) && (
            <Card className="bg-yellow-950/20 border border-yellow-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-yellow-400 text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Pending Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingWithdrawals.length > 0 && (
                    <div className="flex justify-between items-center p-3 bg-yellow-900/20 rounded-lg">
                      <div>
                        <span className="text-yellow-300 font-medium">
                          {pendingWithdrawals.length} Pending Withdrawal(s)
                        </span>
                        <p className="text-xs text-gray-400">
                          Net to users: {currencySymbol}
                          {pendingWithdrawals
                            .reduce((sum, w) => sum + (w.netAmountEUR || 0), 0)
                            .toFixed(2)}
                        </p>
                      </div>
                      <span className="text-yellow-400 font-semibold">
                        {currencySymbol}
                        {(liabilityMetrics?.pendingWithdrawalsEUR || 0).toFixed(
                          2,
                        )}
                      </span>
                    </div>
                  )}
                  {vatEnabled &&
                    (platformFinancials?.outstandingVAT || 0) > 0 && (
                      <div className="flex justify-between items-center p-3 bg-orange-900/20 rounded-lg">
                        <span className="text-orange-300 font-medium">
                          Outstanding VAT
                        </span>
                        <span className="text-orange-400 font-semibold">
                          {currencySymbol}
                          {(platformFinancials?.outstandingVAT || 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pending Withdrawals Table */}
          {pendingWithdrawals.length > 0 && (
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Download className="h-5 w-5 text-orange-400" />
                  Pending Withdrawals
                </CardTitle>
                <CardDescription>
                  Gross: {currencySymbol}
                  {(liabilityMetrics?.pendingWithdrawalsEUR || 0).toFixed(2)} |
                  Net: {currencySymbol}
                  {pendingWithdrawals
                    .reduce((sum, w) => sum + (w.netAmountEUR || 0), 0)
                    .toFixed(2)}{" "}
                  | Fees: {currencySymbol}
                  {pendingWithdrawals
                    .reduce((sum, w) => sum + (w.platformFee || 0), 0)
                    .toFixed(2)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {pendingWithdrawals.map((withdrawal) => (
                    <div
                      key={withdrawal._id}
                      className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-white font-medium text-sm">
                            {withdrawal.userName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {withdrawal.userEmail}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-white font-semibold">
                            {currencySymbol}
                            {(withdrawal.amountEUR || 0).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Net: {currencySymbol}
                            {(withdrawal.netAmountEUR || 0).toFixed(2)}
                          </p>
                        </div>
                        <Badge
                          className={`${getStatusColor(withdrawal.status)} text-white text-xs`}
                        >
                          {withdrawal.status}
                        </Badge>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-xs"
                        >
                          Process
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* EARNINGS TAB */}
        <TabsContent value="earnings" className="space-y-6">
          {/* Top Summary - 3 Key Numbers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-emerald-900/40 to-gray-900 border border-emerald-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">
                      💰 Gross Platform Fees
                    </p>
                    <p className="text-3xl font-bold text-emerald-400">
                      {currencySymbol}
                      {(platformFinancials?.totalGrossEarnings || 0).toFixed(2)}
                    </p>
                  </div>
                  <PiggyBank className="h-10 w-10 text-emerald-500/30" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-900/40 to-gray-900 border border-red-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">
                      🏦 Bank/Provider Fees
                    </p>
                    <p className="text-3xl font-bold text-red-400">
                      -{currencySymbol}
                      {(platformFinancials?.totalBankFees || 0).toFixed(2)}
                    </p>
                  </div>
                  <Building2 className="h-10 w-10 text-red-500/30" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-900/40 to-gray-900 border border-green-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">
                      ✅ Net Platform Earnings
                    </p>
                    <p className="text-3xl font-bold text-green-400">
                      {currencySymbol}
                      {(
                        (platformFinancials?.totalNetEarningsEUR || 0) -
                        (platformFinancials?.totalGameMasterFees || 0)
                      ).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      After bank fees &amp; GM fees
                    </p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-green-500/30" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Two-Column: Earnings vs Costs */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-blue-400" />
                Earnings Breakdown
              </CardTitle>
              <CardDescription>
                What we earn vs what providers take
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* EARNINGS Column */}
                <div className="bg-green-950/20 border border-green-500/20 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    💰 WE EARN
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                      <div>
                        <span className="text-gray-300">Deposit Fees</span>
                        <p className="text-xs text-gray-500">
                          Charged to users on deposits
                        </p>
                      </div>
                      <span className="text-green-400 font-semibold">
                        +{currencySymbol}
                        {(
                          platformFinancials?.totalDepositFeesGross || 0
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                      <div>
                        <span className="text-gray-300">Withdrawal Fees</span>
                        <p className="text-xs text-gray-500">
                          Charged on user withdrawals
                        </p>
                      </div>
                      <span className="text-green-400 font-semibold">
                        +{currencySymbol}
                        {(
                          platformFinancials?.totalWithdrawalFeesGross || 0
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                      <div>
                        <span className="text-gray-300">Competition Fees</span>
                        <p className="text-xs text-gray-500">
                          % of prize pools
                        </p>
                        {/* Reason: Show admin vs GM breakdown for detailed revenue attribution */}
                        {platformFinancials?.competitionFeeBreakdown && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            🛡️ Admin: {currencySymbol}
                            {(
                              platformFinancials.competitionFeeBreakdown
                                .adminCompetitionFees || 0
                            ).toFixed(2)}{" "}
                            ({platformFinancials.competitionFeeBreakdown.adminCompetitionFeeCount || 0} comps)
                            {" · "}
                            👑 GM: {currencySymbol}
                            {(
                              platformFinancials.competitionFeeBreakdown
                                .gmCompetitionFees || 0
                            ).toFixed(2)}{" "}
                            ({platformFinancials.competitionFeeBreakdown.gmCompetitionFeeCount || 0} comps)
                          </p>
                        )}
                      </div>
                      <span className="text-emerald-400 font-semibold">
                        +{currencySymbol}
                        {(platformFinancials?.totalPlatformFees || 0).toFixed(
                          2,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                      <div>
                        <span className="text-gray-300">Challenge Fees</span>
                        <p className="text-xs text-gray-500">
                          1v1 platform fees
                        </p>
                      </div>
                      <span className="text-orange-400 font-semibold">
                        +{currencySymbol}
                        {(platformFinancials?.totalChallengeFees || 0).toFixed(
                          2,
                        )}
                      </span>
                    </div>
                    {(platformFinancials?.totalMarketplaceSales || 0) > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                        <div>
                          <span className="text-gray-300">
                            Marketplace Sales
                          </span>
                          <p className="text-xs text-gray-500">
                            {platformFinancials?.marketplacePurchases || 0}{" "}
                            items
                          </p>
                        </div>
                        <span className="text-purple-400 font-semibold">
                          +{currencySymbol}
                          {(
                            platformFinancials?.totalMarketplaceSales || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {(platformFinancials?.totalUnclaimedPools || 0) > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-green-500/10">
                        <div>
                          <span className="text-gray-300">Unclaimed Pools</span>
                          <p className="text-xs text-gray-500">
                            All disqualified comps
                          </p>
                        </div>
                        <span className="text-amber-400 font-semibold">
                          +{currencySymbol}
                          {(
                            (platformFinancials?.totalUnclaimedPools || 0) /
                            conversionRate
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {/* Total */}
                    <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-green-500/30">
                      <span className="text-white font-bold">
                        GROSS EARNINGS
                      </span>
                      <span className="text-green-400 font-bold text-xl">
                        +{currencySymbol}
                        {(platformFinancials?.totalGrossEarnings || 0).toFixed(
                          2,
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* COSTS Column */}
                <div className="bg-red-950/20 border border-red-500/20 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
                    <TrendingDown className="h-5 w-5" />
                    💸 PROVIDER COSTS
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-red-500/10">
                      <div>
                        <span className="text-gray-300">
                          Stripe Deposit Fees
                        </span>
                        <p className="text-xs text-gray-500">
                          Payment processing
                        </p>
                      </div>
                      <span className="text-red-400 font-semibold">
                        -{currencySymbol}
                        {(
                          platformFinancials?.totalBankDepositFees || 0
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-red-500/10">
                      <div>
                        <span className="text-gray-300">
                          Bank Withdrawal Fees
                        </span>
                        <p className="text-xs text-gray-500">
                          Payout/transfer costs
                        </p>
                      </div>
                      <span className="text-red-400 font-semibold">
                        -{currencySymbol}
                        {(
                          platformFinancials?.totalBankWithdrawalFees || 0
                        ).toFixed(2)}
                      </span>
                    </div>
                    {(platformFinancials?.totalGameMasterFees || 0) > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-red-500/10">
                        <div>
                          <span className="text-gray-300">
                            Game Master Fees
                          </span>
                          <p className="text-xs text-gray-500">
                            Comp: {currencySymbol}
                            {(
                              platformFinancials?.gmFeesFromCompetitions || 0
                            ).toFixed(2)}{" "}
                            | Chall: {currencySymbol}
                            {(
                              platformFinancials?.gmFeesFromChallenges || 0
                            ).toFixed(2)}
                          </p>
                        </div>
                        <span className="text-amber-400 font-semibold">
                          -{currencySymbol}
                          {(
                            platformFinancials?.totalGameMasterFees || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {/* Total */}
                    <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-red-500/30">
                      <span className="text-white font-bold">TOTAL COSTS</span>
                      <span className="text-red-400 font-bold text-xl">
                        -{currencySymbol}
                        {(
                          (platformFinancials?.totalBankFees || 0) +
                          (platformFinancials?.totalGameMasterFees || 0)
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Earnings Result */}
              <div className="mt-6 p-4 bg-gradient-to-r from-emerald-900/30 to-gray-900 border border-emerald-500/30 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-lg text-white font-semibold">
                      = Net Platform Earnings
                    </p>
                    <p className="text-xs text-gray-400">
                      Gross Earnings − Bank Fees − GM Fees
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-emerald-400">
                    {currencySymbol}
                    {(
                      (platformFinancials?.totalNetEarningsEUR || 0) -
                      (platformFinancials?.totalGameMasterFees || 0)
                    ).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Available to Withdraw Section */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Banknote className="h-5 w-5 text-cyan-400" />
                Available to Withdraw
              </CardTitle>
              <CardDescription>
                After reserving funds for user liabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Calculation */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-300">Platform Net Earnings</span>
                    <span className="text-green-400 font-semibold">
                      +{currencySymbol}
                      {(platformFinancials?.totalNetEarningsEUR || 0).toFixed(
                        2,
                      )}
                    </span>
                  </div>
                  {(platformFinancials?.totalAdminBalanceAdded || 0) > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-700">
                      <span className="text-gray-300">
                        💵 Admin Balance Injected
                      </span>
                      <span className="text-teal-400 font-semibold">
                        +{currencySymbol}
                        {(
                          platformFinancials?.totalAdminBalanceAdded || 0
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-300">Admin Withdrawals</span>
                    <span className="text-red-400 font-semibold">
                      -{currencySymbol}
                      {(
                        platformFinancials?.totalAdminWithdrawalsEUR || 0
                      ).toFixed(2)}
                    </span>
                  </div>
                  {(platformFinancials?.totalVendorPayments || 0) > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-700">
                      <span className="text-gray-300">🏢 Vendor Payments</span>
                      <span className="text-purple-400 font-semibold">
                        -{currencySymbol}
                        {(platformFinancials?.totalVendorPayments || 0).toFixed(
                          2,
                        )}
                      </span>
                    </div>
                  )}
                  {(platformFinancials?.totalCustomExpenses || 0) > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-700">
                      <span className="text-gray-300">📝 Custom Expenses</span>
                      <span className="text-rose-400 font-semibold">
                        -{currencySymbol}
                        {(platformFinancials?.totalCustomExpenses || 0).toFixed(
                          2,
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2 border-b border-gray-700">
                    <span className="text-gray-300">User Credit Balances</span>
                    <span className="text-orange-400 font-semibold">
                      -{currencySymbol}
                      {(liabilityMetrics?.totalUserCreditsEUR || 0).toFixed(2)}
                    </span>
                  </div>
                  {vatEnabled && (platformFinancials?.outstandingVAT || 0) > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-700">
                      <span className="text-gray-300">Outstanding VAT</span>
                      <span className="text-orange-400 font-semibold">
                        -{currencySymbol}
                        {(platformFinancials?.outstandingVAT || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t-2 border-cyan-500/30">
                    <span className="text-white font-bold text-lg">
                      💰 Can Withdraw
                    </span>
                    <span className="text-cyan-400 font-bold text-2xl">
                      {currencySymbol}
                      {Math.max(
                        0,
                        (liabilityMetrics?.theoreticalBankBalance || 0) -
                          (liabilityMetrics?.totalUserCreditsEUR || 0) -
                          (vatEnabled ? platformFinancials?.outstandingVAT || 0 : 0),
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Right: Summary + Button */}
                <div className="flex flex-col justify-between">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-400">Bank Balance</p>
                      <p className="text-xl font-bold text-green-400">
                        {currencySymbol}
                        {(
                          liabilityMetrics?.theoreticalBankBalance || 0
                        ).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-400">User Liabilities</p>
                      <p className="text-xl font-bold text-red-400">
                        -{currencySymbol}
                        {(liabilityMetrics?.totalUserCreditsEUR || 0).toFixed(
                          2,
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowWithdrawDialog(true)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-lg"
                    disabled={
                      Math.max(
                        0,
                        (liabilityMetrics?.theoreticalBankBalance || 0) -
                          (liabilityMetrics?.totalUserCreditsEUR || 0) -
                          (vatEnabled ? platformFinancials?.outstandingVAT || 0 : 0),
                      ) <= 0
                    }
                  >
                    <Banknote className="h-5 w-5 mr-2" />
                    Withdraw to Bank
                  </Button>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Maximum safe withdrawal after reserving user funds
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Unclaimed Pools Detail (Collapsible Info) */}
          {platformFinancials?.unclaimedPools &&
            (platformFinancials?.totalUnclaimedPools || 0) > 0 && (
              <Card className="bg-gray-900 border-amber-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-amber-400 text-lg flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Unclaimed Pools Detail
                  </CardTitle>
                  <CardDescription>
                    Pools from competitions where all participants were
                    disqualified
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {Object.entries(
                      platformFinancials.unclaimedPools.byReason,
                    ).map(([reason, data]) => (
                      <div
                        key={reason}
                        className="bg-amber-900/20 border border-amber-500/20 rounded-lg p-3 text-center"
                      >
                        <p className="text-xs text-gray-400 uppercase">
                          {reason.replace(/_/g, " ")}
                        </p>
                        <p className="text-lg font-bold text-amber-400">
                          {creditSymbol} {data.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {data.count} comp(s)
                        </p>
                      </div>
                    ))}
                  </div>
                  {platformFinancials.unclaimedPools.recentPools.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-400">Recent:</p>
                      {platformFinancials.unclaimedPools.recentPools
                        .slice(0, 3)
                        .map((pool) => (
                          <div
                            key={pool._id}
                            className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg text-sm"
                          >
                            <span className="text-gray-300">
                              {pool.sourceName}
                            </span>
                            <span className="text-amber-400 font-semibold">
                              {creditSymbol} {pool.amount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
        </TabsContent>

        {/* VAT TAB */}
        {vatEnabled && (
          <TabsContent value="vat" className="space-y-6">
            {/* VAT Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="bg-gray-900 border-emerald-500/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    Total VAT Collected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-emerald-400">
                    {currencySymbol}
                    {(
                      vatData?.allTime.collected ||
                      platformFinancials?.totalVATCollected ||
                      0
                    ).toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">All time</p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-green-500/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-400" />
                    VAT Paid
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-400">
                    {currencySymbol}
                    {(
                      vatData?.allTime.paid ||
                      platformFinancials?.totalVATPaid ||
                      0
                    ).toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Submitted to government
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-orange-500/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-400" />
                    Outstanding VAT
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-400">
                    {currencySymbol}
                    {(
                      vatData?.allTime.outstanding ||
                      platformFinancials?.outstandingVAT ||
                      0
                    ).toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Owed to government
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-cyan-500/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <History className="h-4 w-4 text-cyan-400" />
                    Current Period
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-cyan-400">
                    {currencySymbol}
                    {(vatData?.currentPeriod.vatCollected || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {vatData?.currentPeriod.transactionCount || 0} transactions
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* VAT Payment Section */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white text-xl flex items-center gap-2">
                      <Banknote className="h-5 w-5 text-orange-400" />
                      Record VAT Payment
                    </CardTitle>
                    <CardDescription>
                      Mark VAT as paid and reset outstanding balance
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">
                      Period Start
                    </label>
                    <Input
                      type="date"
                      value={vatDateRange.start}
                      onChange={(e) =>
                        setVatDateRange((prev) => ({
                          ...prev,
                          start: e.target.value,
                        }))
                      }
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">
                      Period End
                    </label>
                    <Input
                      type="date"
                      value={vatDateRange.end}
                      onChange={(e) =>
                        setVatDateRange((prev) => ({
                          ...prev,
                          end: e.target.value,
                        }))
                      }
                      className="bg-gray-800 border-gray-600 text-white"
                    />
                  </div>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">
                        Outstanding VAT to Pay
                      </p>
                      <p className="text-3xl font-bold text-orange-400">
                        {currencySymbol}
                        {(
                          vatData?.outstanding.total ||
                          platformFinancials?.outstandingVAT ||
                          0
                        ).toFixed(2)}
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowVatPayDialog(true)}
                      disabled={(vatData?.outstanding.total || 0) <= 0}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      <Banknote className="h-4 w-4 mr-2" />
                      Pay VAT
                    </Button>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={fetchVatData}
                  className="w-full bg-gray-800 border-gray-600 hover:bg-gray-700"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh VAT Data
                </Button>
              </CardContent>
            </Card>

            {/* VAT Payment History */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-xl flex items-center gap-2">
                  <History className="h-5 w-5 text-cyan-400" />
                  VAT Payment History
                </CardTitle>
                <CardDescription>
                  Record of all VAT payments submitted
                </CardDescription>
              </CardHeader>
              <CardContent>
                {vatData?.paymentHistory &&
                vatData.paymentHistory.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-700">
                        <TableHead className="text-gray-400">Period</TableHead>
                        <TableHead className="text-gray-400">Amount</TableHead>
                        <TableHead className="text-gray-400">Status</TableHead>
                        <TableHead className="text-gray-400">Paid By</TableHead>
                        <TableHead className="text-gray-400">
                          Reference
                        </TableHead>
                        <TableHead className="text-gray-400">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vatData.paymentHistory.map((payment) => (
                        <TableRow key={payment._id} className="border-gray-700">
                          <TableCell className="text-white">
                            {new Date(payment.periodStart).toLocaleDateString()}{" "}
                            - {new Date(payment.periodEnd).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-semibold text-green-400">
                            {currencySymbol}
                            {payment.vatAmountEUR.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                payment.status === "paid"
                                  ? "bg-green-500"
                                  : "bg-yellow-500"
                              }
                            >
                              {payment.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-400">
                            {payment.paidByEmail || "-"}
                          </TableCell>
                          <TableCell className="text-gray-400 font-mono text-xs">
                            {payment.reference || "-"}
                          </TableCell>
                          <TableCell className="text-gray-400">
                            {payment.paidAt
                              ? new Date(payment.paidAt).toLocaleDateString()
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No VAT payments recorded yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* VENDOR PAYMENTS TAB */}
        <TabsContent value="vendor-payments" className="space-y-6">
          {/* Vendor Payments Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-gray-900 border-purple-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Total Paid to Vendors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-400">
                  {currencySymbol}
                  {(vendorPaymentData?.summary?.totalPaid || 0).toFixed(2)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {vendorPaymentData?.summary?.paymentCount || 0} payments
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-orange-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Upcoming (30 days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-400">
                  {currencySymbol}
                  {(vendorPaymentData?.upcoming?.total || 0).toFixed(2)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {vendorPaymentData?.upcoming?.count || 0} vendors due
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-cyan-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Available to Pay
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-cyan-400">
                  {currencySymbol}
                  {Math.max(
                    0,
                    (liabilityMetrics?.theoreticalBankBalance || 0) -
                      (liabilityMetrics?.totalUserCreditsEUR || 0) -
                      (vatEnabled ? platformFinancials?.outstandingVAT || 0 : 0),
                  ).toFixed(2)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Bank − user credits{vatEnabled && (platformFinancials?.outstandingVAT || 0) > 0 ? " − VAT" : ""}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-green-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Platform Net Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">
                  {currencySymbol}
                  {(
                    (platformFinancials?.totalNetEarningsEUR || 0) -
                    (platformFinancials?.totalGameMasterFees || 0)
                  ).toFixed(2)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  After bank fees &amp; GM fees
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Vendor Payments Section */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-xl flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-orange-400" />
                    Upcoming Vendor Payments
                  </CardTitle>
                  <CardDescription>
                    Pay vendors from platform earnings - deducted from net
                    position
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchVendorPaymentData()}
                  className="border-gray-600"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {vendorPaymentData?.upcoming?.vendors &&
              vendorPaymentData.upcoming.vendors.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700">
                      <TableHead className="text-gray-400">Vendor</TableHead>
                      <TableHead className="text-gray-400">Type</TableHead>
                      <TableHead className="text-gray-400">Billing</TableHead>
                      <TableHead className="text-gray-400">Amount</TableHead>
                      <TableHead className="text-gray-400">Due Date</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                      <TableHead className="text-gray-400 text-right">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorPaymentData.upcoming.vendors.map((vendor) => {
                      const daysUntil = Math.ceil(
                        (new Date(vendor.nextPaymentDate).getTime() -
                          new Date().getTime()) /
                          (1000 * 60 * 60 * 24),
                      );
                      const isOverdue = daysUntil < 0;
                      const isDueSoon = daysUntil >= 0 && daysUntil <= 7;

                      return (
                        <TableRow key={vendor._id} className="border-gray-700">
                          <TableCell>
                            <div>
                              <p className="font-medium text-white">
                                {vendor.name}
                              </p>
                              {vendor.description && (
                                <p className="text-xs text-gray-500">
                                  {vendor.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="border-gray-600 text-gray-300"
                            >
                              {vendor.serviceType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {vendor.billingCycle}
                          </TableCell>
                          <TableCell className="text-white font-mono">
                            {vendor.currency === "EUR"
                              ? "€"
                              : vendor.currency === "USD"
                                ? "$"
                                : vendor.currency}
                            {vendor.amount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <p className="text-white">
                              {new Date(
                                vendor.nextPaymentDate,
                              ).toLocaleDateString()}
                            </p>
                            <p
                              className={`text-xs ${isOverdue ? "text-red-400" : isDueSoon ? "text-yellow-400" : "text-gray-500"}`}
                            >
                              {isOverdue
                                ? `${Math.abs(daysUntil)} days overdue`
                                : daysUntil === 0
                                  ? "Due today"
                                  : `${daysUntil} days`}
                            </p>
                          </TableCell>
                          <TableCell>
                            {isOverdue ? (
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                                Overdue
                              </Badge>
                            ) : isDueSoon ? (
                              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                Due Soon
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                                Scheduled
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => openVendorPayDialog(vendor)}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              Pay Now
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No upcoming vendor payments in the next 30 days</p>
                  <p className="text-sm mt-2">
                    Add vendors in Settings → Vendor Subscriptions
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vendor Payment History */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-xl flex items-center gap-2">
                <History className="h-5 w-5 text-cyan-400" />
                Vendor Payment History
              </CardTitle>
              <CardDescription>
                Record of all payments to vendors (deducted from platform
                earnings)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {vendorPaymentData?.payments &&
              vendorPaymentData.payments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700">
                      <TableHead className="text-gray-400">Date</TableHead>
                      <TableHead className="text-gray-400">Vendor</TableHead>
                      <TableHead className="text-gray-400">Type</TableHead>
                      <TableHead className="text-gray-400">Amount</TableHead>
                      <TableHead className="text-gray-400">Reference</TableHead>
                      <TableHead className="text-gray-400">Paid By</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorPaymentData.payments.map((payment) => (
                      <TableRow key={payment._id} className="border-gray-700">
                        <TableCell className="text-gray-300">
                          {payment.paidAt
                            ? new Date(payment.paidAt).toLocaleDateString()
                            : new Date(payment.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-white font-medium">
                          {payment.vendorName}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-gray-600 text-gray-300"
                          >
                            {payment.serviceType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white font-mono">
                          {payment.currency === "EUR"
                            ? "€"
                            : payment.currency === "USD"
                              ? "$"
                              : payment.currency}
                          {payment.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-gray-400">
                          {payment.reference || payment.invoiceNumber || "-"}
                        </TableCell>
                        <TableCell className="text-gray-400">
                          {payment.paidByEmail || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`
                            ${payment.status === "paid" ? "bg-green-500/20 text-green-400 border-green-500/30" : ""}
                            ${payment.status === "pending" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : ""}
                            ${payment.status === "failed" ? "bg-red-500/20 text-red-400 border-red-500/30" : ""}
                            ${payment.status === "refunded" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : ""}
                          `}
                          >
                            {payment.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No vendor payments recorded yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Breakdown by Service Type */}
          {vendorPaymentData?.summary?.byServiceType &&
            vendorPaymentData.summary.byServiceType.length > 0 && (
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Target className="h-5 w-5 text-purple-400" />
                    Payments by Service Type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {vendorPaymentData.summary.byServiceType.map((item) => (
                      <div
                        key={item._id}
                        className="bg-gray-800 rounded-lg p-4"
                      >
                        <p className="text-sm text-gray-400 capitalize">
                          {item._id}
                        </p>
                        <p className="text-xl font-bold text-purple-400">
                          {currencySymbol}{item.total.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.count} payments
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
        </TabsContent>

        {/* ADMIN FUNDS TAB */}
        <TabsContent value="admin-funds" className="space-y-6">
          {/* Admin Funds Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-gray-900 border-teal-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Total Balance Added
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-teal-400">
                  {currencySymbol}
                  {(
                    adminFundsData?.summary?.totalBalanceAdded ||
                    platformFinancials?.totalAdminBalanceAdded ||
                    0
                  ).toFixed(2)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {adminFundsData?.summary?.balanceAddCount ||
                    platformFinancials?.adminBalanceAddCount ||
                    0}{" "}
                  additions
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-rose-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Total Custom Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-400">
                  {currencySymbol}
                  {(
                    adminFundsData?.summary?.totalExpenses ||
                    platformFinancials?.totalCustomExpenses ||
                    0
                  ).toFixed(2)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {adminFundsData?.summary?.expenseCount ||
                    platformFinancials?.customExpenseCount ||
                    0}{" "}
                  expenses
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-cyan-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Net Operating Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    (adminFundsData?.summary?.netOperatingBalance ||
                      platformFinancials?.netOperatingBalance ||
                      0) >= 0
                      ? "text-cyan-400"
                      : "text-orange-400"
                  }`}
                >
                  {currencySymbol}
                  {(
                    adminFundsData?.summary?.netOperatingBalance ||
                    platformFinancials?.netOperatingBalance ||
                    0
                  ).toFixed(2)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Balance Added - Expenses
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-green-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">
                  Platform Net Position
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">
                  {currencySymbol}
                  {Math.max(
                    0,
                    (liabilityMetrics?.theoreticalBankBalance || 0) -
                      (liabilityMetrics?.totalUserCreditsEUR || 0) -
                      (vatEnabled ? platformFinancials?.outstandingVAT || 0 : 0),
                  ).toFixed(2)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  After user liabilities{vatEnabled && (platformFinancials?.outstandingVAT || 0) > 0 ? " + VAT" : ""}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={() => setShowAddBalanceDialog(true)}
              className="bg-teal-600 hover:bg-teal-700"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Add Balance to Operating Funds
            </Button>
            <Button
              onClick={() => setShowAddExpenseDialog(true)}
              className="bg-rose-600 hover:bg-rose-700"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Record Custom Expense
            </Button>
          </div>

          {/* Expenses by Category */}
          {adminFundsData?.summary?.expensesByCategory &&
            adminFundsData.summary.expensesByCategory.length > 0 && (
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Target className="h-5 w-5 text-rose-400" />
                    Expenses by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {adminFundsData.summary.expensesByCategory.map((item) => (
                      <div
                        key={item._id}
                        className="bg-gray-800 rounded-lg p-4"
                      >
                        <p className="text-sm text-gray-400 capitalize">
                          {item._id || "Other"}
                        </p>
                        <p className="text-xl font-bold text-rose-400">
                          {currencySymbol}{item.total.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.count} expenses
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Recent Admin Fund Transactions */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-xl flex items-center gap-2">
                <History className="h-5 w-5 text-cyan-400" />
                Admin Fund History
              </CardTitle>
              <CardDescription>
                Balance additions and custom expenses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {adminFundsData?.transactions &&
              adminFundsData.transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700">
                      <TableHead className="text-gray-400">Date</TableHead>
                      <TableHead className="text-gray-400">Type</TableHead>
                      <TableHead className="text-gray-400">
                        Description
                      </TableHead>
                      <TableHead className="text-gray-400">Amount</TableHead>
                      <TableHead className="text-gray-400">Details</TableHead>
                      <TableHead className="text-gray-400">
                        Processed By
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adminFundsData.transactions.map((tx) => (
                      <TableRow key={tx._id} className="border-gray-700">
                        <TableCell className="text-gray-300">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              tx.transactionType === "admin_balance_add"
                                ? "bg-teal-500/20 text-teal-400 border-teal-500/30"
                                : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                            }
                          >
                            {tx.transactionType === "admin_balance_add"
                              ? "Balance Add"
                              : "Expense"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white max-w-[300px] truncate">
                          {tx.description}
                        </TableCell>
                        <TableCell
                          className={`font-mono ${tx.amountEUR >= 0 ? "text-teal-400" : "text-rose-400"}`}
                        >
                          {tx.amountEUR >= 0 ? "+" : ""}
                          {currencySymbol}
                          {Math.abs(tx.amountEUR).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-gray-400 text-sm">
                          {tx.balanceAddDetails?.source &&
                            `Source: ${tx.balanceAddDetails.source}`}
                          {tx.expenseDetails?.category &&
                            `Category: ${tx.expenseDetails.category}`}
                          {tx.expenseDetails?.vendor &&
                            ` | Vendor: ${tx.expenseDetails.vendor}`}
                        </TableCell>
                        <TableCell className="text-gray-400">
                          {tx.processedByEmail || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No admin fund transactions recorded yet</p>
                  <p className="text-sm mt-2">
                    Add balance or record expenses to get started
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* WALLETS TAB */}
        <TabsContent value="wallets" className="space-y-6">
          {/* ── Wallet Summary Cards ─────────────────────────── */}
          {(() => {
            const totalCredits = wallets.reduce((sum, w) => sum + (w.creditBalance || 0), 0);
            const totalCreditsEUR = conversionRate > 0 ? totalCredits / conversionRate : 0;
            // Reason: Use the same theoreticalBankBalance from liabilityMetrics as the overview tab
            // to ensure consistency across all financial dashboard views.
            const bankBalance = liabilityMetrics?.theoreticalBankBalance || 0;
            const outstandingVAT = vatEnabled ? (platformFinancials?.outstandingVAT || 0) : 0;
            const weOwe = totalCreditsEUR + outstandingVAT;
            const netPosition = bankBalance - weOwe;
            const isHealthy = netPosition >= 0;

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card 1: Total User Credits */}
                <Card className="bg-gradient-to-br from-violet-900/40 to-gray-900 border border-violet-500/30">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">💳 Total User Credits</p>
                        <p className="text-3xl font-bold text-violet-400">
                          {creditSymbol} {totalCredits.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-gray-500">
                          ≈ {currencySymbol}{totalCreditsEUR.toFixed(2)} @ {conversionRate}:1 rate
                        </p>
                      </div>
                      <Users className="h-10 w-10 text-violet-500/30" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 2: Money in Bank */}
                <Card className="bg-gradient-to-br from-green-900/40 to-gray-900 border border-green-500/30">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">🏦 Money in Bank</p>
                        <p className="text-3xl font-bold text-green-400">
                          {currencySymbol}{bankBalance.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Deposits − Withdrawals − Admin draws
                        </p>
                      </div>
                      <Building2 className="h-10 w-10 text-green-500/30" />
                    </div>
                  </CardContent>
                </Card>

                {/* Card 3: Net Position (Bank - What we owe) */}
                <Card className={`bg-gradient-to-br ${isHealthy ? "from-cyan-900/40 to-gray-900 border-cyan-500/30" : "from-red-900/40 to-gray-900 border-red-500/30"} border`}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-400">
                          {isHealthy ? "✅" : "⚠️"} We Owe / Net Position
                        </p>
                        <p className={`text-3xl font-bold ${isHealthy ? "text-cyan-400" : "text-red-400"}`}>
                          {netPosition >= 0 ? "+" : "-"}{currencySymbol}{Math.abs(netPosition).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Bank ({currencySymbol}{bankBalance.toFixed(2)}) − Owe ({currencySymbol}{weOwe.toFixed(2)}{outstandingVAT > 0 ? ` incl. VAT` : ""})
                        </p>
                      </div>
                      <PiggyBank className={`h-10 w-10 ${isHealthy ? "text-cyan-500/30" : "text-red-500/30"}`} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-xl flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-green-400" />
                    User Wallets ({wallets.length})
                  </CardTitle>
                  <CardDescription>
                    View all user credit balances and activity
                  </CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by name, email, ID..."
                    value={walletSearch}
                    onChange={(e) => setWalletSearch(e.target.value)}
                    className="pl-10 bg-gray-800 border-gray-700 text-white w-64"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700">
                      <TableHead className="text-gray-400">User</TableHead>
                      <TableHead className="text-gray-400">Balance</TableHead>
                      <TableHead className="text-gray-400">Deposited</TableHead>
                      <TableHead className="text-gray-400">Withdrawn</TableHead>
                      <TableHead className="text-gray-400 text-center">
                        <div>Won</div>
                        <div className="text-xs font-normal">
                          (Comp / Chall)
                        </div>
                      </TableHead>
                      <TableHead className="text-gray-400 text-center">
                        <div>Spent</div>
                        <div className="text-xs font-normal">
                          (Comp / Chall)
                        </div>
                      </TableHead>
                      <TableHead className="text-gray-400">
                        <div>Net</div>
                        <div className="text-xs font-normal">(Won - Spent)</div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWallets.slice(0, 50).map((wallet) => {
                      const totalWon =
                        (wallet.totalWonFromCompetitions || 0) +
                        (wallet.totalWonFromChallenges || 0);
                      const totalSpent =
                        (wallet.totalSpentOnCompetitions || 0) +
                        (wallet.totalSpentOnChallenges || 0) +
                        (wallet.totalSpentOnMarketplace || 0);
                      // Net from competitions/challenges/marketplace (Won - Spent)
                      const netPosition = totalWon - totalSpent;
                      return (
                        <TableRow
                          key={wallet.userId}
                          className="border-gray-700"
                        >
                          <TableCell>
                            <div>
                              <div className="font-medium text-white">
                                {wallet.userName}
                              </div>
                              <div className="text-xs text-gray-400">
                                {wallet.userEmail}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-white">
                            {creditSymbol}{" "}
                            {wallet.creditBalance.toLocaleString()}
                            <div className="text-xs text-gray-500">
                              {currencySymbol}
                              {creditsToEUR(wallet.creditBalance)}
                            </div>
                          </TableCell>
                          <TableCell className="text-green-400">
                            {creditSymbol}{" "}
                            {wallet.totalDeposited.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-blue-400">
                            {creditSymbol}{" "}
                            {wallet.totalWithdrawn.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-yellow-400 text-center">
                            <div className="font-semibold">
                              {creditSymbol} {totalWon.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              🏆{" "}
                              {(
                                wallet.totalWonFromCompetitions || 0
                              ).toLocaleString()}{" "}
                              / ⚔️{" "}
                              {(
                                wallet.totalWonFromChallenges || 0
                              ).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-red-400 text-center">
                            <div className="font-semibold">
                              {creditSymbol} {totalSpent.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              🏆{" "}
                              {(
                                wallet.totalSpentOnCompetitions || 0
                              ).toLocaleString()}{" "}
                              / ⚔️{" "}
                              {(
                                wallet.totalSpentOnChallenges || 0
                              ).toLocaleString()}{" "}
                              / 🛒{" "}
                              {(
                                wallet.totalSpentOnMarketplace || 0
                              ).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell
                            className={
                              netPosition >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }
                          >
                            {netPosition >= 0 ? "+" : ""}
                            {creditSymbol} {netPosition.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {filteredWallets.length > 50 && (
                <p className="text-sm text-gray-500 mt-4 text-center">
                  Showing 50 of {filteredWallets.length} wallets
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TRANSACTIONS TAB */}
        <TabsContent value="transactions" className="space-y-6">
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-xl flex items-center gap-2">
                    <History className="h-5 w-5 text-cyan-400" />
                    All Transactions
                  </CardTitle>
                  <CardDescription>
                    Complete transaction history with filters
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search..."
                      value={txFilters.search}
                      onChange={(e) =>
                        setTxFilters((f) => ({ ...f, search: e.target.value }))
                      }
                      className="pl-10 bg-gray-800 border-gray-700 text-white w-48"
                    />
                  </div>
                  <Select
                    value={txFilters.type}
                    onValueChange={(v) =>
                      setTxFilters((f) => ({ ...f, type: v }))
                    }
                  >
                    <SelectTrigger className="w-40 bg-gray-800 border-gray-700">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="deposit">User Deposits</SelectItem>
                      <SelectItem value="withdrawal">
                        User Withdrawals
                      </SelectItem>
                      <SelectItem value="competition_entry">
                        Competition Entry
                      </SelectItem>
                      <SelectItem value="competition_win">
                        Competition Win
                      </SelectItem>
                      <SelectItem value="competition_refund">
                        Refunds
                      </SelectItem>
                      <SelectItem value="platform_fee">
                        Competition Fees
                      </SelectItem>
                      <SelectItem value="challenge_entry">
                        Challenge Entry
                      </SelectItem>
                      <SelectItem value="challenge_win">
                        Challenge Win
                      </SelectItem>
                      <SelectItem value="challenge_platform_fee">
                        Challenge Fees
                      </SelectItem>
                      <SelectItem value="retained_gm_fee">
                        Retained GM Fees
                      </SelectItem>
                      <SelectItem value="gamemaster_earning">
                        GM Referrals (Comps)
                      </SelectItem>
                      <SelectItem value="gamemaster_challenge_referral">
                        GM Referrals (Challenges)
                      </SelectItem>
                      <SelectItem value="admin_withdrawal">
                        Admin Withdrawals
                      </SelectItem>
                      <SelectItem value="vat_payment">VAT Payments</SelectItem>
                      <SelectItem value="vendor_payment">
                        Vendor Payments
                      </SelectItem>
                      <SelectItem value="admin_balance_add">
                        Balance Additions
                      </SelectItem>
                      <SelectItem value="custom_expense">
                        Custom Expenses
                      </SelectItem>
                      <SelectItem value="unclaimed_pool">
                        Unclaimed Pools
                      </SelectItem>
                      <SelectItem value="deposit_fee">Deposit Fees</SelectItem>
                      <SelectItem value="withdrawal_fee">
                        Withdrawal Fees
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={txFilters.status}
                    onValueChange={(v) =>
                      setTxFilters((f) => ({ ...f, status: v }))
                    }
                  >
                    <SelectTrigger className="w-32 bg-gray-800 border-gray-700">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Date Filters Row */}
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-400 text-sm">From:</span>
                    <Input
                      type="date"
                      value={txFilters.startDate}
                      onChange={(e) =>
                        setTxFilters((f) => ({
                          ...f,
                          startDate: e.target.value,
                        }))
                      }
                      className="bg-gray-800 border-gray-700 text-white w-40"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">To:</span>
                    <Input
                      type="date"
                      value={txFilters.endDate}
                      onChange={(e) =>
                        setTxFilters((f) => ({ ...f, endDate: e.target.value }))
                      }
                      className="bg-gray-800 border-gray-700 text-white w-40"
                    />
                  </div>
                  <Button
                    onClick={fetchTransactions}
                    disabled={txLoading}
                    variant="outline"
                    className="border-gray-700"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Apply Filters
                  </Button>
                  <Button
                    onClick={handleExportTransactions}
                    disabled={exportingTransactions}
                    variant="outline"
                    className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                  >
                    {exportingTransactions ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Export Excel
                  </Button>
                  {(txFilters.startDate ||
                    txFilters.endDate ||
                    txFilters.type !== "all" ||
                    txFilters.status !== "all" ||
                    txFilters.search) && (
                    <Button
                      onClick={() =>
                        setTxFilters({
                          type: "all",
                          status: "all",
                          search: "",
                          startDate: "",
                          endDate: "",
                        })
                      }
                      variant="ghost"
                      className="text-gray-400 hover:text-white"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {txLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-gray-700">
                          <TableHead className="text-gray-400">Date</TableHead>
                          <TableHead className="text-gray-400">
                            User Info
                          </TableHead>
                          <TableHead className="text-gray-400">Type</TableHead>
                          <TableHead className="text-gray-400">
                            Amount
                          </TableHead>
                          <TableHead className="text-gray-400">
                            Status
                          </TableHead>
                          <TableHead className="text-gray-400">
                            Description
                          </TableHead>
                          <TableHead className="text-gray-400">
                            Transaction ID
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((tx) => (
                          <TableRow
                            key={tx._id}
                            className="border-gray-700 cursor-pointer hover:bg-gray-800/50 transition-colors"
                            onClick={() => handleTransactionClick(tx)}
                          >
                            <TableCell className="text-gray-400 text-sm whitespace-nowrap">
                              {new Date(tx.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <div className="font-medium text-white text-sm">
                                  {tx.userInfo?.name || "Unknown"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {tx.userInfo?.email || tx.userId}
                                </div>
                                <div className="text-xs text-gray-600 font-mono">
                                  ID: {tx.userInfo?.id || tx.userId}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={`${getTransactionTypeColor(tx.transactionType)} text-white text-xs`}
                              >
                                {getTransactionTypeLabel(tx.transactionType)}
                              </Badge>
                              {tx.source && tx.source !== "wallet" && (
                                <Badge
                                  variant="outline"
                                  className="ml-1 text-xs border-gray-600"
                                >
                                  {tx.source === "platform" ? "Admin" : "VAT"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell
                              className={`font-semibold ${tx.amount >= 0 ? "text-green-400" : "text-red-400"}`}
                            >
                              {tx.amount >= 0 ? "+" : ""}
                              {tx.amount.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={`${getStatusColor(tx.status)} text-white text-xs`}
                              >
                                {tx.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-400 text-sm max-w-xs">
                              <div className="truncate">
                                {tx.description || "-"}
                              </div>
                              {/* Show fee details for withdrawals */}
                              {tx.transactionType === "withdrawal" &&
                                tx.metadata?.netAmountEUR !== undefined && (
                                  <div className="text-xs text-cyan-400 mt-0.5">
                                    Net: {currencySymbol}{tx.metadata.netAmountEUR?.toFixed(2)}{" "}
                                    | Fee: {currencySymbol}
                                    {tx.metadata.platformFee?.toFixed(2) ||
                                      "0.00"}
                                  </div>
                                )}
                            </TableCell>
                            <TableCell
                              className="font-mono text-xs text-gray-500 cursor-pointer hover:text-gray-300"
                              title={`Click to copy: ${tx._id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(tx._id);
                                toast.success("Transaction ID copied!");
                              }}
                            >
                              {tx._id}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-gray-400">
                      Showing {(txPage - 1) * 50 + 1} -{" "}
                      {Math.min(txPage * 50, txTotal)} of {txTotal}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                        disabled={txPage === 1}
                        className="border-gray-700"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-gray-400">
                        Page {txPage} of {Math.ceil(txTotal / 50)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTxPage((p) => p + 1)}
                        disabled={txPage * 50 >= txTotal}
                        className="border-gray-700"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-6">
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-xl flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                Invoice Export
              </CardTitle>
              <CardDescription>
                Download all invoices for the selected date range as PDF files
                or CSV
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Date Range Selector */}
              <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                  <Calendar className="h-4 w-4" />
                  Select Date Range
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={invoiceDateRange.start}
                      onChange={(e) =>
                        setInvoiceDateRange((prev) => ({
                          ...prev,
                          start: e.target.value,
                        }))
                      }
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      End Date
                    </label>
                    <Input
                      type="date"
                      value={invoiceDateRange.end}
                      onChange={(e) =>
                        setInvoiceDateRange((prev) => ({
                          ...prev,
                          end: e.target.value,
                        }))
                      }
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                </div>

                {/* Quick Date Presets */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-gray-400 hover:text-white"
                    onClick={() => {
                      const now = new Date();
                      const start = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        1,
                      );
                      setInvoiceDateRange({
                        start: start.toISOString().split("T")[0],
                        end: now.toISOString().split("T")[0],
                      });
                    }}
                  >
                    This Month
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-gray-400 hover:text-white"
                    onClick={() => {
                      const now = new Date();
                      const start = new Date(
                        now.getFullYear(),
                        now.getMonth() - 1,
                        1,
                      );
                      const end = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        0,
                      );
                      setInvoiceDateRange({
                        start: start.toISOString().split("T")[0],
                        end: end.toISOString().split("T")[0],
                      });
                    }}
                  >
                    Last Month
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-gray-400 hover:text-white"
                    onClick={() => {
                      const now = new Date();
                      const quarter = Math.floor(now.getMonth() / 3);
                      const start = new Date(now.getFullYear(), quarter * 3, 1);
                      setInvoiceDateRange({
                        start: start.toISOString().split("T")[0],
                        end: now.toISOString().split("T")[0],
                      });
                    }}
                  >
                    This Quarter
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-gray-400 hover:text-white"
                    onClick={() => {
                      const now = new Date();
                      const start = new Date(now.getFullYear(), 0, 1);
                      setInvoiceDateRange({
                        start: start.toISOString().split("T")[0],
                        end: now.toISOString().split("T")[0],
                      });
                    }}
                  >
                    This Year
                  </Button>
                </div>
              </div>

              {/* Invoice Summary */}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-gray-400 text-sm font-medium">
                    Invoice Summary
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchInvoiceSummary}
                    disabled={loadingInvoiceSummary}
                    className="text-gray-400 hover:text-white"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${loadingInvoiceSummary ? "animate-spin" : ""}`}
                    />
                  </Button>
                </div>

                {loadingInvoiceSummary ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                  </div>
                ) : invoiceSummary ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">
                        Total Invoices
                      </div>
                      <div className="text-2xl font-bold text-white">
                        {invoiceSummary.count}
                      </div>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Subtotal</div>
                      <div className="text-2xl font-bold text-gray-300">
                        {currencySymbol}
                        {invoiceSummary.totalSubtotal.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Total VAT</div>
                      <div className="text-2xl font-bold text-orange-400">
                        {currencySymbol}
                        {invoiceSummary.totalVAT.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Grand Total</div>
                      <div className="text-2xl font-bold text-emerald-400">
                        {currencySymbol}
                        {invoiceSummary.totalAmount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No invoices found for the selected date range
                  </div>
                )}
              </div>

              {/* Export Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={() => handleExportInvoices("zip")}
                  disabled={
                    exportingInvoices ||
                    !invoiceSummary ||
                    invoiceSummary.count === 0
                  }
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                >
                  {exportingInvoices ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating PDFs...
                    </>
                  ) : (
                    <>
                      <FileArchive className="h-4 w-4 mr-2" />
                      Download All PDFs (ZIP)
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => handleExportInvoices("csv")}
                  disabled={
                    exportingInvoices ||
                    !invoiceSummary ||
                    invoiceSummary.count === 0
                  }
                  className="flex-1 border-gray-600 hover:bg-gray-800"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as CSV
                </Button>
              </div>

              {/* Help Text */}
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-indigo-200">
                    <p className="font-medium mb-1">Export Options:</p>
                    <ul className="list-disc list-inside space-y-1 text-indigo-200/80">
                      <li>
                        <strong>ZIP (PDFs)</strong> - Download all invoices as
                        individual PDF files in a ZIP archive
                      </li>
                      <li>
                        <strong>CSV</strong> - Download invoice data as a
                        spreadsheet for accounting software
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Period Selector */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-xl flex items-center gap-2">
                    📊 Financial Analytics
                  </CardTitle>
                  <CardDescription>
                    Performance snapshots and trends
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={analyticsPeriod}
                    onValueChange={setAnalyticsPeriod}
                  >
                    <SelectTrigger className="w-40 bg-gray-800 border-gray-700">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="30">Last 30 Days</SelectItem>
                      <SelectItem value="60">Last 60 Days</SelectItem>
                      <SelectItem value="90">Last 90 Days</SelectItem>
                      <SelectItem value="120">Last 120 Days</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                  {analyticsPeriod === "custom" && (
                    <>
                      <Input
                        type="date"
                        value={analyticsCustomStart}
                        onChange={(e) =>
                          setAnalyticsCustomStart(e.target.value)
                        }
                        className="bg-gray-800 border-gray-700 text-white w-36"
                      />
                      <span className="text-gray-400">to</span>
                      <Input
                        type="date"
                        value={analyticsCustomEnd}
                        onChange={(e) => setAnalyticsCustomEnd(e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white w-36"
                      />
                    </>
                  )}
                  <Button
                    onClick={fetchAnalyticsData}
                    disabled={analyticsLoading}
                    className="bg-cyan-600 hover:bg-cyan-700"
                  >
                    {analyticsLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {analyticsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
            </div>
          ) : analyticsData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-gradient-to-br from-green-900/50 to-gray-900 border-green-500/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-400">
                      Total Income
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-400">
                      {currencySymbol}
                      {analyticsData.summary.totalIncome.toFixed(2)}
                    </div>
                    <div
                      className={`text-sm mt-1 ${analyticsData.summary.incomeGrowth >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      {analyticsData.summary.incomeGrowth >= 0 ? "↑" : "↓"}{" "}
                      {Math.abs(analyticsData.summary.incomeGrowth).toFixed(1)}%
                      vs previous period
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-900/50 to-gray-900 border-red-500/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-400">
                      Total Expenses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-400">
                      {currencySymbol}
                      {analyticsData.summary.totalExpenses.toFixed(2)}
                    </div>
                    <div
                      className={`text-sm mt-1 ${analyticsData.summary.expenseGrowth <= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      {analyticsData.summary.expenseGrowth >= 0 ? "↑" : "↓"}{" "}
                      {Math.abs(analyticsData.summary.expenseGrowth).toFixed(1)}
                      % vs previous period
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={`bg-gradient-to-br ${analyticsData.summary.netProfit >= 0 ? "from-emerald-900/50 to-gray-900 border-emerald-500/50" : "from-orange-900/50 to-gray-900 border-orange-500/50"}`}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-400">
                      Net Profit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`text-3xl font-bold ${analyticsData.summary.netProfit >= 0 ? "text-emerald-400" : "text-orange-400"}`}
                    >
                      {analyticsData.summary.netProfit >= 0 ? "+" : ""}
                      {currencySymbol}
                      {analyticsData.summary.netProfit.toFixed(2)}
                    </div>
                    <div className="text-sm mt-1 text-gray-400">
                      Profit Margin:{" "}
                      {analyticsData.summary.profitMargin.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-900/50 to-gray-900 border-blue-500/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-400">
                      User Money Flow
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Deposits:</span>
                        <span className="text-green-400 font-semibold">
                          {currencySymbol}
                          {analyticsData.summary.totalDeposits.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">
                          Withdrawals:
                        </span>
                        <span className="text-red-400 font-semibold">
                          {currencySymbol}
                          {analyticsData.summary.totalWithdrawals.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row 1: Income/Expense Trend + Cumulative */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Income vs Expenses */}
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">
                      Daily Income vs Expenses
                    </CardTitle>
                    <CardDescription>
                      Daily comparison of platform income and expenses
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analyticsData.timeSeries}
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#374151"
                          />
                          <XAxis
                            dataKey="date"
                            stroke="#9ca3af"
                            fontSize={10}
                            tickFormatter={(value) =>
                              new Date(value).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            }
                          />
                          <YAxis
                            stroke="#9ca3af"
                            fontSize={10}
                            tickFormatter={(value) => `${currencySymbol}${value}`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1f2937",
                              border: "1px solid #374151",
                              borderRadius: "8px",
                            }}
                            labelStyle={{ color: "#fff" }}
                            formatter={(value) => [
                              `${currencySymbol}${(value as number)?.toFixed(2) || "0.00"}`,
                              "",
                            ]}
                            labelFormatter={(label) =>
                              new Date(label as string).toLocaleDateString()
                            }
                          />
                          <Legend />
                          <Bar
                            dataKey="totalIncome"
                            name="Income"
                            fill="#10b981"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="totalExpenses"
                            name="Expenses"
                            fill="#ef4444"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Cumulative Profit Trend */}
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">
                      Cumulative Profit Trend
                    </CardTitle>
                    <CardDescription>
                      Running total of profit over time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={analyticsData.timeSeries}
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="profitGradient"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#10b981"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor="#10b981"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#374151"
                          />
                          <XAxis
                            dataKey="date"
                            stroke="#9ca3af"
                            fontSize={10}
                            tickFormatter={(value) =>
                              new Date(value).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            }
                          />
                          <YAxis
                            stroke="#9ca3af"
                            fontSize={10}
                            tickFormatter={(value) => `${currencySymbol}${value}`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1f2937",
                              border: "1px solid #374151",
                              borderRadius: "8px",
                            }}
                            labelStyle={{ color: "#fff" }}
                            formatter={(value) => [
                              `${currencySymbol}${(value as number)?.toFixed(2) || "0.00"}`,
                              "",
                            ]}
                            labelFormatter={(label) =>
                              new Date(label as string).toLocaleDateString()
                            }
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="cumulativeProfit"
                            name="Cumulative Profit"
                            stroke="#10b981"
                            fill="url(#profitGradient)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row 2: Pie Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Breakdown */}
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">
                      Revenue Breakdown
                    </CardTitle>
                    <CardDescription>
                      Where platform income comes from
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      {analyticsData.revenuePieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analyticsData.revenuePieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, percent }) =>
                                `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                              }
                              labelLine={{ stroke: "#9ca3af" }}
                            >
                              {analyticsData.revenuePieData.map(
                                (entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                  />
                                ),
                              )}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#1f2937",
                                border: "1px solid #374151",
                                borderRadius: "8px",
                              }}
                              formatter={(value) => [
                                `${currencySymbol}${(value as number)?.toFixed(2) || "0.00"}`,
                                "",
                              ]}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          No revenue data for this period
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Expense Breakdown */}
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">
                      Expense Breakdown
                    </CardTitle>
                    <CardDescription>Where money goes out</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      {analyticsData.expensePieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analyticsData.expensePieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, percent }) =>
                                `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                              }
                              labelLine={{ stroke: "#9ca3af" }}
                            >
                              {analyticsData.expensePieData.map(
                                (entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                  />
                                ),
                              )}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#1f2937",
                                border: "1px solid #374151",
                                borderRadius: "8px",
                              }}
                              formatter={(value) => [
                                `${currencySymbol}${(value as number)?.toFixed(2) || "0.00"}`,
                                "",
                              ]}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          No expense data for this period
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row 3: Income Components Breakdown */}
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">
                    Income Components Over Time
                  </CardTitle>
                  <CardDescription>
                    Stacked view of all income sources
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={analyticsData.timeSeries}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="compFeeGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#10b981"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#10b981"
                              stopOpacity={0.1}
                            />
                          </linearGradient>
                          <linearGradient
                            id="challFeeGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#f97316"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#f97316"
                              stopOpacity={0.1}
                            />
                          </linearGradient>
                          <linearGradient
                            id="depositFeeGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#22c55e"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#22c55e"
                              stopOpacity={0.1}
                            />
                          </linearGradient>
                          <linearGradient
                            id="unclaimedGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#f59e0b"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#f59e0b"
                              stopOpacity={0.1}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="date"
                          stroke="#9ca3af"
                          fontSize={10}
                          tickFormatter={(value) =>
                            new Date(value).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          }
                        />
                        <YAxis
                          stroke="#9ca3af"
                          fontSize={10}
                          tickFormatter={(value) => `${currencySymbol}${value}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1f2937",
                            border: "1px solid #374151",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "#fff" }}
                          formatter={(value) => [
                            `${currencySymbol}${(value as number)?.toFixed(2) || "0.00"}`,
                            "",
                          ]}
                          labelFormatter={(label) =>
                            new Date(label).toLocaleDateString()
                          }
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="competitionFees"
                          name="Competition Fees"
                          stackId="1"
                          stroke="#10b981"
                          fill="url(#compFeeGradient)"
                        />
                        <Area
                          type="monotone"
                          dataKey="challengeFees"
                          name="Challenge Fees"
                          stackId="1"
                          stroke="#f97316"
                          fill="url(#challFeeGradient)"
                        />
                        <Area
                          type="monotone"
                          dataKey="depositFees"
                          name="Deposit Fees"
                          stackId="1"
                          stroke="#22c55e"
                          fill="url(#depositFeeGradient)"
                        />
                        <Area
                          type="monotone"
                          dataKey="unclaimedPools"
                          name="Unclaimed Pools"
                          stackId="1"
                          stroke="#f59e0b"
                          fill="url(#unclaimedGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* User Deposits vs Withdrawals */}
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">
                    User Deposits vs Withdrawals
                  </CardTitle>
                  <CardDescription>
                    Money flow in and out from users
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={analyticsData.timeSeries}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="date"
                          stroke="#9ca3af"
                          fontSize={10}
                          tickFormatter={(value) =>
                            new Date(value).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          }
                        />
                        <YAxis
                          stroke="#9ca3af"
                          fontSize={10}
                          tickFormatter={(value) => `${currencySymbol}${value}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1f2937",
                            border: "1px solid #374151",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "#fff" }}
                          formatter={(value) => [
                            `${currencySymbol}${(value as number)?.toFixed(2) || "0.00"}`,
                            "",
                          ]}
                          labelFormatter={(label) =>
                            new Date(label).toLocaleDateString()
                          }
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="deposits"
                          name="Deposits"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="withdrawals"
                          name="Withdrawals"
                          stroke="#ef4444"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <Info className="h-12 w-12 mb-4 opacity-50" />
              <p>Select a period and click refresh to load analytics</p>
            </div>
          )}
        </TabsContent>

        {/* RECONCILIATION TAB */}
        <TabsContent value="reconciliation" className="space-y-6">
          <ReconciliationSection />
        </TabsContent>
      </Tabs>

      {/* Admin Withdrawal Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Banknote className="h-5 w-5 text-emerald-400" />
              Record Platform Withdrawal
            </DialogTitle>
            <DialogDescription>
              Record when you convert platform credits to real money (withdraw
              to bank)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-sm text-gray-400">Available to withdraw</div>
              <div className="text-2xl font-bold text-emerald-400">
                {currencySymbol}
                {Math.max(
                  0,
                  (liabilityMetrics?.theoreticalBankBalance || 0) -
                    (liabilityMetrics?.totalUserCreditsEUR || 0) -
                    (vatEnabled ? platformFinancials?.outstandingVAT || 0 : 0),
                ).toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1 space-y-1">
                <div className="flex justify-between">
                  <span>Bank Balance:</span>
                  <span className="text-green-400">
                    {currencySymbol}
                    {(liabilityMetrics?.theoreticalBankBalance || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>User Liabilities:</span>
                  <span className="text-red-400">
                    -{currencySymbol}
                    {(liabilityMetrics?.totalUserCreditsEUR || 0).toFixed(2)}
                  </span>
                </div>
                {vatEnabled && (platformFinancials?.outstandingVAT || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Outstanding VAT:</span>
                    <span className="text-red-400">
                      -{currencySymbol}
                      {(platformFinancials?.outstandingVAT || 0).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400">
                Withdrawal Amount ({currencyCode})
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                max={Math.max(
                  0,
                  (liabilityMetrics?.theoreticalBankBalance || 0) -
                    (liabilityMetrics?.totalUserCreditsEUR || 0) -
                    (vatEnabled ? platformFinancials?.outstandingVAT || 0 : 0),
                )}
                className="mt-1 bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400">Bank Name</label>
                <Input
                  placeholder="e.g., Bank of Cyprus"
                  value={withdrawBank}
                  onChange={(e) => setWithdrawBank(e.target.value)}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">
                  Account (last 4 digits)
                </label>
                <Input
                  placeholder="1234"
                  maxLength={4}
                  value={withdrawAccount}
                  onChange={(e) => setWithdrawAccount(e.target.value)}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400">Reference/Note</label>
              <Input
                placeholder="e.g., Monthly withdrawal - June 2025"
                value={withdrawReference}
                onChange={(e) => setWithdrawReference(e.target.value)}
                className="mt-1 bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400">Additional Notes</label>
              <Input
                placeholder="Optional notes..."
                value={withdrawNotes}
                onChange={(e) => setWithdrawNotes(e.target.value)}
                className="mt-1 bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowWithdrawDialog(false)}
              className="border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdminWithdraw}
              disabled={withdrawing || !withdrawAmount}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {withdrawing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Banknote className="h-4 w-4 mr-2" />
                  Record Withdrawal
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VAT Payment Dialog */}
      <Dialog open={showVatPayDialog} onOpenChange={setShowVatPayDialog}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Banknote className="h-5 w-5 text-orange-400" />
              Record VAT Payment
            </DialogTitle>
            <DialogDescription>
              Record VAT payment to government and reset outstanding balance
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
              <div className="text-sm text-gray-400">
                Outstanding VAT to Pay
              </div>
              <div className="text-3xl font-bold text-orange-400">
                {currencySymbol}
                {(
                  vatData?.outstanding.total ||
                  platformFinancials?.outstandingVAT ||
                  0
                ).toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Period: {vatDateRange.start} to {vatDateRange.end}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400">Payment Reference</label>
              <Input
                placeholder="e.g., VAT-2025-Q1-001"
                value={vatPaymentRef}
                onChange={(e) => setVatPaymentRef(e.target.value)}
                className="mt-1 bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400">Notes (optional)</label>
              <Input
                placeholder="e.g., Paid via bank transfer"
                value={vatPaymentNotes}
                onChange={(e) => setVatPaymentNotes(e.target.value)}
                className="mt-1 bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-xs text-yellow-400">
                ⚠️ This will mark the VAT as paid and update the outstanding
                balance. Make sure you have actually submitted the VAT payment
                to the government before recording it here.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowVatPayDialog(false)}
              className="border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleVatPayment}
              disabled={
                vatPaymentProcessing || (vatData?.outstanding.total || 0) <= 0
              }
              className="bg-orange-500 hover:bg-orange-600"
            >
              {vatPaymentProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Banknote className="h-4 w-4 mr-2" />
                  Record VAT Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Payment Dialog */}
      <Dialog open={showVendorPayDialog} onOpenChange={setShowVendorPayDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Building2 className="h-5 w-5 text-purple-400" />
              Record Vendor Payment
            </DialogTitle>
            <DialogDescription>
              Pay vendor from platform earnings - this will be deducted from
              your net position
            </DialogDescription>
          </DialogHeader>

          {selectedVendor && (
            <div className="space-y-4 py-4">
              {/* Vendor Info */}
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <h3 className="text-white font-semibold text-lg">
                  {selectedVendor.name}
                </h3>
                <p className="text-gray-400 text-sm mt-1">
                  {selectedVendor.description || selectedVendor.serviceType}
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <Badge
                    variant="outline"
                    className="border-purple-500/50 text-purple-300"
                  >
                    {selectedVendor.serviceType}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-gray-600 text-gray-300"
                  >
                    {selectedVendor.billingCycle}
                  </Badge>
                </div>
              </div>

              {/* Platform Position Info */}
              <div className="bg-gray-800/50 rounded-lg p-4 text-sm">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">
                    Theoretical Bank Balance:
                  </span>
                  <span className="text-cyan-400 font-mono">
                    {currencySymbol}
                    {(liabilityMetrics?.theoreticalBankBalance || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">
                    User Credit Liabilities:
                  </span>
                  <span className="text-red-400 font-mono">
                    -{currencySymbol}
                    {(liabilityMetrics?.totalUserCreditsEUR || 0).toFixed(2)}
                  </span>
                </div>
                {vatEnabled && (platformFinancials?.outstandingVAT || 0) > 0 && (
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">
                      Outstanding VAT:
                    </span>
                    <span className="text-red-400 font-mono">
                      -{currencySymbol}
                      {(platformFinancials?.outstandingVAT || 0).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-700">
                  <span className="text-gray-300 font-semibold">
                    Available to Pay:
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      (liabilityMetrics?.theoreticalBankBalance || 0) -
                        (liabilityMetrics?.totalUserCreditsEUR || 0) -
                        (vatEnabled ? platformFinancials?.outstandingVAT || 0 : 0) >=
                      0
                        ? "text-green-400"
                        : "text-orange-400"
                    }`}
                  >
                    {currencySymbol}
                    {Math.max(
                      0,
                      (liabilityMetrics?.theoreticalBankBalance || 0) -
                        (liabilityMetrics?.totalUserCreditsEUR || 0) -
                        (vatEnabled ? platformFinancials?.outstandingVAT || 0 : 0),
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Payment Amount */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Payment Amount ({currencySymbol})
                </label>
                <Input
                  type="number"
                  value={vendorPaymentAmount}
                  onChange={(e) => setVendorPaymentAmount(e.target.value)}
                  placeholder={selectedVendor.amount.toString()}
                  className="bg-gray-800 border-gray-600 text-white"
                  step="0.01"
                  min="0"
                />
                <p className="text-xs text-gray-500">
                  Default: {currencySymbol}{selectedVendor.amount.toFixed(2)}
                </p>
              </div>

              {/* Reference */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Payment Reference (optional)
                </label>
                <Input
                  value={vendorPaymentRef}
                  onChange={(e) => setVendorPaymentRef(e.target.value)}
                  placeholder="e.g., Bank transfer ref"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>

              {/* Invoice Number */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Invoice Number (optional)
                </label>
                <Input
                  value={vendorPaymentInvoice}
                  onChange={(e) => setVendorPaymentInvoice(e.target.value)}
                  placeholder="e.g., INV-2026-001"
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">
                  Notes (optional)
                </label>
                <Input
                  value={vendorPaymentNotes}
                  onChange={(e) => setVendorPaymentNotes(e.target.value)}
                  placeholder="Additional notes..."
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>

              {/* Warning */}
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 text-orange-400 mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-semibold">Important</span>
                </div>
                <p className="text-gray-400">
                  This payment will be recorded as an expense and deducted from
                  your platform&apos;s net position. Make sure you have actually
                  made the payment to the vendor before recording it here.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowVendorPayDialog(false);
                setSelectedVendor(null);
                setVendorPaymentRef("");
                setVendorPaymentInvoice("");
                setVendorPaymentNotes("");
                setVendorPaymentAmount("");
              }}
              className="border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleVendorPayment}
              disabled={vendorPaymentProcessing || !selectedVendor}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {vendorPaymentProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Banknote className="h-4 w-4 mr-2" />
                  Record Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Balance Dialog */}
      <Dialog
        open={showAddBalanceDialog}
        onOpenChange={setShowAddBalanceDialog}
      >
        <DialogContent className="bg-gray-900 border-gray-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <DollarSign className="h-5 w-5 text-teal-400" />
              Add Balance to Operating Funds
            </DialogTitle>
            <DialogDescription>
              Inject money into the platform&apos;s operating balance (e.g.,
              from bank transfer, personal investment)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Amount */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Amount ({currencySymbol}) *
              </label>
              <Input
                type="number"
                value={balanceAddForm.amount}
                onChange={(e) =>
                  setBalanceAddForm((f) => ({ ...f, amount: e.target.value }))
                }
                placeholder="0.00"
                className="bg-gray-800 border-gray-600 text-white"
                step="0.01"
                min="0"
              />
            </div>

            {/* Source */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Source of Funds *
              </label>
              <Select
                value={balanceAddForm.source}
                onValueChange={(v) =>
                  setBalanceAddForm((f) => ({ ...f, source: v }))
                }
              >
                <SelectTrigger className="bg-gray-800 border-gray-600">
                  <SelectValue placeholder="Select source..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="personal_funds">Personal Funds</SelectItem>
                  <SelectItem value="investor_capital">
                    Investor Capital
                  </SelectItem>
                  <SelectItem value="loan">Loan</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reference */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Reference Number (optional)
              </label>
              <Input
                value={balanceAddForm.reference}
                onChange={(e) =>
                  setBalanceAddForm((f) => ({
                    ...f,
                    reference: e.target.value,
                  }))
                }
                placeholder="e.g., Transfer reference"
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Description (optional)
              </label>
              <Input
                value={balanceAddForm.description}
                onChange={(e) =>
                  setBalanceAddForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
                placeholder="Additional details..."
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>

            {/* Info */}
            <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-3 text-sm">
              <p className="text-gray-400">
                This will add to your platform&apos;s operating balance,
                increasing the &quot;What We Have&quot; amount and allowing you
                to pay vendor bills or record expenses.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddBalanceDialog(false);
                setBalanceAddForm({
                  amount: "",
                  source: "",
                  reference: "",
                  notes: "",
                  description: "",
                });
              }}
              className="border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddBalance}
              disabled={
                adminFundsProcessing ||
                !balanceAddForm.amount ||
                !balanceAddForm.source
              }
              className="bg-teal-600 hover:bg-teal-700"
            >
              {adminFundsProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Add Balance
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog
        open={showAddExpenseDialog}
        onOpenChange={setShowAddExpenseDialog}
      >
        <DialogContent className="bg-gray-900 border-gray-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
              Record Custom Expense
            </DialogTitle>
            <DialogDescription>
              Record an expense that will be deducted from your platform&apos;s
              operating balance
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Amount */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Amount ({currencySymbol}) *
              </label>
              <Input
                type="number"
                value={expenseForm.amount}
                onChange={(e) =>
                  setExpenseForm((f) => ({ ...f, amount: e.target.value }))
                }
                placeholder="0.00"
                className="bg-gray-800 border-gray-600 text-white"
                step="0.01"
                min="0"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Category *
              </label>
              <Select
                value={expenseForm.category}
                onValueChange={(v) =>
                  setExpenseForm((f) => ({ ...f, category: v }))
                }
              >
                <SelectTrigger className="bg-gray-800 border-gray-600">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">
                    Marketing & Advertising
                  </SelectItem>
                  <SelectItem value="software">Software & Tools</SelectItem>
                  <SelectItem value="hosting">
                    Hosting & Infrastructure
                  </SelectItem>
                  <SelectItem value="legal">Legal & Compliance</SelectItem>
                  <SelectItem value="accounting">
                    Accounting & Finance
                  </SelectItem>
                  <SelectItem value="office">Office & Supplies</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="travel">Travel & Entertainment</SelectItem>
                  <SelectItem value="salary">Salaries & Wages</SelectItem>
                  <SelectItem value="consulting">
                    Consulting & Services
                  </SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="utilities">Utilities</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="subscriptions">Subscriptions</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Vendor */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Vendor/Payee (optional)
              </label>
              <Input
                value={expenseForm.vendor}
                onChange={(e) =>
                  setExpenseForm((f) => ({ ...f, vendor: e.target.value }))
                }
                placeholder="Who was paid?"
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>

            {/* Invoice Number */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Invoice/Receipt # (optional)
              </label>
              <Input
                value={expenseForm.invoiceNumber}
                onChange={(e) =>
                  setExpenseForm((f) => ({
                    ...f,
                    invoiceNumber: e.target.value,
                  }))
                }
                placeholder="e.g., INV-2026-001"
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Payment Method (optional)
              </label>
              <Select
                value={expenseForm.paymentMethod}
                onValueChange={(v) =>
                  setExpenseForm((f) => ({ ...f, paymentMethod: v }))
                }
              >
                <SelectTrigger className="bg-gray-800 border-gray-600">
                  <SelectValue placeholder="How was it paid?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                Description (optional)
              </label>
              <Input
                value={expenseForm.description}
                onChange={(e) =>
                  setExpenseForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="What was this expense for?"
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>

            {/* Warning */}
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 text-rose-400 mb-1">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-semibold">Important</span>
              </div>
              <p className="text-gray-400">
                This expense will be deducted from your platform&apos;s
                operating balance. Make sure you have already paid this expense
                before recording it here.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddExpenseDialog(false);
                setExpenseForm({
                  amount: "",
                  category: "other",
                  vendor: "",
                  invoiceNumber: "",
                  paymentMethod: "",
                  notes: "",
                  description: "",
                });
              }}
              className="border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddExpense}
              disabled={adminFundsProcessing || !expenseForm.amount}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {adminFundsProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Record Expense
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Detail Dialog */}
      <Dialog
        open={!!selectedTransaction}
        onOpenChange={() => setSelectedTransaction(null)}
      >
        <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <ArrowRightLeft className="h-5 w-5 text-indigo-400" />
              Transaction Details
            </DialogTitle>
            <DialogDescription>
              Complete information about this transaction
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              {/* Transaction Status Banner */}
              <div
                className={`rounded-lg p-4 ${
                  selectedTransaction.status === "completed"
                    ? "bg-green-500/10 border border-green-500/30"
                    : selectedTransaction.status === "failed"
                      ? "bg-red-500/10 border border-red-500/30"
                      : "bg-yellow-500/10 border border-yellow-500/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge
                      className={`${getStatusColor(selectedTransaction.status)} text-white`}
                    >
                      {selectedTransaction.status}
                    </Badge>
                    <Badge
                      className={`${getTransactionTypeColor(selectedTransaction.transactionType)} text-white`}
                    >
                      {selectedTransaction.transactionType.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      selectedTransaction.amount >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {selectedTransaction.amount >= 0 ? "+" : ""}
                    {selectedTransaction.amount.toLocaleString()} {creditSymbol}
                  </div>
                </div>
              </div>

              {/* Basic Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">
                    Transaction ID
                  </div>
                  <div
                    className="font-mono text-sm text-white cursor-pointer hover:text-indigo-400 break-all"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedTransaction._id);
                      toast.success("Transaction ID copied!");
                    }}
                  >
                    {selectedTransaction._id}
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Date & Time</div>
                  <div className="text-white text-sm">
                    {new Date(selectedTransaction.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* User Info */}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-2">
                  User Information
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-500/20 rounded-full p-2">
                    <Users className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium">
                      {selectedTransaction.userInfo?.name || "Unknown User"}
                    </div>
                    <div className="text-sm text-gray-400">
                      {selectedTransaction.userInfo?.email ||
                        selectedTransaction.userId}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      ID:{" "}
                      {selectedTransaction.userInfo?.id ||
                        selectedTransaction.userId}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedTransaction.description && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Description</div>
                  <div className="text-white text-sm">
                    {selectedTransaction.description}
                  </div>
                </div>
              )}

              {/* Payment Method */}
              {selectedTransaction.paymentMethod && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">
                    Payment Method
                  </div>
                  <div className="text-white text-sm capitalize">
                    {selectedTransaction.paymentMethod}
                  </div>
                </div>
              )}

              {/* Competition Info */}
              {selectedTransaction.competitionId && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Competition</div>
                  <div className="text-white text-sm font-mono">
                    {selectedTransaction.competitionId}
                  </div>
                </div>
              )}

              {/* Withdrawal Fee Breakdown */}
              {selectedTransaction.transactionType === "withdrawal" &&
                selectedTransaction.metadata && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="h-4 w-4 text-blue-400" />
                      <span className="text-white font-medium">
                        Withdrawal Fee Breakdown
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">
                          Withdrawal Amount:
                        </span>
                        <span className="text-white">
                          {currencySymbol}
                          {(
                            selectedTransaction.metadata.amountEUR || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Platform Fee:</span>
                        <span className="text-red-400">
                          -{currencySymbol}
                          {(
                            selectedTransaction.metadata.platformFee || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                      {selectedTransaction.metadata.bankFee !== undefined &&
                        selectedTransaction.metadata.bankFee > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Bank Fee:</span>
                            <span className="text-red-400">
                              -{currencySymbol}
                              {selectedTransaction.metadata.bankFee.toFixed(2)}
                            </span>
                          </div>
                        )}
                      <div className="flex justify-between text-sm font-medium border-t border-blue-500/30 pt-2 mt-2">
                        <span className="text-blue-300">User Receives:</span>
                        <span className="text-green-400 text-lg">
                          {currencySymbol}
                          {(
                            selectedTransaction.metadata.netAmountEUR || 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

              {/* Metadata */}
              {selectedTransaction.metadata &&
                Object.keys(selectedTransaction.metadata).length > 0 &&
                selectedTransaction.transactionType !== "withdrawal" && (
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="text-xs text-gray-500 mb-2">
                      Additional Details
                    </div>
                    <div className="space-y-2">
                      {selectedTransaction.metadata.paymentIntentId && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">
                            Payment Intent ID:
                          </span>
                          <span className="text-white font-mono text-xs">
                            {selectedTransaction.metadata.paymentIntentId}
                          </span>
                        </div>
                      )}
                      {selectedTransaction.metadata.creditsValue !==
                        undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Credits Value:</span>
                          <span className="text-white">
                            {currencySymbol}
                            {selectedTransaction.metadata.creditsValue?.toFixed(
                              2,
                            )}
                          </span>
                        </div>
                      )}
                      {selectedTransaction.metadata.vatAmount !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">VAT Amount:</span>
                          <span className="text-orange-400">
                            {currencySymbol}
                            {selectedTransaction.metadata.vatAmount?.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {selectedTransaction.metadata.vatRate !== undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">VAT Rate:</span>
                          <span className="text-white">
                            {selectedTransaction.metadata.vatRate}%
                          </span>
                        </div>
                      )}
                      {selectedTransaction.metadata.platformFee !==
                        undefined && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Platform Fee:</span>
                          <span className="text-white">
                            {currencySymbol}
                            {selectedTransaction.metadata.platformFee?.toFixed(
                              2,
                            )}
                          </span>
                        </div>
                      )}
                      {selectedTransaction.metadata.totalPaid !== undefined && (
                        <div className="flex justify-between text-sm font-medium border-t border-gray-700 pt-2 mt-2">
                          <span className="text-gray-300">Total Paid:</span>
                          <span className="text-emerald-400">
                            {currencySymbol}
                            {selectedTransaction.metadata.totalPaid?.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {/* Invoice Section (for deposits) */}
              {selectedTransaction.transactionType === "deposit" && (
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-400" />
                      <span className="text-white font-medium">Invoice</span>
                    </div>
                    {loadingInvoice && (
                      <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
                    )}
                  </div>

                  {loadingInvoice ? (
                    <div className="text-center py-4 text-gray-400 text-sm">
                      Loading invoice...
                    </div>
                  ) : transactionInvoice ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-gray-500">
                            Invoice Number
                          </div>
                          <div className="text-white font-mono text-sm">
                            {transactionInvoice.invoiceNumber}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">
                            Invoice Date
                          </div>
                          <div className="text-white text-sm">
                            {new Date(
                              transactionInvoice.invoiceDate,
                            ).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 bg-gray-800 rounded-lg p-3">
                        <div>
                          <div className="text-xs text-gray-500">Subtotal</div>
                          <div className="text-white">
                            {currencySymbol}
                            {transactionInvoice.subtotal?.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">
                            VAT ({transactionInvoice.vatRate}%)
                          </div>
                          <div className="text-orange-400">
                            {currencySymbol}
                            {transactionInvoice.vatAmount?.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Total</div>
                          <div className="text-emerald-400 font-semibold">
                            {currencySymbol}
                            {transactionInvoice.total?.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                          onClick={() =>
                            window.open(
                              `/api/invoices/${transactionInvoice._id}/pdf`,
                              "_blank",
                            )
                          }
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                          onClick={() =>
                            window.open(
                              `/api/invoices/${transactionInvoice._id}/view`,
                              "_blank",
                            )
                          }
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Invoice
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No invoice found for this transaction
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
