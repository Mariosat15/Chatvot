"use client";

import Image from "next/image";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import {
  explainCompetitionCountdown,
  explainCompetitionMetric,
} from "@/lib/competitions/metric-explanations";
import type {
  CompetitionMetric,
  CompetitionPresentation,
} from "@/lib/competitions/types";
import { CompetitionCTA } from "../CompetitionCTA";
import { useCountdownDisplay } from "../CompetitionCountdown";
import { CompetitionStatusBadge } from "../CompetitionStatusBadge";
import {
  CancelledRibbon,
  CardBackdrop,
  CardHero,
  CompetitionTypeRibbon,
  PrivateRibbon,
  cardFrameStyle,
  hasMetricValue,
  isSettled,
} from "../CompetitionCardParts";
import { MobileStatCell } from "./MobileStatCell";

/** Three full-width rows of two below the cover. */
const MAX_GRID_CELLS = 6;

function MetricStat({
  metric,
  tone,
}: {
  metric: CompetitionMetric;
  tone?: "prize";
}) {
  return (
    <MobileStatCell
      icon={metric.icon}
      label={metric.label}
      explanation={explainCompetitionMetric(metric)}
      tone={tone}
    >
      {metric.value}
    </MobileStatCell>
  );
}

function CountdownStat({
  kind,
  target,
}: {
  kind: "starts" | "ends";
  target: string;
}) {
  const display = useCountdownDisplay(kind, target);
  return (
    <MobileStatCell
      icon={COMPETITION_ICON.clock}
      label={kind === "starts" ? "Starts in" : "Ends in"}
      explanation={explainCompetitionCountdown(kind)}
    >
      <span className="whitespace-nowrap font-mono">{display}</span>
    </MobileStatCell>
  );
}

/**
 * Phone competition card (Mobile UI Guide).
 *
 * Top: 3:4 cover on the left; status, a two-line title, a three-line
 * description and the prize pool on the right, so the column beside the
 * cover is filled rather than leaving a gap under it.
 * Then the remaining stats full width in two roomy columns, every one
 * tappable for an explanation, then "Hosted by" and the main action.
 *
 * Reason: composed from the same parts as the desktop card so the two views
 * cannot tell a player different things about one competition.
 */
export function MobileCompetitionCard({
  presentation,
}: {
  presentation: CompetitionPresentation;
}) {
  const p = presentation;
  const settled = isSettled(p);
  const metrics = [
    ...p.primaryMetrics.filter(hasMetricValue),
    ...p.secondaryMetrics.filter(hasMetricValue),
  ];
  const prize = metrics.find((m) => m.key === "prizePool");
  const rest = metrics.filter((m) => m !== prize);
  const gridMetrics = rest.slice(0, p.countdown ? MAX_GRID_CELLS - 1 : MAX_GRID_CELLS);
  // Reason: the countdown is second in the guide (Players, Starts In, ...).
  const leading = gridMetrics.slice(0, 1);
  const trailing = gridMetrics.slice(1);
  const cellCount = gridMetrics.length + (p.countdown ? 1 : 0);
  const hostIcon =
    p.creatorType === "gm" ? COMPETITION_ICON.gm : COMPETITION_ICON.starbox;

  return (
    <article
      className="relative overflow-hidden rounded-2xl border-[1.5px]"
      style={cardFrameStyle(p)}
    >
      <CardBackdrop presentation={p} />
      <CancelledRibbon presentation={p} />
      <CompetitionTypeRibbon presentation={p} />
      <PrivateRibbon presentation={p} />

      <div className="relative z-10 flex flex-col gap-2.5 p-3">
        <div className="flex gap-3">
          <CardHero
            presentation={p}
            className="aspect-[3/4] w-[32%] shrink-0 self-start rounded-xl"
            sizes="150px"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {/* Right padding keeps the pill and title clear of the corner ribbon. */}
            <div className="flex min-h-[22px] flex-wrap items-center gap-x-2 gap-y-1 pr-14">
              <CompetitionStatusBadge status={p.status} label={p.statusLabel} />
              {!p.countdown && p.countdownLabel ? (
                <span className="text-[11px] font-bold text-white/70">
                  {p.countdownLabel}
                </span>
              ) : null}
            </div>

            <h3
              className="line-clamp-2 break-words pr-5 text-[16px] font-black leading-tight text-white"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,.6)" }}
              title={p.title}
            >
              {p.title}
            </h3>

            {p.description ? (
              <p className="line-clamp-3 text-[11.5px] leading-snug text-slate-300/90">
                {p.description}
              </p>
            ) : null}

            {prize ? (
              <div className="mt-auto pt-1">
                <MetricStat metric={prize} tone="prize" />
              </div>
            ) : null}
          </div>
        </div>

        {cellCount > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {leading.map((m) => (
              <MetricStat key={m.key} metric={m} />
            ))}
            {p.countdown ? (
              <CountdownStat kind={p.countdown.kind} target={p.countdown.target} />
            ) : null}
            {trailing.map((m, i) => (
              // Reason: an odd last cell spans the row instead of leaving a hole.
              <div
                key={m.key}
                className={
                  cellCount % 2 === 1 && i === trailing.length - 1 ? "col-span-2" : ""
                }
              >
                <MetricStat metric={m} />
              </div>
            ))}
          </div>
        ) : null}

        {p.gmFunded ? (
          <p className="flex items-start gap-1 text-[11px] font-bold leading-snug text-amber-200">
            <Image
              src={COMPETITION_ICON.starbox}
              alt=""
              width={14}
              height={14}
              className="mt-px h-3.5 w-3.5 shrink-0 object-contain"
            />
            <span>{p.gmFundedNote ?? "GM Funded"}</span>
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Image
              src={hostIcon}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="text-[10px] leading-tight text-white/55">Hosted by</p>
              <p className="break-words text-[12.5px] font-bold leading-tight text-white">
                {p.creatorName}
              </p>
            </div>
          </div>
          <div className="aspect-[3/1] h-11 shrink-0">
            <CompetitionCTA
              cta={p.cta}
              glow={settled ? undefined : p.theme.glow}
              fillCell
              className="h-full w-full"
            />
          </div>
        </div>
      </div>
    </article>
  );
}
