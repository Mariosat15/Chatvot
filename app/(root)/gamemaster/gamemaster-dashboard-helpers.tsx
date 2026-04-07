"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Shield,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubscriptionData } from "./gamemaster-dashboard-types";

// ─── Warning Banner ───────────────────────────────────────────────────
export function WarningBanner({
  icon: Icon,
  color,
  title,
  desc,
  link,
  linkText,
  children,
}: {
  icon: LucideIcon;
  color: string;
  title: string;
  desc: string;
  link?: string;
  linkText?: string;
  children?: React.ReactNode;
}) {
  const colorsMap = new Map([
    ["red", "bg-red-500/10 border-red-500/30"],
    ["yellow", "bg-yellow-500/10 border-yellow-500/30"],
    ["orange", "bg-orange-500/10 border-orange-500/30"],
  ]);
  const iconColorsMap = new Map([
    ["red", "text-red-400"],
    ["yellow", "text-yellow-400"],
    ["orange", "text-orange-400"],
  ]);
  return (
    <div
      className={`p-4 ${colorsMap.get(color) ?? ""} border rounded-2xl flex items-start gap-4`}
    >
      <Icon className={`h-5 w-5 ${iconColorsMap.get(color) ?? ""} shrink-0 mt-0.5`} />
      <div className="flex-1">
        <h3 className={`font-semibold ${iconColorsMap.get(color) ?? ""}`}>{title}</h3>
        <p className="text-gray-400 text-sm mt-1">{desc}</p>
        {link && (
          <Link
            href={link}
            className="inline-flex items-center gap-2 mt-2 text-yellow-400 hover:text-yellow-300 font-medium text-sm"
          >
            {linkText} <ExternalLink className="h-4 w-4" />
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}

// ─── Referral Field ───────────────────────────────────────────────────
export function RefField({
  label,
  value,
  copied,
  onCopy,
  mono,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1.5 block">{label}</label>
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex-1 bg-gray-900 rounded-xl px-4 py-2.5 border border-gray-700 truncate text-sm",
            mono ? "font-mono text-yellow-400 text-lg" : "text-gray-300",
          )}
        >
          {value}
        </div>
        <button
          onClick={onCopy}
          className="p-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4 text-gray-400" />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────
export function KPI({
  icon: Icon,
  color,
  label,
  value,
  pulse,
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  value: string;
  pulse?: boolean;
}) {
  const bgMap = new Map([
    ["emerald", "bg-emerald-500/10"],
    ["yellow", "bg-yellow-500/10"],
    ["blue", "bg-blue-500/10"],
    ["purple", "bg-purple-500/10"],
    ["amber", "bg-amber-500/10"],
    ["red", "bg-red-500/10"],
  ]);
  const textMap = new Map([
    ["emerald", "text-emerald-400"],
    ["yellow", "text-yellow-400"],
    ["blue", "text-blue-400"],
    ["purple", "text-purple-400"],
    ["amber", "text-amber-400"],
    ["red", "text-red-400"],
  ]);
  return (
    <div className="bg-gray-800/50 rounded-xl p-3 sm:p-4 border border-gray-700/50">
      <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
        <div className={`p-1.5 rounded-lg ${bgMap.get(color) ?? ""}`}>
          <Icon className={`h-4 w-4 ${textMap.get(color) ?? ""}`} />
        </div>
        <span className="text-[11px] sm:text-xs text-gray-400">{label}</span>
      </div>
      <p
        className={cn(
          "text-lg sm:text-xl font-bold text-white",
          pulse && "animate-pulse text-red-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Subscription Panel ───────────────────────────────────────────────
export function SubscriptionPanel({
  sub,
  isExpired,
  isPaused,
  isScheduledForDeletion,
  togglingRenewal,
  togglingPause,
  schedulingCancel,
  toggleAutoRenew,
  togglePause,
  onShowCancelConfirm,
  toggleScheduledCancellation,
}: {
  sub: SubscriptionData;
  isExpired: boolean;
  isPaused: boolean;
  isScheduledForDeletion: boolean;
  togglingRenewal: boolean;
  togglingPause: boolean;
  schedulingCancel: boolean;
  toggleAutoRenew: () => void;
  togglePause: () => void;
  onShowCancelConfirm: () => void;
  toggleScheduledCancellation: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 sm:p-5 text-left min-h-[44px]"
      >
        <span className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
          <Shield className="h-5 w-5 text-yellow-400" /> Subscription Management
        </span>
        <ChevronRight
          className={cn(
            "h-5 w-5 text-gray-400 transition-transform",
            open && "rotate-90",
          )}
        />
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3">
          <Row label="Package" value={sub.packageName || "N/A"} />
          <Row
            label="Create Competitions"
            value={sub.canCreateCompetitions ? "✅ Enabled" : "Referral-Only"}
            valueClass={
              sub.canCreateCompetitions ? "text-emerald-400" : "text-purple-400"
            }
          />
          <Row
            label="Competition Fee"
            value={`${sub.limits.referralFeePercentage ?? 0}%`}
            valueClass="text-emerald-400"
          />
          <Row
            label="Challenge Earnings"
            value={
              sub.canEarnFromChallenges
                ? `${sub.limits.challengeReferralFeePercentage ?? sub.limits.referralFeePercentage ?? 0}%`
                : "Not Included"
            }
            valueClass={
              sub.canEarnFromChallenges ? "text-orange-400" : "text-gray-500"
            }
          />
          <Row
            label="Expires"
            value={
              sub.endDate
                ? new Date(sub.endDate).toLocaleDateString()
                : "N/A"
            }
          />
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-400 text-sm">Auto-Renewal</span>
            <button
              onClick={toggleAutoRenew}
              disabled={togglingRenewal}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                sub.autoRenew ? "bg-emerald-500" : "bg-gray-600",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  sub.autoRenew ? "translate-x-6" : "translate-x-1",
                )}
              />
            </button>
          </div>
          {!isExpired && (
            <div className="pt-3 border-t border-gray-700/50 space-y-3">
              <div className="flex items-center justify-between py-2 bg-gray-900/50 rounded-lg px-4">
                <div>
                  <span className="text-white text-sm font-medium">
                    {isPaused ? "⏸ Paused" : "▶ Active"}
                  </span>
                  <p className="text-xs text-gray-500">
                    {isPaused ? "Not receiving fees" : "Receiving fees"}
                  </p>
                </div>
                <button
                  onClick={togglePause}
                  disabled={togglingPause}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50",
                    isPaused
                      ? "bg-emerald-500 text-white"
                      : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
                  )}
                >
                  {togglingPause ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : isPaused ? (
                    "Resume"
                  ) : (
                    "Pause"
                  )}
                </button>
              </div>
              {!isScheduledForDeletion ? (
                <button
                  onClick={onShowCancelConfirm}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900/50 hover:bg-red-500/10 border border-gray-700 hover:border-red-500/30 rounded-lg text-gray-400 hover:text-red-400 transition-all text-sm"
                >
                  <Trash2 className="h-4 w-4" /> Cancel Subscription
                </button>
              ) : (
                <div className="flex items-center justify-between py-2 px-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <span className="text-orange-400 text-sm font-medium flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Scheduled for
                    Deletion
                  </span>
                  <button
                    onClick={toggleScheduledCancellation}
                    disabled={schedulingCancel}
                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    {schedulingCancel ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Keep"
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────
function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-700/30">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={cn("text-white text-sm font-medium", valueClass)}>
        {value}
      </span>
    </div>
  );
}

// ─── Cancel Modal ─────────────────────────────────────────────────────
export function CancelModal({
  endDate,
  schedulingCancel,
  onClose,
  onConfirm,
}: {
  endDate?: string;
  schedulingCancel: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-700">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-orange-500/20 rounded-xl">
            <AlertTriangle className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">
              Cancel Subscription?
            </h3>
            <p className="text-sm text-gray-400">
              Schedules your subscription for deletion
            </p>
          </div>
        </div>
        <div className="space-y-3 mb-6">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
            <p className="text-sm text-emerald-400 flex items-center gap-2">
              <Check className="h-4 w-4" /> Continue earning until{" "}
              {endDate ? new Date(endDate).toLocaleDateString() : "expiry"}
            </p>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
            <p className="text-sm text-orange-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Permanently deleted after
              that
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors"
          >
            Keep
          </button>
          <button
            onClick={onConfirm}
            disabled={schedulingCancel}
            className="flex-1 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {schedulingCancel ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="h-4 w-4" /> Schedule Deletion
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
