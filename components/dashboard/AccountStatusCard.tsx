"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Ban,
  Clock,
  ChevronDown,
  CreditCard,
  TrendingUp,
  Trophy,
  Wallet,
  FileWarning,
  Eye,
  Fingerprint,
} from "lucide-react";
import type { ComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";

type AccountStatus = ComprehensiveDashboardData["accountStatus"];

interface AccountStatusCardProps {
  accountStatus: AccountStatus;
}

// Reason: Human-readable labels for restriction reasons from the fraud system
const RESTRICTION_REASON_LABELS: Record<string, string> = {
  multi_accounting: "Multi-Accounting Detected",
  fraud: "Fraud",
  terms_violation: "Terms Violation",
  payment_fraud: "Payment Fraud",
  suspicious_activity: "Suspicious Activity",
  admin_decision: "Admin Decision",
  automated_fraud_detection: "Automated Fraud Detection",
  kyc_failed: "KYC Verification Failed",
  kyc_fraud: "KYC Fraud Detected",
  other: "Other",
};

// Reason: Human-readable labels for fraud alert types
const ALERT_TYPE_LABELS: Record<string, string> = {
  same_device: "Same Device",
  same_ip: "Same IP Address",
  same_ip_browser: "Same IP & Browser",
  mirror_trading: "Mirror Trading",
  same_payment: "Same Payment Method",
  coordinated_entry: "Coordinated Entry",
  suspicious_behavior: "Suspicious Behavior",
  vpn_usage: "VPN/Proxy Usage",
  high_risk_device: "High-Risk Device",
  duplicate_kyc: "Duplicate KYC Document",
  brute_force: "Brute Force Attempts",
  rate_limit_exceeded: "Rate Limit Exceeded",
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  low: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", glow: "rgba(59,130,246,0.15)" },
  medium: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30", glow: "rgba(234,179,8,0.15)" },
  high: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30", glow: "rgba(249,115,22,0.2)" },
  critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", glow: "rgba(239,68,68,0.25)" },
};

const LOCKOUT_REASON_LABELS: Record<string, string> = {
  failed_login: "Too Many Failed Logins",
  suspicious_activity: "Suspicious Activity",
  rate_limit: "Rate Limit Exceeded",
  admin_action: "Admin Action",
  fraud_detection: "Fraud Detection",
};

export default function AccountStatusCard({ accountStatus }: AccountStatusCardProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    restrictions,
    fraudAlerts,
    lockouts,
    kycStatus,
    kycDeclineReason,
    suspicionScore,
    riskLevel,
    hasActiveRestriction,
    hasOpenAlert,
    isLocked,
  } = accountStatus;

  // Reason: If everything is clean, show a minimal "All Clear" card
  const isClean = !hasActiveRestriction && !hasOpenAlert && !isLocked
    && kycStatus !== "declined" && kycStatus !== "resubmission"
    && suspicionScore < 30;

  const totalIssues = restrictions.length + fraudAlerts.length + lockouts.length
    + (kycStatus === "declined" || kycStatus === "resubmission" ? 1 : 0);

  // Overall severity color
  const overallSeverity = hasActiveRestriction
    ? "critical"
    : isLocked
      ? "high"
      : hasOpenAlert
        ? riskLevel === "critical" ? "critical" : riskLevel === "high" ? "high" : "medium"
        : "low";

  const severityStyle = SEVERITY_STYLES[overallSeverity];

  return (
    <motion.div
      className={`relative overflow-hidden rounded-xl border backdrop-blur-sm p-4 ${
        isClean
          ? "border-green-500/20 bg-gradient-to-br from-green-900/10 to-gray-900/80"
          : `${severityStyle.border} bg-gradient-to-br from-gray-800/80 to-gray-900/80`
      }`}
      style={!isClean ? { boxShadow: `0 0 20px ${severityStyle.glow}` } : undefined}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isClean ? (
            <ShieldCheck className="w-5 h-5 text-green-400" />
          ) : (
            <ShieldAlert className={`w-5 h-5 ${severityStyle.text} ${hasActiveRestriction ? "animate-pulse" : ""}`} />
          )}
          <h3 className="text-sm font-semibold text-white">
            Account Status
          </h3>
          {!isClean && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase ${severityStyle.bg} ${severityStyle.text}`}>
              {totalIssues} {totalIssues === 1 ? "issue" : "issues"}
            </span>
          )}
        </div>

        {!isClean && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            {expanded ? "Hide" : "Details"}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {/* Quick Status Icons Row */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {/* Restrictions */}
        {restrictions.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20"
            title={r.customReason || RESTRICTION_REASON_LABELS[r.reason] || r.reason}
          >
            <Ban className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[11px] text-red-300 font-medium">
              {r.type === "banned" ? "Banned" : "Suspended"}
            </span>
            {/* Blocked actions chips */}
            <div className="flex gap-0.5 ml-1">
              {!r.canTrade && <TrendingUp className="w-3 h-3 text-red-500/60" title="Trading blocked" />}
              {!r.canWithdraw && <Wallet className="w-3 h-3 text-red-500/60" title="Withdrawals blocked" />}
              {!r.canDeposit && <CreditCard className="w-3 h-3 text-red-500/60" title="Deposits blocked" />}
              {!r.canEnterCompetitions && <Trophy className="w-3 h-3 text-red-500/60" title="Competitions blocked" />}
            </div>
          </div>
        ))}

        {/* Lockouts */}
        {lockouts.map((l) => (
          <div
            key={l.id}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20"
            title={LOCKOUT_REASON_LABELS[l.reason] || l.reason}
          >
            <Lock className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-[11px] text-orange-300 font-medium">Account Locked</span>
          </div>
        ))}

        {/* Fraud Alerts count */}
        {fraudAlerts.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <Eye className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-[11px] text-yellow-300 font-medium">
              {fraudAlerts.length} Investigation{fraudAlerts.length > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* KYC Issues */}
        {(kycStatus === "declined" || kycStatus === "resubmission") && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Fingerprint className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px] text-purple-300 font-medium">
              KYC {kycStatus === "declined" ? "Declined" : "Resubmission Required"}
            </span>
          </div>
        )}

        {/* All Clear */}
        {isClean && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/20">
            <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
            <span className="text-[11px] text-green-300 font-medium">All Clear — No Issues</span>
          </div>
        )}

        {/* Risk Score Badge */}
        {suspicionScore > 0 && (
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${SEVERITY_STYLES[riskLevel].bg} border ${SEVERITY_STYLES[riskLevel].border}`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${SEVERITY_STYLES[riskLevel].text}`} />
            <span className={`text-[11px] font-medium ${SEVERITY_STYLES[riskLevel].text}`}>
              Risk: {suspicionScore}%
            </span>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && !isClean && (
          <motion.div
            className="mt-4 space-y-3"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Active Restrictions */}
            {restrictions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <Ban className="w-3 h-3" /> Active Restrictions
                </h4>
                {restrictions.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-lg bg-red-500/5 border border-red-500/15 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-red-300">
                        {r.type === "banned" ? "🚫 Account Banned" : "⏸️ Account Suspended"}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(r.restrictedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Reason: {r.customReason || RESTRICTION_REASON_LABELS[r.reason] || r.reason}
                    </p>
                    {r.expiresAt && (
                      <p className="text-[10px] text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expires: {new Date(r.expiresAt).toLocaleDateString()}
                      </p>
                    )}
                    {!r.expiresAt && r.type === "banned" && (
                      <p className="text-[10px] text-red-400/60">Permanent — contact support for appeal</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {[
                        { blocked: !r.canTrade, label: "Trading", icon: TrendingUp },
                        { blocked: !r.canWithdraw, label: "Withdrawals", icon: Wallet },
                        { blocked: !r.canDeposit, label: "Deposits", icon: CreditCard },
                        { blocked: !r.canEnterCompetitions, label: "Competitions", icon: Trophy },
                      ].map(({ blocked, label, icon: Icon }) => (
                        <span
                          key={label}
                          className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                            blocked
                              ? "bg-red-500/10 text-red-400"
                              : "bg-green-500/10 text-green-400"
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          {label}: {blocked ? "Blocked" : "OK"}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Fraud Alerts / Investigations */}
            {fraudAlerts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <FileWarning className="w-3 h-3" /> Active Investigations
                </h4>
                {fraudAlerts.map((a) => {
                  const sev = SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.medium;
                  return (
                    <div
                      key={a.id}
                      className={`p-3 rounded-lg ${sev.bg} border ${sev.border} space-y-1`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${sev.text}`}>
                          {a.title}
                        </span>
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${sev.bg} ${sev.text}`}>
                          {a.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        {a.description}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-gray-500">
                        <span>Type: {ALERT_TYPE_LABELS[a.alertType] || a.alertType}</span>
                        <span>Status: {a.status === "investigating" ? "🔍 Under Investigation" : "⏳ Pending Review"}</span>
                        <span>{new Date(a.detectedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Account Lockouts */}
            {lockouts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> Account Lockouts
                </h4>
                {lockouts.map((l) => (
                  <div
                    key={l.id}
                    className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/15 space-y-1"
                  >
                    <span className="text-xs font-semibold text-orange-300">
                      🔒 {LOCKOUT_REASON_LABELS[l.reason] || l.reason}
                    </span>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                      <span>Locked: {new Date(l.lockedAt).toLocaleDateString()}</span>
                      {l.lockedUntil ? (
                        <span>Unlocks: {new Date(l.lockedUntil).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-orange-400/60">Permanent — contact support</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* KYC Issues */}
            {(kycStatus === "declined" || kycStatus === "resubmission") && (
              <div className="space-y-2">
                <h4 className="text-xs text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <Fingerprint className="w-3 h-3" /> KYC Verification
                </h4>
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/15 space-y-1">
                  <span className="text-xs font-semibold text-purple-300">
                    {kycStatus === "declined" ? "❌ Verification Declined" : "📋 Resubmission Required"}
                  </span>
                  {kycDeclineReason && (
                    <p className="text-[11px] text-gray-400">Reason: {kycDeclineReason}</p>
                  )}
                  <p className="text-[10px] text-gray-500">
                    {kycStatus === "declined"
                      ? "Your identity verification was declined. Please contact support for more information."
                      : "Additional documents are needed. Please resubmit your verification."}
                  </p>
                </div>
              </div>
            )}

            {/* Support Contact */}
            <div className="pt-2 border-t border-gray-700/30">
              <p className="text-[10px] text-gray-500 text-center">
                If you believe this is an error, please{" "}
                <a href="/support" className="text-blue-400 hover:text-blue-300 underline">
                  contact support
                </a>{" "}
                for assistance.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
