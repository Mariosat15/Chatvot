"use client";

import { HighlightMetricCard } from "../PerformanceHighlights";
import { PERF_SECTION_ICON } from "../performance-assets";
import type { Highlight } from "../performance-model";
import { MobilePerfHeading } from "./mobile-perf-shell";

/** One-and-a-half cards visible, swipe the rest. Not the desktop 8-up grid. */
export default function MobilePerformanceHighlights({ highlights }: { highlights: Highlight[] }) {
  return (
    <section data-perf-section="highlights">
      <MobilePerfHeading
        title="Performance Highlights"
        subtitle="Swipe for every headline. Change is against the previous period."
        icon={PERF_SECTION_ICON.highlights}
      />
      <div
        className="-mx-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Performance highlight metrics"
      >
        {highlights.map((highlight) => (
          <HighlightMetricCard
            key={highlight.key}
            highlight={highlight}
            className="h-[150px] w-[58vw] min-w-[58vw] max-w-[240px] shrink-0 snap-start"
          />
        ))}
      </div>
    </section>
  );
}
