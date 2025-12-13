'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, AlertCircle, Clock, DollarSign, User } from 'lucide-react';
import { toast } from 'sonner';

interface PendingPayment {
  _id: string;
  userId: string;
  amount: number;
  currency: string;
  creditsAmount: number;
  status: string;
  transactionType: string;
  paymentIntentId?: string;
  paymentMethod?: string;
  createdAt: string;
  metadata?: {
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
  };
  user?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

export default function PendingPaymentsSection() {
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchPendingPayments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/pending-payments');
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

  const completePayment = async (transactionId?: string) => {
    try {
      setProcessing(transactionId || 'latest');
      
      const response = await fetch('/api/admin/complete-pending-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Payment completed successfully!');
        fetchPendingPayments(); // Refresh list
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
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  useEffect(() => {
    fetchPendingPayments();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchPendingPayments, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
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

  return (
    <div className="space-y-6">
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
          <div className="divide-y divide-gray-700">
            {payments.map((payment) => (
              <div
                key={payment._id}
                className="p-6 hover:bg-gray-800/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-6">
                  {/* Left Side - Payment Info */}
                  <div className="flex-1 space-y-4">
                    {/* Main Payment Amount */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/30">
                        <Clock className="h-6 w-6 text-yellow-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-gray-100">
                            {payment.currency} {(payment.metadata?.totalCharged || payment.metadata?.eurAmount || payment.amount).toFixed(2)}
                          </span>
                          <span className="text-sm text-gray-500">→</span>
                          <span className="text-2xl font-bold text-yellow-400">
                            {payment.amount.toFixed(2)} Credits
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-yellow-500 font-medium">
                            {getTimeSince(payment.createdAt)}
                          </span>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-500">
                            {formatDate(payment.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* User Information */}
                    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-start gap-3">
                        {payment.user?.image ? (
                          <img
                            src={payment.user.image}
                            alt={payment.user.name || 'User'}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                            <User className="h-5 w-5 text-blue-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-100">
                            {payment.user?.name || 'Unknown User'}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {payment.user?.email || 'No email available'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 font-mono break-all">
                            ID: {payment.userId}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Fee Breakdown - New format (fees charged to card) */}
                    {payment.metadata && (payment.metadata.vatAmount || payment.metadata.platformFeeAmount) && (
                      <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/30">
                        <p className="text-xs font-semibold text-blue-400 mb-2">Payment Breakdown</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between text-gray-400">
                            <span>Credits Value:</span>
                            <span className="text-gray-300">€{(payment.metadata.eurAmount || payment.amount).toFixed(2)}</span>
                          </div>
                          {payment.metadata.vatAmount && payment.metadata.vatAmount > 0 && (
                            <div className="flex justify-between text-gray-400">
                              <span>VAT ({payment.metadata.vatPercentage || 0}%):</span>
                              <span className="text-orange-400">+€{payment.metadata.vatAmount.toFixed(2)}</span>
                            </div>
                          )}
                          {payment.metadata.platformFeeAmount && payment.metadata.platformFeeAmount > 0 && (
                            <div className="flex justify-between text-gray-400">
                              <span>Platform Fee ({payment.metadata.platformDepositFeePercentage || 0}%):</span>
                              <span className="text-orange-400">+€{payment.metadata.platformFeeAmount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-semibold text-white pt-1 border-t border-blue-500/30">
                            <span>Total Charged:</span>
                            <span>€{(payment.metadata.totalCharged || payment.amount).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-semibold text-yellow-400">
                            <span>Credits Received:</span>
                            <span>{payment.amount.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Legacy Fee Breakdown (old deposits with deduction from credits) */}
                    {payment.metadata && payment.metadata.processingFeePercentage && payment.metadata.processingFeePercentage > 0 && !payment.metadata.totalCharged && (
                      <div className="bg-gray-500/10 rounded-lg p-3 border border-gray-500/30">
                        <p className="text-xs font-semibold text-gray-400 mb-2">Legacy Fee Breakdown</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between text-gray-400">
                            <span>Gross Credits:</span>
                            <span className="text-gray-300">{payment.metadata.grossCredits?.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-gray-400">
                            <span>Processing Fee ({payment.metadata.processingFeePercentage}%):</span>
                            <span className="text-red-400">-{payment.metadata.feeAmount?.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-semibold text-yellow-400 pt-1 border-t border-gray-500/30">
                            <span>Net Credits:</span>
                            <span>{payment.metadata.netCredits?.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Payment Details */}
                    <div className="grid grid-cols-2 gap-3">
                      {payment.paymentIntentId && (
                        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                          <p className="text-xs text-gray-500 mb-1">Payment Intent</p>
                          <code className="text-xs text-gray-300 break-all">
                            {payment.paymentIntentId}
                          </code>
                        </div>
                      )}
                      {payment.metadata?.paymentProvider && (
                        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                          <p className="text-xs text-gray-500 mb-1">Provider</p>
                          <p className="text-xs text-gray-300 font-semibold capitalize">
                            {payment.metadata.paymentProvider}
                          </p>
                        </div>
                      )}
                      {payment.paymentMethod && (
                        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                          <p className="text-xs text-gray-500 mb-1">Payment Method</p>
                          <p className="text-xs text-gray-300 font-semibold">
                            {payment.paymentMethod}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    onClick={() => completePayment(payment._id)}
                    disabled={processing !== null}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    {processing === payment._id ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Complete Payment
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
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
                {payments.reduce((sum, p) => sum + (p.metadata?.totalCharged || p.metadata?.eurAmount || p.amount), 0).toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Total Charged ({payments[0]?.currency})</p>
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
    </div>
  );
}

