'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function UTCClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatUTCTime = (date: Date) => {
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatUTCDate = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 shadow-lg h-[72px]">
      <Clock className="h-6 w-6 text-blue-400 animate-pulse" />
      <div className="flex flex-col">
        <span className="text-[10px] text-blue-400/80 font-semibold uppercase tracking-wider">Server Time (UTC)</span>
        <span className="text-xl font-bold text-blue-100 tabular-nums" suppressHydrationWarning>
          {formatUTCTime(time)}
        </span>
        <span className="text-[10px] text-blue-300/70 tabular-nums" suppressHydrationWarning>
          {formatUTCDate(time)}
        </span>
      </div>
    </div>
  );
}

