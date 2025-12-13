'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface CompetitionStatusMonitorProps {
  competitionId: string;
  initialStatus: string;
}

/**
 * Monitors competition status and refreshes/redirects when status changes
 * Polls every 5 seconds to detect status changes including cancellations
 */
export default function CompetitionStatusMonitor({ 
  competitionId, 
  initialStatus 
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
        const response = await fetch(`/api/competitions/${competitionId}/status`);
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

            // Show notification
            toast.success('🏆 Competition has ended!', {
              description: 'View the final results and rankings',
              duration: 5000,
            });

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

    // Initial check after 3 seconds (faster than before)
    const timeoutId = setTimeout(checkCompetitionStatus, 3000);

    // Poll every 5 seconds (faster to catch cancellations)
    pollIntervalRef.current = setInterval(checkCompetitionStatus, 5000);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [competitionId, initialStatus, router]);

  // This component doesn't render anything
  return null;
}

