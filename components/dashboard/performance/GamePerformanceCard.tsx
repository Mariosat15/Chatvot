"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { overviewPlayCardArt } from "@/lib/services/games/overview-assets";
import { NeonIcon, accentHex } from "./PerformanceChrome";
import { PERF, PERF_METRIC_ICON, PERF_SECTION_ICON } from "./performance-assets";
import { type GameCardView } from "./performance-game-cards";
import { heroObjectPosition } from "./performance-hero-art";
import { TRADING_KEY } from "./performance-model";

function GameHeroArt({ src }: { src: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const apply = useCallback(() => {
    const box = boxRef.current;
    const img = imgRef.current;
    if (!box || !img || img.naturalWidth < 1) return;
    img.style.objectPosition = heroObjectPosition(
      img.naturalWidth,
      img.naturalHeight,
      box.clientWidth,
      box.clientHeight,
    );
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(() => apply());
    observer.observe(box);
    return () => observer.disconnect();
  }, [apply, src]);

  return (
    <div ref={boxRef} className="game-hero relative h-[132px] w-full overflow-hidden sm:h-[148px]">
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="object-cover [object-position:center_top]"
        quality={90}
        onLoad={(event) => {
          imgRef.current = event.currentTarget;
          apply();
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0) 45%, rgba(2,8,23,.25) 70%, rgba(2,8,23,.92) 100%)",
        }}
      />
    </div>
  );
}

function lastPlayed(iso: string | null): string {
  if (!iso) return "-";
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "-";
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function MetricTrend({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) {
    return <span className="text-xs font-semibold text-[#6b7f9c]">-</span>;
  }
  if (Math.abs(value) < 0.05) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#6b7f9c]">
        <Minus className="h-3.5 w-3.5" aria-hidden /> 0%
      </span>
    );
  }
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        up ? "text-[#00e6a3]" : "text-[#ff4b67]"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {up ? "+" : "-"}
      {Math.abs(value).toFixed(Math.abs(value) >= 10 ? 0 : 1)}%
    </span>
  );
}

function GameSparkline({
  points,
  color,
  id,
}: {
  points: number[];
  color: string;
  id: string;
}) {
  const width = 280;
  const height = 40;
  const idSafe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (points.length < 2) {
    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="opacity-40">
        <line x1={8} y1={height / 2} x2={width - 8} y2={height / 2} stroke={color} strokeWidth="2.5" />
      </svg>
    );
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - min) / span) * (height - 10) - 5;
    return { x, y };
  });
  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  const fill = `${line} L${width} ${height} L0 ${height} Z`;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={`gfill-${idSafe}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={`gglow-${idSafe}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={fill} fill={`url(#gfill-${idSafe})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="round"
        style={{ filter: `url(#gglow-${idSafe})` }}
      />
      {coords.filter((_, i) => i === 0 || i === coords.length - 1 || i % 2 === 0).map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="3.2" fill={color} />
      ))}
    </svg>
  );
}

function MetricTile({
  icon,
  label,
  value,
  trend,
  hex,
}: {
  icon: string;
  label: string;
  value: string;
  trend: number | null;
  hex: string;
}) {
  return (
    <div
      className="flex min-h-[54px] items-center gap-2 rounded-[12px] px-3 py-2"
      style={{
        background: "linear-gradient(135deg, rgba(6,24,55,.96), rgba(4,12,30,.98))",
        border: `1px solid ${hex}73`,
        boxShadow: `0 0 14px ${hex}22`,
      }}
    >
      <NeonIcon src={icon} size={32} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8ea4c5]">{label}</p>
        <div className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="truncate text-xl font-black leading-none tabular-nums text-white">{value}</span>
          <MetricTrend value={trend} />
        </div>
      </div>
    </div>
  );
}

/**
 * Image-1 Game Performance card: hero art, identity, 2×2 metrics, sparkline.
 * One component for trading and every provider title (R29).
 */
export function GamePerformanceCard({ card }: { card: GameCardView }) {
  const hex = accentHex(card.accent);
  // Reason: icon-as-hero looked like an empty glowing pill (owner screenshot).
  // Prefer the card's art; fall back to the same Overview play art, never Menuitems icons.
  const artSrc =
    card.artSrc || overviewPlayCardArt(null, card.gameKey === TRADING_KEY);
  const identityIcon =
    card.gameKey === TRADING_KEY ? PERF_SECTION_ICON.trading : PERF_METRIC_ICON.gameFallback;
  const subtitle = [card.category, card.tagline].filter(Boolean).join(" • ");
  const statusLabel = card.status === "retired" ? "Retired" : "Active";
  const live = card.status !== "retired";
  const activityUnit = card.activityLabel.trim() || "Rounds";

  const metrics = [
    {
      key: "rounds",
      icon: PERF_METRIC_ICON.rounds,
      label: activityUnit,
      value: card.scoredRounds.toLocaleString(),
      trend: card.roundsTrend,
    },
    {
      key: "contests",
      icon: PERF_METRIC_ICON.contests,
      label: "Contests",
      value: card.contests.toLocaleString(),
      trend: card.contestsTrend,
    },
    {
      key: "best",
      icon: PERF_METRIC_ICON.trophy,
      label: "Best score",
      value: card.bestScore,
      trend: card.bestScoreTrend,
    },
    {
      key: "avg",
      icon: PERF_METRIC_ICON.playTime,
      label: "Avg play",
      value: card.avgPlayTime,
      trend: card.avgPlayTrend,
    },
  ];

  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-[18px]"
      data-game-card={card.gameKey}
      style={{
        background: PERF.bg2,
        border: `1px solid ${hex}`,
        boxShadow: `0 0 20px ${hex}33, inset 0 1px 0 rgba(255,255,255,.05)`,
      }}
    >
      <GameHeroArt src={artSrc} />

      <div className="flex flex-1 flex-col gap-2.5 px-3 pb-3 pt-2 sm:px-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <NeonIcon src={identityIcon} size={36} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="truncate text-lg font-black leading-tight text-white sm:text-xl">
                {card.title}
              </h3>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                style={
                  live
                    ? {
                        background: "rgba(0,230,163,.12)",
                        border: "1px solid #00e6a3",
                        color: "#00f0a8",
                      }
                    : {
                        background: "rgba(142,164,197,.12)",
                        border: "1px solid #8ea4c5",
                        color: "#8ea4c5",
                      }
                }
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                {statusLabel}
              </span>
            </div>
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-[#8ea4c5] sm:text-[13px]">{subtitle}</p>
            ) : null}
          </div>
          <Link
            href={card.href}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-xs font-bold text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2"
            style={{
              border: `1px solid ${hex}`,
              boxShadow: `0 0 14px ${hex}44`,
              background: `${hex}14`,
            }}
            aria-label={`View details for ${card.title}`}
          >
            View Details
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {metrics.map((m) => (
            <MetricTile key={m.key} icon={m.icon} label={m.label} value={m.value} trend={m.trend} hex={hex} />
          ))}
        </div>

        <div className="grid grid-cols-1 items-center gap-2 border-t border-white/10 pt-2 sm:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-white">
              {card.periodRounds.toLocaleString()} {activityUnit.toLowerCase()} this period
            </p>
            <p className="mt-0.5 text-xs text-[#8ea4c5]">Last played {lastPlayed(card.lastPlayedAt)}</p>
          </div>
          <GameSparkline points={card.spark} color={hex} id={card.gameKey} />
        </div>
      </div>
    </article>
  );
}
