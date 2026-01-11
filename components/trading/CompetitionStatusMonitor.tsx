'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PERFORMANCE_INTERVALS } from '@/lib/utils/performance';

interface CompetitionStatusMonitorProps {
  competitionId: string;
  initialStatus: string;
  userId: string; // Current user's ID to check their ranking
}

/**
 * Monitors competition status and refreshes/redirects when status changes
 * Polls every 5 seconds to detect status changes including cancellations
 */
export default function CompetitionStatusMonitor({ 
  competitionId, 
  initialStatus,
  userId,
}: CompetitionStatusMonitorProps) {
  const router = useRouter();
  const hasRedirectedRef = useRef(false);
  const lastStatusRef = useRef(initialStatus);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Poll for upcoming (can be cancelled) and active (can end) competitions
    if (!['upcoming', 'active'].includes(initialStatus)) {
      return;
    }

    const checkCompetitionStatus = async () => {
      try {
        const response = await fetch(`/api/competitions/${competitionId}/status?userId=${userId}`);
        if (!response.ok) {
          // Fail silently if API doesn't exist
          if (response.status === 404) {
            return;
          }
          console.error('Failed to fetch competition status');
          return;
        }

        const data = await response.json();
        
        // If status changed, handle it
        if (data.status !== lastStatusRef.current && !hasRedirectedRef.current) {
          lastStatusRef.current = data.status;
          
          // Handle cancelled competitions
          if (data.status === 'cancelled') {
            hasRedirectedRef.current = true;
            
            // Clear the polling interval
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }

            // Show notification
            toast.error('🚫 Competition Cancelled!', {
              description: data.cancellationReason || 'The competition did not meet minimum participants. Your entry fee has been refunded.',
              duration: 8000,
            });

            // Refresh the page to show the cancelled status
            router.refresh();
            return;
          }

          // Handle started competitions (upcoming → active)
          if (data.status === 'active' && lastStatusRef.current === 'upcoming') {
            toast.success('🚀 Competition Started!', {
              description: 'The competition is now live. Good luck!',
              duration: 5000,
            });
            router.refresh();
            return;
          }
          
          // Handle completed competitions (active → completed)
          if (data.status === 'completed') {
            hasRedirectedRef.current = true;
            
            // Clear the polling interval
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }

            // Show personalized notification based on user's ranking
            const userRank = data.userRank;
            const totalParticipants = data.totalParticipants || 0;
            const prizeWon = data.prizeWon || 0;

            if (userRank === 1) {
              toast.success('🏆 You Won!', {
                description: prizeWon > 0 
                  ? `Congratulations! You finished 1st and won ${prizeWon} credits!`
                  : 'Congratulations! You finished in 1st place!',
                duration: 6000,
              });
            } else if (userRank === 2) {
              toast.success('🥈 2nd Place!', {
                description: prizeWon > 0 
                  ? `Great job! You finished 2nd and won ${prizeWon} credits!`
                  : 'Great job! You finished in 2nd place!',
                duration: 6000,
              });
            } else if (userRank === 3) {
              toast.success('🥉 3rd Place!', {
                description: prizeWon > 0 
                  ? `Well done! You finished 3rd and won ${prizeWon} credits!`
                  : 'Well done! You finished in 3rd place!',
                duration: 6000,
              });
            } else if (userRank && userRank <= 10) {
              toast.info(`📊 Competition Ended - ${userRank}th Place`, {
                description: `You finished ${userRank}/${totalParticipants}. View the full results.`,
                duration: 5000,
              });
            } else if (userRank) {
              toast('⚔️ Competition Ended', {
                description: `You finished ${userRank}/${totalParticipants}. Better luck next time!`,
                duration: 5000,
              });
            } else {
              toast('⚔️ Competition Ended', {
                description: 'View the final results and rankings.',
                duration: 5000,
              });
            }

            // Redirect after a brief delay to allow toast to show
            setTimeout(() => {
              router.push(`/competitions/${competitionId}`);
              router.refresh();
            }, 2000);
          }
        }
      } catch (error) {
        // Fail silently - likely not on a page that uses this monitor
      }
    };

    // Initial check after 3 seconds
    const timeoutId = setTimeout(checkCompetitionStatus, 3000);

    // Poll at optimized interval (10 seconds instead of 5)
    pollIntervalRef.current = setInterval(checkCompetitionStatus, PERFORMANCE_INTERVALS.COMPETITION_STATUS);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [competitionId, initialStatus, router, userId]);

  // This component doesn't render anything
  return null;
}

