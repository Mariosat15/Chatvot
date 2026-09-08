"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The contest wizard's chrome, extracted so two wizards cannot look like two products.
 *
 * WHY THIS EXISTS. `CompetitionCreatorForm.tsx` grew a progress rail, a Quick Preview and a
 * gradient step header over 2,900 lines, and the game wizard had a four-item breadcrumb and
 * a flat panel. An operator creating a contest on a game arrived somewhere that looked like
 * a different admin tool - which is not a cosmetic complaint: the two screens set the same
 * kinds of thing (name, entry fee, clock, prizes) and looking unrelated is what makes an
 * operator hunt for a field rather than expect it in the same place.
 *
 * IT IS CHROME ONLY, DELIBERATELY. Nothing here knows what a contest is, what a step
 * validates or what gets posted. The game wizard's steps and the trading form's steps stay
 * where they are; only the frame around them is shared. A shell that also owned the step
 * list would have to enumerate both games' steps, which is the shape behind every
 * "trading-shaped" defect in this codebase.
 *
 * `"use client"`, AND ITS CONSUMERS MUST BE CLIENT COMPONENTS TOO. `WizardStep.icon` is a
 * React component, and a component is a function: handing one across a server/client
 * boundary is exactly what took the trading lobby down on 6 September (R39). Both wizards
 * declare their steps inside their own `"use client"` file, so no boundary is crossed. Do
 * not build a step list in a server component and pass it in.
 */

export type WizardAccent =
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "yellow"
  | "red";

export interface WizardStep {
  /** Shown in the rail and as the step card's heading. */
  title: string;
  /** One line under the title. The rail shows it too, so keep it short. */
  description: string;
  icon: LucideIcon;
  accent: WizardAccent;
}

// Kept as whole class strings rather than composed from a colour name, because Tailwind
// scans source text: `from-${colour}-500` produces no CSS and the header renders grey.
const ACCENT: Record<
  WizardAccent,
  { gradient: string; border: string; glow: string; sub: string }
> = {
  blue: {
    gradient: "from-blue-500 to-blue-600",
    border: "border-blue-500/50",
    glow: "shadow-blue-500/10",
    sub: "text-blue-100",
  },
  green: {
    gradient: "from-green-500 to-green-600",
    border: "border-green-500/50",
    glow: "shadow-green-500/10",
    sub: "text-green-100",
  },
  purple: {
    gradient: "from-purple-500 to-purple-600",
    border: "border-purple-500/50",
    glow: "shadow-purple-500/10",
    sub: "text-purple-100",
  },
  orange: {
    gradient: "from-orange-500 to-orange-600",
    border: "border-orange-500/50",
    glow: "shadow-orange-500/10",
    sub: "text-orange-100",
  },
  yellow: {
    gradient: "from-yellow-500 to-yellow-600",
    border: "border-yellow-500/50",
    glow: "shadow-yellow-500/10",
    sub: "text-yellow-100",
  },
  red: {
    gradient: "from-red-500 to-red-600",
    border: "border-red-500/50",
    glow: "shadow-red-500/10",
    sub: "text-red-100",
  },
};

/**
 * The page banner above a wizard: back link, badge, title, one line of context.
 *
 * `icon` IS A RENDERED ELEMENT HERE, NOT A COMPONENT, and the difference is not stylistic.
 * This one is rendered by the wizard PAGES, which are server components, so the prop crosses
 * a server/client boundary - and a component is a function, which cannot. Passing
 * `<Gamepad2 />` sends an element, which is data. `WizardStep.icon` below stays a component
 * because both wizards build their step lists inside their own client files.
 */
export function WizardPageHeader({
  title,
  subtitle,
  icon,
  backHref,
  backLabel = "Back to Admin",
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  backHref: string;
  backLabel?: string;
}) {
  return (
    <div className="border-b border-gray-700/50 bg-gray-800/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-4">
          <Link href={backHref}>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-gray-300"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {backLabel}
            </Button>
          </Link>
          <div className="h-8 w-px bg-gray-700" />
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-500 rounded-xl blur-lg opacity-50" />
              <div className="relative h-12 w-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-xl [&>svg]:h-6 [&>svg]:w-6 [&>svg]:text-gray-900">
                {icon}
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-500 to-yellow-400 bg-clip-text text-transparent flex items-center gap-2">
                {title}
                <Sparkles className="h-5 w-5 text-yellow-500" />
              </h1>
              <p className="text-sm text-gray-400">{subtitle}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Two columns: a sticky sidebar of progress and preview, and the step itself. */
export function WizardShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1">
        <div className="sticky top-8 space-y-6">{sidebar}</div>
      </div>
      <div className="lg:col-span-2 space-y-6">{children}</div>
    </div>
  );
}

/** The Creation Progress rail. `currentIndex` is zero-based. */
export function WizardStepRail({
  steps,
  currentIndex,
  heading = "Creation Progress",
}: {
  steps: readonly WizardStep[];
  currentIndex: number;
  heading?: string;
}) {
  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-2xl p-6 shadow-2xl">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">
        {heading}
      </h3>
      <div className="space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;

          return (
            <div key={step.title}>
              <div
                className={`flex items-start gap-4 p-3 rounded-xl transition-all duration-300 ${
                  isActive
                    ? `bg-gradient-to-r ${ACCENT[step.accent].gradient} shadow-lg`
                    : isCompleted
                      ? "bg-gray-700/50"
                      : "bg-gray-800/50"
                }`}
              >
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    isActive
                      ? "bg-white/20"
                      : isCompleted
                        ? "bg-green-500/20"
                        : "bg-gray-700/50"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : (
                    <Icon
                      className={`h-5 w-5 ${isActive ? "text-white" : "text-gray-400"}`}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-semibold ${
                      isActive
                        ? "text-white"
                        : isCompleted
                          ? "text-gray-300"
                          : "text-gray-400"
                    }`}
                  >
                    {step.title}
                  </div>
                  <div
                    className={`text-xs mt-0.5 ${
                      isActive ? "text-white/80" : "text-gray-500"
                    }`}
                  >
                    {step.description}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className="ml-8 h-4 w-px bg-gray-700" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The Quick Preview card. Rows are supplied by the wizard, because the facts differ. */
export function WizardPreview({
  children,
  heading = "Quick Preview",
}: {
  children: ReactNode;
  heading?: string;
}) {
  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 rounded-2xl p-6 shadow-2xl">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        {heading}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function WizardPreviewRow({
  icon: Icon,
  iconClassName = "text-blue-400",
  label,
  value,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-700/30">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={`h-4 w-4 flex-shrink-0 ${iconClassName}`} />
        <span className="text-xs text-gray-400 truncate">{label}</span>
      </div>
      <span className="text-sm font-bold text-gray-200 text-right truncate">
        {value}
      </span>
    </div>
  );
}

/** One step: the accented header, the body, and whatever navigation the wizard needs. */
export function WizardStepCard({
  step,
  children,
  footer,
}: {
  step: WizardStep;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const accent = ACCENT[step.accent];
  const Icon = step.icon;

  return (
    <div
      className={`bg-gradient-to-br from-gray-800 to-gray-900 border ${accent.border} rounded-2xl shadow-2xl ${accent.glow} overflow-hidden`}
    >
      <div className={`bg-gradient-to-r ${accent.gradient} p-6`}>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{step.title}</h2>
            <p className={`${accent.sub} text-sm`}>{step.description}</p>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-6">{children}</div>

      {footer && (
        <div className="px-6 sm:px-8 pb-6 pt-0">
          <div className="flex items-center justify-between gap-4 pt-6 border-t border-gray-700">
            {footer}
          </div>
        </div>
      )}
    </div>
  );
}
