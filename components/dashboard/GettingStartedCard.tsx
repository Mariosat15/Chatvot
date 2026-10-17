"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Wallet,
  Trophy,
  Swords,
  Gamepad2,
  Map,
  CheckCircle2,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTerms } from "@/contexts/TerminologyContext";
import {
  buildGettingStartedSteps,
  type GettingStartedFacts,
} from "@/lib/utils/getting-started-steps";

interface GettingStartedCardProps {
  tradingEnabled: boolean;
  hasFundedWallet: boolean;
  hasJoinedCompetition: boolean;
  hasPlacedTrade: boolean;
  hasPlayedGame: boolean;
  hasCompletedMilestone: boolean;
  hasChallengedUser: boolean;
}

const DISMISS_KEY = "chartvolt_onboarding_dismissed";

const STEP_ICONS: Record<string, React.ReactNode> = {
  fund: <Wallet className="size-5" />,
  competition: <Trophy className="size-5" />,
  play: <Gamepad2 className="size-5" />,
  milestone: <Map className="size-5" />,
  challenge: <Swords className="size-5" />,
};

export default function GettingStartedCard({
  tradingEnabled,
  hasFundedWallet,
  hasJoinedCompetition,
  hasPlacedTrade,
  hasPlayedGame,
  hasCompletedMilestone,
  hasChallengedUser,
}: GettingStartedCardProps) {
  const terms = useTerms();
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY);
    setDismissed(stored === "true");
  }, []);

  const facts: GettingStartedFacts = {
    tradingEnabled,
    hasFundedWallet,
    hasJoinedCompetition,
    hasPlacedTrade,
    hasPlayedGame,
    hasCompletedMilestone,
    hasChallengedUser,
  };
  const steps = buildGettingStartedSteps(facts, terms);

  const completedCount = steps.filter((s) => s.completed).length;
  const allComplete = completedCount === steps.length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  // Reason: dismissed starts null to avoid hydration flash; only render once client reads localStorage
  if (dismissed === null || dismissed || allComplete) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, "true");
  };

  return (
    <div className="relative bg-gradient-to-br from-primary/10 via-dark-200 to-purple-900/10 rounded-2xl border border-primary/20 p-5 shadow-lg overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">
              Getting Started
            </h3>
            <p className="text-sm text-gray-400 mt-0.5">
              Complete these steps to get competing
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-500 hover:text-gray-300 transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Dismiss getting started guide"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
            <span>{completedCount} of {steps.length} completed</span>
            <span className="font-semibold text-primary">{progressPercent}%</span>
          </div>
          <div className="h-2 bg-dark-400 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {steps.map((step) => (
            <Link
              key={step.id}
              href={step.href}
              className={cn(
                "group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200",
                step.completed
                  ? "bg-green-500/10 border-green-500/30 cursor-default"
                  : "bg-dark-300/50 border-dark-400/30 hover:border-primary/40 hover:bg-dark-300",
              )}
            >
              <div
                className={cn(
                  "flex-shrink-0 p-2 rounded-lg",
                  step.completed
                    ? "bg-green-500/20 text-green-400"
                    : "bg-dark-400/50 text-gray-400 group-hover:text-primary group-hover:bg-primary/10",
                )}
              >
                {step.completed ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  STEP_ICONS[step.id] ?? <Trophy className="size-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-semibold truncate",
                    step.completed ? "text-green-400" : "text-white",
                  )}
                >
                  {step.title}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {step.completed ? "Done!" : step.description}
                </p>
              </div>
              {!step.completed && (
                <ChevronRight className="size-4 text-gray-600 group-hover:text-primary flex-shrink-0" />
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
