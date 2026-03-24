"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Monitor,
  Info,
  TrendingUp,
  Activity,
  AlertOctagon,
  Clock,
} from "lucide-react";
import ConnectedAccountsPanel from "./ConnectedAccountsPanel";

// ─── Types ──────────────────────────────────────────────────
interface EvidenceItem {
  type: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

interface EvidenceGroupedPanelProps {
  evidenceType: string;
  items: EvidenceItem[];
}

// ─── Helpers ────────────────────────────────────────────────
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleString();
}

// ─── Device Fingerprint Panel ───────────────────────────────
// Reason: Groups by unique fingerprint ID so the device is shown once,
// with all detection dates/activities listed underneath.
function DeviceFingerprintGrouped({ items }: { items: EvidenceItem[] }) {
  const grouped = useMemo(() => {
    const groups = new Map<string, { device: EvidenceItem; dates: string[] }>();

    for (const item of items) {
      if (!item.data?.accountsDetails) {
        // Simple device evidence — group by description
        const key = item.description || "unknown";
        const existing = groups.get(key);
        if (existing) {
          if (item.data?.detectedAt) existing.dates.push(item.data.detectedAt);
        } else {
          groups.set(key, {
            device: item,
            dates: item.data?.detectedAt ? [item.data.detectedAt] : [],
          });
        }
        continue;
      }

      // Has accountsDetails — group by first fingerprint ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const acct of item.data.accountsDetails as any[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const dev of (acct.devicesUsed || []) as any[]) {
          const fpId = dev.fingerprintId || dev.userAgent || "unknown";
          const existing = groups.get(fpId);
          if (existing) {
            if (item.data?.detectedAt) existing.dates.push(item.data.detectedAt);
          } else {
            groups.set(fpId, {
              device: { ...item, data: { ...item.data, _singleDevice: dev, _account: acct } },
              dates: item.data?.detectedAt ? [item.data.detectedAt] : [],
            });
          }
        }
      }
    }

    return Array.from(groups.entries());
  }, [items]);

  if (grouped.length === 0) {
    return <p className="text-sm text-gray-500">No device evidence found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Monitor className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-semibold text-amber-400">
          {grouped.length} unique device{grouped.length !== 1 ? "s" : ""} detected
        </span>
      </div>

      {grouped.map(([fpId, { device, dates }]) => {
        const dev = device.data?._singleDevice;
        const acct = device.data?._account;

        return (
          <div key={fpId} className="bg-gray-800/60 rounded-lg border border-gray-700 overflow-hidden">
            {/* Device header */}
            <div className="px-4 py-3 bg-gradient-to-r from-amber-900/20 to-orange-900/20 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-semibold text-gray-200">
                    {dev?.browser || "Unknown Browser"} {dev?.browserVersion || ""} — {dev?.os || "Unknown OS"}
                  </span>
                </div>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                  {dates.length} detection{dates.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              {acct && (
                <span className="text-[10px] text-gray-500 font-mono mt-1 block">
                  Account: {acct.userId}
                </span>
              )}
            </div>

            {/* Device details */}
            {dev && (
              <div className="px-4 py-3">
                <div className="grid grid-cols-4 gap-x-6 gap-y-2 text-xs">
                  <DetailField label="Screen" value={dev.screenResolution} />
                  <DetailField label="Timezone" value={dev.timezone} />
                  <DetailField label="Language" value={dev.language} />
                  <DetailField label="IP Address" value={dev.ipAddress} />
                  <DetailField label="Color Depth" value={dev.colorDepth ? `${dev.colorDepth} bit` : undefined} />
                  <DetailField label="Times Used" value={dev.timesUsed} />
                  <DetailField label="Last Seen" value={dev.lastSeen ? formatDate(dev.lastSeen) : undefined} />
                  {dev.webgl && dev.webgl !== "unavailable" && (
                    <div className="col-span-4">
                      <span className="text-gray-500">GPU: </span>
                      <span className="text-yellow-400 text-[10px]">{dev.webgl}</span>
                    </div>
                  )}
                  {dev.fingerprintId && (
                    <div className="col-span-4 pt-1 border-t border-gray-700/50">
                      <span className="text-gray-500">Fingerprint: </span>
                      <code className="text-[10px] text-gray-400 font-mono">{dev.fingerprintId}</code>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Detection dates */}
            {dates.length > 0 && (
              <div className="px-4 py-2 bg-gray-900/50 border-t border-gray-700/50">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Detection dates</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {dates
                    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                    .map((d, i) => (
                      <span key={i} className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-400">
                        <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                        {formatDate(d)}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Summary if available */}
            {device.data?.linkedAccounts && (
              <div className="px-4 py-2 bg-red-900/10 border-t border-red-700/20">
                <p className="text-[11px] text-red-400">
                  <strong>{device.data.linkedAccounts}</strong> linked accounts (max: {device.data.maxAllowed})
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* Activity Log — show once for all items */}
      {items.some((i) => i.data?.activityLog?.length > 0) && (
        <ActivityLogSection items={items} />
      )}

      {/* Connected Accounts */}
      <SharedConnectedAccounts items={items} />
    </div>
  );
}

// ─── Payment Fingerprint Panel ──────────────────────────────
function PaymentFingerprintGrouped({ items }: { items: EvidenceItem[] }) {
  const grouped = useMemo(() => {
    const groups = new Map<string, { item: EvidenceItem; dates: string[] }>();
    for (const item of items) {
      const key = item.data?.paymentFingerprint || item.data?.cardLast4 || item.description;
      const existing = groups.get(key);
      if (existing) {
        if (item.data?.detectedAt) existing.dates.push(item.data.detectedAt);
      } else {
        groups.set(key, { item, dates: item.data?.detectedAt ? [item.data.detectedAt] : [] });
      }
    }
    return Array.from(groups.entries());
  }, [items]);

  return (
    <div className="space-y-4">
      {grouped.map(([key, { item, dates }]) => (
        <div key={key} className="bg-gray-800/60 rounded-lg border border-gray-700 overflow-hidden">
          {/* Card header */}
          <div className="px-4 py-3 bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-14 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded flex items-center justify-center">
                  <span className="text-xs font-bold text-white">💳</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-100 uppercase">{item.data?.cardBrand || "Card"}</p>
                  <p className="text-lg font-mono font-bold text-gray-200">•••• {item.data?.cardLast4 || "****"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px]">
                  {dates.length} detection{dates.length !== 1 ? "s" : ""}
                </Badge>
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                  {item.data?.paymentProvider?.toUpperCase() || "Payment"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Card details */}
          <div className="px-4 py-3">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <DetailField label="Country" value={item.data?.cardCountry} />
              <DetailField label="Provider" value={item.data?.paymentProvider} />
              <DetailField label="Accounts" value={item.data?.accountsInvolved || 2} />
            </div>
            {item.data?.paymentFingerprint && (
              <div className="mt-2 pt-2 border-t border-gray-700/50">
                <span className="text-[10px] text-gray-500">Fingerprint: </span>
                <code className="font-mono text-[10px] text-green-400 break-all">{item.data.paymentFingerprint}</code>
              </div>
            )}
          </div>

          {/* Dates */}
          <DetectionDates dates={dates} />
        </div>
      ))}

      <SharedConnectedAccounts items={items} />
    </div>
  );
}

// ─── Mirror Trading Panel ───────────────────────────────────
function MirrorTradingGrouped({ items }: { items: EvidenceItem[] }) {
  // Reason: Aggregate stats across all mirror trading evidence items
  const aggregated = useMemo(() => {
    let totalMatches = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allRecentMatches: any[] = [];
    const dates: string[] = [];

    for (const item of items) {
      totalMatches += item.data?.matchingTrades || 0;
      if (item.data?.detectedAt) dates.push(item.data.detectedAt);
      if (item.data?.recentMatches) allRecentMatches.push(...item.data.recentMatches);
    }

    return { totalMatches, allRecentMatches: allRecentMatches.slice(0, 20), dates };
  }, [items]);

  const firstItem = items[0];

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="p-4 bg-gradient-to-br from-pink-900/20 to-purple-900/20 rounded-lg border border-pink-500/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 bg-gradient-to-br from-pink-500 to-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-xl">🪞</span>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-100">Mirror Trading</p>
              <p className="text-sm text-gray-400">{aggregated.totalMatches} synchronized trades across {items.length} detection{items.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-pink-500/20">
          <StatBox value={aggregated.totalMatches} label="Matching Trades" color="text-pink-400" />
          <StatBox value={firstItem?.data?.timingCorrelation || "N/A"} label="Timing Correlation" color="text-purple-400" />
          <StatBox value={firstItem?.data?.directionCorrelation || "N/A"} label="Direction Correlation" color="text-blue-400" />
        </div>
      </div>

      {/* Recent matches */}
      {aggregated.allRecentMatches.length > 0 && (
        <div className="p-3 bg-gray-800/60 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-pink-400" />
            <span className="text-sm font-semibold text-pink-400">Recent Matching Trades</span>
          </div>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {aggregated.allRecentMatches.map((match, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-gray-900/60 rounded text-xs">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">{match.pair}</Badge>
                  <span className="text-gray-400">{match.directions}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Δ {match.timeDelta}</span>
                  {match.isOpposite && <Badge className="bg-red-500/20 text-red-400 text-[10px]">Opposite</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DetectionDates dates={aggregated.dates} />
      <SharedConnectedAccounts items={items} />
    </div>
  );
}

// ─── Coordinated Entry Panel ────────────────────────────────
function CoordinatedEntryGrouped({ items }: { items: EvidenceItem[] }) {
  const grouped = useMemo(() => {
    const groups = new Map<string, { item: EvidenceItem; dates: string[] }>();
    for (const item of items) {
      const key = item.data?.competitionId || item.description;
      const existing = groups.get(key);
      if (existing) {
        if (item.data?.detectedAt) existing.dates.push(item.data.detectedAt);
      } else {
        groups.set(key, { item, dates: item.data?.detectedAt ? [item.data.detectedAt] : [] });
      }
    }
    return Array.from(groups.entries());
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="h-4 w-4 text-emerald-400" />
        <span className="text-sm font-semibold text-emerald-400">
          {grouped.length} coordinated event{grouped.length !== 1 ? "s" : ""} across {items.length} detection{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {grouped.map(([key, { item, dates }]) => (
        <div key={key} className="bg-gray-800/60 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-green-900/20 to-teal-900/20 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <div>
                  <p className="text-sm font-semibold text-gray-200">Coordinated Entry</p>
                  <p className="text-xs text-gray-400">
                    {item.data?.involvedAccounts || 2} accounts within {item.data?.timeSpan || "N/A"}
                  </p>
                </div>
              </div>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                {dates.length} time{dates.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <DetailField label="Accounts" value={item.data?.involvedAccounts || 2} />
              <DetailField label="Avg Gap" value={item.data?.averageGap || "N/A"} />
            </div>

            {/* Entry sequence */}
            {item.data?.entrySequence && item.data.entrySequence.length > 0 && (
              <div className="mt-3 space-y-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Entry Timeline</span>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(item.data.entrySequence as any[]).map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between p-1.5 bg-gray-900/50 rounded text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">#{idx + 1}</span>
                      <code className="font-mono text-green-300 text-[10px]">{entry.userId}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{new Date(entry.entryTime).toLocaleTimeString()}</span>
                      {idx > 0 && <Badge className="bg-yellow-500/20 text-yellow-400 text-[9px]">+{entry.timeDelta || 0}s</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {item.data?.competitionId && (
              <div className="mt-2 text-[10px]">
                <span className="text-gray-500">Competition: </span>
                <code className="font-mono text-blue-400">{item.data.competitionId}</code>
              </div>
            )}
          </div>

          <DetectionDates dates={dates} />
        </div>
      ))}

      <SharedConnectedAccounts items={items} />
    </div>
  );
}

// ─── Trading Similarity Panel ───────────────────────────────
function TradingSimilarityGrouped({ items }: { items: EvidenceItem[] }) {
  const firstItem = items[0];

  return (
    <div className="space-y-4">
      <div className="p-4 bg-gradient-to-br from-indigo-900/20 to-violet-900/20 rounded-lg border border-indigo-500/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center">
            <span className="text-lg">📊</span>
          </div>
          <div>
            <p className="text-base font-bold text-gray-100">Trading Similarity</p>
            <p className="text-xs text-gray-400">{items.length} detection{items.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-indigo-500/20">
          <SmallStatBox label="Pair Similarity" value={firstItem?.data?.pairSimilarity || "N/A"} color="text-indigo-400" />
          <SmallStatBox label="Timing" value={firstItem?.data?.timingSimilarity || "N/A"} color="text-violet-400" />
          <SmallStatBox label="Size" value={firstItem?.data?.sizeSimilarity || "N/A"} color="text-purple-400" />
          <SmallStatBox label="Style" value={firstItem?.data?.styleSimilarity || "N/A"} color="text-pink-400" />
        </div>
      </div>

      <DetectionDates dates={items.filter((i) => i.data?.detectedAt).map((i) => i.data.detectedAt)} />
      <SharedConnectedAccounts items={items} />
    </div>
  );
}

// ─── IP / Browser Panel ─────────────────────────────────────
function IpBrowserGrouped({ items }: { items: EvidenceItem[] }) {
  const grouped = useMemo(() => {
    const groups = new Map<string, { item: EvidenceItem; dates: string[] }>();
    for (const item of items) {
      const key = item.data?.ipAddress || item.data?.ip || item.description;
      const existing = groups.get(key);
      if (existing) {
        if (item.data?.detectedAt) existing.dates.push(item.data.detectedAt);
      } else {
        groups.set(key, { item, dates: item.data?.detectedAt ? [item.data.detectedAt] : [] });
      }
    }
    return Array.from(groups.entries());
  }, [items]);

  return (
    <div className="space-y-4">
      {grouped.map(([key, { item, dates }]) => (
        <div key={key} className="bg-gray-800/60 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-orange-900/20 to-red-900/20 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-orange-400" />
                <span className="font-mono text-sm font-bold text-gray-200">{item.data?.ipAddress || item.data?.ip || "Unknown"}</span>
                {item.data?.browser && <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px]">{item.data.browser}</Badge>}
              </div>
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px]">
                {dates.length} time{dates.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <DetailField label="Country" value={item.data?.country} />
              <DetailField label="City" value={item.data?.city} />
              <DetailField label="ISP" value={item.data?.isp} />
              <DetailField label="Org" value={item.data?.org} />
              <DetailField label="ASN" value={item.data?.asn} />
              <DetailField label="Accounts" value={item.data?.linkedAccounts || item.data?.accountsInvolved} />
            </div>

            {/* Security flags */}
            {(item.data?.isVPN || item.data?.isProxy || item.data?.isTor || item.data?.isHosting) && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-gray-700/50">
                <AlertOctagon className="h-3.5 w-3.5 text-red-400" />
                {item.data?.isVPN && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">🔒 VPN</Badge>}
                {item.data?.isProxy && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">🌐 Proxy</Badge>}
                {item.data?.isTor && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">🧅 Tor</Badge>}
                {item.data?.isHosting && <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px]">🖥️ Hosting</Badge>}
              </div>
            )}
          </div>
          <DetectionDates dates={dates} />
        </div>
      ))}
      <SharedConnectedAccounts items={items} />
    </div>
  );
}

// ─── Fallback / Generic Panel ───────────────────────────────
function GenericGrouped({ items }: { items: EvidenceItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="bg-gray-800/60 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-300 capitalize">{item.type.replace(/_/g, " ")}</span>
            {item.data?.detectedAt && (
              <span className="text-[10px] text-gray-500 ml-auto">{formatDate(item.data.detectedAt)}</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-2">{item.description}</p>
          <pre className="text-[10px] text-gray-500 overflow-x-auto bg-gray-900/60 p-2 rounded max-h-[150px] overflow-y-auto">
            {JSON.stringify(item.data, null, 2)}
          </pre>
        </div>
      ))}
      <SharedConnectedAccounts items={items} />
    </div>
  );
}

// ─── Shared Subcomponents ───────────────────────────────────
function DetailField({ label, value }: { label: string; value: string | number | undefined }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div>
      <span className="text-gray-500 text-[10px]">{label}</span>
      <p className="text-gray-300 text-xs">{String(value)}</p>
    </div>
  );
}

function StatBox({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}

function SmallStatBox({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="p-2 bg-gray-800/50 rounded">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function DetectionDates({ dates }: { dates: string[] }) {
  if (!dates || dates.length === 0) return null;
  const sorted = [...dates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return (
    <div className="px-4 py-2 bg-gray-900/40 border-t border-gray-700/50">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">Detected on</span>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {sorted.map((d, i) => (
          <span key={i} className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-400">
            {formatDate(d)}
          </span>
        ))}
      </div>
    </div>
  );
}

function ActivityLogSection({ items }: { items: EvidenceItem[] }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allActivities: any[] = [];
  for (const item of items) {
    if (item.data?.activityLog) allActivities.push(...item.data.activityLog);
  }
  if (allActivities.length === 0) return null;

  return (
    <div className="p-3 bg-blue-900/10 border border-blue-700/20 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-semibold text-blue-400">Activity Log ({allActivities.length})</span>
      </div>
      <div className="space-y-1 max-h-[160px] overflow-y-auto">
        {allActivities.slice(0, 30).map((activity, idx) => (
          <div key={idx} className="flex items-center justify-between text-[11px] p-1.5 bg-gray-900/50 rounded">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-[9px]">
                {activity.action === "initial_detection" ? "🎯 Initial" : "🔄 Login"}
              </Badge>
              <span className="font-mono text-gray-400">{String(activity.userId).substring(0, 12)}…</span>
              <span className="text-gray-500">via {activity.browser}</span>
            </div>
            <span className="text-gray-500">{formatDate(activity.timestamp)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SharedConnectedAccounts({ items }: { items: EvidenceItem[] }) {
  const allIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.data?.connectedAccountIds) {
        (item.data.connectedAccountIds as string[]).forEach((id) => set.add(id));
      }
    }
    return Array.from(set);
  }, [items]);

  if (allIds.length === 0) return null;

  return <ConnectedAccountsPanel accountIds={allIds} title="Connected Accounts" />;
}

// ─── Main Export ────────────────────────────────────────────
export default function EvidenceGroupedPanel({ evidenceType, items }: EvidenceGroupedPanelProps) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500 py-4">No evidence items for this type.</p>;
  }

  switch (evidenceType) {
    case "device_fingerprint":
    case "same_device":
      return <DeviceFingerprintGrouped items={items} />;
    case "payment_fingerprint":
    case "same_payment":
      return <PaymentFingerprintGrouped items={items} />;
    case "mirror_trading":
      return <MirrorTradingGrouped items={items} />;
    case "coordinated_entry":
      return <CoordinatedEntryGrouped items={items} />;
    case "trading_similarity":
      return <TradingSimilarityGrouped items={items} />;
    case "ip_browser_match":
    case "ip_detection":
    case "same_ip":
    case "same_ip_browser":
      return <IpBrowserGrouped items={items} />;
    default:
      return <GenericGrouped items={items} />;
  }
}
