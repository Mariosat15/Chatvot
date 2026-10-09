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
 * Competition Arena list row — the same elements as the grid card, laid out
 * across one wide row: whole game artwork on the left, then the title with the
 * status badge, tags plus the ticking countdown, the GM Funded note, the
 * description and every box (primary and game-specific), then the CTA in its
 * own column, vertically centred.
 *
 * Reason: it used to be a slimmer copy that dropped the tags, the description,
 * the live countdown and three of the boxes, so the two views told a player
 * different things about the same competition. It now composes the card's own
 * parts (`CompetitionCardParts`) so they cannot drift again.
 * The row is its own CSS container, so it stacks when ITS width is narrow.
 */
export function ArenaCompetitionListRow({
  presentation,
}: {
  presentation: CompetitionPresentation;
}) {
  const p = presentation;
  const settled = isSettled(p);
  const metrics = [
    ...p.primaryMetrics.filter(hasMetricValue).slice(0, 4),
    ...p.secondaryMetrics.filter(hasMetricValue).slice(0, 3),
  ];

  return (
    <article
      className="@container relative overflow-hidden rounded-[20px] border-[1.5px]"
      style={cardFrameStyle(p)}
    >
      <CardBackdrop presentation={p} />
      <CancelledRibbon presentation={p} />

      <div className="relative z-10 grid grid-cols-1 gap-4 p-4 @[760px]:grid-cols-[220px_minmax(0,1fr)] @[760px]:p-5 @[1100px]:grid-cols-[240px_minmax(0,1fr)_260px] @[1100px]:gap-5">
        <CardHero
          presentation={p}
          className="aspect-video w-full @[760px]:aspect-auto @[760px]:h-full @[760px]:min-h-[180px]"
          sizes="(max-width: 760px) 100vw, 240px"
        />

        <div className="flex min-w-0 flex-col gap-3">
          <div
            className={`flex items-start justify-between gap-3 ${
              p.showCancelledRibbon ? "pr-[84px]" : ""
            }`}
          >
            <h3
              className="min-w-0 text-[18px] font-black leading-tight text-white @[760px]:text-[21px]"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,.6)" }}
            >
              {p.title}
            </h3>
            {/* Reason: on the widest rows the ribbon sits over the CTA column,
                so the badge stays with the title rather than under the ribbon. */}
            <div className="shrink-0">
              <CompetitionStatusBadge status={p.status} label={p.statusLabel} size="lg" />
            </div>
          </div>

          <CardTagsRow presentation={p} />
          <GmFundedNote presentation={p} />

          {p.description ? (
            <p className="line-clamp-2 text-[12.5px] leading-snug text-slate-200/90 @[760px]:text-[13.5px]">
              {p.description}
            </p>
          ) : null}

          {metrics.length > 0 ? (
            <div className="mt-auto grid grid-cols-2 gap-2 @[520px]:grid-cols-[repeat(auto-fit,minmax(118px,1fr))]">
              {metrics.map((m) => (
                <CompetitionDataBlock key={m.key} metric={m} accent={p.gameAccent} />
              ))}
            </div>
          ) : null}
        </div>

        {/* CTA — centred below on narrow rows, its own column on wide ones */}
        <div className="flex items-center justify-center @[760px]:col-span-2 @[1100px]:col-span-1">
          <CompetitionCTA
            cta={p.cta}
            glow={settled ? undefined : p.theme.glow}
            className="max-w-[300px]"
          />
        </div>
      </div>
    </article>
  );
}
