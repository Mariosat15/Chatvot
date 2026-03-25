"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
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
  Lock,
  MessageCircle,
  Info,
} from "lucide-react";
import Link from "next/link";
import type { ComprehensiveDashboardData } from "@/lib/actions/comprehensive-dashboard.actions";

type AccountStatus = ComprehensiveDashboardData["accountStatus"];

interface AccountStatusCardProps {
  accountStatus: AccountStatus;
}

// Reason: Customer-friendly explanations for each detection method.
// These are deliberately non-technical and non-alarming.
// Using ReadonlyMap to avoid security/detect-object-injection warnings.
const INVESTIGATION_REASON_EXPLANATIONS: ReadonlyMap<
  string,
  { label: string; explanation: string }
> = new Map([
  [
    "same_device",
    {
      label: "Device Verification",
      explanation:
        "Our system detected that your device may be associated with multiple accounts. This check ensures each account belongs to a unique user.",
    },
  ],
  [
    "same_ip",
    {
      label: "Network Verification",
      explanation:
        "Activity from your network matched patterns that require additional verification to ensure account security.",
    },
  ],
  [
    "same_ip_browser",
    {
      label: "Session Verification",
      explanation:
        "Your browsing session matched patterns that require a brief review to confirm account ownership.",
    },
  ],
  [
    "mirror_trading",
    {
      label: "Trading Pattern Review",
      explanation:
        "Your recent trading activity showed patterns that closely match another account. We review these to maintain fair competition.",
    },
  ],
  [
    "same_payment",
    {
      label: "Payment Method Verification",
      explanation:
        "A payment method linked to your account was also found on another account. This check protects against unauthorized use of your payment details.",
    },
  ],
  [
    "coordinated_entry",
    {
      label: "Competition Entry Review",
      explanation:
        "The timing of your competition entry matched a pattern that we review to ensure all participants compete fairly.",
    },
  ],
  [
    "suspicious_behavior",
    {
      label: "Activity Review",
      explanation:
        "Certain account activity triggered a routine security review. This helps us keep the platform safe for all users.",
    },
  ],
  [
    "vpn_usage",
    {
      label: "Connection Verification",
      explanation:
        "Your connection was routed through a service that can sometimes obscure account origin. We verify these connections as a standard security measure.",
    },
  ],
  [
    "high_risk_device",
    {
      label: "Device Security Check",
      explanation:
        "Your device configuration triggered an automated security check. This is a precautionary measure to protect your account.",
    },
  ],
  [
    "duplicate_kyc",
    {
      label: "Identity Document Review",
      explanation:
        "An identity document associated with your account was flagged for additional review to ensure it has not been used elsewhere.",
    },
  ],
  [
    "brute_force",
    {
      label: "Login Security Check",
      explanation:
        "Multiple login attempts were detected on your account. We review these to protect your account from unauthorized access.",
    },
  ],
  [
    "rate_limit_exceeded",
    {
      label: "Unusual Activity Volume",
      explanation:
        "A higher-than-usual volume of actions was detected on your account. We review this to ensure everything is in order.",
    },
  ],
]);

const LOCKOUT_REASON_LABELS: ReadonlyMap<string, string> = new Map([
  ["failed_login", "Too Many Failed Logins"],
  ["suspicious_activity", "Suspicious Activity"],
  ["rate_limit", "Rate Limit Exceeded"],
  ["admin_action", "Admin Action"],
  ["fraud_detection", "Security Review"],
]);

const RESTRICTION_REASON_LABELS: ReadonlyMap<string, string> = new Map([
  ["multi_accounting", "Account Policy Violation"],
  ["fraud", "Security Concern"],
  ["terms_violation", "Terms of Service"],
  ["payment_fraud", "Payment Security"],
  ["suspicious_activity", "Account Review"],
  ["admin_decision", "Admin Decision"],
  ["automated_fraud_detection", "Automated Security Review"],
  ["kyc_failed", "Identity Verification"],
  ["kyc_fraud", "Identity Verification Issue"],
  ["other", "Account Review"],
]);

export default function AccountStatusCard({
  accountStatus,
}: AccountStatusCardProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    restrictions,
    fraudAlerts,
    lockouts,
    kycStatus,
    kycDeclineReason,
    hasActiveRestriction,
    hasOpenAlert,
    isLocked,
  } = accountStatus;

  // Reason: Only show this card when there is an actual issue the user needs
  // to know about — an active restriction, investigation, lockout, or KYC problem.
  // A suspicion score alone (without an investigation) is internal and should
  // NOT be shown to the customer.
  const hasKycIssue =
    kycStatus === "declined" || kycStatus === "resubmission";
  const hasAnyIssue =
    hasActiveRestriction || hasOpenAlert || isLocked || hasKycIssue;

  if (!hasAnyIssue) {
    return null;
  }

  const totalIssues =
    restrictions.length +
    fraudAlerts.length +
    lockouts.length +
    (hasKycIssue ? 1 : 0);

  // Reason: Collect ALL unique evidence method types across all fraud alerts.
  // Each alert may contain multiple evidence types (e.g., same_device + mirror_trading).
  // We also include the top-level alertType as a fallback.
  const uniqueEvidenceTypes = [
    ...new Set(
      fraudAlerts.flatMap((a) =>
        a.evidenceTypes && a.evidenceTypes.length > 0
          ? a.evidenceTypes
          : [a.alertType],
      ),
    ),
  ];

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl border border-amber-500/30 backdrop-blur-sm bg-gradient-to-br from-gray-800/80 to-gray-900/80 p-4"
      style={{ boxShadow: "0 0 20px rgba(245,158,11,0.12)" }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert
            className={`w-5 h-5 text-amber-400 ${hasActiveRestriction ? "animate-pulse" : ""}`}
          />
          <h3 className="text-sm font-semibold text-white">Account Status</h3>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase bg-amber-500/10 text-amber-400">
            {totalIssues} {totalIssues === 1 ? "issue" : "issues"}
          </span>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {expanded ? "Hide" : "Details"}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Quick Status Badges */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {restrictions.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20"
          >
            <Ban className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[11px] text-red-300 font-medium">
              {r.type === "banned" ? "Restricted" : "Under Review"}
            </span>
          </div>
        ))}

        {lockouts.map((l) => (
          <div
            key={l.id}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20"
          >
            <Lock className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-[11px] text-orange-300 font-medium">
              Temporarily Locked
            </span>
          </div>
        ))}

        {fraudAlerts.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] text-amber-300 font-medium">
              {fraudAlerts.length} Investigation
              {fraudAlerts.length > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {hasKycIssue && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Fingerprint className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px] text-purple-300 font-medium">
              KYC{" "}
              {kycStatus === "declined"
                ? "Declined"
                : "Resubmission Required"}
            </span>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="mt-4 space-y-4"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* ── Active Investigations ── */}
            {fraudAlerts.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <FileWarning className="w-3 h-3" /> Active Investigations
                </h4>

                {/* Reassurance Notice */}
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/15">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-blue-200 font-medium">
                        This is a standard security review
                      </p>
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        As part of our commitment to maintaining a fair and
                        secure platform for all users, our automated systems
                        periodically review account activity. This does not
                        necessarily mean any wrongdoing has occurred — most
                        reviews are resolved without any action required from
                        you.
                      </p>
                    </div>
                  </div>
                </div>

                {/* What was flagged — bullet points for EVERY evidence type */}
                {uniqueEvidenceTypes.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15 space-y-3">
                    <p className="text-[11px] text-amber-200 font-medium">
                      What was flagged ({uniqueEvidenceTypes.length}{" "}
                      {uniqueEvidenceTypes.length === 1
                        ? "indicator"
                        : "indicators"}
                      ):
                    </p>
                    <ul className="space-y-2.5">
                      {uniqueEvidenceTypes.map((evType) => {
                        const info =
                          INVESTIGATION_REASON_EXPLANATIONS.get(evType);
                        return (
                          <li
                            key={evType}
                            className="flex items-start gap-2"
                          >
                            <span className="text-amber-400 mt-1 shrink-0">
                              •
                            </span>
                            <div>
                              <span className="text-[11px] text-amber-300 font-medium">
                                {info?.label || "Security Check"}
                              </span>
                              <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5">
                                {info?.explanation ||
                                  "Our system flagged this for a routine review. No action is needed from you at this time."}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-[10px] text-gray-500 leading-relaxed pt-1 border-t border-amber-500/10">
                      If you recognise any of the above and believe it may be
                      related to your activity, please{" "}
                      <Link
                        href="/messaging"
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        contact our support team
                      </Link>{" "}
                      so we can resolve this quickly.
                    </p>
                  </div>
                )}

                {/* Investigation status */}
                {fraudAlerts.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-300">
                        {a.title}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(a.detectedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <span>
                        Status:{" "}
                        {a.status === "investigating"
                          ? "🔍 Under Review"
                          : "⏳ Pending Review"}
                      </span>
                    </div>
                  </div>
                ))}

                {/* What happens next */}
                <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/30 space-y-1.5">
                  <p className="text-[11px] text-gray-300 font-medium">
                    What happens next?
                  </p>
                  <ul className="space-y-1 text-[10px] text-gray-400 leading-relaxed">
                    <li className="flex items-start gap-1.5">
                      <span className="text-gray-500 mt-0.5">1.</span>
                      <span>
                        Our team will review the flagged activity. This
                        typically takes 1–3 business days.
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-gray-500 mt-0.5">2.</span>
                      <span>
                        If everything checks out, the investigation will be
                        resolved automatically and this notice will disappear.
                      </span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-gray-500 mt-0.5">3.</span>
                      <span>
                        If additional information is needed, our support team
                        will contact you directly.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* ── Active Restrictions ── */}
            {restrictions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <Ban className="w-3 h-3" /> Account Restrictions
                </h4>
                {restrictions.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-lg bg-red-500/5 border border-red-500/15 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-red-300">
                        {r.type === "banned"
                          ? "Account Restricted"
                          : "Account Under Review"}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(r.restrictedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Reason:{" "}
                      {r.customReason ||
                        RESTRICTION_REASON_LABELS.get(r.reason) ||
                        "Account review in progress"}
                    </p>
                    {r.expiresAt && (
                      <p className="text-[10px] text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        This restriction will be lifted on{" "}
                        {new Date(r.expiresAt).toLocaleDateString()}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {[
                        {
                          blocked: !r.canTrade,
                          label: "Trading",
                          icon: TrendingUp,
                        },
                        {
                          blocked: !r.canWithdraw,
                          label: "Withdrawals",
                          icon: Wallet,
                        },
                        {
                          blocked: !r.canDeposit,
                          label: "Deposits",
                          icon: CreditCard,
                        },
                        {
                          blocked: !r.canEnterCompetitions,
                          label: "Competitions",
                          icon: Trophy,
                        },
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
                          {label}: {blocked ? "Paused" : "Active"}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Account Lockouts ── */}
            {lockouts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> Account Lockout
                </h4>
                {lockouts.map((l) => (
                  <div
                    key={l.id}
                    className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/15 space-y-1"
                  >
                    <span className="text-xs font-semibold text-orange-300">
                      {LOCKOUT_REASON_LABELS.get(l.reason) ||
                        "Account temporarily locked"}
                    </span>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                      <span>
                        Since: {new Date(l.lockedAt).toLocaleDateString()}
                      </span>
                      {l.lockedUntil ? (
                        <span>
                          Unlocks:{" "}
                          {new Date(l.lockedUntil).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-orange-400/60">
                          Please contact support to unlock your account.
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── KYC Issues ── */}
            {hasKycIssue && (
              <div className="space-y-2">
                <h4 className="text-xs text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <Fingerprint className="w-3 h-3" /> Identity Verification
                </h4>
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/15 space-y-1">
                  <span className="text-xs font-semibold text-purple-300">
                    {kycStatus === "declined"
                      ? "Verification Unsuccessful"
                      : "Additional Documents Needed"}
                  </span>
                  {kycDeclineReason && (
                    <p className="text-[11px] text-gray-400">
                      Reason: {kycDeclineReason}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-500">
                    {kycStatus === "declined"
                      ? "Your identity verification could not be completed. Please contact our support team for guidance on next steps."
                      : "We need additional documents to complete your verification. Please resubmit your documents at your earliest convenience."}
                  </p>
                </div>
              </div>
            )}

            {/* ── Support Contact ── */}
            <div className="pt-3 border-t border-gray-700/30">
              <div className="flex items-center justify-center gap-2">
                <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
                <p className="text-[11px] text-gray-400">
                  Need help or have questions?{" "}
                  <Link
                    href="/messaging"
                    className="text-blue-400 hover:text-blue-300 underline font-medium"
                  >
                    Contact our support team
                  </Link>{" "}
                  — we&apos;re here to assist you.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed support link — always visible */}
      {!expanded && (
        <div className="mt-3 pt-2 border-t border-gray-700/20">
          <p className="text-[10px] text-gray-500 text-center">
            If you believe this is an error, please{" "}
            <Link
              href="/messaging"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              contact support
            </Link>{" "}
            for assistance.
          </p>
        </div>
      )}
    </motion.div>
  );
}
