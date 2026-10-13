import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ChevronLeft, Crown, TrendingUp, Trophy, type LucideIcon } from "lucide-react";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import { PRESS_EFFECT } from "@/components/ui/press-effect";
import type { RankStanding, RankedFigure } from "./dashboard-model";

/*
 * The visual pieces of the player's competition panel, drawn from the owner's "Round Complete"
 * reference (`design-reference/Menuitems`, 12 Oct 2026): trophy art and a two-tone title, a hero
 * card with the score and the rank, a row of colour-framed tiles, two row panels and two large
 * buttons. Every piece takes plain data; none of them knows which game it is showing.
 */

export type TileTone = "blue" | "purple" | "cyan" | "amber" | "red";

const BLUE_TILE = {
  frame: "border-sky-500/45 shadow-[0_0_18px_-8px_rgba(56,189,248,0.7)]",
  box: "border-sky-400/40 bg-sky-500/15",
  icon: "text-sky-300",
};

const TILE_TONES = new Map<TileTone, typeof BLUE_TILE>([
  ["blue", BLUE_TILE],
  ["purple", { frame: "border-fuchsia-500/45 shadow-[0_0_18px_-8px_rgba(217,70,239,0.7)]", box: "border-fuchsia-400/40 bg-fuchsia-500/15", icon: "text-fuchsia-300" }],
  ["cyan", { frame: "border-cyan-400/45 shadow-[0_0_18px_-8px_rgba(34,211,238,0.7)]", box: "border-cyan-300/40 bg-cyan-500/15", icon: "text-cyan-300" }],
  ["amber", { frame: "border-amber-400/50 shadow-[0_0_18px_-8px_rgba(251,191,36,0.7)]", box: "border-amber-300/40 bg-amber-500/15", icon: "text-amber-300" }],
  ["red", { frame: "border-rose-500/50 shadow-[0_0_18px_-8px_rgba(244,63,94,0.7)]", box: "border-rose-400/40 bg-rose-500/15", icon: "text-rose-300" }],
]);

/** The deep card every section of the reference sits in. */
export const DASH_CARD =
  "rounded-2xl border border-[#1E4F8C]/55 bg-gradient-to-b from-[#0B1A36]/90 to-[#070F22]/90 shadow-[inset_0_1px_0_rgba(120,190,255,0.08)]";

export function DashboardHeader({
  title,
  subtitle,
  status,
  children,
}: {
  title: [string, string];
  subtitle: string;
  status: ReactNode;
  /** The hero card, which sits under the title and beside the trophy. */
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[230px_minmax(0,1fr)] items-center gap-6">
      {/* eslint-disable-next-line @next/next/no-img-element -- static neon artwork, sized by its box */}
      <img
        src={COMPETITION_ICON.trophyGold}
        alt=""
        draggable={false}
        className="h-[230px] w-[230px] object-contain drop-shadow-[0_0_34px_rgba(255,192,27,0.5)]"
      />
      <div className="min-w-0 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-3 text-4xl font-black tracking-wide">
            <Trophy className="h-9 w-9 text-cyan-300" />
            <span className="text-white">{title[0]}</span>
            <span className="bg-gradient-to-r from-cyan-300 to-sky-400 bg-clip-text text-transparent">
              {title[1]}
            </span>
          </h2>
          <p className="mt-1.5 text-base text-slate-300">{subtitle}</p>
        </div>
        {status}
      </div>
      {children}
      </div>
    </div>
  );
}

export function HeroScoreCard({
  figure,
  caption,
  rank,
  total,
  standing,
  backdrop,
}: {
  figure: RankedFigure;
  caption: string;
  rank: number | null | undefined;
  total: number;
  standing: RankStanding;
  backdrop?: ReactNode;
}) {
  const lineTone =
    standing.tone === "great" ? "text-emerald-400" : standing.tone === "good" ? "text-sky-300" : "text-slate-400";
  return (
    <div className="relative grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] overflow-hidden rounded-2xl border-2 border-sky-400/55 bg-gradient-to-r from-[#0E2350] via-[#0A1838] to-[#0C1A44] shadow-[0_0_40px_-14px_rgba(56,189,248,0.9)]">
      {backdrop && <div className="pointer-events-none absolute inset-0 opacity-25">{backdrop}</div>}
      <div className="relative p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">{figure.label}</p>
        <p
          className={`mt-1 truncate text-5xl font-black tabular-nums ${
            figure.tone === "loss" ? "text-rose-400" : "text-[#FFD72D] drop-shadow-[0_0_14px_rgba(255,192,27,0.45)]"
          }`}
        >
          {figure.value}
        </p>
        <p className="mt-2 text-base text-slate-300">{caption}</p>
      </div>
      <div className="relative border-l border-sky-400/25 p-6">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-slate-300">
          <Crown className="h-4 w-4 text-amber-300" />
          Current rank
        </p>
        <p className="mt-1 text-5xl font-black text-white tabular-nums">
          {rank ? `#${rank}` : "-"}
          <span className="ml-2 text-2xl font-bold text-slate-300">/ {total || "-"}</span>
        </p>
        <div className="mt-3 h-1.5 w-44 overflow-hidden rounded-full bg-slate-700/60">
          <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-300" style={{ width: `${standing.progress}%` }} />
        </div>
        <p className={`mt-3 flex items-center gap-2 text-sm font-semibold ${lineTone}`}>
          <TrendingUp className="h-4 w-4" />
          {standing.line}
        </p>
      </div>
    </div>
  );
}

export interface PlayTileData {
  key: string;
  icon: LucideIcon;
  tone: TileTone;
  label: string;
  value: string;
  caption: string;
  valueTone?: string;
}

export function PlayTile({ tile }: { tile: PlayTileData }) {
  const tone = TILE_TONES.get(tile.tone) ?? BLUE_TILE;
  const Icon = tile.icon;
  return (
    <div className={`flex min-w-0 items-center gap-3 rounded-xl border bg-[#0A1530]/80 p-3.5 ${tone.frame}`}>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${tone.box}`}>
        <Icon className={`h-6 w-6 ${tone.icon}`} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold uppercase tracking-wider text-slate-300">{tile.label}</p>
        <p className={`text-2xl font-black tabular-nums ${tile.valueTone ?? "text-white"}`}>{tile.value}</p>
        <p className="truncate text-xs text-slate-400">{tile.caption}</p>
      </div>
    </div>
  );
}

export function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2.5 text-base font-black uppercase tracking-wide text-white">
      <Icon className="h-5 w-5 text-sky-400" />
      {children}
    </h3>
  );
}

export interface PanelRow {
  key: string;
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  valueTone?: string;
}

/** "Round summary" (value beside the label) and "Score breakdown" (value at the right edge). */
export function RowsPanel({
  icon,
  title,
  rows,
  align,
}: {
  icon: LucideIcon;
  title: string;
  rows: PanelRow[];
  align: "inline" | "end";
}) {
  return (
    <div className={`${DASH_CARD} p-5`}>
      <SectionTitle icon={icon}>{title}</SectionTitle>
      <div className="mt-4 space-y-1.5">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div
              key={row.key}
              className={`grid items-center gap-3 rounded-lg bg-[#0E1F40]/55 px-3 py-2 ${
                align === "inline" ? "grid-cols-[20px_110px_minmax(0,1fr)]" : "grid-cols-[20px_minmax(0,1fr)_auto]"
              }`}
            >
              <Icon className="h-4 w-4 text-sky-400" />
              <span className="text-sm text-slate-300">{row.label}</span>
              <span
                className={`truncate text-sm font-semibold tabular-nums ${
                  align === "end" ? "text-right" : ""
                } ${row.valueTone ?? (align === "end" ? "text-sky-300" : "text-white")}`}
              >
                {row.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardActions({
  back,
  primary,
}: {
  back: { href: string; title: string; subtitle: string };
  primary: { href: string; title: string };
}) {
  return (
    <div className="grid grid-cols-2 gap-5">
      <Link
        href={back.href}
        className="flex items-center gap-4 rounded-2xl border-2 border-sky-500/45 bg-[#0A1734]/90 px-6 py-4 transition-colors hover:border-sky-400/70 hover:bg-[#0E1F44]"
      >
        <ChevronLeft className="h-7 w-7 text-sky-400" />
        <span>
          <span className="block text-xl font-bold text-white">{back.title}</span>
          <span className="block text-sm text-slate-400">{back.subtitle}</span>
        </span>
      </Link>
      <Link
        href={primary.href}
        className={`flex items-center justify-center gap-3 rounded-2xl border-2 border-amber-200/70 bg-gradient-to-b from-[#FFE04A] to-[#F5B400] px-6 py-4 text-xl font-black text-[#1A1200] shadow-[0_0_30px_-6px_rgba(255,192,27,0.85)] ${PRESS_EFFECT}`}
      >
        <Trophy className="h-6 w-6" />
        {primary.title}
        <ArrowRight className="h-6 w-6" />
      </Link>
    </div>
  );
}
