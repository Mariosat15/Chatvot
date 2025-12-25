'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Loader2,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface KYCStatus {
  enabled: boolean;
  required: boolean;
  requiredForWithdrawal: boolean;
  requiredForDeposit: boolean;
  requiredAmount: number;
  userStatus: {
    verified: boolean;
    status: 'none' | 'pending' | 'approved' | 'declined' | 'expired' | 'abandoned';
    verifiedAt?: string;
    expiresAt?: string;
    attempts: number;
    maxAttempts: number;
  };
  latestSession?: {
    id: string;
    status: string;
    createdAt: string;
    completedAt?: string;
  };
  messages: {
    required: string;
    pending: string;
    approved: string;
    declined: string;
  };
}

// Helper to check if session is stale (older than 5 minutes - allows quick retry if interrupted)
const isSessionStale = (createdAt: string): boolean => {
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() - new Date(createdAt).getTime() > fiveMinutes;
};

const STATUS_CONFIG = {
  none: { 
    color: 'bg-gray-500', 
    icon: Shield, 
    label: 'Not Verified',
    textColor: 'text-gray-400' 
  },
  pending: { 
    color: 'bg-yellow-500', 
    icon: Clock, 
    label: 'Pending',
    textColor: 'text-yellow-400' 
  },
  approved: { 
    color: 'bg-green-500', 
    icon: CheckCircle, 
    label: 'Verified',
    textColor: 'text-green-400' 
  },
  declined: { 
    color: 'bg-red-500', 
    icon: XCircle, 
    label: 'Declined',
    textColor: 'text-red-400' 
  },
  expired: { 
    color: 'bg-orange-500', 
    icon: AlertTriangle, 
    label: 'Expired',
    textColor: 'text-orange-400' 
  },
  abandoned: { 
    color: 'bg-gray-500', 
    icon: XCircle, 
    label: 'Interrupted',
    textColor: 'text-gray-400' 
  },
};

interface KYCVerificationProps {
  onVerificationComplete?: () => void;
  compact?: boolean;
}

export default function KYCVerification({ onVerificationComplete, compact = false }: KYCVerificationProps) {
  const [status, setStatus] = useState<KYCStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(false);

  const fetchStatus = async (showToast = false) => {
    if (showToast) setChecking(true);
    try {
      const response = await fetch('/api/kyc/status', { cache: 'no-store' });
      const data = await response.json();
      if (data.enabled !== undefined) {
        const oldStatus = status?.userStatus?.status;
        setStatus(data);
        
        // Show toast if status changed or if manually checking
        if (showToast) {
          if (data.userStatus.status !== oldStatus && data.userStatus.status !== 'pending') {
            if (data.userStatus.status === 'approved') {
              toast.success('🎉 Your identity has been verified!');
              onVerificationComplete?.();
            } else if (data.userStatus.status === 'declined') {
              toast.error('Your verification was declined. You may retry.');
            } else if (data.userStatus.status === 'expired') {
              toast.warning('Your verification session expired. Please try again.');
            }
          } else if (data.userStatus.status === 'pending') {
            toast.info('Still processing... Please check again in a few minutes.');
          } else {
            toast.success('Status refreshed');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching KYC status:', error);
      if (showToast) toast.error('Failed to check status');
    } finally {
      setLoading(false);
      setChecking(false);
    }
  };

  useEffect(() => {
    fetchStatus(false);
    
    // Poll for status updates while pending
    const interval = setInterval(() => {
      if (status?.userStatus?.status === 'pending') {
        fetchStatus(false);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [status?.userStatus?.status]);

  const startVerification = async () => {
    setStarting(true);
    try {
      const response = await fetch('/api/kyc/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (data.sessionUrl) {
        // Open Veriff in a new window
        window.open(data.sessionUrl, '_blank', 'width=500,height=700');
        toast.success('Verification started! Complete the process in the new window.');
        
        // Start polling for updates
        fetchStatus(false);
      } else {
        toast.error(data.error || 'Failed to start verification');
      }
    } catch (error) {
      console.error('Error starting verification:', error);
      toast.error('Failed to start verification');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="flex items-center justify-center h-32">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  if (!status || !status.enabled) {
    return null; // KYC is disabled
  }

  const userStatus = status.userStatus;
  const statusConfig = STATUS_CONFIG[userStatus.status];
  const StatusIcon = statusConfig.icon;

  // Compact view for embedding in other components
  if (compact) {
    return (
      <div className="flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
        <div className="flex items-center gap-3">
          <div className={`p-2 ${statusConfig.color}/20 rounded-lg`}>
            <StatusIcon className={`h-5 w-5 ${statusConfig.textColor}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Identity Verification</p>
            <Badge variant="secondary" className={`${statusConfig.color} text-white mt-1`}>
              {statusConfig.label}
            </Badge>
          </div>
        </div>
        {(() => {
          const canRetry = userStatus.status === 'none' || 
                           userStatus.status === 'declined' || 
                           userStatus.status === 'expired' ||
                           userStatus.status === 'abandoned' ||
                           (userStatus.status === 'pending' && status.latestSession && isSessionStale(status.latestSession.createdAt));
          
          if (!canRetry) return null;
          
          return (
            <Button
              size="sm"
              onClick={startVerification}
              disabled={starting || userStatus.attempts >= status.userStatus.maxAttempts}
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
              {userStatus.status === 'none' ? 'Verify Now' : 'Try Again'}
            </Button>
          );
        })()}
      </div>
    );
  }

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${statusConfig.color}/20 rounded-lg`}>
              <Shield className={`h-6 w-6 ${statusConfig.textColor}`} />
            </div>
            <div>
              <CardTitle className="text-white">Identity Verification</CardTitle>
              <CardDescription>
                {status.requiredForWithdrawal && 'Required for withdrawals'}
                {status.requiredForWithdrawal && status.requiredForDeposit && ' and '}
                {status.requiredForDeposit && 'Required for deposits'}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={`${statusConfig.color} text-white flex items-center gap-1`}
          >
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Message */}
        <div className={`p-4 rounded-lg ${
          userStatus.status === 'approved' ? 'bg-green-500/10 border border-green-500/30' :
          userStatus.status === 'declined' ? 'bg-red-500/10 border border-red-500/30' :
          userStatus.status === 'pending' ? 'bg-yellow-500/10 border border-yellow-500/30' :
          userStatus.status === 'expired' ? 'bg-orange-500/10 border border-orange-500/30' :
          'bg-gray-900/50'
        }`}>
          <div className="flex items-start gap-3">
            <StatusIcon className={`h-5 w-5 ${statusConfig.textColor} mt-0.5`} />
            <div>
              <p className={`font-medium ${statusConfig.textColor}`}>
                {userStatus.status === 'approved' ? status.messages.approved :
                 userStatus.status === 'declined' ? status.messages.declined :
                 userStatus.status === 'pending' ? status.messages.pending :
                 status.messages.required}
              </p>
              {userStatus.status === 'approved' && userStatus.verifiedAt && (
                <p className="text-sm text-gray-400 mt-1">
                  Verified on {new Date(userStatus.verifiedAt).toLocaleDateString()}
                  {userStatus.expiresAt && ` • Expires ${new Date(userStatus.expiresAt).toLocaleDateString()}`}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Section */}
        {userStatus.status !== 'approved' && (
          <div className="space-y-4">
            {/* Attempts info */}
            {userStatus.attempts > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Info className="h-4 w-4" />
                <span>
                  {userStatus.attempts} of {userStatus.maxAttempts} verification attempts used
                </span>
              </div>
            )}

            {/* Start Verification Button - show for none/declined/expired/abandoned OR stale pending sessions */}
            {(() => {
              const canRetry = userStatus.status === 'none' || 
                               userStatus.status === 'declined' || 
                               userStatus.status === 'expired' ||
                               userStatus.status === 'abandoned' ||
                               (userStatus.status === 'pending' && status.latestSession && isSessionStale(status.latestSession.createdAt));
              
              if (!canRetry) return null;
              
              return (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={startVerification}
                  disabled={starting || userStatus.attempts >= userStatus.maxAttempts}
                >
                  {starting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Starting Verification...
                    </>
                  ) : userStatus.attempts >= userStatus.maxAttempts ? (
                    <>
                      <XCircle className="h-5 w-5 mr-2" />
                      Max Attempts Reached
                    </>
                  ) : (
                    <>
                      <Shield className="h-5 w-5 mr-2" />
                      {userStatus.status === 'none' ? 'Start Verification' : 'Retry Verification'}
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              );
            })()}

            {/* Max attempts reached */}
            {userStatus.attempts >= userStatus.maxAttempts && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-400">Maximum attempts reached</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Please contact support for assistance with identity verification.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Pending state - refresh button */}
            {userStatus.status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => fetchStatus(true)}
                  disabled={checking}
                  className="w-full"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
                  {checking ? 'Checking...' : 'Check Verification Status'}
                </Button>
                {status.latestSession && isSessionStale(status.latestSession.createdAt) && (
                  <p className="text-xs text-orange-400 text-center mt-2">
                    Your previous verification session has expired. You can retry above.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* What to expect */}
        {userStatus.status === 'none' && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h4 className="text-sm font-medium text-blue-400 mb-2">What you'll need:</h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• A valid government-issued ID (passport, ID card, or driver's license)</li>
              <li>• A device with a camera</li>
              <li>• Good lighting for clear photos</li>
              <li>• About 5 minutes of your time</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

