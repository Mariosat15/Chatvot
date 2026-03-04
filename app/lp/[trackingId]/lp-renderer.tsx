"use client";

import { useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import {
  Trophy,
  TrendingUp,
  Shield,
  Zap,
  Star,
  CheckCircle,
  ArrowRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface LPSection {
  id: string;
  type: string;
  order: number;
  enabled: boolean;
  content: Record<string, unknown>;
}

interface SerializedPage {
  id: string;
  name: string;
  trackingId: string;
  sections: LPSection[];
  showRiskDisclaimer: boolean;
  customCss: string;
  seoTitle: string;
}

// ─── Visit Tracking ──────────────────────────────────────────────────────────
function useTrackVisit(trackingId: string) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    const utmParams = new URLSearchParams(window.location.search);
    fetch("/api/lp/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trackingId,
        referrer: document.referrer || "",
        userAgent: navigator.userAgent || "",
        utmSource: utmParams.get("utm_source") || "",
        utmMedium: utmParams.get("utm_medium") || "",
        utmCampaign: utmParams.get("utm_campaign") || "",
        utmTerm: utmParams.get("utm_term") || "",
        utmContent: utmParams.get("utm_content") || "",
        screenWidth: window.innerWidth,
      }),
    }).catch(() => {});
  }, [trackingId]);
}

// ─── Icon Map ────────────────────────────────────────────────────────────────
const iconMap = new Map<string, React.ComponentType<{ className?: string }>>([
  ["Trophy", Trophy],
  ["TrendingUp", TrendingUp],
  ["Shield", Shield],
  ["Zap", Zap],
  ["Star", Star],
  ["CheckCircle", CheckCircle],
]);

function getIcon(name: string) {
  return iconMap.get(name) || Zap;
}

// ─── Section Renderers ───────────────────────────────────────────────────────

function HeroSection({ content }: { content: Record<string, unknown> }) {
  const headline = String(content.headline || "Welcome");
  const subheadline = String(content.subheadline || "");
  const ctaText = String(content.ctaText || "Get Started");
  const ctaUrl = String(content.ctaUrl || "/sign-up");
  const bgImage = String(content.backgroundImage || "");

  return (
    <section
      className="relative min-h-[80vh] flex items-center justify-center overflow-hidden"
      style={{
        backgroundImage: bgImage ? `url(${bgImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900/80 via-gray-900/60 to-gray-950" />

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
          {headline}
        </h1>
        {subheadline && (
          <p className="text-lg md:text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            {subheadline}
          </p>
        )}
        <a
          href={ctaUrl}
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold rounded-xl text-lg hover:from-yellow-400 hover:to-amber-400 transition-all shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40"
        >
          {ctaText}
          <ArrowRight className="h-5 w-5" />
        </a>
      </div>
    </section>
  );
}

function FeaturesSection({ content }: { content: Record<string, unknown> }) {
  const title = String(content.title || "Features");
  const items = Array.isArray(content.items) ? content.items : [];

  return (
    <section className="py-20 px-6 bg-gray-950">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">
          {title}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((item: Record<string, unknown>, i: number) => {
            const Icon = getIcon(String(item.icon || "Zap"));
            return (
              <div
                key={String(item.id || i)}
                className="p-6 bg-gray-900/50 border border-gray-800 rounded-2xl hover:border-yellow-500/30 transition-all group"
              >
                <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-yellow-500/20 transition-colors">
                  <Icon className="h-6 w-6 text-yellow-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {String(item.title || "")}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {String(item.description || "")}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StatsSection({ content }: { content: Record<string, unknown> }) {
  const title = String(content.title || "By the Numbers");
  const items = Array.isArray(content.items) ? content.items : [];

  return (
    <section className="py-20 px-6 bg-gradient-to-b from-gray-950 to-gray-900">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-white mb-16">{title}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {items.map((item: Record<string, unknown>, i: number) => (
            <div key={String(item.id || i)}>
              <div className="text-3xl md:text-4xl font-bold text-yellow-500 mb-2">
                {String(item.value || "0")}
              </div>
              <div className="text-gray-400 text-sm">
                {String(item.label || "")}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection({ content }: { content: Record<string, unknown> }) {
  const title = String(content.title || "How It Works");
  const steps = Array.isArray(content.steps) ? content.steps : [];

  return (
    <section className="py-20 px-6 bg-gray-950">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-16">
          {title}
        </h2>
        <div className="space-y-12">
          {steps.map((step: Record<string, unknown>, i: number) => (
            <div key={String(step.id || i)} className="flex gap-6 items-start">
              <div className="shrink-0 w-12 h-12 bg-yellow-500/20 border border-yellow-500/30 rounded-full flex items-center justify-center text-yellow-500 font-bold text-lg">
                {i + 1}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {String(step.title || "")}
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  {String(step.description || "")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ content }: { content: Record<string, unknown> }) {
  const title = String(content.title || "What Traders Say");
  const items = Array.isArray(content.items) ? content.items : [];

  return (
    <section className="py-20 px-6 bg-gray-900">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-16">
          {title}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((item: Record<string, unknown>, i: number) => (
            <div
              key={String(item.id || i)}
              className="p-6 bg-gray-800/50 border border-gray-700 rounded-2xl"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, si) => (
                  <Star
                    key={si}
                    className={`h-4 w-4 ${si < Number(item.rating || 5) ? "text-yellow-500 fill-yellow-500" : "text-gray-600"}`}
                  />
                ))}
              </div>
              <p className="text-gray-300 mb-4 italic">
                &ldquo;{String(item.quote || "")}&rdquo;
              </p>
              <div className="text-sm">
                <span className="text-white font-medium">
                  {String(item.name || "Trader")}
                </span>
                {item.role && (
                  <span className="text-gray-500 ml-2">
                    — {String(item.role)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection({ content }: { content: Record<string, unknown> }) {
  const title = String(content.title || "Ready to Start?");
  const subtitle = String(content.subtitle || "");
  const ctaText = String(content.ctaText || "Sign Up Now");
  const ctaUrl = String(content.ctaUrl || "/sign-up");

  return (
    <section className="py-20 px-6 bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-orange-500/10">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          {title}
        </h2>
        {subtitle && (
          <p className="text-gray-300 mb-8 text-lg">{subtitle}</p>
        )}
        <a
          href={ctaUrl}
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold rounded-xl text-lg hover:from-yellow-400 hover:to-amber-400 transition-all shadow-lg shadow-yellow-500/25"
        >
          {ctaText}
          <ArrowRight className="h-5 w-5" />
        </a>
      </div>
    </section>
  );
}

function FAQSection({ content }: { content: Record<string, unknown> }) {
  const title = String(content.title || "FAQ");
  const items = Array.isArray(content.items) ? content.items : [];

  return (
    <section className="py-20 px-6 bg-gray-950">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-16">
          {title}
        </h2>
        <div className="space-y-4">
          {items.map((item: Record<string, unknown>, i: number) => (
            <details
              key={String(item.id || i)}
              className="group border border-gray-800 rounded-xl overflow-hidden"
            >
              <summary className="flex items-center justify-between cursor-pointer px-6 py-4 bg-gray-900/50 hover:bg-gray-900 transition-colors">
                <span className="text-white font-medium">
                  {String(item.question || "")}
                </span>
                <ArrowRight className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-90" />
              </summary>
              <div className="px-6 py-4 text-gray-400 text-sm leading-relaxed">
                {String(item.answer || "")}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CustomHTMLSection({ content }: { content: Record<string, unknown> }) {
  const html = String(content.html || "");
  const sanitized = typeof window !== "undefined" ? DOMPurify.sanitize(html) : html;

  return (
    <section className="py-16 px-6">
      <div
        className="max-w-4xl mx-auto prose prose-invert"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    </section>
  );
}

// ─── Section Router ──────────────────────────────────────────────────────────
const sectionRenderers = new Map<
  string,
  React.ComponentType<{ content: Record<string, unknown> }>
>([
  ["hero", HeroSection],
  ["features", FeaturesSection],
  ["stats", StatsSection],
  ["how-it-works", HowItWorksSection],
  ["testimonials", TestimonialsSection],
  ["cta", CTASection],
  ["faq", FAQSection],
  ["custom-html", CustomHTMLSection],
]);

// ─── Main Renderer ───────────────────────────────────────────────────────────
export default function LandingPageRenderer({ page }: { page: SerializedPage }) {
  useTrackVisit(page.trackingId);

  const sortedSections = [...page.sections]
    .filter((s) => s.enabled !== false)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Custom CSS */}
      {page.customCss && <style>{page.customCss}</style>}

      {/* Sections */}
      {sortedSections.map((section) => {
        const Renderer = sectionRenderers.get(section.type);
        if (!Renderer) return null;
        return (
          <Renderer
            key={section.id}
            content={(section.content || {}) as Record<string, unknown>}
          />
        );
      })}

      {/* Risk Disclaimer */}
      {page.showRiskDisclaimer && (
        <footer className="py-8 px-6 bg-gray-950 border-t border-gray-800">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong>Risk Warning:</strong> Trading involves significant risk of
              loss and is not suitable for all investors. Past performance is not
              indicative of future results. You should not invest money that you
              cannot afford to lose. Please ensure you understand the risks
              involved before participating.
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
