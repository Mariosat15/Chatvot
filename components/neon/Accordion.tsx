"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * The collapsible pills along the bottom of the sheet - Eligible Assets, Risk Management,
 * Scoring, Trading Rules, Disqualification, Prizes.
 *
 * THIS IS THE ONE PART OF THE RESTYLE THAT CHANGES BEHAVIOUR, so it is worth being exact about
 * what it costs. The trading lobby's sidebar renders nine cards, always open, roughly six
 * hundred lines of them, and a trader reading the page today sees every rule without clicking.
 * Collapsing them is what the owner's mock asks for and it does hide information behind a
 * click. The mitigation is in the mapping rather than in this component: the things a player
 * acts on - the entry button, the countdown, the schedule, the prize split - stay open, and
 * only the reference material collapses. **If a future change moves the prize split or the
 * countdown inside an accordion, that is the mistake this note exists to prevent.**
 *
 * BUILT ON THE RADIX ACCORDION ALREADY IN `components/ui/accordion.tsx` rather than on a
 * `useState` toggle. Keyboard navigation, `aria-expanded`, the arrow keys between headers and
 * the open/close animation all come free, and a hand-rolled toggle gets the first two wrong
 * silently - it looks correct to everyone reviewing it with a mouse.
 *
 * `type="multiple"` because these are independent reference sections. A single-open accordion
 * would close the disqualification rules when a player opened the prize table, which is
 * actively unhelpful when the two are being compared.
 *
 * EVERY PROP HERE IS DATA OR RENDERED OUTPUT, NEVER A COMPONENT, and that is a hard requirement
 * rather than a preference. This is the only client component in the kit, so it is the only
 * place a server/client boundary exists, and a React component is a *function* - which cannot
 * cross it. The first version took `icon: LucideIcon` and `accent`, built the tile here, and
 * **crashed the whole trading lobby at runtime** with "Functions cannot be passed directly to
 * Client Components": a lucide icon is a `forwardRef` object whose `render` is a function, so
 * the error names `{$$typeof, render, displayName}` rather than anything recognisable as an
 * icon. `content` was already correct - rendered on the server and handed in - and `icon` now
 * works the same way. **If a prop is ever added here, it must be serialisable.**
 */

export interface NeonAccordionSection {
  /** Stable across renders and never an index - Radix tracks open state by this value. */
  id: string;
  /** An ALREADY-RENDERED tile, e.g. `<IconTile icon={Coins} accent="prize" size="sm" />`. */
  icon: React.ReactNode;
  title: string;
  /** Rendered on the server and handed in, so the sections themselves stay server components. */
  content: React.ReactNode;
}

export function NeonAccordion({
  sections,
}: {
  sections: NeonAccordionSection[];
}) {
  if (sections.length === 0) return null;

  return (
    <Accordion type="multiple" className="space-y-2">
      {sections.map((section) => (
        <AccordionItem
          key={section.id}
          value={section.id}
          className="overflow-hidden rounded-xl border border-[#1B2540] bg-[#0A0F1F]/80 last:border-b"
        >
          <AccordionTrigger className="px-3 py-3 hover:no-underline [&[data-state=open]]:border-b [&[data-state=open]]:border-[#161E36]">
            <span className="flex items-center gap-2.5">
              {section.icon}
              <span className="text-sm font-medium text-gray-200">
                {section.title}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3 pt-3">
            {section.content}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
