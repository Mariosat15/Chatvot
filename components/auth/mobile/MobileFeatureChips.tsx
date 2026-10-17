"use client";

import { BarChart3, Gamepad2, Gift, Swords, Trophy } from "lucide-react";

const CHIPS = [
  { label: "Markets", icon: BarChart3 },
  { label: "Games", icon: Gamepad2 },
  { label: "Competitions", icon: Swords },
  { label: "Leaderboards", icon: Trophy },
  { label: "Rewards", icon: Gift },
] as const;

export default function MobileFeatureChips() {
  return (
    <ul className="mt-4 flex flex-wrap items-center justify-center gap-2">
      {CHIPS.map(({ label, icon: Icon }) => (
        <li
          key={label}
          className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-[#081428]/85 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-50"
        >
          <Icon className="h-3 w-3 text-cyan-300" aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  );
}
