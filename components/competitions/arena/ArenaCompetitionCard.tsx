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
 * Competition Arena card — owner reference anatomy (design-reference target).
 *
 * The artwork owns the full left side. The right side grows around its badges,
 * title, description and however many game-specific metric boxes exist, followed
 * by the supplied full-width CTA artwork.
 */
export function ArenaCompetitionCard({
  presentation,
}: {
  presentation: CompetitionPresentation;
}) {
  const p = presentation;
  const settled = isSettled(p);
  const metrics = [...p.primaryMetrics, ...p.secondaryMetrics].filter(
    hasMetricValue,
  );
  const accent = p.gameAccent;

  return (
    <article
      className="@container relative h-full overflow-hidden rounded-[18px] border-[1.5px]"
      style={cardFrameStyle(p)}
    >
      <CardBackdrop presentation={p} />
      <CancelledRibbon presentation={p} />

      <div className="relative z-10 grid h-full grid-cols-1 gap-3 p-3 @[560px]:grid-cols-[35%_minmax(0,1fr)] @[560px]:p-3.5">
        <CardHero
          presentation={p}
          className="aspect-video w-full rounded-xl @[560px]:aspect-auto @[560px]:h-full @[560px]:min-h-[300px]"
          sizes="(max-width: 560px) 100vw, 300px"
        />

        <div className="flex min-w-0 flex-col gap-2">
          <CardBadgesRow presentation={p} />

          <h3
            className="line-clamp-2 min-w-0 text-[17px] font-black leading-tight text-white @[560px]:text-[19px]"
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

          <div className="mt-auto grid auto-rows-fr grid-cols-2 gap-2 @[420px]:grid-cols-3">
            {metrics.map((m) => (
              <CompetitionDataBlock key={m.key} metric={m} accent={accent} />
            ))}
            <CardContextDataBlocks presentation={p} layout="grid" />
          </div>

          <div className="mt-0.5 flex items-center justify-center">
            <CompetitionCTA
              cta={p.cta}
              glow={settled ? undefined : p.theme.glow}
              className="w-full max-w-[220px]"
            />
          </div>
        </div>
      </div>
    </article>
  );
}
