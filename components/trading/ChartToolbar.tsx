'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import {
  MousePointer,
  TrendingUp,
  Minus,
  Square,
  Activity,
  ArrowRight,
  MoveHorizontal,
  Trash2,
  Palette,
  Settings2,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { DrawingToolType, DRAWING_TOOLS, ToolInfo } from '@/lib/chart/primitives';

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
// ICON MAPPING
// ============================================

const TOOL_ICONS: Record<string, React.ElementType> = {
  'trend-line': TrendingUp,
  'horizontal-line': Minus,
  'vertical-line': Minus,
  'ray': ArrowRight,
  'extended-line': MoveHorizontal,
  'rectangle': Square,
  'fibonacci': Activity,
};

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
// TOOL CATEGORIES
// ============================================

interface ToolCategory {
  name: string;
  tools: ToolInfo[];
}

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    name: 'Lines',
    tools: DRAWING_TOOLS.filter(t => t.category === 'lines'),
  },
  {
    name: 'Shapes',
    tools: DRAWING_TOOLS.filter(t => t.category === 'shapes'),
  },
  {
    name: 'Fibonacci',
    tools: DRAWING_TOOLS.filter(t => t.category === 'fibonacci'),
  },
];

// ============================================
// COMPONENT
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
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [color, setColor] = useState(defaultColor);
  const [lineWidth, setLineWidth] = useState(defaultLineWidth);

  // Get active tool info
  const activeToolInfo = activeTool 
    ? DRAWING_TOOLS.find(t => t.type === activeTool)
    : null;

  // Get icon for tool
  const getToolIcon = (type: DrawingToolType): React.ElementType => {
    if (!type) return MousePointer;
    return TOOL_ICONS[type] || Activity;
  };

  const ActiveIcon = activeToolInfo ? getToolIcon(activeTool) : MousePointer;

  // Handle tool selection
  const handleToolSelect = useCallback((tool: DrawingToolType) => {
    onToolSelect(tool);
    setIsToolsOpen(false);
  }, [onToolSelect]);

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
      "flex flex-col gap-1 p-1 bg-[#1e222d] border border-[#2a2e39] rounded-lg shadow-lg",
      className
    )}>
      {/* Selection Tool */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleToolSelect(null)}
        className={cn(
          "h-9 w-9 p-0 hover:bg-[#2a2e39]",
          !activeTool ? "bg-[#2962ff] text-white" : "text-[#787b86]"
        )}
        title="Select / Move (V)"
      >
        <MousePointer className="h-4 w-4" />
      </Button>

      {/* Drawing Tools Dropdown */}
      <Popover open={isToolsOpen} onOpenChange={setIsToolsOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-9 w-9 p-0 hover:bg-[#2a2e39] relative",
              activeTool ? "bg-[#2962ff] text-white" : "text-[#787b86]"
            )}
            title="Drawing Tools"
          >
            <ActiveIcon 
              className="h-4 w-4" 
              style={{
                transform: activeTool === 'vertical-line' ? 'rotate(90deg)' : undefined
              }}
            />
            <ChevronDown className="h-2.5 w-2.5 absolute bottom-0.5 right-0.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          side="right" 
          align="start"
          className="w-56 p-2 bg-[#1e222d] border-[#2a2e39]"
        >
          <div className="space-y-3">
            {TOOL_CATEGORIES.map(category => (
              <div key={category.name}>
                <div className="text-[10px] uppercase text-[#787b86] font-semibold mb-1 px-1">
                  {category.name}
                </div>
                <div className="space-y-0.5">
                  {category.tools.map(tool => {
                    const Icon = getToolIcon(tool.type);
                    return (
                      <Button
                        key={tool.type}
                        variant="ghost"
                        onClick={() => handleToolSelect(tool.type)}
                        className={cn(
                          "w-full h-8 justify-start gap-2 px-2 text-sm",
                          activeTool === tool.type 
                            ? "bg-[#2962ff] text-white" 
                            : "text-[#d1d4dc] hover:bg-[#2a2e39]"
                        )}
                      >
                        <Icon 
                          className="h-4 w-4" 
                          style={{
                            transform: tool.type === 'vertical-line' ? 'rotate(90deg)' : undefined
                          }}
                        />
                        <span>{tool.name}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Divider */}
      <div className="h-px bg-[#2a2e39] my-1" />

      {/* Drawing Settings */}
      <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-9 w-9 p-0 hover:bg-[#2a2e39]",
              isSettingsOpen ? "bg-[#2a2e39]" : "text-[#787b86]"
            )}
            title="Drawing Settings"
          >
            <div className="relative">
              <Palette className="h-4 w-4" />
              <div 
                className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#1e222d]"
                style={{ backgroundColor: color }}
              />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          side="right" 
          align="start"
          className="w-52 p-3 bg-[#1e222d] border-[#2a2e39]"
        >
          <div className="space-y-4">
            {/* Colors */}
            <div>
              <div className="text-xs text-[#787b86] mb-2">Color</div>
              <div className="grid grid-cols-5 gap-1.5">
                {PRESET_COLORS.map(presetColor => (
                  <button
                    key={presetColor}
                    onClick={() => handleColorChange(presetColor)}
                    className={cn(
                      "h-6 w-6 rounded border-2 transition-all hover:scale-110",
                      color === presetColor 
                        ? "border-white ring-2 ring-white/30" 
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: presetColor }}
                  />
                ))}
              </div>
            </div>

            {/* Line Width */}
            <div>
              <div className="text-xs text-[#787b86] mb-2">
                Line Width: {lineWidth}px
              </div>
              <Slider
                value={[lineWidth]}
                min={1}
                max={6}
                step={1}
                onValueChange={([v]) => handleLineWidthChange(v)}
                className="w-full"
              />
            </div>

            {/* Preview */}
            <div className="p-2 bg-[#131722] rounded border border-[#2a2e39]">
              <div className="text-[10px] text-[#787b86] mb-1.5">Preview</div>
              <div 
                className="h-px rounded"
                style={{ 
                  backgroundColor: color, 
                  height: `${lineWidth}px` 
                }}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Divider */}
      <div className="h-px bg-[#2a2e39] my-1" />

      {/* Delete Selected */}
      {hasSelection && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onDeleteSelected}
          className="h-9 w-9 p-0 hover:bg-[#2a2e39] text-[#f23645]"
          title="Delete Selected (Del)"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}

      {/* Clear All */}
      {drawingsCount > 0 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onClearAll}
          className="h-9 w-9 p-0 hover:bg-[#2a2e39] text-[#787b86] hover:text-[#f23645]"
          title={`Clear All (${drawingsCount})`}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      )}

      {/* Active Tool Label */}
      {activeTool && (
        <div className="text-[9px] text-center text-[#787b86] mt-1 px-0.5 leading-tight">
          {activeToolInfo?.name || 'Tool'}
        </div>
      )}
    </div>
  );
}
