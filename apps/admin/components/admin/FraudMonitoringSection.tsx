"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Shield,
  AlertTriangle,
  Users,
  RefreshCw,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  TrendingUp,
  Activity,
  Settings,
  Bug,
  UserX,
  Trash2,
  AlertOctagon,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FraudSettingsSection from "@/components/admin/FraudSettingsSection";
import FraudDebugger from "@/components/admin/FraudDebugger";
import RestrictedUsersSection from "@/components/admin/RestrictedUsersSection";
import SuspicionScoreCard from "@/components/admin/fraud/SuspicionScoreCard";
import FraudAlertDetailTabs from "@/components/admin/fraud/FraudAlertDetailTabs";
import FraudHistorySection from "@/components/admin/FraudHistorySection";
import ManualCheckResultPanel from "@/components/admin/fraud/ManualCheckResultPanel";
import { History } from "lucide-react";
import {
  computeAlertTitle,
  computeAlertDescription,
  getAccountsInvolved,
} from "@/components/admin/fraud/alert-display-helpers";


// Reason: Matches SuspicionScoreData in SuspicionScoreCard.tsx — needed for typed fraud score state.
interface ScoreBreakdownEntry {
  percentage?: number;
  points?: number;
  evidence?: string;
  lastDetected?: string;
}

interface FraudScore {
  userId: string;
  totalScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  lastUpdated: string;
  scoreBreakdown: {
    deviceMatch: ScoreBreakdownEntry;
    ipMatch: ScoreBreakdownEntry;
    ipBrowserMatch: ScoreBreakdownEntry;
    sameCity: ScoreBreakdownEntry;
    samePayment: ScoreBreakdownEntry;
    rapidCreation: ScoreBreakdownEntry;
    coordinatedEntry: ScoreBreakdownEntry;
    tradingSimilarity: ScoreBreakdownEntry;
    mirrorTrading: ScoreBreakdownEntry;
    timezoneLanguage: ScoreBreakdownEntry;
    deviceSwitching: ScoreBreakdownEntry;
    kycDuplicate: ScoreBreakdownEntry;
  };
  linkedAccounts: Array<{
    userId: string;
    matchType: string;
    confidence: number;
    detectedAt: string;
  }>;
  scoreHistory: Array<{
    timestamp: string;
    score: number;
    reason: string;
    delta: number;
    triggeredBy: string;
  }>;
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
  evidence: Array<{
    type: string;
    description: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
  }>;
  resolution?: string;
  actionTaken?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  investigationClearedAt?: string; // When users were unbanned/unsuspended
  clearanceNote?: string; // Admin notes when clearing
  competitionId?: string; // Competition ID if alert is competition-related
  updatedAt?: string; // Last update timestamp
  // Detection tracking
  detectionCount?: number; // Times this alert type triggered
  detectionHistory?: Array<{
    timestamp: string;
    triggeredBy: string;
    ipAddress?: string;
    details?: string;
  }>;
  previousAlertCount?: number; // Previous alerts for same users
}

interface DeviceFingerprint {
  _id: string;
  fingerprintId: string;
  userId: string;
  deviceType: string;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  screenResolution: string;
  timezone: string;
  language: string;
  ipAddress: string;
  linkedUserIds: string[];
  riskScore: number;
  firstSeen: string;
  lastSeen: string;
  timesUsed: number;
  isVPN: boolean;
  isProxy: boolean;
}

interface FraudStats {
  total: number;
  pending: number;
  investigating: number;
  resolved: number;
  dismissed: number;
  critical: number;
  high: number;
}

interface DeviceStats {
  totalDevices: number;
  suspiciousDevices: number;
  highRiskDevices: number;
  vpnDevices: number;
  proxyDevices: number;
}

interface ManualCheckResult {
  user: Record<string, unknown>;
  suspicionScore: Record<string, unknown> | null;
  alerts: FraudAlert[];
  devices: DeviceFingerprint[];
  restrictions: Array<Record<string, unknown>>;
  lockouts: Array<Record<string, unknown>>;
  paymentFingerprints: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
  summary: {
    alertsTotal: number;
    alertsPending: number;
    alertsInvestigating: number;
    devicesTotal: number;
    devicesHighRisk: number;
    restrictionsActive: number;
    lockoutsActive: number;
    paymentFingerprintsTotal: number;
    historyEntries: number;
  };
}

export default function FraudMonitoringSection() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [_devices, setDevices] = useState<DeviceFingerprint[]>([]);
  const [stats, setStats] = useState<FraudStats | null>(null);
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] =
    useState<DeviceFingerprint | null>(null);
  const [actionType, setActionType] = useState<
    "suspend" | "dismiss" | "ban" | null
  >(null);
  const [actionReason, setActionReason] = useState("");
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedInvestigationAlert, setSelectedInvestigationAlert] =
    useState<FraudAlert | null>(null);
  const [investigationActionType, setInvestigationActionType] = useState<
    "suspend" | "dismiss" | "ban" | null
  >(null);
  const [showInvestigationDialog, setShowInvestigationDialog] = useState(false);
  const [suspendDuration, setSuspendDuration] = useState<number>(7);
  const [suspendUnit, setSuspendUnit] = useState<"hours" | "days" | "weeks">(
    "days",
  );
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [restrictionReason, setRestrictionReason] =
    useState<string>("multi_accounting");
  const [customRestrictionReason, setCustomRestrictionReason] =
    useState<string>("");
  const [blockTrading, setBlockTrading] = useState<boolean>(true);
  const [blockCompetitions, setBlockCompetitions] = useState<boolean>(true);
  const [blockDeposit, setBlockDeposit] = useState<boolean>(true);
  const [blockWithdraw, setBlockWithdraw] = useState<boolean>(true);
  const [fraudScores, setFraudScores] = useState<Record<string, FraudScore>>({});
  const [selectedScoreUserId, setSelectedScoreUserId] = useState<string | null>(
    null,
  );
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [unlockingAccount, setUnlockingAccount] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState("");
  const [manualUserId, setManualUserId] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualResult, setManualResult] = useState<ManualCheckResult | null>(
    null,
  );

  // Handler to unlock a locked account (for brute_force alerts)
  const handleUnlockAccount = async (alert: FraudAlert) => {
    // Get email from evidence if available, or from primaryUserId if it looks like an email
    const evidenceEmail = alert.evidence?.[0]?.data?.email;
    const isEmailId = alert.primaryUserId?.includes("@");
    const email = evidenceEmail || (isEmailId ? alert.primaryUserId : null);

    if (!email) {
      toast.error("Cannot unlock: No email found in alert");
      return;
    }

    if (!confirm(`Are you sure you want to unlock the account for ${email}?`)) {
      return;
    }

    setUnlockingAccount(alert._id);
    try {
      // Try unlocking by email
      const response = await fetch(
        `/api/lockouts/${encodeURIComponent(email)}/unlock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Admin manual unlock from fraud investigation",
          }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (response.ok || data.success) {
        toast.success(`Account unlocked for ${email}`);
        // Also dismiss the alert
        await handleInvestigationAction(alert, "dismiss");
        fetchAlerts();
      } else {
        // Try via clear-all endpoint as fallback
        const clearAllResponse = await fetch("/api/lockouts/clear-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        if (clearAllResponse.ok) {
          toast.success(`Account unlocked for ${email}`);
          await handleInvestigationAction(alert, "dismiss");
          fetchAlerts();
        } else {
          toast.error(data.error || "Failed to unlock account");
        }
      }
    } catch (error) {
      console.error("Error unlocking account:", error);
      toast.error("Failed to unlock account");
    } finally {
      setUnlockingAccount(null);
    }
  };

  useEffect(() => {
    fetchAlerts();
    fetchDevices();
    // No auto-refresh - user can manually refresh when needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // Adjust status filter for API call
  const apiStatusFilter = statusFilter === "all" ? "" : statusFilter;

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/fraud/alerts?status=${apiStatusFilter}&limit=100`,
      );

      if (!response.ok) {
        console.error(
          "API response not OK:",
          response.status,
          response.statusText,
        );
        toast.error(`Failed to fetch fraud alerts: ${response.status}`);
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.success === false) {
        console.error("API returned success:false:", data);
        toast.error(data.error || "Failed to fetch fraud alerts");
        setLoading(false);
        return;
      }

      // Ensure alerts is an array
      const alertsArray = Array.isArray(data.alerts) ? data.alerts : [];
      setAlerts(alertsArray);
      setStats(
        data.stats || {
          total: 0,
          pending: 0,
          investigating: 0,
          resolved: 0,
          dismissed: 0,
          critical: 0,
          high: 0,
        },
      );
    } catch (error) {
      console.error("❌ Error fetching alerts:", error);
      console.error(
        "Error details:",
        error instanceof Error ? error.message : error,
      );
      toast.error("Error loading fraud alerts - check console for details");
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const response = await fetch(
        "/api/fraud/devices?minRiskScore=50&limit=50",
      );

      if (!response.ok) {
        console.error("Devices API response not OK:", response.status);
        return;
      }

      const data = await response.json();

      if (data.success === false) {
        console.error("Devices API returned success:false:", data);
        return;
      }

      // Ensure devices is an array
      const devicesArray = Array.isArray(data.devices) ? data.devices : [];
      setDevices(devicesArray);
      setDeviceStats(
        data.stats || {
          totalDevices: 0,
          suspiciousDevices: 0,
          highRiskDevices: 0,
          vpnDevices: 0,
          proxyDevices: 0,
        },
      );
    } catch (error) {
      console.error("❌ Error fetching devices:", error);
      console.error(
        "Error details:",
        error instanceof Error ? error.message : error,
      );
    }
  };

  const runManualCheck = async () => {
    const email = manualEmail.trim();
    const userId = manualUserId.trim();

    if (!email && !userId) {
      toast.error("Enter a user email or user ID");
      return;
    }

    setManualLoading(true);
    setManualError(null);
    setManualResult(null);

    try {
      const response = await fetch("/api/fraud/manual-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, userId }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        const message = data.message || "Manual check failed";
        setManualError(message);
        toast.error(message);
        return;
      }

      setManualResult(data.data as ManualCheckResult);
    } catch (error) {
      console.error("Manual check failed:", error);
      setManualError("Manual check failed");
      toast.error("Manual check failed");
    } finally {
      setManualLoading(false);
    }
  };

  // Fetch fraud score for a user
  const fetchFraudScore = async (userId: string) => {
    try {
      const response = await fetch(
        `/api/fraud/suspicion-score?userId=${userId}`,
      );

      if (!response.ok) {
        console.error("Score API response not OK:", response.status);
        return null;
      }

      const data = await response.json();

      if (data.success && data.score) {
        setFraudScores((prev) => ({
          ...prev,
          [userId]: data.score,
        }));
        return data.score;
      }

      return null;
    } catch (error) {
      console.error("❌ Error fetching fraud score:", error);
      return null;
    }
  };

  // Fetch fraud scores for all users in an alert
  const fetchScoresForAlert = async (alert: FraudAlert) => {
    const userIds = alert.suspiciousUserIds;
    const promises = userIds.map((userId) => fetchFraudScore(userId));
    await Promise.all(promises);
  };

  // Get fraud score for a user (from cache or fetch)
  const getFraudScore = (userId: string): FraudScore | null => {
    if (!Object.prototype.hasOwnProperty.call(fraudScores, userId)) return null;
    // eslint-disable-next-line security/detect-object-injection
    return fraudScores[userId] ?? null;
  };

  // Get risk badge color
  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "critical":
        return "bg-red-500/20 text-red-500 border-red-500/30";
      case "high":
        return "bg-orange-500/20 text-orange-500 border-orange-500/30";
      case "medium":
        return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
      case "low":
        return "bg-green-500/20 text-green-500 border-green-500/30";
      default:
        return "bg-gray-500/20 text-gray-500 border-gray-500/30";
    }
  };

  // Device action handlers
  const _handleDeviceAction = (
    device: DeviceFingerprint,
    action: "suspend" | "dismiss" | "ban",
  ) => {
    setSelectedDevice(device);
    setActionType(action);
    setActionReason("");
    setShowActionDialog(true);
  };

  const executeDeviceAction = async () => {
    if (!selectedDevice || !actionType) return;

    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch("/api/fraud/devices/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deviceId: selectedDevice._id,
          action: actionType,
          reason: actionReason,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setShowActionDialog(false);
        setSelectedDevice(null);
        setActionType(null);
        setActionReason("");
        // Refresh data
        await fetchDevices();
        await fetchAlerts();
      } else {
        toast.error(data.message || "Failed to perform action");
      }
    } catch (error) {
      console.error("Error performing device action:", error);
      toast.error("Failed to perform action");
    }
  };

  // Reset all security data handler
  const handleResetAllSecurityData = async () => {
    if (!resetPassword) {
      toast.error("Admin password is required");
      return;
    }

    try {
      // First verify password
      const verifyResponse = await fetch("/api/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });

      if (!verifyResponse.ok) {
        toast.error("Invalid admin password");
        return;
      }

      // Then call the reset endpoint
      const response = await fetch("/api/fraud/settings/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAllSecurityData: true }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "All security data cleared!");
        setShowResetDialog(false);
        setResetPassword("");
        // Refresh data
        await fetchAlerts();
        await fetchDevices();
      } else {
        toast.error(data.error || "Failed to reset security data");
      }
    } catch (error) {
      console.error("Error resetting security data:", error);
      toast.error("Failed to reset security data");
    }
  };

  // Investigation action handlers
  const handleInvestigationAction = (
    alert: FraudAlert,
    action: "suspend" | "dismiss" | "ban",
  ) => {
    setSelectedInvestigationAlert(alert);
    setInvestigationActionType(action);
    // By default, select all suspicious accounts
    setSelectedUserIds(alert.suspiciousUserIds);
    // Reset restriction settings
    setRestrictionReason("multi_accounting");
    setCustomRestrictionReason("");
    setBlockTrading(true);
    setBlockCompetitions(true);
    setBlockDeposit(true);
    setBlockWithdraw(true);
    setShowInvestigationDialog(true);
  };

  const executeInvestigationAction = async () => {
    if (!selectedInvestigationAlert || !investigationActionType) return;

    // Validate selection
    if (
      (investigationActionType === "ban" ||
        investigationActionType === "suspend") &&
      selectedUserIds.length === 0
    ) {
      toast.error("Please select at least one account to restrict");
      return;
    }

    try {
      const token = localStorage.getItem("adminToken");
      let endpoint = "";
      const body: Record<string, unknown> = {
        alertId: selectedInvestigationAlert._id,
        action: investigationActionType,
        userIds: selectedUserIds,
        reason: restrictionReason,
        customReason: customRestrictionReason,
        restrictions: {
          canTrade: !blockTrading,
          canEnterCompetitions: !blockCompetitions,
          canDeposit: !blockDeposit,
          canWithdraw: !blockWithdraw,
        },
      };

      if (investigationActionType === "suspend") {
        // Calculate suspension duration in milliseconds
        const durationMs =
          suspendDuration *
          (suspendUnit === "hours"
            ? 3600000
            : suspendUnit === "days"
              ? 86400000
              : 604800000); // weeks
        body.suspendUntil = new Date(Date.now() + durationMs).toISOString();
        endpoint = "/api/fraud/investigation/suspend";
      } else if (investigationActionType === "ban") {
        endpoint = "/api/fraud/investigation/ban";
      } else if (investigationActionType === "dismiss") {
        endpoint = "/api/fraud/investigation/dismiss";
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setShowInvestigationDialog(false);
        setSelectedInvestigationAlert(null);
        setInvestigationActionType(null);
        setSelectedUserIds([]);
        // Refresh alerts
        await fetchAlerts();
      } else {
        toast.error(data.message || "Failed to perform action");
      }
    } catch (error) {
      console.error("Error performing investigation action:", error);
      toast.error("Failed to perform action");
    }
  };

  const handleElevateToInvestigation = async (alertId: string) => {
    try {
      await handleUpdateAlertStatus(
        alertId,
        "investigating",
        "none",
        "Elevated to Investigation Center for detailed review",
      );
      toast.success("Alert elevated to Investigation Center");
      await fetchAlerts();
    } catch (error) {
      console.error("Error elevating alert:", error);
      toast.error("Failed to elevate alert");
    }
  };

  const handleUpdateAlertStatus = async (
    alertId: string,
    status: string,
    actionTaken?: string,
    resolution?: string,
  ) => {
    try {
      const response = await fetch(`/api/fraud/alerts/${alertId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, actionTaken, resolution }),
      });

      if (response.ok) {
        toast.success(`Alert ${status}`);
        fetchAlerts();
        setDetailsDialogOpen(false);
      } else {
        toast.error("Failed to update alert");
      }
    } catch (error) {
      console.error("Error updating alert:", error);
      toast.error("Error updating alert");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/20 text-red-500 border-red-500/30";
      case "high":
        return "bg-orange-500/20 text-orange-500 border-orange-500/30";
      case "medium":
        return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
      case "low":
        return "bg-blue-500/20 text-blue-500 border-blue-500/30";
      default:
        return "bg-gray-500/20 text-gray-500 border-gray-500/30";
    }
  };

  const getAlertTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      same_device: "Same Device",
      same_ip: "Same IP",
      mirror_trading: "Mirror Trading",
      same_payment: "Same Payment",
      coordinated_entry: "Coordinated Entry",
      suspicious_behavior: "Suspicious Behavior",
      vpn_usage: "VPN Usage",
      high_risk_device: "High Risk Device",
    };
    const labelsMap = new Map(Object.entries(labels));
    return labelsMap.get(type) || type;
  };

  const filteredAlerts = alerts.filter((alert) => {
    // First filter by status - exclude 'investigating' from alerts tab (they appear in Investigation Center)
    const statusMatch =
      statusFilter === "all"
        ? alert.status !== "investigating" // Exclude investigating alerts from Fraud Alerts tab
        : alert.status === statusFilter;

    if (!statusMatch) return false;

    // Then filter by search query
    return (
      alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.primaryUserId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.suspiciousUserIds.some((id) =>
        id.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-100 flex items-center gap-2">
            <Shield className="h-8 w-8 text-red-500" />
            Fraud Monitoring
          </h2>
          <p className="text-gray-400 mt-1">
            Detect and prevent multi-accounting and fraudulent activity
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowResetDialog(true)}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Reset All Security Data
          </Button>
          <Button
            onClick={() => {
              fetchAlerts();
              fetchDevices();
            }}
            variant="outline"
            className="bg-gray-800 border-gray-700 hover:bg-gray-700"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && deviceStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gray-900 border-red-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Critical Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">
                {stats.critical}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Require immediate attention
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-orange-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-500" />
                Pending Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500">
                {stats.pending}
              </div>
              <p className="text-xs text-gray-500 mt-1">Awaiting review</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-blue-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                Investigation Center
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-500">
                {stats.investigating}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Active investigations
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-green-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Resolved Cases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">
                {stats.resolved + stats.dismissed}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Closed investigations
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="alerts" className="w-full">
        <TabsList className="bg-gray-800 border-gray-700">
          <TabsTrigger
            value="alerts"
            className="data-[state=active]:bg-gray-700"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Fraud Alerts
            {stats && stats.pending > 0 && (
              <Badge className="ml-2 bg-yellow-500/20 text-yellow-400 text-xs">
                {stats.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="investigation"
            className="data-[state=active]:bg-gray-700"
          >
            <Activity className="h-4 w-4 mr-2" />
            Investigation Center
          </TabsTrigger>
          <TabsTrigger
            value="resolved"
            className="data-[state=active]:bg-gray-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Resolved
            {stats && stats.resolved + stats.dismissed > 0 && (
              <Badge className="ml-2 bg-green-500/20 text-green-400 text-xs">
                {stats.resolved + stats.dismissed}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="restricted"
            className="data-[state=active]:bg-gray-700"
          >
            <Ban className="h-4 w-4 mr-2" />
            Restricted Users
          </TabsTrigger>
          <TabsTrigger
            value="manual-check"
            className="data-[state=active]:bg-gray-700"
          >
            <Search className="h-4 w-4 mr-2" />
            Manual Check
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="data-[state=active]:bg-gray-700"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger
            value="debug"
            className="data-[state=active]:bg-gray-700"
          >
            <Bug className="h-4 w-4 mr-2" />
            Debug
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-gray-700"
          >
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by user ID or alert title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-gray-100"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
                <SelectItem value="all">All Statuses</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Alerts List */}
          <div className="space-y-3">
            {filteredAlerts.length === 0 ? (
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="py-12 text-center">
                  <Shield className="h-12 w-12 mx-auto text-gray-600 mb-3" />
                  <p className="text-gray-400">No fraud alerts found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {statusFilter
                      ? "Try changing the status filter"
                      : "All clear! No suspicious activity detected."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredAlerts.map((alert) => (
                <Card
                  key={alert._id}
                  className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          {/* Status Badge */}
                          <Badge
                            className={
                              alert.status === "pending"
                                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                : alert.status === "investigating"
                                  ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                  : alert.status === "resolved"
                                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                                    : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                            }
                          >
                            {alert.status === "pending"
                              ? "⏳ Pending"
                              : alert.status === "investigating"
                                ? "🔍 Investigating"
                                : alert.status === "resolved"
                                  ? "✓ Resolved"
                                  : "✕ Dismissed"}
                          </Badge>
                          <Badge className={getSeverityColor(alert.severity)}>
                            {alert.severity.toUpperCase()}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-gray-600 text-gray-400"
                          >
                            {getAlertTypeLabel(alert.alertType)}
                          </Badge>
                          {/* Show Cleared badge if user can trigger new alerts */}
                          {alert.investigationClearedAt && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                              <Unlock className="h-3 w-3 mr-1" />
                              Cleared
                            </Badge>
                          )}
                          {/* Detection count badge */}
                          {(alert.detectionCount || 1) > 1 && (
                            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                              🔄 {alert.detectionCount}x detected
                            </Badge>
                          )}
                          {/* Previous alerts badge */}
                          {(alert.previousAlertCount || 0) > 0 && (
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                              📜 {alert.previousAlertCount} prev alerts
                            </Badge>
                          )}
                          <span className="text-xs text-gray-500">
                            {new Date(alert.detectedAt).toLocaleString()}
                          </span>
                        </div>

                        <h3 className="text-lg font-semibold text-gray-100 mb-1">
                          {computeAlertTitle(alert)}
                        </h3>

                        <p className="text-sm text-gray-400 mb-3">
                          {computeAlertDescription(alert)}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {getAccountsInvolved(alert)} accounts
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {Math.round(alert.confidence * 100)}% confidence
                          </span>
                          {(alert.detectionCount || 1) > 1 && (
                            <span className="flex items-center gap-1 text-orange-400">
                              🔄 Detected {alert.detectionCount} times
                            </span>
                          )}
                          {alert.evidence?.[0]?.data?.totalActivities && (
                            <span className="flex items-center gap-1 text-blue-400">
                              <TrendingUp className="h-3 w-3" />
                              {alert.evidence[0].data.totalActivities}{" "}
                              activities
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedAlert(alert);
                            setDetailsDialogOpen(true);
                          }}
                          className="bg-gray-700 border-gray-600 hover:bg-gray-600"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                        {alert.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleElevateToInvestigation(alert._id)
                            }
                            className="bg-blue-600/20 border-blue-500/50 text-blue-400 hover:bg-blue-600/30"
                          >
                            <Activity className="h-4 w-4 mr-1" />
                            Investigate
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Investigation Center Tab */}
        <TabsContent value="investigation" className="space-y-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-100 flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Investigation Center
              </CardTitle>
              <CardDescription className="text-gray-400">
                Alerts elevated for detailed investigation - Take action on
                suspicious accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.filter((a) => a.status === "investigating").length ===
                0 ? (
                  <div className="py-12 text-center">
                    <Activity className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg font-medium">
                      No cases under investigation
                    </p>
                    <p className="text-gray-500 text-sm mt-2">
                      Elevate alerts from the &quot;Fraud Alerts&quot; tab to investigate
                      them here
                    </p>
                  </div>
                ) : (
                  alerts
                    .filter((a) => a.status === "investigating")
                    .map((alert) => {
                      // Fetch scores for this alert (if not already cached)
                      if (!getFraudScore(alert.primaryUserId)) {
                        fetchScoresForAlert(alert);
                      }

                      return (
                        <Card
                          key={alert._id}
                          className="bg-gray-900 border-gray-700"
                        >
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between gap-6">
                              {/* Alert Info */}
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                  <Badge
                                    className={getSeverityColor(alert.severity)}
                                  >
                                    {alert.severity.toUpperCase()}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className="border-blue-500/30 text-blue-400"
                                  >
                                    <Activity className="h-3 w-3 mr-1" />
                                    INVESTIGATING
                                  </Badge>
                                  {/* Fraud Score Badge */}
                                  {(() => {
                                    const primaryScore = getFraudScore(
                                      alert.primaryUserId,
                                    );
                                    if (primaryScore) {
                                      return (
                                        <Badge
                                          className={getRiskBadgeColor(
                                            primaryScore.riskLevel,
                                          )}
                                          title={`Fraud Score: ${primaryScore.totalScore}%`}
                                        >
                                          📊 {primaryScore.totalScore}%
                                        </Badge>
                                      );
                                    }
                                    return null;
                                  })()}
                                  <span className="text-xs text-gray-500">
                                    {new Date(
                                      alert.detectedAt,
                                    ).toLocaleString()}
                                  </span>
                                </div>

                                <h3 className="text-xl font-semibold text-gray-100 mb-2">
                                  {computeAlertTitle(alert)}
                                </h3>

                                <p className="text-sm text-gray-400 mb-4">
                                  {computeAlertDescription(alert)}
                                </p>

                                <div className="flex items-center gap-6 text-sm text-gray-500">
                                  <span className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    <strong className="text-gray-100">
                                      {getAccountsInvolved(alert)}
                                    </strong>{" "}
                                    suspicious accounts
                                  </span>
                                  <span className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4" />
                                    <strong className="text-gray-100">
                                      {Math.round(alert.confidence * 100)}%
                                    </strong>{" "}
                                    confidence
                                  </span>
                                  {alert.evidence?.[0]?.data
                                    ?.totalActivities && (
                                    <span className="flex items-center gap-2 text-blue-400">
                                      <Activity className="h-4 w-4" />
                                      <strong>
                                        {alert.evidence[0].data.totalActivities}
                                      </strong>{" "}
                                      activities
                                    </span>
                                  )}
                                </div>

                                {/* User IDs */}
                                <div className="mt-4 pt-4 border-t border-gray-700">
                                  <p className="text-xs text-gray-500 mb-2">
                                    Suspicious Accounts:
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {alert.suspiciousUserIds
                                      .slice(0, 3)
                                      .map((userId, _idx) => (
                                        <span
                                          key={userId}
                                          className="text-xs font-mono bg-gray-800 text-gray-300 px-2 py-1 rounded"
                                        >
                                          {userId.substring(0, 12)}...
                                        </span>
                                      ))}
                                    {alert.suspiciousUserIds.length > 3 && (
                                      <span className="text-xs text-gray-500 px-2 py-1">
                                        +{alert.suspiciousUserIds.length - 3}{" "}
                                        more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex flex-col gap-3 min-w-[140px]">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedAlert(alert);
                                    setDetailsDialogOpen(true);
                                  }}
                                  className="bg-gray-700 border-gray-600 hover:bg-gray-600 w-full"
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View Details
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    const score = await fetchFraudScore(
                                      alert.primaryUserId,
                                    );
                                    if (score) {
                                      setSelectedScoreUserId(
                                        alert.primaryUserId,
                                      );
                                      setShowScoreDialog(true);
                                    } else {
                                      toast.error(
                                        "No fraud score available for this user",
                                      );
                                    }
                                  }}
                                  className="bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20 w-full"
                                >
                                  📊 View Score
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleInvestigationAction(alert, "suspend")
                                  }
                                  className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 w-full"
                                >
                                  <Clock className="h-4 w-4 mr-1" />
                                  Suspend
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleInvestigationAction(alert, "ban")
                                  }
                                  className="border-red-500/30 text-red-500 hover:bg-red-500/10 w-full"
                                >
                                  <Ban className="h-4 w-4 mr-1" />
                                  Ban All
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleInvestigationAction(alert, "dismiss")
                                  }
                                  className="border-green-500/30 text-green-500 hover:bg-green-500/10 w-full"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Dismiss
                                </Button>

                                {/* Unlock button for brute_force alerts */}
                                {alert.alertType === "brute_force" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleUnlockAccount(alert)}
                                    disabled={unlockingAccount === alert._id}
                                    className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 w-full"
                                  >
                                    {unlockingAccount === alert._id ? (
                                      <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                                    ) : (
                                      <Unlock className="h-4 w-4 mr-1" />
                                    )}
                                    Unlock Account
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <FraudSettingsSection />
        </TabsContent>

        {/* Resolved Tab - Shows dismissed and resolved alerts */}
        <TabsContent value="resolved" className="space-y-4">
          <div className="p-4 bg-green-900/20 border border-green-700/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <h3 className="text-lg font-semibold text-green-400">
                Resolved & Dismissed Alerts
              </h3>
            </div>
            <p className="text-sm text-gray-400">
              These alerts have been reviewed and handled.{" "}
              <strong className="text-green-400">
                If users were later unbanned/unsuspended
              </strong>
              , new fraud activity will generate{" "}
              <strong className="text-white">NEW alerts</strong>. Look for the{" "}
              <span className="text-green-400">✓ Cleared</span> badge to see
              which users can trigger new alerts.
            </p>
          </div>

          <div className="space-y-4">
            {alerts.filter(
              (a) => a.status === "resolved" || a.status === "dismissed",
            ).length === 0 ? (
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">
                    No resolved or dismissed alerts
                  </p>
                </CardContent>
              </Card>
            ) : (
              alerts
                .filter(
                  (a) => a.status === "resolved" || a.status === "dismissed",
                )
                .map((alert) => (
                  <Card key={alert._id} className="bg-gray-800 border-gray-700">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <Badge
                              className={
                                alert.status === "resolved"
                                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                                  : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                              }
                            >
                              {alert.status === "resolved"
                                ? "✓ Resolved"
                                : "✕ Dismissed"}
                            </Badge>
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 capitalize">
                              {alert.alertType.replace(/_/g, " ")}
                            </Badge>
                            {/* Show "Cleared" badge if users were unbanned/unsuspended */}
                            {alert.investigationClearedAt && (
                              <Badge
                                className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                title={`Cleared on: ${new Date(alert.investigationClearedAt).toLocaleDateString()}`}
                              >
                                <Unlock className="h-3 w-3 mr-1" />
                                Cleared - Can Alert Again
                              </Badge>
                            )}
                            {alert.competitionId && (
                              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                                Competition:{" "}
                                {alert.competitionId.substring(0, 8)}
                                ...
                              </Badge>
                            )}
                          </div>
                          <h4 className="text-lg font-semibold text-gray-100">
                            {computeAlertTitle(alert)}
                          </h4>
                          <p className="text-sm text-gray-400 mt-1">
                            {computeAlertDescription(alert)}
                          </p>

                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {getAccountsInvolved(alert)} accounts
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Resolved:{" "}
                              {new Date(
                                alert.resolvedAt || alert.updatedAt || alert.detectedAt,
                              ).toLocaleDateString()}
                            </span>
                            {alert.actionTaken && (
                              <span className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                Action: {alert.actionTaken.replace(/_/g, " ")}
                              </span>
                            )}
                            {alert.investigationClearedAt && (
                              <span className="flex items-center gap-1 text-emerald-400">
                                <Unlock className="h-3 w-3" />
                                Cleared:{" "}
                                {new Date(
                                  alert.investigationClearedAt,
                                ).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-gray-700 border-gray-600 hover:bg-gray-600 text-gray-300"
                          onClick={() => {
                            setSelectedAlert(alert);
                            setDetailsDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </TabsContent>

        {/* Restricted Users Tab */}
        <TabsContent value="restricted" className="space-y-4">
          <RestrictedUsersSection />
        </TabsContent>

        {/* Manual Check Tab */}
        <TabsContent value="manual-check" className="space-y-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-lg text-gray-100 flex items-center gap-2">
                <Search className="h-5 w-5 text-blue-400" />
                Manual User Check
              </CardTitle>
              <CardDescription className="text-gray-400">
                Enter a user email or user ID to run a full fraud check and view
                all available data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">User Email</Label>
                  <Input
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="user@email.com"
                    className="bg-gray-900 border-gray-700 text-gray-100 mt-2"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">User ID</Label>
                  <Input
                    value={manualUserId}
                    onChange={(e) => setManualUserId(e.target.value)}
                    placeholder="user id or ObjectId"
                    className="bg-gray-900 border-gray-700 text-gray-100 mt-2"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={runManualCheck}
                  disabled={manualLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {manualLoading ? "Checking..." : "Run Manual Check"}
                </Button>
                {manualError && (
                  <span className="text-sm text-red-400">{manualError}</span>
                )}
              </div>
            </CardContent>
          </Card>

          {manualResult && (
            <div className="space-y-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-base text-gray-100">
                    Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-300">
                  <div>
                    Alerts:{" "}
                    <span className="text-white">
                      {manualResult.summary.alertsTotal}
                    </span>
                  </div>
                  <div>
                    Pending:{" "}
                    <span className="text-yellow-400">
                      {manualResult.summary.alertsPending}
                    </span>
                  </div>
                  <div>
                    Investigating:{" "}
                    <span className="text-blue-400">
                      {manualResult.summary.alertsInvestigating}
                    </span>
                  </div>
                  <div>
                    Devices:{" "}
                    <span className="text-white">
                      {manualResult.summary.devicesTotal}
                    </span>
                  </div>
                  <div>
                    High Risk Devices:{" "}
                    <span className="text-red-400">
                      {manualResult.summary.devicesHighRisk}
                    </span>
                  </div>
                  <div>
                    Active Restrictions:{" "}
                    <span className="text-red-400">
                      {manualResult.summary.restrictionsActive}
                    </span>
                  </div>
                  <div>
                    Active Lockouts:{" "}
                    <span className="text-red-400">
                      {manualResult.summary.lockoutsActive}
                    </span>
                  </div>
                  <div>
                    Payment Fingerprints:{" "}
                    <span className="text-white">
                      {manualResult.summary.paymentFingerprintsTotal}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-base text-gray-100">
                    User Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-300 space-y-1">
                  <div>
                    <span className="text-gray-400">ID:</span>{" "}
                    {String(
                      manualResult.user.id || manualResult.user._id || "",
                    )}
                  </div>
                  <div>
                    <span className="text-gray-400">Email:</span>{" "}
                    {String(manualResult.user.email || "")}
                  </div>
                  <div>
                    <span className="text-gray-400">Name:</span>{" "}
                    {String(manualResult.user.name || "")}
                  </div>
                  <div>
                    <span className="text-gray-400">Role:</span>{" "}
                    {String(manualResult.user.role || "")}
                  </div>
                  <div>
                    <span className="text-gray-400">Country:</span>{" "}
                    {String(manualResult.user.country || "")}
                  </div>
                  <div>
                    <span className="text-gray-400">City:</span>{" "}
                    {String(manualResult.user.city || "")}
                  </div>
                </CardContent>
              </Card>

              {/* Structured manual check result — replaces raw JSON */}
              <ManualCheckResultPanel result={manualResult} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="debug" className="space-y-4">
          <FraudDebugger />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <FraudHistorySection />
        </TabsContent>
      </Tabs>

      {/* Alert Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent
          className="bg-gray-900 border-gray-700 text-gray-100 max-w-[98vw] w-[98vw] max-h-[92vh] overflow-y-auto"
          style={{ maxWidth: "98vw", width: "98vw" }}
        >
          {selectedAlert && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl text-gray-100 flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                  {computeAlertTitle(selectedAlert)}
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  {computeAlertDescription(selectedAlert)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4 px-2">
                {/* Alert Info */}
                <div className="grid grid-cols-4 gap-8">
                  <div>
                    <Label className="text-gray-400 text-sm">Severity</Label>
                    <Badge
                      className={`${getSeverityColor(selectedAlert.severity)} mt-1`}
                    >
                      {selectedAlert.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Type</Label>
                    <p className="text-gray-100 mt-1">
                      {getAlertTypeLabel(selectedAlert.alertType)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Confidence</Label>
                    <p className="text-gray-100 mt-1">
                      {Math.round(selectedAlert.confidence * 100)}%
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Detected</Label>
                    <p className="text-gray-100 mt-1">
                      {new Date(selectedAlert.detectedAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Detection Count Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-gradient-to-r from-orange-900/30 to-yellow-900/30 rounded-lg border border-orange-500/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-orange-400 uppercase font-semibold">
                          Times Detected
                        </p>
                        <p className="text-3xl font-bold text-orange-300">
                          {selectedAlert.detectionCount || 1}
                        </p>
                        <p className="text-xs text-gray-500">for this alert</p>
                      </div>
                      <div className="text-orange-400 text-4xl">🔄</div>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg border border-purple-500/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-purple-400 uppercase font-semibold">
                          Previous Alerts
                        </p>
                        <p className="text-3xl font-bold text-purple-300">
                          {selectedAlert.previousAlertCount || 0}
                        </p>
                        <p className="text-xs text-gray-500">
                          dismissed/resolved
                        </p>
                      </div>
                      <div className="text-purple-400 text-4xl">📜</div>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-red-900/30 to-pink-900/30 rounded-lg border border-red-500/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-red-400 uppercase font-semibold">
                          Total Alerts Ever
                        </p>
                        <p className="text-3xl font-bold text-red-300">
                          {(selectedAlert.previousAlertCount || 0) + 1}
                        </p>
                        <p className="text-xs text-gray-500">for these users</p>
                      </div>
                      <div className="text-red-400 text-4xl">⚠️</div>
                    </div>
                  </div>
                </div>

                {/* ─── Tabbed Evidence Detail View ────────────── */}
                <FraudAlertDetailTabs
                  alert={selectedAlert}
                  onCloseDialog={() => setDetailsDialogOpen(false)}
                />
              </div>

              <DialogFooter className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    handleUpdateAlertStatus(selectedAlert._id, "dismissed")
                  }
                  className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Dismiss
                </Button>
                <Button
                  onClick={() =>
                    handleElevateToInvestigation(selectedAlert._id)
                  }
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Elevate to Investigation
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Device Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-2xl text-gray-100 flex items-center gap-3">
              {actionType === "dismiss" && (
                <CheckCircle className="h-6 w-6 text-green-500" />
              )}
              {actionType === "suspend" && (
                <UserX className="h-6 w-6 text-yellow-500" />
              )}
              {actionType === "ban" && <Ban className="h-6 w-6 text-red-500" />}
              {actionType === "dismiss"
                ? "Dismiss Device"
                : actionType === "suspend"
                  ? "Suspend Device"
                  : "Ban Device"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {actionType === "dismiss" &&
                "Mark this device as safe and dismiss all related alerts."}
              {actionType === "suspend" &&
                "Suspend all users linked to this device for manual review."}
              {actionType === "ban" &&
                "Permanently ban all users linked to this device."}
            </DialogDescription>
          </DialogHeader>

          {selectedDevice && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-gray-800 rounded border border-gray-700">
                <p className="text-sm text-gray-400 mb-2">
                  <strong>{selectedDevice.linkedUserIds.length + 1}</strong>{" "}
                  user(s) will be affected
                </p>
                <p className="text-xs text-gray-500 font-mono">
                  Device: {selectedDevice.browser} on {selectedDevice.os}
                </p>
              </div>

              <div>
                <Label htmlFor="reason" className="text-gray-300">
                  Reason (Optional)
                </Label>
                <Textarea
                  id="reason"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Enter reason for this action..."
                  className="mt-2 bg-gray-800 border-gray-700 text-gray-100"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowActionDialog(false)}
              className="bg-gray-800 border-gray-700 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={executeDeviceAction}
              className={
                actionType === "dismiss"
                  ? "bg-green-600 hover:bg-green-700"
                  : actionType === "suspend"
                    ? "bg-yellow-600 hover:bg-yellow-700"
                    : "bg-red-600 hover:bg-red-700"
              }
            >
              Confirm{" "}
              {actionType === "dismiss"
                ? "Dismissal"
                : actionType === "suspend"
                  ? "Suspension"
                  : "Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Investigation Action Dialog */}
      <Dialog
        open={showInvestigationDialog}
        onOpenChange={setShowInvestigationDialog}
      >
        <DialogContent className="bg-gray-900 border-gray-700 text-gray-100 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl text-gray-100 flex items-center gap-3">
              {investigationActionType === "dismiss" && (
                <CheckCircle className="h-6 w-6 text-green-500" />
              )}
              {investigationActionType === "suspend" && (
                <Clock className="h-6 w-6 text-yellow-500" />
              )}
              {investigationActionType === "ban" && (
                <Ban className="h-6 w-6 text-red-500" />
              )}
              {investigationActionType === "dismiss"
                ? "Dismiss Investigation"
                : investigationActionType === "suspend"
                  ? "Suspend Accounts"
                  : "Ban Accounts"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {investigationActionType === "dismiss" &&
                "Mark this case as resolved and close the investigation."}
              {investigationActionType === "suspend" &&
                "Temporarily suspend all suspicious accounts for a specified duration."}
              {investigationActionType === "ban" &&
                "Permanently ban all suspicious accounts from the platform."}
            </DialogDescription>
          </DialogHeader>

          {selectedInvestigationAlert && (
            <div className="space-y-4 py-4">
              {/* Account Selection */}
              {(investigationActionType === "ban" ||
                investigationActionType === "suspend") && (
                <div className="p-4 bg-gray-800 rounded border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-300 font-semibold">
                      Select Accounts to Restrict
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setSelectedUserIds(
                            selectedInvestigationAlert.suspiciousUserIds,
                          )
                        }
                        className="text-xs"
                      >
                        Select All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedUserIds([])}
                        className="text-xs"
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedInvestigationAlert.suspiciousUserIds.map(
                      (userId) => (
                        <label
                          key={userId}
                          className="flex items-center gap-3 p-2 hover:bg-gray-700 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(userId)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserIds([
                                  ...selectedUserIds,
                                  userId,
                                ]);
                              } else {
                                setSelectedUserIds(
                                  selectedUserIds.filter((id) => id !== userId),
                                );
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-xs text-gray-300 font-mono flex-1">
                            {userId}
                          </span>
                        </label>
                      ),
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {selectedUserIds.length} of{" "}
                    {selectedInvestigationAlert.suspiciousUserIds.length}{" "}
                    accounts selected
                  </p>
                </div>
              )}

              {/* Restriction Settings */}
              {(investigationActionType === "ban" ||
                investigationActionType === "suspend") && (
                <>
                  <div className="space-y-3">
                    <Label className="text-gray-300 text-sm font-semibold">
                      Restriction Reason
                    </Label>
                    <Select
                      value={restrictionReason}
                      onValueChange={setRestrictionReason}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="multi_accounting">
                          Multi-Accounting
                        </SelectItem>
                        <SelectItem value="fraud">Fraud</SelectItem>
                        <SelectItem value="terms_violation">
                          Terms Violation
                        </SelectItem>
                        <SelectItem value="payment_fraud">
                          Payment Fraud
                        </SelectItem>
                        <SelectItem value="suspicious_activity">
                          Suspicious Activity
                        </SelectItem>
                        <SelectItem value="admin_decision">
                          Admin Decision
                        </SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300 text-sm font-semibold">
                      Custom Message (shown to user)
                    </Label>
                    <Textarea
                      value={customRestrictionReason}
                      onChange={(e) =>
                        setCustomRestrictionReason(e.target.value)
                      }
                      placeholder="Optional: Explain why this restriction was applied..."
                      className="bg-gray-800 border-gray-700 text-gray-100"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-3 p-4 bg-gray-800 rounded border border-gray-700">
                    <Label className="text-gray-300 text-sm font-semibold">
                      Block These Actions:
                    </Label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={blockTrading}
                          onChange={(e) => setBlockTrading(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-300">Trading</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={blockCompetitions}
                          onChange={(e) =>
                            setBlockCompetitions(e.target.checked)
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-300">
                          Enter Competitions
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={blockDeposit}
                          onChange={(e) => setBlockDeposit(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-300">Deposits</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={blockWithdraw}
                          onChange={(e) => setBlockWithdraw(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-300">
                          Withdrawals
                        </span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {investigationActionType === "suspend" && (
                <div className="p-4 bg-yellow-900/20 border border-yellow-700/30 rounded">
                  <Label className="text-gray-300 text-sm font-semibold mb-3 block">
                    Suspension Duration
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min="1"
                      max="365"
                      value={suspendDuration}
                      onChange={(e) =>
                        setSuspendDuration(parseInt(e.target.value) || 1)
                      }
                      className="bg-gray-800 border-gray-700 text-gray-100 w-24"
                    />
                    <Select
                      value={suspendUnit}
                      onValueChange={(value: "hours" | "days" | "weeks") =>
                        setSuspendUnit(value)
                      }
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-gray-100 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                        <SelectItem value="weeks">Weeks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Accounts will be suspended until:{" "}
                    <strong className="text-yellow-400">
                      {new Date(
                        Date.now() +
                          suspendDuration *
                            (suspendUnit === "hours"
                              ? 3600000
                              : suspendUnit === "days"
                                ? 86400000
                                : 604800000),
                      ).toLocaleString()}
                    </strong>
                  </p>
                </div>
              )}

              {investigationActionType === "ban" && (
                <div className="p-4 bg-red-900/20 border border-red-700/30 rounded">
                  <AlertTriangle className="h-5 w-5 text-red-500 mb-2" />
                  <p className="text-sm text-red-400 font-semibold">
                    Warning: This action is permanent!
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Banned accounts will be immediately logged out and unable to
                    access the platform.
                  </p>
                </div>
              )}

              {investigationActionType === "dismiss" && (
                <div className="p-4 bg-green-900/20 border border-green-700/30 rounded">
                  <p className="text-sm text-green-400">
                    This will mark the alert as resolved and close the
                    investigation. The alert will move to &quot;Dismissed&quot; status.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInvestigationDialog(false)}
              className="bg-gray-800 border-gray-700 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={executeInvestigationAction}
              className={
                investigationActionType === "dismiss"
                  ? "bg-green-600 hover:bg-green-700"
                  : investigationActionType === "suspend"
                    ? "bg-yellow-600 hover:bg-yellow-700"
                    : "bg-red-600 hover:bg-red-700"
              }
            >
              Confirm{" "}
              {investigationActionType === "dismiss"
                ? "Dismissal"
                : investigationActionType === "suspend"
                  ? "Suspension"
                  : "Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset All Security Data Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-gray-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl text-gray-100 flex items-center gap-3">
              <AlertOctagon className="h-6 w-6 text-red-500" />
              Reset All Security Data
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              This will permanently delete ALL security and fraud data, and
              reset settings to defaults.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-red-900/20 border border-red-700/30 rounded">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-red-400 font-semibold mb-2">
                    ⚠️ WARNING: This action cannot be undone!
                  </p>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• All fraud alerts will be deleted</li>
                    <li>• All fraud history will be deleted</li>
                    <li>• All suspicion scores will be deleted</li>
                    <li>• All device fingerprints will be deleted</li>
                    <li>• All payment fingerprints will be deleted</li>
                    <li>• All behavioral profiles will be deleted</li>
                    <li>• All security logs will be deleted</li>
                    <li>• All account lockouts will be cleared</li>
                    <li>• Fraud settings will be reset to defaults</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="resetPassword" className="text-gray-300">
                Admin Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="resetPassword"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Enter your admin password to confirm"
                className="mt-2 bg-gray-800 border-gray-700 text-gray-100"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowResetDialog(false);
                setResetPassword("");
              }}
              className="bg-gray-800 border-gray-700 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetAllSecurityData}
              disabled={!resetPassword}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Reset All Security Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fraud Score Dialog (Full Screen) */}
      <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
        <DialogContent
          className="!max-w-none !w-[95vw] !h-[95vh] !p-6 bg-gray-900 border-gray-700 overflow-y-auto"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">
            Fraud Detection Score Details
          </DialogTitle>
          {(() => {
            const scoreData = selectedScoreUserId ? getFraudScore(selectedScoreUserId) : null;
            return scoreData ? (
            <>
              <SuspicionScoreCard
                score={scoreData}
                onScoreUpdated={(newScore) => {
                  if (selectedScoreUserId) {
                    setFraudScores((prev) => ({
                      ...prev,
                      [selectedScoreUserId]: newScore as FraudScore,
                    }));
                  }
                }}
              />

              {/* Close Button */}
              <div className="flex justify-end mt-6 pt-6 border-t border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => setShowScoreDialog(false)}
                  className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                >
                  Close
                </Button>
              </div>
            </>
          ) : selectedScoreUserId ? (
            <>
              <div className="py-24 text-center">
                <Shield className="h-20 w-20 text-gray-600 mx-auto mb-6" />
                <h3 className="text-2xl text-gray-400 font-semibold mb-2">
                  No Fraud Score Available
                </h3>
                <p className="text-gray-600">
                  This account has not triggered any fraud detection yet
                </p>
              </div>
              <div className="flex justify-end mt-6 pt-6 border-t border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => setShowScoreDialog(false)}
                  className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                >
                  Close
                </Button>
              </div>
            </>
          ) : null;
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
