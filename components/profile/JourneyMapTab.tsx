"use client";

import { useState, useEffect, useCallback } from "react";
import { JourneyMapRenderer, type Milestone, type MapConfig, type Zone, type MapSequenceInfo } from "@/components/journey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Map, Target, Trophy, Star, Compass, Sparkles, ChevronLeft, ChevronRight, Lock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Image from "next/image";

interface JourneyProgress {
  userId: string;
  mapId: string;
  currentZone: string;
  currentMilestone: string;
  completedMilestones: Array<{
    milestoneId: string;
    completedAt: string;
    rewards: { xp: number; badgeId?: string };
  }>;
  unlockedMilestones: string[];
  totalXPFromJourney: number;
  totalMilestonesCompleted: number;
  journeyStartedAt: string;
  lastProgressAt: string;
  currentMapIndex?: number;
  mapsCompleted?: number;
}

interface MapData {
  mapId: string;
  name: string;
  description: string;
  theme: string;
  sequenceOrder: number;
  difficulty: number;
  estimatedXP: number;
  zones: Zone[];
  backgroundColor: string;
  backgroundImage?: string;
  totalMilestones?: number;
}

interface JourneyMapTabProps {
  userId: string;
}

// Special overview "map" for Trader's Journey intro
const TRADERS_JOURNEY_OVERVIEW = {
  mapId: "traders_journey_overview",
  name: "Trader's Journey",
  description: "Welcome to your trading adventure! This overview shows all the lands you'll explore on your path to becoming a legendary trader.",
  theme: "overview",
  sequenceOrder: 0,
  difficulty: 0,
  estimatedXP: 0,
  zones: [],
  backgroundColor: "#1a1a2e",
  backgroundImage: "/assets/maps/traders-journey-overview.png",
  isOverview: true,
};

export default function JourneyMapTab({ userId }: JourneyMapTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maps, setMaps] = useState<MapData[]>([]);
  const [currentMapIndex, setCurrentMapIndex] = useState(0); // Start at overview (0)
  const [currentMapConfig, setCurrentMapConfig] = useState<MapConfig | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [progress, setProgress] = useState<JourneyProgress | null>(null);
  const [userLevel, setUserLevel] = useState<number>(1);
  const [showingOverview, setShowingOverview] = useState(true); // Track if showing overview

  // Fetch all maps in sequence
  const fetchMapsSequence = useCallback(async () => {
    try {
      const res = await fetch("/api/journey/maps/sequence");
      const data = await res.json();
      if (data.success && data.maps && data.maps.length > 0) {
        // Filter to only include new generated maps (exclude legacy "Trader's Journey" map)
        // Valid maps have mapId like "pirate_cove", "space_station", etc. NOT "traders_journey"
        const validMaps = data.maps.filter((m: MapData) => 
          m.sequenceOrder && 
          m.sequenceOrder >= 1 && 
          m.mapId !== "traders_journey" && // Exclude legacy map
          !m.mapId.includes("traders_journey") && // Exclude any traders_journey variants
          m.name !== "Trader's Journey" // Also exclude by name
        );
        
        // Sort by sequenceOrder
        validMaps.sort((a: MapData, b: MapData) => a.sequenceOrder - b.sequenceOrder);
        
        // IMPORTANT: Renumber the maps to ensure Pirate Cove is #1
        // This fixes the issue where database has sequenceOrder starting at 2
        const renumberedMaps = validMaps.map((map: MapData, index: number) => ({
          ...map,
          sequenceOrder: index + 1, // Renumber: 1, 2, 3, ...
        }));
        
        setMaps(renumberedMaps);
        return renumberedMaps;
      }
      return [];
    } catch (err) {
      console.error("Error fetching maps sequence:", err);
      return [];
    }
  }, []);

  // Fetch user progress
  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/journey/progress/${userId}`);
      const data = await res.json();
      if (data.success) {
        setProgress({
          userId,
          mapId: data.currentMapId || "pirate_cove",
          currentZone: "",
          currentMilestone: data.currentMilestone || "",
          completedMilestones: data.completedMilestones?.map((id: string) => ({
            milestoneId: id,
            completedAt: new Date().toISOString(),
            rewards: { xp: 0 },
          })) || [],
          unlockedMilestones: data.unlockedMilestones || [],
          totalXPFromJourney: data.totalXP || 0,
          totalMilestonesCompleted: data.completedMilestones?.length || 0,
          journeyStartedAt: data.journeyStartedAt || new Date().toISOString(),
          lastProgressAt: data.lastProgressAt || new Date().toISOString(),
          currentMapIndex: data.currentMapIndex || 1,
          mapsCompleted: data.mapsCompleted || 0,
        });
        return data;
      }
      return null;
    } catch (err) {
      console.error("Error fetching progress:", err);
      return null;
    }
  }, [userId]);

  // Fetch milestones for a specific map
  const fetchMapMilestones = useCallback(async (mapId: string) => {
    try {
      const res = await fetch(`/api/journey/maps/${mapId}/milestones`);
      const data = await res.json();
      if (data.success) {
        return data.milestones || [];
      }
      return [];
    } catch (err) {
      console.error("Error fetching milestones:", err);
      return [];
    }
  }, []);

  // Fetch user level
  const fetchUserLevel = useCallback(async () => {
    try {
      const res = await fetch(`/api/user-level?userId=${userId}`);
      const data = await res.json();
      if (data.success && data.userLevel) {
        setUserLevel(data.userLevel.currentLevel || 1);
      }
    } catch (err) {
      console.error("Error fetching user level:", err);
    }
  }, [userId]);

  // Auto-evaluate user's progress and complete milestones they've already achieved
  const evaluateProgress = useCallback(async () => {
    try {
      const res = await fetch("/api/journey/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      
      if (data.success) {
        if (data.newlyCompleted?.length > 0) {
          toast.success(`Auto-completed ${data.newlyCompleted.length} milestones! +${data.totalXPEarned} XP`);
          console.log("[Journey] Auto-completed milestones:", data.newlyCompleted);
        }
        // Refresh progress after evaluation
        await fetchProgress();
      }
    } catch (err) {
      console.error("Error evaluating progress:", err);
    }
  }, [userId, fetchProgress]);

  // Load all journey data
  const fetchJourneyData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch maps, progress, and user level in parallel
      const [mapsData] = await Promise.all([
        fetchMapsSequence(),
        fetchProgress(),
        fetchUserLevel(),
      ]);

      if (mapsData.length === 0) {
        setError("No journey maps found. Please ask an admin to generate the journey.");
        return;
      }

      // Auto-evaluate user's progress to complete milestones they've already achieved
      await evaluateProgress();

      // Default to showing overview (0) on initial load
      // This lets users see the welcome screen first
      setCurrentMapIndex(0);
      setShowingOverview(true);
      
      // If user has progress, they can navigate directly to their current map
      // via the map selector or "Continue" button
    } catch (err) {
      console.error("Error fetching journey data:", err);
      setError("Failed to load journey map. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [fetchMapsSequence, fetchProgress, fetchUserLevel, evaluateProgress]);

  // Load milestones when map changes
  const loadMapData = useCallback(async (mapIndex: number) => {
    const map = maps.find(m => m.sequenceOrder === mapIndex);
    if (!map) return;

    setLoading(true);
    try {
      const milestonesData = await fetchMapMilestones(map.mapId);
      setMilestones(milestonesData);
      setCurrentMapConfig({
        mapId: map.mapId,
        name: map.name,
        description: map.description,
        zones: map.zones || [],
        backgroundColor: map.backgroundColor || "#1a3a5c",
        // Ensure valid backgroundImage - fallback if old/invalid path
        backgroundImage: map.backgroundImage?.includes("treasure-map") 
          ? `/assets/maps/${map.mapId?.replace(/_/g, "-") || "pirate-cove"}.png`
          : map.backgroundImage || `/assets/maps/${map.mapId?.replace(/_/g, "-") || "pirate-cove"}.png`,
        sequenceOrder: map.sequenceOrder,
        theme: map.theme,
        difficulty: map.difficulty,
        estimatedXP: map.estimatedXP,
      });
    } finally {
      setLoading(false);
    }
  }, [maps, fetchMapMilestones]);

  useEffect(() => {
    fetchJourneyData();
  }, [fetchJourneyData]);

  // Handle map navigation - allow viewing all maps for reference
  const handleNavigateMap = (direction: "prev" | "next" | number) => {
    const userCurrentMapIndex = progress?.currentMapIndex || 1;
    
    if (typeof direction === "number") {
      // 0 = overview, 1-10 = actual maps
      if (direction >= 0 && direction <= maps.length) {
        setCurrentMapIndex(direction);
        
        if (direction === 0) {
          // Show overview
          setShowingOverview(true);
          setMilestones([]);
        } else {
          // Show actual map
          setShowingOverview(false);
          loadMapData(direction);
          
          // Show info toast for locked maps (maps 2+ need previous completed)
          if (direction > userCurrentMapIndex && direction > 1) {
            const map = maps.find(m => m.sequenceOrder === direction);
            toast.info(`Previewing "${map?.name || 'Map ' + direction}" - Complete previous maps to unlock!`);
          }
        }
      }
    } else if (direction === "prev" && currentMapIndex > 0) {
      const newIndex = currentMapIndex - 1;
      setCurrentMapIndex(newIndex);
      
      if (newIndex === 0) {
        setShowingOverview(true);
        setMilestones([]);
      } else {
        setShowingOverview(false);
        loadMapData(newIndex);
      }
    } else if (direction === "next" && currentMapIndex < maps.length) {
      const newIndex = currentMapIndex + 1;
      setCurrentMapIndex(newIndex);
      setShowingOverview(false);
      loadMapData(newIndex);
      
      // Show info toast for locked maps
      if (newIndex > userCurrentMapIndex && newIndex > 1) {
        const map = maps.find(m => m.sequenceOrder === newIndex);
        toast.info(`Previewing "${map?.name || 'Map ' + newIndex}" - Complete previous maps to unlock!`);
      }
    }
  };

  // Handle milestone click
  const handleMilestoneClick = (milestone: Milestone) => {
    const isCompleted = completedIds.includes(milestone.id);
    const isUnlocked = unlockedIds.includes(milestone.id);
    
    toast.info(
      <div>
        <strong>{milestone.name}</strong>
        <p className="text-sm opacity-80">{milestone.description}</p>
        <p className="text-xs mt-1">
          Reward: {milestone.rewards?.xp || 0} XP
          {isCompleted && " ✓ Completed"}
          {!isCompleted && isUnlocked && " - Available"}
          {!isCompleted && !isUnlocked && " - Locked"}
        </p>
      </div>
    );
  };

  // Calculate stats
  const completedIds = progress?.completedMilestones?.map(m => m.milestoneId) || [];
  const unlockedIds = progress?.unlockedMilestones || [];
  const milestonesOnThisMap = milestones.filter(m => completedIds.includes(m.id)).length;
  const completionPercentage = milestones.length > 0 
    ? Math.round((milestonesOnThisMap / milestones.length) * 100)
    : 0;

  // Calculate days on journey
  const journeyDays = progress?.journeyStartedAt
    ? Math.floor((Date.now() - new Date(progress.journeyStartedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Build sequence info for multi-map navigation
  const sequenceInfo: MapSequenceInfo | null = maps.length > 0 ? {
    currentMapIndex,
    totalMaps: maps.length,
    mapsCompleted: progress?.mapsCompleted || 0,
    maps: maps.map(map => ({
      mapId: map.mapId,
      name: map.name,
      theme: map.theme,
      sequenceOrder: map.sequenceOrder,
      isUnlocked: map.sequenceOrder <= (progress?.currentMapIndex || 1) || map.sequenceOrder === 1,
      isComplete: map.sequenceOrder < (progress?.currentMapIndex || 1),
      completionPercentage: 0,
    })),
  } : null;

  if (loading && maps.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchJourneyData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Map className="h-7 w-7 text-amber-500" />
            </motion.div>
            Your Trading Journey
          </h2>
          <p className="text-muted-foreground mt-1">
            Track your progress from novice to legendary trader
          </p>
        </div>
        <Button onClick={fetchJourneyData} variant="ghost" size="sm">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Star className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{progress?.totalXPFromJourney || 0}</div>
                  <div className="text-sm text-muted-foreground">Journey XP</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <Target className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{progress?.totalMilestonesCompleted || 0}</div>
                  <div className="text-sm text-muted-foreground">Milestones</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Compass className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{journeyDays}</div>
                  <div className="text-sm text-muted-foreground">Days Active</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Trophy className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{progress?.mapsCompleted || 0}/10</div>
                  <div className="text-sm text-muted-foreground">Maps</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Map Selector - Gamified with Arrow Navigation */}
      {maps.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-gradient-to-r from-slate-900/50 via-amber-950/20 to-slate-900/50 border-amber-500/20">
            <CardContent className="py-5">
              <div className="flex items-center gap-3 mb-4">
                <Compass className="h-5 w-5 text-amber-500" />
                <span className="text-sm font-medium text-amber-500">Select Your Voyage</span>
                <div className="flex-1 h-px bg-gradient-to-r from-amber-500/50 to-transparent" />
              </div>
              
              {/* Arrow Navigation Container */}
              <div className="flex items-center gap-3">
                {/* Left Arrow */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const container = document.getElementById('map-selector-container');
                    if (container) container.scrollBy({ left: -240, behavior: 'smooth' });
                  }}
                  className="shrink-0 h-12 w-12 rounded-full bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/30"
                >
                  <ChevronLeft className="h-6 w-6 text-amber-400" />
                </Button>
                
                {/* Maps Container - Hidden Scrollbar */}
                <div 
                  id="map-selector-container"
                  className="flex gap-3 overflow-x-auto scrollbar-hide py-2"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {/* Overview Tab - Trader's Journey */}
                  <motion.button
                    onClick={() => handleNavigateMap(0)}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative flex flex-col items-center min-w-[115px] h-[100px] p-4 rounded-xl border-2 transition-all justify-center ${
                      currentMapIndex === 0 
                        ? "bg-gradient-to-b from-amber-600 to-orange-700 border-amber-500 shadow-lg shadow-amber-500/20" 
                        : "bg-slate-800/50 border-slate-600 hover:border-amber-500/50"
                    }`}
                  >
                    {/* Info Badge */}
                    <div className={`absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center ${
                      currentMapIndex === 0 ? "bg-amber-500" : "bg-slate-600"
                    }`}>
                      <Info className="h-4 w-4 text-white" />
                    </div>
                    
                    {/* Icon */}
                    <div className="mb-2">
                      <Compass className={`h-6 w-6 ${currentMapIndex === 0 ? "text-amber-200" : "text-amber-500"}`} />
                    </div>
                    
                    {/* Name */}
                    <span className={`text-xs font-semibold text-center leading-tight ${
                      currentMapIndex === 0 ? "text-amber-100" : "text-slate-300"
                    }`}>
                      Trader&apos;s<br/>Journey
                    </span>
                  </motion.button>
                  
                  {/* Actual Maps */}
                  {maps.map((map) => {
                    const userMapIndex = progress?.currentMapIndex || 1;
                    // Map 1 (Pirate Cove) is always unlocked, others need previous completed
                    const isUnlocked = map.sequenceOrder === 1 || map.sequenceOrder <= userMapIndex;
                    const isComplete = map.sequenceOrder < userMapIndex;
                    const isViewing = map.sequenceOrder === currentMapIndex;
                    
                    // Theme colors for each map
                    const themeColors: Record<string, { bg: string; border: string; text: string }> = {
                      pirate: { bg: "from-amber-600 to-orange-700", border: "border-amber-500", text: "text-amber-200" },
                      space: { bg: "from-purple-600 to-indigo-700", border: "border-purple-500", text: "text-purple-200" },
                      medieval: { bg: "from-red-600 to-rose-700", border: "border-red-500", text: "text-red-200" },
                      cyber: { bg: "from-cyan-500 to-blue-600", border: "border-cyan-400", text: "text-cyan-200" },
                      ancient: { bg: "from-yellow-600 to-amber-700", border: "border-yellow-500", text: "text-yellow-200" },
                      volcanic: { bg: "from-red-600 to-orange-700", border: "border-red-500", text: "text-orange-200" },
                      arctic: { bg: "from-blue-400 to-cyan-600", border: "border-blue-400", text: "text-blue-200" },
                      dragon: { bg: "from-orange-500 to-red-600", border: "border-orange-500", text: "text-orange-200" },
                      celestial: { bg: "from-violet-500 to-purple-600", border: "border-violet-400", text: "text-violet-200" },
                      legendary: { bg: "from-yellow-400 to-amber-500", border: "border-yellow-400", text: "text-yellow-100" },
                    };
                    
                    const colors = themeColors[map.theme] || themeColors.pirate;

                    return (
                      <motion.button
                        key={map.mapId}
                        onClick={() => handleNavigateMap(map.sequenceOrder)}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className={`relative flex flex-col items-center min-w-[115px] h-[100px] p-4 rounded-xl border-2 transition-all justify-center ${
                          isViewing 
                            ? `bg-gradient-to-b ${colors.bg} ${colors.border} shadow-lg shadow-amber-500/20` 
                            : isComplete
                            ? "bg-green-900/30 border-green-500/50 hover:border-green-400"
                            : isUnlocked
                            ? "bg-slate-800/50 border-slate-600 hover:border-amber-500/50"
                            : "bg-slate-900/50 border-slate-700/50 hover:border-slate-500 opacity-70"
                        }`}
                      >
                        {/* Map Number Badge */}
                        <div className={`absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                          isComplete ? "bg-green-500 text-white" : isViewing ? "bg-amber-500 text-black" : isUnlocked ? "bg-slate-600 text-slate-200" : "bg-slate-800 text-slate-400"
                        }`}>
                          {map.sequenceOrder}
                        </div>
                        
                        {/* Lock Badge for Locked Maps */}
                        {!isUnlocked && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center border border-slate-500">
                            <Lock className="h-3 w-3 text-slate-400" />
                          </div>
                        )}
                        
                        {/* Status Icon */}
                        <div className="mb-2">
                          {!isUnlocked && <Lock className="h-6 w-6 text-slate-500" />}
                          {isComplete && <Star className="h-6 w-6 text-green-400 fill-green-400" />}
                          {isViewing && !isComplete && isUnlocked && <Compass className="h-6 w-6 text-amber-300 animate-pulse" />}
                          {isUnlocked && !isViewing && !isComplete && <Map className="h-6 w-6 text-slate-400" />}
                        </div>
                        
                        {/* Map Name */}
                        <span className={`text-xs font-semibold text-center leading-tight ${
                          isViewing ? colors.text : isComplete ? "text-green-300" : isUnlocked ? "text-slate-300" : "text-slate-500"
                        }`}>
                          {map.name}
                        </span>
                        
                        {/* Difficulty Dots */}
                        <div className="flex gap-0.5 mt-1.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full ${
                                i < Math.ceil(map.difficulty / 2) 
                                  ? isViewing ? "bg-amber-300" : isUnlocked ? "bg-amber-500/60" : "bg-slate-600"
                                  : "bg-slate-700"
                              }`}
                            />
                          ))}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
                
                {/* Right Arrow */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const container = document.getElementById('map-selector-container');
                    if (container) container.scrollBy({ left: 240, behavior: 'smooth' });
                  }}
                  className="shrink-0 h-12 w-12 rounded-full bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/30"
                >
                  <ChevronRight className="h-6 w-6 text-amber-400" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Overview Section - Trader's Journey */}
      {showingOverview && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <Card className="border-2 border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-slate-900/50 to-amber-950/20 overflow-hidden">
            <CardContent className="py-6 relative">
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl" />
              
              <div className="text-center mb-6 relative">
                <h2 className="text-2xl font-bold text-amber-100 mb-2">Welcome to Your Trading Journey!</h2>
                <p className="text-sm text-amber-300/70 max-w-2xl mx-auto">
                  Embark on an epic adventure across 10 unique trading lands. Complete milestones, earn XP, and unlock badges as you progress from novice trader to legendary master.
                </p>
              </div>
              
              {/* Overview Image */}
              <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden border-4 border-amber-900/50">
                <Image
                  src="/assets/maps/traders-journey-overview.png"
                  alt="Trader's Journey Overview"
                  fill
                  className="object-cover"
                  priority
                />
                
                {/* Overlay with CTA */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-center pb-8">
                  <Button
                    onClick={() => handleNavigateMap(1)}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold px-8 py-3 text-lg shadow-lg shadow-amber-500/30"
                  >
                    <Compass className="h-5 w-5 mr-2" />
                    Start Your Adventure
                  </Button>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-4 mt-6">
                <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="text-2xl font-bold text-amber-400">10</div>
                  <div className="text-xs text-amber-300/70">Unique Maps</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="text-2xl font-bold text-green-400">{progress?.mapsCompleted || 0}</div>
                  <div className="text-xs text-green-300/70">Completed</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="text-2xl font-bold text-blue-400">{progress?.totalMilestonesCompleted || 0}</div>
                  <div className="text-xs text-blue-300/70">Milestones</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="text-2xl font-bold text-purple-400">{progress?.totalXPFromJourney || 0}</div>
                  <div className="text-xs text-purple-300/70">Total XP</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Current Map Info - Enhanced (only when not showing overview) */}
      {!showingOverview && currentMapConfig && (() => {
        const userMapIndex = progress?.currentMapIndex || 1;
        const isMapLocked = currentMapIndex > userMapIndex && currentMapIndex > 1;
        
        return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <Card className={`border-2 overflow-hidden ${
            isMapLocked 
              ? "border-slate-500/30 bg-gradient-to-r from-slate-900/50 via-slate-800/50 to-slate-900/50" 
              : "border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-slate-900/50 to-amber-950/20"
          }`}>
            <CardContent className="py-4 relative">
              {/* Decorative Elements */}
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl ${isMapLocked ? "bg-slate-500/5" : "bg-amber-500/5"}`} />
              <div className={`absolute bottom-0 left-0 w-24 h-24 rounded-full blur-2xl ${isMapLocked ? "bg-slate-500/5" : "bg-orange-500/5"}`} />
              
              {/* Locked Map Banner */}
              {isMapLocked && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-slate-700/90 via-slate-600/90 to-slate-700/90 py-1.5 px-4 flex items-center justify-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-slate-300" />
                  <span className="text-xs font-medium text-slate-200">Preview Mode - Complete previous maps to unlock</span>
                </div>
              )}
              
              <div className={`flex items-center justify-between relative ${isMapLocked ? "mt-6" : ""}`}>
                <div className="flex items-center gap-4">
                  <motion.div 
                    className={`w-16 h-16 rounded-xl flex items-center justify-center border ${
                      isMapLocked 
                        ? "bg-gradient-to-br from-slate-600/30 to-slate-700/30 border-slate-500/30" 
                        : "bg-gradient-to-br from-amber-500/30 to-orange-600/30 border-amber-500/30"
                    }`}
                    animate={{ rotate: isMapLocked ? [0] : [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  >
                    <span className="text-3xl">{isMapLocked ? "🔒" : "🗺️"}</span>
                  </motion.div>
                  <div>
                    <div className={`font-bold text-xl ${isMapLocked ? "text-slate-300" : "text-amber-100"}`}>{currentMapConfig.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`capitalize ${isMapLocked ? "border-slate-500/50 text-slate-400" : "border-amber-500/50 text-amber-300"}`}>
                        {currentMapConfig.theme}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Difficulty:</span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full ${
                                i < (currentMapConfig.difficulty || 1)
                                  ? "bg-gradient-to-t from-red-500 to-orange-400"
                                  : "bg-slate-700"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  {/* Progress Circle */}
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 transform -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="text-slate-700"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeDasharray={`${2 * Math.PI * 28}`}
                        strokeDashoffset={`${2 * Math.PI * 28 * (1 - completionPercentage / 100)}`}
                        className="text-amber-500 transition-all duration-500"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-amber-400">{completionPercentage}%</span>
                    </div>
                  </div>
                  
                  {/* Milestone Counter */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">{milestonesOnThisMap}</div>
                    <div className="text-xs text-muted-foreground">of {milestones.length}</div>
                    <div className="text-xs text-amber-400 font-medium">Milestones</div>
                  </div>
                  
                  {/* Navigation */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleNavigateMap("prev")}
                      disabled={currentMapIndex <= 0}
                      className="border-amber-500/30 hover:bg-amber-500/20"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleNavigateMap("next")}
                      disabled={currentMapIndex >= maps.length}
                      className="border-amber-500/30 hover:bg-amber-500/20"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        );
      })()}

      {/* Journey Map (only when not showing overview) */}
      {!showingOverview && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Journey Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            <JourneyMapRenderer
              mapConfig={currentMapConfig}
              milestones={milestones}
              completedIds={completedIds}
              unlockedIds={unlockedIds}
              currentMilestone={progress?.currentMilestone}
              userLevel={userLevel}
              onMilestoneClick={handleMilestoneClick}
              sequenceInfo={sequenceInfo}
              onNavigateMap={handleNavigateMap}
              showMapNavigation={false}
              className="min-h-[500px]"
            />
          </CardContent>
        </Card>
      </motion.div>
      )}

      {/* Recent Achievements */}
      {progress?.completedMilestones && progress.completedMilestones.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Achievements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {progress.completedMilestones
                  .slice(-5)
                  .reverse()
                  .map(completed => {
                    const milestone = milestones.find(m => m.id === completed.milestoneId);
                    if (!milestone) return null;

                    return (
                      <div
                        key={completed.milestoneId}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: (milestone.color || "#3B82F6") + "20" }}
                          >
                            <Target className="h-5 w-5" style={{ color: milestone.color || "#3B82F6" }} />
                          </div>
                          <div>
                            <div className="font-medium">{milestone.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(completed.completedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <Badge variant="secondary">
                          +{completed.rewards.xp} XP
                        </Badge>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
