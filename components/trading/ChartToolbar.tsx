'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { DrawingToolType, DRAWING_TOOLS } from '@/lib/chart/primitives';

// ============================================
// TYPES
// ============================================

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

// ============================================
// TRADINGVIEW-STYLE SVG ICONS
// ============================================

// Crosshair/Cursor icon
const CrosshairIcon = () => (
  <svg viewBox="0 0 28 28" className="w-[18px] h-[18px]" fill="currentColor">
    <path d="M18 15h8v-1h-8v-8h-1v8H9v1h8v8h1z"/>
  </svg>
);

// Trend Line icon
const TrendLineIcon = () => (
  <svg viewBox="0 0 28 28" className="w-[18px] h-[18px]" fill="currentColor">
    <path d="M5.78 21.36l16.14-16.14.7.72L6.5 22.07l-.71-.7z"/>
    <path d="M22.61 6.92l-4.24-1.06 1.06 4.24 3.18-3.18z"/>
  </svg>
);

// Horizontal Line icon
const HorizontalLineIcon = () => (
  <svg viewBox="0 0 28 28" className="w-[18px] h-[18px]" fill="currentColor">
    <path d="M4 14h20v1H4z"/>
  </svg>
);

// Vertical Line icon
const VerticalLineIcon = () => (
  <svg viewBox="0 0 28 28" className="w-[18px] h-[18px]" fill="currentColor">
    <path d="M14 4v20h-1V4z"/>
  </svg>
);

// Ray icon
const RayIcon = () => (
  <svg viewBox="0 0 28 28" className="w-[18px] h-[18px]" fill="currentColor">
    <path d="M5.71 21.29l15.3-15.3.7.72-15.28 15.28-.72-.7z"/>
    <path d="M21.5 6.5L21.5 10.5 22.5 10.5 22.5 5.5 17.5 5.5 17.5 6.5z"/>
  </svg>
);

// Extended Line icon
const ExtendedLineIcon = () => (
  <svg viewBox="0 0 28 28" className="w-[18px] h-[18px]" fill="currentColor">
    <path d="M5.64 21.36l16.72-16.72.7.72-16.7 16.7-.72-.7z"/>
    <path d="M17.5 5.5L22.5 5.5 22.5 10.5 21.5 10.5 21.5 6.5 17.5 6.5z"/>
    <path d="M10.5 22.5L5.5 22.5 5.5 17.5 6.5 17.5 6.5 21.5 10.5 21.5z"/>
  </svg>
);

// Rectangle icon
const RectangleIcon = () => (
  <svg viewBox="0 0 28 28" className="w-[18px] h-[18px]" fill="currentColor">
    <path d="M5.5 7.5v13h17v-13h-17zm16 12h-15v-11h15v11z"/>
  </svg>
);

// Fibonacci icon
const FibonacciIcon = () => (
  <svg viewBox="0 0 28 28" className="w-[18px] h-[18px]" fill="currentColor">
    <path d="M3 6h22v1H3zM3 13.5h22v1H3zM3 21h22v1H3z"/>
    <path d="M8 9h1v10H8zM19 9h1v10h-1z"/>
  </svg>
);

// Text icon
const TextIcon = () => (
  <svg viewBox="0 0 28 28" className="w-[18px] h-[18px]" fill="currentColor">
    <path d="M6 7h16v2h-7v12h-2V9H6z"/>
  </svg>
);

// Eraser/Delete icon
const EraserIcon = () => (
  <svg viewBox="0 0 28 28" className="w-[18px] h-[18px]" fill="currentColor">
    <path d="M8.354 6.94L21.06 19.647l-.707.707L7.647 7.647l.707-.707zm-3.208 8.5l6.354-6.354 7.414 7.414-3.88 3.88a1.5 1.5 0 01-2.12 0l-7.768-7.768v2.828zm7.061-7.061L6.147 14.44l5.414 5.414a.5.5 0 00.707 0l3.172-3.172-3.233-3.303z"/>
  </svg>
);

// Lock icon
const LockIcon = () => (
  <svg viewBox="0 0 28 28" className="w-[18px] h-[18px]" fill="currentColor">
    <path d="M18 11V9c0-2.21-1.79-4-4-4s-4 1.79-4 4v2H8v10h12V11h-2zm-7-2c0-1.65 1.35-3 3-3s3 1.35 3 3v2h-6V9zm8 11H9v-8h10v8z"/>
  </svg>
);

// Magnet icon
const MagnetIcon = () => (
  <svg viewBox="0 0 28 28" className="w-[18px] h-[18px]" fill="currentColor">
    <path d="M19 7v6a5 5 0 01-10 0V7H7v6a7 7 0 1014 0V7h-2zM9 6h2v4H9zm8 0h2v4h-2z"/>
  </svg>
);

// Zoom In icon
const ZoomInIcon = () => (
  <svg viewBox="0 0 28 28" className="w-[18px] h-[18px]" fill="currentColor">
    <path d="M19.41 18.71l4.24 4.24-.7.7-4.25-4.24a8.5 8.5 0 111.42-1.42l-.71.72zM12.5 20a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"/>
    <path d="M12 12V9h1v3h3v1h-3v3h-1v-3H9v-1h3z"/>
  </svg>
);

// Settings/Gear icon
const SettingsIcon = () => (
  <svg viewBox="0 0 28 28" className="w-[18px] h-[18px]" fill="currentColor">
    <path d="M14 17a3 3 0 100-6 3 3 0 000 6zm0-1a2 2 0 110-4 2 2 0 010 4z"/>
    <path d="M5.5 14c0-.54.05-1.07.14-1.59l-1.48-1.16.5-.87 1.74.74c.35-.51.76-.96 1.22-1.35l-.48-1.8.87-.5 1.12 1.51c.53-.24 1.1-.41 1.68-.5l.69-1.73h1l.69 1.74c.59.1 1.15.27 1.68.5l1.12-1.51.87.5-.48 1.8c.46.39.87.84 1.22 1.35l1.74-.74.5.87-1.48 1.16c.09.52.14 1.05.14 1.59s-.05 1.07-.14 1.59l1.48 1.16-.5.87-1.74-.74c-.35.51-.76.96-1.22 1.35l.48 1.8-.87.5-1.12-1.51c-.53.24-1.1.41-1.68.5l-.69 1.73h-1l-.69-1.74a6.97 6.97 0 01-1.68-.5l-1.12 1.51-.87-.5.48-1.8a6.97 6.97 0 01-1.22-1.35l-1.74.74-.5-.87 1.48-1.16c-.09-.52-.14-1.05-.14-1.59zm1 0c0 .45.04.89.13 1.31l.11.53-.47.36-1.07.84.14.25 1.26-.54.42-.18.32.35c.36.39.77.74 1.23 1.03l.4.25-.16.62-.35 1.3.23.13.81-1.1.32-.42.5.2c.54.22 1.12.37 1.72.44l.54.06.25.63.5 1.25h.26l.5-1.25.25-.63.54-.06c.6-.07 1.18-.22 1.72-.44l.5-.2.32.42.81 1.1.23-.13-.35-1.3-.16-.62.4-.25c.46-.29.87-.64 1.23-1.03l.32-.35.42.18 1.26.54.14-.25-1.07-.84-.47-.36.11-.53c.09-.42.13-.86.13-1.31s-.04-.89-.13-1.31l-.11-.53.47-.36 1.07-.84-.14-.25-1.26.54-.42.18-.32-.35a5.97 5.97 0 00-1.23-1.03l-.4-.25.16-.62.35-1.3-.23-.13-.81 1.1-.32.42-.5-.2a5.97 5.97 0 00-1.72-.44l-.54-.06-.25-.63-.5-1.25h-.26l-.5 1.25-.25.63-.54.06c-.6.07-1.18.22-1.72.44l-.5.2-.32-.42-.81-1.1-.23.13.35 1.3.16.62-.4.25c-.46.29-.87.64-1.23 1.03l-.32.35-.42-.18-1.26-.54-.14.25 1.07.84.47.36-.11.53c-.09.42-.13.86-.13 1.31z"/>
  </svg>
);

// Trash icon
const TrashIcon = () => (
  <svg viewBox="0 0 28 28" className="w-[18px] h-[18px]" fill="currentColor">
    <path d="M18 7v1h3v1h-1v13H8V9H7V8h3V7h8zm-7 0v1h6V7h-6zm7 3H10v11h8V10z"/>
    <path d="M12 11h1v8h-1zM15 11h1v8h-1z"/>
  </svg>
);

// Measure icon
const MeasureIcon = () => (
  <svg viewBox="0 0 28 28" className="w-[18px] h-[18px]" fill="currentColor">
    <path d="M7.5 6v16h1V6h-1zM19.5 6v16h1V6h-1z"/>
    <path d="M9 14h10v1H9z"/>
    <path d="M9 13l3 2-3 2v-4zM19 13l-3 2 3 2v-4z"/>
  </svg>
);

// ============================================
// COLORS
// ============================================

const PRESET_COLORS = [
  '#2962ff', // Blue
  '#f23645', // Red  
  '#22ab94', // Green
  '#ff9800', // Orange
  '#9c27b0', // Purple
  '#ffeb3b', // Yellow
  '#00bcd4', // Cyan
  '#e91e63', // Pink
  '#ffffff', // White
  '#787b86', // Gray
];

// ============================================
// TOOL BUTTON COMPONENT
// ============================================

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  isActive?: boolean;
  onClick: () => void;
  className?: string;
  danger?: boolean;
}

const ToolButton = ({ icon, label, shortcut, isActive, onClick, className, danger }: ToolButtonProps) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "w-[34px] h-[34px] flex items-center justify-center rounded transition-colors",
            isActive 
              ? "bg-[#2962ff] text-white" 
              : danger
                ? "text-[#787b86] hover:text-[#f23645] hover:bg-[#2a2e39]"
                : "text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39]",
            className
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="bg-[#1e222d] border-[#363a45] text-white text-xs">
        <div className="flex items-center gap-2">
          <span>{label}</span>
          {shortcut && <span className="text-[#787b86]">{shortcut}</span>}
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// ============================================
// DIVIDER COMPONENT
// ============================================

const ToolbarDivider = () => (
  <div className="h-[1px] w-[26px] bg-[#363a45] mx-auto my-1" />
);

// ============================================
// MAIN COMPONENT
// ============================================

export default function ChartToolbar({
  activeTool,
  onToolSelect,
  onClearAll,
  onDeleteSelected,
  hasSelection = false,
  drawingsCount = 0,
  defaultColor = '#2962ff',
  defaultLineWidth = 2,
  onColorChange,
  onLineWidthChange,
  className,
}: ChartToolbarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [color, setColor] = useState(defaultColor);
  const [lineWidth, setLineWidth] = useState(defaultLineWidth);

  // Handle color change
  const handleColorChange = useCallback((newColor: string) => {
    setColor(newColor);
    onColorChange?.(newColor);
  }, [onColorChange]);

  // Handle line width change
  const handleLineWidthChange = useCallback((newWidth: number) => {
    setLineWidth(newWidth);
    onLineWidthChange?.(newWidth);
  }, [onLineWidthChange]);

  return (
    <div className={cn(
      "flex flex-col items-center py-1 bg-[#131722] border-r border-[#1e222d] w-[44px]",
      className
    )}>
      {/* Cursor/Selection Tool */}
      <ToolButton
        icon={<CrosshairIcon />}
        label="Crosshair"
        shortcut="Esc"
        isActive={!activeTool}
        onClick={() => onToolSelect(null)}
      />

      <ToolbarDivider />

      {/* Lines Category */}
      <ToolButton
        icon={<TrendLineIcon />}
        label="Trend Line"
        shortcut="Alt+T"
        isActive={activeTool === 'trend-line'}
        onClick={() => onToolSelect('trend-line')}
      />
      
      <ToolButton
        icon={<HorizontalLineIcon />}
        label="Horizontal Line"
        shortcut="Alt+H"
        isActive={activeTool === 'horizontal-line'}
        onClick={() => onToolSelect('horizontal-line')}
      />
      
      <ToolButton
        icon={<VerticalLineIcon />}
        label="Vertical Line"
        shortcut="Alt+V"
        isActive={activeTool === 'vertical-line'}
        onClick={() => onToolSelect('vertical-line')}
      />

      <ToolButton
        icon={<RayIcon />}
        label="Ray"
        isActive={activeTool === 'ray'}
        onClick={() => onToolSelect('ray')}
      />

      <ToolButton
        icon={<ExtendedLineIcon />}
        label="Extended Line"
        isActive={activeTool === 'extended-line'}
        onClick={() => onToolSelect('extended-line')}
      />

      <ToolbarDivider />

      {/* Shapes Category */}
      <ToolButton
        icon={<RectangleIcon />}
        label="Rectangle"
        shortcut="Alt+R"
        isActive={activeTool === 'rectangle'}
        onClick={() => onToolSelect('rectangle')}
      />

      <ToolbarDivider />

      {/* Fibonacci Category */}
      <ToolButton
        icon={<FibonacciIcon />}
        label="Fibonacci Retracement"
        shortcut="Alt+F"
        isActive={activeTool === 'fibonacci'}
        onClick={() => onToolSelect('fibonacci')}
      />

      <ToolbarDivider />

      {/* Measure Tool */}
      <ToolButton
        icon={<MeasureIcon />}
        label="Measure"
        isActive={activeTool === 'measure' as any}
        onClick={() => {}}
        className="opacity-50 cursor-not-allowed"
      />

      {/* Text Tool */}
      <ToolButton
        icon={<TextIcon />}
        label="Text"
        isActive={activeTool === 'text' as any}
        onClick={() => {}}
        className="opacity-50 cursor-not-allowed"
      />

      <div className="flex-1" />

      <ToolbarDivider />

      {/* Settings/Color Picker */}
      <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "w-[34px] h-[34px] flex items-center justify-center rounded transition-colors relative",
              isSettingsOpen ? "bg-[#2a2e39]" : "hover:bg-[#2a2e39]"
            )}
          >
            <SettingsIcon />
            <div 
              className="absolute bottom-1 right-1 w-2 h-2 rounded-full border border-[#131722]"
              style={{ backgroundColor: color }}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent 
          side="right" 
          align="end"
          sideOffset={8}
          className="w-52 p-3 bg-[#1e222d] border-[#363a45]"
        >
          <div className="space-y-4">
            {/* Colors */}
            <div>
              <div className="text-[11px] text-[#787b86] mb-2 uppercase font-medium">Color</div>
              <div className="grid grid-cols-5 gap-1.5">
                {PRESET_COLORS.map(presetColor => (
                  <button
                    key={presetColor}
                    onClick={() => handleColorChange(presetColor)}
                    className={cn(
                      "h-6 w-6 rounded transition-all hover:scale-110",
                      color === presetColor 
                        ? "ring-2 ring-white ring-offset-1 ring-offset-[#1e222d]" 
                        : ""
                    )}
                    style={{ backgroundColor: presetColor }}
                  />
                ))}
              </div>
            </div>

            {/* Line Width */}
            <div>
              <div className="text-[11px] text-[#787b86] mb-2 uppercase font-medium">
                Width: {lineWidth}px
              </div>
              <Slider
                value={[lineWidth]}
                min={1}
                max={5}
                step={1}
                onValueChange={([v]) => handleLineWidthChange(v)}
                className="w-full"
              />
            </div>

            {/* Preview */}
            <div className="pt-2 border-t border-[#363a45]">
              <div className="text-[10px] text-[#787b86] mb-2">Preview</div>
              <div className="h-8 bg-[#131722] rounded flex items-center justify-center">
                <div 
                  className="w-16 rounded"
                  style={{ 
                    backgroundColor: color, 
                    height: `${lineWidth}px` 
                  }}
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Magnet */}
      <ToolButton
        icon={<MagnetIcon />}
        label="Magnet Mode"
        onClick={() => {}}
        className="opacity-50 cursor-not-allowed"
      />

      {/* Lock */}
      <ToolButton
        icon={<LockIcon />}
        label="Lock All Drawings"
        onClick={() => {}}
        className="opacity-50 cursor-not-allowed"
      />

      <ToolbarDivider />

      {/* Delete Selected */}
      {hasSelection && (
        <ToolButton
          icon={<EraserIcon />}
          label="Delete Selected"
          shortcut="Del"
          onClick={onDeleteSelected || (() => {})}
          danger
        />
      )}

      {/* Clear All */}
      {drawingsCount > 0 && (
        <ToolButton
          icon={<TrashIcon />}
          label={`Remove All Drawings (${drawingsCount})`}
          onClick={onClearAll}
          danger
        />
      )}
    </div>
  );
}
