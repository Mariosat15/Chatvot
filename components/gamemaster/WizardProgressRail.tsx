"use client";

import Link from "next/link";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRIMARY_BUTTON =
  "inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 font-medium hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50";

/** Previous / Next / Create row under a wizard step. Cancel returns to the GM dashboard. */
export function WizardFooterNav({
  isFirst,
  isLast,
  canCreate,
  submitting,
  onPrevious,
  onNext,
  onCreate,
}: {
  isFirst: boolean;
  isLast: boolean;
  canCreate: boolean;
  submitting: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-gray-700/50 px-6 py-4">
      {isFirst ? (
        <Link href="/gamemaster" className="text-sm text-gray-400 hover:text-white">
          Cancel
        </Link>
      ) : (
        <button
          type="button"
          onClick={onPrevious}
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
      )}
      {isLast ? (
        <button
          type="button"
          disabled={submitting || !canCreate}
          onClick={onCreate}
          className={PRIMARY_BUTTON}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {canCreate ? "Create competition" : "Daily limit reached"}
        </button>
      ) : (
        <button type="button" onClick={onNext} disabled={!canCreate} className={PRIMARY_BUTTON}>
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export interface WizardRailStep {
  number: number;
  title: string;
  description: string;
  icon: LucideIcon;
}

/** Sidebar step list for a multi-step wizard. Only finished steps can be revisited. */
export function WizardProgressRail({
  heading,
  steps,
  step,
  onStep,
}: {
  heading: string;
  steps: readonly WizardRailStep[];
  step: number;
  onStep: (n: number) => void;
}) {
  return (
    <div className="sticky top-20 rounded-2xl border border-gray-700/50 bg-gradient-to-br from-gray-800 to-gray-900 p-4 shadow-2xl sm:p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
        {heading}
      </h3>
      <div className="space-y-3">
        {steps.map((s) => {
          const Icon = s.icon;
          const active = step === s.number;
          const done = step > s.number;
          return (
            <button
              key={s.number}
              type="button"
              disabled={!done && !active}
              onClick={() => done && onStep(s.number)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl p-3 text-left transition",
                active && "bg-cyan-600/80 shadow-lg",
                done && !active && "bg-gray-700/50 hover:bg-gray-700",
                !done && !active && "bg-gray-800/50 opacity-60",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  active ? "bg-white/20" : done ? "bg-green-500/20" : "bg-gray-700/50",
                )}
              >
                {done ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <Icon className={cn("h-4 w-4", active ? "text-white" : "text-gray-400")} />
                )}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-sm font-semibold",
                    active ? "text-white" : "text-gray-300",
                  )}
                >
                  {s.title}
                </span>
                <span
                  className={cn("block text-xs", active ? "text-white/80" : "text-gray-500")}
                >
                  {s.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
