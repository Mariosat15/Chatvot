"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  Monitor,
  Shield,
  Lock,
  History,
  CreditCard,
  User,
  Wifi,
  WifiOff,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SuspicionScore {
  totalScore?: number;
  riskLevel?: string;
  detectedMethods?: string[];
  scores?: Record<string, number>;
}

interface FraudAlertItem {
  _id: string;
  alertType?: string;
  status?: string;
  severity?: string;
  detectedAt?: string;
  evidence?: Array<{ type: string; description?: string }>;
}

interface DeviceItem {
  _id?: string;
  fingerprint?: string;
  browser?: string;
  os?: string;
  riskScore?: number;
  isVPN?: boolean;
  isProxy?: boolean;
  firstSeen?: string;
  lastSeen?: string;
  timesUsed?: number;
  linkedUserIds?: string[];
}

interface RestrictionItem {
  _id?: string;
  restrictionType?: string;
  reason?: string;
  customReason?: string;
  isActive?: boolean;
  restrictedAt?: string;
  expiresAt?: string;
}

interface LockoutItem {
  _id?: string;
  reason?: string;
  isActive?: boolean;
  lockedAt?: string;
  unlockedAt?: string;
}

interface HistoryEntry {
  _id?: string;
  actionType?: string;
  actionSeverity?: string;
  reason?: string;
  createdAt?: string;
  performedBy?: { type?: string; adminEmail?: string };
}

interface PaymentFingerprintItem {
  _id?: string;
  fingerprint?: string;
  paymentMethod?: string;
  lastUsed?: string;
  timesUsed?: number;
}

interface ManualCheckResult {
  user: Record<string, unknown>;
  suspicionScore: SuspicionScore | null;
  alerts: FraudAlertItem[];
  devices: DeviceItem[];
  restrictions: RestrictionItem[];
  lockouts: LockoutItem[];
  paymentFingerprints: PaymentFingerprintItem[];
  history: HistoryEntry[];
  summary: Record<string, number>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

function fmtShort(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString();
}

function riskColor(score?: number) {
  if (!score || score < 25) return "bg-green-600";
  if (score < 50) return "bg-yellow-500";
  if (score < 75) return "bg-orange-500";
  return "bg-red-600";
}

function riskLabel(level?: string, score?: number) {
  if (level) return level.toUpperCase();
  if (!score) return "CLEAN";
  if (score < 25) return "CLEAN";
  if (score < 50) return "LOW";
  if (score < 75) return "MEDIUM";
  return "HIGH";
}

function severityColor(sev?: string) {
  if (sev === "critical") return "bg-red-600";
  if (sev === "high") return "bg-orange-500";
  if (sev === "medium") return "bg-yellow-500";
  return "bg-gray-500";
}

function statusColor(status?: string) {
  if (status === "investigating") return "bg-blue-500";
  if (status === "pending") return "bg-yellow-500";
  if (status === "resolved") return "bg-green-600";
  if (status === "dismissed") return "bg-gray-500";
  return "bg-gray-600";
}

function alertTypeLabel(t?: string) {
  if (!t) return "Unknown";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ManualCheckResultPanel({
  result,
}: {
  result: ManualCheckResult;
}) {
  const score = result.suspicionScore;
  const totalScore =
    score?.totalScore ??
    Object.values(score?.scores ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* ── Suspicion Score ── */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-100 flex items-center gap-2">
            <Shield className="h-4 w-4 text-yellow-400" />
            Suspicion Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          {score ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${riskColor(totalScore)}`}
                      style={{ width: `${Math.min(totalScore, 100)}%` }}
                    />
                  </div>
                </div>
                <Badge className={`${riskColor(totalScore)} text-white`}>
                  {riskLabel(score.riskLevel, totalScore)} — {totalScore}
                  /100
                </Badge>
              </div>

              {/* Detected Methods */}
              {score.detectedMethods && score.detectedMethods.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">
                    Detected Methods
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {score.detectedMethods.map((m) => (
                      <Badge
                        key={m}
                        variant="outline"
                        className="text-red-400 border-red-500 text-xs"
                      >
                        {m.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-Method Scores */}
              {score.scores && Object.keys(score.scores).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(score.scores).map(([method, val]) => (
                    <div
                      key={method}
                      className="bg-gray-900 rounded p-2 text-xs"
                    >
                      <div className="text-gray-400 truncate">
                        {method.replace(/_/g, " ")}
                      </div>
                      <div className={`font-bold ${val > 0 ? "text-red-400" : "text-green-400"}`}>
                        +{val}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="text-gray-500 text-sm">No score found</span>
          )}
        </CardContent>
      </Card>

      {/* ── Active Alerts ── */}
      {result.alerts.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-100 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              Fraud Alerts ({result.alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.alerts.map((alert) => (
              <div
                key={alert._id}
                className="bg-gray-900 rounded p-3 flex flex-col sm:flex-row sm:items-center gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">
                      {alertTypeLabel(alert.alertType)}
                    </span>
                    <Badge
                      className={`${statusColor(alert.status)} text-white text-xs`}
                    >
                      {alert.status?.toUpperCase() ?? "UNKNOWN"}
                    </Badge>
                    {alert.severity && (
                      <Badge
                        className={`${severityColor(alert.severity)} text-white text-xs`}
                      >
                        {alert.severity.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    Detected: {fmt(alert.detectedAt)}
                  </p>
                  {alert.evidence && alert.evidence.length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Evidence types:{" "}
                      {[...new Set(alert.evidence.map((e) => e.type))].join(
                        ", ",
                      )}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Devices ── */}
      {result.devices.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-100 flex items-center gap-2">
              <Monitor className="h-4 w-4 text-blue-400" />
              Devices ({result.devices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.devices.map((dev, i) => (
              <div
                key={dev._id ?? i}
                className="bg-gray-900 rounded p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs"
              >
                <div>
                  <p className="text-gray-400">OS / Browser</p>
                  <p className="text-white">
                    {dev.os ?? "—"} / {dev.browser ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Risk Score</p>
                  <Badge className={`${riskColor(dev.riskScore)} text-white`}>
                    {dev.riskScore ?? 0}
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-400">VPN / Proxy</p>
                  <div className="flex gap-1 mt-0.5">
                    {dev.isVPN ? (
                      <Badge className="bg-red-600 text-white text-xs">
                        <WifiOff className="h-3 w-3 mr-1" />
                        VPN
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-green-400 border-green-600 text-xs"
                      >
                        <Wifi className="h-3 w-3 mr-1" />
                        Clean
                      </Badge>
                    )}
                    {dev.isProxy && (
                      <Badge className="bg-orange-600 text-white text-xs">
                        Proxy
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-gray-400">Used / Last Seen</p>
                  <p className="text-white">
                    {dev.timesUsed ?? 1}× · {fmtShort(dev.lastSeen)}
                  </p>
                </div>
                {dev.linkedUserIds && dev.linkedUserIds.length > 1 && (
                  <div className="col-span-2 sm:col-span-4">
                    <p className="text-gray-400">
                      Shared with {dev.linkedUserIds.length - 1} other
                      account(s)
                    </p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Active Restrictions ── */}
      {result.restrictions.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-100 flex items-center gap-2">
              <Shield className="h-4 w-4 text-orange-400" />
              Restrictions ({result.restrictions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.restrictions.map((r, i) => (
              <div
                key={r._id ?? i}
                className="bg-gray-900 rounded p-3 flex flex-col sm:flex-row sm:items-center gap-2"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-white">
                      {r.restrictionType?.replace(/_/g, " ") ?? "Restriction"}
                    </span>
                    <Badge
                      className={`${r.isActive ? "bg-red-600" : "bg-gray-600"} text-white text-xs`}
                    >
                      {r.isActive ? "ACTIVE" : "INACTIVE"}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400">
                    Reason: {r.customReason ?? r.reason ?? "—"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Since: {fmt(r.restrictedAt)} ·{" "}
                    {r.expiresAt ? `Expires: ${fmt(r.expiresAt)}` : "No expiry"}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Account Lockouts ── */}
      {result.lockouts.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-100 flex items-center gap-2">
              <Lock className="h-4 w-4 text-red-400" />
              Lockouts ({result.lockouts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.lockouts.map((lk, i) => (
              <div
                key={lk._id ?? i}
                className="bg-gray-900 rounded p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-white">{lk.reason ?? "Lockout"}</p>
                  <p className="text-xs text-gray-400">
                    {fmt(lk.lockedAt)}
                    {lk.unlockedAt
                      ? ` → Unlocked ${fmt(lk.unlockedAt)}`
                      : ""}
                  </p>
                </div>
                <Badge
                  className={`${lk.isActive ? "bg-red-600" : "bg-gray-600"} text-white text-xs`}
                >
                  {lk.isActive ? "LOCKED" : "UNLOCKED"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Payment Fingerprints ── */}
      {result.paymentFingerprints.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-100 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-purple-400" />
              Payment Methods ({result.paymentFingerprints.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.paymentFingerprints.map((pf, i) => (
              <div
                key={pf._id ?? i}
                className="bg-gray-900 rounded p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-white">
                    {pf.paymentMethod ?? "Payment method"}{" "}
                    {pf.fingerprint
                      ? `(…${String(pf.fingerprint).slice(-6)})`
                      : ""}
                  </p>
                  <p className="text-xs text-gray-400">
                    Used {pf.timesUsed ?? 1}× · Last:{" "}
                    {fmtShort(pf.lastUsed)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Recent History ── */}
      {result.history.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-100 flex items-center gap-2">
              <History className="h-4 w-4 text-indigo-400" />
              Action History (last {Math.min(result.history.length, 20)})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.history.slice(0, 20).map((h, i) => (
              <div
                key={h._id ?? i}
                className="bg-gray-900 rounded p-3 flex flex-col sm:flex-row sm:items-center gap-2"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-white">
                      {(h.actionType ?? "action").replace(/_/g, " ")}
                    </span>
                    {h.actionSeverity && (
                      <Badge
                        className={`${severityColor(h.actionSeverity)} text-white text-xs`}
                      >
                        {h.actionSeverity.toUpperCase()}
                      </Badge>
                    )}
                    {h.performedBy?.type && (
                      <Badge
                        variant="outline"
                        className="text-gray-400 border-gray-600 text-xs"
                      >
                        {h.performedBy.type === "admin"
                          ? (h.performedBy.adminEmail ?? "admin")
                          : h.performedBy.type}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{h.reason ?? ""}</p>
                  <p className="text-xs text-gray-500">{fmt(h.createdAt)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── No Data Fallback ── */}
      {result.alerts.length === 0 &&
        result.restrictions.length === 0 &&
        result.lockouts.length === 0 &&
        result.history.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>No fraud data found for this user</p>
          </div>
        )}
    </div>
  );
}
