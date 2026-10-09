"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
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

/** Three rows of two: enough for every competition shape we ship. */
const MAX_CELLS = 6;

/**
 * Label above value, icon on the left (Mobile UI Guide stat chip). The value
 * wraps rather than truncating: a cut "1,0…" prize is worse than two lines.
 */
function StatCell({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-white/10 bg-black/45 px-1.5 py-1.5">
      <Image
        src={icon}
        alt=""
        width={18}
        height={18}
        className="h-[18px] w-[18px] shrink-0 object-contain"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[9.5px] font-semibold leading-tight text-white/60">
          {label}
        </p>
        <p className="break-words text-[12px] font-black leading-tight text-white tabular-nums">
          {children}
        </p>
      </div>
    </div>
  );
}

function MetricStat({ metric }: { metric: CompetitionMetric }) {
  return (
    <StatCell icon={metric.icon} label={metric.label}>
      {metric.value}
    </StatCell>
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
    <StatCell
      icon={COMPETITION_ICON.clock}
      label={kind === "starts" ? "Starts In" : "Ends In"}
    >
      <span className="font-mono">{display}</span>
    </StatCell>
  );
}

/**
 * Phone competition card (Mobile UI Guide): 3:4 cover on the left; status,
 * a two-line title, a two-line description and a two-column stat grid on the
 * right; then "Hosted by" and the main action across the full card width.
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
  // Reason: the countdown is the third chip in the guide (Prize, Players,
  // Starts In, ...), so it takes one of the six slots.
  const metricSlots = p.countdown ? MAX_CELLS - 1 : MAX_CELLS;
  const leading = metrics.slice(0, 2);
  const trailing = metrics.slice(2, metricSlots);
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

      <div className="relative z-10 flex flex-col gap-2.5 p-2.5">
        <div className="flex gap-2.5">
          <CardHero
            presentation={p}
            className="aspect-[3/4] w-[34%] shrink-0 self-start rounded-xl"
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
              className="line-clamp-2 break-words pr-6 text-[15px] font-black leading-tight text-white"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,.6)" }}
              title={p.title}
            >
              {p.title}
            </h3>

            {p.description ? (
              <p className="line-clamp-2 text-[11px] leading-snug text-slate-300/90">
                {p.description}
              </p>
            ) : null}

            {leading.length > 0 || p.countdown ? (
              <div className="grid grid-cols-2 gap-1.5">
                {leading.map((m) => (
                  <MetricStat key={m.key} metric={m} />
                ))}
                {p.countdown ? (
                  <CountdownStat
                    kind={p.countdown.kind}
                    target={p.countdown.target}
                  />
                ) : null}
                {trailing.map((m) => (
                  <MetricStat key={m.key} metric={m} />
                ))}
              </div>
            ) : null}
          </div>
        </div>

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
