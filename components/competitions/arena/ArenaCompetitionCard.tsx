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
 * Competition Arena card — owner reference anatomy (design-reference target).
 *
 * Top: the game's artwork on the left, shown WHOLE (`object-contain`) with the
 * status pill on its corner; on the right the title with the boxed game name,
 * tags plus a ticking countdown, a two-line description and four primary boxes.
 * Footer: the game-specific boxes and the supplied CTA PNG as the fourth column,
 * so the button is the same height as the boxes beside it.
 *
 * Reason: the owner rejected a centred CTA in its own row ("too much space, very
 * big button, no structure"). The reference puts it in the footer grid. GM Funded
 * shows as the gold tag (with the funding sentence as its tooltip) and as the
 * FREE / GM pays entry box, rather than as a full-width banner.
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
      className="@container relative overflow-hidden rounded-[18px] border-[1.5px]"
      style={cardFrameStyle(p)}
    >
      <CardBackdrop presentation={p} />
      <CancelledRibbon presentation={p} />

      <div className="relative z-10 flex flex-col gap-2.5 p-3 @[560px]:p-3.5">
        <div className="grid grid-cols-1 gap-3 @[560px]:grid-cols-[32%_minmax(0,1fr)]">
          <CardHeroWithStatus
            presentation={p}
            className="aspect-video w-full overflow-hidden rounded-xl @[560px]:aspect-auto @[560px]:h-full @[560px]:min-h-[170px]"
            sizes="(max-width: 560px) 100vw, 300px"
          />

          <div className="flex min-w-0 flex-col gap-2">
            <div
              className={`flex items-start justify-between gap-2 ${
                p.showCancelledRibbon ? "pr-[84px]" : ""
              }`}
            >
              <h3
                className="line-clamp-2 min-w-0 text-[17px] font-black leading-tight text-white @[560px]:text-[19px]"
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

            {primary.length > 0 ? (
              <div className="mt-auto grid grid-cols-2 gap-2 @[560px]:grid-cols-[repeat(4,minmax(0,1fr))]">
                {primary.map((m) => (
                  <CompetitionDataBlock key={m.key} metric={m} accent={accent} />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 items-stretch gap-2 @[560px]:grid-cols-[repeat(4,minmax(0,1fr))]">
          {secondary.map((m) => (
            <CompetitionDataBlock key={m.key} metric={m} accent={accent} />
          ))}
          <div className="col-span-2 flex items-center justify-center @[560px]:col-span-1 @[560px]:col-start-4">
            <CompetitionCTA
              cta={p.cta}
              glow={settled ? undefined : p.theme.glow}
              className="max-w-[260px]"
            />
          </div>
        </div>
      </div>
    </article>
  );
}
