"use client";

import { useState } from "react";
import {
  ChartNoAxesCombined,
  Info,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NeonPanel } from "@/components/neon/Cards";
import type { NeonAccordionSection } from "@/components/neon/Accordion";
import { ContestHowItWorks } from "@/components/competitions/lobby/ContestHowItWorks";
import {
  contestAboutFallback,
  contestFeatures,
} from "@/components/competitions/lobby/contest-lobby-copy";

/**
 * The trading main column's tab bar, directly under the leaderboard (spec §31–40, owner's
 * 12 Oct 2026 mark-up: "the menus need to be on the top").
 *
 * Overview is the playful intro + How It Works; every other tab is one of the reference
 * sections that used to sit collapsed at the bottom of the sidebar (Eligible Assets, Trading
 * Rules, Scoring, Risk Management, Disqualification, Prizes). They are built on the server by
 * `buildTradingLobbySections` and handed in already rendered, so every value, fallback and
 * "omit when empty" condition stays in that one builder.
 *
 * `sections` must stay serialisable data + rendered output (R39): this is a client component
 * and a lucide component passed from the server page cannot cross the boundary.
 */

const FEATURE_ICONS = new Map<string, LucideIcon>([
  ["Live markets", ChartNoAxesCombined],
  ["Global rivals", Users],
  ["Climb for glory", Trophy],
  ["Prize drops", Zap],
]);

const OVERVIEW_ID = "overview";

export function TradingDetailTabs({
  description,
  sections,
}: {
  description?: string | null;
  sections: NeonAccordionSection[];
}) {
  const [tab, setTab] = useState<string>(OVERVIEW_ID);
  const about =
    typeof description === "string" && description.trim()
      ? description.trim()
      : contestAboutFallback("trading");
  const features = contestFeatures("trading");
  const active = sections.find((s) => s.id === tab);

  return (
    <NeonPanel accent="players" size="lg" className="!p-0 overflow-hidden">
      <div
        role="tablist"
        className="flex gap-1.5 overflow-x-auto border-b border-[#1B2540] bg-[#080C18]/70 p-2"
      >
        <TabButton
          active={tab === OVERVIEW_ID}
          onClick={() => setTab(OVERVIEW_ID)}
          icon={<Sparkles className="h-4 w-4 shrink-0 text-sky-300" />}
          label="Overview"
        />
        {sections.map((section) => (
          <TabButton
            key={section.id}
            active={tab === section.id}
            onClick={() => setTab(section.id)}
            icon={section.icon}
            label={section.title}
          />
        ))}
      </div>

      <div className="p-5 sm:p-6" role="tabpanel">
        {active ? (
          <div className="max-w-3xl text-base [&_p]:text-[15px]">
            <h3 className="mb-4 flex items-center gap-2.5 text-xl font-bold text-gray-100">
              {active.icon}
              {active.title}
            </h3>
            {active.content}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div>
              <h3 className="flex items-center gap-2.5 text-xl font-bold text-gray-100">
                <Info className="h-5 w-5 text-sky-300" />
                About this competition
              </h3>
              <p className="mt-3 text-base leading-relaxed text-gray-300">
                {about}
              </p>
              <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {features.map((feature) => {
                  const Icon = FEATURE_ICONS.get(feature.title) ?? Sparkles;
                  return (
                    <li
                      key={feature.title}
                      className="flex flex-col items-center rounded-xl border border-[#1B2540] bg-[#080C18]/60 px-3 py-4 text-center"
                    >
                      <Icon className="h-7 w-7 text-sky-300" />
                      <p className="mt-2 text-sm font-semibold text-gray-100">
                        {feature.title}
                      </p>
                      <p className="mt-1 text-xs leading-snug text-gray-400">
                        {feature.detail}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
            <ContestHowItWorks kind="trading" embedded layout="timeline" />
          </div>
        )}
      </div>
    </NeonPanel>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex min-w-fit flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? "border-sky-400/70 bg-sky-500/15 text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.25)]"
          : "border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
