/* eslint-disable security/detect-object-injection */
// Reason: Array index access in force simulation uses numeric loop indices, not user input.
"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  ExternalLink,
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
  isPrimary: boolean;
  /** Pinned nodes skip force simulation */
  pinned: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
  color: string;
}

interface FraudNetworkGraphProps {
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
  onNavigateToUser?: (userId: string) => void;
}

// ─── Constants ──────────────────────────────────────────────
const EDGE_COLORS = new Map<string, string>([
  ["same_device", "#f59e0b"],
  ["same_ip", "#ef4444"],
  ["same_ip_browser", "#ef4444"],
  ["mirror_trading", "#ec4899"],
  ["same_payment", "#8b5cf6"],
  ["coordinated_entry", "#10b981"],
  ["trading_similarity", "#6366f1"],
  ["rapid_creation", "#f97316"],
  ["suspicious_behavior", "#64748b"],
  ["device_fingerprint", "#f59e0b"],
  ["payment_fingerprint", "#8b5cf6"],
  ["duplicate_document", "#a855f7"],
]);

const EDGE_LABELS = new Map<string, string>([
  ["same_device", "Same Device"],
  ["same_ip", "Same IP"],
  ["same_ip_browser", "Same IP+Browser"],
  ["mirror_trading", "Mirror Trades"],
  ["same_payment", "Same Payment"],
  ["coordinated_entry", "Coordinated Entry"],
  ["trading_similarity", "Similar Trading"],
  ["rapid_creation", "Rapid Creation"],
  ["suspicious_behavior", "Suspicious"],
  ["device_fingerprint", "Device FP"],
  ["payment_fingerprint", "Payment FP"],
  ["duplicate_document", "Dup. Document"],
]);

// Reason: Canvas dimensions tuned for 2–8 nodes with readable labels
const W = 600;
const H = 420;
const NODE_RADIUS_PRIMARY = 30;
const NODE_RADIUS = 24;
const SIM_ITERATIONS = 120;

/**
 * Interactive SVG network graph for fraud relationships.
 *
 * Reason: Previous version had a critical bug where the force simulation
 * restarted on every drag (dragNode was in useEffect deps), causing nodes
 * to fly around. This rewrite runs simulation once to completion using a ref,
 * then freezes. Dragging only moves the target node without restarting sim.
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
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [simDone, setSimDone] = useState(false);

  // Drag state in refs to avoid re-renders mid-drag
  const dragNodeRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ dx: 0, dy: 0 });

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
      const color = EDGE_COLORS.get(evidence.type) || "#64748b";
      const label = EDGE_LABELS.get(evidence.type) || evidence.type;

      for (let i = 0; i < connIds.length; i++) {
        for (let j = i + 1; j < connIds.length; j++) {
          const key = [connIds[i], connIds[j]].sort().join("-");
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            result.push({ source: connIds[i], target: connIds[j], label, color });
          }
        }
      }
    }

    if (result.length === 0) {
      for (const userId of alert.suspiciousUserIds) {
        if (userId !== alert.primaryUserId) {
          result.push({
            source: alert.primaryUserId,
            target: userId,
            label: EDGE_LABELS.get(alert.alertType) || "Linked",
            color: EDGE_COLORS.get(alert.alertType) || "#64748b",
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

  // ─── Run force simulation ONCE, write final positions ────────
  useEffect(() => {
    if (allUserIds.length < 2) return;

    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) * 0.3;

    // Reason: Start with circular layout, then relax with forces
    const simNodes: { id: string; x: number; y: number; vx: number; vy: number; isPrimary: boolean }[] =
      allUserIds.map((id, idx) => {
        const angle = (2 * Math.PI * idx) / allUserIds.length - Math.PI / 2;
        return {
          id,
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
          vx: 0,
          vy: 0,
          isPrimary: id === alert.primaryUserId,
        };
      });

    // Run simulation synchronously — no animation frames needed
    for (let iter = 0; iter < SIM_ITERATIONS; iter++) {
      const damping = 0.82 - iter * 0.002; // Progressive cooling

      // Repulsion (all pairs)
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const dx = simNodes[j].x - simNodes[i].x;
          const dy = simNodes[j].y - simNodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 5000 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          simNodes[i].vx -= fx;
          simNodes[i].vy -= fy;
          simNodes[j].vx += fx;
          simNodes[j].vy += fy;
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const src = simNodes.find((n) => n.id === edge.source);
        const tgt = simNodes.find((n) => n.id === edge.target);
        if (!src || !tgt) continue;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const idealDist = 140;
        const force = (dist - idealDist) * 0.025;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        src.vx += fx;
        src.vy += fy;
        tgt.vx -= fx;
        tgt.vy -= fy;
      }

      // Center gravity
      for (const n of simNodes) {
        n.vx += (cx - n.x) * 0.008;
        n.vy += (cy - n.y) * 0.008;
      }

      // Apply velocity
      const effectiveDamping = Math.max(0.3, damping);
      for (const n of simNodes) {
        n.vx *= effectiveDamping;
        n.vy *= effectiveDamping;
        n.x += n.vx;
        n.y += n.vy;
        // Clamp with padding for labels
        n.x = Math.max(50, Math.min(W - 50, n.x));
        n.y = Math.max(45, Math.min(H - 45, n.y));
      }
    }

    // Write final positions to state
    setNodes(
      simNodes.map((n) => ({
        id: n.id,
        label: usersMap.get(n.id)?.name || n.id.slice(0, 8),
        email: usersMap.get(n.id)?.email || "",
        x: Math.round(n.x * 10) / 10,
        y: Math.round(n.y * 10) / 10,
        isPrimary: n.isPrimary,
        pinned: false,
      })),
    );
    setSimDone(true);
  }, [allUserIds, usersMap, alert.primaryUserId, edges]);

  // ─── SVG coordinate helpers ──────────────────────────────────
  const svgPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / rect.width) * W,
        y: ((clientY - rect.top) / rect.height) * H,
      };
    },
    [],
  );

  // ─── Drag handlers (use refs, no re-render per pixel) ────────
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const pt = svgPoint(e.clientX, e.clientY);
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      dragNodeRef.current = nodeId;
      dragOffsetRef.current = { dx: node.x - pt.x, dy: node.y - pt.y };

      const onMove = (ev: MouseEvent) => {
        if (!dragNodeRef.current) return;
        const mp = svgPoint(ev.clientX, ev.clientY);
        const nx = Math.max(50, Math.min(W - 50, mp.x + dragOffsetRef.current.dx));
        const ny = Math.max(45, Math.min(H - 45, mp.y + dragOffsetRef.current.dy));
        setNodes((prev) =>
          prev.map((n) =>
            n.id === dragNodeRef.current ? { ...n, x: nx, y: ny, pinned: true } : n,
          ),
        );
      };

      const onUp = () => {
        dragNodeRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      // Reason: Attach to window so dragging works even outside SVG bounds
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [nodes, svgPoint],
  );

  const resetLayout = useCallback(() => {
    setSimDone(false);
    setNodes([]);
    // Trigger re-run by clearing then re-setting
    setTimeout(() => setSimDone(false), 0);
  }, []);

  const getNodeById = useCallback((id: string) => nodes.find((n) => n.id === id), [nodes]);

  // ─── Edge label deduplication ────────────────────────────────
  // Reason: When multiple edges have the same label, show it once at the midpoint
  const uniqueEdgeLabels = useMemo(() => {
    const seen = new Set<string>();
    return edges.filter((e) => {
      if (seen.has(e.label)) return false;
      seen.add(e.label);
      return true;
    });
  }, [edges]);

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
            className="h-6 px-2 text-[10px] text-gray-400 hover:text-white gap-1"
            onClick={resetLayout}
            title="Reset layout"
          >
            <Maximize2 className="h-3 w-3" />
            Reset
          </Button>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width="100%"
        height="420"
        viewBox={`0 0 ${W} ${H}`}
        className="select-none bg-gray-950/50"
        style={{ cursor: "default" }}
      >
        {/* Grid dots for visual reference */}
        <defs>
          <pattern id="dotGrid" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="15" cy="15" r="0.5" fill="#374151" fillOpacity="0.5" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#dotGrid)" />

        {simDone && (
          <>
            {/* Edges */}
            {edges.map((edge, idx) => {
              const src = getNodeById(edge.source);
              const tgt = getNodeById(edge.target);
              if (!src || !tgt) return null;

              return (
                <line
                  key={`edge-${idx}`}
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke={edge.color}
                  strokeWidth={2}
                  strokeOpacity={0.5}
                  strokeDasharray={edge.label === "Mirror Trades" ? "6,3" : undefined}
                />
              );
            })}

            {/* Edge labels — one per unique type, positioned on the first edge of that type */}
            {uniqueEdgeLabels.map((edge) => {
              const src = getNodeById(edge.source);
              const tgt = getNodeById(edge.target);
              if (!src || !tgt) return null;

              const mx = (src.x + tgt.x) / 2;
              const my = (src.y + tgt.y) / 2;
              // Reason: Offset label slightly to avoid node overlap
              const dx = tgt.x - src.x;
              const dy = tgt.y - src.y;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const perpX = (-dy / len) * 12;
              const perpY = (dx / len) * 12;

              return (
                <g key={`elabel-${edge.label}`}>
                  <rect
                    x={mx + perpX - 38}
                    y={my + perpY - 8}
                    width={76}
                    height={16}
                    rx={4}
                    fill="#111827"
                    fillOpacity={0.9}
                    stroke={edge.color}
                    strokeWidth={0.6}
                  />
                  <text
                    x={mx + perpX}
                    y={my + perpY + 4}
                    textAnchor="middle"
                    fontSize="8"
                    fill={edge.color}
                    fontWeight={600}
                    fontFamily="system-ui, sans-serif"
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
              const r = node.isPrimary ? NODE_RADIUS_PRIMARY : NODE_RADIUS;
              const resolved = usersMap.get(node.id);
              const displayName = resolved?.name || node.id.slice(0, 10) + "…";

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x},${node.y})`}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(selectedNode === node.id ? null : node.id);
                  }}
                  style={{ cursor: "grab" }}
                >
                  {/* Hover/select glow */}
                  {(isHovered || isSelected) && (
                    <circle
                      r={r + 5}
                      fill="none"
                      stroke={node.isPrimary ? "#ef4444" : "#3b82f6"}
                      strokeWidth={2}
                      strokeOpacity={0.3}
                    />
                  )}

                  {/* Node circle */}
                  <circle
                    r={r}
                    fill={node.isPrimary ? "#7f1d1d" : "#1e3a5f"}
                    stroke={
                      node.isPrimary
                        ? "#ef4444"
                        : isHovered || isSelected
                          ? "#60a5fa"
                          : "#4b5563"
                    }
                    strokeWidth={isHovered || isSelected ? 2.5 : 1.5}
                  />

                  {/* Icon */}
                  <text
                    y={1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="16"
                    fill="white"
                  >
                    {node.isPrimary ? "🚨" : "👤"}
                  </text>

                  {/* Pinned indicator */}
                  {node.pinned && (
                    <circle
                      cx={r - 4}
                      cy={-r + 4}
                      r={4}
                      fill="#1f2937"
                      stroke="#6b7280"
                      strokeWidth={0.5}
                    />
                  )}

                  {/* Name label with background for readability */}
                  <rect
                    x={-40}
                    y={r + 4}
                    width={80}
                    height={14}
                    rx={3}
                    fill="#111827"
                    fillOpacity={0.85}
                  />
                  <text
                    y={r + 14}
                    textAnchor="middle"
                    fontSize="10"
                    fill={isHovered || isSelected ? "#e5e7eb" : "#9ca3af"}
                    fontWeight={isHovered || isSelected ? 600 : 400}
                    fontFamily="system-ui, sans-serif"
                  >
                    {displayName.length > 14 ? displayName.slice(0, 13) + "…" : displayName}
                  </text>

                  {/* PRIMARY badge */}
                  {node.isPrimary && (
                    <>
                      <rect
                        x={-22}
                        y={-r - 16}
                        width={44}
                        height={14}
                        rx={7}
                        fill="#ef4444"
                      />
                      <text
                        y={-r - 7}
                        textAnchor="middle"
                        fontSize="8"
                        fill="white"
                        fontWeight={700}
                        fontFamily="system-ui, sans-serif"
                      >
                        PRIMARY
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </>
        )}

        {/* Loading state */}
        {!simDone && (
          <text
            x={W / 2}
            y={H / 2}
            textAnchor="middle"
            fontSize="12"
            fill="#6b7280"
            fontFamily="system-ui, sans-serif"
          >
            Computing layout…
          </text>
        )}
      </svg>

      {/* Selected Node Detail */}
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
                {selectedNode.slice(0, 12)}…
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
                    const tab = document.querySelector('[data-value="users"]') as HTMLElement;
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
