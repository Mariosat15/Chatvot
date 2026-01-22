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
  ChevronRight,
  RotateCcw,
  Crosshair,
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
// COLORS - TradingView palette
// ============================================

const PRESET_COLORS = [
  '#2962FF', // Blue (TradingView primary)
  '#F23645', // Red
  '#22AB94', // Green (TradingView up)
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#FFEB3B', // Yellow
  '#00BCD4', // Cyan
  '#E91E63', // Pink
  '#B2B5BE', // Light gray
  '#787B86', // Gray
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
  defaultColor = '#2962FF',
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
    if (!type) return Crosshair;
    return TOOL_ICONS[type] || Activity;
  };

  const ActiveIcon = activeToolInfo ? getToolIcon(activeTool) : Crosshair;

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
    <TooltipProvider delayDuration={200}>
      <div className={cn(
        "flex flex-col gap-0.5 p-1.5 bg-[#1E222D]/95 backdrop-blur-sm border border-[#363A45] rounded-lg shadow-xl",
        className
      )}>
        {/* Selection Tool */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleToolSelect(null)}
              className={cn(
                "h-8 w-8 p-0 rounded-md transition-all duration-150",
                !activeTool 
                  ? "bg-[#2962FF] text-white shadow-lg shadow-[#2962FF]/20" 
                  : "text-[#787B86] hover:text-[#B2B5BE] hover:bg-[#2A2E39]"
              )}
            >
              <Crosshair className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-[#2A2E39] border-[#363A45] text-[#B2B5BE]">
            <p className="text-xs">Crosshair / Select <span className="text-[#787B86] ml-1">V</span></p>
          </TooltipContent>
        </Tooltip>

        {/* Divider */}
        <div className="h-px bg-[#363A45]/50 my-1 mx-1" />

        {/* Drawing Tools Dropdown */}
        <Popover open={isToolsOpen} onOpenChange={setIsToolsOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8 p-0 rounded-md transition-all duration-150 relative group",
                    activeTool 
                      ? "bg-[#2962FF] text-white shadow-lg shadow-[#2962FF]/20" 
                      : "text-[#787B86] hover:text-[#B2B5BE] hover:bg-[#2A2E39]"
                  )}
                >
                  <ActiveIcon 
                    className="h-4 w-4" 
                    style={{
                      transform: activeTool === 'vertical-line' ? 'rotate(90deg)' : undefined
                    }}
                  />
                  <ChevronRight className="h-2 w-2 absolute bottom-0.5 right-0.5 opacity-60" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-[#2A2E39] border-[#363A45] text-[#B2B5BE]">
              <p className="text-xs">Drawing Tools</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent 
            side="right" 
            align="start"
            sideOffset={8}
            className="w-52 p-2 bg-[#1E222D] border-[#363A45] shadow-2xl"
          >
            <div className="space-y-2">
              {TOOL_CATEGORIES.map(category => (
                <div key={category.name}>
                  <div className="text-[10px] uppercase tracking-wider text-[#787B86] font-medium mb-1.5 px-2">
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
                            "w-full h-8 justify-start gap-2.5 px-2 text-[13px] rounded-md transition-all duration-150",
                            activeTool === tool.type 
                              ? "bg-[#2962FF] text-white" 
                              : "text-[#B2B5BE] hover:bg-[#2A2E39] hover:text-white"
                          )}
                        >
                          <Icon 
                            className="h-4 w-4 flex-shrink-0" 
                            style={{
                              transform: tool.type === 'vertical-line' ? 'rotate(90deg)' : undefined
                            }}
                          />
                          <span className="truncate">{tool.name}</span>
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
        <div className="h-px bg-[#363A45]/50 my-1 mx-1" />

        {/* Drawing Settings */}
        <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "h-8 w-8 p-0 rounded-md transition-all duration-150",
                    isSettingsOpen 
                      ? "bg-[#2A2E39] text-[#B2B5BE]" 
                      : "text-[#787B86] hover:text-[#B2B5BE] hover:bg-[#2A2E39]"
                  )}
                >
                  <div className="relative">
                    <Palette className="h-4 w-4" />
                    <div 
                      className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-[#1E222D]"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-[#2A2E39] border-[#363A45] text-[#B2B5BE]">
              <p className="text-xs">Style Settings</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent 
            side="right" 
            align="start"
            sideOffset={8}
            className="w-48 p-3 bg-[#1E222D] border-[#363A45] shadow-2xl"
          >
            <div className="space-y-4">
              {/* Colors */}
              <div>
                <div className="text-[11px] text-[#787B86] mb-2 font-medium">Color</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {PRESET_COLORS.map(presetColor => (
                    <button
                      key={presetColor}
                      onClick={() => handleColorChange(presetColor)}
                      className={cn(
                        "h-5 w-5 rounded transition-transform duration-150 hover:scale-110",
                        color === presetColor 
                          ? "ring-2 ring-white ring-offset-1 ring-offset-[#1E222D]" 
                          : "ring-1 ring-[#363A45]/50"
                      )}
                      style={{ backgroundColor: presetColor }}
                    />
                  ))}
                </div>
              </div>

              {/* Line Width */}
              <div>
                <div className="text-[11px] text-[#787B86] mb-2 font-medium">
                  Width: <span className="text-[#B2B5BE]">{lineWidth}px</span>
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
              <div className="p-2 bg-[#131722] rounded-md border border-[#363A45]/50">
                <div className="text-[10px] text-[#787B86] mb-1.5">Preview</div>
                <div 
                  className="rounded-full"
                  style={{ 
                    backgroundColor: color, 
                    height: `${lineWidth}px` 
                  }}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Divider - only show if there are action buttons */}
        {(hasSelection || drawingsCount > 0) && (
          <div className="h-px bg-[#363A45]/50 my-1 mx-1" />
        )}

        {/* Delete Selected */}
        {hasSelection && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={onDeleteSelected}
                className="h-8 w-8 p-0 rounded-md text-[#F23645] hover:bg-[#F23645]/10 hover:text-[#F23645] transition-all duration-150"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-[#2A2E39] border-[#363A45] text-[#B2B5BE]">
              <p className="text-xs">Delete <span className="text-[#787B86] ml-1">Del</span></p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Clear All */}
        {drawingsCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClearAll}
                className="h-8 w-8 p-0 rounded-md text-[#787B86] hover:bg-[#F23645]/10 hover:text-[#F23645] transition-all duration-150"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-[#2A2E39] border-[#363A45] text-[#B2B5BE]">
              <p className="text-xs">Clear All ({drawingsCount})</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
