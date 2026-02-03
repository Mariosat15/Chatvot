"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import MilestoneDetailModal from "./MilestoneDetailModal";
import { ZoomIn, ZoomOut, RotateCcw, Compass, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

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
  backgroundImage?: string;
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

// Treasure map dimensions (based on the image aspect ratio ~1.5:1)
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 800;

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
  const [scale, setScale] = useState(0.8);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Get milestone status
  const getMilestoneStatus = (id: string): "completed" | "current" | "unlocked" | "locked" => {
    if (completedIds.includes(id)) return "completed";
    if (id === currentMilestone) return "current";
    if (unlockedIds.includes(id)) return "unlocked";
    return "locked";
  };

  // Handle milestone click
  const handleMilestoneClick = (milestone: Milestone) => {
    const status = getMilestoneStatus(milestone.id);
    if (status === "locked") return;
    setSelectedMilestone(milestone);
    setModalOpen(true);
    onMilestoneClick?.(milestone);
  };

  // Center the map in the container
  const centerMap = (currentScale?: number) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const useScale = currentScale ?? scale;
    
    // Calculate position to center the map
    const scaledMapWidth = MAP_WIDTH * useScale;
    const scaledMapHeight = MAP_HEIGHT * useScale;
    const centerX = (containerWidth - scaledMapWidth) / 2;
    const centerY = (containerHeight - scaledMapHeight) / 2;
    
    setPosition({ x: centerX, y: centerY });
  };

  // Zoom controls
  const handleZoomIn = () => {
    const newScale = Math.min(scale + 0.15, 2);
    setScale(newScale);
    // Re-center after zoom
    setTimeout(() => centerMap(newScale), 0);
  };
  
  const handleZoomOut = () => {
    const newScale = Math.max(scale - 0.15, 0.4);
    setScale(newScale);
    // Re-center after zoom
    setTimeout(() => centerMap(newScale), 0);
  };
  
  const handleReset = () => {
    setScale(0.8);
    setTimeout(() => centerMap(0.8), 0);
  };

  // Center on current milestone
  const centerOnCurrent = () => {
    if (!currentMilestone || !containerRef.current) return;
    const milestone = milestones.find(m => m.id === currentMilestone);
    if (!milestone) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const newX = containerWidth / 2 - milestone.position.x * scale;
    const newY = containerHeight / 2 - milestone.position.y * scale;

    setPosition({ x: newX, y: newY });
  };

  // Drag handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
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

  const handleMouseUp = () => setIsDragging(false);

  // Touch handling
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

  // Center map on initial load
  useEffect(() => {
    if (!isInitialized && containerRef.current) {
      // Small delay to ensure container is rendered
      setTimeout(() => {
        centerMap(0.8);
        setIsInitialized(true);
      }, 100);
    }
  }, [isInitialized]);

  // Center on current milestone if provided
  useEffect(() => {
    if (currentMilestone && isInitialized) {
      setTimeout(centerOnCurrent, 100);
    }
  }, [currentMilestone, isInitialized]);

  if (!mapConfig) {
    return (
      <div className={cn("flex items-center justify-center h-96 bg-slate-900 rounded-xl", className)}>
        <p className="text-muted-foreground">Loading journey map...</p>
      </div>
    );
  }

  // Get node style based on status
  const getNodeStyle = (status: "completed" | "current" | "unlocked" | "locked", size: string) => {
    // Bigger sizes for better visibility
    const sizeMap = { small: 40, medium: 50, large: 60 };
    const nodeSize = sizeMap[size as keyof typeof sizeMap] || 50;
    
    const baseStyle = {
      width: nodeSize,
      height: nodeSize,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: status === "locked" ? "not-allowed" : "pointer",
      transition: "all 0.3s ease",
      fontSize: nodeSize * 0.45,
    };

    switch (status) {
      case "completed":
        return {
          ...baseStyle,
          background: "linear-gradient(135deg, #22C55E, #16A34A)",
          boxShadow: "0 0 25px rgba(34, 197, 94, 0.7), 0 4px 15px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.3)",
          border: "4px solid #86EFAC",
        };
      case "current":
        return {
          ...baseStyle,
          background: "linear-gradient(135deg, #3B82F6, #2563EB)",
          boxShadow: "0 0 30px rgba(59, 130, 246, 0.9), 0 4px 15px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.3)",
          border: "4px solid #93C5FD",
          animation: "pulse 2s infinite",
        };
      case "unlocked":
        return {
          ...baseStyle,
          background: "linear-gradient(135deg, #F59E0B, #D97706)",
          boxShadow: "0 0 20px rgba(245, 158, 11, 0.5), 0 4px 15px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2)",
          border: "4px solid #FCD34D",
        };
      case "locked":
        return {
          ...baseStyle,
          background: "linear-gradient(135deg, #6B7280, #4B5563)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.3)",
          border: "4px solid #9CA3AF",
          opacity: 0.85,
        };
    }
  };

  // Draw path between nodes
  const renderPath = (from: Milestone, to: Milestone) => {
    const fromStatus = getMilestoneStatus(from.id);
    const isCompleted = fromStatus === "completed";
    
    return (
      <svg
        key={`path-${from.id}-${to.id}`}
        className="absolute top-0 left-0 pointer-events-none"
        style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}
      >
        <defs>
          <filter id="pathGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path
          d={`M ${from.position.x} ${from.position.y} Q ${(from.position.x + to.position.x) / 2} ${Math.min(from.position.y, to.position.y) - 30} ${to.position.x} ${to.position.y}`}
          fill="none"
          stroke={isCompleted ? "#22C55E" : "#FFFFFF"}
          strokeWidth={isCompleted ? 4 : 3}
          strokeDasharray={isCompleted ? "none" : "8,8"}
          strokeLinecap="round"
          opacity={isCompleted ? 0.9 : 0.4}
          filter={isCompleted ? "url(#pathGlow)" : "none"}
        />
      </svg>
    );
  };

  return (
    <div className={cn("relative overflow-hidden rounded-xl border-4 border-amber-900/50", className)}>
      {/* Decorative frame corners */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-700 rounded-tl-lg z-30" />
      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-700 rounded-tr-lg z-30" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-700 rounded-bl-lg z-30" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-700 rounded-br-lg z-30" />

      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <Button
          size="icon"
          variant="secondary"
          onClick={handleZoomIn}
          className="bg-amber-900/80 hover:bg-amber-800 border border-amber-700 text-amber-100"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={handleZoomOut}
          className="bg-amber-900/80 hover:bg-amber-800 border border-amber-700 text-amber-100"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={handleReset}
          className="bg-amber-900/80 hover:bg-amber-800 border border-amber-700 text-amber-100"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          onClick={centerOnCurrent}
          className="bg-amber-900/80 hover:bg-amber-800 border border-amber-700 text-amber-100"
        >
          <Compass className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-20 bg-amber-950/90 backdrop-blur-sm rounded-lg p-3 border border-amber-800">
        <div className="text-xs font-medium mb-2 text-amber-200 flex items-center gap-2">
          <Ship className="h-4 w-4" />
          Legend
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-amber-100">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            <span>Conquered</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
            <span>Current</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-slate-600 opacity-60" />
            <span>Locked</span>
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="absolute top-4 left-4 z-20 bg-amber-950/90 backdrop-blur-sm rounded-lg p-3 border border-amber-800">
        <div className="text-sm font-medium text-amber-200">{mapConfig.name}</div>
        <div className="text-xs text-amber-300/70 mt-1">
          {completedIds.length} / {milestones.filter(m => m.isRequired).length} milestones conquered
        </div>
        <div className="w-32 h-2 bg-amber-900 rounded-full mt-2 overflow-hidden border border-amber-700">
          <motion.div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
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
        className="w-full h-[500px] md:h-[600px] cursor-grab active:cursor-grabbing overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        {/* Map content wrapper */}
        <div
          className="relative"
          style={{
            width: MAP_WIDTH,
            height: MAP_HEIGHT,
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {/* Treasure Map Background */}
          <Image
            src="/assets/treasure-map.png"
            alt="Treasure Map"
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            className="absolute top-0 left-0 object-cover"
            style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}
            priority
            draggable={false}
          />

          {/* Path Connections */}
          {milestones.map(milestone =>
            milestone.connectedTo.map(targetId => {
              const target = milestones.find(m => m.id === targetId);
              if (!target) return null;
              return renderPath(milestone, target);
            })
          )}

          {/* Milestone Nodes */}
          {milestones.map(milestone => {
            const status = getMilestoneStatus(milestone.id);
            const style = getNodeStyle(status, milestone.size);
            
            return (
              <motion.div
                key={milestone.id}
                className="absolute"
                style={{
                  left: milestone.position.x - (style.width as number) / 2,
                  top: milestone.position.y - (style.height as number) / 2,
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring" }}
              >
                {/* Node */}
                <motion.div
                  style={style as any}
                  onClick={() => handleMilestoneClick(milestone)}
                  whileHover={status !== "locked" ? { scale: 1.12 } : {}}
                  whileTap={status !== "locked" ? { scale: 0.95 } : {}}
                  className="relative"
                >
                  {/* Icon/Status indicator - bigger and clearer */}
                  {status === "completed" ? (
                    <span className="text-white text-2xl font-bold drop-shadow-lg">✓</span>
                  ) : status === "locked" ? (
                    <span className="text-xl drop-shadow-md">🔒</span>
                  ) : status === "current" ? (
                    <span className="text-2xl drop-shadow-lg">⭐</span>
                  ) : (
                    <span className="text-xl drop-shadow-lg">🏝️</span>
                  )}

                  {/* XP Badge */}
                  {status !== "locked" && milestone.rewards.xp > 0 && (
                    <div className="absolute -top-2 -right-2 bg-amber-500 text-[11px] font-bold text-white px-2 py-0.5 rounded-full shadow-lg border-2 border-amber-300">
                      +{milestone.rewards.xp}
                    </div>
                  )}

                  {/* Badge indicator */}
                  {milestone.rewards.badgeId && status !== "locked" && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center shadow-lg border-2 border-purple-300">
                      <span className="text-[10px]">🏆</span>
                    </div>
                  )}
                </motion.div>

                {/* Label */}
                <div 
                  className="absolute left-1/2 -translate-x-1/2 mt-2 text-center whitespace-nowrap"
                  style={{ top: (style.height as number) }}
                >
                  <span 
                    className={cn(
                      "text-xs font-semibold px-2 py-1 rounded shadow-md",
                      status === "completed" && "bg-green-900/90 text-green-100 border border-green-700",
                      status === "current" && "bg-blue-900/90 text-blue-100 border border-blue-700",
                      status === "unlocked" && "bg-amber-900/90 text-amber-100 border border-amber-700",
                      status === "locked" && "bg-slate-800/90 text-slate-300 border border-slate-600"
                    )}
                  >
                    {milestone.name.length > 14 ? milestone.name.slice(0, 12) + "..." : milestone.name}
                  </span>
                </div>
              </motion.div>
            );
          })}

          {/* Animated ship at current position */}
          {currentMilestone && (
            <motion.div
              className="absolute pointer-events-none"
              style={{
                left: milestones.find(m => m.id === currentMilestone)?.position.x ?? 0,
                top: (milestones.find(m => m.id === currentMilestone)?.position.y ?? 0) - 50,
              }}
              animate={{
                y: [0, -5, 0],
                rotate: [-2, 2, -2],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <span className="text-3xl drop-shadow-lg">⛵</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* CSS for pulse animation */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 25px rgba(59, 130, 246, 0.8), inset 0 2px 4px rgba(255,255,255,0.3); }
          50% { box-shadow: 0 0 35px rgba(59, 130, 246, 1), inset 0 2px 4px rgba(255,255,255,0.3); }
        }
      `}</style>

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
