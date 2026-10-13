import type { NeonAccordionSection } from "@/components/neon/Accordion";
import { MOBILE_CARD_SHELL } from "./MobileLobbyCard";

/**
 * One lobby rule section (Eligible Assets, Trading Rules, Risk Management) as an open card
 * inside its tab page - the same section and content the desktop accordion renders, built by
 * `buildTradingLobbySections` on the server.
 *
 * Open rather than collapsible since 13 Oct 2026: each tab is already a small page, so a fold
 * inside it would be a second layer of hiding.
 */
export function MobileSectionCard({ section }: { section: NeonAccordionSection }) {
  return (
    <section className={MOBILE_CARD_SHELL}>
      <h2 className="flex min-h-12 min-w-0 items-center gap-2.5 px-4 py-3 text-[15px] font-bold text-white">
        <span className="shrink-0">{section.icon}</span>
        <span className="min-w-0 truncate">{section.title}</span>
      </h2>
      <div className="min-w-0 border-t border-white/[0.06] p-3 text-[14px] leading-relaxed text-gray-200 [&_p]:break-words">
        {section.content}
      </div>
    </section>
  );
}
