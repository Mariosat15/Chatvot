import { ChevronDown } from "lucide-react";
import type { NeonAccordionSection } from "@/components/neon/Accordion";
import { MOBILE_CARD_SHELL } from "./MobileLobbyCard";

/**
 * The lobby's rule sections (Eligible Assets, Trading Rules, Risk Management) as one
 * vertical list of collapsible cards - the same sections and content as the desktop
 * accordion, built by `buildTradingLobbySections` on the server.
 *
 * Native `<details>` keeps them server-rendered with no client state. Every section's
 * anchor is `lobby-<id>` so a jump chip can reach it.
 */

export function mobileSectionAnchor(id: string): string {
  return `lobby-${id}`;
}

export function MobileLobbySections({
  sections,
  openIds = [],
}: {
  sections: NeonAccordionSection[];
  openIds?: string[];
}) {
  if (sections.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {sections.map((section) => (
        <details
          key={section.id}
          id={mobileSectionAnchor(section.id)}
          open={openIds.includes(section.id)}
          className={`group scroll-mt-4 ${MOBILE_CARD_SHELL}`}
        >
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-2.5 text-[15px] font-bold text-white">
              <span className="shrink-0">{section.icon}</span>
              <span className="min-w-0 truncate">{section.title}</span>
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="min-w-0 border-t border-white/[0.06] p-3 text-[14px] leading-relaxed text-gray-200 [&_p]:break-words">
            {section.content}
          </div>
        </details>
      ))}
    </div>
  );
}
