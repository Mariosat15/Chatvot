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
    bankName?: string;
    iban?: string;
    accountNumber?: string;
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

export default function PendingWithdrawalsSection() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [stats, setStats] = useState<WithdrawalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [sandboxFilter, setSandboxFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
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
  }, [statusFilter, sandboxFilter, page]);
  
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

  const handleAction = async () => {
    if (!actionDialog.withdrawal) return;

    setActionLoading(true);
    try {
      // Get selected bank details for completed withdrawals
      const selectedBank = actionDialog.action === 'completed' && selectedBankId
        ? adminBankAccounts.find(b => b._id === selectedBankId)
        : null;

      const response = await fetch(`/api/withdrawals/${actionDialog.withdrawal._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionDialog.action,
          reason: actionReason,
          adminNote: actionNote,
          // Include company bank details when completing
          companyBankUsed: selectedBank ? {
            bankId: selectedBank._id,
            accountName: selectedBank.accountName,
            bankName: selectedBank.bankName,
            iban: selectedBank.iban,
            accountNumber: selectedBank.accountNumber,
          } : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Action failed');
        return;
      }

      toast.success(`Withdrawal ${actionDialog.action} successfully`);
      setActionDialog({ open: false, withdrawal: null, action: '' });
      setActionReason('');
      setActionNote('');
      fetchWithdrawals();
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

  const filteredWithdrawals = searchQuery
    ? withdrawals.filter(
        (w) =>
          w.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
          w.userId.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : withdrawals;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

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
                  💸 Withdrawal Requests
                </h2>
                <p className="text-teal-100 mt-1">
                  Review and process user withdrawal requests
                </p>
              </div>
            </div>
            <Button
              onClick={fetchWithdrawals}
              disabled={loading}
              className="bg-white/20 hover:bg-white/30 text-white"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
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
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by email or user ID..."
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

      {/* Withdrawals List */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span>Withdrawal Requests ({total})</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 text-teal-400 animate-spin" />
            </div>
          ) : filteredWithdrawals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No withdrawal requests found
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWithdrawals.map((withdrawal) => (
                <div
                  key={withdrawal._id}
                  className="bg-gray-700/30 rounded-xl p-4 hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={STATUS_COLORS[withdrawal.status]}>
                          {withdrawal.status.toUpperCase()}
                        </Badge>
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
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs">User</p>
                          <p className="text-white font-medium truncate">
                            {withdrawal.userEmail}
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
                          <p className="text-white">
                            {withdrawal.payoutMethod.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Requested</p>
                          <p className="text-white">
                            {formatDate(withdrawal.requestedAt)}
                          </p>
                        </div>
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
                    </div>
                  </div>
                </div>
              ))}
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
            </DialogTitle>
            <DialogDescription>
              {actionDialog.withdrawal && (
                <span>
                  €{actionDialog.withdrawal.amountEUR.toFixed(2)} for {actionDialog.withdrawal.userEmail}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Bank selection for completed withdrawals */}
            {actionDialog.action === 'completed' && adminBankAccounts.length > 0 && (
              <div>
                <Label className="text-gray-300">Company Bank Account Used</Label>
                <p className="text-xs text-gray-500 mb-2">Select which company bank account processed this withdrawal</p>
                <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                  <SelectTrigger className="bg-gray-700 border-gray-600">
                    <SelectValue placeholder="Select bank account..." />
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
              disabled={actionLoading || ((actionDialog.action === 'rejected' || actionDialog.action === 'failed') && !actionReason)}
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
        <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Withdrawal Details</DialogTitle>
          </DialogHeader>
          {detailDialog.withdrawal && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">ID</p>
                  <p className="text-white font-mono text-sm">{detailDialog.withdrawal._id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <Badge className={STATUS_COLORS[detailDialog.withdrawal.status]}>
                    {detailDialog.withdrawal.status.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500">User</p>
                  <p className="text-white">{detailDialog.withdrawal.userEmail}</p>
                  <p className="text-xs text-gray-500">{detailDialog.withdrawal.userId}</p>
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
                {detailDialog.withdrawal.companyBankUsed && (
                  <div className="col-span-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <p className="text-xs text-emerald-400 font-semibold mb-2">🏦 Company Bank Used</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs">Account</p>
                        <p className="text-white">{detailDialog.withdrawal.companyBankUsed.accountName}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Bank</p>
                        <p className="text-white">{detailDialog.withdrawal.companyBankUsed.bankName}</p>
                      </div>
                      {detailDialog.withdrawal.companyBankUsed.iban && (
                        <div>
                          <p className="text-gray-500 text-xs">IBAN</p>
                          <p className="text-white font-mono">{detailDialog.withdrawal.companyBankUsed.iban}</p>
                        </div>
                      )}
                      {detailDialog.withdrawal.companyBankUsed.accountNumber && (
                        <div>
                          <p className="text-gray-500 text-xs">Account #</p>
                          <p className="text-white font-mono">{detailDialog.withdrawal.companyBankUsed.accountNumber}</p>
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

              {/* Payment Method Details Section */}
              {/* Determine if this should show card or bank based on payoutMethod */}
              {(() => {
                const isCardWithdrawal = 
                  detailDialog.withdrawal.payoutMethod === 'original_method' ||
                  detailDialog.withdrawal.payoutMethod?.includes('card') ||
                  detailDialog.withdrawal.payoutMethod?.includes('refund');
                const hasBankDetails = !!detailDialog.withdrawal.userBankDetails;
                const hasCardDetails = !!detailDialog.withdrawal.originalCardDetails;
                
                // Show card section if explicitly original_method, OR if no bank but has card
                return (isCardWithdrawal || (!hasBankDetails && hasCardDetails));
              })() ? (
                // Original Payment Method (Card Refund)
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
                </div>
              ) : detailDialog.withdrawal.userBankDetails ? (
                // Bank Transfer
                <div className="mt-6 p-4 bg-teal-500/10 border border-teal-500/30 rounded-xl">
                  <h4 className="text-teal-300 font-semibold mb-3 flex items-center gap-2">
                    🏦 Bank Details for Transfer
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
                </div>
              ) : detailDialog.withdrawal.status !== 'completed' && detailDialog.withdrawal.status !== 'rejected' && (
                <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-300 text-sm flex items-center gap-2">
                    ⚠️ No payment method on file for this withdrawal
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Contact the user to verify their withdrawal method details before processing.
                  </p>
                </div>
              )}

              {/* Original Deposit Card Info - Always show if available (for reference) */}
              {detailDialog.withdrawal.payoutMethod !== 'original_method' && detailDialog.withdrawal.originalCardDetails && (
                <div className="mt-4 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <h5 className="text-gray-400 text-xs font-semibold mb-2 flex items-center gap-1">
                    💳 Original Deposit Card (Reference)
                  </h5>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-white capitalize">{detailDialog.withdrawal.originalCardDetails.brand || 'Card'}</span>
                    <span className="text-blue-300 font-mono">•••• {detailDialog.withdrawal.originalCardDetails.last4 || '****'}</span>
                    {detailDialog.withdrawal.originalCardDetails.expMonth && detailDialog.withdrawal.originalCardDetails.expYear && (
                      <span className="text-gray-500 text-xs">
                        Exp: {String(detailDialog.withdrawal.originalCardDetails.expMonth).padStart(2, '0')}/{detailDialog.withdrawal.originalCardDetails.expYear}
                      </span>
                    )}
                  </div>
                  {detailDialog.withdrawal.originalPaymentId && (
                    <p className="text-xs text-gray-500 mt-1">
                      Payment ID: <span className="font-mono text-gray-400 select-all">{detailDialog.withdrawal.originalPaymentId}</span>
                    </p>
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

