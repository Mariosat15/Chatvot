/**
 * Journey Sequence Service
 * 
 * Manages multi-map journey progression with 10 sequential maps.
 * Features:
 * - Sequential map unlocking (must complete Map N to unlock Map N+1)
 * - Cross-map progress tracking
 * - XP economy management
 * - Map completion verification
 */

import { connectToDatabase } from "@/database/mongoose";
import JourneyMapConfig, { IJourneyMapConfig, MapTheme } from "@/database/models/journey-map-config.model";
import JourneyMilestone, { IJourneyMilestone } from "@/database/models/journey-milestone.model";
import UserJourneyProgress, { IUserJourneyProgress } from "@/database/models/user-journey-progress.model";

// Map sequence configuration
export const MAP_SEQUENCE_CONFIG = {
  totalMaps: 10,
  completionRequirementDefault: 100, // 100% completion required to unlock next
};

export interface MapInfo {
  mapId: string;
  name: string;
  description: string;
  theme: MapTheme;
  sequenceOrder: number;
  difficulty: number;
  estimatedXP: number;
  requiredLevelToStart: number;
  totalMilestones: number;
  isUnlocked: boolean;
  isComplete: boolean;
  completionPercentage: number;
  xpEarned: number;
}

export interface SequenceOverview {
  totalMaps: number;
  mapsCompleted: number;
  currentMapIndex: number;
  totalXPEarned: number;
  totalMilestonesCompleted: number;
  overallCompletionPercentage: number;
  maps: MapInfo[];
}

/**
 * Get all maps in sequence order
 */
export async function getMapSequence(): Promise<IJourneyMapConfig[]> {
  await connectToDatabase();
  
  const maps = await JourneyMapConfig.find({ isActive: true })
    .sort({ sequenceOrder: 1 })
    .lean() as IJourneyMapConfig[];
  
  return maps;
}

/**
 * Get a specific map by sequence order
 */
export async function getMapBySequenceOrder(order: number): Promise<IJourneyMapConfig | null> {
  await connectToDatabase();
  
  const map = await JourneyMapConfig.findOne({ 
    sequenceOrder: order, 
    isActive: true 
  }).lean() as IJourneyMapConfig | null;
  
  return map;
}

/**
 * Get user's current active map
 */
export async function getCurrentMap(userId: string): Promise<IJourneyMapConfig | null> {
  await connectToDatabase();
  
  // Get user's progress to find current map index
  const progress = await UserJourneyProgress.findOne({ userId })
    .sort({ currentMapIndex: -1 })
    .lean() as IUserJourneyProgress | null;
  
  const currentIndex = progress?.currentMapIndex || 1;
  
  return getMapBySequenceOrder(currentIndex);
}

/**
 * Get the next map in sequence for a user
 */
export async function getNextMap(userId: string): Promise<IJourneyMapConfig | null> {
  await connectToDatabase();
  
  const progress = await UserJourneyProgress.findOne({ userId })
    .sort({ currentMapIndex: -1 })
    .lean() as IUserJourneyProgress | null;
  
  const currentIndex = progress?.currentMapIndex || 1;
  
  if (currentIndex >= MAP_SEQUENCE_CONFIG.totalMaps) {
    return null; // Already at last map
  }
  
  return getMapBySequenceOrder(currentIndex + 1);
}

/**
 * Get the previous map in sequence for a user
 */
export async function getPreviousMap(userId: string): Promise<IJourneyMapConfig | null> {
  await connectToDatabase();
  
  const progress = await UserJourneyProgress.findOne({ userId })
    .sort({ currentMapIndex: -1 })
    .lean() as IUserJourneyProgress | null;
  
  const currentIndex = progress?.currentMapIndex || 1;
  
  if (currentIndex <= 1) {
    return null; // Already at first map
  }
  
  return getMapBySequenceOrder(currentIndex - 1);
}

/**
 * Check if a specific map is complete for a user
 */
export async function checkMapCompletion(
  userId: string, 
  mapId: string
): Promise<{ isComplete: boolean; percentage: number; milestonesCompleted: number; totalMilestones: number }> {
  await connectToDatabase();
  
  // Get map config for completion requirement
  const mapConfig = await JourneyMapConfig.findOne({ mapId }).lean() as IJourneyMapConfig | null;
  if (!mapConfig) {
    return { isComplete: false, percentage: 0, milestonesCompleted: 0, totalMilestones: 0 };
  }
  
  // Get all milestones for this map
  const milestones = await JourneyMilestone.find({ mapId, isActive: true, isRequired: true })
    .lean() as IJourneyMilestone[];
  
  const totalMilestones = milestones.length;
  if (totalMilestones === 0) {
    return { isComplete: true, percentage: 100, milestonesCompleted: 0, totalMilestones: 0 };
  }
  
  // Get user's progress for this map
  const progress = await UserJourneyProgress.findOne({ userId, mapId })
    .lean() as IUserJourneyProgress | null;
  
  const completedMilestoneIds = progress?.completedMilestones?.map(m => m.milestoneId) || [];
  const requiredMilestoneIds = milestones.map(m => m.id);
  
  const milestonesCompleted = requiredMilestoneIds.filter(id => 
    completedMilestoneIds.includes(id)
  ).length;
  
  const percentage = Math.round((milestonesCompleted / totalMilestones) * 100);
  const isComplete = percentage >= (mapConfig.completionRequirement || 100);
  
  return { isComplete, percentage, milestonesCompleted, totalMilestones };
}

/**
 * Check if user can access a specific map
 */
export async function canAccessMap(userId: string, mapId: string): Promise<boolean> {
  await connectToDatabase();
  
  // Get the target map
  const targetMap = await JourneyMapConfig.findOne({ mapId }).lean() as IJourneyMapConfig | null;
  if (!targetMap) return false;
  
  // First map is always accessible
  if (targetMap.sequenceOrder === 1) return true;
  
  // Check if previous map is complete
  const previousMapId = targetMap.previousMapId;
  if (!previousMapId) return true; // No prerequisite
  
  const { isComplete } = await checkMapCompletion(userId, previousMapId);
  return isComplete;
}

/**
 * Unlock the next map for a user after completing current map
 */
export async function unlockNextMap(userId: string): Promise<{ 
  success: boolean; 
  newMapId?: string; 
  message: string;
}> {
  await connectToDatabase();
  
  // Get current progress
  const currentProgress = await UserJourneyProgress.findOne({ userId })
    .sort({ currentMapIndex: -1 });
  
  if (!currentProgress) {
    return { success: false, message: "No journey progress found" };
  }
  
  // Check if current map is complete
  const { isComplete, percentage } = await checkMapCompletion(userId, currentProgress.mapId);
  
  if (!isComplete) {
    return { 
      success: false, 
      message: `Current map not complete (${percentage}% done)` 
    };
  }
  
  // Mark current map as complete
  currentProgress.isMapComplete = true;
  currentProgress.mapCompletedAt = new Date();
  
  if (!currentProgress.completedMaps.includes(currentProgress.mapId)) {
    currentProgress.completedMaps.push(currentProgress.mapId);
    currentProgress.totalMapsCompleted = currentProgress.completedMaps.length;
  }
  
  await currentProgress.save();
  
  // Get next map
  const nextMap = await getMapBySequenceOrder(currentProgress.currentMapIndex + 1);
  
  if (!nextMap) {
    return { 
      success: true, 
      message: "Congratulations! You've completed all maps!" 
    };
  }
  
  // Create progress entry for new map
  const existingNextProgress = await UserJourneyProgress.findOne({ 
    userId, 
    mapId: nextMap.mapId 
  });
  
  if (!existingNextProgress) {
    // Get the first milestone of the new map
    const firstMilestone = await JourneyMilestone.findOne({ 
      mapId: nextMap.mapId, 
      isActive: true 
    }).sort({ order: 1 }).lean() as IJourneyMilestone | null;
    
    await UserJourneyProgress.create({
      userId,
      mapId: nextMap.mapId,
      currentMapIndex: nextMap.sequenceOrder,
      currentZone: firstMilestone?.zoneId || "zone_1",
      currentMilestone: firstMilestone?.id || "start",
      unlockedMilestones: firstMilestone ? [firstMilestone.id] : [],
      completedMaps: currentProgress.completedMaps,
      totalMapsCompleted: currentProgress.totalMapsCompleted,
      allMapsXP: currentProgress.allMapsXP,
      journeyStartedAt: new Date(),
    });
  }
  
  return { 
    success: true, 
    newMapId: nextMap.mapId,
    message: `Map "${nextMap.name}" unlocked!` 
  };
}

/**
 * Calculate total progress across all maps
 */
export async function calculateTotalProgress(userId: string): Promise<SequenceOverview> {
  await connectToDatabase();
  
  const maps = await getMapSequence();
  const mapInfos: MapInfo[] = [];
  
  let totalXPEarned = 0;
  let totalMilestonesCompleted = 0;
  let totalMilestones = 0;
  let mapsCompleted = 0;
  let currentMapIndex = 1;
  
  for (const map of maps) {
    const { isComplete, percentage, milestonesCompleted, totalMilestones: mapTotalMilestones } = 
      await checkMapCompletion(userId, map.mapId);
    
    const progress = await UserJourneyProgress.findOne({ userId, mapId: map.mapId })
      .lean() as IUserJourneyProgress | null;
    
    const xpEarned = progress?.totalXPFromJourney || 0;
    totalXPEarned += xpEarned;
    totalMilestonesCompleted += milestonesCompleted;
    totalMilestones += mapTotalMilestones;
    
    if (isComplete) {
      mapsCompleted++;
    }
    
    // Determine if map is unlocked
    const isUnlocked = map.sequenceOrder === 1 || 
      (map.previousMapId ? (await checkMapCompletion(userId, map.previousMapId)).isComplete : true);
    
    // Track highest unlocked map as current
    if (isUnlocked && !isComplete) {
      currentMapIndex = Math.max(currentMapIndex, map.sequenceOrder);
    }
    
    mapInfos.push({
      mapId: map.mapId,
      name: map.name,
      description: map.description,
      theme: map.theme,
      sequenceOrder: map.sequenceOrder,
      difficulty: map.difficulty,
      estimatedXP: map.estimatedXP,
      requiredLevelToStart: map.requiredLevelToStart,
      totalMilestones: mapTotalMilestones,
      isUnlocked,
      isComplete,
      completionPercentage: percentage,
      xpEarned,
    });
  }
  
  const overallCompletionPercentage = totalMilestones > 0 
    ? Math.round((totalMilestonesCompleted / totalMilestones) * 100)
    : 0;
  
  return {
    totalMaps: maps.length,
    mapsCompleted,
    currentMapIndex,
    totalXPEarned,
    totalMilestonesCompleted,
    overallCompletionPercentage,
    maps: mapInfos,
  };
}

/**
 * Initialize the map sequence with default maps if none exist
 */
export async function initializeMapSequence(maps: Partial<IJourneyMapConfig>[]): Promise<void> {
  await connectToDatabase();
  
  for (let i = 0; i < maps.length; i++) {
    const mapData = maps[i];
    const sequenceOrder = i + 1;
    
    // Set previous and next map IDs
    const previousMapId = i > 0 ? maps[i - 1].mapId : null;
    const nextMapId = i < maps.length - 1 ? maps[i + 1].mapId : null;
    
    await JourneyMapConfig.findOneAndUpdate(
      { mapId: mapData.mapId },
      {
        ...mapData,
        sequenceOrder,
        previousMapId,
        nextMapId,
      },
      { upsert: true, new: true }
    );
  }
}

/**
 * Update map milestone count (call after adding/removing milestones)
 */
export async function updateMapMilestoneCount(mapId: string): Promise<number> {
  await connectToDatabase();
  
  const count = await JourneyMilestone.countDocuments({ mapId, isActive: true, isRequired: true });
  
  await JourneyMapConfig.findOneAndUpdate(
    { mapId },
    { totalMilestones: count }
  );
  
  return count;
}

/**
 * Get map by mapId
 */
export async function getMapById(mapId: string): Promise<IJourneyMapConfig | null> {
  await connectToDatabase();
  
  return JourneyMapConfig.findOne({ mapId, isActive: true }).lean() as Promise<IJourneyMapConfig | null>;
}

/**
 * Connect map in sequence (set previous/next relationships)
 */
export async function connectMapsInSequence(): Promise<void> {
  await connectToDatabase();
  
  const maps = await JourneyMapConfig.find({ isActive: true }).sort({ sequenceOrder: 1 });
  
  for (let i = 0; i < maps.length; i++) {
    const map = maps[i];
    const previousMapId = i > 0 ? maps[i - 1].mapId : null;
    const nextMapId = i < maps.length - 1 ? maps[i + 1].mapId : null;
    
    map.previousMapId = previousMapId;
    map.nextMapId = nextMapId;
    await map.save();
  }
}

/**
 * Calculate XP budget for a map based on position in sequence
 * Uses front-loaded progression formula
 */
export function calculateMapXPBudget(sequenceOrder: number): number {
  // Front-loaded XP progression
  // Map 1: 150, Map 2: 200, Map 3: 300... Map 10: 5000+
  const budgets = [150, 200, 300, 400, 500, 700, 1000, 1500, 2500, 5000];
  return budgets[sequenceOrder - 1] || 150;
}

/**
 * Calculate individual milestone XP based on map and order
 * Formula: 5 + (mapIndex * 3) + (orderInMap * 2)
 */
export function calculateMilestoneXP(mapSequenceOrder: number, orderInMap: number): number {
  return 5 + (mapSequenceOrder * 3) + (orderInMap * 2);
}

/**
 * Get map theme name configuration
 */
export function getMapThemeConfig(theme: MapTheme): {
  backgroundColor: string;
  primaryColor: string;
  accentColor: string;
  iconStyle: string;
} {
  const themes: Record<MapTheme, { backgroundColor: string; primaryColor: string; accentColor: string; iconStyle: string }> = {
    pirate: { backgroundColor: "#1a3a5c", primaryColor: "#F59E0B", accentColor: "#22C55E", iconStyle: "pirate" },
    space: { backgroundColor: "#0F0F2D", primaryColor: "#8B5CF6", accentColor: "#06B6D4", iconStyle: "space" },
    medieval: { backgroundColor: "#2D1F1A", primaryColor: "#EF4444", accentColor: "#F59E0B", iconStyle: "medieval" },
    cyber: { backgroundColor: "#0D1117", primaryColor: "#00FFFF", accentColor: "#FF00FF", iconStyle: "cyber" },
    ancient: { backgroundColor: "#2A2520", primaryColor: "#D4A373", accentColor: "#E9C46A", iconStyle: "ancient" },
    volcanic: { backgroundColor: "#1A0F0F", primaryColor: "#DC2626", accentColor: "#F97316", iconStyle: "volcanic" },
    arctic: { backgroundColor: "#0F172A", primaryColor: "#38BDF8", accentColor: "#E2E8F0", iconStyle: "arctic" },
    dragon: { backgroundColor: "#1F1520", primaryColor: "#A855F7", accentColor: "#EF4444", iconStyle: "dragon" },
    celestial: { backgroundColor: "#0C0C1E", primaryColor: "#FFD700", accentColor: "#F0F8FF", iconStyle: "celestial" },
    legendary: { backgroundColor: "#1A1A2E", primaryColor: "#FFD700", accentColor: "#FF6B6B", iconStyle: "legendary" },
  };
  
  return themes[theme] || themes.pirate;
}

/**
 * Validate map sequence is properly configured
 */
export async function validateMapSequence(): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  await connectToDatabase();
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const maps = await getMapSequence();
  
  // Check we have expected number of maps
  if (maps.length === 0) {
    errors.push("No maps found in sequence");
    return { isValid: false, errors, warnings };
  }
  
  if (maps.length < 10) {
    warnings.push(`Only ${maps.length} maps configured, expected 10`);
  }
  
  // Check sequence order is continuous
  for (let i = 0; i < maps.length; i++) {
    const expectedOrder = i + 1;
    if (maps[i].sequenceOrder !== expectedOrder) {
      errors.push(`Map "${maps[i].name}" has order ${maps[i].sequenceOrder}, expected ${expectedOrder}`);
    }
  }
  
  // Check previous/next links
  for (let i = 0; i < maps.length; i++) {
    const map = maps[i];
    
    if (i > 0 && map.previousMapId !== maps[i - 1].mapId) {
      errors.push(`Map "${map.name}" has incorrect previousMapId`);
    }
    
    if (i < maps.length - 1 && map.nextMapId !== maps[i + 1].mapId) {
      errors.push(`Map "${map.name}" has incorrect nextMapId`);
    }
  }
  
  // Check each map has milestones
  for (const map of maps) {
    const milestoneCount = await JourneyMilestone.countDocuments({ mapId: map.mapId, isActive: true });
    if (milestoneCount === 0) {
      warnings.push(`Map "${map.name}" has no milestones`);
    }
  }
  
  // Check XP budgets are increasing
  for (let i = 1; i < maps.length; i++) {
    if (maps[i].estimatedXP <= maps[i - 1].estimatedXP) {
      warnings.push(`Map "${maps[i].name}" XP budget (${maps[i].estimatedXP}) should be higher than previous (${maps[i - 1].estimatedXP})`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
