'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCcw,
  CreditCard,
  User,
  Calendar,
  DollarSign,
  Shield,
  Loader2,
  Eye,
  CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FailedDeposit {
  _id: string;
  userId: string;
  amount: number;
  status: 'failed' | 'pending' | 'cancelled';
  provider?: string;
  providerTransactionId?: string;
  paymentMethod?: string;
  failureReason?: string;
  description: string;
  createdAt: string;
  metadata?: {
    eurAmount?: number;
    baseAmount?: number;
    vatAmount?: number;
    platformFeeAmount?: number;
    manuallyResolved?: boolean;
    manualResolutionAt?: string;
    resolvedByAdmin?: string;
    cardLast4?: string;
  };
  user: {
    name?: string;
    email?: string;
  };
}

interface Stats {
  failed: number;
  pending: number;
  unresolvedFailed: number;
}

export default function FailedDepositsSection() {
  const [deposits, setDeposits] = useState<FailedDeposit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'needs_review' | 'failed' | 'pending' | 'all'>('needs_review');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Manual credit dialog
  const [selectedDeposit, setSelectedDeposit] = useState<FailedDeposit | null>(null);
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [creditReason, setCreditReason] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchDeposits = async () => {
    try {
      const response = await fetch(
        `/api/deposits/failed?status=${statusFilter}&page=${page}&limit=20`
      );
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setDeposits(data.transactions);
      setStats(data.stats);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching deposits:', error);
      toast.error('Failed to load failed deposits');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeposits();
  }, [statusFilter, page]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDeposits();
  };

  const openCreditDialog = (deposit: FailedDeposit) => {
    setSelectedDeposit(deposit);
    setCreditReason('');
    setVerificationNotes('');
    setShowCreditDialog(true);
  };

  const handleManualCredit = async () => {
    if (!selectedDeposit) return;
    
    if (creditReason.trim().length < 10) {
      toast.error('Please provide a detailed reason (min 10 characters)');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`/api/deposits/${selectedDeposit._id}/manual-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: creditReason,
          verificationNotes,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to process');
      }

      const result = await response.json();
      toast.success(`Successfully credited ${result.data.creditsAdded} credits to user`);
      setShowCreditDialog(false);
      fetchDeposits();
    } catch (error) {
      console.error('Error processing manual credit:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process manual credit');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string, manuallyResolved?: boolean) => {
    if (manuallyResolved) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          <CheckCheck className="h-3 w-3 mr-1" />
          Manually Resolved
        </Badge>
      );
    }
    
    switch (status) {
      case 'failed':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading failed deposits...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Failed Deposits Review</h2>
          <p className="text-gray-400">
            Review and manually credit users for failed deposits that may have actually been paid
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="border-gray-600"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Needs Review</p>
                  <p className="text-2xl font-bold text-red-400">{stats.unresolvedFailed}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Pending</p>
                  <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-500/10 border-gray-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Failed</p>
                  <p className="text-2xl font-bold text-gray-400">{stats.failed}</p>
                </div>
                <XCircle className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={(v: typeof statusFilter) => setStatusFilter(v)}>
          <SelectTrigger className="w-48 bg-gray-800 border-gray-700">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="needs_review">Needs Review</SelectItem>
            <SelectItem value="failed">All Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Deposits List */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg">Deposits</CardTitle>
          <CardDescription>
            {statusFilter === 'needs_review'
              ? 'Failed deposits that may need manual review and credit'
              : `Showing ${statusFilter} deposits`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deposits.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <p className="text-gray-400">No deposits to review</p>
            </div>
          ) : (
            <div className="space-y-4">
              {deposits.map((deposit) => (
                <div
                  key={deposit._id}
                  className={cn(
                    'border rounded-lg p-4 transition-all',
                    deposit.metadata?.manuallyResolved
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-gray-700 bg-gray-800/50'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      {/* User Info */}
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-white font-medium">
                          {deposit.user?.name || 'Unknown'}
                        </span>
                        <span className="text-gray-500">
                          ({deposit.user?.email || 'No email'})
                        </span>
                      </div>
                      
                      {/* Amount */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-green-400" />
                          <span className="text-lg font-bold text-white">
                            €{(deposit.metadata?.eurAmount || deposit.metadata?.baseAmount || 0).toFixed(2)}
                          </span>
                          <span className="text-gray-400">
                            ({deposit.amount} credits)
                          </span>
                        </div>
                        {getStatusBadge(deposit.status, deposit.metadata?.manuallyResolved)}
                      </div>
                      
                      {/* Details */}
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          {deposit.provider || 'Unknown'} 
                          {deposit.metadata?.cardLast4 && ` •••• ${deposit.metadata.cardLast4}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(deposit.createdAt).toLocaleString()}
                        </span>
                      </div>
                      
                      {/* Failure Reason */}
                      {deposit.failureReason && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded p-2 mt-2">
                          <p className="text-sm text-red-400">
                            <AlertTriangle className="h-3 w-3 inline mr-1" />
                            {deposit.failureReason}
                          </p>
                        </div>
                      )}
                      
                      {/* Manual Resolution Info */}
                      {deposit.metadata?.manuallyResolved && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded p-2 mt-2">
                          <p className="text-sm text-green-400">
                            <CheckCircle2 className="h-3 w-3 inline mr-1" />
                            Resolved by {deposit.metadata.resolvedByAdmin} on{' '}
                            {deposit.metadata.manualResolutionAt
                              ? new Date(deposit.metadata.manualResolutionAt).toLocaleString()
                              : 'Unknown'}
                          </p>
                        </div>
                      )}
                      
                      {/* Transaction ID */}
                      <p className="text-xs text-gray-500 font-mono">
                        ID: {deposit._id}
                        {deposit.providerTransactionId && (
                          <> | Provider: {deposit.providerTransactionId}</>
                        )}
                      </p>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      {!deposit.metadata?.manuallyResolved && deposit.status === 'failed' && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => openCreditDialog(deposit)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Manual Credit
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-600"
                        onClick={() => {
                          // Could open a detail view
                          console.log('View details', deposit);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-gray-400">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Credit Dialog */}
      <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-400" />
              Manual Deposit Credit
            </DialogTitle>
            <DialogDescription>
              Credit the user for a failed deposit after verifying the payment was received
            </DialogDescription>
          </DialogHeader>
          
          {selectedDeposit && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-800 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">User</span>
                  <span className="text-white">
                    {selectedDeposit.user?.name || selectedDeposit.user?.email}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount</span>
                  <span className="text-green-400 font-bold">
                    €{(selectedDeposit.metadata?.eurAmount || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Credits to Add</span>
                  <span className="text-white font-bold">
                    {Math.abs(selectedDeposit.amount)} credits
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Provider</span>
                  <span className="text-white">{selectedDeposit.provider || 'Unknown'}</span>
                </div>
              </div>
              
              {/* Warning */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-sm text-yellow-400">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Make sure you have verified that the payment was actually received before crediting the user.
                </p>
              </div>
              
              {/* Reason */}
              <div className="space-y-2">
                <Label className="text-gray-300">
                  Reason for Manual Credit <span className="text-red-400">*</span>
                </Label>
                <Textarea
                  placeholder="e.g., Verified payment received via Nuvei dashboard, transaction ID: XXX. User payment was successful but webhook failed."
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  className="bg-gray-800 border-gray-700 min-h-[100px]"
                />
                <p className="text-xs text-gray-500">Min 10 characters required</p>
              </div>
              
              {/* Verification Notes */}
              <div className="space-y-2">
                <Label className="text-gray-300">Verification Notes (optional)</Label>
                <Input
                  placeholder="e.g., Checked Nuvei dashboard, confirmed with support"
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreditDialog(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleManualCredit}
              disabled={processing || creditReason.trim().length < 10}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Credit User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

