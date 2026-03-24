"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ExternalLink,
  Clock,
  Shield,
  Users,
  MonitorSmartphone,
  CreditCard,
  Activity,
  TrendingUp,
  BarChart3,
  Globe,
  Zap,
  Layers,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import DetectionMethodsList from "./DetectionMethodsList";
import EvidenceGroupedPanel from "./EvidenceGroupedPanel";
import FraudNetworkGraph from "./FraudNetworkGraph";

// ─── Types ──────────────────────────────────────────────────
interface EvidenceItem {
  type: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

interface FraudAlert {
  _id: string;
  alertType: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "pending" | "investigating" | "resolved" | "dismissed";
  primaryUserId: string;
  suspiciousUserIds: string[];
  confidence: number;
  title: string;
  description: string;
  detectedAt: string;
  evidence: EvidenceItem[];
  resolution?: string;
  actionTaken?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  investigationClearedAt?: string;
  clearanceNote?: string;
  competitionId?: string;
  updatedAt?: string;
  detectionCount?: number;
  detectionHistory?: Array<{
    timestamp: string;
    triggeredBy: string;
    ipAddress?: string;
    details?: string;
  }>;
  previousAlertCount?: number;
}

interface FraudAlertDetailTabsProps {
  alert: FraudAlert;
  onCloseDialog: () => void;
}

// ─── Type label/icon lookup ─────────────────────────────────
// Reason: Maps evidence types to human-readable labels and icons
// for the tab headers.
const TYPE_META = new Map<
  string,
  { label: string; icon: React.ReactNode; color: string }
>([
  [
    "device_fingerprint",
    {
      label: "Device",
      icon: <MonitorSmartphone className="h-3.5 w-3.5" />,
      color: "text-amber-400",
    },
  ],
  [
    "same_device",
    {
      label: "Same Device",
      icon: <MonitorSmartphone className="h-3.5 w-3.5" />,
      color: "text-amber-400",
    },
  ],
  [
    "payment_fingerprint",
    {
      label: "Payment",
      icon: <CreditCard className="h-3.5 w-3.5" />,
      color: "text-purple-400",
    },
  ],
  [
    "same_payment",
    {
      label: "Same Payment",
      icon: <CreditCard className="h-3.5 w-3.5" />,
      color: "text-purple-400",
    },
  ],
  [
    "mirror_trading",
    {
      label: "Mirror Trading",
      icon: <Activity className="h-3.5 w-3.5" />,
      color: "text-pink-400",
    },
  ],
  [
    "coordinated_entry",
    {
      label: "Coordinated Entry",
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      color: "text-emerald-400",
    },
  ],
  [
    "trading_similarity",
    {
      label: "Trading Similarity",
      icon: <BarChart3 className="h-3.5 w-3.5" />,
      color: "text-indigo-400",
    },
  ],
  [
    "ip_browser_match",
    {
      label: "IP / Browser",
      icon: <Globe className="h-3.5 w-3.5" />,
      color: "text-orange-400",
    },
  ],
  [
    "ip_detection",
    {
      label: "IP Detection",
      icon: <Globe className="h-3.5 w-3.5" />,
      color: "text-orange-400",
    },
  ],
  [
    "same_ip",
    {
      label: "Same IP",
      icon: <Globe className="h-3.5 w-3.5" />,
      color: "text-orange-400",
    },
  ],
  [
    "same_ip_browser",
    {
      label: "Same IP+Browser",
      icon: <Globe className="h-3.5 w-3.5" />,
      color: "text-orange-400",
    },
  ],
  [
    "rapid_creation",
    {
      label: "Rapid Creation",
      icon: <Zap className="h-3.5 w-3.5" />,
      color: "text-yellow-400",
    },
  ],
  [
    "duplicate_document",
    {
      label: "Duplicate Doc",
      icon: <FileText className="h-3.5 w-3.5" />,
      color: "text-red-400",
    },
  ],
  [
    "timezone_language",
    {
      label: "Timezone/Lang",
      icon: <Globe className="h-3.5 w-3.5" />,
      color: "text-cyan-400",
    },
  ],
  [
    "device_switching",
    {
      label: "Device Switching",
      icon: <MonitorSmartphone className="h-3.5 w-3.5" />,
      color: "text-rose-400",
    },
  ],
  [
    "kyc_duplicate",
    {
      label: "KYC Duplicate",
      icon: <FileText className="h-3.5 w-3.5" />,
      color: "text-red-400",
    },
  ],
]);

function getTypeMeta(type: string) {
  return (
    TYPE_META.get(type) || {
      label: type.replace(/_/g, " "),
      icon: <Layers className="h-3.5 w-3.5" />,
      color: "text-gray-400",
    }
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function FraudAlertDetailTabs({
  alert,
  onCloseDialog,
}: FraudAlertDetailTabsProps) {
  // Group evidence by type
  const evidenceByType = useMemo(() => {
    const groups = new Map<string, EvidenceItem[]>();
    for (const ev of alert.evidence) {
      const existing = groups.get(ev.type);
      if (existing) {
        existing.push(ev);
      } else {
        groups.set(ev.type, [ev]);
      }
    }
    return groups;
  }, [alert.evidence]);

  // Sorted type keys for stable tab order
  const typeKeys = useMemo(() => Array.from(evidenceByType.keys()), [evidenceByType]);

  // Check if network graph is applicable
  const hasNetwork =
    alert.suspiciousUserIds.length > 1 ||
    alert.evidence.some(
      (e) =>
        e.data?.connectedAccountIds && e.data.connectedAccountIds.length > 1,
    );

  // Collect all unique connected account IDs
  const allConnectedIds = useMemo(() => {
    const set = new Set<string>();
    for (const uid of alert.suspiciousUserIds) set.add(uid);
    for (const ev of alert.evidence) {
      if (ev.data?.connectedAccountIds) {
        for (const id of ev.data.connectedAccountIds as string[]) set.add(id);
      }
    }
    return Array.from(set);
  }, [alert.suspiciousUserIds, alert.evidence]);

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-gray-800/50 p-1.5 rounded-lg border border-gray-700">
        {/* Overview tab */}
        <TabsTrigger
          value="overview"
          className="text-xs flex items-center gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
        >
          <Shield className="h-3.5 w-3.5" />
          Overview
        </TabsTrigger>

        {/* Per-type tabs */}
        {typeKeys.map((type) => {
          const meta = getTypeMeta(type);
          const items = evidenceByType.get(type);
          const count = items?.length || 0;
          return (
            <TabsTrigger
              key={type}
              value={type}
              className={`text-xs flex items-center gap-1.5 data-[state=active]:bg-gray-700 data-[state=active]:text-white capitalize`}
            >
              <span className={meta.color}>{meta.icon}</span>
              {meta.label}
              <Badge className="bg-gray-700/50 text-gray-300 text-[10px] px-1.5 py-0 h-4 min-w-4 justify-center">
                {count}
              </Badge>
            </TabsTrigger>
          );
        })}

        {/* Network tab */}
        {hasNetwork && (
          <TabsTrigger
            value="network"
            className="text-xs flex items-center gap-1.5 data-[state=active]:bg-gray-700 data-[state=active]:text-white"
          >
            <Users className="h-3.5 w-3.5 text-cyan-400" />
            Network
          </TabsTrigger>
        )}
      </TabsList>

      {/* ─── Overview Tab ─────────────────────────────────── */}
      <TabsContent value="overview" className="mt-4 space-y-5">
        {/* Alert Summary */}
        <div className="p-4 bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-lg border border-gray-700">
          <h4 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-400" />
            Investigation Summary
          </h4>
          <p className="text-sm text-gray-300 leading-relaxed mb-4">
            {alert.description}
          </p>

          {/* Key stats */}
          <div className="grid grid-cols-4 gap-3">
            <MiniStat
              label="Accounts Involved"
              value={allConnectedIds.length}
              icon="👥"
            />
            <MiniStat
              label="Evidence Items"
              value={alert.evidence.length}
              icon="🔍"
            />
            <MiniStat
              label="Fraud Types"
              value={typeKeys.length}
              icon="🏷️"
            />
            <MiniStat
              label="Times Detected"
              value={alert.detectionCount || 1}
              icon="🔄"
            />
          </div>
        </div>

        {/* Type Breakdown */}
        <div className="p-4 bg-gray-800/40 rounded-lg border border-gray-700">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">
            Evidence by Type
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {typeKeys.map((type) => {
              const meta = getTypeMeta(type);
              const items = evidenceByType.get(type);
              const count = items?.length || 0;
              return (
                <div
                  key={type}
                  className="flex items-center justify-between p-2.5 bg-gray-900/60 rounded border border-gray-700/50"
                >
                  <div className="flex items-center gap-2">
                    <span className={meta.color}>{meta.icon}</span>
                    <span className="text-xs text-gray-300">{meta.label}</span>
                  </div>
                  <Badge className="bg-gray-700/50 text-gray-200 text-[10px]">
                    {count} detection{count !== 1 ? "s" : ""}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Suspicious Accounts */}
        <div>
          <Label className="text-gray-400 text-sm">
            Suspicious Accounts ({alert.suspiciousUserIds.length})
          </Label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {alert.suspiciousUserIds.map((userId, idx) => (
              <div
                key={userId}
                className="p-3 bg-gray-800 rounded border border-gray-700 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-yellow-500 font-bold text-base flex-shrink-0">
                    #{idx + 1}
                  </span>
                  <span className="text-gray-100 font-mono text-xs break-all">
                    {userId}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(userId);
                    toast.success(
                      "User ID copied! Switch to Users tab to search.",
                    );
                    onCloseDialog();
                    const adminTab = document.querySelector(
                      '[data-value="users"]',
                    ) as HTMLElement;
                    if (adminTab) adminTab.click();
                  }}
                  className="bg-blue-600 hover:bg-blue-700 border-blue-500 text-white flex-shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  View
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Detection History */}
        {alert.detectionHistory && alert.detectionHistory.length > 0 && (
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Detection History ({alert.detectionHistory.length} entries)
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {alert.detectionHistory
                .slice()
                .reverse()
                .map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 text-xs p-2 bg-gray-900/50 rounded"
                  >
                    <span className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">
                      #{alert.detectionHistory!.length - idx}
                    </span>
                    <span className="text-gray-400">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    <span className="text-gray-300">
                      by{" "}
                      <span className="font-mono text-blue-400">
                        {entry.triggeredBy?.substring(0, 8)}…
                      </span>
                    </span>
                    {entry.ipAddress && (
                      <span className="text-gray-500">
                        IP: {entry.ipAddress}
                      </span>
                    )}
                    {entry.details && (
                      <span className="text-gray-500 italic">
                        {entry.details}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Detection Methods Summary (filterable list) */}
        <DetectionMethodsList evidence={alert.evidence} />
      </TabsContent>

      {/* ─── Per-Type Evidence Tabs ───────────────────────── */}
      {typeKeys.map((type) => {
        const items = evidenceByType.get(type) || [];
        const meta = getTypeMeta(type);
        return (
          <TabsContent key={type} value={type} className="mt-4">
            <div className="space-y-4">
              {/* Tab header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={meta.color}>{meta.icon}</span>
                  <h4 className="text-base font-semibold text-gray-200">
                    {meta.label}
                  </h4>
                  <Badge className="bg-gray-700/50 text-gray-300 text-xs">
                    {items.length} detection{items.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>

              {/* Grouped evidence panel */}
              <EvidenceGroupedPanel evidenceType={type} items={items} />
            </div>
          </TabsContent>
        );
      })}

      {/* ─── Network Tab ──────────────────────────────────── */}
      {hasNetwork && (
        <TabsContent value="network" className="mt-4">
          <FraudNetworkGraph
            alert={alert}
            onNavigateToUser={(_userId) => {
              onCloseDialog();
              const adminTab = document.querySelector(
                '[data-value="users"]',
              ) as HTMLElement;
              if (adminTab) adminTab.click();
            }}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}

// ─── Mini stat box ──────────────────────────────────────────
function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="p-3 bg-gray-900/60 rounded-lg border border-gray-700/50 text-center">
      <span className="text-xl">{icon}</span>
      <p className="text-2xl font-bold text-gray-200 mt-1">{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}
