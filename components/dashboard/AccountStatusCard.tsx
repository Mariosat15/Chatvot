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
  // Reason: Evidence-level type names differ from top-level alertType names.
  // The fraud detection services store evidence with these specific type keys.
  [
    "device_fingerprint",
    {
      label: "Device Verification",
      explanation:
        "Our system detected that your device may be associated with multiple accounts. This check ensures each account belongs to a unique user.",
    },
  ],
  [
    "payment_fingerprint",
    {
      label: "Payment Method Verification",
      explanation:
        "A payment method linked to your account was also found on another account. This check protects against unauthorized use of your payment details.",
    },
  ],
  [
    "trading_similarity",
    {
      label: "Trading Pattern Review",
      explanation:
        "Your recent trading activity showed patterns that closely match another account. We review these to maintain fair competition.",
    },
  ],
  [
    "duplicate_document",
    {
      label: "Identity Document Review",
      explanation:
        "An identity document associated with your account was flagged for additional review to ensure it has not been used elsewhere.",
    },
  ],
  [
    "ip_browser_match",
    {
      label: "Session Verification",
      explanation:
        "Your browsing session matched patterns that require a brief review to confirm account ownership.",
    },
  ],
  [
    "rapid_creation",
    {
      label: "Account Timing Review",
      explanation:
        "Your account creation timing was close to other accounts. We review these patterns to ensure platform integrity.",
    },
  ],
  [
    "burst_entry",
    {
      label: "Competition Entry Review",
      explanation:
        "The timing of your competition entry matched a pattern that we review to ensure all participants compete fairly.",
    },
  ],
  [
    "failed_logins",
    {
      label: "Login Security Check",
      explanation:
        "Multiple login attempts were detected on your account. We review these to protect your account from unauthorized access.",
    },
  ],
  [
    "suspicion_score",
    {
      label: "Account Review",
      explanation:
        "Your account was flagged for a routine security review based on combined activity patterns. No action is needed from you at this time.",
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
    openChargebackCaseId,
  } = accountStatus;

  // Reason: When an open chargeback case exists and the user has a
  // payment_fraud restriction, show chargeback-specific copy instead of the
  // generic "Payment Security" label. The underlying restriction entry still
  // renders below with its canTrade/canDeposit flags intact.
  const hasChargebackCase = Boolean(openChargebackCaseId);
  const hasPaymentFraudRestriction = restrictions.some(
    (r) => r.reason === "payment_fraud",
  );
  const showChargebackNotice = hasChargebackCase && hasPaymentFraudRestriction;

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

  // Reason: Collect unique evidence types that THIS user is specifically involved in.
  // The server already filters evidence to only include types where this user appears
  // in connectedAccountIds or accountsDetails. Falls back to alertType if empty.
  const uniqueEvidenceTypes = [
    ...new Set(
      fraudAlerts.flatMap((a) =>
        a.evidenceTypes && a.evidenceTypes.length > 0
          ? a.evidenceTypes
          : [a.alertType],
      ),
    ),
  ];

  // Reason: Collapsed is a single header bar (owner mark). Badges + support
  // copy live only in the expanded panel so the strip stays thin by default.
  return (
    <motion.div
      className="relative overflow-hidden rounded-xl border border-amber-400/35 bg-[#0A1224]/90 backdrop-blur-md"
      style={{
        boxShadow:
          "0 0 24px rgba(245,158,11,0.14), inset 0 1px 0 rgba(251,191,36,0.08)",
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-amber-500/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/50"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-400/35">
            <ShieldAlert
              className={`h-4 w-4 text-amber-300 ${hasActiveRestriction ? "animate-pulse" : ""}`}
              aria-hidden
            />
          </span>
          <h3 className="truncate text-sm font-semibold tracking-wide text-white">
            Account Status
          </h3>
          <span className="shrink-0 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 ring-1 ring-amber-400/30">
            {totalIssues} {totalIssues === 1 ? "issue" : "issues"}
          </span>
        </div>

        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-gray-400">
          {expanded ? "Hide" : "Details"}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="space-y-4 border-t border-amber-400/15 px-3.5 pb-3.5 pt-3"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Quick Status Badges — only when expanded */}
            <div className="flex flex-wrap items-center gap-2">
              {restrictions.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-2 py-1"
                >
                  <Ban className="h-3.5 w-3.5 text-red-400" aria-hidden />
                  <span className="text-[11px] font-medium text-red-300">
                    {r.type === "banned" ? "Restricted" : "Under Review"}
                  </span>
                </div>
              ))}

              {lockouts.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-1.5 rounded-lg border border-orange-500/25 bg-orange-500/10 px-2 py-1"
                >
                  <Lock className="h-3.5 w-3.5 text-orange-400" aria-hidden />
                  <span className="text-[11px] font-medium text-orange-300">
                    Temporarily Locked
                  </span>
                </div>
              ))}

              {fraudAlerts.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1">
                  <Eye className="h-3.5 w-3.5 text-amber-400" aria-hidden />
                  <span className="text-[11px] font-medium text-amber-300">
                    {fraudAlerts.length} Investigation
                    {fraudAlerts.length > 1 ? "s" : ""}
                  </span>
                </div>
              )}

              {hasKycIssue && (
                <div className="flex items-center gap-1.5 rounded-lg border border-purple-500/25 bg-purple-500/10 px-2 py-1">
                  <Fingerprint
                    className="h-3.5 w-3.5 text-purple-400"
                    aria-hidden
                  />
                  <span className="text-[11px] font-medium text-purple-300">
                    KYC{" "}
                    {kycStatus === "declined"
                      ? "Declined"
                      : "Resubmission Required"}
                  </span>
                </div>
              )}

              {showChargebackNotice && (
                <div className="flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-2 py-1">
                  <CreditCard className="h-3.5 w-3.5 text-red-400" aria-hidden />
                  <span className="text-[11px] font-medium text-red-300">
                    Chargeback Under Review
                  </span>
                </div>
              )}
            </div>
            {/* ── Chargeback Under Review ── */}
            {showChargebackNotice && (
              <div className="space-y-2">
                <h4 className="text-xs text-gray-400 uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <CreditCard className="w-3 h-3" /> Chargeback Under Review
                </h4>
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/15 space-y-1.5">
                  <p className="text-xs font-semibold text-red-300">
                    A payment dispute has been opened on your account.
                  </p>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Your account is restricted while we review. You may still
                    sign in. If you have additional information that can help
                    resolve this dispute (receipts, communications, or proof
                    of service), please{" "}
                    <Link
                      href="/messaging"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      contact our support team
                    </Link>
                    .
                  </p>
                </div>
              </div>
            )}

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
                              <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">
                                {info?.explanation ||
                                  "Our system flagged this for a routine review. No action is needed from you at this time."}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-[11px] text-gray-500 leading-relaxed pt-1 border-t border-amber-500/10">
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
                      <span className="text-[11px] text-gray-500">
                        {new Date(a.detectedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
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
                  <ul className="space-y-1 text-[11px] text-gray-400 leading-relaxed">
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
                      <span className="text-[11px] text-gray-500">
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
                      <p className="text-[11px] text-gray-500 flex items-center gap-1">
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
                          className={`text-[11px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
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
                    <div className="flex items-center gap-3 text-[11px] text-gray-500">
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
                  <p className="text-[11px] text-gray-500">
                    {kycStatus === "declined"
                      ? "Your identity verification could not be completed. Please contact our support team for guidance on next steps."
                      : "We need additional documents to complete your verification. Please resubmit your documents at your earliest convenience."}
                  </p>
                </div>
              </div>
            )}

            {/* ── Support Contact ── */}
            <div className="border-t border-amber-400/10 pt-3">
              <div className="flex items-center justify-center gap-2">
                <MessageCircle className="h-3.5 w-3.5 text-sky-400" aria-hidden />
                <p className="text-[11px] text-gray-400">
                  If you believe this is an error, please{" "}
                  <Link
                    href="/messaging"
                    className="font-medium text-sky-400 underline hover:text-sky-300"
                  >
                    contact support
                  </Link>{" "}
                  for assistance.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
