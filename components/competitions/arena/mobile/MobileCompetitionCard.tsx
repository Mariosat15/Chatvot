"use client";

import Image from "next/image";
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

const MAX_METRICS = 6;

function LiveCountdown({
  kind,
  target,
}: {
  kind: "starts" | "ends";
  target: string;
}) {
  const display = useCountdownDisplay(kind, target);
  return (
    <span className="whitespace-nowrap font-mono text-[11px] font-bold tabular-nums text-white/85">
      {kind === "starts" ? "Starts " : "Ends "}
      {display}
    </span>
  );
}

/** Value beside its label on one line (player-mobile-ui rule 6). */
function MetricCell({ metric }: { metric: CompetitionMetric }) {
  return (
    <div className="flex min-w-0 items-center gap-1 rounded-lg border border-white/10 bg-black/40 px-1.5 py-1">
      <Image
        src={metric.icon}
        alt=""
        width={16}
        height={16}
        className="h-4 w-4 shrink-0 object-contain"
      />
      <span className="min-w-0 truncate text-[10.5px] leading-tight">
        <span className="font-black text-white">{metric.value}</span>{" "}
        <span className="text-white/55">{metric.label}</span>
      </span>
    </div>
  );
}

/**
 * Phone competition card (Mobile UI Guide): 3:4 cover hero on the left; on
 * the right the status badge with its countdown, title, description, a
 * compact metric grid, then Host on the left and the action on the right.
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
  ].slice(0, MAX_METRICS);
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

      <div className="relative z-10 flex gap-2.5 p-2.5">
        <CardHero
          presentation={p}
          className="aspect-[3/4] w-[34%] shrink-0 self-start rounded-xl"
          sizes="150px"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <CompetitionStatusBadge status={p.status} label={p.statusLabel} />
            {p.countdown ? (
              <LiveCountdown kind={p.countdown.kind} target={p.countdown.target} />
            ) : p.countdownLabel ? (
              <span className="text-[11px] font-bold text-white/70">
                {p.countdownLabel}
              </span>
            ) : null}
          </div>

          <h3
            className="line-clamp-2 text-[15px] font-black leading-tight text-white"
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

          {metrics.length > 0 ? (
            <div className="grid grid-cols-2 gap-1 min-[400px]:grid-cols-3">
              {metrics.map((m) => (
                <MetricCell key={m.key} metric={m} />
              ))}
            </div>
          ) : null}

          {p.gmFunded ? (
            <p className="flex items-start gap-1 text-[10.5px] font-bold leading-snug text-amber-200">
              <Image
                src={COMPETITION_ICON.starbox}
                alt=""
                width={14}
                height={14}
                className="mt-px h-3.5 w-3.5 shrink-0 object-contain"
              />
              <span className="line-clamp-2">{p.gmFundedNote ?? "GM Funded"}</span>
            </p>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <Image
                src={hostIcon}
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 shrink-0 object-contain"
              />
              <span className="min-w-0 truncate text-[11px] leading-tight">
                <span className="text-white/55">Host </span>
                <span className="font-bold text-white">{p.creatorName}</span>
              </span>
            </div>
            <div className="aspect-[3/1] h-10 shrink-0">
              <CompetitionCTA
                cta={p.cta}
                glow={settled ? undefined : p.theme.glow}
                fillCell
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
