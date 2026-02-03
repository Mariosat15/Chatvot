"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import MilestoneNode from "./MilestoneNode";
import PathConnection from "./PathConnection";
import MilestoneDetailModal from "./MilestoneDetailModal";
import { ZoomIn, ZoomOut, RotateCcw, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

// Types
export interface Milestone {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  zoneId: string;
  position: { x: number; y: number };
  nodeType: string;
  icon: string;
  color: string;
  size: string;
  completeCondition: {
    type: string;
    value?: number;
  };
  rewards: {
    xp: number;
    badgeId?: string;
    title?: string;
  };
  connectedTo: string[];
  connectedFrom: string[];
  isRequired: boolean;
  tooltipText?: string;
  celebrationText?: string;
}

export interface Zone {
  id: string;
  name: string;
  description: string;
  order: number;
  position: { x: number; y: number };
  color: string;
  icon: string;
}

export interface MapConfig {
  mapId: string;
  name: string;
  description: string;
  zones: Zone[];
  backgroundColor: string;
}

export interface JourneyMapRendererProps {
  mapConfig: MapConfig | null;
  milestones: Milestone[];
  completedIds: string[];
  unlockedIds: string[];
  currentMilestone?: string;
  onMilestoneClick?: (milestone: Milestone) => void;
  className?: string;
}

export default function JourneyMapRenderer({
  mapConfig,
  milestones,
  completedIds,
  unlockedIds,
  currentMilestone,
  onMilestoneClick,
  className,
}: JourneyMapRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Calculate viewbox dimensions based on milestones
  const viewBox = useMemo(() => {
    if (milestones.length === 0) return { minX: 0, minY: 0, width: 1200, height: 600 };
    
    const padding = 100;
    const xs = milestones.map(m => m.position.x);
    const ys = milestones.map(m => m.position.y);
    const minX = Math.min(...xs) - padding;
    const minY = Math.min(...ys) - padding;
    const maxX = Math.max(...xs) + padding;
    const maxY = Math.max(...ys) + padding;
    
    return {
      minX,
      minY,
      width: Math.max(maxX - minX, 800),
      height: Math.max(maxY - minY, 400),
    };
  }, [milestones]);

  // Get milestone status
  const getMilestoneStatus = (id: string): "completed" | "current" | "unlocked" | "locked" => {
    if (completedIds.includes(id)) return "completed";
    if (id === currentMilestone) return "current";
    if (unlockedIds.includes(id)) return "unlocked";
    return "locked";
  };

  // Handle milestone click
  const handleMilestoneClick = (milestone: Milestone) => {
    setSelectedMilestone(milestone);
    setModalOpen(true);
    onMilestoneClick?.(milestone);
  };

  // Zoom controls
  const handleZoomIn = () => setScale(s => Math.min(s + 0.2, 2));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.2, 0.5));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Center on current milestone
  const centerOnCurrent = () => {
    if (!currentMilestone || !containerRef.current) return;
    const milestone = milestones.find(m => m.id === currentMilestone);
    if (!milestone) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Calculate position to center milestone
    const newX = containerWidth / 2 - milestone.position.x * scale;
    const newY = containerHeight / 2 - milestone.position.y * scale;

    setPosition({ x: newX, y: newY });
  };

  // Drag handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handling for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(s => Math.min(Math.max(s + delta, 0.5), 2));
  };

  // Center on current on mount
  useEffect(() => {
    if (currentMilestone) {
      setTimeout(centerOnCurrent, 100);
    }
  }, [currentMilestone]);

  if (!mapConfig) {
    return (
      <div className={cn("flex items-center justify-center h-96 bg-slate-900 rounded-xl", className)}>
        <p className="text-muted-foreground">Loading journey map...</p>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <Button
          size="icon"
          variant="secondary"
          onClick={handleZoomIn}
          className="bg-background/80 backdrop-blur-sm"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={handleZoomOut}
          className="bg-background/80 backdrop-blur-sm"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={handleReset}
          className="bg-background/80 backdrop-blur-sm"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={centerOnCurrent}
          className="bg-background/80 backdrop-blur-sm"
        >
          <Compass className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-20 bg-background/80 backdrop-blur-sm rounded-lg p-3">
        <div className="text-xs font-medium mb-2">Legend</div>
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
            <span>Current</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-slate-400" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-slate-700" />
            <span>Locked</span>
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="absolute top-4 left-4 z-20 bg-background/80 backdrop-blur-sm rounded-lg p-3">
        <div className="text-sm font-medium">{mapConfig.name}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {completedIds.length} / {milestones.filter(m => m.isRequired).length} milestones
        </div>
        <div className="w-32 h-2 bg-slate-700 rounded-full mt-2 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
            initial={{ width: 0 }}
            animate={{
              width: `${(completedIds.length / Math.max(milestones.filter(m => m.isRequired).length, 1)) * 100}%`,
            }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Map Container */}
      <div
        ref={containerRef}
        className="w-full h-[500px] md:h-[600px] cursor-grab active:cursor-grabbing"
        style={{ backgroundColor: mapConfig.backgroundColor || "#0F172A" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transformOrigin: "center center",
          }}
        >
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="mapBgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="50%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="shadow">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Zone backgrounds */}
          {mapConfig.zones.map((zone, index) => {
            const zoneMilestones = milestones.filter(m => m.zoneId === zone.id);
            if (zoneMilestones.length === 0) return null;

            const xs = zoneMilestones.map(m => m.position.x);
            const ys = zoneMilestones.map(m => m.position.y);
            const padding = 60;
            const x = Math.min(...xs) - padding;
            const y = Math.min(...ys) - padding;
            const width = Math.max(...xs) - Math.min(...xs) + padding * 2;
            const height = Math.max(...ys) - Math.min(...ys) + padding * 2;

            return (
              <g key={zone.id}>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx={16}
                  fill={zone.color}
                  fillOpacity={0.05}
                  stroke={zone.color}
                  strokeOpacity={0.2}
                  strokeWidth={2}
                  strokeDasharray="10,5"
                />
                <text
                  x={x + width / 2}
                  y={y + 20}
                  fill={zone.color}
                  fontSize="14"
                  fontWeight="bold"
                  textAnchor="middle"
                  opacity={0.7}
                >
                  {zone.name}
                </text>
              </g>
            );
          })}

          {/* Path Connections */}
          {milestones.map(milestone =>
            milestone.connectedTo.map(targetId => {
              const target = milestones.find(m => m.id === targetId);
              if (!target) return null;

              const sourceStatus = getMilestoneStatus(milestone.id);
              const targetStatus = getMilestoneStatus(targetId);
              const isActive = sourceStatus === "completed" || sourceStatus === "current";

              return (
                <PathConnection
                  key={`${milestone.id}-${targetId}`}
                  start={milestone.position}
                  end={target.position}
                  color={milestone.color}
                  isActive={isActive}
                  isBranch={milestone.nodeType === "branch"}
                  animated={sourceStatus === "current"}
                />
              );
            })
          )}

          {/* Milestone Nodes */}
          {milestones.map(milestone => (
            <MilestoneNode
              key={milestone.id}
              milestone={milestone}
              status={getMilestoneStatus(milestone.id)}
              onClick={() => handleMilestoneClick(milestone)}
            />
          ))}
        </svg>
      </div>

      {/* Milestone Detail Modal */}
      <AnimatePresence>
        {modalOpen && selectedMilestone && (
          <MilestoneDetailModal
            milestone={selectedMilestone}
            status={getMilestoneStatus(selectedMilestone.id)}
            open={modalOpen}
            onClose={() => {
              setModalOpen(false);
              setSelectedMilestone(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
