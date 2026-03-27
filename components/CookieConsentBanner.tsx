"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Cookie, Shield, ChevronDown, ChevronUp, X } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CookieCategory {
  id: string;
  name: string;
  description: string;
  required: boolean;
  defaultEnabled: boolean;
}

interface CookieConsentSettings {
  enabled: boolean;
  title: string;
  message: string;
  acceptAllText: string;
  rejectAllText: string;
  customizeText: string;
  savePreferencesText: string;
  categories: CookieCategory[];
  cookiePolicyUrl: string;
  privacyPolicyUrl: string;
  position: "bottom" | "bottom-left" | "bottom-right";
  showDeclineButton: boolean;
  showCustomizeButton: boolean;
  backdropEnabled: boolean;
  autoExpireDays: number;
}

// ─── Local Storage Keys ──────────────────────────────────────────────────────

const CONSENT_KEY = "cv_cookie_consent";
const CONSENT_PREFS_KEY = "cv_cookie_prefs";

interface StoredConsent {
  accepted: boolean;
  timestamp: number;
  preferences: Record<string, boolean>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CookieConsentBanner() {
  const [settings, setSettings] = useState<CookieConsentSettings | null>(null);
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [categoryPrefs, setCategoryPrefs] = useState<Record<string, boolean>>(
    {},
  );
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  // ── Check if consent was already given ────────────────────────────────
  const hasValidConsent = useCallback(
    (expireDays: number): boolean => {
      try {
        const raw = localStorage.getItem(CONSENT_KEY);
        if (!raw) return false;
        const stored: StoredConsent = JSON.parse(raw);
        const daysSince =
          (Date.now() - stored.timestamp) / (1000 * 60 * 60 * 24);
        return daysSince < expireDays;
      } catch {
        return false;
      }
    },
    [],
  );

  // ── Fetch settings on mount ───────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/cookie-consent");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success || !data.settings?.enabled) return;

        const s = data.settings as CookieConsentSettings;
        setSettings(s);

        // If user already consented and it hasn't expired, don't show
        if (hasValidConsent(s.autoExpireDays)) return;

        // Build initial category prefs from defaults
        const prefs: Record<string, boolean> = {};
        for (const cat of s.categories) {
          prefs[cat.id] = cat.required || cat.defaultEnabled;
        }
        setCategoryPrefs(prefs);

        // Small delay before showing for smoother UX
        setTimeout(() => setVisible(true), 800);
      } catch {
        // Silently fail — banner just won't show
      }
    }
    load();
  }, [hasValidConsent]);

  // ── Save consent to localStorage ──────────────────────────────────────
  const saveConsent = useCallback(
    (prefs: Record<string, boolean>) => {
      const consent: StoredConsent = {
        accepted: true,
        timestamp: Date.now(),
        preferences: prefs,
      };
      localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
      localStorage.setItem(CONSENT_PREFS_KEY, JSON.stringify(prefs));
      // Animate out then hide
      setIsAnimatingOut(true);
      setTimeout(() => setVisible(false), 300);
    },
    [],
  );

  const handleAcceptAll = useCallback(() => {
    if (!settings) return;
    const allAccepted: Record<string, boolean> = {};
    for (const cat of settings.categories) {
      allAccepted[cat.id] = true;
    }
    saveConsent(allAccepted);
  }, [settings, saveConsent]);

  const handleRejectNonEssential = useCallback(() => {
    if (!settings) return;
    const essentialOnly: Record<string, boolean> = {};
    for (const cat of settings.categories) {
      essentialOnly[cat.id] = cat.required;
    }
    saveConsent(essentialOnly);
  }, [settings, saveConsent]);

  const handleSavePreferences = useCallback(() => {
    saveConsent(categoryPrefs);
  }, [categoryPrefs, saveConsent]);

  const toggleCategory = useCallback((catId: string, required: boolean) => {
    if (required) return; // Can't toggle required categories
    // Reason: use Map transforms to avoid dynamic object-key mutation lint warnings.
    setCategoryPrefs((prev) => {
      const nextMap = new Map<string, boolean>(Object.entries(prev));
      const current = nextMap.get(catId) ?? false;
      nextMap.set(catId, !current);
      return Object.fromEntries(nextMap);
    });
  }, []);

  // ── Don't render anything if not visible ──────────────────────────────
  if (!visible || !settings) return null;

  // ── Position classes ──────────────────────────────────────────────────
  const positionClasses: Record<string, string> = {
    bottom: "inset-x-0 bottom-0",
    "bottom-left": "left-4 bottom-4 max-w-lg",
    "bottom-right": "right-4 bottom-4 max-w-lg",
  };

  const posClass = positionClasses[settings.position] || positionClasses.bottom;

  return (
    <>
      {/* Backdrop */}
      {settings.backdropEnabled && (
        <div
          className={`fixed inset-0 bg-black/40 z-[9998] transition-opacity duration-300 ${
            isAnimatingOut ? "opacity-0" : "opacity-100"
          }`}
        />
      )}

      {/* Banner */}
      <div
        className={`fixed ${posClass} z-[9999] transition-all duration-300 ${
          isAnimatingOut
            ? "translate-y-full opacity-0"
            : "translate-y-0 opacity-100"
        }`}
        role="dialog"
        aria-label="Cookie consent"
      >
        <div
          className={`${
            settings.position === "bottom"
              ? "w-full"
              : "rounded-xl shadow-2xl"
          } bg-gray-900/95 backdrop-blur-xl border-t border-gray-700/60 shadow-[0_-4px_30px_rgba(0,0,0,0.5)]`}
        >
          <div
            className={`${
              settings.position === "bottom"
                ? "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
                : "px-5"
            } py-5`}
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-shrink-0 mt-0.5">
                <Cookie className="h-6 w-6 text-yellow-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-white">
                  {settings.title}
                </h3>
                <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                  {settings.message}{" "}
                  <Link
                    href={settings.cookiePolicyUrl}
                    className="text-yellow-500 hover:text-yellow-400 underline underline-offset-2"
                  >
                    Cookie Policy
                  </Link>
                </p>
              </div>
            </div>

            {/* Preferences panel (expandable) */}
            {showPreferences && (
              <div className="mb-4 mt-3 space-y-2 border border-gray-700/50 rounded-lg p-3 bg-gray-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-medium text-white">
                    Cookie Categories
                  </span>
                </div>
                {settings.categories.map((cat) => (
                  <label
                    key={cat.id}
                    className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors ${
                      cat.required
                        ? "bg-gray-800/30 cursor-not-allowed"
                        : "bg-gray-800/50 hover:bg-gray-700/50 cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={categoryPrefs[cat.id] ?? cat.defaultEnabled}
                      disabled={cat.required}
                      onChange={() => toggleCategory(cat.id, cat.required)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-700 text-yellow-500 focus:ring-yellow-500/50 disabled:opacity-60"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {cat.name}
                        </span>
                        {cat.required && (
                          <span className="text-[10px] uppercase tracking-wider text-yellow-500/80 bg-yellow-500/10 px-1.5 py-0.5 rounded">
                            Always On
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        {cat.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3">
              {/* Accept All — primary action */}
              <button
                onClick={handleAcceptAll}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
              >
                {settings.acceptAllText}
              </button>

              {/* Reject Non-Essential */}
              {settings.showDeclineButton && (
                <button
                  onClick={handleRejectNonEssential}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500/50"
                >
                  {settings.rejectAllText}
                </button>
              )}

              {/* Manage Preferences / Save */}
              {settings.showCustomizeButton && (
                <>
                  {showPreferences ? (
                    <button
                      onClick={handleSavePreferences}
                      className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    >
                      {settings.savePreferencesText}
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowPreferences(true)}
                      className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-gray-400 hover:text-white text-sm transition-colors flex items-center justify-center gap-1 focus:outline-none"
                    >
                      {settings.customizeText}
                      {showPreferences ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </>
              )}

              {/* Collapse preferences */}
              {showPreferences && (
                <button
                  onClick={() => setShowPreferences(false)}
                  className="sm:ml-auto p-2 text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label="Collapse preferences"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
