"use client";

import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  text: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  iconSize?: number;
}

/**
 * Contextual help icon with tooltip explanation.
 * Place next to trading terms like "Margin Level", "Equity", etc.
 */
export function InfoTooltip({
  text,
  side = "top",
  className,
  iconSize = 13,
}: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center rounded-full text-dark-600 hover:text-gray-300 transition-colors focus:outline-none",
              className,
            )}
            tabIndex={-1}
          >
            <HelpCircle size={iconSize} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
