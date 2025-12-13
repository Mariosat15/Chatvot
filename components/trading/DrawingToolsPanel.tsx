'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Minus,
  TrendingUp,
  Square,
  Type,
  ArrowRight,
  Target,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DrawingTool, DrawingObject } from '@/lib/services/drawing-tools.service';

interface DrawingToolsPanelProps {
  activeTool: DrawingTool | null;
  drawings: DrawingObject[];
  onToolSelect: (tool: DrawingTool | null) => void;
  onClearDrawings: () => void;
}

const DRAWING_TOOLS: { tool: DrawingTool; icon: any; label: string }[] = [
  { tool: 'trend-line', icon: TrendingUp, label: 'Trend Line' },
  { tool: 'horizontal-line', icon: Minus, label: 'Horizontal Line' },
  { tool: 'vertical-line', icon: Minus, label: 'Vertical Line' },
  { tool: 'rectangle', icon: Square, label: 'Rectangle' },
  { tool: 'text', icon: Type, label: 'Text Label' },
  { tool: 'arrow', icon: ArrowRight, label: 'Arrow' },
  { tool: 'fibonacci', icon: Target, label: 'Fibonacci Retracement' },
];

export default function DrawingToolsPanel({
  activeTool,
  drawings,
  onToolSelect,
  onClearDrawings
}: DrawingToolsPanelProps) {
  return (
    <div className="flex items-center gap-1">
      {DRAWING_TOOLS.map(({ tool, icon: Icon, label }) => (
        <Button
          key={tool}
          size="sm"
          variant="ghost"
          onClick={() => onToolSelect(activeTool === tool ? null : tool)}
          className={cn(
            "h-7 w-7 p-0 hover:bg-[#2a2e39]",
            activeTool === tool
              ? "bg-[#2962ff] text-white hover:bg-[#1e4db7]"
              : "text-[#787b86]"
          )}
          title={label}
        >
          <Icon className="h-4 w-4" style={{
            transform: tool === 'vertical-line' ? 'rotate(90deg)' : undefined
          }} />
        </Button>
      ))}
      
      {drawings.length > 0 && (
        <>
          <div className="w-px h-5 bg-[#2b2b43] mx-1" />
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearDrawings}
            className="h-7 px-3 text-xs hover:bg-[#2a2e39] text-[#787b86]"
            title="Clear All Drawings"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear ({drawings.length})
          </Button>
        </>
      )}
    </div>
  );
}

