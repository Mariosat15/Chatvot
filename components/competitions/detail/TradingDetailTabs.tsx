"use client";

import { useState } from "react";
import {
  ChartNoAxesCombined,
  Flag,
  Scale,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NeonPanel } from "@/components/neon/Cards";
import { ContestHowItWorks } from "@/components/competitions/lobby/ContestHowItWorks";
import {
  contestAboutFallback,
  contestFeatures,
} from "@/components/competitions/lobby/contest-lobby-copy";

/**
 * Trading main-column tabs under the leaderboard (spec §31–40).
 * Overview is playful + How It Works; Rules / Scoring / Assets group real data.
 */

type TabId = "overview" | "rules" | "scoring" | "assets";

const TABS: Array<{ id: TabId; label: string; Icon: LucideIcon }> = [
  { id: "overview", label: "Overview", Icon: Sparkles },
  { id: "rules", label: "Rules", Icon: Scale },
  { id: "scoring", label: "Scoring", Icon: Flag },
  { id: "assets", label: "Assets", Icon: ChartNoAxesCombined },
];

const FEATURE_ICONS = new Map<string, LucideIcon>([
  ["Live markets", ChartNoAxesCombined],
  ["Global rivals", Users],
  ["Climb for glory", Trophy],
  ["Prize drops", Zap],
]);

export function TradingDetailTabs({
  description,
  startingCapital,
  maxLeverage,
  minimumTrades,
  rankingMethod,
  assets,
}: {
  description?: string | null;
  startingCapital?: number | null;
  maxLeverage?: number | null;
  minimumTrades?: number | null;
  rankingMethod?: string | null;
  assets?: string[] | null;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const about =
    typeof description === "string" && description.trim()
      ? description.trim()
      : contestAboutFallback("trading");
  const features = contestFeatures("trading");
  const assetList = (assets ?? []).filter(
    (a) => typeof a === "string" && a.trim().length > 0,
  );

  return (
    <NeonPanel accent="players" size="lg" className="!p-0 overflow-hidden">
      <div className="flex flex-wrap gap-1 border-b border-[#1B2540] bg-[#080C18]/60 px-3 pt-3 sm:px-4">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-t-lg px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? "border border-b-0 border-[#1B2540] bg-[#0A1228] text-sky-200"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          );
        })}
      </div>

      <div className="space-y-5 p-4 sm:p-5" role="tabpanel">
        {tab === "overview" && (
          <>
            <div>
              <h3 className="text-lg font-semibold text-gray-100">
                About this competition
              </h3>
              <p className="mt-2 text-base leading-relaxed text-gray-300">
                {about}
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {features.map((feature) => {
                const Icon = FEATURE_ICONS.get(feature.title) ?? Sparkles;
                return (
                  <li
                    key={feature.title}
                    className="flex items-start gap-3 rounded-xl border border-[#1B2540] bg-[#080C18]/50 p-3.5"
                  >
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
                    <div>
                      <p className="text-sm font-semibold text-gray-100">
                        {feature.title}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-400">
                        {feature.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <ContestHowItWorks kind="trading" embedded />
          </>
        )}

        {tab === "rules" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <RuleGroup title="Trading setup">
              {startingCapital != null && (
                <RuleLine
                  label="Starting capital"
                  value={String(startingCapital)}
                />
              )}
              {maxLeverage != null && maxLeverage > 0 && (
                <RuleLine label="Max leverage" value={`${maxLeverage}x`} />
              )}
              {assetList.length > 0 && (
                <RuleLine
                  label="Allowed markets"
                  value={`${assetList.length} assets`}
                />
              )}
            </RuleGroup>
            <RuleGroup title="Participation">
              {minimumTrades != null && minimumTrades > 0 && (
                <RuleLine
                  label="Minimum trades"
                  value={String(minimumTrades)}
                />
              )}
              <RuleLine
                label="Window"
                value="Trade only while the competition is live"
              />
            </RuleGroup>
          </div>
        )}

        {tab === "scoring" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-100">
                How your score is calculated
              </h3>
              <p className="mt-2 text-base leading-relaxed text-gray-300">
                Your ranking follows this competition&apos;s scoring rules —
                usually performance, risk, and any minimum trade requirement.
              </p>
            </div>
            {rankingMethod && (
              <RuleLine label="Ranking method" value={humanize(rankingMethod)} />
            )}
            {minimumTrades != null && minimumTrades > 0 && (
              <RuleLine
                label="Minimum trades to qualify"
                value={String(minimumTrades)}
              />
            )}
          </div>
        )}

        {tab === "assets" &&
          (assetList.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {assetList.map((asset) => (
                <span
                  key={asset}
                  className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-200"
                >
                  {asset}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-base text-gray-400">
              Asset list is not set for this competition — check the rules tab
              or ask support before you enter.
            </p>
          ))}
      </div>
    </NeonPanel>
  );
}

function RuleGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#1B2540] bg-[#080C18]/50 p-4">
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-sky-300">
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RuleLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-right font-semibold text-gray-100">{value}</span>
    </div>
  );
}

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
