'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { DrawingToolType } from '@/lib/chart/primitives';

interface ChartToolbarProps {
  activeTool: DrawingToolType;
  onToolSelect: (tool: DrawingToolType) => void;
  onClearAll: () => void;
  onDeleteSelected?: () => void;
  hasSelection?: boolean;
  drawingsCount?: number;
  defaultColor?: string;
  defaultLineWidth?: number;
  onColorChange?: (color: string) => void;
  onLineWidthChange?: (width: number) => void;
  className?: string;
}

// TradingView-style SVG Icons (exactly like TradingView)
const Icons = {
  crosshair: (
    <svg viewBox="0 0 28 28" width="20" height="20">
      <g fill="currentColor">
        <path d="M18 15h7v-1h-7v-7h-1v7H9v1h8v7h1v-7z"/>
      </g>
    </svg>
  ),
  trendLine: (
    <svg viewBox="0 0 28 28" width="20" height="20">
      <path stroke="currentColor" strokeWidth="1.2" fill="none" d="M6.5 21.5l15-15"/>
      <circle fill="currentColor" cx="6.5" cy="21.5" r="1.5"/>
      <circle fill="currentColor" cx="21.5" cy="6.5" r="1.5"/>
    </svg>
  ),
  horizontalLine: (
    <svg viewBox="0 0 28 28" width="20" height="20">
      <path stroke="currentColor" strokeWidth="1.2" d="M4 14h20"/>
    </svg>
  ),
  ray: (
    <svg viewBox="0 0 28 28" width="20" height="20">
      <path stroke="currentColor" strokeWidth="1.2" fill="none" d="M6.5 21.5l15-15"/>
      <circle fill="currentColor" cx="6.5" cy="21.5" r="1.5"/>
      <path stroke="currentColor" strokeWidth="1.2" d="M21 7l3-3M21 4v3h3"/>
    </svg>
  ),
  extendedLine: (
    <svg viewBox="0 0 28 28" width="20" height="20">
      <path stroke="currentColor" strokeWidth="1.2" d="M4 18L24 8"/>
    </svg>
  ),
  rectangle: (
    <svg viewBox="0 0 28 28" width="20" height="20">
      <rect x="5.5" y="7.5" width="17" height="13" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    </svg>
  ),
  fibonacci: (
    <svg viewBox="0 0 28 28" width="20" height="20">
      <path stroke="currentColor" strokeWidth="1" d="M5 8h18M5 12h18M5 16h18M5 20h18"/>
    </svg>
  ),
  verticalLine: (
    <svg viewBox="0 0 28 28" width="20" height="20">
      <path stroke="currentColor" strokeWidth="1.2" d="M14 4v20"/>
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 28 28" width="20" height="20">
      <path fill="currentColor" d="M11 8V6.5C11 5.67 11.67 5 12.5 5h3c.83 0 1.5.67 1.5 1.5V8h4v1h-1v12.5c0 .83-.67 1.5-1.5 1.5h-9c-.83 0-1.5-.67-1.5-1.5V9H7V8h4zm1 0h4V6.5c0-.28-.22-.5-.5-.5h-3c-.28 0-.5.22-.5.5V8zm-2 3v9h1v-9h-1zm3 0v9h1v-9h-1zm3 0v9h1v-9h-1z"/>
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 8 14" width="6" height="10">
      <path fill="currentColor" d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  ),
};

// Tool definitions
const TOOLS = [
  { id: null, icon: Icons.crosshair, title: 'Crosshair' },
  { id: 'trend-line', icon: Icons.trendLine, title: 'Trend Line', hasSubmenu: true },
  { id: 'horizontal-line', icon: Icons.horizontalLine, title: 'Horizontal Line' },
  { id: 'rectangle', icon: Icons.rectangle, title: 'Rectangle' },
  { id: 'fibonacci', icon: Icons.fibonacci, title: 'Fib Retracement' },
] as const;

const LINE_SUBMENU = [
  { id: 'trend-line' as DrawingToolType, name: 'Trend Line', icon: Icons.trendLine },
  { id: 'ray' as DrawingToolType, name: 'Ray', icon: Icons.ray },
  { id: 'extended-line' as DrawingToolType, name: 'Extended Line', icon: Icons.extendedLine },
  { id: 'horizontal-line' as DrawingToolType, name: 'Horizontal Line', icon: Icons.horizontalLine },
  { id: 'vertical-line' as DrawingToolType, name: 'Vertical Line', icon: Icons.verticalLine },
];

export default function ChartToolbar({
  activeTool,
  onToolSelect,
  onClearAll,
  drawingsCount = 0,
  className,
}: ChartToolbarProps) {
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);

  const handleToolSelect = useCallback((tool: DrawingToolType) => {
    onToolSelect(tool);
    setHoveredTool(null);
  }, [onToolSelect]);

  // Check if line tool is active
  const isLineTool = ['trend-line', 'ray', 'extended-line', 'horizontal-line', 'vertical-line'].includes(activeTool || '');
  const activeLineIcon = LINE_SUBMENU.find(t => t.id === activeTool)?.icon || Icons.trendLine;

  return (
    <div 
      className={cn(
        "flex flex-col bg-[#131722] border-r border-[#2A2E39]",
        className
      )}
    >
      {/* Crosshair Tool */}
      <button
        onClick={() => handleToolSelect(null)}
        onMouseEnter={() => setHoveredTool('crosshair')}
        onMouseLeave={() => setHoveredTool(null)}
        className={cn(
          "relative w-full h-[38px] flex items-center justify-center transition-colors",
          !activeTool 
            ? "text-[#2962FF] bg-[#2962FF]/10" 
            : "text-[#787B86] hover:text-[#D1D4DC] hover:bg-[#2A2E39]"
        )}
        title="Crosshair"
      >
        {Icons.crosshair}
      </button>

      <div className="h-px bg-[#2A2E39] mx-2" />

      {/* Line Tools with Submenu */}
      <div 
        className="relative"
        onMouseEnter={() => setHoveredTool('lines')}
        onMouseLeave={() => setHoveredTool(null)}
      >
        <button
          onClick={() => handleToolSelect('trend-line')}
          className={cn(
            "w-full h-[38px] flex items-center justify-center transition-colors relative",
            isLineTool
              ? "text-[#2962FF] bg-[#2962FF]/10" 
              : "text-[#787B86] hover:text-[#D1D4DC] hover:bg-[#2A2E39]"
          )}
          title="Trend Line Tools"
        >
          {activeLineIcon}
          <span className="absolute right-1 bottom-1 text-[#787B86] opacity-60">
            {Icons.chevron}
          </span>
        </button>

        {/* Line Tools Submenu */}
        {hoveredTool === 'lines' && (
          <div className="absolute left-full top-0 ml-0.5 bg-[#1E222D] border border-[#2A2E39] rounded shadow-xl py-1 z-50 min-w-[160px]">
            {LINE_SUBMENU.map(tool => (
              <button
                key={tool.id}
                onClick={() => handleToolSelect(tool.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-[13px] transition-colors",
                  activeTool === tool.id
                    ? "bg-[#2962FF] text-white"
                    : "text-[#D1D4DC] hover:bg-[#2A2E39]"
                )}
              >
                <span className="w-5 h-5 flex items-center justify-center">{tool.icon}</span>
                <span>{tool.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Rectangle */}
      <button
        onClick={() => handleToolSelect('rectangle')}
        className={cn(
          "w-full h-[38px] flex items-center justify-center transition-colors",
          activeTool === 'rectangle'
            ? "text-[#2962FF] bg-[#2962FF]/10" 
            : "text-[#787B86] hover:text-[#D1D4DC] hover:bg-[#2A2E39]"
        )}
        title="Rectangle"
      >
        {Icons.rectangle}
      </button>

      {/* Fibonacci */}
      <button
        onClick={() => handleToolSelect('fibonacci')}
        className={cn(
          "w-full h-[38px] flex items-center justify-center transition-colors",
          activeTool === 'fibonacci'
            ? "text-[#2962FF] bg-[#2962FF]/10" 
            : "text-[#787B86] hover:text-[#D1D4DC] hover:bg-[#2A2E39]"
        )}
        title="Fib Retracement"
      >
        {Icons.fibonacci}
      </button>

      <div className="flex-1" />

      {/* Delete All */}
      {drawingsCount > 0 && (
        <>
          <div className="h-px bg-[#2A2E39] mx-2" />
          <button
            onClick={onClearAll}
            className="w-full h-[38px] flex items-center justify-center text-[#787B86] hover:text-[#F23645] hover:bg-[#F23645]/10 transition-colors"
            title={`Delete All (${drawingsCount})`}
          >
            {Icons.trash}
          </button>
        </>
      )}
    </div>
  );
}
