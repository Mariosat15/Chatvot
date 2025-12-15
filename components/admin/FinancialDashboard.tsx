'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Trophy,
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
  Swords,
} from 'lucide-react';
import { useAppSettings } from '@/contexts/AppSettingsContext';

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
}

interface PendingWithdrawal {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  createdAt: string;
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
  
  // User deposits/withdrawals (actual money flow)
  totalUserDeposits: number;      // Base EUR deposited by users for credits
  totalUserWithdrawals: number;   // EUR withdrawn by users
  
  // Legacy fields for backward compatibility
  totalDepositFees?: number;
  totalWithdrawalFees?: number;
  totalEarnings?: number;
  totalEarningsEUR?: number;
  
  totalAdminWithdrawals: number;
  totalAdminWithdrawalsEUR: number;
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
  status: 'pending' | 'paid';
  paidAt?: string;
  paidByEmail?: string;
  reference?: string;
  createdAt: string;
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
  source?: 'wallet' | 'platform' | 'vat';
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
  const [activeTab, setActiveTab] = useState('overview');
  
  // Data states
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([]);
  const [liabilityMetrics, setLiabilityMetrics] = useState<LiabilityMetrics | null>(null);
  const [platformFinancials, setPlatformFinancials] = useState<PlatformFinancials | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [conversionRate, setConversionRate] = useState(100);
  
  // Transaction history states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [txLoading, setTxLoading] = useState(false);
  const [txFilters, setTxFilters] = useState({
    type: 'all',
    status: 'all',
    search: '',
  });
  
  // VAT states
  const [vatEnabled, setVatEnabled] = useState<boolean>(false);
  const [vatData, setVatData] = useState<VATData | null>(null);
  const [vatDateRange, setVatDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [showVatPayDialog, setShowVatPayDialog] = useState(false);
  const [vatPaymentProcessing, setVatPaymentProcessing] = useState(false);
  const [vatPaymentRef, setVatPaymentRef] = useState('');
  const [vatPaymentNotes, setVatPaymentNotes] = useState('');
  
  // Invoice export states
  const [invoiceDateRange, setInvoiceDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
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
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawBank, setWithdrawBank] = useState('');
  const [withdrawAccount, setWithdrawAccount] = useState('');
  const [withdrawReference, setWithdrawReference] = useState('');
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  
  // Backfill state
  const [backfilling, setBackfilling] = useState(false);
  
  // Search states
  const [walletSearch, setWalletSearch] = useState('');
  
  // Transaction detail dialog
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionInvoice, setTransactionInvoice] = useState<any>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Get dynamic currency settings
  const creditName = settings?.credits?.name || 'Credits';
  const creditSymbol = settings?.credits?.symbol || '⚡';
  const currencySymbol = settings?.currency?.symbol || '€';
  const currencyCode = settings?.currency?.code || 'EUR';

  const fetchVatEnabled = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/invoice-settings');
      if (response.ok) {
        const result = await response.json();
        // API returns invoiceSettings object directly, not wrapped in 'data'
        const isVatEnabled = result.invoiceSettings?.vatEnabled || result.shouldApplyVat || false;
        console.log('📋 VAT Enabled:', isVatEnabled, result);
        setVatEnabled(isVatEnabled);
      }
    } catch (error) {
      console.error('Failed to fetch VAT settings:', error);
    }
  }, []);

  const fetchVatData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        startDate: vatDateRange.start,
        endDate: vatDateRange.end,
      });
      const response = await fetch(`/api/admin/vat?${params}`);
      if (!response.ok) throw new Error('Failed to fetch VAT data');
      
      const result = await response.json();
      setVatData(result.data);
    } catch (error) {
      console.error('Failed to load VAT data:', error);
    }
  }, [vatDateRange]);
  
  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/admin/financial-dashboard');
      if (!response.ok) throw new Error('Failed to fetch data');
      
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
    } catch (error) {
      toast.error('Failed to load financial data');
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchVatData, fetchVatEnabled]);

  const fetchTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const params = new URLSearchParams({
        page: txPage.toString(),
        limit: '50',
        type: txFilters.type,
        status: txFilters.status,
        search: txFilters.search,
      });
      
      const response = await fetch(`/api/admin/transactions?${params}`);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      
      const result = await response.json();
      setTransactions(result.data.transactions);
      setTxTotal(result.data.pagination.total);
    } catch (error) {
      toast.error('Failed to load transactions');
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
    if (tx.transactionType === 'deposit' && tx.status === 'completed') {
      setLoadingInvoice(true);
      try {
        // Try to find invoice by payment ID or user ID + date
        const response = await fetch(`/api/admin/invoices/by-transaction?transactionId=${tx._id}&userId=${tx.userId}&paymentId=${tx.metadata?.paymentIntentId || ''}`);
        if (response.ok) {
          const result = await response.json();
          if (result.invoice) {
            setTransactionInvoice(result.invoice);
          }
        }
      } catch (error) {
        console.error('Failed to fetch invoice:', error);
      } finally {
        setLoadingInvoice(false);
      }
    }
  };

  // Fetch invoice summary for export
  const fetchInvoiceSummary = useCallback(async () => {
    setLoadingInvoiceSummary(true);
    try {
      const response = await fetch('/api/admin/invoices/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: invoiceDateRange.start,
          endDate: invoiceDateRange.end,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to fetch invoice summary');
      
      const result = await response.json();
      setInvoiceSummary({
        count: result.count,
        totalAmount: result.totalAmount,
        totalVAT: result.totalVAT,
        totalSubtotal: result.totalSubtotal,
      });
    } catch (error) {
      console.error('Failed to fetch invoice summary:', error);
      setInvoiceSummary(null);
    } finally {
      setLoadingInvoiceSummary(false);
    }
  }, [invoiceDateRange]);

  // Export invoices as ZIP
  const handleExportInvoices = async (format: 'zip' | 'csv') => {
    setExportingInvoices(true);
    try {
      const params = new URLSearchParams({
        startDate: invoiceDateRange.start,
        endDate: invoiceDateRange.end,
        format,
      });
      
      const response = await fetch(`/api/admin/invoices/export?${params}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'zip' 
        ? `invoices_${invoiceDateRange.start}_to_${invoiceDateRange.end}.zip`
        : `invoices_${invoiceDateRange.start}_to_${invoiceDateRange.end}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Invoices exported successfully as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export invoices');
    } finally {
      setExportingInvoices(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'transactions') {
      fetchTransactions();
    }
  }, [activeTab, fetchTransactions]);

  useEffect(() => {
    if (activeTab === 'invoices') {
      fetchInvoiceSummary();
    }
  }, [activeTab, invoiceDateRange, fetchInvoiceSummary]);

  const handleAdminWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const amount = parseFloat(withdrawAmount) * conversionRate; // Convert EUR to credits
    const amountEUR = parseFloat(withdrawAmount);

    setWithdrawing(true);
    try {
      const response = await fetch('/api/admin/platform-financials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        toast.error(result.error || 'Failed to record withdrawal');
        return;
      }

      toast.success(`Successfully recorded withdrawal of ${currencySymbol}${amountEUR.toFixed(2)}`);
      setShowWithdrawDialog(false);
      setWithdrawAmount('');
      setWithdrawBank('');
      setWithdrawAccount('');
      setWithdrawReference('');
      setWithdrawNotes('');
      fetchData();
    } catch (error) {
      toast.error('Failed to process withdrawal');
      console.error(error);
    } finally {
      setWithdrawing(false);
    }
  };

  const handleVatPayment = async () => {
    if (!vatData?.outstanding.total || vatData.outstanding.total <= 0) {
      toast.error('No outstanding VAT to pay');
      return;
    }
    
    setVatPaymentProcessing(true);
    try {
      const response = await fetch('/api/admin/vat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodStart: vatDateRange.start,
          periodEnd: vatDateRange.end,
          amount: vatData.outstanding.total,
          reference: vatPaymentRef,
          notes: vatPaymentNotes,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to record VAT payment');
      
      toast.success(`VAT payment of ${currencySymbol}${vatData.outstanding.total.toFixed(2)} recorded successfully`);
      setShowVatPayDialog(false);
      setVatPaymentRef('');
      setVatPaymentNotes('');
      fetchData();
    } catch (error) {
      toast.error('Failed to record VAT payment');
      console.error(error);
    } finally {
      setVatPaymentProcessing(false);
    }
  };
  
  const handleBackfillFees = async () => {
    if (!confirm('This will calculate and record fees for all existing deposits/withdrawals. Continue?')) {
      return;
    }
    
    setBackfilling(true);
    try {
      const response = await fetch('/api/admin/platform-financials/backfill', {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Failed to backfill fees');
      
      const result = await response.json();
      toast.success(`Backfilled ${result.depositsBackfilled} deposits and ${result.withdrawalsBackfilled} withdrawals`);
      fetchData();
    } catch (error) {
      toast.error('Failed to backfill fees');
      console.error(error);
    } finally {
      setBackfilling(false);
    }
  };

  const creditsToEUR = (credits: number) => (credits / conversionRate).toFixed(2);

  const filteredWallets = wallets.filter((w) =>
    w.userId.toLowerCase().includes(walletSearch.toLowerCase()) ||
    w.userName.toLowerCase().includes(walletSearch.toLowerCase()) ||
    w.userEmail.toLowerCase().includes(walletSearch.toLowerCase())
  );

  const getTransactionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      deposit: 'bg-green-500',
      withdrawal: 'bg-blue-500',
      competition_entry: 'bg-orange-500',
      competition_win: 'bg-yellow-500',
      competition_refund: 'bg-purple-500',
      platform_fee: 'bg-red-500',
      admin_adjustment: 'bg-gray-500',
      withdrawal_fee: 'bg-pink-500',
      // Admin transactions
      admin_withdrawal: 'bg-cyan-500',
      vat_payment: 'bg-indigo-500',
      unclaimed_pool: 'bg-amber-500',
      deposit_fee: 'bg-emerald-500',
      // Challenge transactions
      challenge_entry: 'bg-orange-600',
      challenge_win: 'bg-yellow-600',
      challenge_platform_fee: 'bg-orange-500',
      challenge_refund: 'bg-purple-400',
    };
    return colors[type] || 'bg-gray-500';
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      deposit: 'User Deposit',
      withdrawal: 'User Withdrawal',
      competition_entry: 'Competition Entry',
      competition_win: 'Competition Win',
      competition_refund: 'Refund',
      platform_fee: 'Competition Fee',
      admin_adjustment: 'Admin Adjustment',
      withdrawal_fee: 'Withdrawal Fee',
      admin_withdrawal: '💰 Admin Withdrawal',
      vat_payment: '🏛️ VAT Payment',
      unclaimed_pool: '🎯 Unclaimed Pool',
      deposit_fee: 'Deposit Fee',
      // Challenge transactions
      challenge_entry: '⚔️ Challenge Entry',
      challenge_win: '⚔️ Challenge Win',
      challenge_platform_fee: '⚔️ Challenge Fee',
      challenge_refund: '⚔️ Challenge Refund',
    };
    return labels[type] || type.replace(/_/g, ' ');
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-500',
      pending: 'bg-yellow-500',
      failed: 'bg-red-500',
      cancelled: 'bg-gray-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-12">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-400 mr-3" />
          <div className="text-emerald-400 text-lg">Loading financial data...</div>
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
                {backfilling ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <History className="h-3 w-3 mr-1" />}
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
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-gray-900 border border-gray-700">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="liabilities">Bank & Liabilities</TabsTrigger>
          <TabsTrigger value="earnings">Platform Earnings</TabsTrigger>
          {vatEnabled && <TabsTrigger value="vat">VAT</TabsTrigger>}
          <TabsTrigger value="wallets">User Wallets</TabsTrigger>
          <TabsTrigger value="transactions">All Transactions</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          {/* MAIN FINANCIAL SUMMARY - Clear HAVE vs OWE */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* What We HAVE */}
            <Card className="bg-gradient-to-br from-green-900/50 to-gray-900 border-2 border-green-500/50">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-green-400 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  💰 WHAT WE HAVE
                </CardTitle>
                <CardDescription className="text-green-300/70">
                  Theoretical Bank Balance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-green-400 mb-4">
                  {currencySymbol}{liabilityMetrics?.theoreticalBankBalance.toFixed(2) || '0.00'}
                </div>
                <div className="space-y-2 text-sm border-t border-green-500/20 pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">User Deposits</span>
                    <span className="text-green-400">+{currencySymbol}{(platformFinancials?.totalUserDeposits || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Deposit/Withdrawal Fees (Gross)</span>
                    <span className="text-green-400">+{currencySymbol}{((platformFinancials?.totalDepositFeesGross || 0) + (platformFinancials?.totalWithdrawalFeesGross || 0)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Competition Fees</span>
                    <span className="text-emerald-400">+{currencySymbol}{(platformFinancials?.totalPlatformFees || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Challenge Fees</span>
                    <span className="text-orange-400">+{currencySymbol}{(platformFinancials?.totalChallengeFees || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Marketplace Sales</span>
                    <span className="text-purple-400">+{currencySymbol}{(platformFinancials?.totalMarketplaceSales || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Bank Fees (Stripe/Provider)</span>
                    <span className="text-red-400">-{currencySymbol}{(platformFinancials?.totalBankFees || 0).toFixed(2)}</span>
                  </div>
                  {vatEnabled && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">VAT Collected</span>
                      <span className="text-green-400">+{currencySymbol}{(platformFinancials?.totalVATCollected || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">User Withdrawals</span>
                    <span className="text-red-400">-{currencySymbol}{(platformFinancials?.totalUserWithdrawals || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Admin Withdrawals</span>
                    <span className="text-red-400">-{currencySymbol}{(platformFinancials?.totalAdminWithdrawalsEUR || 0).toFixed(2)}</span>
                  </div>
                  {vatEnabled && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">VAT Paid</span>
                      <span className="text-red-400">-{currencySymbol}{(platformFinancials?.totalVATPaid || 0).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* What We OWE */}
            <Card className="bg-gradient-to-br from-red-900/50 to-gray-900 border-2 border-red-500/50">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-red-400 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" />
                  ⚠️ WHAT WE OWE
                </CardTitle>
                <CardDescription className="text-red-300/70">
                  Total Liabilities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-red-400 mb-4">
                  {currencySymbol}{((liabilityMetrics?.totalUserCreditsEUR || 0) + (vatEnabled ? (platformFinancials?.outstandingVAT || 0) : 0)).toFixed(2)}
                </div>
                <div className="space-y-2 text-sm border-t border-red-500/20 pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">User Credit Balances</span>
                    <span className="text-red-400">{currencySymbol}{(liabilityMetrics?.totalUserCreditsEUR || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>({liabilityMetrics?.totalUserCredits.toLocaleString() || 0} {creditName})</span>
                    <span>Can withdraw anytime</span>
                  </div>
                  {vatEnabled && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Outstanding VAT</span>
                      <span className="text-orange-400">{currencySymbol}{(platformFinancials?.outstandingVAT || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {pendingWithdrawals.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Pending Withdrawals</span>
                      <span className="text-yellow-400">{currencySymbol}{(liabilityMetrics?.pendingWithdrawalsEUR || 0).toFixed(2)} ({pendingWithdrawals.length})</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Net Position */}
            <Card className={`bg-gradient-to-br ${
              ((liabilityMetrics?.theoreticalBankBalance || 0) - ((liabilityMetrics?.totalUserCreditsEUR || 0) + (vatEnabled ? (platformFinancials?.outstandingVAT || 0) : 0))) >= 0 
                ? 'from-blue-900/50 to-gray-900 border-2 border-blue-500/50' 
                : 'from-orange-900/50 to-gray-900 border-2 border-orange-500/50'
            }`}>
              <CardHeader>
                <CardTitle className="text-lg font-bold text-blue-400 flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  📊 NET POSITION
                </CardTitle>
                <CardDescription className="text-blue-300/70">
                  HAVE - OWE = Platform's Money
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-bold mb-4 ${
                  ((liabilityMetrics?.theoreticalBankBalance || 0) - ((liabilityMetrics?.totalUserCreditsEUR || 0) + (vatEnabled ? (platformFinancials?.outstandingVAT || 0) : 0))) >= 0 
                    ? 'text-blue-400' 
                    : 'text-orange-400'
                }`}>
                  {currencySymbol}{((liabilityMetrics?.theoreticalBankBalance || 0) - ((liabilityMetrics?.totalUserCreditsEUR || 0) + (vatEnabled ? (platformFinancials?.outstandingVAT || 0) : 0))).toFixed(2)}
                </div>
                <div className="space-y-2 text-sm border-t border-blue-500/20 pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Coverage Ratio</span>
                    <span className={`font-semibold ${(liabilityMetrics?.coverageRatio || 1) >= 1 ? 'text-green-400' : 'text-red-400'}`}>
                      {((liabilityMetrics?.coverageRatio || 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {(liabilityMetrics?.coverageRatio || 1) >= 1 
                      ? '✅ Fully covered - All obligations can be met' 
                      : '⚠️ Under-covered - Review immediately'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Platform Earnings Breakdown */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-emerald-400" />
                Platform Earnings Breakdown
              </CardTitle>
              <CardDescription>Where our revenue comes from</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                  <div className="text-xs text-gray-400 uppercase">Competition Fees</div>
                  <div className="text-2xl font-bold text-emerald-400">{currencySymbol}{(platformFinancials?.totalPlatformFees || 0).toFixed(2)}</div>
                  <div className="text-xs text-gray-500">% of prize pools</div>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                  <div className="text-xs text-gray-400 uppercase">Challenge Fees</div>
                  <div className="text-2xl font-bold text-orange-400">{currencySymbol}{(platformFinancials?.totalChallengeFees || 0).toFixed(2)}</div>
                  <div className="text-xs text-gray-500">1v1 challenge fees</div>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                  <div className="text-xs text-gray-400 uppercase">Marketplace Sales</div>
                  <div className="text-2xl font-bold text-purple-400">{currencySymbol}{(platformFinancials?.totalMarketplaceSales || 0).toFixed(2)}</div>
                  <div className="text-xs text-gray-500">{platformFinancials?.marketplacePurchases || 0} purchases</div>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <div className="text-xs text-gray-400 uppercase">Deposit Fees</div>
                  <div className="text-2xl font-bold text-green-400">{currencySymbol}{(platformFinancials?.netDepositEarnings || 0).toFixed(2)}</div>
                  <div className="text-xs text-gray-500">After bank fees</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="text-xs text-gray-400 uppercase">Withdrawal Fees</div>
                  <div className="text-2xl font-bold text-blue-400">{currencySymbol}{(platformFinancials?.netWithdrawalEarnings || 0).toFixed(2)}</div>
                  <div className="text-xs text-gray-500">After bank fees</div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                  <div className="text-xs text-gray-400 uppercase">Unclaimed Pools</div>
                  <div className="text-2xl font-bold text-amber-400">{currencySymbol}{((platformFinancials?.totalUnclaimedPools || 0) / conversionRate).toFixed(2)}</div>
                  <div className="text-xs text-gray-500">All disqualified comps</div>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {/* Total Earned (Historical) */}
                <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total Earned (All Time)</span>
                    <span className="text-lg font-semibold text-white">{currencySymbol}{(platformFinancials?.totalNetEarningsEUR || 0).toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Gross: {currencySymbol}{(platformFinancials?.totalGrossEarnings || 0).toFixed(2)} - Bank Fees: {currencySymbol}{(platformFinancials?.totalBankFees || 0).toFixed(2)}
                  </div>
                </div>
                
                {/* Already Withdrawn */}
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-red-400">Already Withdrawn by Admin</span>
                    <span className="text-lg font-semibold text-red-400">-{currencySymbol}{(platformFinancials?.totalAdminWithdrawalsEUR || 0).toFixed(2)}</span>
                  </div>
                </div>
                
                {/* Available to Withdraw (This is what matters!) */}
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-400 font-semibold">💰 Available to Withdraw</span>
                    <span className="text-2xl font-bold text-emerald-400">{currencySymbol}{(liabilityMetrics?.platformNetEUR || 0).toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Total Earned - Already Withdrawn = What you can take out now
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-xl flex items-center gap-2">
                <History className="h-5 w-5 text-cyan-400" />
                Recent Transactions
              </CardTitle>
              <CardDescription>Last 20 transactions across all users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx._id}
                    className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm">
                          {tx.userName || tx.userId.substring(0, 8)}
                        </span>
                        <Badge className={`${getTransactionTypeColor(tx.transactionType)} text-white text-xs`}>
                          {getTransactionTypeLabel(tx.transactionType)}
                        </Badge>
                        <Badge className={`${getStatusColor(tx.status)} text-white text-xs`}>
                          {tx.status}
                        </Badge>
                      </div>
                      {tx.description && (
                        <p className="text-sm text-gray-400 mt-1 truncate max-w-md">{tx.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()} {creditSymbol}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(tx.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LIABILITIES TAB */}
        <TabsContent value="liabilities" className="space-y-6">
          {/* What We HAVE */}
          <Card className="bg-gray-900 border-green-500/50">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                What We HAVE (Theoretical Bank Balance)
              </CardTitle>
              <CardDescription className="text-sm">
                Money received from users minus money paid out
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-4xl font-bold text-green-400">
                {currencySymbol}{liabilityMetrics?.theoreticalBankBalance.toFixed(2) || '0.00'}
              </div>
              
              {/* Incoming Money */}
              <div className="border-b border-gray-700 pb-3">
                <div className="text-xs text-gray-500 uppercase mb-2">💰 Money Received</div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <div className="text-gray-400 text-xs">User Credit Purchases</div>
                    <div className="text-green-400 font-semibold">+{currencySymbol}{(platformFinancials?.totalUserDeposits || 0).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">Base amount for credits</div>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <div className="text-gray-400 text-xs">Deposit/Withdrawal Fees</div>
                    <div className="text-green-400 font-semibold">+{currencySymbol}{((platformFinancials?.totalDepositFeesGross || 0) + (platformFinancials?.totalWithdrawalFeesGross || 0)).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">Deposit + withdrawal fees</div>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                    <div className="text-gray-400 text-xs">Competition Fees</div>
                    <div className="text-emerald-400 font-semibold">+{currencySymbol}{(platformFinancials?.totalPlatformFees || 0).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">% of prize pools</div>
                  </div>
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                    <div className="text-gray-400 text-xs">Challenge Fees</div>
                    <div className="text-orange-400 font-semibold">+{currencySymbol}{(platformFinancials?.totalChallengeFees || 0).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">1v1 challenge fees</div>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                    <div className="text-gray-400 text-xs">Marketplace</div>
                    <div className="text-purple-400 font-semibold">+{currencySymbol}{(platformFinancials?.totalMarketplaceSales || 0).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">{platformFinancials?.marketplacePurchases || 0} sales</div>
                  </div>
                  {vatEnabled && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                      <div className="text-gray-400 text-xs">VAT Collected</div>
                      <div className="text-green-400 font-semibold">+{currencySymbol}{(platformFinancials?.totalVATCollected || 0).toFixed(2)}</div>
                      <div className="text-xs text-gray-500">Tax collected from EU users</div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Outgoing Money */}
              <div>
                <div className="text-xs text-gray-500 uppercase mb-2">💸 Money Paid Out</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <div className="text-gray-400 text-xs">User Withdrawals</div>
                    <div className="text-red-400 font-semibold">-{currencySymbol}{(platformFinancials?.totalUserWithdrawals || 0).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">Paid to user bank accounts</div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <div className="text-gray-400 text-xs">Admin Withdrawals</div>
                    <div className="text-red-400 font-semibold">-{currencySymbol}{(platformFinancials?.totalAdminWithdrawalsEUR || 0).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">Company withdrawals</div>
                  </div>
                  {vatEnabled && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <div className="text-gray-400 text-xs">VAT Paid to Gov</div>
                      <div className="text-red-400 font-semibold">-{currencySymbol}{(platformFinancials?.totalVATPaid || 0).toFixed(2)}</div>
                      <div className="text-xs text-gray-500">Tax remitted to government</div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What We OWE */}
          <Card className="bg-gray-900 border-red-500/50">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-red-400" />
                What We OWE (Total Liabilities)
              </CardTitle>
              <CardDescription className="text-sm">
                Money we must be able to pay if requested
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-4xl font-bold text-red-400">
                {currencySymbol}{((liabilityMetrics?.totalUserCreditsEUR || 0) + (vatEnabled ? (platformFinancials?.outstandingVAT || 0) : 0)).toFixed(2)}
              </div>
              <div className={`grid ${vatEnabled ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'} gap-3 text-sm`}>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <div className="text-gray-400 text-xs">User {creditName} Balances</div>
                  <div className="text-red-400 font-semibold">{currencySymbol}{liabilityMetrics?.totalUserCreditsEUR.toFixed(2) || '0.00'}</div>
                  <div className="text-xs text-gray-500">{liabilityMetrics?.totalUserCredits.toLocaleString() || 0} {creditName} can be withdrawn</div>
                </div>
                {vatEnabled && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                    <div className="text-gray-400 text-xs">Outstanding VAT</div>
                    <div className="text-orange-400 font-semibold">{currencySymbol}{(platformFinancials?.outstandingVAT || 0).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">Tax owed to government</div>
                  </div>
                )}
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <div className="text-gray-400 text-xs">Pending Withdrawals</div>
                  <div className="text-yellow-400 font-semibold">{currencySymbol}{(liabilityMetrics?.pendingWithdrawalsEUR || 0).toFixed(2)}</div>
                  <div className="text-xs text-gray-500">{pendingWithdrawals.length} awaiting processing</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Coverage Ratio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className={`bg-gray-900 ${(liabilityMetrics?.coverageRatio || 1) >= 1 ? 'border-emerald-500/50' : 'border-red-500/50'}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  Coverage Ratio
            </CardTitle>
                <CardDescription className="text-xs">
                  {vatEnabled ? 'Bank Balance ÷ Total Liabilities' : 'Bank Balance ÷ User Liabilities'}
                </CardDescription>
          </CardHeader>
          <CardContent>
                <div className={`text-3xl font-bold ${(liabilityMetrics?.coverageRatio || 1) >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {((liabilityMetrics?.coverageRatio || 1) * 100).toFixed(1)}%
            </div>
            <p className="text-sm text-gray-400 mt-2">
                  {(liabilityMetrics?.coverageRatio || 1) >= 1 
                    ? '✅ Fully covered - All obligations can be met' 
                    : '⚠️ Under-covered - Insufficient funds to cover all obligations'}
            </p>
          </CardContent>
        </Card>

            <Card className="bg-gray-900 border-blue-500/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-blue-400" />
                  Net Position
            </CardTitle>
                <CardDescription className="text-xs">
                  What We HAVE - What We OWE
                </CardDescription>
          </CardHeader>
          <CardContent>
                <div className={`text-3xl font-bold ${(liabilityMetrics?.theoreticalBankBalance || 0) - ((liabilityMetrics?.totalUserCreditsEUR || 0) + (vatEnabled ? (platformFinancials?.outstandingVAT || 0) : 0)) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {currencySymbol}{((liabilityMetrics?.theoreticalBankBalance || 0) - ((liabilityMetrics?.totalUserCreditsEUR || 0) + (vatEnabled ? (platformFinancials?.outstandingVAT || 0) : 0))).toFixed(2)}
            </div>
            <p className="text-sm text-gray-400 mt-2">
                  Platform's actual available funds
            </p>
          </CardContent>
        </Card>
          </div>

          {/* Pending Withdrawals */}
          {pendingWithdrawals.length > 0 && (
            <Card className="bg-gray-900 border-orange-500/50">
              <CardHeader>
                <CardTitle className="text-white text-xl flex items-center gap-2">
                  <Download className="h-5 w-5 text-orange-400" />
                  Pending User Withdrawals ({pendingWithdrawals.length})
                </CardTitle>
                <CardDescription>
                  Total: {currencySymbol}{(liabilityMetrics?.pendingWithdrawalsEUR || 0).toFixed(2)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700">
                      <TableHead className="text-gray-400">User</TableHead>
                      <TableHead className="text-gray-400">Amount</TableHead>
                      <TableHead className="text-gray-400">EUR Value</TableHead>
                      <TableHead className="text-gray-400">Requested</TableHead>
                      <TableHead className="text-gray-400">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingWithdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal._id} className="border-gray-700">
                        <TableCell>
                          <div>
                            <div className="font-medium text-white">{withdrawal.userName}</div>
                            <div className="text-xs text-gray-400">{withdrawal.userEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-white">
                          {creditSymbol} {Math.abs(withdrawal.amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-green-400">
                          {currencySymbol}{creditsToEUR(Math.abs(withdrawal.amount))}
                        </TableCell>
                        <TableCell className="text-gray-400 text-sm">
                          {new Date(withdrawal.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
                            Process
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* EARNINGS TAB */}
        <TabsContent value="earnings" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gray-900 border-emerald-500/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-emerald-400" />
                  Gross Platform Fees
                </CardTitle>
                <CardDescription className="text-xs">What platform charges users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-400">
                  {currencySymbol}{platformFinancials?.totalGrossEarnings?.toFixed(2) || '0.00'}
              </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-red-500/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-red-400" />
                  Bank/Provider Fees
            </CardTitle>
                <CardDescription className="text-xs">What Stripe/bank charges us</CardDescription>
          </CardHeader>
          <CardContent>
                <div className="text-3xl font-bold text-red-400">
                  -{currencySymbol}{platformFinancials?.totalBankFees?.toFixed(2) || '0.00'}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-green-500/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-400" />
                  Net Platform Earnings
                </CardTitle>
                <CardDescription className="text-xs">What platform actually keeps</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-400">
                  {currencySymbol}{platformFinancials?.totalNetEarningsEUR?.toFixed(2) || '0.00'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Earnings Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Deposit Fees Breakdown */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  Deposit Fee Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-400">Platform Deposit Fees</div>
                    <div className="text-xs text-gray-500">Charged to users</div>
                  </div>
                  <div className="text-xl font-bold text-green-400">
                    {currencySymbol}{platformFinancials?.totalDepositFeesGross?.toFixed(2) || '0.00'}
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-400">Bank Deposit Fees</div>
                    <div className="text-xs text-gray-500">Stripe/payment provider</div>
                  </div>
                  <div className="text-xl font-bold text-red-400">
                    -{currencySymbol}{platformFinancials?.totalBankDepositFees?.toFixed(2) || '0.00'}
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-emerald-900/30 rounded-lg border border-emerald-500/30">
                  <div>
                    <div className="text-sm text-emerald-300 font-medium">Net Deposit Earnings</div>
                    <div className="text-xs text-emerald-500">Platform keeps</div>
                  </div>
                  <div className="text-xl font-bold text-emerald-400">
                    {currencySymbol}{platformFinancials?.netDepositEarnings?.toFixed(2) || '0.00'}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Withdrawal Fees Breakdown */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-blue-400" />
                  Withdrawal Fee Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-400">Platform Withdrawal Fees</div>
                    <div className="text-xs text-gray-500">Charged to users</div>
                  </div>
                  <div className="text-xl font-bold text-blue-400">
                    {currencySymbol}{platformFinancials?.totalWithdrawalFeesGross?.toFixed(2) || '0.00'}
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-400">Bank Withdrawal Fees</div>
                    <div className="text-xs text-gray-500">Payout/transfer costs</div>
                  </div>
                  <div className="text-xl font-bold text-red-400">
                    -{currencySymbol}{platformFinancials?.totalBankWithdrawalFees?.toFixed(2) || '0.00'}
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-emerald-900/30 rounded-lg border border-emerald-500/30">
                  <div>
                    <div className="text-sm text-emerald-300 font-medium">Net Withdrawal Earnings</div>
                    <div className="text-xs text-emerald-500">Platform keeps</div>
                  </div>
                  <div className="text-xl font-bold text-emerald-400">
                    {currencySymbol}{platformFinancials?.netWithdrawalEarnings?.toFixed(2) || '0.00'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Other Earnings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gray-900 border-emerald-500/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-emerald-400" />
                  Competition Fees
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {creditSymbol} {platformFinancials?.totalPlatformFees.toLocaleString() || 0}
            </div>
            <p className="text-sm text-gray-400 mt-2">
                  ≈ {currencySymbol}{creditsToEUR(platformFinancials?.totalPlatformFees || 0)}
            </p>
                <p className="text-xs text-gray-500 mt-1">% of competition prize pools</p>
          </CardContent>
        </Card>

            <Card className="bg-gray-900 border-orange-500/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Swords className="h-4 w-4 text-orange-400" />
                  Challenge Fees
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {creditSymbol} {platformFinancials?.totalChallengeFees?.toLocaleString() || 0}
              </div>
                <p className="text-sm text-gray-400 mt-2">
                  ≈ {currencySymbol}{creditsToEUR(platformFinancials?.totalChallengeFees || 0)}
                </p>
                <p className="text-xs text-gray-500 mt-1">1v1 challenge platform fees</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-purple-500/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-400" />
                  Marketplace Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
                <div className="text-2xl font-bold text-white">
                  {creditSymbol} {platformFinancials?.totalMarketplaceSales?.toLocaleString() || 0}
            </div>
            <p className="text-sm text-gray-400 mt-2">
                  ≈ {currencySymbol}{creditsToEUR(platformFinancials?.totalMarketplaceSales || 0)}
            </p>
                <p className="text-xs text-gray-500 mt-1">{platformFinancials?.marketplacePurchases || 0} items sold</p>
          </CardContent>
        </Card>

            <Card className="bg-gray-900 border-amber-500/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-400" />
                  Unclaimed Pools
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {creditSymbol} {platformFinancials?.totalUnclaimedPools.toLocaleString() || 0}
              </div>
                <p className="text-sm text-gray-400 mt-2">
                  ≈ {currencySymbol}{creditsToEUR(platformFinancials?.totalUnclaimedPools || 0)}
                </p>
                <p className="text-xs text-gray-500 mt-1">All disqualified competitions</p>
              </CardContent>
            </Card>
          </div>

          {/* Unclaimed Pools Detail */}
          {platformFinancials?.unclaimedPools && (
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-xl flex items-center gap-2">
                  <Target className="h-5 w-5 text-amber-400" />
                  Unclaimed Pools Breakdown
            </CardTitle>
                <CardDescription>
                  Competition pools kept by platform when NO prizes were awarded (all disqualified or no participants)
                </CardDescription>
          </CardHeader>
          <CardContent>
                {/* Info Box explaining unclaimed pools */}
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-amber-200/80">
                      <strong>What are unclaimed pools?</strong> When a competition ends and <u>ALL participants are disqualified</u> (or no one joined), 
                      no one qualifies for prizes. The prize pool then goes to the platform. <br/>
                      <strong>Note:</strong> If some winners exist (e.g., 2/3 positions filled), prizes are <u>redistributed</u> among them as bonus - nothing is unclaimed.
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {Object.entries(platformFinancials.unclaimedPools.byReason).map(([reason, data]) => (
                    <div key={reason} className="bg-gray-800 rounded-lg p-4">
                      <div className="text-xs text-gray-400 uppercase">{reason.replace(/_/g, ' ')}</div>
                      <div className="text-xl font-bold text-white mt-1">
                        {creditSymbol} {data.amount.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">{data.count} competition(s)</div>
                    </div>
                  ))}
                </div>

                {platformFinancials.unclaimedPools.recentPools.length > 0 && (
                  <>
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Recent Unclaimed Pools</h4>
                    <div className="space-y-2">
                      {platformFinancials.unclaimedPools.recentPools.slice(0, 5).map((pool) => (
                        <div key={pool._id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                          <div>
                            <div className="font-medium text-white">{pool.sourceName}</div>
                            <div className="text-xs text-gray-400">
                              {pool.unclaimedReason?.replace(/_/g, ' ')} • {pool.winnersCount}/{pool.expectedWinnersCount} winners
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-amber-400">
                              {creditSymbol} {pool.amount.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(pool.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Net Platform Position */}
          <Card className="bg-gray-900 border-emerald-500/50">
            <CardHeader>
              <CardTitle className="text-white text-xl flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-emerald-400" />
                Net Platform Position
              </CardTitle>
              <CardDescription>
                Total Earnings minus Admin Withdrawals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-4xl font-bold text-emerald-400">
                    {currencySymbol}{liabilityMetrics?.platformNetEUR.toFixed(2) || '0.00'}
            </div>
            <p className="text-sm text-gray-400 mt-2">
                    {creditSymbol} {liabilityMetrics?.platformNetCredits.toLocaleString() || 0} available to withdraw
                  </p>
                </div>
                <Button
                  onClick={() => setShowWithdrawDialog(true)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={(liabilityMetrics?.platformNetCredits || 0) <= 0}
                >
                  <Banknote className="h-4 w-4 mr-2" />
                  Convert to Bank
                </Button>
              </div>
          </CardContent>
        </Card>
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
                  {currencySymbol}{(vatData?.allTime.collected || platformFinancials?.totalVATCollected || 0).toFixed(2)}
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
                  {currencySymbol}{(vatData?.allTime.paid || platformFinancials?.totalVATPaid || 0).toFixed(2)}
            </div>
                <p className="text-xs text-gray-500 mt-1">Submitted to government</p>
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
                  {currencySymbol}{(vatData?.allTime.outstanding || platformFinancials?.outstandingVAT || 0).toFixed(2)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Owed to government</p>
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
                  {currencySymbol}{(vatData?.currentPeriod.vatCollected || 0).toFixed(2)}
                </div>
                <p className="text-xs text-gray-500 mt-1">{vatData?.currentPeriod.transactionCount || 0} transactions</p>
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
                  <CardDescription>Mark VAT as paid and reset outstanding balance</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Period Start</label>
                  <Input
                    type="date"
                    value={vatDateRange.start}
                    onChange={(e) => setVatDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Period End</label>
                  <Input
                    type="date"
                    value={vatDateRange.end}
                    onChange={(e) => setVatDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
              </div>
              
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Outstanding VAT to Pay</p>
                    <p className="text-3xl font-bold text-orange-400">
                      {currencySymbol}{(vatData?.outstanding.total || platformFinancials?.outstandingVAT || 0).toFixed(2)}
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
              <CardDescription>Record of all VAT payments submitted</CardDescription>
            </CardHeader>
            <CardContent>
              {vatData?.paymentHistory && vatData.paymentHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700">
                      <TableHead className="text-gray-400">Period</TableHead>
                      <TableHead className="text-gray-400">Amount</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                      <TableHead className="text-gray-400">Paid By</TableHead>
                      <TableHead className="text-gray-400">Reference</TableHead>
                      <TableHead className="text-gray-400">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vatData.paymentHistory.map((payment) => (
                      <TableRow key={payment._id} className="border-gray-700">
                        <TableCell className="text-white">
                          {new Date(payment.periodStart).toLocaleDateString()} - {new Date(payment.periodEnd).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-semibold text-green-400">
                          {currencySymbol}{payment.vatAmountEUR.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge className={payment.status === 'paid' ? 'bg-green-500' : 'bg-yellow-500'}>
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-400">{payment.paidByEmail || '-'}</TableCell>
                        <TableCell className="text-gray-400 font-mono text-xs">{payment.reference || '-'}</TableCell>
                        <TableCell className="text-gray-400">
                          {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : '-'}
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

        {/* WALLETS TAB */}
        <TabsContent value="wallets" className="space-y-6">
          <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white text-xl flex items-center gap-2">
                <Wallet className="h-5 w-5 text-green-400" />
                    User Wallets ({wallets.length})
              </CardTitle>
                  <CardDescription>View all user credit balances and activity</CardDescription>
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
                        <div className="text-xs font-normal">(Comp / Chall)</div>
                      </TableHead>
                      <TableHead className="text-gray-400 text-center">
                        <div>Spent</div>
                        <div className="text-xs font-normal">(Comp / Chall)</div>
                      </TableHead>
                      <TableHead className="text-gray-400">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                    {filteredWallets.slice(0, 50).map((wallet) => {
                      const totalWon = (wallet.totalWonFromCompetitions || 0) + (wallet.totalWonFromChallenges || 0);
                      const totalSpent = (wallet.totalSpentOnCompetitions || 0) + (wallet.totalSpentOnChallenges || 0);
                  const netPosition = wallet.creditBalance - wallet.totalDeposited;
                  return (
                    <TableRow key={wallet.userId} className="border-gray-700">
                          <TableCell>
                            <div>
                              <div className="font-medium text-white">{wallet.userName}</div>
                              <div className="text-xs text-gray-400">{wallet.userEmail}</div>
                            </div>
                      </TableCell>
                      <TableCell className="font-semibold text-white">
                        {creditSymbol} {wallet.creditBalance.toLocaleString()}
                        <div className="text-xs text-gray-500">
                          {currencySymbol}{creditsToEUR(wallet.creditBalance)}
                        </div>
                      </TableCell>
                      <TableCell className="text-green-400">
                        {creditSymbol} {wallet.totalDeposited.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-blue-400">
                        {creditSymbol} {wallet.totalWithdrawn.toLocaleString()}
                      </TableCell>
                          <TableCell className="text-yellow-400 text-center">
                            <div className="font-semibold">{creditSymbol} {totalWon.toLocaleString()}</div>
                            <div className="text-xs text-gray-500">
                              🏆 {(wallet.totalWonFromCompetitions || 0).toLocaleString()} / ⚔️ {(wallet.totalWonFromChallenges || 0).toLocaleString()}
                            </div>
                      </TableCell>
                          <TableCell className="text-red-400 text-center">
                            <div className="font-semibold">{creditSymbol} {totalSpent.toLocaleString()}</div>
                            <div className="text-xs text-gray-500">
                              🏆 {(wallet.totalSpentOnCompetitions || 0).toLocaleString()} / ⚔️ {(wallet.totalSpentOnChallenges || 0).toLocaleString()}
                            </div>
                      </TableCell>
                      <TableCell className={netPosition >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {netPosition >= 0 ? '+' : ''}{creditSymbol} {netPosition.toLocaleString()}
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
                  <CardDescription>Complete transaction history with filters</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search..."
                      value={txFilters.search}
                      onChange={(e) => setTxFilters(f => ({ ...f, search: e.target.value }))}
                      className="pl-10 bg-gray-800 border-gray-700 text-white w-48"
                    />
                  </div>
                  <Select
                    value={txFilters.type}
                    onValueChange={(v) => setTxFilters(f => ({ ...f, type: v }))}
                  >
                    <SelectTrigger className="w-40 bg-gray-800 border-gray-700">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="deposit">User Deposits</SelectItem>
                      <SelectItem value="withdrawal">User Withdrawals</SelectItem>
                      <SelectItem value="competition_entry">Competition Entry</SelectItem>
                      <SelectItem value="competition_win">Competition Win</SelectItem>
                      <SelectItem value="competition_refund">Refunds</SelectItem>
                      <SelectItem value="platform_fee">Competition Fees</SelectItem>
                      <SelectItem value="challenge_entry">Challenge Entry</SelectItem>
                      <SelectItem value="challenge_win">Challenge Win</SelectItem>
                      <SelectItem value="challenge_platform_fee">Challenge Fees</SelectItem>
                      <SelectItem value="admin_withdrawal">Admin Withdrawals</SelectItem>
                      <SelectItem value="vat_payment">VAT Payments</SelectItem>
                      <SelectItem value="unclaimed_pool">Unclaimed Pools</SelectItem>
                      <SelectItem value="deposit_fee">Deposit Fees</SelectItem>
                      <SelectItem value="withdrawal_fee">Withdrawal Fees</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={txFilters.status}
                    onValueChange={(v) => setTxFilters(f => ({ ...f, status: v }))}
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
                  <Button
                    onClick={fetchTransactions}
                    disabled={txLoading}
                    variant="outline"
                    className="border-gray-700"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Apply
                  </Button>
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
                          <TableHead className="text-gray-400">User Info</TableHead>
                          <TableHead className="text-gray-400">Type</TableHead>
                  <TableHead className="text-gray-400">Amount</TableHead>
                          <TableHead className="text-gray-400">Status</TableHead>
                          <TableHead className="text-gray-400">Description</TableHead>
                          <TableHead className="text-gray-400">Transaction ID</TableHead>
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
                                  {tx.userInfo?.name || 'Unknown'}
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
                              <Badge className={`${getTransactionTypeColor(tx.transactionType)} text-white text-xs`}>
                                {getTransactionTypeLabel(tx.transactionType)}
                              </Badge>
                              {tx.source && tx.source !== 'wallet' && (
                                <Badge variant="outline" className="ml-1 text-xs border-gray-600">
                                  {tx.source === 'platform' ? 'Admin' : 'VAT'}
                                </Badge>
                              )}
                    </TableCell>
                            <TableCell className={`font-semibold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                              <Badge className={`${getStatusColor(tx.status)} text-white text-xs`}>
                                {tx.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-400 text-sm max-w-xs truncate">
                              {tx.description || '-'}
                            </TableCell>
                            <TableCell 
                              className="font-mono text-xs text-gray-500 cursor-pointer hover:text-gray-300"
                              title={`Click to copy: ${tx._id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(tx._id);
                                toast.success('Transaction ID copied!');
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
                      Showing {((txPage - 1) * 50) + 1} - {Math.min(txPage * 50, txTotal)} of {txTotal}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTxPage(p => Math.max(1, p - 1))}
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
                        onClick={() => setTxPage(p => p + 1)}
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
                Download all invoices for the selected date range as PDF files or CSV
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
                    <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
                    <Input
                      type="date"
                      value={invoiceDateRange.start}
                      onChange={(e) => setInvoiceDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">End Date</label>
                    <Input
                      type="date"
                      value={invoiceDateRange.end}
                      onChange={(e) => setInvoiceDateRange(prev => ({ ...prev, end: e.target.value }))}
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
                      const start = new Date(now.getFullYear(), now.getMonth(), 1);
                      setInvoiceDateRange({
                        start: start.toISOString().split('T')[0],
                        end: now.toISOString().split('T')[0],
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
                      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                      const end = new Date(now.getFullYear(), now.getMonth(), 0);
                      setInvoiceDateRange({
                        start: start.toISOString().split('T')[0],
                        end: end.toISOString().split('T')[0],
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
                        start: start.toISOString().split('T')[0],
                        end: now.toISOString().split('T')[0],
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
                        start: start.toISOString().split('T')[0],
                        end: now.toISOString().split('T')[0],
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
                  <div className="text-gray-400 text-sm font-medium">Invoice Summary</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchInvoiceSummary}
                    disabled={loadingInvoiceSummary}
                    className="text-gray-400 hover:text-white"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingInvoiceSummary ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                {loadingInvoiceSummary ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                  </div>
                ) : invoiceSummary ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Total Invoices</div>
                      <div className="text-2xl font-bold text-white">{invoiceSummary.count}</div>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Subtotal</div>
                      <div className="text-2xl font-bold text-gray-300">
                        {currencySymbol}{invoiceSummary.totalSubtotal.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Total VAT</div>
                      <div className="text-2xl font-bold text-orange-400">
                        {currencySymbol}{invoiceSummary.totalVAT.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Grand Total</div>
                      <div className="text-2xl font-bold text-emerald-400">
                        {currencySymbol}{invoiceSummary.totalAmount.toFixed(2)}
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
                  onClick={() => handleExportInvoices('zip')}
                  disabled={exportingInvoices || !invoiceSummary || invoiceSummary.count === 0}
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
                  onClick={() => handleExportInvoices('csv')}
                  disabled={exportingInvoices || !invoiceSummary || invoiceSummary.count === 0}
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
                      <li><strong>ZIP (PDFs)</strong> - Download all invoices as individual PDF files in a ZIP archive</li>
                      <li><strong>CSV</strong> - Download invoice data as a spreadsheet for accounting software</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
              Record when you convert platform credits to real money (withdraw to bank)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-sm text-gray-400">Available to withdraw</div>
              <div className="text-2xl font-bold text-emerald-400">
                {currencySymbol}{liabilityMetrics?.platformNetEUR.toFixed(2) || '0.00'}
              </div>
              <div className="text-xs text-gray-500">
                {creditSymbol} {liabilityMetrics?.platformNetCredits.toLocaleString() || 0}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400">Withdrawal Amount ({currencyCode})</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
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
                <label className="text-sm text-gray-400">Account (last 4 digits)</label>
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
              <div className="text-sm text-gray-400">Outstanding VAT to Pay</div>
              <div className="text-3xl font-bold text-orange-400">
                {currencySymbol}{(vatData?.outstanding.total || platformFinancials?.outstandingVAT || 0).toFixed(2)}
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
                ⚠️ This will mark the VAT as paid and update the outstanding balance. 
                Make sure you have actually submitted the VAT payment to the government before recording it here.
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
              disabled={vatPaymentProcessing || (vatData?.outstanding.total || 0) <= 0}
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

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
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
              <div className={`rounded-lg p-4 ${
                selectedTransaction.status === 'completed' 
                  ? 'bg-green-500/10 border border-green-500/30' 
                  : selectedTransaction.status === 'failed'
                  ? 'bg-red-500/10 border border-red-500/30'
                  : 'bg-yellow-500/10 border border-yellow-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={`${getStatusColor(selectedTransaction.status)} text-white`}>
                      {selectedTransaction.status}
                    </Badge>
                    <Badge className={`${getTransactionTypeColor(selectedTransaction.transactionType)} text-white`}>
                      {selectedTransaction.transactionType.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className={`text-2xl font-bold ${
                    selectedTransaction.amount >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {selectedTransaction.amount >= 0 ? '+' : ''}{selectedTransaction.amount.toLocaleString()} {creditSymbol}
                  </div>
                </div>
              </div>

              {/* Basic Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Transaction ID</div>
                  <div 
                    className="font-mono text-sm text-white cursor-pointer hover:text-indigo-400 break-all"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedTransaction._id);
                      toast.success('Transaction ID copied!');
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
                <div className="text-xs text-gray-500 mb-2">User Information</div>
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-500/20 rounded-full p-2">
                    <Users className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium">
                      {selectedTransaction.userInfo?.name || 'Unknown User'}
                    </div>
                    <div className="text-sm text-gray-400">
                      {selectedTransaction.userInfo?.email || selectedTransaction.userId}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      ID: {selectedTransaction.userInfo?.id || selectedTransaction.userId}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedTransaction.description && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Description</div>
                  <div className="text-white text-sm">{selectedTransaction.description}</div>
                </div>
              )}

              {/* Payment Method */}
              {selectedTransaction.paymentMethod && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Payment Method</div>
                  <div className="text-white text-sm capitalize">{selectedTransaction.paymentMethod}</div>
                </div>
              )}

              {/* Competition Info */}
              {selectedTransaction.competitionId && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Competition</div>
                  <div className="text-white text-sm font-mono">{selectedTransaction.competitionId}</div>
                </div>
              )}

              {/* Metadata */}
              {selectedTransaction.metadata && Object.keys(selectedTransaction.metadata).length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-2">Additional Details</div>
                  <div className="space-y-2">
                    {selectedTransaction.metadata.paymentIntentId && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Payment Intent ID:</span>
                        <span className="text-white font-mono text-xs">{selectedTransaction.metadata.paymentIntentId}</span>
                      </div>
                    )}
                    {selectedTransaction.metadata.creditsValue !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Credits Value:</span>
                        <span className="text-white">{currencySymbol}{selectedTransaction.metadata.creditsValue?.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedTransaction.metadata.vatAmount !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">VAT Amount:</span>
                        <span className="text-orange-400">{currencySymbol}{selectedTransaction.metadata.vatAmount?.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedTransaction.metadata.vatRate !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">VAT Rate:</span>
                        <span className="text-white">{selectedTransaction.metadata.vatRate}%</span>
                      </div>
                    )}
                    {selectedTransaction.metadata.platformFee !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Platform Fee:</span>
                        <span className="text-white">{currencySymbol}{selectedTransaction.metadata.platformFee?.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedTransaction.metadata.totalPaid !== undefined && (
                      <div className="flex justify-between text-sm font-medium border-t border-gray-700 pt-2 mt-2">
                        <span className="text-gray-300">Total Paid:</span>
                        <span className="text-emerald-400">{currencySymbol}{selectedTransaction.metadata.totalPaid?.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Invoice Section (for deposits) */}
              {selectedTransaction.transactionType === 'deposit' && (
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
                          <div className="text-xs text-gray-500">Invoice Number</div>
                          <div className="text-white font-mono text-sm">{transactionInvoice.invoiceNumber}</div>
                  </div>
                        <div>
                          <div className="text-xs text-gray-500">Invoice Date</div>
                          <div className="text-white text-sm">
                            {new Date(transactionInvoice.invoiceDate).toLocaleDateString()}
                </div>
              </div>
          </div>

                      <div className="grid grid-cols-3 gap-3 bg-gray-800 rounded-lg p-3">
                        <div>
                          <div className="text-xs text-gray-500">Subtotal</div>
                          <div className="text-white">{currencySymbol}{transactionInvoice.subtotal?.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">VAT ({transactionInvoice.vatRate}%)</div>
                          <div className="text-orange-400">{currencySymbol}{transactionInvoice.vatAmount?.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Total</div>
                          <div className="text-emerald-400 font-semibold">{currencySymbol}{transactionInvoice.total?.toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                          onClick={() => window.open(`/api/invoices/${transactionInvoice._id}/pdf`, '_blank')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                          onClick={() => window.open(`/api/invoices/${transactionInvoice._id}/view`, '_blank')}
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
