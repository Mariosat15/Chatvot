"use client";

import { useState, useEffect, useCallback } from "react";
import { JourneyMapRenderer, type Milestone, type MapConfig, type Zone } from "@/components/journey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Map, Target, Trophy, Star, Compass, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

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
}

interface JourneyMapTabProps {
  userId: string;
}

export default function JourneyMapTab({ userId }: JourneyMapTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [progress, setProgress] = useState<JourneyProgress | null>(null);
  const [userLevel, setUserLevel] = useState<number>(1);

  // Fetch journey data
  const fetchJourneyData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch map config, milestones, user progress, and user level
      const [mapRes, milestonesRes, progressRes, levelRes] = await Promise.all([
        fetch("/api/journey-map?mapId=traders_journey"),
        fetch("/api/journey-milestones?mapId=traders_journey"),
        fetch(`/api/journey-progress?userId=${userId}`),
        fetch(`/api/user-level?userId=${userId}`),
      ]);

      const mapData = await mapRes.json();
      const milestonesData = await milestonesRes.json();
      const progressData = await progressRes.json();
      const levelData = await levelRes.json();

      if (mapData.success) {
        setMapConfig(mapData.mapConfig);
      }

      if (milestonesData.success) {
        setMilestones(milestonesData.milestones);
      }

      if (progressData.success) {
        setProgress(progressData.progress);
      }

      if (levelData.success && levelData.userLevel) {
        setUserLevel(levelData.userLevel.currentLevel || 1);
      }
    } catch (err) {
      console.error("Error fetching journey data:", err);
      setError("Failed to load journey map. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchJourneyData();
  }, [fetchJourneyData]);

  // Calculate stats
  const requiredMilestones = milestones.filter(m => m.isRequired).length;
  const completedCount = progress?.totalMilestonesCompleted || 0;
  const completionPercentage = requiredMilestones > 0 
    ? Math.round((completedCount / requiredMilestones) * 100)
    : 0;

  const completedIds = progress?.completedMilestones?.map(m => m.milestoneId) || [];
  const unlockedIds = progress?.unlockedMilestones || [];

  // Get current zone name
  const currentZone = mapConfig?.zones?.find(z => z.id === progress?.currentZone);

  // Calculate days on journey
  const journeyDays = progress?.journeyStartedAt
    ? Math.floor((Date.now() - new Date(progress.journeyStartedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  if (loading) {
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
                  <div className="text-2xl font-bold">{completedCount}</div>
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
                  <Sparkles className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{completionPercentage}%</div>
                  <div className="text-sm text-muted-foreground">Complete</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Current Position Card */}
      {currentZone && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-2" style={{ borderColor: currentZone.color + "40" }}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: currentZone.color + "20" }}
                  >
                    <Map className="h-6 w-6" style={{ color: currentZone.color }} />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Current Zone</div>
                    <div className="font-semibold text-lg">{currentZone.name}</div>
                    <div className="text-sm text-muted-foreground">{currentZone.description}</div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="mb-2">
                    Zone {mapConfig?.zones?.findIndex(z => z.id === currentZone.id)! + 1} of {mapConfig?.zones?.length}
                  </Badge>
                  <div className="w-32">
                    <Progress
                      value={completionPercentage}
                      className="h-2"
                    />
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
              mapConfig={mapConfig}
              milestones={milestones}
              completedIds={completedIds}
              unlockedIds={unlockedIds}
              currentMilestone={progress?.currentMilestone}
              userLevel={userLevel}
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
                            style={{ backgroundColor: milestone.color + "20" }}
                          >
                            <Target className="h-5 w-5" style={{ color: milestone.color }} />
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
