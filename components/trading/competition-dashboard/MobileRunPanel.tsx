"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowRight, BarChart3, ChevronRight, ClipboardList, Crown, RefreshCw, Trophy } from "lucide-react";
import { COMPETITION_ICON } from "@/lib/competitions/game-definitions";
import { PRESS_EFFECT } from "@/components/ui/press-effect";
import type { PanelRow, PlayTileData, TileTone } from "./DashboardPieces";
import type { RankStanding, RankedFigure } from "./dashboard-model";

/*
 * The player's own run on a phone (mobile fix guide, 13 Oct 2026).
 *
 * Same figures, rows and links `CompetitionDashboard` computes for desktop - only the
 * arrangement differs. The desktop panel's 230px trophy, five-across tile row and two
 * side-by-side row panels cannot fit 390px and were clipping every value, so here:
 * a short header, a two-cell score card, a 2-column tile grid, ONE rows panel with a
 * Summary / Breakdown switch, and the two actions stacked full width.
 */

const TILE_ICON_TONES = new Map<TileTone, string>([
  ["blue", "border-sky-400/30 bg-sky-500/10 text-sky-300"],
  ["purple", "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-300"],
  ["cyan", "border-cyan-300/30 bg-cyan-500/10 text-cyan-300"],
  ["amber", "border-amber-300/30 bg-amber-500/10 text-amber-300"],
  ["red", "border-rose-400/30 bg-rose-500/10 text-rose-300"],
]);

const CARD = "min-w-0 rounded-2xl border border-white/[0.07] bg-[#0A1024]/85";

type RowsView = "summary" | "breakdown";

export interface MobileRunPanelProps {
  title: [string, string];
  subtitle: string;
  /** Omitted (null) while upcoming, so the WARMING UP heading is never squeezed. */
  status: ReactNode;
  figure: RankedFigure;
  caption: string;
  rank: number | null | undefined;
  total: number;
  standing: RankStanding;
  tiles: PlayTileData[];
  summaryRows: PanelRow[];
  breakdownRows: PanelRow[];
  back: { href: string; title: string; subtitle: string };
  primary: { href: string; title: string };
  updatedLabel: string;
}

export function MobileRunPanel({
  title,
  subtitle,
  status,
  figure,
  caption,
  rank,
  total,
  standing,
  tiles,
  summaryRows,
  breakdownRows,
  back,
  primary,
  updatedLabel,
}: MobileRunPanelProps) {
  const [view, setView] = useState<RowsView>("summary");
  const rows = view === "summary" ? summaryRows : breakdownRows;
  const lineTone =
    standing.tone === "great" ? "text-emerald-400" : standing.tone === "good" ? "text-sky-300" : "text-gray-400";

  return (
    <section className={`${CARD} space-y-3 p-4`} aria-label="Your run">
      <div className="flex min-w-0 flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- static neon artwork */}
        <img
          src={COMPETITION_ICON.trophyGold}
          alt=""
          draggable={false}
          className="h-12 w-12 shrink-0 object-contain drop-shadow-[0_0_14px_rgba(255,200,40,0.35)]"
        />
        <h2 className="mt-1.5 text-[19px] font-black uppercase leading-tight tracking-wide">
          <span className="text-white">{title[0]} </span>
          <span className="text-cyan-300">{title[1]}</span>
        </h2>
        <p className="mt-1 max-w-[300px] text-[12px] leading-snug text-gray-400 break-words">{subtitle}</p>
        {status ? (
          <div className="mt-2 [&>span]:px-2.5 [&>span]:py-0.5 [&>span]:text-[10px]">{status}</div>
        ) : null}
      </div>

      <div className="grid min-w-0 grid-cols-2 overflow-hidden rounded-xl border border-sky-400/25 bg-[#0B1A3A]/70 text-center">
        <div className="min-w-0 p-3">
          <p className="truncate text-[10px] font-bold uppercase tracking-wider text-gray-400">{figure.label}</p>
          <p
            className={`mt-1 truncate text-[22px] font-black leading-none tabular-nums ${
              figure.tone === "loss" ? "text-rose-400" : "text-[#FFD72D]"
            }`}
          >
            {figure.value}
          </p>
        </div>
        <div className="min-w-0 border-l border-sky-400/20 p-3">
          <p className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <Crown className="h-3 w-3 shrink-0 text-amber-300" aria-hidden />
            Rank
          </p>
          <p className="mt-1 truncate text-[22px] font-black leading-none tabular-nums text-white">
            {rank ? `#${rank}` : "-"}
            <span className="ml-1 text-[13px] font-bold text-gray-400">/ {total || "-"}</span>
          </p>
          <div className="mx-auto mt-2 h-1 w-4/5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-300"
              style={{ width: `${standing.progress}%` }}
            />
          </div>
        </div>
        <p className="col-span-2 min-w-0 border-t border-sky-400/20 px-3 py-2 text-[11px] leading-snug text-gray-300 break-words">
          {caption}
          <span className={`mt-0.5 block font-semibold ${lineTone}`}>{standing.line}</span>
        </p>
      </div>

      <div>
        <h3 className="mb-2 flex items-center justify-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-gray-300">
          <BarChart3 className="h-4 w-4 text-sky-400" aria-hidden />
          How you&apos;re trading
        </h3>
        <div className="grid min-w-0 grid-cols-2 gap-2">
          {tiles.map((tile, index) => {
            const Icon = tile.icon;
            const lastOdd = index === tiles.length - 1 && tiles.length % 2 === 1;
            return (
              <div
                key={tile.key}
                className={`flex min-w-0 flex-col items-center rounded-xl border border-white/[0.07] bg-black/20 px-2 py-2.5 text-center ${
                  lastOdd ? "col-span-2" : ""
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                    TILE_ICON_TONES.get(tile.tone) ?? ""
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="mt-1.5 block max-w-full truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {tile.label}
                </span>
                <span className={`block max-w-full truncate text-[16px] font-black leading-tight tabular-nums ${tile.valueTone ?? "text-white"}`}>
                  {tile.value}
                </span>
                <span className="block max-w-full truncate text-[10px] text-gray-500">{tile.caption}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-w-0 rounded-xl border border-white/[0.07] bg-black/20 p-2.5">
        <div role="tablist" aria-label="Run details" className="grid grid-cols-2 gap-1 rounded-lg bg-black/30 p-1">
          <ViewTab id="summary" label="Run summary" icon={<ClipboardList className="h-3.5 w-3.5" />} view={view} onSelect={setView} />
          <ViewTab id="breakdown" label="Score" icon={<BarChart3 className="h-3.5 w-3.5" />} view={view} onSelect={setView} />
        </div>
        <ul className="mt-2 divide-y divide-white/[0.06]">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <li key={row.key} className="flex min-w-0 items-center gap-2 py-2">
                <Icon className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden />
                <span className="shrink-0 text-[12px] text-gray-400">{row.label}</span>
                <span
                  className={`ml-auto min-w-0 text-right text-[12px] font-semibold tabular-nums break-words ${
                    row.valueTone ?? "text-white"
                  }`}
                >
                  {row.value}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <ActionLink
          href={primary.href}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-200/60 bg-gradient-to-b from-[#FFE04A] to-[#F5B400] px-4 text-[15px] font-black text-[#1A1200] ${PRESS_EFFECT}`}
        >
          <Trophy className="h-4 w-4" aria-hidden />
          {primary.title}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </ActionLink>
        <Link
          href={back.href}
          className={`flex min-h-12 min-w-0 items-center gap-3 rounded-xl border border-sky-500/30 bg-[#0A1734]/80 px-4 ${PRESS_EFFECT}`}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-bold text-white">{back.title}</span>
            <span className="block truncate text-[11px] text-gray-400">{back.subtitle}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-sky-400" aria-hidden />
        </Link>
      </div>

      <p className="flex items-center justify-center gap-1 text-[10px] text-gray-500">
        <RefreshCw className="h-3 w-3" aria-hidden />
        Updated {updatedLabel}
      </p>
    </section>
  );
}

function ViewTab({
  id,
  label,
  icon,
  view,
  onSelect,
}: {
  id: RowsView;
  label: string;
  icon: ReactNode;
  view: RowsView;
  onSelect: (v: RowsView) => void;
}) {
  const selected = view === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onSelect(id)}
      className={`flex min-h-8 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-bold ${
        selected ? "bg-cyan-500/15 text-cyan-200" : "text-gray-400"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

/**
 * A same-page `#hash` must be a native anchor: the lobby's tab pages listen for
 * `hashchange`, which Next's `Link` does not fire (it uses `history.pushState`).
 */
function ActionLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
