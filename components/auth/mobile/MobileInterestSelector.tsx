"use client";

import { BarChart3, Gamepad2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SIGNUP_INTEREST_OPTIONS,
  type SignupInterest,
} from "@/lib/utils/signup-interest";

function interestIcon(value: SignupInterest) {
  if (value === "trading") return BarChart3;
  if (value === "games") return Gamepad2;
  return Trophy;
}

function selectedClasses(value: SignupInterest) {
  if (value === "trading") {
    return "border-cyan-400 bg-cyan-400/15 shadow-[0_0_16px_rgba(34,211,238,0.25)]";
  }
  if (value === "games") {
    return "border-fuchsia-400 bg-fuchsia-500/15 shadow-[0_0_16px_rgba(217,70,239,0.25)]";
  }
  return "border-yellow-400 bg-yellow-400/15 shadow-[0_0_16px_rgba(250,204,21,0.25)]";
}

function interestCopy(value: SignupInterest): {
  title: string;
  description: string;
} {
  if (value === "trading") {
    return {
      title: "Trading",
      description: "Trading competitions & challenges",
    };
  }
  if (value === "games") {
    return {
      title: "Games",
      description: "Skill games & competitions",
    };
  }
  return { title: "Both", description: "Trading + games" };
}

type Props = {
  value?: SignupInterest;
  onChange: (value: SignupInterest) => void;
  error?: string;
};

export default function MobileInterestSelector({
  value,
  onChange,
  error,
}: Props) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-white">
        What do you want to compete in?
      </legend>
      <div className="grid grid-cols-1 gap-2.5">
        {SIGNUP_INTEREST_OPTIONS.map((opt) => {
          const Icon = interestIcon(opt.value);
          const selected = value === opt.value;
          const copy = interestCopy(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                selected
                  ? selectedClasses(opt.value)
                  : "border-cyan-300/20 bg-[#06101e]/80",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  selected ? "text-white" : "text-cyan-300/80",
                )}
              />
              <span>
                <span className="block text-[15px] font-semibold text-white">
                  {copy.title}
                </span>
                <span className="block text-[12px] text-cyan-100/65">
                  {copy.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </fieldset>
  );
}
