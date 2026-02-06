"use client";

import { useState, useEffect, useCallback } from "react";
import { JourneyMapRenderer, type Milestone, type MapConfig, type Zone, type MapSequenceInfo } from "@/components/journey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Map, Target, Trophy, Star, Compass, Sparkles, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";

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

export default function JourneyMapTab({ userId }: JourneyMapTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maps, setMaps] = useState<MapData[]>([]);
  const [currentMapIndex, setCurrentMapIndex] = useState(1);
  const [currentMapConfig, setCurrentMapConfig] = useState<MapConfig | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [progress, setProgress] = useState<JourneyProgress | null>(null);
  const [userLevel, setUserLevel] = useState<number>(1);

  // Fetch all maps in sequence
  const fetchMapsSequence = useCallback(async () => {
    try {
      const res = await fetch("/api/journey/maps/sequence");
      const data = await res.json();
      if (data.success && data.maps && data.maps.length > 0) {
        setMaps(data.maps);
        return data.maps;
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

  // Load all journey data
  const fetchJourneyData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch maps, progress, and user level in parallel
      const [mapsData, progressData] = await Promise.all([
        fetchMapsSequence(),
        fetchProgress(),
        fetchUserLevel(),
      ]);

      if (mapsData.length === 0) {
        setError("No journey maps found. Please ask an admin to generate the journey.");
        return;
      }

      // Set current map based on progress or default to first
      const startMapIndex = progressData?.currentMapIndex || 1;
      setCurrentMapIndex(startMapIndex);

      // Fetch milestones for the current map
      const currentMap = mapsData.find((m: MapData) => m.sequenceOrder === startMapIndex);
      if (currentMap) {
        const milestonesData = await fetchMapMilestones(currentMap.mapId);
        setMilestones(milestonesData);
        setCurrentMapConfig({
          mapId: currentMap.mapId,
          name: currentMap.name,
          description: currentMap.description,
          zones: currentMap.zones || [],
          backgroundColor: currentMap.backgroundColor || "#1a3a5c",
          backgroundImage: currentMap.backgroundImage,
          sequenceOrder: currentMap.sequenceOrder,
          theme: currentMap.theme,
          difficulty: currentMap.difficulty,
          estimatedXP: currentMap.estimatedXP,
        });
      }
    } catch (err) {
      console.error("Error fetching journey data:", err);
      setError("Failed to load journey map. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [fetchMapsSequence, fetchProgress, fetchUserLevel, fetchMapMilestones]);

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
        backgroundImage: map.backgroundImage,
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

  // Handle map navigation
  const handleNavigateMap = (direction: "prev" | "next" | number) => {
    const userCurrentMapIndex = progress?.currentMapIndex || 1;
    
    if (typeof direction === "number") {
      if (direction >= 1 && direction <= maps.length) {
        // Check if map is unlocked (user can view any map they've reached or the first)
        if (direction <= userCurrentMapIndex || direction === 1) {
          setCurrentMapIndex(direction);
          loadMapData(direction);
        } else {
          toast.error("Complete the previous map to unlock this one!");
        }
      }
    } else if (direction === "prev" && currentMapIndex > 1) {
      const newIndex = currentMapIndex - 1;
      setCurrentMapIndex(newIndex);
      loadMapData(newIndex);
    } else if (direction === "next" && currentMapIndex < maps.length) {
      const newIndex = currentMapIndex + 1;
      if (newIndex <= userCurrentMapIndex) {
        setCurrentMapIndex(newIndex);
        loadMapData(newIndex);
      } else {
        toast.error("Complete this map first!");
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

      {/* Map Selector */}
      {maps.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex gap-2 overflow-x-auto pb-2">
            {maps.map((map) => {
              const userMapIndex = progress?.currentMapIndex || 1;
              const isUnlocked = map.sequenceOrder <= userMapIndex || map.sequenceOrder === 1;
              const isComplete = map.sequenceOrder < userMapIndex;
              const isCurrent = map.sequenceOrder === currentMapIndex;

              return (
                <Button
                  key={map.mapId}
                  variant={isCurrent ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleNavigateMap(map.sequenceOrder)}
                  disabled={!isUnlocked}
                  className={`flex items-center gap-2 whitespace-nowrap ${
                    isComplete ? "border-green-500" : ""
                  } ${isCurrent ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                >
                  {!isUnlocked && <Lock className="h-3 w-3" />}
                  {isComplete && <Star className="h-3 w-3 text-green-400" />}
                  <span>{map.sequenceOrder}. {map.name}</span>
                </Button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Current Map Info */}
      {currentMapConfig && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <Card className="border-amber-500/30">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-500/20">
                    <Map className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <div className="font-semibold text-lg">{currentMapConfig.name}</div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {currentMapConfig.theme} theme • Difficulty {currentMapConfig.difficulty}/10
                    </div>
                  </div>
                </div>
                <div className="text-right flex items-center gap-4">
                  <div>
                    <Badge variant="outline" className="mb-1">
                      {milestonesOnThisMap} / {milestones.length} milestones
                    </Badge>
                    <div className="w-32">
                      <Progress value={completionPercentage} className="h-2" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleNavigateMap("prev")}
                      disabled={currentMapIndex <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleNavigateMap("next")}
                      disabled={currentMapIndex >= maps.length || currentMapIndex >= (progress?.currentMapIndex || 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Journey Map */}
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
