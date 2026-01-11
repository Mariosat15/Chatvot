'use client';

import { useState } from 'react';
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
 * Displays a banner when the user is disqualified/liquidated
 * 
 * NOTE: This component does NOT poll the server for status changes.
 * Instead, it relies on:
 * 1. Server-rendered initial status (page refresh shows correct state)
 * 2. Trading buttons being disabled server-side when disqualified
 * 3. Notification service sending alerts when liquidation happens
 * 
 * This approach avoids heavy server load from thousands of users polling.
 * If real-time updates are needed in the future, consider WebSockets or SSE.
 */
export default function ParticipantStatusMonitor({ 
  competitionId, 
  initialParticipantStatus,
}: ParticipantStatusMonitorProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if user is disqualified based on initial server-rendered status
  const isDisqualified = initialParticipantStatus === 'liquidated' || initialParticipantStatus === 'disqualified';

  const getDisqualificationInfo = () => {
    switch (initialParticipantStatus) {
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
  };

  // Don't render banner if dismissed or not disqualified
  if (isDismissed || !isDisqualified) {
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
