'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HelpTooltipProps {
  content: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function HelpTooltip({ content, side = 'top', className }: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsVisible(!isVisible)}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className={cn(
          "inline-flex items-center justify-center rounded-full transition-all",
          "bg-purple-500/20 hover:bg-purple-500/40 border-2 border-purple-400/50",
          "size-5 text-purple-300 hover:text-purple-100",
          className
        )}
      >
        <HelpCircle className="size-3" />
      </button>

      {isVisible && (
        <div
          className={cn(
            "absolute z-50 w-64 p-3 text-sm",
            "bg-gradient-to-br from-purple-900 to-pink-900 text-white rounded-lg",
            "border-2 border-purple-400/50 shadow-2xl shadow-purple-500/50",
            "animate-in fade-in-0 zoom-in-95 duration-200",
            side === 'top' && "bottom-full left-1/2 -translate-x-1/2 mb-2",
            side === 'bottom' && "top-full left-1/2 -translate-x-1/2 mt-2",
            side === 'left' && "right-full top-1/2 -translate-y-1/2 mr-2",
            side === 'right' && "left-full top-1/2 -translate-y-1/2 ml-2"
          )}
        >
          {/* Arrow */}
          <div
            className={cn(
              "absolute size-3 rotate-45 bg-gradient-to-br from-purple-900 to-pink-900 border-purple-400/50",
              side === 'top' && "bottom-[-7px] left-1/2 -translate-x-1/2 border-b-2 border-r-2",
              side === 'bottom' && "top-[-7px] left-1/2 -translate-x-1/2 border-t-2 border-l-2",
              side === 'left' && "right-[-7px] top-1/2 -translate-y-1/2 border-t-2 border-r-2",
              side === 'right' && "left-[-7px] top-1/2 -translate-y-1/2 border-b-2 border-l-2"
            )}
          />
          
          <p className="relative z-10 font-medium leading-relaxed">
            {content}
          </p>
        </div>
      )}
    </div>
  );
}

