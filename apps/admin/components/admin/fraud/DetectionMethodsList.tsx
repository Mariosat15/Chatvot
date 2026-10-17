"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Search,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────
interface EvidenceItem {
  type: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

interface DetectionMethodsListProps {
  evidence: EvidenceItem[];
}

// Reason: Human-readable labels for evidence types
const TYPE_LABELS = new Map<string, string>([
  ["duplicate_document", "Duplicate Document"],
  ["device_fingerprint", "Device Fingerprint"],
  ["payment_fingerprint", "Payment Fingerprint"],
  ["coordinated_entry", "Coordinated Entry"],
  ["mirror_trading", "Mirror Trading"],
  ["trading_similarity", "Trading Similarity"],
  ["same_device", "Same Device"],
  ["same_ip", "Same IP"],
  ["same_ip_browser", "Same IP + Browser"],
  ["same_payment", "Same Payment"],
  ["rapid_creation", "Rapid Creation"],
  ["suspicious_behavior", "Suspicious Behavior"],
  ["same_city", "Same City"],
  ["timezone_language", "Timezone/Language"],
  ["device_switching", "Device Switching"],
  ["kyc_duplicate", "KYC Duplicate"],
]);

// Reason: Distinct colors per type so badges are visually scannable
const TYPE_COLORS = new Map<string, string>([
  ["duplicate_document", "bg-purple-500/20 text-purple-400 border-purple-500/30"],
  ["device_fingerprint", "bg-amber-500/20 text-amber-400 border-amber-500/30"],
  ["payment_fingerprint", "bg-violet-500/20 text-violet-400 border-violet-500/30"],
  ["coordinated_entry", "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"],
  ["mirror_trading", "bg-pink-500/20 text-pink-400 border-pink-500/30"],
  ["trading_similarity", "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"],
  ["same_device", "bg-amber-500/20 text-amber-400 border-amber-500/30"],
  ["same_ip", "bg-red-500/20 text-red-400 border-red-500/30"],
  ["same_ip_browser", "bg-red-500/20 text-red-400 border-red-500/30"],
  ["same_payment", "bg-violet-500/20 text-violet-400 border-violet-500/30"],
  ["rapid_creation", "bg-orange-500/20 text-orange-400 border-orange-500/30"],
  ["suspicious_behavior", "bg-gray-500/20 text-gray-400 border-gray-500/30"],
]);

function getTypeLabel(type: string): string {
  return TYPE_LABELS.get(type) || type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function getTypeColor(type: string): string {
  return TYPE_COLORS.get(type) || "bg-gray-500/20 text-gray-400 border-gray-500/30";
}

/**
 * Filterable, sortable list view for fraud detection evidence.
 * Replaces the old horizontal timeline that was hard to navigate.
 *
 * Reason: The previous horizontal scroll was unusable with many detections.
 * This component shows a vertical list with type filters, search, and sorting.
 */
export default function DetectionMethodsList({ evidence }: DetectionMethodsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Group evidence by type for filter badges
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of evidence) {
      counts.set(e.type, (counts.get(e.type) || 0) + 1);
    }
    return counts;
  }, [evidence]);

  // Filter & sort
  const filteredEvidence = useMemo(() => {
    let items = evidence.map((e, idx) => ({ ...e, _origIdx: idx }));

    // Type filter
    if (activeTypeFilter) {
      items = items.filter((e) => e.type === activeTypeFilter);
    }

    // Search filter (description + type)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          getTypeLabel(e.type).toLowerCase().includes(q) ||
          (e.data?.detectedAt && new Date(e.data.detectedAt).toLocaleString().toLowerCase().includes(q)),
      );
    }

    // Sort by detection time
    items.sort((a, b) => {
      const tA = a.data?.detectedAt ? new Date(a.data.detectedAt).getTime() : 0;
      const tB = b.data?.detectedAt ? new Date(b.data.detectedAt).getTime() : 0;
      return sortAsc ? tA - tB : tB - tA;
    });

    return items;
  }, [evidence, activeTypeFilter, searchQuery, sortAsc]);

  if (evidence.length === 0) return null;

  return (
    <div className="p-4 bg-gradient-to-r from-red-900/20 to-orange-900/20 rounded-lg border border-red-500/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-base font-semibold text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Detection Methods
        </h4>
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
          {evidence.length} detection{evidence.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Type filter badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          onClick={() => setActiveTypeFilter(null)}
          className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors border ${
            !activeTypeFilter
              ? "bg-white/10 text-white border-white/20"
              : "bg-gray-800/50 text-gray-500 border-gray-700 hover:text-gray-300"
          }`}
        >
          All ({evidence.length})
        </button>
        {Array.from(typeCounts.entries()).map(([type, count]) => (
          <button
            key={type}
            onClick={() => setActiveTypeFilter(activeTypeFilter === type ? null : type)}
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors border ${
              activeTypeFilter === type
                ? getTypeColor(type)
                : "bg-gray-800/50 text-gray-500 border-gray-700 hover:text-gray-300"
            }`}
          >
            {getTypeLabel(type)} ({count})
          </button>
        ))}
      </div>

      {/* Search + Sort controls */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search detections..."
            className="pl-7 h-8 text-xs bg-gray-800/60 border-gray-700 text-gray-300 placeholder:text-gray-600"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSortAsc(!sortAsc)}
          className="h-8 px-2 text-xs text-gray-400 hover:text-white gap-1"
        >
          <Clock className="h-3 w-3" />
          {sortAsc ? "Oldest" : "Newest"}
          {sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Results count */}
      {(activeTypeFilter || searchQuery) && (
        <div className="flex items-center gap-2 mb-2">
          <Filter className="h-3 w-3 text-gray-500" />
          <span className="text-[11px] text-gray-500">
            Showing {filteredEvidence.length} of {evidence.length}
          </span>
          {activeTypeFilter && (
            <button
              onClick={() => setActiveTypeFilter(null)}
              className="text-[11px] text-blue-400 hover:text-blue-300 underline"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Detection list */}
      <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
        {filteredEvidence.length === 0 ? (
          <div className="py-6 text-center text-gray-500 text-sm">
            No detections match your filters
          </div>
        ) : (
          filteredEvidence.map((item, idx) => {
            const isExpanded = expandedIdx === item._origIdx;
            const detectedAt = item.data?.detectedAt
              ? new Date(item.data.detectedAt)
              : null;
            const connectedCount = item.data?.connectedAccountIds?.length || 0;

            return (
              <div
                key={`${item.type}-${item._origIdx}`}
                className={`rounded-lg border transition-colors cursor-pointer ${
                  isExpanded
                    ? "bg-gray-800/80 border-gray-600"
                    : "bg-gray-800/40 border-gray-700/50 hover:border-gray-600"
                }`}
                onClick={() => setExpandedIdx(isExpanded ? null : item._origIdx)}
              >
                {/* Row */}
                <div className="flex items-center gap-3 px-3 py-2">
                  {/* Index */}
                  <span className="text-[10px] text-gray-600 font-mono w-5 text-right flex-shrink-0">
                    {idx + 1}
                  </span>

                  {/* Type badge */}
                  <Badge className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${getTypeColor(item.type)}`}>
                    {getTypeLabel(item.type)}
                  </Badge>

                  {/* Description (truncated) */}
                  <span className="text-xs text-gray-300 truncate flex-1 min-w-0">
                    {item.description}
                  </span>

                  {/* Connected accounts count */}
                  {connectedCount > 0 && (
                    <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[10px] px-1.5 py-0 flex-shrink-0">
                      {connectedCount} accts
                    </Badge>
                  )}

                  {/* Time */}
                  {detectedAt && (
                    <span className="text-[10px] text-gray-500 flex-shrink-0 whitespace-nowrap">
                      {detectedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
                      {detectedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}

                  {/* Expand arrow */}
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-gray-500 flex-shrink-0" />
                  )}
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-gray-700/50 space-y-2">
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {item.description}
                    </p>

                    {/* Connected accounts */}
                    {item.data?.connectedAccountIds && item.data.connectedAccountIds.length > 0 && (
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                          Connected Accounts
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(item.data.connectedAccountIds as string[]).map((id: string) => (
                            <code
                              key={id}
                              className="text-[10px] bg-gray-900 px-1.5 py-0.5 rounded text-yellow-400 font-mono break-all"
                            >
                              {id}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Extra data fields */}
                    {item.data?.confidence !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">Confidence:</span>
                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full max-w-[120px]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-red-500"
                            style={{ width: `${Math.min(100, item.data.confidence)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400">{item.data.confidence}%</span>
                      </div>
                    )}

                    {item.data?.ipAddress && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">IP:</span>
                        <code className="text-[10px] text-gray-400 font-mono">{item.data.ipAddress}</code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
