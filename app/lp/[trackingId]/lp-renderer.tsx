/* eslint-disable @next/next/no-img-element */
// Reason: Landing page images are dynamic external URLs from Pexels API.
// next/image requires known hostnames in next.config, but LP images come from user/AI input.
"use client";

import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Shield,
  Zap,
  Star,
  CheckCircle,
  ArrowRight,
  Users,
  Target,
  Activity,
  BarChart3,
  Award,
  Medal,
  Globe,
  Clock,
  Timer,
  Calendar,
  Gift,
  Coins,
  Crown,
  Flame,
  Lock,
  LineChart,
  Layers,
  Eye,
  PenTool,
  Bell,
  Smartphone,
  Search,
  Settings,
  Lightbulb,
  Brain,
  Gauge,
  Repeat,
  Wallet,
  Heart,
  GraduationCap,
  BookOpen,
  Gamepad2,
  Gem,
  Headphones,
  Flag,
  Wifi,
  Swords,
  Map as MapIcon,
  UserPlus,
  RotateCw,
  Shuffle,
  Percent,
  Banknote,
  Sparkles,
  DollarSign,
  Rocket,
  ChevronRight,
  Play,
  Quote,
  Check,
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

interface SectionStyle {
  accentColor: string;
  bgGradient: string;
  bgImage: string;
  layout: string;
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

// ─── Icon Map (comprehensive) ────────────────────────────────────────────────
const iconMap = new Map<string, React.ComponentType<{ className?: string }>>([
  ["Trophy", Trophy],
  ["TrendingUp", TrendingUp],
  ["TrendingDown", TrendingDown],
  ["Shield", Shield],
  ["Zap", Zap],
  ["Star", Star],
  ["CheckCircle", CheckCircle],
  ["Users", Users],
  ["Target", Target],
  ["Activity", Activity],
  ["BarChart3", BarChart3],
  ["Award", Award],
  ["Medal", Medal],
  ["Globe", Globe],
  ["Clock", Clock],
  ["Timer", Timer],
  ["Calendar", Calendar],
  ["Gift", Gift],
  ["Coins", Coins],
  ["Crown", Crown],
  ["Flame", Flame],
  ["Lock", Lock],
  ["LineChart", LineChart],
  ["Layers", Layers],
  ["Eye", Eye],
  ["PenTool", PenTool],
  ["Bell", Bell],
  ["Smartphone", Smartphone],
  ["Search", Search],
  ["Settings", Settings],
  ["Lightbulb", Lightbulb],
  ["Brain", Brain],
  ["Gauge", Gauge],
  ["Repeat", Repeat],
  ["Wallet", Wallet],
  ["Heart", Heart],
  ["GraduationCap", GraduationCap],
  ["BookOpen", BookOpen],
  ["Gamepad2", Gamepad2],
  ["Gem", Gem],
  ["Headphones", Headphones],
  ["Flag", Flag],
  ["Wifi", Wifi],
  ["Swords", Swords],
  ["Map", MapIcon],
  ["UserPlus", UserPlus],
  ["RotateCw", RotateCw],
  ["Shuffle", Shuffle],
  ["Percent", Percent],
  ["Banknote", Banknote],
  ["ArrowRight", ArrowRight],
  ["Sparkles", Sparkles],
  ["DollarSign", DollarSign],
  ["Rocket", Rocket],
  ["ChevronRight", ChevronRight],
  ["Play", Play],
  ["Quote", Quote],
  ["Check", Check],
]);

// ─── Game Icon Support ────────────────────────────────────────────────────────
// Reason: The AI uses game icon paths like "/game-icons/skull.png" for themed icons.
// This component renders either a Lucide SVG icon or a game icon <img> depending on the value.
function isGameIconPath(icon: string): boolean {
  return icon.startsWith("/game-icons/") || icon.startsWith("/assets/") || icon.startsWith("/api/assets/");
}

function IconDisplay({
  icon,
  className,
  size = 28,
  fallbackIndex,
}: {
  icon: string;
  className?: string;
  size?: number;
  /** If the game-icon image fails, show this number as fallback */
  fallbackIndex?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  if (isGameIconPath(icon) && !imgFailed) {
    return (
      <img
        src={icon}
        alt=""
        width={size}
        height={size}
        className={`object-contain shrink-0 ${className || ""}`}
        draggable={false}
        onError={() => setImgFailed(true)}
      />
    );
  }

  // If image failed or it's a Lucide icon name
  if (imgFailed) {
    // Fallback: show step number or a generic Lucide icon
    if (fallbackIndex !== undefined) {
      return <span className={`font-extrabold ${className || ""}`}>{fallbackIndex}</span>;
    }
    const FallbackIcon = Zap;
    return <FallbackIcon className={className} />;
  }

  const LucideIcon = iconMap.get(icon) || Zap;
  return <LucideIcon className={className} />;
}

// ─── Per-Section Accent Color System ─────────────────────────────────────────
// Reason: All class strings are statically present so Tailwind CSS can detect them.
interface AccentClasses {
  text: string;
  bg10: string;
  bg20: string;
  border30: string;
  gradientBtn: string;
  gradientBtnHover: string;
  shadow: string;
  shadowHover: string;
  fill: string;
  divider: string;
  ring: string;
}

const ACCENT_MAP = new Map<string, AccentClasses>([
  [
    "yellow",
    {
      text: "text-yellow-500",
      bg10: "bg-yellow-500/10",
      bg20: "bg-yellow-500/20",
      border30: "border-yellow-500/30",
      gradientBtn: "from-yellow-500 to-amber-500",
      gradientBtnHover: "hover:from-yellow-400 hover:to-amber-400",
      shadow: "shadow-yellow-500/25",
      shadowHover: "hover:shadow-yellow-500/40",
      fill: "fill-yellow-500",
      divider: "from-yellow-500 to-amber-500",
      ring: "ring-yellow-500/30",
    },
  ],
  [
    "green",
    {
      text: "text-green-400",
      bg10: "bg-green-500/10",
      bg20: "bg-green-500/20",
      border30: "border-green-500/30",
      gradientBtn: "from-green-500 to-emerald-500",
      gradientBtnHover: "hover:from-green-400 hover:to-emerald-400",
      shadow: "shadow-green-500/25",
      shadowHover: "hover:shadow-green-500/40",
      fill: "fill-green-400",
      divider: "from-green-500 to-emerald-500",
      ring: "ring-green-500/30",
    },
  ],
  [
    "lime",
    {
      text: "text-lime-400",
      bg10: "bg-lime-500/10",
      bg20: "bg-lime-500/20",
      border30: "border-lime-500/30",
      gradientBtn: "from-lime-500 to-green-500",
      gradientBtnHover: "hover:from-lime-400 hover:to-green-400",
      shadow: "shadow-lime-500/25",
      shadowHover: "hover:shadow-lime-500/40",
      fill: "fill-lime-400",
      divider: "from-lime-500 to-green-500",
      ring: "ring-lime-500/30",
    },
  ],
  [
    "amber",
    {
      text: "text-amber-400",
      bg10: "bg-amber-500/10",
      bg20: "bg-amber-500/20",
      border30: "border-amber-500/30",
      gradientBtn: "from-amber-500 to-orange-500",
      gradientBtnHover: "hover:from-amber-400 hover:to-orange-400",
      shadow: "shadow-amber-500/25",
      shadowHover: "hover:shadow-amber-500/40",
      fill: "fill-amber-400",
      divider: "from-amber-500 to-orange-500",
      ring: "ring-amber-500/30",
    },
  ],
  [
    "red",
    {
      text: "text-red-400",
      bg10: "bg-red-500/10",
      bg20: "bg-red-500/20",
      border30: "border-red-500/30",
      gradientBtn: "from-red-500 to-rose-500",
      gradientBtnHover: "hover:from-red-400 hover:to-rose-400",
      shadow: "shadow-red-500/25",
      shadowHover: "hover:shadow-red-500/40",
      fill: "fill-red-400",
      divider: "from-red-500 to-rose-500",
      ring: "ring-red-500/30",
    },
  ],
  [
    "purple",
    {
      text: "text-purple-400",
      bg10: "bg-purple-500/10",
      bg20: "bg-purple-500/20",
      border30: "border-purple-500/30",
      gradientBtn: "from-purple-500 to-violet-500",
      gradientBtnHover: "hover:from-purple-400 hover:to-violet-400",
      shadow: "shadow-purple-500/25",
      shadowHover: "hover:shadow-purple-500/40",
      fill: "fill-purple-400",
      divider: "from-purple-500 to-violet-500",
      ring: "ring-purple-500/30",
    },
  ],
  [
    "sky",
    {
      text: "text-sky-400",
      bg10: "bg-sky-500/10",
      bg20: "bg-sky-500/20",
      border30: "border-sky-500/30",
      gradientBtn: "from-sky-500 to-blue-500",
      gradientBtnHover: "hover:from-sky-400 hover:to-blue-400",
      shadow: "shadow-sky-500/25",
      shadowHover: "hover:shadow-sky-500/40",
      fill: "fill-sky-400",
      divider: "from-sky-500 to-blue-500",
      ring: "ring-sky-500/30",
    },
  ],
  [
    "fuchsia",
    {
      text: "text-fuchsia-400",
      bg10: "bg-fuchsia-500/10",
      bg20: "bg-fuchsia-500/20",
      border30: "border-fuchsia-500/30",
      gradientBtn: "from-fuchsia-500 to-pink-500",
      gradientBtnHover: "hover:from-fuchsia-400 hover:to-pink-400",
      shadow: "shadow-fuchsia-500/25",
      shadowHover: "hover:shadow-fuchsia-500/40",
      fill: "fill-fuchsia-400",
      divider: "from-fuchsia-500 to-pink-500",
      ring: "ring-fuchsia-500/30",
    },
  ],
  [
    "blue",
    {
      text: "text-blue-400",
      bg10: "bg-blue-500/10",
      bg20: "bg-blue-500/20",
      border30: "border-blue-500/30",
      gradientBtn: "from-blue-500 to-cyan-500",
      gradientBtnHover: "hover:from-blue-400 hover:to-cyan-400",
      shadow: "shadow-blue-500/25",
      shadowHover: "hover:shadow-blue-500/40",
      fill: "fill-blue-400",
      divider: "from-blue-500 to-cyan-500",
      ring: "ring-blue-500/30",
    },
  ],
  [
    "emerald",
    {
      text: "text-emerald-400",
      bg10: "bg-emerald-500/10",
      bg20: "bg-emerald-500/20",
      border30: "border-emerald-500/30",
      gradientBtn: "from-emerald-500 to-teal-500",
      gradientBtnHover: "hover:from-emerald-400 hover:to-teal-400",
      shadow: "shadow-emerald-500/25",
      shadowHover: "hover:shadow-emerald-500/40",
      fill: "fill-emerald-400",
      divider: "from-emerald-500 to-teal-500",
      ring: "ring-emerald-500/30",
    },
  ],
  [
    "rose",
    {
      text: "text-rose-400",
      bg10: "bg-rose-500/10",
      bg20: "bg-rose-500/20",
      border30: "border-rose-500/30",
      gradientBtn: "from-rose-500 to-pink-500",
      gradientBtnHover: "hover:from-rose-400 hover:to-pink-400",
      shadow: "shadow-rose-500/25",
      shadowHover: "hover:shadow-rose-500/40",
      fill: "fill-rose-400",
      divider: "from-rose-500 to-pink-500",
      ring: "ring-rose-500/30",
    },
  ],
  [
    "violet",
    {
      text: "text-violet-400",
      bg10: "bg-violet-500/10",
      bg20: "bg-violet-500/20",
      border30: "border-violet-500/30",
      gradientBtn: "from-violet-500 to-purple-500",
      gradientBtnHover: "hover:from-violet-400 hover:to-purple-400",
      shadow: "shadow-violet-500/25",
      shadowHover: "hover:shadow-violet-500/40",
      fill: "fill-violet-400",
      divider: "from-violet-500 to-purple-500",
      ring: "ring-violet-500/30",
    },
  ],
  [
    "cyan",
    {
      text: "text-cyan-400",
      bg10: "bg-cyan-500/10",
      bg20: "bg-cyan-500/20",
      border30: "border-cyan-500/30",
      gradientBtn: "from-cyan-500 to-sky-500",
      gradientBtnHover: "hover:from-cyan-400 hover:to-sky-400",
      shadow: "shadow-cyan-500/25",
      shadowHover: "hover:shadow-cyan-500/40",
      fill: "fill-cyan-400",
      divider: "from-cyan-500 to-sky-500",
      ring: "ring-cyan-500/30",
    },
  ],
  [
    "orange",
    {
      text: "text-orange-400",
      bg10: "bg-orange-500/10",
      bg20: "bg-orange-500/20",
      border30: "border-orange-500/30",
      gradientBtn: "from-orange-500 to-red-500",
      gradientBtnHover: "hover:from-orange-400 hover:to-red-400",
      shadow: "shadow-orange-500/25",
      shadowHover: "hover:shadow-orange-500/40",
      fill: "fill-orange-400",
      divider: "from-orange-500 to-red-500",
      ring: "ring-orange-500/30",
    },
  ],
  [
    "teal",
    {
      text: "text-teal-400",
      bg10: "bg-teal-500/10",
      bg20: "bg-teal-500/20",
      border30: "border-teal-500/30",
      gradientBtn: "from-teal-500 to-emerald-500",
      gradientBtnHover: "hover:from-teal-400 hover:to-emerald-400",
      shadow: "shadow-teal-500/25",
      shadowHover: "hover:shadow-teal-500/40",
      fill: "fill-teal-400",
      divider: "from-teal-500 to-emerald-500",
      ring: "ring-teal-500/30",
    },
  ],
  [
    "pink",
    {
      text: "text-pink-400",
      bg10: "bg-pink-500/10",
      bg20: "bg-pink-500/20",
      border30: "border-pink-500/30",
      gradientBtn: "from-pink-500 to-rose-500",
      gradientBtnHover: "hover:from-pink-400 hover:to-rose-400",
      shadow: "shadow-pink-500/25",
      shadowHover: "hover:shadow-pink-500/40",
      fill: "fill-pink-400",
      divider: "from-pink-500 to-rose-500",
      ring: "ring-pink-500/30",
    },
  ],
  [
    "indigo",
    {
      text: "text-indigo-400",
      bg10: "bg-indigo-500/10",
      bg20: "bg-indigo-500/20",
      border30: "border-indigo-500/30",
      gradientBtn: "from-indigo-500 to-blue-500",
      gradientBtnHover: "hover:from-indigo-400 hover:to-blue-400",
      shadow: "shadow-indigo-500/25",
      shadowHover: "hover:shadow-indigo-500/40",
      fill: "fill-indigo-400",
      divider: "from-indigo-500 to-blue-500",
      ring: "ring-indigo-500/30",
    },
  ],
]);

const DEFAULT_ACCENT = ACCENT_MAP.get("yellow")!;

function getAccent(colorName: string): AccentClasses {
  return ACCENT_MAP.get(colorName) || DEFAULT_ACCENT;
}

// ─── Style Extractor ─────────────────────────────────────────────────────────
// Reason: Reads optional `style` object from section content for per-section theming.
function getSectionStyle(content: Record<string, unknown>): SectionStyle {
  const style = (content.style || {}) as Record<string, unknown>;
  return {
    accentColor: String(style.accentColor || "yellow"),
    bgGradient: String(style.bgGradient || ""),
    bgImage: String(style.bgImage || ""),
    layout: String(style.layout || "default"),
  };
}

/**
 * Reason: Templates may use either "headline"/"title" and "subheadline"/"subtitle"
 * and "ctaLink"/"ctaUrl". This helper normalizes both naming conventions.
 * Uses Map lookup to avoid ESLint object-injection-sink warnings.
 */
function str(content: Record<string, unknown>, ...keys: string[]): string {
  const contentMap = new Map(Object.entries(content));
  for (const k of keys) {
    const val = contentMap.get(k);
    if (val !== undefined && val !== null && val !== "") {
      return String(val);
    }
  }
  return "";
}

// ─── Background Wrapper ──────────────────────────────────────────────────────
// Reason: Reusable wrapper that applies per-section backgrounds (gradient, image, or plain).
function SectionBg({
  children,
  sectionStyle,
  fallbackBg,
  className = "",
}: {
  children: React.ReactNode;
  sectionStyle: SectionStyle;
  fallbackBg: string;
  className?: string;
}) {
  const hasBgImage = sectionStyle.bgImage && sectionStyle.bgImage !== "";
  const hasBgGradient = sectionStyle.bgGradient && sectionStyle.bgGradient !== "";

  if (hasBgImage) {
    return (
      <section
        className={`relative overflow-hidden ${className}`}
        style={{
          backgroundImage: `url(${sectionStyle.bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px]" />
        <div className="relative z-10">{children}</div>
      </section>
    );
  }

  if (hasBgGradient) {
    return (
      <section className={`bg-gradient-to-br ${sectionStyle.bgGradient} ${className}`}>
        {children}
      </section>
    );
  }

  return <section className={`${fallbackBg} ${className}`}>{children}</section>;
}

// ─── Section Renderers ───────────────────────────────────────────────────────

function HeroSection({ content }: { content: Record<string, unknown> }) {
  const headline = str(content, "headline", "title") || "Welcome";
  const subheadline = str(content, "subheadline", "subtitle");
  const ctaText = str(content, "ctaText") || "Get Started";
  const ctaUrl = str(content, "ctaLink", "ctaUrl") || "/sign-up";
  const bgImage = str(content, "backgroundImage");
  const bgGradient = str(content, "backgroundGradient");
  const badge = str(content, "badge");
  const secondaryCtaText = str(content, "secondaryCtaText");
  const secondaryCtaUrl = str(content, "secondaryCtaLink", "secondaryCtaUrl");
  const ss = getSectionStyle(content);
  const accent = getAccent(ss.accentColor);

  return (
    <section
      className="relative min-h-[90vh] flex items-center justify-center overflow-hidden"
      style={{
        backgroundImage: bgImage ? `url(${bgImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay — dynamic gradient or default dark */}
      <div
        className={`absolute inset-0 ${bgGradient ? `bg-gradient-to-b ${bgGradient}` : "bg-gradient-to-b from-gray-950/90 via-gray-900/80 to-gray-950/95"}`}
        style={{ mixBlendMode: bgImage ? "multiply" : undefined }}
      />
      {/* Extra dark overlay for text readability on images */}
      {bgImage && <div className="absolute inset-0 bg-black/40" />}

      {/* Decorative glow */}
      <div
        className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] ${accent.bg10} rounded-full blur-[120px] opacity-40`}
      />

      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto py-24">
        {badge && (
          <div
            className={`inline-flex items-center gap-2 px-5 py-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-full text-sm text-white/90 mb-10 font-medium ${accent.ring} ring-1`}
          >
            {badge}
          </div>
        )}
        <h1 className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold text-white mb-8 leading-[1.05] tracking-tight lp-glow lp-title">
          {headline}
        </h1>
        {subheadline && (
          <p className="text-lg md:text-xl lg:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed font-light">
            {subheadline}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href={ctaUrl}
            className={`inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r ${accent.gradientBtn} text-black font-bold rounded-2xl text-lg ${accent.gradientBtnHover} transition-all duration-300 shadow-xl ${accent.shadow} ${accent.shadowHover} hover:scale-105 hover:-translate-y-0.5 lp-pulse lp-btn lp-cta`}
          >
            {ctaText}
            <ArrowRight className="h-5 w-5" />
          </a>
          {secondaryCtaText && secondaryCtaUrl && (
            <a
              href={secondaryCtaUrl}
              className="inline-flex items-center gap-2 px-8 py-4 border border-white/20 text-white font-semibold rounded-2xl text-lg hover:bg-white/5 transition-all backdrop-blur-sm"
            >
              {secondaryCtaText}
              <ChevronRight className="h-5 w-5" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection({ content }: { content: Record<string, unknown> }) {
  const title = str(content, "headline", "title") || "Features";
  const subtitle = str(content, "subtitle", "subheadline");
  const items = Array.isArray(content.items) ? content.items : [];
  const ss = getSectionStyle(content);
  const accent = getAccent(ss.accentColor);
  const layout = ss.layout || "grid";

  if (layout === "alternating" && items.length > 0) {
    return (
      <SectionBg sectionStyle={ss} fallbackBg="bg-gray-950" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 lp-glow">{title}</h2>
            {subtitle && <p className="text-gray-400 text-lg max-w-2xl mx-auto">{subtitle}</p>}
            <div className={`w-20 h-1.5 bg-gradient-to-r ${accent.divider} mx-auto mt-6 rounded-full`} />
          </div>
          <div className="space-y-20">
            {items.map((item: Record<string, unknown>, i: number) => {
              const iconStr = String(item.icon || "Zap");
              const isReversed = i % 2 === 1;
              const itemImage = String(item.image || "");
              return (
                <div
                  key={String(item.id || i)}
                  className={`flex flex-col ${isReversed ? "lg:flex-row-reverse" : "lg:flex-row"} gap-12 items-center`}
                >
                  {itemImage ? (
                    <div className="lg:w-1/2 rounded-3xl overflow-hidden shadow-2xl">
                      <img src={itemImage} alt={String(item.title || "")} className="w-full h-64 lg:h-80 object-cover" />
                    </div>
                  ) : (
                    <div className={`lg:w-1/2 h-64 lg:h-80 rounded-3xl ${accent.bg10} flex items-center justify-center`}>
                      <IconDisplay icon={iconStr} className={`${accent.text} opacity-30`} size={96} fallbackIndex={i + 1} />
                    </div>
                  )}
                  <div className="lg:w-1/2 space-y-4">
                    <div className={`w-14 h-14 ${accent.bg10} rounded-2xl flex items-center justify-center`}>
                      <IconDisplay icon={iconStr} className={`h-7 w-7 ${accent.text}`} size={28} fallbackIndex={i + 1} />
                    </div>
                    <h3 className="text-2xl font-bold text-white">{String(item.title || "")}</h3>
                    <p className="text-gray-400 text-lg leading-relaxed">{String(item.description || "")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SectionBg>
    );
  }

  return (
    <SectionBg sectionStyle={ss} fallbackBg="bg-gray-950" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 lp-glow">{title}</h2>
          {subtitle && <p className="text-gray-400 text-lg max-w-2xl mx-auto">{subtitle}</p>}
          <div className={`w-20 h-1.5 bg-gradient-to-r ${accent.divider} mx-auto mt-6 rounded-full`} />
        </div>
        <div
          className={`grid grid-cols-1 md:grid-cols-2 ${items.length >= 3 ? "lg:grid-cols-3" : ""} ${items.length === 4 ? "lg:grid-cols-4" : ""} gap-8`}
        >
          {items.map((item: Record<string, unknown>, i: number) => {
            const iconStr = String(item.icon || "Zap");
            const itemImage = String(item.image || "");
            return (
              <div
                key={String(item.id || i)}
                className={`group relative p-8 bg-white/[0.03] border border-white/[0.06] rounded-3xl hover:${accent.border30} transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-black/20 overflow-hidden lp-glass lp-card`}
              >
                {/* Hover glow */}
                <div className={`absolute inset-0 ${accent.bg10} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl`} />
                <div className="relative z-10">
                  {itemImage ? (
                    <div className="w-full h-40 rounded-2xl overflow-hidden mb-6 -mt-2 -mx-2">
                      <img src={itemImage} alt={String(item.title || "")} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className={`w-14 h-14 ${accent.bg10} rounded-2xl flex items-center justify-center mb-6 group-hover:${accent.bg20} transition-colors duration-300`}>
                      <IconDisplay icon={iconStr} className={`h-7 w-7 ${accent.text}`} size={28} fallbackIndex={i + 1} />
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-white mb-3">{String(item.title || "")}</h3>
                  <p className="text-gray-400 leading-relaxed">{String(item.description || "")}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionBg>
  );
}

function StatsSection({ content }: { content: Record<string, unknown> }) {
  const title = str(content, "headline", "title") || "By the Numbers";
  const subtitle = str(content, "subtitle", "subheadline");
  const items = Array.isArray(content.items) ? content.items : [];
  const ss = getSectionStyle(content);
  const accent = getAccent(ss.accentColor);

  return (
    <SectionBg sectionStyle={ss} fallbackBg="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950" className="py-24 px-6">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 lp-glow">{title}</h2>
        {subtitle && <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-4">{subtitle}</p>}
        <div className={`w-20 h-1.5 bg-gradient-to-r ${accent.divider} mx-auto mb-16 rounded-full`} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {items.map((item: Record<string, unknown>, i: number) => {
            const iconStr = item.icon ? String(item.icon) : null;
            return (
              <div key={String(item.id || i)} className="group p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] transition-all duration-300 lp-glass lp-card">
                {iconStr && (
                  <div className={`w-12 h-12 ${accent.bg10} rounded-xl flex items-center justify-center mx-auto mb-4 lp-float lp-icon`}>
                    <IconDisplay icon={iconStr} className={`h-6 w-6 ${accent.text} opacity-80`} size={24} fallbackIndex={i + 1} />
                  </div>
                )}
                <div className={`text-4xl md:text-5xl font-extrabold ${accent.text} mb-3 tracking-tight`}>
                  {String(item.value || "0")}
                </div>
                <div className="text-gray-400 text-sm font-medium uppercase tracking-wider">
                  {String(item.label || "")}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionBg>
  );
}

function HowItWorksSection({ content }: { content: Record<string, unknown> }) {
  const title = str(content, "headline", "title") || "How It Works";
  const subtitle = str(content, "subtitle", "subheadline");
  const steps = Array.isArray(content.steps) ? content.steps : [];
  const ss = getSectionStyle(content);
  const accent = getAccent(ss.accentColor);
  const layout = ss.layout || "default";

  if (layout === "horizontal") {
    const colClass = steps.length <= 3
      ? "grid-cols-1 md:grid-cols-3"
      : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4";
    return (
      <SectionBg sectionStyle={ss} fallbackBg="bg-gray-950" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 lp-glow">{title}</h2>
            {subtitle && <p className="text-gray-400 text-lg max-w-2xl mx-auto">{subtitle}</p>}
            <div className={`w-20 h-1.5 bg-gradient-to-r ${accent.divider} mx-auto mt-6 rounded-full`} />
          </div>

          <div className={`grid ${colClass} gap-6 relative`}>
            {/* Connecting line between step icons (desktop only) */}
            {steps.length > 1 && (
              <div className="hidden md:block absolute top-[52px] left-[16%] right-[16%] h-[2px] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent z-0" />
            )}

            {steps.map((step: Record<string, unknown>, i: number) => {
              const iconStr = step.icon ? String(step.icon) : null;
              return (
                <div
                  key={String(step.id || i)}
                  className="relative z-10 group text-center p-8 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-400 hover:-translate-y-1 lp-glass lp-card"
                >
                  {/* Step number badge */}
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-gradient-to-br ${accent.gradientBtn} flex items-center justify-center shadow-lg ${accent.shadow}`}>
                    <span className="text-black font-bold text-xs">{i + 1}</span>
                  </div>

                  {/* Icon */}
                  <div className={`w-14 h-14 mx-auto mb-5 rounded-xl ${accent.bg10} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 lp-float lp-icon`}>
                    {iconStr ? (
                      <IconDisplay icon={iconStr} className={`h-7 w-7 ${accent.text}`} size={28} fallbackIndex={i + 1} />
                    ) : (
                      <span className={`font-extrabold text-lg ${accent.text}`}>{i + 1}</span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2">{String(step.title || "")}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{String(step.description || "")}</p>
                </div>
              );
            })}
          </div>
        </div>
      </SectionBg>
    );
  }

  return (
    <SectionBg sectionStyle={ss} fallbackBg="bg-gray-950" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 lp-glow">{title}</h2>
          {subtitle && <p className="text-gray-400 text-lg max-w-2xl mx-auto">{subtitle}</p>}
          <div className={`w-20 h-1.5 bg-gradient-to-r ${accent.divider} mx-auto mt-6 rounded-full`} />
        </div>
        <div className="space-y-5">
          {steps.map((step: Record<string, unknown>, i: number) => {
            const iconStr = step.icon ? String(step.icon) : null;
            return (
              <div
                key={String(step.id || i)}
                className="flex gap-5 items-center p-6 bg-white/[0.03] border border-white/[0.06] rounded-2xl hover:border-white/[0.12] transition-all duration-300 group lp-glass lp-card"
              >
                {/* Step number + icon */}
                <div className="shrink-0 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${accent.gradientBtn} flex items-center justify-center shadow-lg ${accent.shadow}`}>
                    <span className="text-black font-bold text-sm">{i + 1}</span>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${accent.bg10} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 lp-float lp-icon`}>
                    {iconStr ? (
                      <IconDisplay icon={iconStr} className={`h-6 w-6 ${accent.text}`} size={24} fallbackIndex={i + 1} />
                    ) : (
                      <span className={`font-extrabold text-lg ${accent.text}`}>{i + 1}</span>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white mb-1">{String(step.title || "")}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{String(step.description || "")}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionBg>
  );
}

function TestimonialsSection({ content }: { content: Record<string, unknown> }) {
  const title = str(content, "headline", "title") || "What Traders Say";
  const subtitle = str(content, "subtitle", "subheadline");
  const items = Array.isArray(content.items) ? content.items : [];
  const ss = getSectionStyle(content);
  const accent = getAccent(ss.accentColor);
  const layout = ss.layout || "grid";

  if (layout === "cards") {
    return (
      <SectionBg sectionStyle={ss} fallbackBg="bg-gray-900" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 lp-glow">{title}</h2>
            {subtitle && <p className="text-gray-400 text-lg max-w-2xl mx-auto">{subtitle}</p>}
            <div className={`w-20 h-1.5 bg-gradient-to-r ${accent.divider} mx-auto mt-6 rounded-full`} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {items.map((item: Record<string, unknown>, i: number) => (
              <div key={String(item.id || i)} className="p-8 bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.06] rounded-3xl hover:border-white/[0.1] transition-all duration-300 group">
                <Quote className={`h-8 w-8 ${accent.text} opacity-40 mb-6`} />
                <p className="text-gray-200 text-lg mb-8 leading-relaxed font-light italic">
                  &ldquo;{String(item.quote || "")}&rdquo;
                </p>
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${accent.gradientBtn} flex items-center justify-center text-black font-bold text-lg shadow-lg ${accent.shadow}`}>
                    {String(item.name || "T").charAt(0)}
                  </div>
                  <div>
                    <span className="text-white font-semibold text-lg block">{String(item.name || "Trader")}</span>
                    {item.role && <span className="text-gray-500 text-sm">{String(item.role)}</span>}
                  </div>
                  <div className="ml-auto flex gap-1">
                    {Array.from({ length: 5 }).map((_, si) => (
                      <Star key={si} className={`h-4 w-4 ${si < Number(item.rating || 5) ? `${accent.text} ${accent.fill}` : "text-gray-700"}`} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionBg>
    );
  }

  return (
    <SectionBg sectionStyle={ss} fallbackBg="bg-gray-900" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 lp-glow">{title}</h2>
          {subtitle && <p className="text-gray-400 text-lg max-w-2xl mx-auto">{subtitle}</p>}
          <div className={`w-20 h-1.5 bg-gradient-to-r ${accent.divider} mx-auto mt-6 rounded-full`} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {items.map((item: Record<string, unknown>, i: number) => (
            <div
              key={String(item.id || i)}
              className="p-8 bg-white/[0.03] border border-white/[0.06] rounded-3xl hover:border-white/[0.1] transition-all duration-300 group flex flex-col"
            >
              <div className="flex gap-1 mb-6">
                {Array.from({ length: 5 }).map((_, si) => (
                  <Star
                    key={si}
                    className={`h-5 w-5 ${si < Number(item.rating || 5) ? `${accent.text} ${accent.fill}` : "text-gray-700"}`}
                  />
                ))}
              </div>
              <p className="text-gray-200 mb-8 leading-relaxed flex-grow text-lg font-light italic">
                &ldquo;{String(item.quote || "")}&rdquo;
              </p>
              <div className="flex items-center gap-4 pt-6 border-t border-white/[0.06]">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${accent.gradientBtn} flex items-center justify-center text-black font-bold shadow-lg ${accent.shadow}`}>
                  {String(item.name || "T").charAt(0)}
                </div>
                <div>
                  <span className="text-white font-semibold block">{String(item.name || "Trader")}</span>
                  {item.role && <span className="text-gray-500 text-sm">{String(item.role)}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionBg>
  );
}

function CTASection({ content }: { content: Record<string, unknown> }) {
  const title = str(content, "headline", "title") || "Ready to Start?";
  const subtitle = str(content, "subheadline", "subtitle");
  const ctaText = str(content, "ctaText") || "Sign Up Now";
  const ctaUrl = str(content, "ctaLink", "ctaUrl") || "/sign-up";
  const secondaryText = str(content, "secondaryCtaText");
  const secondaryUrl = str(content, "secondaryCtaLink", "secondaryCtaUrl");
  const bgImage = str(content, "backgroundImage");
  const ss = getSectionStyle(content);
  const accent = getAccent(ss.accentColor);

  return (
    <section
      className="relative py-32 px-6 overflow-hidden"
      style={bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      {/* Background effects */}
      {bgImage ? (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      ) : (
        <>
          <div className={`absolute inset-0 bg-gradient-to-br ${ss.bgGradient || "from-gray-950 via-gray-900 to-gray-950"}`} />
          <div className={`absolute top-0 left-1/4 w-96 h-96 ${accent.bg10} rounded-full blur-[120px] opacity-30`} />
          <div className={`absolute bottom-0 right-1/4 w-96 h-96 ${accent.bg10} rounded-full blur-[120px] opacity-20`} />
        </>
      )}

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight">{title}</h2>
        {subtitle && <p className="text-gray-300 mb-12 text-xl leading-relaxed max-w-2xl mx-auto">{subtitle}</p>}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href={ctaUrl}
            className={`inline-flex items-center justify-center gap-3 px-10 py-5 bg-gradient-to-r ${accent.gradientBtn} text-black font-bold rounded-2xl text-lg ${accent.gradientBtnHover} transition-all duration-300 shadow-xl ${accent.shadow} ${accent.shadowHover} hover:scale-105 lp-pulse lp-btn lp-cta`}
          >
            {ctaText}
            <ArrowRight className="h-5 w-5" />
          </a>
          {secondaryText && secondaryUrl && (
            <a
              href={secondaryUrl}
              className="inline-flex items-center justify-center gap-2 px-8 py-5 border border-white/20 text-white font-semibold rounded-2xl text-lg hover:bg-white/5 transition-all backdrop-blur-sm"
            >
              {secondaryText}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function FAQSection({ content }: { content: Record<string, unknown> }) {
  const title = str(content, "headline", "title") || "FAQ";
  const subtitle = str(content, "subtitle", "subheadline");
  const items = Array.isArray(content.items) ? content.items : [];
  const ss = getSectionStyle(content);
  const accent = getAccent(ss.accentColor);

  return (
    <SectionBg sectionStyle={ss} fallbackBg="bg-gray-950" className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 lp-glow">{title}</h2>
          {subtitle && <p className="text-gray-400 text-lg max-w-2xl mx-auto">{subtitle}</p>}
          <div className={`w-20 h-1.5 bg-gradient-to-r ${accent.divider} mx-auto mt-6 rounded-full`} />
        </div>
        <div className="space-y-4">
          {items.map((item: Record<string, unknown>, i: number) => (
            <details
              key={String(item.id || i)}
              className="group border border-white/[0.06] rounded-2xl overflow-hidden bg-white/[0.02] hover:border-white/[0.1] transition-colors"
            >
              <summary className="flex items-center justify-between cursor-pointer px-8 py-6 hover:bg-white/[0.02] transition-colors">
                <span className="text-white font-semibold pr-4 text-lg">{String(item.question || "")}</span>
                <ChevronRight className={`h-5 w-5 ${accent.text} shrink-0 transition-transform duration-300 group-open:rotate-90`} />
              </summary>
              <div className="px-8 py-6 text-gray-400 leading-relaxed border-t border-white/[0.06]">
                {String(item.answer || "")}
              </div>
            </details>
          ))}
        </div>
      </div>
    </SectionBg>
  );
}

function ImageTextSection({ content }: { content: Record<string, unknown> }) {
  const title = str(content, "headline", "title") || "";
  const subtitle = str(content, "subtitle", "subheadline");
  const description = str(content, "description", "text");
  const image = str(content, "image", "backgroundImage");
  const ctaText = str(content, "ctaText");
  const ctaUrl = str(content, "ctaLink", "ctaUrl") || "/sign-up";
  const ss = getSectionStyle(content);
  const accent = getAccent(ss.accentColor);
  const reversed = ss.layout === "reversed";
  const bullets = Array.isArray(content.bullets) ? content.bullets : [];

  return (
    <SectionBg sectionStyle={ss} fallbackBg="bg-gray-950" className="py-24 px-6">
      <div className={`max-w-7xl mx-auto flex flex-col ${reversed ? "lg:flex-row-reverse" : "lg:flex-row"} gap-16 items-center`}>
        {/* Image side */}
        <div className="lg:w-1/2 relative">
          {image ? (
            <div className="rounded-3xl overflow-hidden shadow-2xl shadow-black/40">
              <img src={image} alt={title} className="w-full h-[400px] lg:h-[500px] object-cover" />
            </div>
          ) : (
            <div className={`w-full h-[400px] lg:h-[500px] rounded-3xl bg-gradient-to-br ${ss.bgGradient || "from-gray-800 to-gray-900"} flex items-center justify-center`}>
              <Play className={`h-20 w-20 ${accent.text} opacity-20`} />
            </div>
          )}
          {/* Decorative accent */}
          <div className={`absolute -bottom-4 -right-4 w-32 h-32 ${accent.bg10} rounded-3xl -z-10`} />
        </div>

        {/* Text side */}
        <div className="lg:w-1/2 space-y-6">
          {subtitle && <span className={`text-sm font-bold ${accent.text} uppercase tracking-[0.2em]`}>{subtitle}</span>}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight lp-glow">{title}</h2>
          {description && <p className="text-gray-400 text-lg leading-relaxed">{description}</p>}
          {bullets.length > 0 && (
            <ul className="space-y-4 pt-4">
              {bullets.map((b: unknown, i: number) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className={`h-5 w-5 ${accent.text} mt-1 shrink-0`} />
                  <span className="text-gray-300">{String(b)}</span>
                </li>
              ))}
            </ul>
          )}
          {ctaText && (
            <a
              href={ctaUrl}
              className={`inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r ${accent.gradientBtn} text-black font-bold rounded-2xl text-lg ${accent.gradientBtnHover} transition-all shadow-lg ${accent.shadow} hover:scale-105 mt-4`}
            >
              {ctaText}
              <ArrowRight className="h-5 w-5" />
            </a>
          )}
        </div>
      </div>
    </SectionBg>
  );
}

function BannerSection({ content }: { content: Record<string, unknown> }) {
  const title = str(content, "headline", "title") || "";
  const subtitle = str(content, "subtitle", "subheadline");
  const image = str(content, "backgroundImage", "image");
  const ctaText = str(content, "ctaText");
  const ctaUrl = str(content, "ctaLink", "ctaUrl") || "/sign-up";
  const ss = getSectionStyle(content);
  const accent = getAccent(ss.accentColor);

  return (
    <section
      className="relative py-32 px-6 overflow-hidden"
      style={image ? { backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      <div className={`absolute inset-0 ${image ? "bg-black/60" : `bg-gradient-to-r ${ss.bgGradient || "from-gray-900 to-gray-950"}`}`} />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40" />
      <div className="max-w-5xl mx-auto text-center relative z-10">
        <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-6 leading-tight">{title}</h2>
        {subtitle && <p className="text-gray-200 text-xl max-w-2xl mx-auto mb-10">{subtitle}</p>}
        {ctaText && (
          <a
            href={ctaUrl}
            className={`inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r ${accent.gradientBtn} text-black font-bold rounded-2xl text-lg ${accent.gradientBtnHover} transition-all shadow-xl ${accent.shadow} hover:scale-105`}
          >
            {ctaText}
            <ArrowRight className="h-5 w-5" />
          </a>
        )}
      </div>
    </section>
  );
}

function GallerySection({ content }: { content: Record<string, unknown> }) {
  const title = str(content, "headline", "title") || "Gallery";
  const subtitle = str(content, "subtitle", "subheadline");
  const items = Array.isArray(content.items) ? content.items : [];
  const ss = getSectionStyle(content);
  const accent = getAccent(ss.accentColor);

  return (
    <SectionBg sectionStyle={ss} fallbackBg="bg-gray-950" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 lp-glow">{title}</h2>
          {subtitle && <p className="text-gray-400 text-lg max-w-2xl mx-auto">{subtitle}</p>}
          <div className={`w-20 h-1.5 bg-gradient-to-r ${accent.divider} mx-auto mt-6 rounded-full`} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item: Record<string, unknown>, i: number) => (
            <div key={String(item.id || i)} className="group rounded-3xl overflow-hidden relative">
              <img
                src={String(item.image || item.url || item.src || "")}
                alt={String(item.title || item.alt || "")}
                className="w-full h-72 object-cover group-hover:scale-110 transition-transform duration-700"
              />
              {(item.title || item.description) && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-6">
                  <div>
                    {item.title && <h3 className="text-white font-bold text-lg">{String(item.title)}</h3>}
                    {item.description && <p className="text-gray-300 text-sm mt-1">{String(item.description)}</p>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </SectionBg>
  );
}

function CustomHTMLSection({ content }: { content: Record<string, unknown> }) {
  const html = String(content.html || "");
  const sanitized = typeof window !== "undefined" ? DOMPurify.sanitize(html) : html;

  return (
    <section className="py-16 px-6">
      <div className="max-w-4xl mx-auto prose prose-invert prose-lg" dangerouslySetInnerHTML={{ __html: sanitized }} />
    </section>
  );
}

// ─── Section Router ──────────────────────────────────────────────────────────
const sectionRenderers = new Map<string, React.ComponentType<{ content: Record<string, unknown> }>>([
  ["hero", HeroSection],
  ["features", FeaturesSection],
  ["stats", StatsSection],
  ["how-it-works", HowItWorksSection],
  ["testimonials", TestimonialsSection],
  ["cta", CTASection],
  ["faq", FAQSection],
  ["image-text", ImageTextSection],
  ["banner", BannerSection],
  ["gallery", GallerySection],
  ["custom-html", CustomHTMLSection],
]);

// ─── Main Renderer ───────────────────────────────────────────────────────────
export default function LandingPageRenderer({ page }: { page: SerializedPage }) {
  useTrackVisit(page.trackingId);

  const sortedSections = [...page.sections]
    .filter((s) => s.enabled !== false)
    .sort((a, b) => a.order - b.order);

  return (
    <div className={`min-h-screen bg-gray-950 text-white antialiased ${page.customCss ? "lp-page lp-animated-bg" : ""}`}>
      {/* Custom CSS + auto-mapping rules */}
      {page.customCss && (
        <style>{`${page.customCss}
/* Auto-map lp-* classes to elements when defined */
${page.customCss.includes(".lp-glow") ? ".lp-page h1,.lp-page h2{text-shadow:inherit}.lp-page h1,.lp-page h2{text-shadow:0 0 20px var(--lp-glow-color,rgba(0,255,0,0.5)),0 0 40px var(--lp-glow-color,rgba(0,255,0,0.3))}" : ""}
${page.customCss.includes(".lp-glass") ? ".lp-page [class*='border-white']:not(footer):not(summary){backdrop-filter:blur(8px);border-color:var(--lp-accent-color,rgba(0,255,0,0.12))!important}" : ""}
${page.customCss.includes(".lp-scanline") ? ".lp-page section{position:relative}.lp-page section::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.03) 2px,rgba(0,0,0,0.03) 4px);pointer-events:none;z-index:1}" : ""}
`}</style>
      )}

      {/* Sections */}
      {sortedSections.map((section) => {
        const Renderer = sectionRenderers.get(section.type);
        if (!Renderer) return null;
        return (
          <Renderer key={section.id} content={(section.content || {}) as Record<string, unknown>} />
        );
      })}

      {/* Risk Disclaimer */}
      {page.showRiskDisclaimer && (
        <footer className="py-10 px-6 bg-gray-950 border-t border-white/[0.06]">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong>Risk Warning:</strong> Trading involves significant risk of loss and is not suitable for all investors. Past
              performance is not indicative of future results. You should not invest money that you cannot afford to lose. Please
              ensure you understand the risks involved before participating.
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
