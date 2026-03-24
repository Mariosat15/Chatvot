/* eslint-disable security/detect-object-injection */
// Reason: All array accesses in this visualization use numeric loop indices, not user input.
"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
  X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────
interface ResolvedUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  image?: string;
}

interface GraphNode {
  id: string;
  label: string;
  email: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isPrimary: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
  color: string;
}

interface FraudNetworkGraphProps {
  /** The fraud alert data to visualize */
  alert: {
    _id: string;
    alertType: string;
    primaryUserId: string;
    suspiciousUserIds: string[];
    evidence: Array<{
      type: string;
      description: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: any;
    }>;
  };
  /** Callback when a user node is clicked */
  onNavigateToUser?: (userId: string) => void;
}

// Reason: Edge colors based on fraud type for visual distinction
const EDGE_COLORS: Record<string, string> = {
  same_device: "#f59e0b",
  same_ip: "#ef4444",
  same_ip_browser: "#ef4444",
  mirror_trading: "#ec4899",
  same_payment: "#8b5cf6",
  coordinated_entry: "#10b981",
  trading_similarity: "#6366f1",
  rapid_creation: "#f97316",
  suspicious_behavior: "#64748b",
};

const EDGE_LABELS: Record<string, string> = {
  same_device: "Same Device",
  same_ip: "Same IP",
  same_ip_browser: "Same IP+Browser",
  mirror_trading: "Mirror Trades",
  same_payment: "Same Payment",
  coordinated_entry: "Coordinated Entry",
  trading_similarity: "Similar Trading",
  rapid_creation: "Rapid Creation",
  suspicious_behavior: "Suspicious",
};

/**
 * Interactive SVG network graph for visualizing fraud relationships.
 * Shows user nodes connected by fraud evidence edges.
 */
export default function FraudNetworkGraph({
  alert,
  onNavigateToUser,
}: FraudNetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [usersMap, setUsersMap] = useState(new Map<string, ResolvedUser>());
  const [loading, setLoading] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [nodes, setNodes] = useState<GraphNode[]>([]);

  // Collect all unique user IDs
  const allUserIds = useMemo(() => {
    const ids = new Set<string>();
    ids.add(alert.primaryUserId);
    alert.suspiciousUserIds.forEach((id) => ids.add(id));
    alert.evidence.forEach((e) => {
      if (e.data?.connectedAccountIds) {
        (e.data.connectedAccountIds as string[]).forEach((id) => ids.add(id));
      }
    });
    return Array.from(ids);
  }, [alert]);

  // Build edges from evidence
  const edges = useMemo<GraphEdge[]>(() => {
    const result: GraphEdge[] = [];
    const edgeSet = new Set<string>();

    for (const evidence of alert.evidence) {
      const connIds: string[] = evidence.data?.connectedAccountIds || [];
      const color = EDGE_COLORS[evidence.type] || "#64748b";
      const label = EDGE_LABELS[evidence.type] || evidence.type;

      // Connect all pairs within connectedAccountIds
      for (let i = 0; i < connIds.length; i++) {
        for (let j = i + 1; j < connIds.length; j++) {
          const key = [connIds[i], connIds[j]].sort().join("-");
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            result.push({
              source: connIds[i],
              target: connIds[j],
              label,
              color,
            });
          }
        }
      }
    }

    // If no edges from evidence, connect all suspicious to primary
    if (result.length === 0) {
      for (const userId of alert.suspiciousUserIds) {
        if (userId !== alert.primaryUserId) {
          result.push({
            source: alert.primaryUserId,
            target: userId,
            label: EDGE_LABELS[alert.alertType] || "Linked",
            color: EDGE_COLORS[alert.alertType] || "#64748b",
          });
        }
      }
    }

    return result;
  }, [alert]);

  // Resolve user details
  const resolveUsers = useCallback(async () => {
    if (allUserIds.length === 0) return;

    setLoading(true);
    try {
      const response = await fetch("/api/fraud/resolve-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: allUserIds }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.users) {
          setUsersMap(new Map(Object.entries(data.users as Record<string, ResolvedUser>)));
        }
      }
    } catch (error) {
      console.error("Error resolving users for graph:", error);
    } finally {
      setLoading(false);
    }
  }, [allUserIds]);

  useEffect(() => {
    resolveUsers();
  }, [resolveUsers]);

  // Initialize nodes with circular layout
  useEffect(() => {
    const W = 500;
    const H = 350;
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) * 0.32;

    const initialNodes = allUserIds.map((id, idx) => {
      const angle = (2 * Math.PI * idx) / allUserIds.length - Math.PI / 2;
      return {
        id,
        label: usersMap.get(id)?.name || id.slice(0, 8),
        email: usersMap.get(id)?.email || "",
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
        isPrimary: id === alert.primaryUserId,
      };
    });

    setNodes(initialNodes);
  }, [allUserIds, usersMap, alert.primaryUserId]);

  // Simple force simulation
  useEffect(() => {
    if (nodes.length <= 1) return;

    let animFrame: number;
    let iteration = 0;
    const maxIterations = 80;

    const simulate = () => {
      if (iteration >= maxIterations) return;

      setNodes((prev) => {
        const updated = prev.map((n) => ({ ...n }));
        const W = 500;
        const H = 350;
        const cx = W / 2;
        const cy = H / 2;

        // Repulsion between all node pairs
        for (let i = 0; i < updated.length; i++) {
          for (let j = i + 1; j < updated.length; j++) {
            const dx = updated[j].x - updated[i].x;
            const dy = updated[j].y - updated[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 3000 / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            updated[i].vx -= fx;
            updated[i].vy -= fy;
            updated[j].vx += fx;
            updated[j].vy += fy;
          }
        }

        // Attraction along edges
        for (const edge of edges) {
          const src = updated.find((n) => n.id === edge.source);
          const tgt = updated.find((n) => n.id === edge.target);
          if (!src || !tgt) continue;
          const dx = tgt.x - src.x;
          const dy = tgt.y - src.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const idealDist = 120;
          const force = (dist - idealDist) * 0.03;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          src.vx += fx;
          src.vy += fy;
          tgt.vx -= fx;
          tgt.vy -= fy;
        }

        // Center gravity
        for (const n of updated) {
          n.vx += (cx - n.x) * 0.005;
          n.vy += (cy - n.y) * 0.005;
        }

        // Apply velocity with damping
        const damping = 0.85;
        for (const n of updated) {
          if (dragNode === n.id) continue; // Skip dragged node
          n.vx *= damping;
          n.vy *= damping;
          n.x += n.vx;
          n.y += n.vy;
          // Clamp to bounds
          n.x = Math.max(40, Math.min(W - 40, n.x));
          n.y = Math.max(40, Math.min(H - 40, n.y));
        }

        return updated;
      });

      iteration++;
      animFrame = requestAnimationFrame(simulate);
    };

    animFrame = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(animFrame);
  }, [nodes.length, edges, dragNode]);

  // Mouse handlers for dragging nodes
  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDragNode(nodeId);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragNode || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const svgX = (e.clientX - rect.left - pan.x) / zoom;
      const svgY = (e.clientY - rect.top - pan.y) / zoom;

      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragNode
            ? { ...n, x: svgX, y: svgY, vx: 0, vy: 0 }
            : n,
        ),
      );
    },
    [dragNode, zoom, pan],
  );

  const handleMouseUp = useCallback(() => {
    setDragNode(null);
    setIsDragging(false);
  }, []);

  // Pan handling
  const handleBgMouseDown = (e: React.MouseEvent) => {
    if (dragNode) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleBgMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || dragNode) return;
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragNode, dragStart],
  );

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const getNodeById = (id: string) => nodes.find((n) => n.id === id);

  if (allUserIds.length < 2) return null;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800/50 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-semibold text-gray-200">
            Fraud Network ({allUserIds.length} accounts)
          </span>
          {loading && <Loader2 className="h-3 w-3 text-cyan-400 animate-spin" />}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
            onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
            onClick={resetView}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width="100%"
        height="350"
        viewBox="0 0 500 350"
        className="select-none"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={handleBgMouseDown}
        onMouseMove={(e) => {
          handleMouseMove(e);
          handleBgMouseMove(e);
        }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map((edge, idx) => {
            const src = getNodeById(edge.source);
            const tgt = getNodeById(edge.target);
            if (!src || !tgt) return null;

            const mx = (src.x + tgt.x) / 2;
            const my = (src.y + tgt.y) / 2;

            return (
              <g key={`edge-${idx}`}>
                <line
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke={edge.color}
                  strokeWidth={2}
                  strokeOpacity={0.6}
                  strokeDasharray={
                    edge.label === "Mirror Trades" ? "6,3" : undefined
                  }
                />
                {/* Edge label */}
                <rect
                  x={mx - 35}
                  y={my - 8}
                  width={70}
                  height={16}
                  rx={4}
                  fill="#1f2937"
                  fillOpacity={0.9}
                  stroke={edge.color}
                  strokeWidth={0.5}
                />
                <text
                  x={mx}
                  y={my + 3}
                  textAnchor="middle"
                  className="text-[8px]"
                  fill={edge.color}
                  fontWeight={600}
                >
                  {edge.label}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isHovered = hoveredNode === node.id;
            const isSelected = selectedNode === node.id;
            const r = node.isPrimary ? 28 : 22;
            const resolved = usersMap.get(node.id);
            const displayName = resolved?.name || node.id.slice(0, 8) + "...";

            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNode(selectedNode === node.id ? null : node.id);
                }}
                style={{ cursor: "pointer" }}
              >
                {/* Glow ring */}
                {(isHovered || isSelected) && (
                  <circle
                    r={r + 6}
                    fill="none"
                    stroke={node.isPrimary ? "#ef4444" : "#3b82f6"}
                    strokeWidth={2}
                    strokeOpacity={0.4}
                  />
                )}

                {/* Main circle */}
                <circle
                  r={r}
                  fill={node.isPrimary ? "#7f1d1d" : "#1e3a5f"}
                  stroke={
                    node.isPrimary
                      ? "#ef4444"
                      : isHovered || isSelected
                        ? "#3b82f6"
                        : "#4b5563"
                  }
                  strokeWidth={isHovered || isSelected ? 2.5 : 1.5}
                />

                {/* Icon */}
                <text
                  y={-2}
                  textAnchor="middle"
                  className="text-[14px]"
                  fill="white"
                >
                  {node.isPrimary ? "🚨" : "👤"}
                </text>

                {/* Name label */}
                <text
                  y={r + 14}
                  textAnchor="middle"
                  className="text-[9px]"
                  fill={isHovered || isSelected ? "#e5e7eb" : "#9ca3af"}
                  fontWeight={isHovered || isSelected ? 700 : 400}
                >
                  {displayName}
                </text>

                {/* Primary badge */}
                {node.isPrimary && (
                  <>
                    <rect
                      x={-18}
                      y={-r - 14}
                      width={36}
                      height={12}
                      rx={6}
                      fill="#ef4444"
                    />
                    <text
                      y={-r - 6}
                      textAnchor="middle"
                      className="text-[7px]"
                      fill="white"
                      fontWeight={700}
                    >
                      PRIMARY
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Selected Node Detail Panel */}
      {selectedNode && (
        <div className="px-3 py-2 bg-gray-800/70 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-gray-300">
                {usersMap.get(selectedNode)?.name || "Unknown User"}
              </span>
              {usersMap.get(selectedNode)?.email && (
                <span className="text-xs text-gray-500 truncate">
                  {usersMap.get(selectedNode)?.email}
                </span>
              )}
              <code className="text-[10px] text-gray-600 font-mono">
                {selectedNode.slice(0, 12)}...
              </code>
              {selectedNode === alert.primaryUserId && (
                <Badge className="bg-red-500/20 text-red-400 text-[9px] px-1 py-0">
                  Primary
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-blue-400 hover:text-blue-300"
                onClick={() => {
                  if (onNavigateToUser) {
                    onNavigateToUser(selectedNode);
                  } else {
                    const tab = document.querySelector(
                      '[data-value="users"]',
                    ) as HTMLElement;
                    if (tab) tab.click();
                  }
                }}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View Profile
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-gray-500 hover:text-white"
                onClick={() => setSelectedNode(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="px-3 py-1.5 bg-gray-900/80 border-t border-gray-700/50 flex items-center gap-3 flex-wrap">
        {Array.from(new Set(edges.map((e) => e.label))).map((label) => {
          const edge = edges.find((e) => e.label === label);
          return (
            <div key={label} className="flex items-center gap-1">
              <div
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: edge?.color || "#64748b" }}
              />
              <span className="text-[9px] text-gray-500">{label}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1 ml-auto">
          <div className="w-2 h-2 rounded-full bg-red-900 border border-red-500" />
          <span className="text-[9px] text-gray-500">Primary</span>
          <div className="w-2 h-2 rounded-full bg-blue-900 border border-gray-500 ml-2" />
          <span className="text-[9px] text-gray-500">Connected</span>
        </div>
      </div>
    </div>
  );
}
