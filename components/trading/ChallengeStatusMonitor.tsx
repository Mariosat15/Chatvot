'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PERFORMANCE_INTERVALS } from '@/lib/utils/performance';

interface ChallengeStatusMonitorProps {
  challengeId: string;
  initialStatus: string;
  userId: string; // Current user's ID to check if they won
}

/**
 * Monitors challenge status and refreshes/redirects when status changes
 * Polls every 5 seconds to detect status changes
 */
export default function ChallengeStatusMonitor({ 
  challengeId, 
  initialStatus,
  userId,
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

            // Check if CURRENT user won (compare winnerId to userId prop)
            const winnerId = data.challenge?.winnerId;
            const isTie = data.challenge?.isTie;
            const isWinner = winnerId && winnerId === userId;
            const isLoser = winnerId && winnerId !== userId && !isTie;

            if (isTie) {
              toast.info('🤝 Challenge Ended - Tie!', {
                description: 'The challenge ended in a tie. View the results.',
                duration: 5000,
              });
            } else if (isWinner) {
              toast.success('🏆 You Won!', {
                description: 'Congratulations! You won the challenge!',
                duration: 5000,
              });
            } else if (isLoser) {
              toast.error('😔 Challenge Ended', {
                description: 'You lost this challenge. Better luck next time!',
                duration: 5000,
              });
            } else {
              toast('⚔️ Challenge Ended', {
                description: 'The challenge has ended. View the results.',
                duration: 5000,
              });
            }

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

    // Poll at optimized interval (10 seconds instead of 5)
    pollIntervalRef.current = setInterval(checkChallengeStatus, PERFORMANCE_INTERVALS.CHALLENGE_STATUS);

    return () => {
      clearTimeout(timeoutId);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [challengeId, initialStatus, router, userId]);

  return null;
}

