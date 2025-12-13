'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface ChallengeStatusMonitorProps {
  challengeId: string;
  initialStatus: string;
}

/**
 * Monitors challenge status and refreshes/redirects when status changes
 * Polls every 5 seconds to detect status changes
 */
export default function ChallengeStatusMonitor({ 
  challengeId, 
  initialStatus 
}: ChallengeStatusMonitorProps) {
  const router = useRouter();
  const hasRedirectedRef = useRef(false);
  const lastStatusRef = useRef(initialStatus);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Poll for active challenges (can end)
    if (!['pending', 'active'].includes(initialStatus)) {
      return;
    }

    const checkChallengeStatus = async () => {
      try {
        const response = await fetch(`/api/challenges/${challengeId}`);
        if (!response.ok) {
          if (response.status === 404) {
            return;
          }
          console.error('Failed to fetch challenge status');
          return;
        }

        const data = await response.json();
        const newStatus = data.challenge?.status;
        
        if (!newStatus) return;
        
        // If status changed, handle it
        if (newStatus !== lastStatusRef.current && !hasRedirectedRef.current) {
          lastStatusRef.current = newStatus;
          
          // Handle declined challenges
          if (newStatus === 'declined') {
            hasRedirectedRef.current = true;
            
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }

            toast.error('❌ Challenge Declined', {
              description: 'Your opponent has declined the challenge.',
              duration: 8000,
            });

            router.push('/challenges');
            return;
          }

          // Handle expired challenges
          if (newStatus === 'expired') {
            hasRedirectedRef.current = true;
            
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }

            toast.error('⏰ Challenge Expired', {
              description: 'The challenge was not accepted in time.',
              duration: 8000,
            });

            router.push('/challenges');
            return;
          }

          // Handle started challenges (pending → active)
          if (newStatus === 'active' && lastStatusRef.current === 'pending') {
            toast.success('⚔️ Challenge Started!', {
              description: 'The challenge is now live. Good luck!',
              duration: 5000,
            });
            router.refresh();
            return;
          }
          
          // Handle completed challenges (active → completed)
          if (newStatus === 'completed') {
            hasRedirectedRef.current = true;
            
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }

            // Check if user won
            const winnerId = data.challenge?.winnerId;
            const isWinner = winnerId && data.participants?.some(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (p: any) => p.userId === winnerId && p.isWinner
            );

            toast.success(isWinner ? '🏆 You Won!' : '⚔️ Challenge Ended', {
              description: isWinner 
                ? 'Congratulations! You won the challenge!' 
                : 'The challenge has ended. View the results.',
              duration: 5000,
            });

            setTimeout(() => {
              router.push(`/challenges/${challengeId}`);
              router.refresh();
            }, 2000);
          }
        }
      } catch (error) {
        // Fail silently
      }
    };

    // Initial check after 3 seconds
    const timeoutId = setTimeout(checkChallengeStatus, 3000);

    // Poll every 5 seconds
    pollIntervalRef.current = setInterval(checkChallengeStatus, 5000);

    return () => {
      clearTimeout(timeoutId);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [challengeId, initialStatus, router]);

  return null;
}

