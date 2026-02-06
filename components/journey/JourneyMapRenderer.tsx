"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import MilestoneDetailModal from "./MilestoneDetailModal";
import { ZoomIn, ZoomOut, RotateCcw, Compass, Ship, ChevronLeft, ChevronRight, Lock, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";

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
  order: number; // Sequential order number
  unlockCondition?: {
    type: string;
    value?: number;
    comparison?: string;
  };
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
  // Multi-map sequence fields
  sequenceOrder?: number;
  theme?: string;
  difficulty?: number;
  estimatedXP?: number;
  previousMapId?: string | null;
  nextMapId?: string | null;
}

// Map sequence info for navigation
export interface MapSequenceInfo {
  currentMapIndex: number;
  totalMaps: number;
  mapsCompleted: number;
  maps: Array<{
    mapId: string;
    name: string;
    theme: string;
    sequenceOrder: number;
    isUnlocked: boolean;
    isComplete: boolean;
    completionPercentage: number;
  }>;
}

// Progress data for each milestone
export interface MilestoneProgress {
  milestoneId: string;
  currentValue: number;
  targetValue: number;
}

export interface JourneyMapRendererProps {
  mapConfig: MapConfig | null;
  milestones: Milestone[];
  completedIds: string[];
  unlockedIds: string[];
  currentMilestone?: string;
  userLevel?: number; // User's current level for unlock condition checking
  milestoneProgress?: MilestoneProgress[]; // Progress data for milestones
  onMilestoneClick?: (milestone: Milestone) => void;
  className?: string;
  // Multi-map navigation props
  sequenceInfo?: MapSequenceInfo;
  onNavigateMap?: (direction: "prev" | "next" | number) => void;
  showMapNavigation?: boolean;
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
  userLevel = 1,
  milestoneProgress = [],
  onMilestoneClick,
  className,
  sequenceInfo,
  onNavigateMap,
  showMapNavigation = false,
}: JourneyMapRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.8);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check if unlock condition is met
  const isUnlockConditionMet = (milestone: Milestone): boolean => {
    if (!milestone.unlockCondition) return true;
    
    const { type, value } = milestone.unlockCondition;
    
    // Check level requirement
    if (type === "level_reached" && value !== undefined) {
      return userLevel >= value;
    }
    
    // For other conditions, assume met if in unlocked list
    return true;
  };

  // Get milestone status with level checking
  const getMilestoneStatus = (id: string): "completed" | "current" | "unlocked" | "locked" | "level_locked" => {
    const milestone = milestones.find(m => m.id === id);
    
    if (completedIds.includes(id)) return "completed";
    if (id === currentMilestone) return "current";
    
    // Check if unlocked but level-locked
    if (unlockedIds.includes(id)) {
      if (milestone && !isUnlockConditionMet(milestone)) {
        return "level_locked";
      }
      return "unlocked";
    }
    
    return "locked";
  };

  // Get required level for a milestone
  const getRequiredLevel = (milestone: Milestone): number | null => {
    if (milestone.unlockCondition?.type === "level_reached") {
      return milestone.unlockCondition.value || null;
    }
    return null;
  };

  // Handle milestone click - allow clicking ALL milestones to see details
  const handleMilestoneClick = (milestone: Milestone) => {
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
  const getNodeStyle = (status: "completed" | "current" | "unlocked" | "locked" | "level_locked", size: string) => {
    // Bigger sizes for better visibility
    const sizeMap = { small: 44, medium: 52, large: 60 };
    const nodeSize = sizeMap[size as keyof typeof sizeMap] || 52;
    
    const baseStyle = {
      width: nodeSize,
      height: nodeSize,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer", // All milestones are clickable now
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
      case "level_locked":
        // Shows as locked but with purple tint to indicate level requirement
        return {
          ...baseStyle,
          background: "linear-gradient(135deg, #4C1D95, #3B0764)",
          boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3), inset 0 2px 4px rgba(0,0,0,0.4)",
          border: "3px solid #6D28D9",
          opacity: 0.9,
        };
      case "locked":
        return {
          ...baseStyle,
          background: "linear-gradient(135deg, #374151, #1F2937)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.4)",
          border: "3px solid #4B5563",
          opacity: 0.95,
        };
    }
  };

  // Draw path between nodes - completed paths are solid green, others are dashed white
  const renderPath = (from: Milestone, to: Milestone) => {
    const fromStatus = getMilestoneStatus(from.id);
    const toStatus = getMilestoneStatus(to.id);
    
    // Path is "completed" (green) if FROM milestone is completed
    const isCompletedPath = fromStatus === "completed";
    
    // Calculate a nice curved path
    const midX = (from.position.x + to.position.x) / 2;
    const midY = Math.min(from.position.y, to.position.y) - 20;
    
    return (
      <svg
        key={`path-${from.id}-${to.id}`}
        className="absolute top-0 left-0 pointer-events-none"
        style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}
      >
        <defs>
          <filter id="greenGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {/* Completed path - thick solid green with glow */}
        {isCompletedPath && (
          <path
            d={`M ${from.position.x} ${from.position.y} Q ${midX} ${midY} ${to.position.x} ${to.position.y}`}
            fill="none"
            stroke="#22C55E"
            strokeWidth={5}
            strokeLinecap="round"
            opacity={1}
            filter="url(#greenGlow)"
          />
        )}
        {/* Incomplete path - thin dashed white */}
        {!isCompletedPath && (
          <path
            d={`M ${from.position.x} ${from.position.y} Q ${midX} ${midY} ${to.position.x} ${to.position.y}`}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeDasharray="6,6"
            strokeLinecap="round"
            opacity={0.3}
          />
        )}
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

      {/* Multi-Map Navigation */}
      {showMapNavigation && sequenceInfo && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {/* Previous Map Button */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onNavigateMap?.("prev")}
            disabled={sequenceInfo.currentMapIndex <= 1}
            className="bg-amber-900/90 hover:bg-amber-800 border border-amber-700 text-amber-100 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>

          {/* Map Selector */}
          <div className="bg-amber-950/95 backdrop-blur-sm rounded-lg px-4 py-2 border border-amber-800 flex items-center gap-3">
            <Map className="h-4 w-4 text-amber-400" />
            <div className="text-center">
              <div className="text-sm font-bold text-amber-100">
                Map {sequenceInfo.currentMapIndex} of {sequenceInfo.totalMaps}
              </div>
              <div className="text-[10px] text-amber-300/70 capitalize">
                {mapConfig?.theme || "pirate"} Theme
              </div>
            </div>
            
            {/* Mini map indicators */}
            <div className="flex gap-1">
              {sequenceInfo.maps.slice(0, 10).map((map, idx) => (
                <button
                  key={map.mapId}
                  onClick={() => map.isUnlocked && onNavigateMap?.(idx + 1)}
                  disabled={!map.isUnlocked}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-all",
                    map.isComplete
                      ? "bg-green-500"
                      : sequenceInfo.currentMapIndex === idx + 1
                      ? "bg-blue-500 animate-pulse"
                      : map.isUnlocked
                      ? "bg-amber-500"
                      : "bg-slate-600",
                    map.isUnlocked && "cursor-pointer hover:scale-125"
                  )}
                  title={`${map.name} ${map.isComplete ? "(Complete)" : map.isUnlocked ? "" : "(Locked)"}`}
                />
              ))}
            </div>
          </div>

          {/* Next Map Button */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onNavigateMap?.("next")}
            disabled={
              sequenceInfo.currentMapIndex >= sequenceInfo.totalMaps ||
              !sequenceInfo.maps[sequenceInfo.currentMapIndex]?.isUnlocked
            }
            className="bg-amber-900/90 hover:bg-amber-800 border border-amber-700 text-amber-100 disabled:opacity-50"
          >
            Next
            {sequenceInfo.maps[sequenceInfo.currentMapIndex]?.isUnlocked ? (
              <ChevronRight className="h-4 w-4 ml-1" />
            ) : (
              <Lock className="h-3 w-3 ml-1" />
            )}
          </Button>
        </div>
      )}

      {/* Sequence Progress Bar (when multi-map is enabled) */}
      {showMapNavigation && sequenceInfo && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-amber-950/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-amber-800">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-amber-300/70">Journey Progress:</span>
            <div className="w-40 h-2 bg-amber-900 rounded-full overflow-hidden border border-amber-700">
              <motion.div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
                initial={{ width: 0 }}
                animate={{
                  width: `${(sequenceInfo.mapsCompleted / sequenceInfo.totalMaps) * 100}%`,
                }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="text-amber-100 font-semibold">
              {sequenceInfo.mapsCompleted}/{sequenceInfo.totalMaps}
            </span>
          </div>
        </div>
      )}

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

      {/* Current Map Info Card (when multi-map enabled) */}
      {showMapNavigation && mapConfig && (
        <div className="absolute bottom-4 right-4 z-20 bg-amber-950/90 backdrop-blur-sm rounded-lg p-3 border border-amber-800 min-w-[200px]">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-[10px] capitalize bg-amber-800/50 text-amber-200">
              {mapConfig.theme || "pirate"}
            </Badge>
            {mapConfig.difficulty !== undefined && (
              <Badge variant="outline" className="text-[10px] border-amber-700 text-amber-300">
                Difficulty: {mapConfig.difficulty}/10
              </Badge>
            )}
          </div>
          <h4 className="text-sm font-bold text-amber-100">{mapConfig.name}</h4>
          <p className="text-[10px] text-amber-300/70 mt-1 line-clamp-2">
            {mapConfig.description}
          </p>
          {mapConfig.estimatedXP && (
            <div className="mt-2 flex items-center justify-between text-[10px]">
              <span className="text-amber-300/70">XP Budget:</span>
              <span className="text-amber-100 font-semibold">
                {mapConfig.estimatedXP.toLocaleString()} XP
              </span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between text-[10px]">
            <span className="text-amber-300/70">Milestones:</span>
            <span className="text-amber-100">
              {completedIds.length}/{milestones.length}
            </span>
          </div>
        </div>
      )}

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
            <div className="w-3 h-3 rounded-full bg-purple-500 opacity-70" />
            <span>Level Required</span>
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

          {/* Path Connections - SEQUENTIAL by order */}
          {(() => {
            // Sort milestones by order to draw sequential paths
            const sortedMilestones = [...milestones].sort((a, b) => (a.order || 0) - (b.order || 0));
            const paths: React.ReactNode[] = [];
            
            for (let i = 0; i < sortedMilestones.length - 1; i++) {
              const from = sortedMilestones[i];
              const to = sortedMilestones[i + 1];
              paths.push(renderPath(from, to));
            }
            
            return paths;
          })()}

          {/* Milestone Nodes */}
          {milestones.map(milestone => {
            const status = getMilestoneStatus(milestone.id);
            const style = getNodeStyle(status, milestone.size);
            const nodeSize = style.width as number;
            
            // Map icon names to actual game-icons image files (pirate/adventure themed)
            const getIconImage = (): string => {
              const iconMap: Record<string, string> = {
                // Pirate themed icons
                ship: "Pirate Ship.png",
                pirateShip: "Pirate Ship.png",
                anchor: "Anchor.png",
                compass: "Compass.png",
                map: "Pirate Map.png",
                pirateMap: "Pirate Map.png",
                maps: "Pirate Map.png",
                treasure: "treasure.png",
                treasureChest: "chest 1.png",
                chest: "chest 1.png",
                pirateCoins: "Pirate Coins.png",
                pirateFlag: "Pirate Flag.png",
                flag: "Pirate Flag.png",
                pirateSword: "Pirate Sword.png",
                pirateHat: "Pirate Hat.png",
                pirateHook: "Pirate Hook.png",
                pirateCannon: "Pirate Cannon.png",
                cannon: "Pirate Cannon.png",
                piratePistol: "Pirate Pistol.png",
                parrot: "Parrot.png",
                skull: "skull.png",
                barrel: "Barrel.png",
                island: "Island Rock.png",
                eyePatch: "Eye Patch.png",
                
                // Finance/Trading icons
                moneyDeposit: "money deposite.png",
                deposit: "money deposite.png",
                trade: "2. trade.png",
                buy: "2. trade.png",
                sell: "stock down.png",
                profit: "3. profit.png",
                coin: "3. Coin.png",
                coins: "Pirate Coins.png",
                gems: "4. Gems.png",
                target: "target.png",
                portfolio: "1. invest portfolio.png",
                invest: "Long Term Investment.png",
                longTermInvestment: "Long Term Investment.png",
                balance: "money balance.png",
                
                // Achievement/Trophy icons
                trophy: "1. TROPHY.png",
                trophyStar: "2. STAR TROPHY.png",
                goldMedal: "3. GOLD MEDAL.png",
                starBadge: "14. STAR BADGE.png",
                shield: "5. SHIELD AWARD.png",
                shield1: "shield 1.png",
                champion: "11. CHAMPION AWARD.png",
                victory: "20. VICTORY AWARD.png",
                crown: "16. Crown.png",
                star1: "star 1.png",
                star: "star 1.png",
                medal: "medal 1.png",
                reward: "reward 1.png",
                
                // Game/RPG icons
                guideBook: "20. GuideBook.png",
                sword: "sword.png",
                archer: "11. Archer.png",
                axe: "10. Axe.png",
                bomb: "12. Bomb.png",
                timer: "13. Timer.png",
                key: "15. Key.png",
                banner: "18. Banner.png",
                helmet: "helmet 1.png",
                armor: "armor 1.png",
                hammer: "hammer 1.png",
                
                // Spell/Magic icons
                lightningSpell: "lightning speel.png",
                fireSpell: "fire spell.png",
                spell: "1. Spell Brown.png",
                magicShield3D: "Magic Shiled 3D.png",
                healthPotion: "healt potion.png",
                energyPotion: "energi potion.png",
                
                // Risk/Finance themed
                riskWarning: "1. Risk Warning.png",
                riskManagement: "2. Risk Management.png",
                riskControl: "7. Risk Control.png",
                
                // Default fallback
                lord: "8. Lord.png",
                rookie: "7. Rookie.png",
                war: "6. War.png",
              };
              return `/game-icons/${iconMap[milestone.icon] || "Pirate Ship.png"}`;
            };
            
            return (
              <motion.div
                key={milestone.id}
                className="absolute"
                style={{
                  left: milestone.position.x - nodeSize / 2,
                  top: milestone.position.y - nodeSize / 2,
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring" }}
              >
                {/* Node */}
                <motion.div
                  style={style as any}
                  onClick={() => handleMilestoneClick(milestone)}
                  whileHover={{ scale: 1.15, zIndex: 10 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative"
                >
                  {/* Content based on status */}
                  {status === "completed" ? (
                    // Completed: Show the actual icon image
                    <div className="relative w-8 h-8 drop-shadow-lg">
                      <Image
                        src={getIconImage()}
                        alt={milestone.name}
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  ) : status === "locked" || status === "level_locked" ? (
                    // Locked: Show order number in gray
                    <span className="text-slate-400 text-lg font-bold drop-shadow-md">
                      {milestone.order || "?"}
                    </span>
                  ) : status === "current" ? (
                    // Current: Show icon image with animation
                    <div className="relative w-10 h-10 drop-shadow-lg animate-bounce">
                      <Image
                        src={getIconImage()}
                        alt={milestone.name}
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  ) : (
                    // Unlocked/Available: Show icon image
                    <div className="relative w-8 h-8 drop-shadow-md">
                      <Image
                        src={getIconImage()}
                        alt={milestone.name}
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  )}

                  {/* Level requirement badge for level_locked */}
                  {status === "level_locked" && (
                    <div className="absolute -top-1 -right-1 bg-purple-600 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full shadow-lg border border-purple-400">
                      Lv.{getRequiredLevel(milestone)}
                    </div>
                  )}

                  {/* XP Badge - only for current/unlocked */}
                  {(status === "current" || status === "unlocked") && milestone.rewards.xp > 0 && (
                    <div className="absolute -top-1 -right-1 bg-amber-500 text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full shadow-lg border-2 border-amber-300">
                      +{milestone.rewards.xp}
                    </div>
                  )}

                  {/* Badge indicator - only for current/unlocked */}
                  {milestone.rewards.badgeId && (status === "current" || status === "unlocked") && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center shadow-lg border border-purple-300">
                      <span className="text-[8px]">🏆</span>
                    </div>
                  )}
                </motion.div>

                {/* NO labels on map - clean look */}
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
        {modalOpen && selectedMilestone && (() => {
          const progress = milestoneProgress.find(p => p.milestoneId === selectedMilestone.id);
          return (
            <MilestoneDetailModal
              milestone={selectedMilestone}
              status={getMilestoneStatus(selectedMilestone.id)}
              open={modalOpen}
              currentValue={progress?.currentValue || 0}
              targetValue={progress?.targetValue || selectedMilestone.completeCondition?.value || 1}
              onClose={() => {
                setModalOpen(false);
                setSelectedMilestone(null);
              }}
            />
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
