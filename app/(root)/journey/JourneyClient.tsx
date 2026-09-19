"use client";

import { useState, useEffect } from "react";
import JourneyMapRenderer, { 
  type MapConfig, 
  type Milestone,
  type MapSequenceInfo,
  type MilestoneProgress,
  type Zone,
} from "@/components/journey/JourneyMapRenderer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Map, Trophy, Star, Zap, Lock } from "lucide-react";
import { toast } from "sonner";

interface UserProgress {
  completedMilestones: string[];
  unlockedMilestones: string[];
  currentMilestone: string;
  totalXP: number;
  currentMapIndex: number;
  mapsCompleted: number;
}

interface MapData {
  mapId: string;
  name: string;
  description: string;
  theme: string;
  sequenceOrder: number;
  difficulty: number;
  estimatedXP: number;
  // Reason: `Zone` is the renderer's own exported shape, and `zones` is passed
  // straight through to it — a local re-declaration would be a second copy of a
  // type that only has to agree with one consumer.
  zones: Zone[];
  backgroundColor: string;
  backgroundImage?: string;
}

/**
 * One entry of the progress route's milestone lists.
 *
 * Reason: the route has returned bare id strings and `{ milestoneId }` objects
 * at different times, so the union is the honest type. Narrowing it to the
 * object form would compile and read correctly while dropping every id on a
 * deployment still serving strings.
 */
type ProgressEntry = string | { milestoneId?: string | null };

function milestoneIdOf(entry: ProgressEntry): string {
  if (typeof entry === "string") return entry;
  return entry?.milestoneId ?? "";
}

interface JourneyClientProps {
  userId: string;
}

export default function JourneyClient({ userId }: JourneyClientProps) {
  // Reason: the skeleton used to be gated on a `loading` flag that started true and was cleared
  // only by the map-data effect, which returned early when there were no maps - so an empty
  // sequence (what a gamification reset leaves behind, since it deletes every JourneyMapConfig
  // and reseeds none) spun the page for ever with no error and nothing in a log. This flag is
  // set by the sequence request itself, in a `finally`, so it separates "still asking" from
  // "asked, and none exist". The old `loading` flag is deliberately gone rather than left
  // write-only: a flag nothing reads is an invitation to re-gate the skeleton on it.
  const [mapsResolved, setMapsResolved] = useState(false);
  const [journeysEnabled, setJourneysEnabled] = useState(true);
  const [currentMapIndex, setCurrentMapIndex] = useState(1);
  const [maps, setMaps] = useState<MapData[]>([]);
  const [currentMapConfig, setCurrentMapConfig] = useState<MapConfig | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress>({
    completedMilestones: [],
    unlockedMilestones: [],
    currentMilestone: "",
    totalXP: 0,
    currentMapIndex: 1,
    mapsCompleted: 0,
  });
  const [milestoneProgress, setMilestoneProgress] = useState<MilestoneProgress[]>([]);

  // Fetch map sequence
  useEffect(() => {
    const fetchMaps = async () => {
      try {
        const res = await fetch("/api/journey/maps/sequence");
        const data = await res.json();
        if (data.success && data.maps) {
          setMaps(data.maps);
        }
        if (typeof data.journeysEnabled === "boolean") {
          setJourneysEnabled(data.journeysEnabled);
        }
      } catch (error) {
        console.error("Error fetching maps:", error);
      } finally {
        setMapsResolved(true);
      }
    };
    fetchMaps();
  }, []);

  // Fetch current map and milestones
  useEffect(() => {
    const fetchMapData = async () => {
      if (maps.length === 0) return;

      try {
        const currentMap = maps.find(m => m.sequenceOrder === currentMapIndex);
        if (!currentMap) return;

        // Fetch milestones for this map
        const res = await fetch(`/api/journey/maps/${currentMap.mapId}/milestones`);
        const data = await res.json();

        if (data.success) {
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
          setMilestones(data.milestones || []);
        }
      } catch (error) {
        console.error("Error fetching map data:", error);
        toast.error("Failed to load map");
      }
    };

    fetchMapData();
  }, [currentMapIndex, maps]);

  // Fetch user progress
  useEffect(() => {
    const fetchProgress = async () => {
      if (!userId) return;

      try {
        const res = await fetch(`/api/journey/progress/${userId}`);
        const data = await res.json();

        if (data.success) {
          // Extract milestone ID strings from objects (API returns { milestoneId, completedAt, rewards })
          //
          // Reason: the route has returned both shapes over time, so both are
          // accepted rather than assuming the newer one — a bare `.milestoneId`
          // read against the string form yields `undefined`, which `filter`
          // silently drops, and the player's journey renders as untouched.
          const completedIds = (
            (data.completedMilestones || []) as ProgressEntry[]
          )
            .map(milestoneIdOf)
            .filter(Boolean);
          const unlockedIds = ((data.unlockedMilestones || []) as ProgressEntry[])
            .map(milestoneIdOf)
            .filter(Boolean);
          setUserProgress({
            completedMilestones: completedIds,
            unlockedMilestones: unlockedIds,
            currentMilestone: data.currentMilestone || "",
            totalXP: data.totalXP || 0,
            currentMapIndex: data.currentMapIndex || 1,
            mapsCompleted: data.mapsCompleted || 0,
          });
          // Store milestone progress data for progress bars
          if (data.milestoneProgress) {
            setMilestoneProgress(data.milestoneProgress);
          }
          // Start at user's current map
          if (data.currentMapIndex) {
            setCurrentMapIndex(data.currentMapIndex);
          }
        }
      } catch (error) {
        console.error("Error fetching progress:", error);
      }
    };

    fetchProgress();
  }, [userId]);

  // Build sequence info for navigation
  const sequenceInfo: MapSequenceInfo | null = maps.length > 0 ? {
    currentMapIndex,
    totalMaps: maps.length,
    mapsCompleted: userProgress.mapsCompleted,
    maps: maps.map(map => ({
      mapId: map.mapId,
      name: map.name,
      theme: map.theme,
      sequenceOrder: map.sequenceOrder,
      isUnlocked: map.sequenceOrder <= userProgress.currentMapIndex || map.sequenceOrder === 1,
      isComplete: map.sequenceOrder < userProgress.currentMapIndex,
      completionPercentage: 0, // Could calculate from milestones
    })),
  } : null;

  const handleNavigateMap = (direction: "prev" | "next" | number) => {
    if (typeof direction === "number") {
      if (direction >= 1 && direction <= maps.length) {
        // Check if map is unlocked
        if (direction <= userProgress.currentMapIndex || direction === 1) {
          setCurrentMapIndex(direction);
        } else {
          toast.error("Complete the previous map to unlock this one!");
        }
      }
    } else if (direction === "prev" && currentMapIndex > 1) {
      setCurrentMapIndex(currentMapIndex - 1);
    } else if (direction === "next" && currentMapIndex < maps.length) {
      if (currentMapIndex < userProgress.currentMapIndex || currentMapIndex === userProgress.currentMapIndex) {
        setCurrentMapIndex(currentMapIndex + 1);
      } else {
        toast.error("Complete this map first!");
      }
    }
  };

  const handleMilestoneClick = (milestone: Milestone) => {
    // Show milestone details
    toast.info(
      <div>
        <strong>{milestone.name}</strong>
        <p className="text-sm">{milestone.description}</p>
        <p className="text-xs mt-1">Reward: {milestone.rewards?.xp || 0} XP</p>
      </div>
    );
  };

  if (!mapsResolved && maps.length === 0) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (mapsResolved && maps.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Map className="h-6 w-6 text-amber-400" />
              Your Journey
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {journeysEnabled === false
                ? "The journey system is currently turned off. Check back later."
                : "No journey maps found. Please ask an admin to generate the journey."}
            </p>
            {journeysEnabled !== false && (
              <Button variant="outline" onClick={() => window.location.reload()}>
                Try again
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Map className="h-8 w-8 text-amber-400" />
            Your Journey
          </h1>
          <p className="text-muted-foreground mt-1">
            Complete trading or gaming milestones to earn XP and unlock new maps
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              <span className="font-bold">{userProgress.totalXP}</span>
              <span className="text-muted-foreground">XP</span>
            </div>
          </Card>
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-400" />
              <span className="font-bold">{userProgress.mapsCompleted}</span>
              <span className="text-muted-foreground">/ 10 Maps</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Map Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {maps.map((map) => {
          const isUnlocked = map.sequenceOrder <= userProgress.currentMapIndex || map.sequenceOrder === 1;
          const isComplete = map.sequenceOrder < userProgress.currentMapIndex;
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
              }`}
            >
              {!isUnlocked && <Lock className="h-3 w-3" />}
              {isComplete && <Star className="h-3 w-3 text-green-400" />}
              <span>{map.sequenceOrder}. {map.name}</span>
            </Button>
          );
        })}
      </div>

      {/* Journey Map */}
      <div className="rounded-xl overflow-hidden border-4 border-amber-900/30">
        <JourneyMapRenderer
          mapConfig={currentMapConfig}
          milestones={milestones}
          completedIds={userProgress.completedMilestones}
          unlockedIds={userProgress.unlockedMilestones}
          currentMilestone={userProgress.currentMilestone}
          userLevel={1}
          milestoneProgress={milestoneProgress}
          onMilestoneClick={handleMilestoneClick}
          sequenceInfo={sequenceInfo ?? undefined}
          onNavigateMap={handleNavigateMap}
          showMapNavigation={true}
        />
      </div>

      {/* Progress Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Current Map</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold capitalize">
              {currentMapConfig?.name || "Loading..."}
            </div>
            <Badge variant="secondary" className="mt-1 capitalize">
              {currentMapConfig?.theme || "pirate"} theme
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Milestones Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userProgress.completedMilestones.length}
            </div>
            <p className="text-xs text-muted-foreground">
              of {milestones.length} on this map
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Difficulty</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentMapConfig?.difficulty || 1}/10
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full mt-2">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-red-500 rounded-full"
                style={{ width: `${((currentMapConfig?.difficulty || 1) / 10) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Map XP Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentMapConfig?.estimatedXP?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">XP available</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
