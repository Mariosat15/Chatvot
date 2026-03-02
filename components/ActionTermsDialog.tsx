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

// ─── Session Storage Key ────────────────────────────────────────────────────
// Reason: We cache acceptance per slug per browser session so users
// don't have to re-accept every time they open the same dialog.
const ACCEPTED_KEY_PREFIX = "action_terms_accepted_";

function hasAcceptedInSession(slug: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(`${ACCEPTED_KEY_PREFIX}${slug}`) === "true";
  } catch {
    return false;
  }
}

function markAcceptedInSession(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${ACCEPTED_KEY_PREFIX}${slug}`, "true");
  } catch {
    // Silently fail — sessionStorage may be unavailable
  }
}

// ─── Cache ──────────────────────────────────────────────────────────────────
// Reason: Avoid re-fetching terms from the API every time the dialog opens.
const termsCache = new Map<string, TermsData>();

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

  // Fetch terms when dialog opens
  useEffect(() => {
    if (!open || !slug) return;

    // Check session cache — auto-accept if already accepted this session
    if (hasAcceptedInSession(slug)) {
      onAccept();
      return;
    }

    // Check in-memory cache
    if (termsCache.has(slug)) {
      setTerms(termsCache.get(slug)!);
      setChecked(false);
      setHasScrolledToBottom(false);
      return;
    }

    // Fetch from API
    setLoading(true);
    setError("");
    setChecked(false);
    setHasScrolledToBottom(false);

    fetch(`/api/action-terms/${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.terms) {
          setTerms(data.terms);
          termsCache.set(slug, data.terms);
        } else {
          setError(data.error || "Terms not available");
        }
      })
      .catch(() => {
        setError("Failed to load terms. Please try again.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, slug]); // eslint-disable-line react-hooks/exhaustive-deps

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
    markAcceptedInSession(slug);
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
