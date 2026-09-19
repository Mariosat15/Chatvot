"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldAlert, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface SecurityAlert {
  _id: string;
  alertType: string;
  severity: "low" | "medium" | "high" | "critical";
  source: string;
  provider?: string;
  ip?: string;
  userId?: string;
  reason: string;
  acknowledged: boolean;
  createdAt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

interface SecurityAlertsResponse {
  success: boolean;
  alerts: SecurityAlert[];
  counts: {
    total: number;
    bySeverity: Record<"low" | "medium" | "high" | "critical", number>;
  };
}

const ALERT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All types" },
  { value: "webhook_signature_failure", label: "Webhook signature failure" },
  { value: "webhook_replay_detected", label: "Webhook replay" },
  { value: "chargeback_received", label: "Chargeback received" },
  { value: "nosql_injection_attempt", label: "NoSQL injection attempt" },
  { value: "csrf_violation", label: "CSRF violation" },
  { value: "origin_mismatch", label: "Origin mismatch" },
  { value: "brute_force_detected", label: "Brute force" },
  { value: "ato_attempt", label: "ATO attempt" },
  { value: "rate_limit_exceeded", label: "Rate limit exceeded" },
  { value: "other", label: "Other" },
];

function severityBadgeClass(
  severity: SecurityAlert["severity"],
): string {
  switch (severity) {
    case "critical":
      return "bg-red-500/20 text-red-300 border-red-500/40";
    case "high":
      return "bg-orange-500/20 text-orange-300 border-orange-500/40";
    case "medium":
      return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
    default:
      return "bg-gray-500/20 text-gray-300 border-gray-500/40";
  }
}

export default function SecurityAlertsCard() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [counts, setCounts] = useState<SecurityAlertsResponse["counts"] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [includeAcknowledged, setIncludeAcknowledged] = useState(false);
  const [alertTypeFilter, setAlertTypeFilter] = useState("all");
  const [pendingAck, setPendingAck] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (includeAcknowledged) params.set("includeAcknowledged", "1");
      if (alertTypeFilter !== "all") params.set("alertType", alertTypeFilter);
      params.set("limit", "100");

      const res = await fetch(`/api/security/alerts?${params.toString()}`, {
        credentials: "include",
      });
      const data = (await res.json()) as SecurityAlertsResponse;
      if (!res.ok || !data.success) {
        throw new Error("Failed to load security alerts");
      }
      setAlerts(data.alerts || []);
      setCounts(data.counts || null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load security alerts");
    } finally {
      setLoading(false);
    }
  }, [includeAcknowledged, alertTypeFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const acknowledge = useCallback(
    async (alertId: string) => {
      setPendingAck(alertId);
      try {
        const res = await fetch("/api/security/alerts", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ alertId }),
        });
        if (!res.ok) throw new Error("ack failed");
        toast.success("Alert acknowledged");
        await fetchAlerts();
      } catch (err) {
        console.error(err);
        toast.error("Failed to acknowledge alert");
      } finally {
        setPendingAck(null);
      }
    },
    [fetchAlerts],
  );

  const pendingCount = counts?.total ?? 0;
  const criticalCount = counts?.bySeverity.critical ?? 0;

  const visibleAlerts = useMemo(() => alerts, [alerts]);

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-gray-100">
            <ShieldAlert className="h-5 w-5 text-red-400" />
            Security Alerts
            {pendingCount > 0 && (
              <Badge className={severityBadgeClass("critical")}>
                {pendingCount} pending
              </Badge>
            )}
            {criticalCount > 0 && (
              <Badge className={severityBadgeClass("critical")}>
                {criticalCount} critical
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-gray-400">
            Runtime security events raised by webhook signature checks,
            chargeback detection, login rate limiting, and payload validation.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={alertTypeFilter} onValueChange={setAlertTypeFilter}>
            <SelectTrigger className="w-48 bg-gray-800 border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALERT_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIncludeAcknowledged((v) => !v)}
          >
            {includeAcknowledged ? "Hide acknowledged" : "Show acknowledged"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAlerts}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {visibleAlerts.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {loading ? "Loading…" : "No security alerts."}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleAlerts.map((alert) => (
              <div
                key={alert._id}
                className="flex flex-col gap-2 rounded-lg border border-gray-800 bg-gray-950/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={severityBadgeClass(alert.severity)}>
                      {alert.severity}
                    </Badge>
                    <span className="font-medium text-gray-200">
                      {alert.alertType.replace(/_/g, " ")}
                    </span>
                    {alert.provider && (
                      <Badge variant="outline" className="text-xs">
                        {alert.provider}
                      </Badge>
                    )}
                    {alert.acknowledged && (
                      <Badge className="bg-green-500/20 text-green-300 border-green-500/40 text-xs">
                        acknowledged
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-300 break-words">
                    {alert.reason}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>source: {alert.source}</span>
                    {alert.ip && <span>ip: {alert.ip}</span>}
                    {alert.userId && <span>user: {alert.userId}</span>}
                    <span>{new Date(alert.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                {!alert.acknowledged && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => acknowledge(alert._id)}
                    disabled={pendingAck === alert._id}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Acknowledge
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
