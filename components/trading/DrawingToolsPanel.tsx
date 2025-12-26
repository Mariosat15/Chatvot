'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Minus,
  TrendingUp,
  Square,
  Type,
  ArrowRight,
  Target,
  Trash2,
  Pencil,
  MousePointer,
  ArrowUpRight,
  MoveHorizontal,
  Palette,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DrawingToolType, DrawingItem } from './DrawingCanvas';

interface DrawingToolsPanelProps {
  activeTool: DrawingToolType;
  drawings: DrawingItem[];
  onToolSelect: (tool: DrawingToolType) => void;
  onClearDrawings: () => void;
  onDeleteSelected?: () => void;
  selectedDrawingId?: string | null;
  onColorChange?: (color: string) => void;
  onLineWidthChange?: (width: number) => void;
  onTextSizeChange?: (size: number) => void;
  onUpdateSelectedDrawing?: (updates: Partial<DrawingItem>) => void;
  currentColor?: string;
  currentLineWidth?: number;
  currentTextSize?: number;
  portalContainer?: HTMLElement | null;
}

const DRAWING_TOOLS: { 
  tool: DrawingToolType; 
  icon: React.ElementType; 
  label: string;
  shortLabel: string;
}[] = [
  { tool: 'freehand', icon: Pencil, label: 'Freehand', shortLabel: 'Draw' },
  { tool: 'trend-line', icon: TrendingUp, label: 'Trend Line', shortLabel: 'Trend' },
  { tool: 'horizontal-line', icon: Minus, label: 'Horizontal Line', shortLabel: 'H-Line' },
  { tool: 'vertical-line', icon: Minus, label: 'Vertical Line', shortLabel: 'V-Line' },
  { tool: 'ray', icon: ArrowUpRight, label: 'Ray', shortLabel: 'Ray' },
  { tool: 'extended-line', icon: MoveHorizontal, label: 'Extended Line', shortLabel: 'Ext' },
  { tool: 'rectangle', icon: Square, label: 'Rectangle', shortLabel: 'Rect' },
  { tool: 'arrow', icon: ArrowRight, label: 'Arrow', shortLabel: 'Arrow' },
  { tool: 'text', icon: Type, label: 'Text Label', shortLabel: 'Text' },
  { tool: 'fibonacci', icon: Target, label: 'Fibonacci', shortLabel: 'Fib' },
];

const COLORS = [
  '#2962ff', '#f23645', '#22ab94', '#ff9800', '#9c27b0',
  '#ffeb3b', '#00bcd4', '#e91e63', '#ffffff', '#787b86',
];

export default function DrawingToolsPanel({
  activeTool,
  drawings,
  onToolSelect,
  onClearDrawings,
  onDeleteSelected,
  selectedDrawingId,
  onColorChange,
  onLineWidthChange,
  onTextSizeChange,
  onUpdateSelectedDrawing,
  currentColor = '#2962ff',
  currentLineWidth = 2,
  currentTextSize = 14,
  portalContainer,
}: DrawingToolsPanelProps) {
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Get the selected drawing's properties for editing
  const selectedDrawing = selectedDrawingId ? drawings.find(d => d.id === selectedDrawingId) : null;
  
  // Use selected drawing's values when editing, or default values for new drawings
  const displayColor = selectedDrawing?.color || currentColor;
  const displayLineWidth = selectedDrawing?.lineWidth || currentLineWidth;
  const displayTextSize = selectedDrawing?.fontSize || currentTextSize;

  // Handle color change - update selected or set default
  const handleColorChange = (color: string) => {
    if (selectedDrawing && onUpdateSelectedDrawing) {
      onUpdateSelectedDrawing({ color });
    }
    onColorChange?.(color);
  };

  // Handle line width change
  const handleLineWidthChange = (width: number) => {
    if (selectedDrawing && onUpdateSelectedDrawing) {
      onUpdateSelectedDrawing({ lineWidth: width });
    }
    onLineWidthChange?.(width);
  };

  // Handle text size change
  const handleTextSizeChange = (size: number) => {
    if (selectedDrawing && onUpdateSelectedDrawing) {
      onUpdateSelectedDrawing({ fontSize: size });
    }
    onTextSizeChange?.(size);
  };

  const activeTInfo = DRAWING_TOOLS.find(t => t.tool === activeTool);

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Pointer/Select */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onToolSelect(null)}
        className={cn(
          "h-8 w-10 p-0 hover:bg-[#2a2e39]",
          !activeTool ? "bg-[#2962ff] text-white" : "text-[#787b86]"
        )}
        title="Select / Move Drawings"
      >
        <MousePointer className="h-4 w-4" />
      </Button>

      {/* Drawing Tools Dialog */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsToolsOpen(true)}
        className={cn(
          "h-8 w-10 p-0 hover:bg-[#2a2e39]",
          activeTool ? "bg-[#2962ff] text-white" : "text-[#787b86]"
        )}
        title="Drawing Tools"
      >
        {activeTInfo ? (
          <activeTInfo.icon className="h-4 w-4" style={{
            transform: activeTool === 'vertical-line' ? 'rotate(90deg)' : undefined
          }} />
        ) : (
          <Pencil className="h-4 w-4" />
        )}
      </Button>

      {/* Drawing Tools Dialog */}
      <Dialog open={isToolsOpen} onOpenChange={setIsToolsOpen}>
        <DialogContent className="bg-[#131722] border-[#2b2b43] text-white max-w-sm" style={{ zIndex: 99999 }} container={portalContainer}>
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-500" />
              Drawing Tools
            </DialogTitle>
            <DialogDescription className="sr-only">Select a drawing tool</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {DRAWING_TOOLS.map(({ tool, icon: Icon, label }) => (
              <Button
                key={tool}
                variant="ghost"
                onClick={() => {
                  onToolSelect(tool);
                  setIsToolsOpen(false);
                }}
                className={cn(
                  "h-12 flex items-center justify-start gap-3 px-3 hover:bg-[#2a2e39]",
                  activeTool === tool && "bg-[#2962ff] text-white hover:bg-[#2962ff]"
                )}
              >
                <Icon className="h-5 w-5" style={{
                  transform: tool === 'vertical-line' ? 'rotate(90deg)' : undefined
                }} />
                <span className="text-sm">{label}</span>
              </Button>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-[#2b2b43] text-xs text-[#787b86]">
            💡 Click on chart to place drawings. Double-click to edit.
          </div>
        </DialogContent>
      </Dialog>

      {/* Drawing Settings Dialog */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsSettingsOpen(true)}
        className={cn(
          "h-8 w-10 p-0 hover:bg-[#2a2e39]",
          selectedDrawing ? "text-white bg-[#22ab94]" : "text-[#787b86]"
        )}
        title={selectedDrawing ? "Edit Selected Drawing" : "Drawing Settings"}
      >
        <div className="relative">
          <Palette className="h-4 w-4" />
          <div 
            className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[#131722]"
            style={{ backgroundColor: displayColor }}
          />
        </div>
      </Button>

      {/* Drawing Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="bg-[#131722] border-[#2b2b43] text-white max-w-xs" style={{ zIndex: 99999 }} container={portalContainer}>
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-blue-500" />
              {selectedDrawing ? 'Edit Selected Drawing' : 'Drawing Settings'}
            </DialogTitle>
            <DialogDescription className="sr-only">Configure drawing properties</DialogDescription>
          </DialogHeader>

          {selectedDrawing && (
            <div className="px-3 py-2 bg-[#22ab94]/20 border border-[#22ab94]/40 rounded-lg text-xs text-[#22ab94]">
              ✓ Editing: {selectedDrawing.type?.replace('-', ' ')} drawing
            </div>
          )}
          
          <div className="space-y-6 mt-4">
            {/* Color Picker */}
            <div>
              <Label className="text-sm text-white mb-3 block">Color</Label>
              <div className="grid grid-cols-5 gap-2">
                {COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => handleColorChange(color)}
                    className={cn(
                      "h-8 w-8 rounded border-2 transition-all hover:scale-110",
                      displayColor === color ? "border-white ring-2 ring-white/30" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Line Width */}
            <div>
              <Label className="text-sm text-white mb-3 block">Line Width: {displayLineWidth}px</Label>
              <Slider
                value={[displayLineWidth]}
                min={1}
                max={8}
                step={1}
                onValueChange={([value]) => handleLineWidthChange(value)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[#787b86] mt-1">
                <span>1px</span>
                <span>8px</span>
              </div>
            </div>

            {/* Text Size */}
            <div>
              <Label className="text-sm text-white mb-3 block">Text Size: {displayTextSize}px</Label>
              <Slider
                value={[displayTextSize]}
                min={10}
                max={32}
                step={2}
                onValueChange={([value]) => handleTextSizeChange(value)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[#787b86] mt-1">
                <span>10px</span>
                <span>32px</span>
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 bg-[#1e222d] rounded-lg border border-[#2b2b43]">
              <div className="text-xs text-[#787b86] mb-2">Preview</div>
              <div 
                className="h-1 rounded mb-2" 
                style={{ backgroundColor: displayColor, height: `${displayLineWidth}px` }}
              />
              <div style={{ color: displayColor, fontSize: `${displayTextSize}px` }}>
                Sample Text
              </div>
            </div>

            {selectedDrawing && (
              <div className="text-xs text-[#787b86] text-center">
                Changes apply immediately to selected drawing
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete/Clear */}
      {drawings.length > 0 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={selectedDrawingId ? onDeleteSelected : onClearDrawings}
          className="h-8 w-10 p-0 hover:bg-[#2a2e39] text-[#f23645]"
          title={selectedDrawingId ? "Delete Selected" : `Clear All (${drawings.length})`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}

      {/* Active tool indicator */}
      {activeTool && (
        <div className="text-[8px] text-center text-[#787b86] mt-1 max-w-[40px] leading-tight">
          {activeTInfo?.shortLabel}
        </div>
      )}
    </div>
  );
}
