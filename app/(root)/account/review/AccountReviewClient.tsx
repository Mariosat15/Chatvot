"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  Clock,
  FileText,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Loader2,
  Hash,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import type {
  ReviewPacket,
  BlockedAction,
} from "@/lib/services/account-review.service";

interface AccountReviewClientProps {
  restrictions: ReviewPacket[];
}

function actionLabel(action: BlockedAction): string {
  // Reason: using a switch (instead of an object lookup keyed by user-ish
  // input) sidesteps eslint-plugin-security's "object injection" warning
  // while keeping the mapping exhaustive at compile time.
  switch (action) {
    case "trade":
      return "Placing trades";
    case "enterCompetition":
      return "Entering competitions & challenges";
    case "deposit":
      return "Depositing funds";
    case "withdraw":
      return "Withdrawing funds";
    default:
      return action;
  }
}

const MAX_APPEAL_LENGTH = 2000;

export default function AccountReviewClient({
  restrictions,
}: AccountReviewClientProps) {
  const router = useRouter();
  // Primary restriction = most recent. A single account rarely has more
  // than one active restriction, but we still render each one beneath it.
  const primary = restrictions[0];
  const extras = restrictions.slice(1);

  const [appealMessage, setAppealMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(Boolean(primary.appealSubmittedAt));
  const [conversationId, setConversationId] = useState<string | null>(
    primary.appealConversationId ?? null,
  );

  const etaDateText = useMemo(() => {
    if (!primary.reviewEtaDate) return null;
    try {
      return new Date(primary.reviewEtaDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return null;
    }
  }, [primary.reviewEtaDate]);

  const restrictedAtText = useMemo(() => {
    try {
      return new Date(primary.restrictedAt).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  }, [primary.restrictedAt]);

  const submitAppeal = async () => {
    if (submitting) return;
    if (appealMessage.length > MAX_APPEAL_LENGTH) {
      toast.error(`Please keep your appeal under ${MAX_APPEAL_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/user/restrictions/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restrictionId: primary.id,
          message: appealMessage.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(
          data.error ||
            "Something went wrong. Please contact support if you need assistance.",
        );
        return;
      }

      setSubmitted(true);
      setConversationId(data.conversationId ?? null);
      toast.success(`Appeal submitted — case ${data.caseId}.`);
    } catch (err) {
      console.error("❌ [AccountReview] Submit appeal failed:", err);
      toast.error(
        "Something went wrong. Please contact support if you need assistance.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const goToConversation = () => {
    if (conversationId) {
      router.push(`/messaging?conversation=${conversationId}`);
    } else {
      router.push("/messaging");
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-6 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-xl bg-amber-500/15 p-3 border border-amber-500/30">
              <ShieldAlert className="h-7 w-7 text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Your account is under review
              </h1>
              <p className="mt-2 text-sm text-amber-100/80">
                {primary.type === "banned"
                  ? "Your account has been restricted pending a compliance review."
                  : "Some account actions are temporarily paused while we complete a review."}
                {" "}We&apos;ll update you as soon as it&apos;s done.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 px-3 py-1 text-amber-200 font-semibold">
                  <Hash className="h-3.5 w-3.5" />
                  Case {primary.caseId}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-800/80 border border-gray-700 px-3 py-1 text-gray-300">
                  <Clock className="h-3.5 w-3.5" />
                  {primary.reviewEtaText}
                </span>
                {etaDateText && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-800/80 border border-gray-700 px-3 py-1 text-gray-300">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Est. by {etaDateText}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-800/80 border border-gray-700 px-3 py-1 text-gray-300">
                  {primary.reasonLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Case details grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Blocked actions */}
          <div className="rounded-2xl border border-gray-700 bg-dark-700/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="h-5 w-5 text-red-400" />
              <h2 className="text-lg font-semibold">Actions currently blocked</h2>
            </div>
            {primary.blockedActions.length === 0 ? (
              <p className="text-sm text-gray-400">
                No user actions are blocked at the moment.
              </p>
            ) : (
              <ul className="space-y-2">
                {primary.blockedActions.map((action) => (
                  <li
                    key={action}
                    className="flex items-center gap-2 text-sm text-gray-200 bg-dark-800/60 border border-dark-600 rounded-lg px-3 py-2"
                  >
                    <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                    {actionLabel(action)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Documents requested */}
          <div className="rounded-2xl border border-gray-700 bg-dark-700/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-sky-400" />
              <h2 className="text-lg font-semibold">Documents requested</h2>
            </div>
            {primary.documentsRequested.length === 0 ? (
              <p className="text-sm text-gray-400">
                No additional documents are required right now. Our team will
                reach out if anything is needed.
              </p>
            ) : (
              <ul className="space-y-2">
                {primary.documentsRequested.map((doc) => (
                  <li
                    key={doc}
                    className="flex items-center gap-2 text-sm text-gray-200 bg-dark-800/60 border border-dark-600 rounded-lg px-3 py-2"
                  >
                    <CheckCircle2 className="h-4 w-4 text-sky-300 shrink-0" />
                    {doc}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-gray-500">
              Send any requested documents via the support chat linked to your
              case.
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-2xl border border-gray-700 bg-dark-700/50 p-5">
          <h2 className="text-lg font-semibold mb-3">Case timeline</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-dark-800/50 rounded-lg border border-dark-600 p-3">
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                Review started
              </dt>
              <dd className="mt-1 text-gray-100 font-medium">
                {restrictedAtText}
              </dd>
            </div>
            <div className="bg-dark-800/50 rounded-lg border border-dark-600 p-3">
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                Estimated completion
              </dt>
              <dd className="mt-1 text-gray-100 font-medium">
                {etaDateText ?? primary.reviewEtaText}
              </dd>
            </div>
          </dl>
        </div>

        {/* Appeal */}
        <div className="rounded-2xl border border-gray-700 bg-dark-700/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold">Submit an appeal</h2>
          </div>
          {submitted ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-300">
                We&apos;ve received your appeal for case{" "}
                <span className="font-semibold text-white">
                  {primary.caseId}
                </span>
                . A support agent will reply in your messages.
              </p>
              <Button
                type="button"
                onClick={goToConversation}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Open support conversation
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                Tell us anything that could help us review your case faster.
                Your appeal will open a support ticket pre-filled with case{" "}
                <span className="font-semibold text-white">
                  {primary.caseId}
                </span>
                .
              </p>
              <Textarea
                value={appealMessage}
                onChange={(e) => setAppealMessage(e.target.value)}
                placeholder="Add context, links, or anything else we should know (optional)"
                maxLength={MAX_APPEAL_LENGTH}
                className="bg-dark-800 border-dark-600 text-white min-h-[120px]"
              />
              <div className="flex items-center justify-between">
                <p
                  className={`text-xs ${
                    appealMessage.length > MAX_APPEAL_LENGTH * 0.9
                      ? "text-yellow-400"
                      : "text-gray-500"
                  }`}
                >
                  {appealMessage.length}/{MAX_APPEAL_LENGTH}
                </p>
                <Button
                  type="button"
                  onClick={submitAppeal}
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Submit appeal
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {extras.length > 0 && (
          <div className="rounded-2xl border border-gray-700 bg-dark-700/30 p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">
              Additional restrictions on this account
            </h2>
            <ul className="space-y-2 text-sm text-gray-400">
              {extras.map((r) => (
                <li
                  key={r.id}
                  className="bg-dark-800/50 border border-dark-600 rounded-lg px-3 py-2 flex flex-wrap items-center gap-2"
                >
                  <span className="text-xs rounded-full bg-gray-800 border border-gray-700 px-2 py-0.5">
                    {r.caseId}
                  </span>
                  <span>{r.reasonLabel}</span>
                  <span className="text-gray-500">•</span>
                  <span>{r.reviewEtaText}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
