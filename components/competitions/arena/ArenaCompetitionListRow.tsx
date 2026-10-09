import type { CompetitionPresentation } from "@/lib/competitions/types";
import { CompetitionDataBlock } from "./CompetitionDataBlock";
import { CompetitionCTA } from "./CompetitionCTA";
import {
  CancelledRibbon,
  CardBackdrop,
  CardBadgesRow,
  CardContextDataBlocks,
  CardHero,
  cardFrameStyle,
  hasMetricValue,
  isSettled,
} from "./CompetitionCardParts";

/**
 * Competition Arena list row — the same elements as the grid card, laid out
 * across one wide row: whole game artwork, then the wrapping badge row, title,
 * description and every populated game-specific box with the CTA in that same
 * metric grid so the button aligns with the boxes.
 *
 * Reason: it composes the card's own parts (`CompetitionCardParts`) so the two
 * views cannot tell a player different things about the same competition.
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
      className="@container relative overflow-hidden rounded-[18px] border-[1.5px]"
      style={cardFrameStyle(p)}
    >
      <CardBackdrop presentation={p} />
      <CancelledRibbon presentation={p} />

      <div className="relative z-10 grid grid-cols-1 gap-3 p-3 @[760px]:grid-cols-[220px_minmax(0,1fr)] @[760px]:p-3.5">
        <CardHero
          presentation={p}
          className="aspect-video w-full rounded-xl @[760px]:aspect-auto @[760px]:h-full @[760px]:min-h-[160px]"
          sizes="(max-width: 760px) 100vw, 230px"
        />

        <div className="flex min-w-0 flex-col gap-2">
          <CardBadgesRow presentation={p} />

          <h3
            className="line-clamp-2 min-w-0 text-[17px] font-black leading-tight text-white @[760px]:text-[19px]"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,.6)" }}
            title={p.title}
          >
            {p.title}
          </h3>

          {p.description ? (
            <p className="line-clamp-2 text-[12px] leading-snug text-slate-300/90">
              {p.description}
            </p>
          ) : null}

          {/*
            Reason: the CTA belongs in the same auto-fit track as the data boxes
            so it fills the open cell beside the last metric instead of sitting
            alone in a third column below the row.
          */}
          <div className="mt-auto grid auto-rows-fr grid-cols-2 gap-2 @[520px]:grid-cols-[repeat(auto-fit,minmax(118px,1fr))]">
            {metrics.map((m) => (
              <CompetitionDataBlock key={m.key} metric={m} accent={p.gameAccent} />
            ))}
            <div className="flex h-full min-h-[56px] items-center justify-center">
              <CompetitionCTA
                cta={p.cta}
                glow={settled ? undefined : p.theme.glow}
                className="max-w-[220px]"
              />
            </div>
            <CardContextDataBlocks presentation={p} layout="list" />
          </div>
        </div>
      </div>
    </article>
  );
}
