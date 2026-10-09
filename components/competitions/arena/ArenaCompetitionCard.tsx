import type { CompetitionPresentation } from "@/lib/competitions/types";
import { CompetitionStatusBadge } from "./CompetitionStatusBadge";
import { CompetitionDataBlock } from "./CompetitionDataBlock";
import { CompetitionCTA } from "./CompetitionCTA";
import {
  CancelledRibbon,
  CardBackdrop,
  CardHero,
  CardTagsRow,
  GmFundedNote,
  cardFrameStyle,
  hasMetricValue,
  isSettled,
} from "./CompetitionCardParts";

/**
 * Competition Arena card — owner reference anatomy (design-reference target).
 *
 * Top: the game's artwork on the left, shown WHOLE (`object-contain`, so a
 * title baked into any game's banner is never cropped) over the same artwork
 * blurred and faded; on the right the title with the status badge, tags plus a
 * ticking countdown, the GM Funded note, the description and four primary
 * boxes. Below: the game-specific boxes across the full card width, then the
 * supplied CTA PNG centred.
 *
 * Reason: the footer used to share the 72% content column with the CTA, which
 * left ~45px of text per box and split values mid-word. Spanning the whole card
 * (as the reference does) gives each box room for its label and value.
 * The card is its own CSS container, so the layout follows ITS width.
 */
export function ArenaCompetitionCard({
  presentation,
}: {
  presentation: CompetitionPresentation;
}) {
  const p = presentation;
  const settled = isSettled(p);
  const primary = p.primaryMetrics.filter(hasMetricValue).slice(0, 4);
  const secondary = p.secondaryMetrics.filter(hasMetricValue).slice(0, 3);
  const accent = p.gameAccent;

  return (
    <article
      className="@container relative overflow-hidden rounded-[20px] border-[1.5px]"
      style={cardFrameStyle(p)}
    >
      <CardBackdrop presentation={p} />
      <CancelledRibbon presentation={p} />

      <div className="relative z-10 flex flex-col gap-4 p-4 @[600px]:gap-5 @[600px]:p-5">
        <div className="grid grid-cols-1 gap-4 @[600px]:grid-cols-[30%_minmax(0,1fr)] @[600px]:gap-5">
          <CardHero
            presentation={p}
            className="aspect-video w-full @[600px]:aspect-auto @[600px]:h-full @[600px]:min-h-[230px]"
            sizes="(max-width: 600px) 100vw, 320px"
          />

          <div className="flex min-w-0 flex-col gap-3">
            <div
              className={`flex items-start justify-between gap-3 ${
                p.showCancelledRibbon ? "pr-[84px]" : ""
              }`}
            >
              {/* Reason: the owner wants the full title shown — the card grows instead. */}
              <h3
                className="min-w-0 text-[18px] font-black leading-tight text-white @[600px]:text-[21px]"
                style={{ textShadow: "0 1px 8px rgba(0,0,0,.6)" }}
              >
                {p.title}
              </h3>
              <div className="shrink-0">
                <CompetitionStatusBadge status={p.status} label={p.statusLabel} size="lg" />
              </div>
            </div>

            <CardTagsRow presentation={p} />
            <GmFundedNote presentation={p} />

            {p.description ? (
              <p className="line-clamp-3 text-[12.5px] leading-snug text-slate-200/90 @[600px]:text-[13.5px]">
                {p.description}
              </p>
            ) : null}

            {primary.length > 0 ? (
              <div className="mt-auto grid grid-cols-2 gap-2 @[600px]:grid-cols-[repeat(4,minmax(0,1fr))]">
                {primary.map((m) => (
                  <CompetitionDataBlock key={m.key} metric={m} accent={accent} />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {secondary.length > 0 ? (
          <div className="grid grid-cols-2 items-stretch gap-2 @[460px]:grid-cols-[repeat(3,minmax(0,1fr))]">
            {secondary.map((m) => (
              <CompetitionDataBlock key={m.key} metric={m} accent={accent} />
            ))}
          </div>
        ) : null}

        {/* CTA — its own row, centred in the card (owner reference) */}
        <div className="flex justify-center pt-1">
          <CompetitionCTA
            cta={p.cta}
            glow={settled ? undefined : p.theme.glow}
            className="max-w-[320px]"
          />
        </div>
      </div>
    </article>
  );
}
