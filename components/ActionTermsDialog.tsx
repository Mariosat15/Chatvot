"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ScrollText,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
interface TermsSection {
  id: string;
  type: "heading" | "paragraph" | "list" | "divider" | "html";
  title?: string;
  content: string;
  order: number;
}

interface TermsData {
  slug: string;
  title: string;
  subtitle?: string;
  sections: TermsSection[];
  /** true = show every single action, false = show only once per user ever */
  showEveryTime?: boolean;
}

interface ActionTermsDialogProps {
  /** The slug of the action terms page (e.g., "terms-credit-purchase") */
  slug: string;
  /** Whether the dialog is open */
  open: boolean;
  /** Called when user accepts the terms */
  onAccept: () => void;
  /** Called when user declines/closes the dialog */
  onDecline: () => void;
}

// ─── Permanent Acceptance Helpers (for "once only" mode) ────────────────────
// Reason: For "once only" mode, we persist acceptance in localStorage so users
// don't have to re-accept across browser sessions.
const PERMANENT_KEY_PREFIX = "action_terms_permanent_";

function hasAcceptedPermanently(slug: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(`${PERMANENT_KEY_PREFIX}${slug}`) === "true";
  } catch {
    return false;
  }
}

function markAcceptedPermanently(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${PERMANENT_KEY_PREFIX}${slug}`, "true");
  } catch {
    // Silently fail — localStorage may be unavailable
  }
}

function clearPermanentAcceptance(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${PERMANENT_KEY_PREFIX}${slug}`);
  } catch {
    // Silently fail
  }
}

// ─── Caches ─────────────────────────────────────────────────────────────────
// Reason: Avoid re-fetching terms content from the API on every dialog open.
// The terms content rarely changes — only when admin edits it.
const termsCache = new Map<string, TermsData>();

// Reason: Cache the server-side acceptance check result so we don't
// call GET /api/terms-acceptance on every dialog open (for "once only" mode).
const serverAcceptanceCache = new Map<string, boolean>();

// ─── Component ──────────────────────────────────────────────────────────────
export default function ActionTermsDialog({
  slug,
  open,
  onAccept,
  onDecline,
}: ActionTermsDialogProps) {
  const [terms, setTerms] = useState<TermsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Reason: Prevent stale closure issues with onAccept/onDecline in useEffect.
  const onAcceptRef = useRef(onAccept);
  const onDeclineRef = useRef(onDecline);
  onAcceptRef.current = onAccept;
  onDeclineRef.current = onDecline;

  // Fetch terms and evaluate acceptance when dialog opens
  useEffect(() => {
    if (!open || !slug) return;

    let cancelled = false;

    const loadTerms = async () => {
      setLoading(true);
      setError("");
      setChecked(false);
      setHasScrolledToBottom(false);

      try {
        // ── Step 1: Get terms data (from cache or API) ─────────────────
        let termsData = termsCache.get(slug);
        if (!termsData) {
          const res = await fetch(
            `/api/action-terms/${encodeURIComponent(slug)}`,
          );
          const data = await res.json();
          if (cancelled) return;
          if (data.success && data.terms) {
            termsData = data.terms;
            termsCache.set(slug, termsData!);
          } else {
            setError(data.error || "Terms not available");
            return;
          }
        }

        // ── Step 2: Evaluate based on showEveryTime flag ───────────────
        const isEveryTime = termsData!.showEveryTime !== false; // default true

        if (isEveryTime) {
          // Reason: "Every Time" mode — admin wants the popup on EVERY action.
          // No caching whatsoever. Always show the terms dialog.
          // Also clear any stale permanent acceptance from a previous "once only" setting.
          clearPermanentAcceptance(slug);
          serverAcceptanceCache.delete(slug);

          if (!cancelled) setTerms(termsData!);
          return;
        }

        // ── "Once Only" mode — check if user already accepted permanently ──
        if (hasAcceptedPermanently(slug)) {
          if (!cancelled) onAcceptRef.current();
          return;
        }

        // Check server-side acceptance (handles cross-device / cleared localStorage)
        if (!serverAcceptanceCache.has(slug)) {
          try {
            const checkRes = await fetch(
              `/api/terms-acceptance?slug=${encodeURIComponent(slug)}`,
            );
            const checkData = await checkRes.json();
            if (cancelled) return;
            if (checkData.success && checkData.hasAccepted) {
              serverAcceptanceCache.set(slug, true);
              markAcceptedPermanently(slug);
              onAcceptRef.current();
              return;
            }
            serverAcceptanceCache.set(slug, false);
          } catch {
            // If server check fails, show the terms dialog as a fallback (safer)
          }
        } else if (serverAcceptanceCache.get(slug)) {
          markAcceptedPermanently(slug);
          if (!cancelled) onAcceptRef.current();
          return;
        }

        // Show the terms dialog
        if (!cancelled) setTerms(termsData!);
      } catch {
        if (!cancelled) setError("Failed to load terms. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadTerms();

    return () => {
      cancelled = true;
    };
  }, [open, slug]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 20; // px from bottom
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (atBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  }, [hasScrolledToBottom]);

  // Check if content is short enough that no scrolling is needed
  useEffect(() => {
    if (!open || !terms) return;
    // Small delay to allow DOM render
    const timer = setTimeout(() => {
      const el = scrollRef.current;
      if (el && el.scrollHeight <= el.clientHeight + 20) {
        setHasScrolledToBottom(true);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [open, terms]);

  const handleAccept = () => {
    // Reason: Only persist acceptance for "once only" mode.
    // "Every time" mode should NEVER cache — dialog must show on every action.
    if (terms?.showEveryTime === false) {
      markAcceptedPermanently(slug);
      serverAcceptanceCache.set(slug, true);
    }

    // Reason: Fire-and-forget POST to record the acceptance in the database.
    // This creates an audit record regardless of mode. We don't block the user flow.
    fetch("/api/terms-acceptance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    }).catch(() => {
      // Silently fail — acceptance is already recorded client-side for "once only"
    });

    onAccept();
  };

  // ── Render Section ──────────────────────────────────────────────────────────
  const renderSection = (section: TermsSection) => {
    switch (section.type) {
      case "heading":
        return (
          <h3
            key={section.id}
            className="text-sm font-bold text-gray-100 mt-4 mb-2"
          >
            {section.title || section.content}
          </h3>
        );
      case "paragraph":
        return (
          <p
            key={section.id}
            className="text-xs text-gray-300 leading-relaxed mb-3"
          >
            {section.content}
          </p>
        );
      case "list":
        return (
          <ul
            key={section.id}
            className="text-xs text-gray-300 space-y-1.5 mb-3 ml-4"
          >
            {section.content.split("\n").map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5 shrink-0">•</span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        );
      case "divider":
        return (
          <hr
            key={section.id}
            className="border-gray-700/50 my-3"
          />
        );
      case "html":
        return (
          <div
            key={section.id}
            className="text-xs text-gray-300 mb-3"
            dangerouslySetInnerHTML={{ __html: section.content }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDecline()}>
      <DialogContent
        className="bg-gray-900 border-gray-700 max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-100">
            <ScrollText className="h-5 w-5 text-yellow-500" />
            {terms?.title || "Terms & Conditions"}
          </DialogTitle>
          {terms?.subtitle && (
            <DialogDescription className="text-gray-400">
              {terms.subtitle}
            </DialogDescription>
          )}
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-yellow-500" />
            <p className="text-sm text-gray-400">Loading terms...</p>
          </div>
        ) : error ? (
          <div className="py-8 text-center space-y-3">
            <AlertTriangle className="h-6 w-6 mx-auto text-amber-500" />
            <p className="text-sm text-amber-400">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onDecline}
              className="bg-gray-800 border-gray-700 text-gray-300"
            >
              Go Back
            </Button>
          </div>
        ) : terms ? (
          <div className="space-y-4">
            {/* Scrollable Terms Content */}
            <div className="relative">
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar rounded-lg bg-gray-800/50 border border-gray-700/50 p-4"
              >
                {terms.sections
                  .sort((a, b) => a.order - b.order)
                  .map(renderSection)}
              </div>

              {/* Scroll indicator */}
              {!hasScrolledToBottom && (
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-gray-800/90 to-transparent pointer-events-none flex items-end justify-center pb-1">
                  <div className="flex items-center gap-1 text-xs text-gray-400 animate-bounce">
                    <ChevronDown className="h-3 w-3" />
                    Scroll to continue
                  </div>
                </div>
              )}
            </div>

            {/* Acceptance Checkbox */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                checked
                  ? "bg-green-500/10 border-green-500/30"
                  : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
              } ${!hasScrolledToBottom ? "opacity-50 pointer-events-none" : ""}`}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(val) => setChecked(val === true)}
                disabled={!hasScrolledToBottom}
                className="mt-0.5 border-gray-600 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
              />
              <span className="text-xs text-gray-300 leading-relaxed">
                I have read, understood, and agree to the above terms and
                conditions.
              </span>
            </label>

            {/* Buttons */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onDecline}
                className="flex-1 bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleAccept}
                disabled={!checked}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                I Accept
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─── Slugs ──────────────────────────────────────────────────────────────────
// Reason: Export known slug constants so integration points don't use magic strings.
export const ACTION_TERM_SLUGS = {
  CREDIT_PURCHASE: "terms-credit-purchase",
  WITHDRAWAL: "terms-withdrawal",
  MARKETPLACE: "terms-marketplace",
  COMPETITION_ENTRY: "terms-competition-entry",
  CHALLENGE: "terms-challenge",
} as const;
