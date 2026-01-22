'use client';

import { useState, useCallback } from 'react';
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
// SVG ICONS - TradingView Style
// ============================================

const CrosshairIcon = () => (
  <svg viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
    <path d="M18 15h8v-2h-8v-8h-2v8H8v2h8v8h2v-8z"/>
  </svg>
);

const TrendLineIcon = () => (
  <svg viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
    <path d="M5.67 19.5l.7-.7L18.5 6.66V12h1V5h-7v1h5.34L5.67 18.17l.7.7-.7.63z"/>
  </svg>
);

const HorizontalLineIcon = () => (
  <svg viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
    <path d="M4 14h20v1H4v-1z"/>
  </svg>
);

const VerticalLineIcon = () => (
  <svg viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
    <path d="M14 4v20h-1V4h1z"/>
  </svg>
);

const RayIcon = () => (
  <svg viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
    <path d="M6.21 20.79l12.5-12.5-.71-.7-12.5 12.5.71.7zM5.5 21.5v-5h1v5h-1zm5-1v1h-5v-1h5z"/>
  </svg>
);

const ExtendedLineIcon = () => (
  <svg viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
    <path d="M4.5 19.5l19-15v1.14L4.68 20.5H4.5v-1zM23.5 8.5v-4h-4v1h3v3h1z"/>
  </svg>
);

const RectangleIcon = () => (
  <svg viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
    <path d="M5 7h18v14H5V7zm1 1v12h16V8H6z"/>
  </svg>
);

const FibonacciIcon = () => (
  <svg viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
    <path d="M3 6h22v1H3V6zm0 5h22v1H3v-1zm0 5h22v1H3v-1zm0 5h22v1H3v-1z"/>
  </svg>
);

const MagnetIcon = () => (
  <svg viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
    <path d="M19.85 7.65a5.5 5.5 0 00-7.78 0L4.5 15.23l.7.7 2.12-2.12 1.42 1.41 3.54-3.54-1.41-1.41 1.41-1.42a3.5 3.5 0 014.95 0l.7.71 1.42-1.41-.71-.71-2.12 2.12-1.41-1.42 3.54-3.54 1.41 1.42 1.41-1.42-.7-.7z"/>
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
    <path d="M19 12v-2a5 5 0 00-10 0v2H7v10h14V12h-2zm-8-2a3 3 0 016 0v2h-6v-2zm8 11H9V13h10v8z"/>
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
    <path d="M14 7C7.5 7 2 14 2 14s5.5 7 12 7 12-7 12-7-5.5-7-12-7zm0 12a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z"/>
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
    <path d="M18 7v1h4v1h-2v13H8V9H6V8h4V7h8zm-7 4v9h1v-9h-1zm3 0v9h1v-9h-1zm3 0v9h1v-9h-1z"/>
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 28 28" width="18" height="18" fill="currentColor">
    <path d="M14 10a4 4 0 100 8 4 4 0 000-8zm0 6a2 2 0 110-4 2 2 0 010 4z"/>
    <path d="M23.21 14l1.79-.89-.89-1.79-2-.11a8.1 8.1 0 00-.63-1.52l1.09-1.74-1.42-1.42-1.74 1.09a8.1 8.1 0 00-1.52-.63l-.11-2L16 4.1l-.89 1.79-1.74 1.09a8.1 8.1 0 00-1.52.63l-1.74-1.09-1.42 1.42 1.09 1.74a8.1 8.1 0 00-.63 1.52l-2 .11L4.79 14l1.79.89.11 2c.16.53.37 1.04.63 1.52l-1.09 1.74 1.42 1.42 1.74-1.09c.48.26.99.47 1.52.63l.11 2 1.89.89.89-1.79 1.74-1.09c.53-.16 1.04-.37 1.52-.63l1.74 1.09 1.42-1.42-1.09-1.74c.26-.48.47-.99.63-1.52l2-.11z"/>
  </svg>
);

const ChevronIcon = () => (
  <svg viewBox="0 0 6 11" width="5" height="9" fill="currentColor">
    <path d="M1 1l4 4.5L1 10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
);

// ============================================
// TOOL BUTTON COMPONENT
// ============================================

interface ToolButtonProps {
  icon: React.ReactNode;
  isActive?: boolean;
  hasSubmenu?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}

const ToolButton = ({ icon, isActive, hasSubmenu, onClick, title, className }: ToolButtonProps) => (
  <button
    onClick={onClick}
    title={title}
    className={cn(
      "relative flex items-center justify-center w-[34px] h-[34px] rounded-[4px] transition-colors duration-100",
      isActive 
        ? "bg-[#2962FF] text-white" 
        : "text-[#787B86] hover:bg-[#2A2E39] hover:text-[#D1D4DC]",
      className
    )}
  >
    {icon}
    {hasSubmenu && (
      <span className="absolute bottom-[3px] right-[3px] text-[#787B86]">
        <ChevronIcon />
      </span>
    )}
  </button>
);

// ============================================
// SUBMENU COMPONENT
// ============================================

interface SubmenuItem {
  id: DrawingToolType;
  name: string;
  icon: React.ReactNode;
}

interface ToolSubmenuProps {
  items: SubmenuItem[];
  activeTool: DrawingToolType;
  onSelect: (tool: DrawingToolType) => void;
  isOpen: boolean;
}

const ToolSubmenu = ({ items, activeTool, onSelect, isOpen }: ToolSubmenuProps) => {
  if (!isOpen) return null;
  
  return (
    <div className="absolute left-full top-0 ml-1 bg-[#1E222D] border border-[#363A45] rounded-md shadow-xl py-1 min-w-[180px] z-50">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 text-[13px] transition-colors",
            activeTool === item.id
              ? "bg-[#2962FF] text-white"
              : "text-[#D1D4DC] hover:bg-[#2A2E39]"
          )}
        >
          <span className="w-[18px] h-[18px] flex items-center justify-center">
            {item.icon}
          </span>
          <span>{item.name}</span>
        </button>
      ))}
    </div>
  );
};

// ============================================
// TOOL DEFINITIONS
// ============================================

const LINE_TOOLS: SubmenuItem[] = [
  { id: 'trend-line', name: 'Trend Line', icon: <TrendLineIcon /> },
  { id: 'ray', name: 'Ray', icon: <RayIcon /> },
  { id: 'extended-line', name: 'Extended Line', icon: <ExtendedLineIcon /> },
  { id: 'horizontal-line', name: 'Horizontal Line', icon: <HorizontalLineIcon /> },
  { id: 'vertical-line', name: 'Vertical Line', icon: <VerticalLineIcon /> },
];

const SHAPE_TOOLS: SubmenuItem[] = [
  { id: 'rectangle', name: 'Rectangle', icon: <RectangleIcon /> },
];

const FIB_TOOLS: SubmenuItem[] = [
  { id: 'fibonacci', name: 'Fib Retracement', icon: <FibonacciIcon /> },
];

// ============================================
// COLORS
// ============================================

const PRESET_COLORS = [
  '#2962FF', '#F23645', '#22AB94', '#FF9800', '#9C27B0',
  '#FFEB3B', '#00BCD4', '#E91E63', '#B2B5BE', '#787B86',
];

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
  defaultColor = '#2962FF',
  defaultLineWidth = 2,
  onColorChange,
  onLineWidthChange,
  className,
}: ChartToolbarProps) {
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const [color, setColor] = useState(defaultColor);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [drawingsVisible, setDrawingsVisible] = useState(true);
  const [magnetMode, setMagnetMode] = useState(false);
  const [lockMode, setLockMode] = useState(false);

  // Get the active icon for a tool group
  const getActiveToolIcon = (tools: SubmenuItem[]) => {
    const active = tools.find(t => t.id === activeTool);
    return active ? active.icon : tools[0].icon;
  };

  // Check if any tool in a group is active
  const isGroupActive = (tools: SubmenuItem[]) => {
    return tools.some(t => t.id === activeTool);
  };

  // Handle tool selection
  const handleToolSelect = useCallback((tool: DrawingToolType) => {
    onToolSelect(tool);
    setOpenSubmenu(null);
  }, [onToolSelect]);

  // Handle color change
  const handleColorChange = useCallback((newColor: string) => {
    setColor(newColor);
    onColorChange?.(newColor);
  }, [onColorChange]);

  // Toggle submenu
  const toggleSubmenu = (menu: string) => {
    setOpenSubmenu(prev => prev === menu ? null : menu);
    setShowColorPicker(false);
  };

  return (
    <div 
      className={cn(
        "flex flex-col bg-[#131722] border-r border-[#2A2E39] select-none",
        className
      )}
      onMouseLeave={() => {
        setOpenSubmenu(null);
        setShowColorPicker(false);
      }}
    >
      {/* Crosshair / Selection */}
      <ToolButton
        icon={<CrosshairIcon />}
        isActive={!activeTool}
        onClick={() => handleToolSelect(null)}
        title="Crosshair (Alt+C)"
      />

      {/* Separator */}
      <div className="h-px bg-[#2A2E39] mx-2 my-1" />

      {/* Trend Line Tools */}
      <div className="relative">
        <ToolButton
          icon={getActiveToolIcon(LINE_TOOLS)}
          isActive={isGroupActive(LINE_TOOLS)}
          hasSubmenu
          onClick={() => toggleSubmenu('lines')}
          title="Trend Line Tools"
        />
        <ToolSubmenu
          items={LINE_TOOLS}
          activeTool={activeTool}
          onSelect={handleToolSelect}
          isOpen={openSubmenu === 'lines'}
        />
      </div>

      {/* Fibonacci Tools */}
      <div className="relative">
        <ToolButton
          icon={getActiveToolIcon(FIB_TOOLS)}
          isActive={isGroupActive(FIB_TOOLS)}
          hasSubmenu
          onClick={() => toggleSubmenu('fib')}
          title="Fibonacci Tools"
        />
        <ToolSubmenu
          items={FIB_TOOLS}
          activeTool={activeTool}
          onSelect={handleToolSelect}
          isOpen={openSubmenu === 'fib'}
        />
      </div>

      {/* Shape Tools */}
      <div className="relative">
        <ToolButton
          icon={getActiveToolIcon(SHAPE_TOOLS)}
          isActive={isGroupActive(SHAPE_TOOLS)}
          hasSubmenu
          onClick={() => toggleSubmenu('shapes')}
          title="Geometric Shapes"
        />
        <ToolSubmenu
          items={SHAPE_TOOLS}
          activeTool={activeTool}
          onSelect={handleToolSelect}
          isOpen={openSubmenu === 'shapes'}
        />
      </div>

      {/* Separator */}
      <div className="h-px bg-[#2A2E39] mx-2 my-1" />

      {/* Color Picker */}
      <div className="relative">
        <button
          onClick={() => {
            setShowColorPicker(prev => !prev);
            setOpenSubmenu(null);
          }}
          title="Line Color"
          className="relative flex items-center justify-center w-[34px] h-[34px] rounded-[4px] text-[#787B86] hover:bg-[#2A2E39] hover:text-[#D1D4DC] transition-colors"
        >
          <div 
            className="w-[18px] h-[18px] rounded-[3px] border border-[#363A45]"
            style={{ backgroundColor: color }}
          />
          <span className="absolute bottom-[3px] right-[3px]">
            <ChevronIcon />
          </span>
        </button>
        
        {showColorPicker && (
          <div className="absolute left-full top-0 ml-1 bg-[#1E222D] border border-[#363A45] rounded-md shadow-xl p-3 z-50">
            <div className="grid grid-cols-5 gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => {
                    handleColorChange(c);
                    setShowColorPicker(false);
                  }}
                  className={cn(
                    "w-6 h-6 rounded-[3px] transition-transform hover:scale-110",
                    color === c && "ring-2 ring-white ring-offset-1 ring-offset-[#1E222D]"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="h-px bg-[#2A2E39] mx-2 my-1" />

      {/* Magnet Mode */}
      <ToolButton
        icon={<MagnetIcon />}
        isActive={magnetMode}
        onClick={() => setMagnetMode(!magnetMode)}
        title="Magnet Mode (M)"
      />

      {/* Lock Drawings */}
      <ToolButton
        icon={<LockIcon />}
        isActive={lockMode}
        onClick={() => setLockMode(!lockMode)}
        title="Lock All Drawings"
      />

      {/* Show/Hide Drawings */}
      <ToolButton
        icon={<EyeIcon />}
        isActive={!drawingsVisible}
        onClick={() => setDrawingsVisible(!drawingsVisible)}
        title={drawingsVisible ? "Hide Drawings" : "Show Drawings"}
      />

      {/* Separator */}
      <div className="h-px bg-[#2A2E39] mx-2 my-1" />

      {/* Delete All */}
      {drawingsCount > 0 && (
        <ToolButton
          icon={<TrashIcon />}
          onClick={onClearAll}
          title={`Remove All Drawings (${drawingsCount})`}
          className="text-[#787B86] hover:text-[#F23645]"
        />
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings */}
      <ToolButton
        icon={<SettingsIcon />}
        onClick={() => {}}
        title="Chart Settings"
      />
    </div>
  );
}
