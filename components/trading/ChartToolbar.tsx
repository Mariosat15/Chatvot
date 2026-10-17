"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { DrawingToolType } from "@/lib/chart/primitives";

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
  // New props for additional controls
  onChartTypeClick?: () => void;
  onSettingsClick?: () => void;
  indicatorManager?: React.ReactNode;
}

// TradingView exact SVG icons (pixel-perfect recreations)
const Icons = {
  // Cursor/Crosshair tool
  cursor: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <g fill="currentColor" fillRule="evenodd">
        <path
          fillRule="nonzero"
          d="M12 4l7 19-4.5-3.5L11 24l-2.1-.8 3.5-4.5-5.4-1.2L12 4zm0 4l-3.5 9.2 3.3.8L9 21.5l1.5.5 2.5-3.5 2.9 2.3-3.9-10.8z"
        />
      </g>
    </svg>
  ),
  // Crosshair tool
  crosshair: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <g fill="currentColor">
        <path d="M18 15h8v-1h-8v-8h-1v8H9v1h8v8h1v-8z" />
        <path
          fillRule="evenodd"
          d="M6 14a8 8 0 1116 0 8 8 0 01-16 0zm8-7a7 7 0 100 14 7 7 0 000-14z"
        />
      </g>
    </svg>
  ),
  // Trend Line
  trendLine: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        d="M6 22L22 6"
      />
      <path
        fill="currentColor"
        d="M5 23a1 1 0 110-2 1 1 0 010 2zM23 7a1 1 0 110-2 1 1 0 010 2z"
      />
    </svg>
  ),
  // Ray
  ray: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        d="M6 22l20-20"
      />
      <path fill="currentColor" d="M5 23a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  ),
  // Extended Line (Info Line)
  infoLine: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        d="M2 19L26 9"
      />
    </svg>
  ),
  // Horizontal Line
  horizontalLine: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        d="M2 14h24"
      />
    </svg>
  ),
  // Horizontal Ray
  horizontalRay: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        d="M6 14h20"
      />
      <path fill="currentColor" d="M5 15a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  ),
  // Vertical Line
  verticalLine: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        d="M14 2v24"
      />
    </svg>
  ),
  // Cross Line
  crossLine: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        d="M14 2v24M2 14h24"
      />
    </svg>
  ),
  // Parallel Channel
  parallelChannel: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.2"
        d="M3 18l18-8M7 22l18-8"
      />
      <path
        fill="currentColor"
        d="M3 19a1 1 0 110-2 1 1 0 010 2zM21 11a1 1 0 110-2 1 1 0 010 2z"
      />
    </svg>
  ),
  // Pitchfork
  pitchfork: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        stroke="currentColor"
        strokeWidth="1.2"
        d="M4 11l10 5M4 11l20 11M14 16v8"
      />
      <circle fill="currentColor" cx="4" cy="11" r="1.5" />
      <circle fill="currentColor" cx="24" cy="22" r="1.5" />
      <circle fill="currentColor" cx="14" cy="16" r="1.5" />
    </svg>
  ),
  // Fibonacci Retracement
  fibonacci: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        stroke="currentColor"
        strokeWidth="1"
        d="M4 7h20M4 11h20M4 15h20M4 19h20M4 23h20"
      />
      <path
        fill="currentColor"
        d="M2 7a1 1 0 110-2 1 1 0 010 2zM26 23a1 1 0 110-2 1 1 0 010 2z"
      />
    </svg>
  ),
  // Gann Box
  gannBox: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <rect
        x="4"
        y="4"
        width="20"
        height="20"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      <path
        stroke="currentColor"
        strokeWidth="1"
        d="M4 4l20 20M14 4v20M4 14h20"
      />
    </svg>
  ),
  // Rectangle
  rectangle: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <rect
        x="5"
        y="7"
        width="18"
        height="14"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        rx="0.5"
      />
    </svg>
  ),
  // Ellipse
  ellipse: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <ellipse
        cx="14"
        cy="14"
        rx="10"
        ry="7"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  ),
  // Triangle
  triangle: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        d="M14 6L24 22H4z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Brush
  brush: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        d="M8 17l8-8 3 3-8 8-4 1 1-4z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M16 9l3-3 3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
  ),
  // Text
  text: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <text
        x="6"
        y="20"
        fontFamily="Arial"
        fontSize="16"
        fontWeight="bold"
        fill="currentColor"
      >
        T
      </text>
    </svg>
  ),
  // Arrow marker
  arrowMarker: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        d="M14 6v16M8 18l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Price Label
  priceLabel: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <rect
        x="4"
        y="9"
        width="20"
        height="10"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        rx="1"
      />
      <text x="8" y="17" fontFamily="Arial" fontSize="8" fill="currentColor">
        $123
      </text>
    </svg>
  ),
  // Measure/Ruler
  measure: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        d="M6 22L22 6"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      <path
        d="M6 22v-6M22 6h-6"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      <path
        fill="currentColor"
        d="M5 23a1 1 0 110-2 1 1 0 010 2zM23 7a1 1 0 110-2 1 1 0 010 2z"
      />
    </svg>
  ),
  // Zoom In
  zoomIn: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <circle
        cx="12"
        cy="12"
        r="7"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M17.5 17.5L24 24"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 9v6M9 12h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  // Magnet
  magnet: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        d="M8 4v9a6 6 0 1012 0V4"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path d="M6 4h4v3H6zM18 4h4v3h-4z" fill="currentColor" />
    </svg>
  ),
  // Stay in Drawing Mode
  stayInDrawingMode: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        d="M6 6h16v16H6z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      <path
        d="M10 14l4 4 8-10"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Lock
  lock: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <rect
        x="7"
        y="12"
        width="14"
        height="12"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        rx="1"
      />
      <path
        d="M10 12V9a4 4 0 118 0v3"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  ),
  // Hide All
  hideAll: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        d="M4 14s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <circle
        cx="14"
        cy="14"
        r="3"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M5 23L23 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  // Delete/Trash
  trash: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        fill="currentColor"
        d="M11 8V6c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v2h5v1h-1v13c0 .6-.4 1-1 1H8c-.6 0-1-.4-1-1V9H6V8h5zm1 0h4V6h-4v2zM8 9v13h12V9H8zm3 2v9h1v-9h-1zm3 0v9h1v-9h-1zm3 0v9h1v-9h-1z"
      />
    </svg>
  ),
  // Chevron indicator for submenus
  chevron: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 6 10"
      width="5"
      height="8"
    >
      <path
        d="M1 1l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Arrow Up
  arrowUp: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        d="M14 22V6M8 12l6-6 6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Long Position
  longPosition: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <rect
        x="5"
        y="14"
        width="18"
        height="10"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      <path
        d="M14 14V4M9 9l5-5 5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Short Position
  shortPosition: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <rect
        x="5"
        y="4"
        width="18"
        height="10"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      <path
        d="M14 14v10M9 19l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // XABCD Pattern
  pattern: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        d="M4 18l6-10 6 8 8-10"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      <circle cx="4" cy="18" r="1.5" fill="currentColor" />
      <circle cx="10" cy="8" r="1.5" fill="currentColor" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
      <circle cx="24" cy="6" r="1.5" fill="currentColor" />
    </svg>
  ),
  // Head and Shoulders Pattern
  headShoulders: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        d="M2 20l5-6 5 2 4-10 4 10 5-2 5 6"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Forecast
  forecast: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        d="M4 20l8-8 4 4 8-12"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M18 4h6v6"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Date Range
  dateRange: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <rect
        x="4"
        y="6"
        width="20"
        height="18"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        rx="1"
      />
      <path d="M4 11h20" stroke="currentColor" strokeWidth="1" />
      <path d="M8 4v4M20 4v4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  // Price Range
  priceRange: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        d="M14 4v20M10 8l4-4 4 4M10 20l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  // Candlestick Chart
  candlestick: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        d="M9 8v12M9 11h-2v6h2M19 6v16M19 9h-2v10h2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  ),
  // Indicators
  indicators: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <path
        d="M4 20l6-8 4 4 10-12"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="4" cy="20" r="1.5" fill="currentColor" />
      <circle cx="10" cy="12" r="1.5" fill="currentColor" />
      <circle cx="14" cy="16" r="1.5" fill="currentColor" />
      <circle cx="24" cy="4" r="1.5" fill="currentColor" />
    </svg>
  ),
  // Settings
  settings: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width="28"
      height="28"
    >
      <circle
        cx="14"
        cy="14"
        r="3"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M14 4v3M14 21v3M4 14h3M21 14h3M6.3 6.3l2.1 2.1M19.6 19.6l2.1 2.1M6.3 21.7l2.1-2.1M19.6 8.4l2.1-2.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
};

// Tool category definitions matching TradingView
const TOOL_CATEGORIES = [
  {
    id: "lines",
    icon: "trendLine",
    title: "Trend Line Tools",
    tools: [
      {
        type: "trend-line" as DrawingToolType,
        name: "Trend Line",
        icon: "trendLine",
      },
      { type: "ray" as DrawingToolType, name: "Ray", icon: "ray" },
      {
        type: "extended-line" as DrawingToolType,
        name: "Info Line",
        icon: "infoLine",
      },
      {
        type: "horizontal-line" as DrawingToolType,
        name: "Horizontal Line",
        icon: "horizontalLine",
      },
      {
        type: "vertical-line" as DrawingToolType,
        name: "Vertical Line",
        icon: "verticalLine",
      },
    ],
  },
  {
    id: "fibonacci",
    icon: "fibonacci",
    title: "Fib Retracement",
    tools: [
      {
        type: "fibonacci" as DrawingToolType,
        name: "Fib Retracement",
        icon: "fibonacci",
      },
    ],
  },
  {
    id: "shapes",
    icon: "rectangle",
    title: "Shapes",
    tools: [
      {
        type: "rectangle" as DrawingToolType,
        name: "Rectangle",
        icon: "rectangle",
      },
    ],
  },
];

// Get icon component by name
const getIcon = (name: string) =>
  Icons[name as keyof typeof Icons] || Icons.trendLine;

export default function ChartToolbar({
  activeTool,
  onToolSelect,
  onClearAll,
  drawingsCount = 0,
  className,
  onChartTypeClick,
  onSettingsClick,
  indicatorManager,
}: ChartToolbarProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [magnetMode, setMagnetMode] = useState(false);
  const [lockMode, setLockMode] = useState(false);
  const [hideDrawings, setHideDrawings] = useState(false);

  const handleToolSelect = useCallback(
    (tool: DrawingToolType) => {
      onToolSelect(tool);
      setHoveredCategory(null);
    },
    [onToolSelect],
  );

  // Find which category contains the active tool
  const getActiveCategoryIcon = (categoryId: string) => {
    const category = TOOL_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) return Icons.trendLine;
    const activeTool_ = category.tools.find((t) => t.type === activeTool);
    if (activeTool_) return getIcon(activeTool_.icon);
    return getIcon(category.icon);
  };

  const isToolInCategory = (categoryId: string) => {
    const category = TOOL_CATEGORIES.find((c) => c.id === categoryId);
    return category?.tools.some((t) => t.type === activeTool) || false;
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-[#131722] border-r border-[#2a2e39]",
        className,
      )}
    >
      {/* Cursor Tool */}
      <ToolButton
        icon={Icons.crosshair}
        title="Crosshair"
        isActive={!activeTool}
        onClick={() => handleToolSelect(null)}
      />

      <Divider />

      {/* Tool Categories with Submenus */}
      {TOOL_CATEGORIES.map((category) => (
        <div
          key={category.id}
          className="relative"
          onMouseEnter={() => setHoveredCategory(category.id)}
          onMouseLeave={() => setHoveredCategory(null)}
        >
          <ToolButton
            icon={getActiveCategoryIcon(category.id)}
            title={category.title}
            isActive={isToolInCategory(category.id)}
            hasSubmenu
            onClick={() => handleToolSelect(category.tools[0].type)}
          />

          {/* Submenu */}
          {hoveredCategory === category.id && (
            <div className="absolute left-full top-0 ml-px bg-[#1e222d] border border-[#363a45] rounded shadow-xl py-1 z-50 min-w-[180px]">
              {category.tools.map((tool) => (
                <button
                  key={tool.type}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToolSelect(tool.type);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-1.5 text-[13px] transition-colors",
                    activeTool === tool.type
                      ? "bg-[#2962FF] text-white"
                      : "text-[#d1d4dc] hover:bg-[#2a2e39]",
                  )}
                >
                  <span className="w-5 h-5 flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5">
                    {getIcon(tool.icon)}
                  </span>
                  <span>{tool.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      <Divider />

      {/* Magnet Mode */}
      <ToolButton
        icon={Icons.magnet}
        title={`Magnet Mode ${magnetMode ? "On" : "Off"}`}
        isActive={magnetMode}
        onClick={() => setMagnetMode(!magnetMode)}
      />

      {/* Lock All Drawings */}
      <ToolButton
        icon={Icons.lock}
        title={`Lock All Drawings ${lockMode ? "On" : "Off"}`}
        isActive={lockMode}
        onClick={() => setLockMode(!lockMode)}
      />

      {/* Hide All Drawings */}
      <ToolButton
        icon={Icons.hideAll}
        title={`Hide All Drawings ${hideDrawings ? "On" : "Off"}`}
        isActive={hideDrawings}
        onClick={() => setHideDrawings(!hideDrawings)}
      />

      <Divider />

      {/* Chart Type */}
      {onChartTypeClick && (
        <ToolButton
          icon={Icons.candlestick}
          title="Chart Type"
          isActive={false}
          onClick={onChartTypeClick}
        />
      )}

      {/* Indicators - render the passed component */}
      {indicatorManager && (
        <div className="flex items-center justify-center h-[34px]">
          {indicatorManager}
        </div>
      )}

      {/* Settings */}
      {onSettingsClick && (
        <ToolButton
          icon={Icons.settings}
          title="Settings"
          isActive={false}
          onClick={onSettingsClick}
        />
      )}

      <div className="flex-1" />

      {/* Delete All */}
      {drawingsCount > 0 && (
        <>
          <Divider />
          <ToolButton
            icon={Icons.trash}
            title={`Remove All Drawings (${drawingsCount})`}
            isActive={false}
            onClick={onClearAll}
            danger
          />
        </>
      )}
    </div>
  );
}

// Divider component
function Divider() {
  return <div className="h-px bg-[#2a2e39] mx-1.5 my-1" />;
}

// Tool button component
interface ToolButtonProps {
  icon: React.ReactNode;
  title: string;
  isActive: boolean;
  onClick: () => void;
  hasSubmenu?: boolean;
  disabled?: boolean;
  danger?: boolean;
}

function ToolButton({
  icon,
  title,
  isActive,
  onClick,
  hasSubmenu,
  disabled,
  danger,
}: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative w-full h-[34px] flex items-center justify-center transition-colors",
        "[&>svg]:w-[18px] [&>svg]:h-[18px]",
        isActive
          ? "text-[#2962FF] bg-[#2962FF]/10"
          : danger
            ? "text-[#787B86] hover:text-[#F23645] hover:bg-[#F23645]/10"
            : "text-[#787B86] hover:text-[#D1D4DC] hover:bg-[#2A2E39]",
        disabled &&
          "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-[#787B86]",
      )}
      title={title}
    >
      {icon}
      {hasSubmenu && (
        <span className="absolute right-1 bottom-1 text-[#787B86] opacity-60 [&>svg]:w-[5px] [&>svg]:h-[8px]">
          {Icons.chevron}
        </span>
      )}
    </button>
  );
}
