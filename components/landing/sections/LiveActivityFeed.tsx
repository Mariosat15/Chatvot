"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { LandingTheme } from "@/lib/themes/landing-themes";

interface Activity {
  id: string;
  type:
    | "competition_win"
    | "challenge_complete"
    | "new_user"
    | "big_trade"
    | "competition_start";
  message: string;
  icon: string;
  color: string;
  timestamp: string;
}

interface LiveActivityFeedProps {
  theme?: LandingTheme;
  effectiveColors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    text?: string;
  };
  maxItems?: number;
  refreshInterval?: number;
}

export default function LiveActivityFeed({
  theme,
  effectiveColors: propColors,
  maxItems = 5,
  refreshInterval = 30000,
}: LiveActivityFeedProps) {
  const effectiveColors = {
    primary: propColors?.primary || "#00f0ff",
    secondary: propColors?.secondary || "#ff00ff",
    accent: propColors?.accent || "#ffd700",
    text: propColors?.text || "#ffffff",
  };
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayedActivities, setDisplayedActivities] = useState<Activity[]>(
    [],
  );
  const currentIndex = useRef(0);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch("/api/landing/live-activity");
        if (response.ok) {
          const data = await response.json();
          setActivities(data.activities || []);
        }
      } catch (error) {
        console.error("Failed to fetch activities:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
    const interval = setInterval(fetchActivities, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Cycle through activities one at a time
  useEffect(() => {
    if (activities.length === 0) return;

    // Initialize with first batch
    setDisplayedActivities(activities.slice(0, maxItems));

    // Cycle through activities
    const cycleInterval = setInterval(() => {
      setDisplayedActivities((prev) => {
        if (activities.length <= maxItems) return activities;

        currentIndex.current = (currentIndex.current + 1) % activities.length;
        const newActivity = activities[currentIndex.current];

        // Add new activity and remove oldest
        const updated = [...prev.slice(1), newActivity];
        return updated;
      });
    }, 5000); // Show new activity every 5 seconds

    return () => clearInterval(cycleInterval);
  }, [activities, maxItems]);

  const getActivityColor = (type: string) => {
    switch (type) {
      case "competition_win":
        return theme?.colors?.warning || "#f59e0b";
      case "challenge_complete":
        return effectiveColors.secondary;
      case "big_trade":
        return theme?.colors?.success || "#22c55e";
      case "competition_start":
        return effectiveColors.primary;
      case "new_user":
        return "#3b82f6";
      default:
        return effectiveColors.primary;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: theme?.colors?.backgroundCard,
          border: `1px solid ${theme?.colors?.border}`,
        }}
      >
        <div className="flex items-center justify-center gap-2">
          <Loader2
            className="h-5 w-5 animate-spin"
            style={{ color: effectiveColors.primary }}
          />
          <span style={{ color: theme?.colors?.textMuted }}>
            Loading activity...
          </span>
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: theme?.colors?.backgroundCard,
        border: `1px solid ${theme?.colors?.border}`,
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{
          background: `linear-gradient(135deg, ${effectiveColors.primary}15, ${effectiveColors.secondary}15)`,
          borderBottom: `1px solid ${theme?.colors?.border}`,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📡</span>
          <span
            className="font-bold text-sm"
            style={{ color: effectiveColors.text }}
          >
            Live Activity
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: theme?.colors?.success || "#22c55e" }}
          />
          <span className="text-xs" style={{ color: theme?.colors?.textMuted }}>
            Live
          </span>
        </div>
      </div>

      {/* Activity List */}
      <div className="p-3 space-y-2 max-h-[300px] overflow-hidden">
        <AnimatePresence mode="popLayout">
          {displayedActivities.map((activity) => (
            <motion.div
              key={activity.id}
              layout
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                backgroundColor: `${getActivityColor(activity.type)}08`,
                border: `1px solid ${getActivityColor(activity.type)}15`,
              }}
            >
              <span className="text-xl flex-shrink-0">{activity.icon}</span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm truncate"
                  style={{ color: effectiveColors.text }}
                >
                  {activity.message}
                </p>
                <p
                  className="text-xs"
                  style={{ color: theme?.colors?.textMuted }}
                >
                  {formatTimeAgo(activity.timestamp)}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
