"use client";

import { motion } from "framer-motion";

interface PathConnectionProps {
  start: { x: number; y: number };
  end: { x: number; y: number };
  color: string;
  isActive: boolean;
  isBranch?: boolean;
  animated?: boolean;
}

export default function PathConnection({
  start,
  end,
  color,
  isActive,
  isBranch = false,
  animated = false,
}: PathConnectionProps) {
  // Calculate control points for a curved path
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  
  // Add some curve based on the direction
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const curveOffset = Math.min(Math.abs(dx), Math.abs(dy)) * 0.3;
  
  // Create a smooth bezier curve
  const controlPoint1X = start.x + dx * 0.3;
  const controlPoint1Y = start.y;
  const controlPoint2X = end.x - dx * 0.3;
  const controlPoint2Y = end.y;

  const pathD = `M ${start.x} ${start.y} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${end.x} ${end.y}`;

  // Calculate path length for animation
  const pathLength = Math.sqrt(dx * dx + dy * dy) * 1.2; // Approximate

  return (
    <g>
      {/* Background path (always visible, dimmed when not active) */}
      <path
        d={pathD}
        fill="none"
        stroke={isActive ? color : "#374151"}
        strokeWidth={isActive ? 3 : 2}
        strokeOpacity={isActive ? 0.6 : 0.2}
        strokeLinecap="round"
        strokeDasharray={isBranch ? "8,4" : "none"}
      />

      {/* Active glow effect */}
      {isActive && (
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeOpacity={0.2}
          strokeLinecap="round"
          strokeDasharray={isBranch ? "8,4" : "none"}
          filter="url(#glow)"
        />
      )}

      {/* Animated particle effect for current path */}
      {animated && (
        <motion.circle
          r={4}
          fill={color}
          initial={{ offsetDistance: "0%" }}
          animate={{ offsetDistance: "100%" }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            offsetPath: `path('${pathD}')`,
          }}
        >
          <animate
            attributeName="opacity"
            values="1;0.5;1"
            dur="2s"
            repeatCount="indefinite"
          />
        </motion.circle>
      )}

      {/* Direction indicator (small arrow) */}
      {isActive && (
        <g transform={`translate(${midX}, ${midY})`}>
          <motion.polygon
            points="-4,-4 6,0 -4,4"
            fill={color}
            opacity={0.8}
            initial={{ rotate: 0 }}
            animate={{
              rotate: Math.atan2(dy, dx) * (180 / Math.PI),
            }}
            style={{ transformOrigin: "center center" }}
          />
        </g>
      )}
    </g>
  );
}
