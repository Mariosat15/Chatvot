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
  Copy,
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
  pinned: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  displayLabel: string;
  color: string;
  types: string[];
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
  ["same_payment", "Shared Payment"],
  ["coordinated_entry", "Coordinated Entry"],
  ["trading_similarity", "Similar Trading"],
  ["rapid_creation", "Rapid Creation"],
  ["suspicious_behavior", "Suspicious"],
  ["device_fingerprint", "Device FP"],
  ["payment_fingerprint", "Payment FP"],
  ["duplicate_document", "Dup. Document"],
]);

// Reason: Larger canvas gives nodes room for multi-line labels
const W = 750;
const H = 500;
const NODE_R_PRIMARY = 32;
const NODE_R = 26;
const SIM_ITERATIONS = 150;

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
  const [layoutKey, setLayoutKey] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const dragNodeRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ dx: 0, dy: 0 });

  // ─── Collect unique user IDs ────────────────────────────────
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

  // ─── Build edges — aggregate ALL evidence types per pair ────
  // Reason: Previous version deduplicated labels globally, hiding connections.
  // Now each pair of accounts gets ONE edge with a combined label of all
  // evidence types that link them, so nothing is hidden.
  const edges = useMemo<GraphEdge[]>(() => {
    const pairMap = new Map<string, Set<string>>();

    for (const ev of alert.evidence) {
      const connIds: string[] = ev.data?.connectedAccountIds || [];
      for (let i = 0; i < connIds.length; i++) {
        for (let j = i + 1; j < connIds.length; j++) {
          const key = [connIds[i], connIds[j]].sort().join("|");
          if (!pairMap.has(key)) pairMap.set(key, new Set());
          pairMap.get(key)!.add(ev.type);
        }
      }
    }

    const result: GraphEdge[] = [];
    for (const [key, types] of pairMap) {
      const [source, target] = key.split("|");
      const typeArr = Array.from(types);
      const labels = typeArr.map((t) => EDGE_LABELS.get(t) || t);
      result.push({
        source,
        target,
        displayLabel: labels.join(" + "),
        color: EDGE_COLORS.get(typeArr[0]) || "#64748b",
        types: typeArr,
      });
    }

    // Reason: Connect orphan nodes (in suspiciousUserIds but have no evidence
    // edges) to the primary user so they don't appear disconnected.
    const connectedIds = new Set<string>();
    for (const e of result) {
      connectedIds.add(e.source);
      connectedIds.add(e.target);
    }
    for (const userId of allUserIds) {
      if (!connectedIds.has(userId) && userId !== alert.primaryUserId) {
        const fallbackLabel = EDGE_LABELS.get(alert.alertType) || "Linked";
        result.push({
          source: alert.primaryUserId,
          target: userId,
          displayLabel: fallbackLabel,
          color: EDGE_COLORS.get(alert.alertType) || "#64748b",
          types: [alert.alertType],
        });
      }
    }

    return result;
  }, [alert, allUserIds]);

  // ─── Resolve user details ───────────────────────────────────
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
          setUsersMap(
            new Map(
              Object.entries(data.users as Record<string, ResolvedUser>),
            ),
          );
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

  // ─── Force simulation (run once, stronger repulsion for spacing) ─
  useEffect(() => {
    if (allUserIds.length < 2) return;
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.min(W, H) * 0.3;

    const simNodes = allUserIds.map((id, idx) => {
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

    for (let iter = 0; iter < SIM_ITERATIONS; iter++) {
      const damping = 0.82 - iter * 0.002;
      // Repulsion (stronger for more label room)
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const dx = simNodes[j].x - simNodes[i].x;
          const dy = simNodes[j].y - simNodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 9000 / (dist * dist);
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
        const idealDist = 200;
        const force = (dist - idealDist) * 0.018;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        src.vx += fx;
        src.vy += fy;
        tgt.vx -= fx;
        tgt.vy -= fy;
      }
      // Center gravity
      for (const n of simNodes) {
        n.vx += (cx - n.x) * 0.005;
        n.vy += (cy - n.y) * 0.005;
      }
      // Apply velocity
      const d = Math.max(0.3, damping);
      for (const n of simNodes) {
        n.vx *= d;
        n.vy *= d;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(90, Math.min(W - 90, n.x));
        n.y = Math.max(70, Math.min(H - 70, n.y));
      }
    }

    setNodes(
      simNodes.map((n) => ({
        id: n.id,
        label: usersMap.get(n.id)?.name || n.id.slice(0, 10),
        email: usersMap.get(n.id)?.email || "",
        x: Math.round(n.x * 10) / 10,
        y: Math.round(n.y * 10) / 10,
        isPrimary: n.isPrimary,
        pinned: false,
      })),
    );
    setSimDone(true);
    // layoutKey triggers re-run on Reset
  }, [allUserIds, usersMap, alert.primaryUserId, edges, layoutKey]);

  // ─── Helpers ────────────────────────────────────────────────
  const svgPoint = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }, []);

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
        const nx = Math.max(90, Math.min(W - 90, mp.x + dragOffsetRef.current.dx));
        const ny = Math.max(70, Math.min(H - 70, mp.y + dragOffsetRef.current.dy));
        setNodes((prev) =>
          prev.map((n) =>
            n.id === dragNodeRef.current
              ? { ...n, x: nx, y: ny, pinned: true }
              : n,
          ),
        );
      };

      const onUp = () => {
        dragNodeRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [nodes, svgPoint],
  );

  const resetLayout = useCallback(() => {
    setSimDone(false);
    setNodes([]);
    setLayoutKey((k) => k + 1);
  }, []);

  const getNodeById = useCallback(
    (id: string) => nodes.find((n) => n.id === id),
    [nodes],
  );

  const getNodeConnections = useCallback(
    (nodeId: string) =>
      edges.filter((e) => e.source === nodeId || e.target === nodeId),
    [edges],
  );

  const copyId = useCallback((id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  if (allUserIds.length < 2) return null;

  return (
    <div className="space-y-4">
      {/* ─── Graph ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-700 bg-gray-900/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800/50 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-semibold text-gray-200">
              Fraud Network — {allUserIds.length} Accounts,{" "}
              {edges.length} Connection{edges.length !== 1 ? "s" : ""}
            </span>
            {loading && (
              <Loader2 className="h-3 w-3 text-cyan-400 animate-spin" />
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-gray-400 hover:text-white gap-1"
            onClick={resetLayout}
          >
            <Maximize2 className="h-3 w-3" />
            Reset
          </Button>
        </div>

        {/* SVG Canvas */}
        <svg
          ref={svgRef}
          width="100%"
          height="500"
          viewBox={`0 0 ${W} ${H}`}
          className="select-none bg-gray-950/50"
          style={{ cursor: "default" }}
        >
          <defs>
            <pattern
              id="dotGrid"
              width="30"
              height="30"
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx="15"
                cy="15"
                r="0.5"
                fill="#374151"
                fillOpacity="0.5"
              />
            </pattern>
            <filter
              id="glowRed"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation="3"
                result="blur"
              />
              <feColorMatrix
                in="blur"
                values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.4 0"
              />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect width={W} height={H} fill="url(#dotGrid)" />

          {simDone && (
            <>
              {/* ─── Edges ─────────────────────────────────── */}
              {edges.map((edge, idx) => {
                const src = getNodeById(edge.source);
                const tgt = getNodeById(edge.target);
                if (!src || !tgt) return null;

                const isHighlighted =
                  hoveredNode === edge.source || hoveredNode === edge.target;

                const mx = (src.x + tgt.x) / 2;
                const my = (src.y + tgt.y) / 2;
                const dx = tgt.x - src.x;
                const dy = tgt.y - src.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const perpX = (-dy / len) * 14;
                const perpY = (dx / len) * 14;

                // Reason: Size label pill dynamically so long combined labels fit
                const labelW = Math.max(
                  90,
                  edge.displayLabel.length * 5.5 + 20,
                );

                return (
                  <g key={`edge-${idx}`} opacity={isHighlighted ? 1 : 0.7}>
                    {/* Connection line */}
                    <line
                      x1={src.x}
                      y1={src.y}
                      x2={tgt.x}
                      y2={tgt.y}
                      stroke={edge.color}
                      strokeWidth={isHighlighted ? 3 : 2}
                      strokeOpacity={isHighlighted ? 0.9 : 0.45}
                      strokeDasharray={
                        edge.types.includes("mirror_trading")
                          ? "6,3"
                          : undefined
                      }
                    />
                    {/* Label pill on every edge */}
                    <rect
                      x={mx + perpX - labelW / 2}
                      y={my + perpY - 10}
                      width={labelW}
                      height={20}
                      rx={6}
                      fill="#111827"
                      fillOpacity={0.95}
                      stroke={edge.color}
                      strokeWidth={isHighlighted ? 1.2 : 0.7}
                    />
                    <text
                      x={mx + perpX}
                      y={my + perpY + 4}
                      textAnchor="middle"
                      fontSize="9"
                      fill={edge.color}
                      fontWeight={600}
                      fontFamily="system-ui, sans-serif"
                    >
                      {edge.displayLabel}
                    </text>
                  </g>
                );
              })}

              {/* ─── Nodes ─────────────────────────────────── */}
              {nodes.map((node) => {
                const isHovered = hoveredNode === node.id;
                const isSelected = selectedNode === node.id;
                const r = node.isPrimary ? NODE_R_PRIMARY : NODE_R;
                const resolved = usersMap.get(node.id);
                const name = resolved?.name || "Unknown";
                const email = resolved?.email || "";
                const shortId = node.id.slice(0, 10) + "…";
                const dispName =
                  name.length > 16 ? name.slice(0, 15) + "…" : name;
                const dispEmail =
                  email.length > 22 ? email.slice(0, 21) + "…" : email;

                // Reason: Label box height varies based on whether email exists
                const labelH = email ? 40 : 28;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(
                        selectedNode === node.id ? null : node.id,
                      );
                    }}
                    style={{ cursor: "grab" }}
                  >
                    {/* Hover/select glow ring */}
                    {(isHovered || isSelected) && (
                      <circle
                        r={r + 6}
                        fill="none"
                        stroke={node.isPrimary ? "#ef4444" : "#3b82f6"}
                        strokeWidth={2}
                        strokeOpacity={0.4}
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
                      filter={node.isPrimary ? "url(#glowRed)" : undefined}
                    />

                    {/* Icon */}
                    <text
                      y={1}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="18"
                    >
                      {node.isPrimary ? "🚨" : "👤"}
                    </text>

                    {/* PRIMARY badge */}
                    {node.isPrimary && (
                      <>
                        <rect
                          x={-24}
                          y={-r - 18}
                          width={48}
                          height={15}
                          rx={7}
                          fill="#ef4444"
                        />
                        <text
                          y={-r - 8}
                          textAnchor="middle"
                          fontSize="9"
                          fill="white"
                          fontWeight={700}
                          fontFamily="system-ui, sans-serif"
                        >
                          PRIMARY
                        </text>
                      </>
                    )}

                    {/* ── Multi-line label below node ────── */}
                    <rect
                      x={-62}
                      y={r + 3}
                      width={124}
                      height={labelH}
                      rx={5}
                      fill="#111827"
                      fillOpacity={0.92}
                      stroke={
                        isHovered || isSelected ? "#4b5563" : "#1f2937"
                      }
                      strokeWidth={0.5}
                    />
                    {/* Name (bold) */}
                    <text
                      y={r + 16}
                      textAnchor="middle"
                      fontSize="10.5"
                      fill={
                        isHovered || isSelected ? "#f3f4f6" : "#d1d5db"
                      }
                      fontWeight={600}
                      fontFamily="system-ui, sans-serif"
                    >
                      {dispName}
                    </text>
                    {/* Email */}
                    {email && (
                      <text
                        y={r + 28}
                        textAnchor="middle"
                        fontSize="8"
                        fill="#9ca3af"
                        fontFamily="system-ui, sans-serif"
                      >
                        {dispEmail}
                      </text>
                    )}
                    {/* Client ID */}
                    <text
                      y={r + (email ? 39 : 27)}
                      textAnchor="middle"
                      fontSize="7.5"
                      fill="#6b7280"
                      fontFamily="ui-monospace, monospace"
                    >
                      {shortId}
                    </text>
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

        {/* Legend */}
        <div className="px-4 py-2 bg-gray-900/80 border-t border-gray-700/50 flex items-center gap-4 flex-wrap">
          {Array.from(new Set(edges.map((e) => e.displayLabel))).map(
            (label) => {
              const edge = edges.find((e) => e.displayLabel === label);
              return (
                <div key={label} className="flex items-center gap-1.5">
                  <div
                    className="w-4 h-0.5 rounded"
                    style={{
                      backgroundColor: edge?.color || "#64748b",
                    }}
                  />
                  <span className="text-[10px] text-gray-400">{label}</span>
                </div>
              );
            },
          )}
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-2.5 h-2.5 rounded-full bg-red-900 border border-red-500" />
            <span className="text-[10px] text-gray-400">Primary</span>
            <div className="w-2.5 h-2.5 rounded-full bg-blue-900 border border-gray-500 ml-2" />
            <span className="text-[10px] text-gray-400">Connected</span>
          </div>
        </div>
      </div>

      {/* ─── Account Details & Connections Panel ───────────── */}
      <div className="rounded-lg border border-gray-700 bg-gray-900/50 overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-800/50 border-b border-gray-700">
          <span className="text-sm font-semibold text-gray-200">
            📋 Account Details & Connections
          </span>
        </div>
        <div className="divide-y divide-gray-800">
          {allUserIds.map((userId) => {
            const resolved = usersMap.get(userId);
            const isPrimary = userId === alert.primaryUserId;
            const conns = getNodeConnections(userId);

            return (
              <div
                key={userId}
                className={`px-4 py-3 ${isPrimary ? "bg-red-950/20" : "hover:bg-gray-800/30"} transition-colors`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left — account info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-200">
                        {resolved?.name || "Unknown User"}
                      </span>
                      {isPrimary && (
                        <Badge className="bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0">
                          Primary
                        </Badge>
                      )}
                    </div>
                    {resolved?.email && (
                      <p className="text-xs text-gray-400 mb-0.5">
                        ✉️ {resolved.email}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <code className="text-[11px] text-gray-500 font-mono break-all">
                        ID: {userId}
                      </code>
                      <button
                        onClick={() => copyId(userId)}
                        className="text-gray-600 hover:text-gray-300 transition-colors shrink-0"
                        title="Copy full ID"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      {copiedId === userId && (
                        <span className="text-[10px] text-green-400">
                          Copied!
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right — connections */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {conns.length > 0 ? (
                      conns.map((conn, idx) => {
                        const otherId =
                          conn.source === userId ? conn.target : conn.source;
                        const otherName =
                          usersMap.get(otherId)?.name ||
                          otherId.slice(0, 8) + "…";
                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 text-[11px]"
                          >
                            <Badge
                              className="text-[9px] px-1.5 py-0 border"
                              style={{
                                borderColor: conn.color + "60",
                                color: conn.color,
                                background: conn.color + "15",
                              }}
                            >
                              {conn.displayLabel}
                            </Badge>
                            <span className="text-gray-500">→</span>
                            <span className="text-gray-300 font-medium">
                              {otherName}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-gray-600 italic">
                        No direct connections
                      </span>
                    )}
                  </div>
                </div>

                {/* Navigate button */}
                {onNavigateToUser && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 mt-2 text-[10px] text-blue-400 hover:text-blue-300"
                    onClick={() => onNavigateToUser(userId)}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View Profile
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
