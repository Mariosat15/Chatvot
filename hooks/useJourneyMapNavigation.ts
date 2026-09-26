"use client";

import { useState, useCallback, useEffect } from "react";
import { MapSequenceInfo } from "@/components/journey/JourneyMapRenderer";

interface MapData {
  _id: string;
  mapId: string;
  name: string;
  theme: string;
  sequenceOrder: number;
  difficulty: number;
  estimatedXP: number;
  previousMapId?: string | null;
  nextMapId?: string | null;
  description?: string;
  zones?: any[];
  backgroundColor?: string;
  backgroundImage?: string;
}

interface UserMapProgress {
  mapId: string;
  isComplete: boolean;
  completedMilestones: string[];
  totalMilestones: number;
}

interface UseJourneyMapNavigationProps {
  userId?: string;
  initialMapIndex?: number;
  whitelabelId?: string;
}

interface UseJourneyMapNavigationReturn {
  currentMapIndex: number;
  currentMap: MapData | null;
  sequenceInfo: MapSequenceInfo | null;
  isLoading: boolean;
  error: string | null;
  navigateToMap: (direction: "prev" | "next" | number) => void;
  refreshSequence: () => Promise<void>;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
}

export function useJourneyMapNavigation({
  userId,
  initialMapIndex = 1,
  whitelabelId,
}: UseJourneyMapNavigationProps): UseJourneyMapNavigationReturn {
  const [currentMapIndex, setCurrentMapIndex] = useState(initialMapIndex);
  const [maps, setMaps] = useState<MapData[]>([]);
  const [userProgress, setUserProgress] = useState<UserMapProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch the map sequence and user progress
  const fetchSequenceData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all maps in sequence
      const mapsResponse = await fetch(
        `/api/journey/maps/sequence${whitelabelId ? `?whitelabelId=${whitelabelId}` : ""}`
      );

      if (!mapsResponse.ok) {
        throw new Error("Failed to fetch map sequence");
      }

      const mapsData = await mapsResponse.json();
      setMaps(mapsData.maps || []);

      // Fetch user progress if userId is provided
      if (userId) {
        const progressResponse = await fetch(
          `/api/journey/progress/${userId}${whitelabelId ? `?whitelabelId=${whitelabelId}` : ""}`
        );

        if (progressResponse.ok) {
          const progressData = await progressResponse.json();
          setUserProgress(progressData.mapProgress || []);
          
          // Set current map to user's active map if available
          if (progressData.currentMapIndex) {
            setCurrentMapIndex(progressData.currentMapIndex);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [userId, whitelabelId]);

  // Initial fetch
  useEffect(() => {
    fetchSequenceData();
  }, [fetchSequenceData]);

  // Get the current map data
  const currentMap = maps.find((m) => m.sequenceOrder === currentMapIndex) || null;

  // Build sequence info for the renderer
  const sequenceInfo: MapSequenceInfo | null = maps.length > 0
    ? {
        currentMapIndex,
        totalMaps: maps.length,
        mapsCompleted: userProgress.filter((p) => p.isComplete).length,
        maps: maps.map((map) => {
          const progress = userProgress.find((p) => p.mapId === map.mapId);
          const prevMapComplete =
            map.sequenceOrder === 1 ||
            userProgress.find(
              (p) =>
                p.mapId === maps.find((m) => m.sequenceOrder === map.sequenceOrder - 1)?.mapId
            )?.isComplete;

          return {
            mapId: map.mapId,
            name: map.name,
            theme: map.theme,
            sequenceOrder: map.sequenceOrder,
            isUnlocked: map.sequenceOrder === 1 || !!prevMapComplete,
            isComplete: progress?.isComplete || false,
            completionPercentage: progress
              ? (progress.completedMilestones.length / Math.max(progress.totalMilestones, 1)) * 100
              : 0,
          };
        }),
      }
    : null;

  // Navigation logic
  const canNavigatePrev = currentMapIndex > 1;
  const canNavigateNext =
    currentMapIndex < maps.length &&
    (sequenceInfo?.maps[currentMapIndex]?.isUnlocked || false);

  const navigateToMap = useCallback(
    (direction: "prev" | "next" | number) => {
      if (typeof direction === "number") {
        // Direct navigation to a specific map
        const targetMap = sequenceInfo?.maps.find((m) => m.sequenceOrder === direction);
        if (targetMap?.isUnlocked) {
          setCurrentMapIndex(direction);
        }
      } else if (direction === "prev" && canNavigatePrev) {
        setCurrentMapIndex((prev) => prev - 1);
      } else if (direction === "next" && canNavigateNext) {
        setCurrentMapIndex((prev) => prev + 1);
      }
    },
    [canNavigatePrev, canNavigateNext, sequenceInfo]
  );

  return {
    currentMapIndex,
    currentMap,
    sequenceInfo,
    isLoading,
    error,
    navigateToMap,
    refreshSequence: fetchSequenceData,
    canNavigatePrev,
    canNavigateNext,
  };
}
