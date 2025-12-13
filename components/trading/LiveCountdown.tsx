'use client';

import { useState, useEffect } from 'react';
import { Clock, Timer, CheckCircle, AlertCircle } from 'lucide-react';

interface LiveCountdownProps {
  targetDate: Date;
  label: string;
  type: 'start' | 'end';
  status: 'upcoming' | 'active' | 'completed';
}

export default function LiveCountdown({ targetDate, label, type, status }: LiveCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const target = new Date(targetDate);
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds, total: diff });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeRemaining) {
    return <div className="animate-pulse bg-gray-700 h-24 rounded-xl" />;
  }

  const isComplete = timeRemaining.total <= 0;

  // For "starts in" countdown
  if (type === 'start' && status === 'upcoming') {
    if (isComplete) {
      return (
        <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-xl">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="h-5 w-5" />
            <span className="font-bold">Competition has started!</span>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <Timer className="h-5 w-5 text-yellow-400 animate-pulse" />
          <span className="text-sm font-semibold text-yellow-400">{label}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <div className="text-3xl font-black text-white tabular-nums">
              {timeRemaining.days.toString().padStart(2, '0')}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Days</div>
          </div>
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <div className="text-3xl font-black text-white tabular-nums">
              {timeRemaining.hours.toString().padStart(2, '0')}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Hours</div>
          </div>
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <div className="text-3xl font-black text-white tabular-nums">
              {timeRemaining.minutes.toString().padStart(2, '0')}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Mins</div>
          </div>
          <div className="text-center p-3 bg-gray-900/50 rounded-lg relative">
            <div className="text-3xl font-black text-yellow-400 tabular-nums animate-pulse">
              {timeRemaining.seconds.toString().padStart(2, '0')}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Secs</div>
          </div>
        </div>
      </div>
    );
  }

  // For "ends in" countdown (active competition)
  if (type === 'end' && status === 'active') {
    if (isComplete) {
      return (
        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span className="font-bold">Competition has ended!</span>
          </div>
        </div>
      );
    }

    // Warning state when less than 1 hour remaining
    const isWarning = timeRemaining.total < 60 * 60 * 1000;

    return (
      <div className={`p-4 rounded-xl ${
        isWarning 
          ? 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/50' 
          : 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/50'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          <Clock className={`h-5 w-5 ${isWarning ? 'text-red-400 animate-pulse' : 'text-blue-400'}`} />
          <span className={`text-sm font-semibold ${isWarning ? 'text-red-400' : 'text-blue-400'}`}>
            {label}
          </span>
          {isWarning && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
              ENDING SOON!
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <div className="text-3xl font-black text-white tabular-nums">
              {timeRemaining.days.toString().padStart(2, '0')}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Days</div>
          </div>
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <div className="text-3xl font-black text-white tabular-nums">
              {timeRemaining.hours.toString().padStart(2, '0')}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Hours</div>
          </div>
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <div className="text-3xl font-black text-white tabular-nums">
              {timeRemaining.minutes.toString().padStart(2, '0')}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Mins</div>
          </div>
          <div className="text-center p-3 bg-gray-900/50 rounded-lg">
            <div className={`text-3xl font-black tabular-nums ${isWarning ? 'text-red-400 animate-pulse' : 'text-blue-400'}`}>
              {timeRemaining.seconds.toString().padStart(2, '0')}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Secs</div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

