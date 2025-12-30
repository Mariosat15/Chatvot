'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Wallet,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  User,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Loader2,
  Ban,
  PlayCircle,
  Eye,
  History,
  Filter,
  Download,
  Building2,
  CreditCard,
} from 'lucide-react';

interface WithdrawalRequest {
  _id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  amountCredits: number;
  amountEUR: number;
  platformFee: number;
  netAmountEUR: number;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected' | 'cancelled' | 'failed';
  payoutMethod: string;
  payoutId?: string;
  rejectionReason?: string;
  failureReason?: string;
  walletBalanceBefore: number;
  walletBalanceAfter: number;
  isSandbox: boolean;
  kycVerified: boolean;
  requestedAt: string;
  processedAt?: string;
  completedAt?: string;
  adminNote?: string;
  processedByEmail?: string;
  // Original card details (when using original_method)
  originalCardDetails?: {
    brand?: string;
    last4?: string;
    expMonth?: number;
    expYear?: number;
    country?: string;
  } | null;
  originalPaymentId?: string;
  originalPaymentMethod?: string;
  // Bank details for admin to process withdrawal
  userBankDetails?: {
    accountHolderName: string;
    iban: string;
    bankName?: string;
    swiftBic?: string;
    country: string;
    nickname?: string;
    currency?: string;
    ibanLast4?: string;
  } | null;
  // Company bank that processed this withdrawal
  companyBankUsed?: {
    bankId?: string;
    accountName?: string;
    accountHolderName?: string;
    bankName?: string;
    iban?: string;
    accountNumber?: string;
    country?: string;
    currency?: string;
  } | null;
}

interface WithdrawalStats {
  pending: { count: number; totalAmount: number };
  approved: { count: number; totalAmount: number };
  processing: { count: number; totalAmount: number };
  completed: { count: number; totalAmount: number };
  rejected: { count: number; totalAmount: number };
  cancelled: { count: number; totalAmount: number };
  failed: { count: number; totalAmount: number };
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  approved: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  processing: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
  cancelled: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  failed: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
};

// Admin bank account interface
interface AdminBankAccount {
  _id: string;
  accountName: string;
  accountHolderName: string;
  bankName: string;
  country: string;
  currency: string;
  iban?: string;
  accountNumber?: string;
  swiftBic?: string;
  isDefault: boolean;
}

type TabType = 'pending' | 'history';

export default function PendingWithdrawalsSection() {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [stats, setStats] = useState<WithdrawalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [sandboxFilter, setSandboxFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // History tab filters
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyMinAmount, setHistoryMinAmount] = useState('');
  const [historyMaxAmount, setHistoryMaxAmount] = useState('');
  const [historyCompanyBankFilter, setHistoryCompanyBankFilter] = useState('all');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyWithdrawals, setHistoryWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Admin bank accounts for withdrawal processing
  const [adminBankAccounts, setAdminBankAccounts] = useState<AdminBankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  
  // Action dialog state
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    withdrawal: WithdrawalRequest | null;
    action: string;
  }>({ open: false, withdrawal: null, action: '' });
  const [actionReason, setActionReason] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Detail dialog state
  const [detailDialog, setDetailDialog] = useState<{
    open: boolean;
    withdrawal: WithdrawalRequest | null;
  }>({ open: false, withdrawal: null });

  useEffect(() => {
    fetchWithdrawals();
    fetchAdminBankAccounts();
    clearSelection(); // Clear selection when filters change
  }, [statusFilter, sandboxFilter, page]);
  
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistoryWithdrawals();
    }
  }, [activeTab, historyStatusFilter, historyDateFrom, historyDateTo, historyMinAmount, historyMaxAmount, historyCompanyBankFilter, historyPage, sandboxFilter]);
  
  const fetchAdminBankAccounts = async () => {
    try {
      const response = await fetch('/api/admin-bank-accounts');
      if (response.ok) {
        const data = await response.json();
        setAdminBankAccounts(data.accounts || []);
        // Set default bank as selected
        const defaultBank = data.accounts?.find((b: AdminBankAccount) => b.isDefault);
        if (defaultBank) {
          setSelectedBankId(defaultBank._id);
        }
      }
    } catch (error) {
      console.error('Error fetching admin bank accounts:', error);
    }
  };

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: page.toString(),
        limit: '20',
      });
      if (sandboxFilter !== 'all') {
        params.set('sandbox', sandboxFilter);
      }

      const response = await fetch(`/api/withdrawals?${params}`);
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      setWithdrawals(data.withdrawals);
      setStats(data.stats);
      setTotalPages(data.pagination.pages);
      setTotal(data.pagination.total);
    } catch (error) {
      toast.error('Failed to load withdrawals');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchHistoryWithdrawals = async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        page: historyPage.toString(),
        limit: '20',
        historyMode: 'true', // Signal we want history (completed/rejected/etc)
      });
      
      // Status filter for history
      if (historyStatusFilter !== 'all') {
        params.set('status', historyStatusFilter);
      } else {
        // Default to history statuses
        params.set('status', 'completed,rejected,cancelled,failed');
      }
      
      if (sandboxFilter !== 'all') {
        params.set('sandbox', sandboxFilter);
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
      if (searchQuery) {
        params.set('search', searchQuery);
      }
      if (historyCompanyBankFilter && historyCompanyBankFilter !== 'all') {
        params.set('companyBankId', historyCompanyBankFilter);
      }

      const response = await fetch(`/api/withdrawals?${params}`);
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      setHistoryWithdrawals(data.withdrawals);
      setHistoryTotalPages(data.pagination.pages);
      setHistoryTotal(data.pagination.total);
    } catch (error) {
      toast.error('Failed to load withdrawal history');
      console.error(error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleAction = async () => {
    if (!actionDialog.withdrawal) return;

    setActionLoading(true);
    try {
      // Get selected bank details for completed withdrawals
      const selectedBank = actionDialog.action === 'completed' && selectedBankId
        ? adminBankAccounts.find(b => b._id === selectedBankId)
        : null;

      // Get all withdrawals to process (either single or bulk)
      const withdrawalsToProcess = selectedIds.size > 1 && selectedIds.has(actionDialog.withdrawal._id)
        ? getSelectedWithdrawals()
        : [actionDialog.withdrawal];

      let successCount = 0;
      let errorCount = 0;

      for (const withdrawal of withdrawalsToProcess) {
        try {
          const response = await fetch(`/api/withdrawals/${withdrawal._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: actionDialog.action,
              reason: actionReason,
              adminNote: actionNote,
              // Include company bank details when completing (send full details, backend will mask)
              companyBankUsed: selectedBank ? {
                bankId: selectedBank._id,
                accountName: selectedBank.accountName,
                accountHolderName: selectedBank.accountHolderName,
                bankName: selectedBank.bankName,
                iban: selectedBank.iban,
                accountNumber: selectedBank.accountNumber,
                country: selectedBank.country,
                currency: selectedBank.currency,
              } : undefined,
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            errorCount++;
            console.error(`Failed to process withdrawal ${withdrawal._id}:`, data.error);
          } else {
            successCount++;
          }
        } catch (err) {
          errorCount++;
          console.error(`Error processing withdrawal ${withdrawal._id}:`, err);
        }
      }

      // Show result
      if (errorCount === 0) {
        toast.success(
          withdrawalsToProcess.length === 1
            ? `Withdrawal ${actionDialog.action} successfully`
            : `${successCount} withdrawal(s) ${actionDialog.action} successfully`
        );
      } else if (successCount > 0) {
        toast.warning(`${successCount} succeeded, ${errorCount} failed`);
      } else {
        toast.error('Failed to process withdrawals');
      }

      setActionDialog({ open: false, withdrawal: null, action: '' });
      setActionReason('');
      setActionNote('');
      clearSelection(); // Clear selection after bulk action
      fetchWithdrawals();
      if (activeTab === 'history') {
        fetchHistoryWithdrawals();
      }
    } catch (error) {
      toast.error('Failed to process action');
      console.error(error);
    } finally {
      setActionLoading(false);
    }
  };

  const openActionDialog = (withdrawal: WithdrawalRequest, action: string) => {
    setActionDialog({ open: true, withdrawal, action });
    setActionReason('');
    setActionNote('');
  };

  // Selection handlers
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const currentList = activeTab === 'pending' ? filteredWithdrawals : filteredHistoryWithdrawals;
    if (selectedIds.size === currentList.length) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all
      setSelectedIds(new Set(currentList.map(w => w._id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Get selected withdrawals
  const getSelectedWithdrawals = (): WithdrawalRequest[] => {
    const currentList = activeTab === 'pending' ? filteredWithdrawals : filteredHistoryWithdrawals;
    return currentList.filter(w => selectedIds.has(w._id));
  };

  // Check if all selected have same status (for bulk actions)
  const getCommonStatus = (): string | null => {
    const selected = getSelectedWithdrawals();
    if (selected.length === 0) return null;
    const firstStatus = selected[0].status;
    return selected.every(w => w.status === firstStatus) ? firstStatus : null;
  };

  // Generate Reference ID from withdrawal ID (matches email format)
  const getRefId = (id: string) => id.slice(-8).toUpperCase();
  
  const filteredWithdrawals = searchQuery
    ? withdrawals.filter((w) => {
        const query = searchQuery.toLowerCase();
        const refId = getRefId(w._id).toLowerCase();
        return (
          w.userEmail.toLowerCase().includes(query) ||
          w.userId.toLowerCase().includes(query) ||
          w._id.toLowerCase().includes(query) ||
          refId.includes(query) ||
          `wd-${refId}`.includes(query) // Also match "WD-" prefix format
        );
      })
    : withdrawals;
    
  const filteredHistoryWithdrawals = searchQuery
    ? historyWithdrawals.filter((w) => {
        const query = searchQuery.toLowerCase();
        const refId = getRefId(w._id).toLowerCase();
        return (
          w.userEmail.toLowerCase().includes(query) ||
          w.userId.toLowerCase().includes(query) ||
          w._id.toLowerCase().includes(query) ||
          refId.includes(query) ||
          `wd-${refId}`.includes(query) // Also match "WD-" prefix format
        );
      })
    : historyWithdrawals;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };
  
  const resetHistoryFilters = () => {
    setHistoryStatusFilter('all');
    setHistoryDateFrom('');
    setHistoryDateTo('');
    setHistoryMinAmount('');
    setHistoryMaxAmount('');
    setHistoryCompanyBankFilter('all');
    setSearchQuery('');
    setHistoryPage(1);
  };

  // Render withdrawal row (shared between tabs)
  const renderWithdrawalRow = (withdrawal: WithdrawalRequest, showActions: boolean = true) => (
    <div
      key={withdrawal._id}
      className={`bg-gray-700/30 rounded-xl p-4 hover:bg-gray-700/50 transition-colors ${
        selectedIds.has(withdrawal._id) ? 'ring-2 ring-teal-500 bg-teal-500/10' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Checkbox for selection */}
        <div className="flex items-center pt-1">
          <input
            type="checkbox"
            checked={selectedIds.has(withdrawal._id)}
            onChange={() => toggleSelection(withdrawal._id)}
            className="h-5 w-5 rounded border-gray-600 bg-gray-700 text-teal-500 focus:ring-teal-500 focus:ring-offset-gray-800 cursor-pointer"
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Badge className={STATUS_COLORS[withdrawal.status]}>
              {withdrawal.status.toUpperCase()}
            </Badge>
            <span className="text-xs font-mono text-gray-400 bg-gray-800 px-2 py-0.5 rounded select-all" title="Reference ID - Click to copy">
              REF: {getRefId(withdrawal._id)}
            </span>
            {withdrawal.isSandbox && (
              <Badge className="bg-purple-500/20 text-purple-300">
                SANDBOX
              </Badge>
            )}
            {withdrawal.kycVerified && (
              <Badge className="bg-green-500/20 text-green-300">
                KYC ✓
              </Badge>
            )}
            {withdrawal.companyBankUsed && (
              <Badge className="bg-cyan-500/20 text-cyan-300 text-xs">
                <Building2 className="h-3 w-3 mr-1" />
                {withdrawal.companyBankUsed.accountName || withdrawal.companyBankUsed.bankName}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs">User</p>
              <p className="text-white font-medium truncate" title={withdrawal.userName}>
                {withdrawal.userName || 'Unknown'}
              </p>
              <p className="text-xs text-gray-400 truncate" title={withdrawal.userEmail}>
                {withdrawal.userEmail}
              </p>
              <p className="text-[10px] text-gray-500 font-mono truncate" title={withdrawal.userId}>
                ID: {withdrawal.userId.slice(0, 12)}...
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Amount</p>
              <p className="text-emerald-400 font-bold">
                €{withdrawal.amountEUR.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">
                Net: €{withdrawal.netAmountEUR.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Method</p>
              <p className="text-white flex items-center gap-1">
                {withdrawal.payoutMethod === 'original_method' ? (
                  <>
                    <CreditCard className="h-3 w-3 text-blue-400" />
                    <span>Card Refund</span>
                  </>
                ) : withdrawal.payoutMethod === 'bank_transfer' ? (
                  <>
                    <Building2 className="h-3 w-3 text-teal-400" />
                    <span>Bank Transfer</span>
                  </>
                ) : (
                  withdrawal.payoutMethod?.replace(/_/g, ' ')
                )}
              </p>
              {/* Show bank hint for bank transfers */}
              {withdrawal.payoutMethod === 'bank_transfer' && withdrawal.userBankDetails && (
                <p className="text-[10px] text-teal-400/70 truncate" title={withdrawal.userBankDetails.iban}>
                  IBAN: ...{withdrawal.userBankDetails.ibanLast4 || withdrawal.userBankDetails.iban?.slice(-4)}
                </p>
              )}
              {/* Show card hint for original method */}
              {withdrawal.payoutMethod === 'original_method' && withdrawal.originalCardDetails?.last4 && (
                <p className="text-[10px] text-blue-400/70">
                  Card: ****{withdrawal.originalCardDetails.last4}
                </p>
              )}
            </div>
            <div>
              <p className="text-gray-500 text-xs">Requested</p>
              <p className="text-white">
                {formatDate(withdrawal.requestedAt)}
              </p>
            </div>
            {withdrawal.completedAt && (
              <div>
                <p className="text-gray-500 text-xs">Completed</p>
                <p className="text-white">
                  {formatDate(withdrawal.completedAt)}
                </p>
              </div>
            )}
          </div>
          {withdrawal.rejectionReason && (
            <p className="text-sm text-red-400 mt-2">
              Reason: {withdrawal.rejectionReason}
            </p>
          )}
          {withdrawal.failureReason && (
            <p className="text-sm text-orange-400 mt-2">
              Failed: {withdrawal.failureReason}
            </p>
          )}
          {withdrawal.processedByEmail && (
            <p className="text-xs text-gray-500 mt-1">
              Processed by: {withdrawal.processedByEmail}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDetailDialog({ open: true, withdrawal })}
          >
            <Eye className="h-4 w-4 mr-1" />
            Details
          </Button>
          {showActions && (
            <>
              {withdrawal.status === 'pending' && (
                <>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => openActionDialog(withdrawal, 'approved')}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => openActionDialog(withdrawal, 'rejected')}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </>
              )}
              {withdrawal.status === 'approved' && (
                <Button
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => openActionDialog(withdrawal, 'processing')}
                >
                  <PlayCircle className="h-4 w-4 mr-1" />
                  Process
                </Button>
              )}
              {withdrawal.status === 'processing' && (
                <>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => openActionDialog(withdrawal, 'completed')}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Complete
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => openActionDialog(withdrawal, 'failed')}
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Failed
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-teal-500/50 rounded-2xl shadow-2xl shadow-teal-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-teal-500 to-cyan-500 p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
                <div className="relative h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-xl">
                  <Wallet className="h-8 w-8 text-teal-600" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                  💸 Withdrawal Management
                </h2>
                <p className="text-teal-100 mt-1">
                  Review, process, and track user withdrawal requests
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                fetchWithdrawals();
                if (activeTab === 'history') fetchHistoryWithdrawals();
              }}
              disabled={loading || historyLoading}
              className="bg-white/20 hover:bg-white/30 text-white"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(loading || historyLoading) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-gray-700">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-all flex items-center gap-2 ${
                activeTab === 'pending'
                  ? 'bg-gray-700 text-white border-b-2 border-teal-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <Clock className="h-4 w-4" />
              Pending Requests
              {stats && stats.pending.count + stats.approved.count + stats.processing.count > 0 && (
                <Badge className="bg-amber-500/20 text-amber-300 text-xs">
                  {stats.pending.count + stats.approved.count + stats.processing.count}
                </Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-all flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-gray-700 text-white border-b-2 border-teal-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <History className="h-4 w-4" />
              Withdrawal History
            </button>
          </div>
        </div>

        {/* Stats (only show for pending tab) */}
        {activeTab === 'pending' && stats && (
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {Object.entries(stats).map(([status, data]) => (
              <div
                key={status}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  statusFilter === status
                    ? 'ring-2 ring-teal-500'
                    : ''
                } ${STATUS_COLORS[status]}`}
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
              >
                <p className="text-xs uppercase font-medium opacity-70">{status}</p>
                <p className="text-2xl font-bold">{data.count}</p>
                <p className="text-xs opacity-70">€{data.totalAmount.toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      {activeTab === 'pending' ? (
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by email, user ID, or Reference ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40 bg-gray-800 border-gray-700">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sandboxFilter} onValueChange={(v) => { setSandboxFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40 bg-gray-800 border-gray-700">
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modes</SelectItem>
              <SelectItem value="false">Production</SelectItem>
              <SelectItem value="true">Sandbox</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        /* History Tab Filters */
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Filter className="h-5 w-5 text-teal-400" />
              Filter History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {/* Search */}
              <div className="lg:col-span-2">
                <Label className="text-gray-400 text-xs">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Email, user ID, or Reference ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-gray-700 border-gray-600"
                  />
                </div>
              </div>
              
              {/* Status Filter */}
              <div>
                <Label className="text-gray-400 text-xs">Status</Label>
                <Select value={historyStatusFilter} onValueChange={(v) => { setHistoryStatusFilter(v); setHistoryPage(1); }}>
                  <SelectTrigger className="mt-1 bg-gray-700 border-gray-600">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All History</SelectItem>
                    <SelectItem value="completed">✅ Completed</SelectItem>
                    <SelectItem value="rejected">❌ Rejected</SelectItem>
                    <SelectItem value="cancelled">🚫 Cancelled</SelectItem>
                    <SelectItem value="failed">⚠️ Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Mode Filter */}
              <div>
                <Label className="text-gray-400 text-xs">Mode</Label>
                <Select value={sandboxFilter} onValueChange={(v) => { setSandboxFilter(v); setHistoryPage(1); }}>
                  <SelectTrigger className="mt-1 bg-gray-700 border-gray-600">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modes</SelectItem>
                    <SelectItem value="false">Production</SelectItem>
                    <SelectItem value="true">Sandbox</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Date From */}
              <div>
                <Label className="text-gray-400 text-xs">From Date</Label>
                <Input
                  type="date"
                  value={historyDateFrom}
                  onChange={(e) => { setHistoryDateFrom(e.target.value); setHistoryPage(1); }}
                  className="mt-1 bg-gray-700 border-gray-600"
                />
              </div>
              
              {/* Date To */}
              <div>
                <Label className="text-gray-400 text-xs">To Date</Label>
                <Input
                  type="date"
                  value={historyDateTo}
                  onChange={(e) => { setHistoryDateTo(e.target.value); setHistoryPage(1); }}
                  className="mt-1 bg-gray-700 border-gray-600"
                />
              </div>
            </div>
            
            {/* Second row: Amount filters, company bank, and actions */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
              <div>
                <Label className="text-gray-400 text-xs">Min Amount (€)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={historyMinAmount}
                  onChange={(e) => { setHistoryMinAmount(e.target.value); setHistoryPage(1); }}
                  className="mt-1 bg-gray-700 border-gray-600"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Max Amount (€)</Label>
                <Input
                  type="number"
                  placeholder="No limit"
                  value={historyMaxAmount}
                  onChange={(e) => { setHistoryMaxAmount(e.target.value); setHistoryPage(1); }}
                  className="mt-1 bg-gray-700 border-gray-600"
                />
              </div>
              {/* Company Bank Filter */}
              <div>
                <Label className="text-gray-400 text-xs">Processed By Bank</Label>
                <Select value={historyCompanyBankFilter} onValueChange={(v) => { setHistoryCompanyBankFilter(v); setHistoryPage(1); }}>
                  <SelectTrigger className="mt-1 bg-gray-700 border-gray-600">
                    <SelectValue placeholder="All Banks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Banks</SelectItem>
                    {adminBankAccounts.map((bank) => (
                      <SelectItem key={bank._id} value={bank._id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3 w-3" />
                          <span>{bank.accountName}</span>
                          {bank.isDefault && <span className="text-emerald-400 text-xs">★</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={resetHistoryFilters}
                  className="w-full"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reset Filters
                </Button>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={fetchHistoryWithdrawals}
                  className="w-full bg-teal-600 hover:bg-teal-700"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Withdrawals List */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="space-y-4">
            <CardTitle className="text-white flex items-center justify-between">
              <span>
                {activeTab === 'pending' 
                  ? `Withdrawal Requests (${total})` 
                  : `Withdrawal History (${historyTotal})`
                }
              </span>
              {/* Pagination */}
              {(activeTab === 'pending' ? totalPages : historyTotalPages) > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => activeTab === 'pending' 
                      ? setPage((p) => Math.max(1, p - 1))
                      : setHistoryPage((p) => Math.max(1, p - 1))
                    }
                    disabled={activeTab === 'pending' ? page === 1 : historyPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-gray-400">
                    Page {activeTab === 'pending' ? page : historyPage} of {activeTab === 'pending' ? totalPages : historyTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => activeTab === 'pending'
                      ? setPage((p) => Math.min(totalPages, p + 1))
                      : setHistoryPage((p) => Math.min(historyTotalPages, p + 1))
                    }
                    disabled={activeTab === 'pending' ? page === totalPages : historyPage === historyTotalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardTitle>
            
            {/* Selection Controls & Bulk Actions */}
            {activeTab === 'pending' && (
              <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
                {/* Select All Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={filteredWithdrawals.length > 0 && selectedIds.size === filteredWithdrawals.length}
                    onChange={selectAll}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-teal-500 focus:ring-teal-500 focus:ring-offset-gray-800"
                  />
                  Select All
                </label>
                
                {/* Selected Count */}
                {selectedIds.size > 0 && (
                  <>
                    <div className="h-4 w-px bg-gray-600" />
                    <span className="text-sm text-teal-400 font-medium">
                      {selectedIds.size} selected
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      className="text-gray-400 hover:text-white h-7 px-2"
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                    
                    <div className="h-4 w-px bg-gray-600" />
                    
                    {/* Bulk Actions based on common status */}
                    {(() => {
                      const commonStatus = getCommonStatus();
                      const selected = getSelectedWithdrawals();
                      
                      if (!commonStatus || selected.length === 0) {
                        return (
                          <span className="text-xs text-amber-400">
                            Select withdrawals with same status for bulk actions
                          </span>
                        );
                      }
                      
                      return (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">Bulk Actions:</span>
                          {commonStatus === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
                                onClick={() => {
                                  // Process first selected
                                  if (selected.length > 0) {
                                    openActionDialog(selected[0], 'approved');
                                  }
                                }}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Approve ({selectedIds.size})
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-xs"
                                onClick={() => {
                                  if (selected.length > 0) {
                                    openActionDialog(selected[0], 'rejected');
                                  }
                                }}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject ({selectedIds.size})
                              </Button>
                            </>
                          )}
                          {commonStatus === 'approved' && (
                            <Button
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 h-7 text-xs"
                              onClick={() => {
                                if (selected.length > 0) {
                                  openActionDialog(selected[0], 'processing');
                                }
                              }}
                            >
                              <PlayCircle className="h-3 w-3 mr-1" />
                              Process ({selectedIds.size})
                            </Button>
                          )}
                          {commonStatus === 'processing' && (
                            <>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
                                onClick={() => {
                                  if (selected.length > 0) {
                                    openActionDialog(selected[0], 'completed');
                                  }
                                }}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Complete ({selectedIds.size})
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-xs"
                                onClick={() => {
                                  if (selected.length > 0) {
                                    openActionDialog(selected[0], 'failed');
                                  }
                                }}
                              >
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Failed ({selectedIds.size})
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {(activeTab === 'pending' ? loading : historyLoading) ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 text-teal-400 animate-spin" />
            </div>
          ) : (activeTab === 'pending' ? filteredWithdrawals : filteredHistoryWithdrawals).length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {activeTab === 'pending' 
                ? 'No withdrawal requests found' 
                : 'No withdrawal history matching filters'
              }
            </div>
          ) : (
            <div className="space-y-3">
              {(activeTab === 'pending' ? filteredWithdrawals : filteredHistoryWithdrawals).map((withdrawal) => 
                renderWithdrawalRow(withdrawal, activeTab === 'pending')
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, withdrawal: null, action: '' })}>
        <DialogContent className="bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              {actionDialog.action === 'approved' && '✅ Approve Withdrawal'}
              {actionDialog.action === 'rejected' && '❌ Reject Withdrawal'}
              {actionDialog.action === 'processing' && '⚡ Start Processing'}
              {actionDialog.action === 'completed' && '🎉 Mark as Completed'}
              {actionDialog.action === 'failed' && '⚠️ Mark as Failed'}
              {selectedIds.size > 1 && actionDialog.withdrawal && selectedIds.has(actionDialog.withdrawal._id) && (
                <Badge className="ml-2 bg-teal-500/20 text-teal-300">
                  Bulk: {selectedIds.size} selected
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.withdrawal && (
                <>
                  {selectedIds.size > 1 && selectedIds.has(actionDialog.withdrawal._id) ? (
                    <div className="space-y-1">
                      <span className="text-amber-300 font-medium">
                        Processing {selectedIds.size} withdrawals:
                      </span>
                      <div className="text-xs text-gray-400 max-h-24 overflow-y-auto">
                        {getSelectedWithdrawals().map(w => (
                          <div key={w._id}>• €{w.amountEUR.toFixed(2)} - {w.userEmail}</div>
                        ))}
                      </div>
                      <div className="text-sm text-white font-medium mt-2">
                        Total: €{getSelectedWithdrawals().reduce((sum, w) => sum + w.amountEUR, 0).toFixed(2)}
                      </div>
                    </div>
                  ) : (
                    <span>
                      €{actionDialog.withdrawal.amountEUR.toFixed(2)} for {actionDialog.withdrawal.userEmail}
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Bank selection for completed withdrawals */}
            {actionDialog.action === 'completed' && adminBankAccounts.length > 0 && (
              <div>
                <Label className="text-gray-300">Company Bank Account Used <span className="text-red-400">*</span></Label>
                <p className="text-xs text-gray-500 mb-2">Select which company bank account processed this withdrawal (required)</p>
                <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                  <SelectTrigger className={`bg-gray-700 border-gray-600 ${!selectedBankId ? 'border-red-500/50' : ''}`}>
                    <SelectValue placeholder="⚠️ Select bank account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {adminBankAccounts.map((bank) => (
                      <SelectItem key={bank._id} value={bank._id}>
                        <div className="flex items-center gap-2">
                          <span>{bank.accountName}</span>
                          <span className="text-gray-400 text-xs">({bank.bankName})</span>
                          {bank.isDefault && (
                            <span className="text-emerald-400 text-xs">★ Default</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {actionDialog.action === 'completed' && adminBankAccounts.length === 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-amber-300 text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  No company bank accounts configured
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Add bank accounts in Settings → Company Details to track which bank processed withdrawals.
                </p>
              </div>
            )}
            {(actionDialog.action === 'rejected' || actionDialog.action === 'failed') && (
              <div>
                <Label className="text-gray-300">Reason (required)</Label>
                <Textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Enter reason for rejection/failure..."
                  className="bg-gray-700 border-gray-600 mt-2"
                />
              </div>
            )}
            <div>
              <Label className="text-gray-300">Admin Note (optional)</Label>
              <Textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Internal note..."
                className="bg-gray-700 border-gray-600 mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog({ open: false, withdrawal: null, action: '' })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={
                actionLoading || 
                ((actionDialog.action === 'rejected' || actionDialog.action === 'failed') && !actionReason) ||
                (actionDialog.action === 'completed' && adminBankAccounts.length > 0 && !selectedBankId)
              }
              className={
                actionDialog.action === 'approved' || actionDialog.action === 'completed'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : actionDialog.action === 'rejected' || actionDialog.action === 'failed'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-purple-600 hover:bg-purple-700'
              }
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => !open && setDetailDialog({ open: false, withdrawal: null })}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Withdrawal Details</DialogTitle>
          </DialogHeader>
          {detailDialog.withdrawal && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Reference ID</p>
                  <p className="text-white font-mono text-sm select-all">{getRefId(detailDialog.withdrawal._id)}</p>
                  <p className="text-[10px] text-gray-500 font-mono mt-1 select-all" title="Full ID">{detailDialog.withdrawal._id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <Badge className={STATUS_COLORS[detailDialog.withdrawal.status]}>
                    {detailDialog.withdrawal.status.toUpperCase()}
                  </Badge>
                </div>
                
                {/* Enhanced User Information */}
                <div className="col-span-2 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-400 font-semibold mb-3 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    User Information
                  </p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Full Name</p>
                        <p className="text-white font-medium">{detailDialog.withdrawal.userName || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="text-white break-all">{detailDialog.withdrawal.userEmail}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">User ID</p>
                      <p className="text-white font-mono text-sm bg-gray-900/50 px-2 py-1 rounded select-all break-all">
                        {detailDialog.withdrawal.userId}
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Amount</p>
                  <p className="text-emerald-400 font-bold">€{detailDialog.withdrawal.amountEUR.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">{detailDialog.withdrawal.amountCredits} credits</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Platform Fee</p>
                  <p className="text-amber-400">€{detailDialog.withdrawal.platformFee.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Net Amount</p>
                  <p className="text-white font-bold">€{detailDialog.withdrawal.netAmountEUR.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Payout Method</p>
                  <p className="text-white">
                    {detailDialog.withdrawal.payoutMethod === 'original_method' 
                      ? '💳 Card Refund (Original Payment)'
                      : detailDialog.withdrawal.payoutMethod === 'bank_transfer'
                        ? '🏦 Bank Transfer'
                        : detailDialog.withdrawal.payoutMethod?.replace(/_/g, ' ') || 'Manual'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">KYC Status</p>
                  <p className={detailDialog.withdrawal.kycVerified ? 'text-green-400' : 'text-amber-400'}>
                    {detailDialog.withdrawal.kycVerified ? 'Verified ✓' : 'Not Verified'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Wallet Before</p>
                  <p className="text-white">{detailDialog.withdrawal.walletBalanceBefore} credits</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Wallet After</p>
                  <p className="text-white">{detailDialog.withdrawal.walletBalanceAfter} credits</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Requested At</p>
                  <p className="text-white">{formatDate(detailDialog.withdrawal.requestedAt)}</p>
                </div>
                {detailDialog.withdrawal.processedAt && (
                  <div>
                    <p className="text-xs text-gray-500">Processed At</p>
                    <p className="text-white">{formatDate(detailDialog.withdrawal.processedAt)}</p>
                  </div>
                )}
                {detailDialog.withdrawal.completedAt && (
                  <div>
                    <p className="text-xs text-gray-500">Completed At</p>
                    <p className="text-white">{formatDate(detailDialog.withdrawal.completedAt)}</p>
                  </div>
                )}
                {detailDialog.withdrawal.payoutId && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">Payout ID</p>
                    <p className="text-white font-mono text-sm">{detailDialog.withdrawal.payoutId}</p>
                  </div>
                )}
                
                {/* Company Bank Used Section - Enhanced */}
                {detailDialog.withdrawal.companyBankUsed && (
                  <div className="col-span-2 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
                    <p className="text-xs text-cyan-400 font-semibold mb-3 flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Company Bank Account Used for Payout
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {detailDialog.withdrawal.companyBankUsed.accountName && (
                        <div>
                          <p className="text-gray-500 text-xs">Account Name</p>
                          <p className="text-white font-medium">{detailDialog.withdrawal.companyBankUsed.accountName}</p>
                        </div>
                      )}
                      {detailDialog.withdrawal.companyBankUsed.accountHolderName && (
                        <div>
                          <p className="text-gray-500 text-xs">Account Holder</p>
                          <p className="text-white">{detailDialog.withdrawal.companyBankUsed.accountHolderName}</p>
                        </div>
                      )}
                      {detailDialog.withdrawal.companyBankUsed.bankName && (
                        <div>
                          <p className="text-gray-500 text-xs">Bank</p>
                          <p className="text-white">{detailDialog.withdrawal.companyBankUsed.bankName}</p>
                        </div>
                      )}
                      {detailDialog.withdrawal.companyBankUsed.country && (
                        <div>
                          <p className="text-gray-500 text-xs">Country</p>
                          <p className="text-white uppercase">{detailDialog.withdrawal.companyBankUsed.country}</p>
                        </div>
                      )}
                      {detailDialog.withdrawal.companyBankUsed.iban && (
                        <div>
                          <p className="text-gray-500 text-xs">IBAN</p>
                          <p className="text-cyan-300 font-mono">{detailDialog.withdrawal.companyBankUsed.iban}</p>
                        </div>
                      )}
                      {detailDialog.withdrawal.companyBankUsed.accountNumber && (
                        <div>
                          <p className="text-gray-500 text-xs">Account #</p>
                          <p className="text-cyan-300 font-mono">{detailDialog.withdrawal.companyBankUsed.accountNumber}</p>
                        </div>
                      )}
                      {detailDialog.withdrawal.companyBankUsed.currency && (
                        <div>
                          <p className="text-gray-500 text-xs">Currency</p>
                          <p className="text-white uppercase">{detailDialog.withdrawal.companyBankUsed.currency}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {detailDialog.withdrawal.rejectionReason && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">Rejection Reason</p>
                    <p className="text-red-400">{detailDialog.withdrawal.rejectionReason}</p>
                  </div>
                )}
                {detailDialog.withdrawal.failureReason && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">Failure Reason</p>
                    <p className="text-orange-400">{detailDialog.withdrawal.failureReason}</p>
                  </div>
                )}
                {detailDialog.withdrawal.adminNote && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">Admin Note</p>
                    <p className="text-gray-300">{detailDialog.withdrawal.adminNote}</p>
                  </div>
                )}
                {detailDialog.withdrawal.processedByEmail && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">Processed By</p>
                    <p className="text-gray-300">{detailDialog.withdrawal.processedByEmail}</p>
                  </div>
                )}
              </div>

              {/* Payment Method Details Section - Show ONLY the method user selected */}
              {detailDialog.withdrawal.payoutMethod === 'original_method' ? (
                // Card Refund - User chose to refund to original payment method
                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <h4 className="text-blue-300 font-semibold mb-3 flex items-center gap-2">
                    💳 Original Payment Method (Card Refund)
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {detailDialog.withdrawal.originalCardDetails ? (
                      <>
                        <div>
                          <p className="text-xs text-gray-500">Card Brand</p>
                          <p className="text-white font-medium capitalize">{detailDialog.withdrawal.originalCardDetails.brand || 'Card'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Card Number</p>
                          <p className="text-blue-300 font-mono font-bold">
                            •••• •••• •••• {detailDialog.withdrawal.originalCardDetails.last4 || '****'}
                          </p>
                        </div>
                        {detailDialog.withdrawal.originalCardDetails.expMonth && detailDialog.withdrawal.originalCardDetails.expYear && (
                          <div>
                            <p className="text-xs text-gray-500">Expiry</p>
                            <p className="text-white font-mono">
                              {String(detailDialog.withdrawal.originalCardDetails.expMonth).padStart(2, '0')}/{detailDialog.withdrawal.originalCardDetails.expYear}
                            </p>
                          </div>
                        )}
                        {detailDialog.withdrawal.originalCardDetails.country && (
                          <div>
                            <p className="text-xs text-gray-500">Card Country</p>
                            <p className="text-white uppercase">{detailDialog.withdrawal.originalCardDetails.country}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="col-span-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <p className="text-amber-300 text-sm flex items-center gap-2">
                          ⚠️ Card details not stored (old deposit)
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Look up the payment in Stripe using the Payment ID below to find the card used.
                        </p>
                      </div>
                    )}
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Original Payment ID</p>
                      <p className="text-white font-mono text-xs select-all">
                        {detailDialog.withdrawal.originalPaymentId || detailDialog.withdrawal.originalPaymentMethod || 'Look up in Stripe Dashboard'}
                      </p>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-blue-500/20">
                      <p className="text-xs text-gray-500">Amount to Refund</p>
                      <p className="text-emerald-400 font-bold text-xl">
                        €{detailDialog.withdrawal.netAmountEUR.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  {detailDialog.withdrawal.status !== 'completed' && (
                    <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                      <p className="text-xs text-gray-400">
                        📋 <strong>To process this withdrawal:</strong>
                      </p>
                      <ol className="text-xs text-gray-400 mt-1 space-y-1">
                        <li>1. Log into your payment provider dashboard (Stripe, etc.)</li>
                        <li>2. Find the original payment: <span className="font-mono text-blue-300 select-all">{detailDialog.withdrawal.originalPaymentId || 'Search by user email'}</span></li>
                        <li>3. Issue a refund of €{detailDialog.withdrawal.netAmountEUR.toFixed(2)} to the card</li>
                        <li>4. Use reference: <span className="font-mono text-blue-300 select-all">WD-{detailDialog.withdrawal._id.slice(-12).toUpperCase()}</span></li>
                        <li>5. Mark this withdrawal as &quot;Completed&quot;</li>
                      </ol>
                    </div>
                  )}
                </div>
              ) : detailDialog.withdrawal.payoutMethod === 'bank_transfer' && detailDialog.withdrawal.userBankDetails ? (
                // Bank Transfer - User chose bank transfer with their bank details
                <div className="mt-6 p-4 bg-teal-500/10 border border-teal-500/30 rounded-xl">
                  <h4 className="text-teal-300 font-semibold mb-3 flex items-center gap-2">
                    🏦 User Bank Details for Transfer
                    {detailDialog.withdrawal.userBankDetails.nickname && (
                      <span className="text-xs text-gray-400 font-normal">
                        ({detailDialog.withdrawal.userBankDetails.nickname})
                      </span>
                    )}
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Account Holder</p>
                      <p className="text-white font-medium">{detailDialog.withdrawal.userBankDetails.accountHolderName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">IBAN</p>
                      <p className="text-teal-300 font-mono font-bold select-all">
                        {detailDialog.withdrawal.userBankDetails.iban}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Country</p>
                      <p className="text-white">{detailDialog.withdrawal.userBankDetails.country}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Currency</p>
                      <p className="text-white uppercase">{detailDialog.withdrawal.userBankDetails.currency || 'EUR'}</p>
                    </div>
                    {detailDialog.withdrawal.userBankDetails.bankName && (
                      <div>
                        <p className="text-xs text-gray-500">Bank Name</p>
                        <p className="text-white">{detailDialog.withdrawal.userBankDetails.bankName}</p>
                      </div>
                    )}
                    {detailDialog.withdrawal.userBankDetails.swiftBic && (
                      <div>
                        <p className="text-xs text-gray-500">BIC/SWIFT Code</p>
                        <p className="text-white font-mono">{detailDialog.withdrawal.userBankDetails.swiftBic}</p>
                      </div>
                    )}
                    <div className="col-span-2 pt-2 border-t border-teal-500/20">
                      <p className="text-xs text-gray-500">Amount to Transfer</p>
                      <p className="text-emerald-400 font-bold text-xl">
                        €{detailDialog.withdrawal.netAmountEUR.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  {detailDialog.withdrawal.status !== 'completed' && (
                    <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                      <p className="text-xs text-gray-400">
                        📋 <strong>To process this withdrawal:</strong>
                      </p>
                      <ol className="text-xs text-gray-400 mt-1 space-y-1">
                        <li>1. Log into your company bank account</li>
                        <li>2. Transfer €{detailDialog.withdrawal.netAmountEUR.toFixed(2)} to the IBAN above</li>
                        <li>3. Use reference: <span className="font-mono text-teal-300 select-all">WD-{detailDialog.withdrawal._id.slice(-12).toUpperCase()}</span></li>
                        <li>4. Mark this withdrawal as &quot;Completed&quot;</li>
                      </ol>
                    </div>
                  )}
                </div>
              ) : detailDialog.withdrawal.status !== 'completed' && detailDialog.withdrawal.status !== 'rejected' && (
                // No payment method details available
                <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <p className="text-amber-300 text-sm flex items-center gap-2">
                    ⚠️ Payment method details unavailable
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Method: {detailDialog.withdrawal.payoutMethod?.replace(/_/g, ' ') || 'Unknown'}
                    <br />
                    Contact the user to verify their withdrawal details before processing.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
