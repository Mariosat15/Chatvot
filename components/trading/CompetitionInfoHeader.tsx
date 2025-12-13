'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface CompetitionInfoHeaderProps {
  endTime: Date;
  currentParticipants: number;
  prizePool: number;
}

export function CompetitionInfoHeader({ 
  endTime, 
  currentParticipants, 
  prizePool 
}: CompetitionInfoHeaderProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const diff = end - now;

      if (diff <= 0) {
        return 'Competition Ended';
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
      } else if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
      } else {
        return `${minutes}m ${seconds}s`;
      }
    };

    // Initial calculation
    setTimeRemaining(calculateTimeRemaining());

    // Update every second
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  return (
    <div className="flex items-stretch gap-3 md:gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
      {/* Time Remaining Card */}
      <div className="group relative bg-gradient-to-br from-dark-300 to-dark-300/80 px-4 md:px-6 py-3 md:py-4 rounded-xl border border-dark-400/30 hover:border-primary/30 transition-all duration-300 flex-shrink-0 shadow-lg hover:shadow-primary/20 min-w-[180px]">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
        <div className="relative flex items-center gap-3">
          <div className="text-3xl">
            ⏱️
          </div>
          <div>
            <p className="text-xs font-medium text-dark-600 uppercase tracking-wider mb-0.5">
              Time Remaining
            </p>
            <p className={cn(
              "text-lg md:text-xl font-bold tabular-nums",
              timeRemaining === 'Competition Ended' ? 'text-red-400' : 'text-light-900'
            )}>
              {timeRemaining}
            </p>
          </div>
        </div>
      </div>

      {/* Participants Card */}
      <div className="group relative bg-gradient-to-br from-dark-300 to-dark-300/80 px-4 md:px-6 py-3 md:py-4 rounded-xl border border-dark-400/30 hover:border-blue-500/30 transition-all duration-300 flex-shrink-0 shadow-lg hover:shadow-blue-500/20 min-w-[180px]">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
        <div className="relative flex items-center gap-3">
          <div className="text-3xl">
            👥
          </div>
          <div>
            <p className="text-xs font-medium text-dark-600 uppercase tracking-wider mb-0.5">
              Participants
            </p>
            <p className="text-lg md:text-xl font-bold text-blue-400 tabular-nums">
              {currentParticipants}
            </p>
          </div>
        </div>
      </div>

      {/* Prize Pool Card */}
      <div className="group relative bg-gradient-to-br from-amber-500/10 to-amber-500/5 px-4 md:px-6 py-3 md:py-4 rounded-xl border border-amber-500/30 hover:border-amber-500/50 transition-all duration-300 flex-shrink-0 shadow-lg hover:shadow-amber-500/20 min-w-[200px]">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
        <div className="relative flex items-center gap-3">
          <div className="text-3xl">
            🏆
          </div>
          <div>
            <p className="text-xs font-medium text-dark-600 uppercase tracking-wider mb-0.5">
              Prize Pool
            </p>
            <p className="text-lg md:text-xl font-bold text-amber-400 tabular-nums">
              {prizePool.toLocaleString()} Credits
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

