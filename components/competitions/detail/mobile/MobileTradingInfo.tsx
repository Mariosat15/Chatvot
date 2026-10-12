"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { NeonAccordionSection } from "@/components/neon/Accordion";
import { TradingOverview } from "@/components/competitions/detail/TradingOverview";
import type { TradingOverviewCopy } from "@/components/competitions/lobby/trading-overview-copy";
import { contestAboutFallback } from "@/components/competitions/lobby/contest-lobby-copy";

/**
 * Phone Overview + rules: stacked accordion, not a sideways desktop tab strip.
 *
 * Sections are the same rendered output `buildTradingLobbySections` already builds for
 * desktop tabs (R39 — content crosses the boundary; icons stay as rendered nodes).
 */

export function MobileTradingInfo({
  description,
  sections,
  overview,
}: {
  description?: string | null;
  sections: NeonAccordionSection[];
  overview: TradingOverviewCopy;
}) {
  const about =
    typeof description === "string" && description.trim()
      ? description.trim()
      : contestAboutFallback("trading");

  return (
    <Accordion
      type="multiple"
      defaultValue={["overview"]}
      className="space-y-2.5"
    >
      <AccordionItem
        value="overview"
        className="overflow-hidden rounded-2xl border border-sky-400/35 bg-[#060A18]/90 px-0"
      >
        <AccordionTrigger className="px-4 py-3.5 text-left text-base font-bold text-white hover:no-underline">
          Overview &amp; Battle plan
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-4 pt-0">
          <TradingOverview about={about} overview={overview} />
        </AccordionContent>
      </AccordionItem>

      {sections.map((section) => (
        <AccordionItem
          key={section.id}
          value={section.id}
          className="overflow-hidden rounded-2xl border border-[#1B2540] bg-[#080C18]/90 px-0"
        >
          <AccordionTrigger className="gap-2 px-4 py-3.5 text-left text-base font-bold text-white hover:no-underline">
            <span className="inline-flex min-w-0 items-center gap-2">
              {section.icon}
              <span className="truncate">{section.title}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-4 pt-0">
            {section.content}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
