'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PERFORMANCE_INTERVALS } from '@/lib/utils/performance';
import { Skull, Ban, X, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ParticipantStatusMonitorProps {
  competitionId: string;
  initialParticipantStatus: string;
  userId: string;
  contestType?: 'competition' | 'challenge';
}

/**
 * Monitors participant status and shows alerts when disqualified/liquidated
 * Also displays a persistent banner when the user is disqualified
 */
export default function ParticipantStatusMonitor({ 
  competitionId, 
  initialParticipantStatus,
  userId,
  contestType = 'competition',
}: ParticipantStatusMonitorProps) {
  const router = useRouter();
  const hasNotifiedRef = useRef(false);
  const lastStatusRef = useRef(initialParticipantStatus);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentStatus, setCurrentStatus] = useState(initialParticipantStatus);
  const [showBanner, setShowBanner] = useState(
    initialParticipantStatus === 'liquidated' || initialParticipantStatus === 'disqualified'
  );
  const [isDismissed, setIsDismissed] = useState(false);

  const isDisqualified = currentStatus === 'liquidated' || currentStatus === 'disqualified';

  const getDisqualificationInfo = useCallback(() => {
    switch (currentStatus) {
      case 'liquidated':
        return {
          title: '💀 Account Liquidated',
          message: 'Your account was liquidated due to margin call. You are no longer eligible for prizes in this competition.',
          icon: Skull,
          bgClass: 'from-red-600/30 via-red-500/20 to-orange-600/30',
          borderClass: 'border-red-500/50',
          textClass: 'text-red-300',
        };
      case 'disqualified':
        return {
          title: '🚫 Disqualified',
          message: 'You have been disqualified from this competition and are no longer eligible for prizes.',
          icon: Ban,
          bgClass: 'from-orange-600/30 via-red-500/20 to-red-600/30',
          borderClass: 'border-orange-500/50',
          textClass: 'text-orange-300',
        };
      default:
        return null;
    }
  }, [currentStatus]);

  useEffect(() => {
    // Set initial banner state if already disqualified
    if (initialParticipantStatus === 'liquidated' || initialParticipantStatus === 'disqualified') {
      setShowBanner(true);
    }
  }, [initialParticipantStatus]);

  useEffect(() => {
    // Only poll if the participant is still active
    if (!['active'].includes(initialParticipantStatus)) {
      return;
    }

    const checkParticipantStatus = async () => {
      try {
        const response = await fetch(
          `/api/competitions/${competitionId}/participant-status?userId=${userId}`
        );
        
        if (!response.ok) {
          if (response.status === 404) {
            return;
          }
          console.error('Failed to fetch participant status');
          return;
        }

        const data = await response.json();
        
        // If status changed from active to disqualified/liquidated
        if (data.status !== lastStatusRef.current && !hasNotifiedRef.current) {
          const previousStatus = lastStatusRef.current;
          lastStatusRef.current = data.status;
          setCurrentStatus(data.status);

          // Handle liquidation
          if (data.status === 'liquidated' && previousStatus === 'active') {
            hasNotifiedRef.current = true;
            setShowBanner(true);
            
            toast.error('💀 You have been liquidated!', {
              description: 'Your account was liquidated due to margin call. You are no longer eligible for prizes.',
              duration: 10000,
            });
          }

          // Handle disqualification
          if (data.status === 'disqualified' && previousStatus === 'active') {
            hasNotifiedRef.current = true;
            setShowBanner(true);
            
            toast.error('🚫 You have been disqualified!', {
              description: data.reason || 'You did not meet the competition requirements.',
              duration: 10000,
            });
          }
        }
      } catch (error) {
        // Fail silently
        console.error('Error checking participant status:', error);
      }
    };

    // Initial check after 2 seconds
    const timeoutId = setTimeout(checkParticipantStatus, 2000);

    // Poll at optimized interval (10 seconds)
    pollIntervalRef.current = setInterval(checkParticipantStatus, PERFORMANCE_INTERVALS.COMPETITION_STATUS);

    return () => {
      clearTimeout(timeoutId);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [competitionId, initialParticipantStatus, userId, router]);

  // Don't render banner if dismissed or not disqualified
  if (!showBanner || isDismissed || !isDisqualified) {
    return null;
  }

  const info = getDisqualificationInfo();
  if (!info) return null;

  const IconComponent = info.icon;

  return (
    <div className={`relative bg-gradient-to-r ${info.bgClass} border-b ${info.borderClass}`}>
      {/* Animated background effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
      
      <div className="container-custom py-4 relative z-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-red-500/20 rounded-xl border border-red-500/30 animate-pulse">
              <IconComponent className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <h3 className={`font-bold text-lg ${info.textClass}`}>
                {info.title}
              </h3>
              <p className="text-sm text-gray-300/90 max-w-2xl">
                {info.message}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Link href={`/competitions/${competitionId}/trade?viewOnly=true`}>
              <Button 
                variant="outline" 
                size="sm"
                className="border-white/20 bg-white/10 hover:bg-white/20 text-white gap-2"
              >
                <History className="h-4 w-4" />
                View History
              </Button>
            </Link>
            <button 
              onClick={() => setIsDismissed(true)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="h-5 w-5 text-gray-400 hover:text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

