import type { CompetitionPresentation } from "@/lib/competitions/types";
import { CompetitionDataBlock } from "./CompetitionDataBlock";
import { CompetitionCTA } from "./CompetitionCTA";
import {
  CancelledRibbon,
  CardBackdrop,
  CardHeroWithStatus,
  CardTagsRow,
  GamePill,
  cardFrameStyle,
  hasMetricValue,
  isSettled,
} from "./CompetitionCardParts";

/**
 * Competition Arena list row — the same elements as the grid card, laid out
 * across one wide row: whole game artwork with the status pill on its corner,
 * then the title with the boxed game name, tags plus the ticking countdown, the
 * description and every box (primary and game-specific), then the CTA in its
 * own column, vertically centred.
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

      <div className="relative z-10 grid grid-cols-1 gap-3 p-3 @[760px]:grid-cols-[220px_minmax(0,1fr)] @[760px]:p-3.5 @[1100px]:grid-cols-[230px_minmax(0,1fr)_220px]">
        <CardHeroWithStatus
          presentation={p}
          className="aspect-video w-full overflow-hidden rounded-xl @[760px]:aspect-auto @[760px]:h-full @[760px]:min-h-[160px]"
          sizes="(max-width: 760px) 100vw, 230px"
        />

        <div className="flex min-w-0 flex-col gap-2">
          <div
            className={`flex items-start justify-between gap-2 ${
              p.showCancelledRibbon ? "pr-[84px]" : ""
            }`}
          >
            <h3
              className="line-clamp-2 min-w-0 text-[17px] font-black leading-tight text-white @[760px]:text-[19px]"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,.6)" }}
              title={p.title}
            >
              {p.title}
            </h3>
            <GamePill presentation={p} />
          </div>

          <CardTagsRow presentation={p} />

          {p.description ? (
            <p className="line-clamp-2 text-[12px] leading-snug text-slate-300/90">
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

        {/* CTA — below on narrow rows, its own column on wide ones */}
        <div className="flex items-center justify-center @[760px]:col-span-2 @[1100px]:col-span-1">
          <CompetitionCTA
            cta={p.cta}
            glow={settled ? undefined : p.theme.glow}
            className="max-w-[220px]"
          />
        </div>
      </div>
    </article>
  );
}
