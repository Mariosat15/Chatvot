'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  History,
  Filter,
  Download,
  CreditCard,
  XCircle,
  DollarSign,
  Calendar,
  Building2,
  Wallet,
} from 'lucide-react';

interface PaymentMetadata {
  eurAmount?: number;
  creditsReceived?: number;
  totalCharged?: number;
  vatAmount?: number;
  vatPercentage?: number;
  platformFeeAmount?: number;
  platformDepositFeePercentage?: number;
  paymentProvider?: string;
  // Legacy fields
  grossCredits?: number;
  processingFeePercentage?: number;
  feeAmount?: number;
  netCredits?: number;
  // Card details from Stripe
  cardBrand?: string;
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  cardCountry?: string;
}

interface Payment {
  _id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  transactionType: string;
  paymentIntentId?: string;
  paymentMethod?: string;
  paymentId?: string;
  description?: string;
  failureReason?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt?: string;
  metadata?: PaymentMetadata;
  stripeStatus?: string;
  stripeStatusNote?: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

interface PaymentStats {
  pending: { count: number; totalAmount: number; totalEUR: number };
  completed: { count: number; totalAmount: number; totalEUR: number };
  failed: { count: number; totalAmount: number; totalEUR: number };
  cancelled: { count: number; totalAmount: number; totalEUR: number };
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-300 border-red-500/30',
  cancelled: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  completed: <CheckCircle2 className="h-4 w-4" />,
  failed: <XCircle className="h-4 w-4" />,
  cancelled: <XCircle className="h-4 w-4" />,
};

type TabType = 'pending' | 'history';

export default function PendingPaymentsSection() {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  
  // Pending tab state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  
  // History tab state
  const [historyPayments, setHistoryPayments] = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyStats, setHistoryStats] = useState<PaymentStats | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  
  // History filters
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyMinAmount, setHistoryMinAmount] = useState('');
  const [historyMaxAmount, setHistoryMaxAmount] = useState('');
  const [historyProviderFilter, setHistoryProviderFilter] = useState('all');
  const [historyMethodFilter, setHistoryMethodFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Available filter options
  const [providers, setProviders] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  
  // Detail dialog state
  const [detailDialog, setDetailDialog] = useState<{
    open: boolean;
    payment: Payment | null;
  }>({ open: false, payment: null });

  // Fetch pending payments
  const fetchPendingPayments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pending-payments');
      const data = await response.json();

      if (data.success) {
        setPayments(data.payments);
      } else {
        toast.error('Failed to fetch pending payments');
      }
    } catch (error) {
      console.error('Error fetching pending payments:', error);
      toast.error('Failed to fetch pending payments');
    } finally {
      setLoading(false);
    }
  };

  // Fetch payment history
  const fetchPaymentHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        page: historyPage.toString(),
        limit: '20',
      });
      
      if (historyStatusFilter !== 'all') {
        params.set('status', historyStatusFilter);
      }
      
      if (historyDateFrom) {
        params.set('dateFrom', historyDateFrom);
      }
      if (historyDateTo) {
        params.set('dateTo', historyDateTo);
      }
      if (historyMinAmount) {
        params.set('minAmount', historyMinAmount);
      }
      if (historyMaxAmount) {
        params.set('maxAmount', historyMaxAmount);
      }
      if (historyProviderFilter !== 'all') {
        params.set('provider', historyProviderFilter);
      }
      if (historyMethodFilter !== 'all') {
        params.set('paymentMethod', historyMethodFilter);
      }
      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await fetch(`/api/payment-history?${params}`);
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      setHistoryPayments(data.payments);
      setHistoryStats(data.stats);
      setHistoryTotalPages(data.pagination.pages);
      setHistoryTotal(data.pagination.total);
      setProviders(data.providers || []);
      setPaymentMethods(data.paymentMethods || []);
    } catch (error) {
      toast.error('Failed to load payment history');
      console.error(error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const completePayment = async (transactionId?: string) => {
    try {
      setProcessing(transactionId || 'latest');
      
      const response = await fetch('/api/complete-pending-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Payment completed successfully!');
        fetchPendingPayments();
        if (activeTab === 'history') {
          fetchPaymentHistory();
        }
      } else {
        toast.error(data.error || 'Failed to complete payment');
      }
    } catch (error) {
      console.error('Error completing payment:', error);
      toast.error('Failed to complete payment');
    } finally {
      setProcessing(null);
    }
  };

  const completeAllPayments = async () => {
    if (!confirm(`Complete all ${payments.length} pending payments?`)) {
      return;
    }

    for (const payment of payments) {
      await completePayment(payment._id);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  useEffect(() => {
    fetchPendingPayments();
    
    const interval = setInterval(fetchPendingPayments, 30000);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    if (activeTab === 'history') {
      fetchPaymentHistory();
    }
  }, [activeTab, historyStatusFilter, historyDateFrom, historyDateTo, historyMinAmount, historyMaxAmount, historyProviderFilter, historyMethodFilter, historyPage]);

  const handleHistorySearch = () => {
    setHistoryPage(1);
    fetchPaymentHistory();
  };

  const clearHistoryFilters = () => {
    setHistoryStatusFilter('all');
    setHistoryDateFrom('');
    setHistoryDateTo('');
    setHistoryMinAmount('');
    setHistoryMaxAmount('');
    setHistoryProviderFilter('all');
    setHistoryMethodFilter('all');
    setSearchQuery('');
    setHistoryPage(1);
  };

  const exportToCSV = () => {
    const headers = ['Date', 'User', 'Email', 'Credits', 'EUR Amount', 'Status', 'Provider', 'Payment Method', 'Payment Intent'];
    const rows = historyPayments.map(p => [
      new Date(p.createdAt).toISOString(),
      p.user?.name || 'Unknown',
      p.user?.email || 'N/A',
      p.amount.toFixed(2),
      (p.metadata?.totalCharged || p.metadata?.eurAmount || p.amount).toFixed(2),
      p.status,
      p.metadata?.paymentProvider || 'N/A',
      p.paymentMethod || 'N/A',
      p.paymentIntentId || 'N/A',
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeSince = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Render payment row (reused for both tabs)
  const renderPaymentRow = (payment: Payment, showActions: boolean = false) => (
    <div
      key={payment._id}
      className="p-4 hover:bg-gray-800/30 transition-colors border-b border-gray-700 last:border-0"
    >
      <div className="flex items-center justify-between gap-4">
        {/* User Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {payment.user?.image ? (
            <img
              src={payment.user.image}
              alt={payment.user.name || 'User'}
              className="w-10 h-10 rounded-full flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-blue-400" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-100 truncate">
              {payment.user?.name || 'Unknown User'}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {payment.user?.email || 'No email'}
            </p>
          </div>
        </div>

        {/* Amount */}
        <div className="text-right">
          <p className="text-lg font-bold text-yellow-400">
            +{payment.amount.toFixed(2)} Credits
          </p>
          <p className="text-xs text-gray-500">
            €{(payment.metadata?.totalCharged || payment.metadata?.eurAmount || payment.amount).toFixed(2)} charged
          </p>
        </div>

        {/* Status */}
        <Badge className={`${STATUS_COLORS[payment.status]} flex items-center gap-1`}>
          {STATUS_ICONS[payment.status]}
          <span className="capitalize">{payment.status}</span>
        </Badge>

        {/* Provider */}
        <div className="text-center w-24">
          <p className="text-xs text-gray-400">Provider</p>
          <p className="text-sm font-medium text-gray-200 capitalize">
            {payment.metadata?.paymentProvider || 'stripe'}
          </p>
        </div>

        {/* Date */}
        <div className="text-right w-32">
          <p className="text-xs text-gray-400">{getTimeSince(payment.createdAt)}</p>
          <p className="text-xs text-gray-500">{formatDate(payment.createdAt)}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDetailDialog({ open: true, payment })}
            className="text-gray-400 hover:text-white"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {showActions && payment.status === 'pending' && (
            <Button
              onClick={() => completePayment(payment._id)}
              disabled={processing !== null}
              size="sm"
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              {processing === payment._id ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-gray-700 pb-4">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'pending'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Pending Payments</span>
          {payments.length > 0 && (
            <Badge className="bg-amber-500/30 text-amber-200 ml-1">
              {payments.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'history'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Payment History</span>
        </button>
      </div>

      {/* Pending Tab */}
      {activeTab === 'pending' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-100">Pending Payments</h2>
              <p className="text-sm text-gray-400 mt-1">
                Manually process pending purchases when webhooks are unavailable
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={fetchPendingPayments}
                variant="outline"
                size="sm"
                disabled={loading}
                className="bg-gray-800 border-gray-700 hover:bg-gray-700"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {payments.length > 0 && (
                <Button
                  onClick={completeAllPayments}
                  variant="outline"
                  size="sm"
                  disabled={processing !== null}
                  className="bg-green-500/10 border-green-500/30 hover:bg-green-500/20 text-green-400"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete All ({payments.length})
                </Button>
              )}
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-blue-400">Manual Payment Processing</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Use this tool when Stripe webhooks are not set up or for testing in development.
                  In production, webhooks should automatically process payments.
                </p>
              </div>
            </div>
          </div>

          {/* Payments List */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-3" />
                <p className="text-sm text-gray-400">Loading pending payments...</p>
              </div>
            ) : payments.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
                <h3 className="text-lg font-semibold text-gray-100">No Pending Payments</h3>
                <p className="text-sm text-gray-400 mt-2">
                  All payments have been processed successfully!
                </p>
              </div>
            ) : (
              <div>
                {payments.map((payment) => renderPaymentRow(payment, true))}
              </div>
            )}
          </div>

          {/* Stats Footer */}
          {payments.length > 0 && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-100">{payments.length}</p>
                  <p className="text-xs text-gray-400 mt-1">Pending Payments</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-100">
                    €{payments.reduce((sum, p) => sum + (p.metadata?.totalCharged || p.metadata?.eurAmount || p.amount), 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Total Charged</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-400">
                    {payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Total Credits</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-100">Payment History</h2>
              <p className="text-sm text-gray-400 mt-1">
                View and filter all deposit transactions
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={fetchPaymentHistory}
                variant="outline"
                size="sm"
                disabled={historyLoading}
                className="bg-gray-800 border-gray-700 hover:bg-gray-700"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${historyLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={exportToCSV}
                variant="outline"
                size="sm"
                disabled={historyPayments.length === 0}
                className="bg-gray-800 border-gray-700 hover:bg-gray-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          {historyStats && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <span className="text-sm text-amber-400">Pending</span>
                </div>
                <p className="text-2xl font-bold text-white">{historyStats.pending.count}</p>
                <p className="text-xs text-gray-400">{historyStats.pending.totalAmount.toFixed(0)} Credits</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm text-emerald-400">Completed</span>
                </div>
                <p className="text-2xl font-bold text-white">{historyStats.completed.count}</p>
                <p className="text-xs text-gray-400">{historyStats.completed.totalAmount.toFixed(0)} Credits</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-red-400" />
                  <span className="text-sm text-red-400">Failed</span>
                </div>
                <p className="text-2xl font-bold text-white">{historyStats.failed.count}</p>
                <p className="text-xs text-gray-400">{historyStats.failed.totalAmount.toFixed(0)} Credits</p>
              </div>
              <div className="bg-gray-500/10 border border-gray-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Cancelled</span>
                </div>
                <p className="text-2xl font-bold text-white">{historyStats.cancelled.count}</p>
                <p className="text-xs text-gray-400">{historyStats.cancelled.totalAmount.toFixed(0)} Credits</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-300">Filters</span>
            </div>
            
            <div className="grid grid-cols-4 gap-4 mb-4">
              {/* Search */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Email, name, or payment ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleHistorySearch()}
                    className="pl-9 bg-gray-900 border-gray-700"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Status</Label>
                <Select value={historyStatusFilter} onValueChange={setHistoryStatusFilter}>
                  <SelectTrigger className="bg-gray-900 border-gray-700">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Provider */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Provider</Label>
                <Select value={historyProviderFilter} onValueChange={setHistoryProviderFilter}>
                  <SelectTrigger className="bg-gray-900 border-gray-700">
                    <SelectValue placeholder="All providers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    {providers.map(p => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                    {providers.length === 0 && (
                      <>
                        <SelectItem value="stripe">Stripe</SelectItem>
                        <SelectItem value="paddle">Paddle</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Payment Method</Label>
                <Select value={historyMethodFilter} onValueChange={setHistoryMethodFilter}>
                  <SelectTrigger className="bg-gray-900 border-gray-700">
                    <SelectValue placeholder="All methods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    {paymentMethods.map(m => (
                      <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                    ))}
                    {paymentMethods.length === 0 && (
                      <>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-4">
              {/* Date From */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Date From</Label>
                <Input
                  type="date"
                  value={historyDateFrom}
                  onChange={(e) => setHistoryDateFrom(e.target.value)}
                  className="bg-gray-900 border-gray-700"
                />
              </div>

              {/* Date To */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Date To</Label>
                <Input
                  type="date"
                  value={historyDateTo}
                  onChange={(e) => setHistoryDateTo(e.target.value)}
                  className="bg-gray-900 border-gray-700"
                />
              </div>

              {/* Min Amount */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Min Credits</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={historyMinAmount}
                  onChange={(e) => setHistoryMinAmount(e.target.value)}
                  className="bg-gray-900 border-gray-700"
                />
              </div>

              {/* Max Amount */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Max Credits</Label>
                <Input
                  type="number"
                  placeholder="999999"
                  value={historyMaxAmount}
                  onChange={(e) => setHistoryMaxAmount(e.target.value)}
                  className="bg-gray-900 border-gray-700"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">&nbsp;</Label>
                <div className="flex gap-2">
                  <Button
                    onClick={handleHistorySearch}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <Search className="h-4 w-4 mr-1" />
                    Search
                  </Button>
                  <Button
                    onClick={clearHistoryFilters}
                    variant="outline"
                    className="bg-gray-900 border-gray-700 hover:bg-gray-800"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
            {historyLoading ? (
              <div className="p-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-3" />
                <p className="text-sm text-gray-400">Loading payment history...</p>
              </div>
            ) : historyPayments.length === 0 ? (
              <div className="p-12 text-center">
                <Wallet className="h-12 w-12 mx-auto text-gray-500 mb-3" />
                <h3 className="text-lg font-semibold text-gray-100">No Payments Found</h3>
                <p className="text-sm text-gray-400 mt-2">
                  Try adjusting your filters or search query.
                </p>
              </div>
            ) : (
              <div>
                {historyPayments.map((payment) => renderPaymentRow(payment))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {historyTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Showing {((historyPage - 1) * 20) + 1} to {Math.min(historyPage * 20, historyTotal)} of {historyTotal} payments
              </p>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                  disabled={historyPage === 1}
                  variant="outline"
                  size="sm"
                  className="bg-gray-800 border-gray-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-400">
                  Page {historyPage} of {historyTotalPages}
                </span>
                <Button
                  onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))}
                  disabled={historyPage === historyTotalPages}
                  variant="outline"
                  size="sm"
                  className="bg-gray-800 border-gray-700"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => !open && setDetailDialog({ open: false, payment: null })}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-yellow-400" />
              Payment Details
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Complete payment information and breakdown
            </DialogDescription>
          </DialogHeader>

          {detailDialog.payment && (
            <div className="space-y-6 mt-4">
              {/* Status Banner */}
              <div className={`rounded-lg p-4 ${STATUS_COLORS[detailDialog.payment.status].replace('text-', 'bg-').replace('-300', '-500/10')}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {STATUS_ICONS[detailDialog.payment.status]}
                    <span className="text-lg font-semibold capitalize">{detailDialog.payment.status}</span>
                  </div>
                  <Badge className={STATUS_COLORS[detailDialog.payment.status]}>
                    {detailDialog.payment.metadata?.paymentProvider || 'stripe'}
                  </Badge>
                </div>
              </div>

              {/* User Info */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  User Information
                </h4>
                <div className="flex items-center gap-4">
                  {detailDialog.payment.user?.image ? (
                    <img
                      src={detailDialog.payment.user.image}
                      alt={detailDialog.payment.user.name || 'User'}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                      <User className="h-6 w-6 text-blue-400" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-white">
                      {detailDialog.payment.user?.name || 'Unknown User'}
                    </p>
                    <p className="text-sm text-gray-400">
                      {detailDialog.payment.user?.email || 'No email available'}
                    </p>
                    <p className="text-xs text-gray-500 font-mono mt-1">
                      ID: {detailDialog.payment.userId}
                    </p>
                  </div>
                </div>
              </div>

              {/* Amount Breakdown */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Amount Breakdown
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Credits Purchased:</span>
                    <span className="text-yellow-400 font-bold">{detailDialog.payment.amount.toFixed(2)} Credits</span>
                  </div>
                  {detailDialog.payment.metadata?.eurAmount && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Base Amount:</span>
                      <span className="text-white">€{detailDialog.payment.metadata.eurAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {detailDialog.payment.metadata?.vatAmount && detailDialog.payment.metadata.vatAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">VAT ({detailDialog.payment.metadata.vatPercentage || 0}%):</span>
                      <span className="text-orange-400">+€{detailDialog.payment.metadata.vatAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {detailDialog.payment.metadata?.platformFeeAmount && detailDialog.payment.metadata.platformFeeAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Platform Fee ({detailDialog.payment.metadata.platformDepositFeePercentage || 0}%):</span>
                      <span className="text-orange-400">+€{detailDialog.payment.metadata.platformFeeAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-700 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-white font-medium">Total Charged:</span>
                      <span className="text-white font-bold">
                        €{(detailDialog.payment.metadata?.totalCharged || detailDialog.payment.metadata?.eurAmount || detailDialog.payment.amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Details */}
              {(detailDialog.payment.metadata?.cardLast4 || detailDialog.payment.paymentMethod === 'card') && (
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Payment Method
                  </h4>
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-3 w-16 h-10 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium capitalize">
                        {detailDialog.payment.metadata?.cardBrand || 'Card'} •••• {detailDialog.payment.metadata?.cardLast4 || '****'}
                      </p>
                      {detailDialog.payment.metadata?.cardExpMonth && (
                        <p className="text-xs text-gray-400">
                          Expires {detailDialog.payment.metadata.cardExpMonth}/{detailDialog.payment.metadata.cardExpYear}
                          {detailDialog.payment.metadata.cardCountry && ` • ${detailDialog.payment.metadata.cardCountry}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Payment IDs */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Transaction References
                </h4>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Transaction ID:</span>
                    <code className="text-gray-300 bg-gray-800 px-2 py-1 rounded">{detailDialog.payment._id}</code>
                  </div>
                  {detailDialog.payment.paymentIntentId && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Payment Intent:</span>
                      <code className="text-gray-300 bg-gray-800 px-2 py-1 rounded truncate max-w-[300px]">
                        {detailDialog.payment.paymentIntentId}
                      </code>
                    </div>
                  )}
                  {detailDialog.payment.paymentId && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Payment ID:</span>
                      <code className="text-gray-300 bg-gray-800 px-2 py-1 rounded">{detailDialog.payment.paymentId}</code>
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamps */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Timestamps
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="text-sm text-white">{formatDate(detailDialog.payment.createdAt)}</p>
                  </div>
                  {detailDialog.payment.processedAt && (
                    <div>
                      <p className="text-xs text-gray-500">Processed</p>
                      <p className="text-sm text-white">{formatDate(detailDialog.payment.processedAt)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              {detailDialog.payment.description && (
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Description</h4>
                  <p className="text-sm text-white">{detailDialog.payment.description}</p>
                </div>
              )}

              {/* Failure Reason */}
              {detailDialog.payment.failureReason && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-red-400 mb-2">Failure Reason</h4>
                  <p className="text-sm text-red-300">{detailDialog.payment.failureReason}</p>
                </div>
              )}

              {/* Stripe Status Note */}
              {detailDialog.payment.stripeStatusNote && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-amber-400 mb-2">Note</h4>
                  <p className="text-sm text-amber-300">{detailDialog.payment.stripeStatusNote}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
