"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Milestone } from "./JourneyMapRenderer";

interface MilestoneNodeProps {
  milestone: Milestone;
  status: "completed" | "current" | "unlocked" | "locked";
  onClick: () => void;
}

// Node type visual configs
const NODE_STYLES: Record<string, { glowColor: string; strokeWidth: number }> = {
  start: { glowColor: "#22C55E", strokeWidth: 3 },
  milestone: { glowColor: "#3B82F6", strokeWidth: 2 },
  checkpoint: { glowColor: "#F59E0B", strokeWidth: 2 },
  branch: { glowColor: "#8B5CF6", strokeWidth: 2 },
  legendary: { glowColor: "#EF4444", strokeWidth: 3 },
  lesson: { glowColor: "#F59E0B", strokeWidth: 2 },
  optional: { glowColor: "#6B7280", strokeWidth: 1 },
};

// Size mappings
const SIZE_MAP: Record<string, number> = {
  small: 18,
  medium: 24,
  large: 32,
};

export default function MilestoneNode({
  milestone,
  status,
  onClick,
}: MilestoneNodeProps) {
  const size = SIZE_MAP[milestone.size] || 24;
  const style = NODE_STYLES[milestone.nodeType] || NODE_STYLES.milestone;

  // Status-based styles
  const getStatusStyles = () => {
    switch (status) {
      case "completed":
        return {
          fill: milestone.color,
          stroke: "#22C55E",
          opacity: 1,
          cursor: "pointer",
          filter: "url(#glow)",
        };
      case "current":
        return {
          fill: milestone.color,
          stroke: "#3B82F6",
          opacity: 1,
          cursor: "pointer",
          filter: "url(#glow)",
        };
      case "unlocked":
        return {
          fill: milestone.color,
          stroke: "#64748B",
          opacity: 0.8,
          cursor: "pointer",
        };
      case "locked":
        return {
          fill: "#374151",
          stroke: "#1F2937",
          opacity: 0.4,
          cursor: "not-allowed",
        };
    }
  };

  const statusStyles = getStatusStyles();

  // Icon based on completion status
  const renderIcon = () => {
    if (status === "completed") {
      return (
        <text
          x={milestone.position.x}
          y={milestone.position.y + 4}
          textAnchor="middle"
          fontSize={size * 0.7}
          fill="#fff"
        >
          ✓
        </text>
      );
    }
    
    if (status === "locked") {
      return (
        <text
          x={milestone.position.x}
          y={milestone.position.y + 4}
          textAnchor="middle"
          fontSize={size * 0.6}
          fill="#6B7280"
        >
          🔒
        </text>
      );
    }

    // For unlocked/current, show node type indicator
    const icons: Record<string, string> = {
      start: "🏴",
      milestone: "⭐",
      checkpoint: "🎯",
      branch: "🔀",
      legendary: "👑",
      lesson: "📚",
      optional: "◇",
    };

    return (
      <text
        x={milestone.position.x}
        y={milestone.position.y + 5}
        textAnchor="middle"
        fontSize={size * 0.6}
      >
        {icons[milestone.nodeType] || "⭐"}
      </text>
    );
  };

  return (
    <g
      className={cn(
        "transition-transform",
        status !== "locked" && "hover:scale-110"
      )}
      style={{ cursor: statusStyles.cursor }}
      onClick={status !== "locked" ? onClick : undefined}
    >
      {/* Glow effect for current */}
      {status === "current" && (
        <motion.circle
          cx={milestone.position.x}
          cy={milestone.position.y}
          r={size + 8}
          fill="transparent"
          stroke="#3B82F6"
          strokeWidth={2}
          initial={{ opacity: 0.3, scale: 1 }}
          animate={{
            opacity: [0.3, 0.7, 0.3],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Completed checkmark ring */}
      {status === "completed" && (
        <circle
          cx={milestone.position.x}
          cy={milestone.position.y}
          r={size + 4}
          fill="transparent"
          stroke="#22C55E"
          strokeWidth={2}
          strokeDasharray="4,2"
        />
      )}

      {/* Main node circle */}
      <motion.circle
        cx={milestone.position.x}
        cy={milestone.position.y}
        r={size}
        fill={statusStyles.fill}
        stroke={statusStyles.stroke}
        strokeWidth={style.strokeWidth}
        opacity={statusStyles.opacity}
        style={{ filter: statusStyles.filter }}
        whileHover={status !== "locked" ? { scale: 1.1 } : {}}
        whileTap={status !== "locked" ? { scale: 0.95 } : {}}
      />

      {/* Inner decoration for special types */}
      {milestone.nodeType === "legendary" && status !== "locked" && (
        <circle
          cx={milestone.position.x}
          cy={milestone.position.y}
          r={size * 0.7}
          fill="transparent"
          stroke="#FCD34D"
          strokeWidth={1}
          strokeDasharray="3,3"
        />
      )}

      {milestone.nodeType === "branch" && status !== "locked" && (
        <>
          <line
            x1={milestone.position.x - size * 0.4}
            y1={milestone.position.y}
            x2={milestone.position.x + size * 0.4}
            y2={milestone.position.y}
            stroke="#fff"
            strokeWidth={2}
            opacity={0.5}
          />
          <line
            x1={milestone.position.x}
            y1={milestone.position.y - size * 0.4}
            x2={milestone.position.x}
            y2={milestone.position.y + size * 0.4}
            stroke="#fff"
            strokeWidth={2}
            opacity={0.5}
          />
        </>
      )}

      {/* Icon */}
      {renderIcon()}

      {/* Label */}
      <text
        x={milestone.position.x}
        y={milestone.position.y + size + 16}
        textAnchor="middle"
        fontSize="11"
        fontWeight={status === "current" ? "bold" : "normal"}
        fill={status === "locked" ? "#6B7280" : "#E2E8F0"}
        className="pointer-events-none select-none"
      >
        {milestone.name.length > 12 ? milestone.name.slice(0, 10) + "..." : milestone.name}
      </text>

      {/* XP reward badge */}
      {status !== "locked" && milestone.rewards.xp > 0 && (
        <g>
          <rect
            x={milestone.position.x + size - 8}
            y={milestone.position.y - size - 8}
            width={24}
            height={14}
            rx={7}
            fill="#F59E0B"
          />
          <text
            x={milestone.position.x + size + 4}
            y={milestone.position.y - size + 2}
            textAnchor="middle"
            fontSize="9"
            fontWeight="bold"
            fill="#fff"
          >
            +{milestone.rewards.xp}
          </text>
        </g>
      )}
    </g>
  );
}
