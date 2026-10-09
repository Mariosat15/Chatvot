"use client";

import { LayoutGrid, List, Search, X } from "lucide-react";

export interface ToolbarFilterOption {
  value: string;
  label: string;
}

export function CompetitionToolbar({
  searchQuery,
  onSearchChange,
  statusOptions,
  statusValue,
  onStatusChange,
  gameOptions,
  gameValue,
  onGameChange,
  assetOptions,
  assetValue,
  onAssetChange,
  showAssets,
  difficultyOptions,
  difficultyValue,
  onDifficultyChange,
  sortOptions,
  sortValue,
  onSortChange,
  hasActiveFilters,
  onClear,
  viewMode,
  onViewModeChange,
}: {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  statusOptions: ToolbarFilterOption[];
  statusValue: string;
  onStatusChange: (v: string) => void;
  gameOptions: ToolbarFilterOption[];
  gameValue: string;
  onGameChange: (v: string) => void;
  assetOptions: ToolbarFilterOption[];
  assetValue: string;
  onAssetChange: (v: string) => void;
  showAssets: boolean;
  difficultyOptions: ToolbarFilterOption[];
  difficultyValue: string;
  onDifficultyChange: (v: string) => void;
  sortOptions: ToolbarFilterOption[];
  sortValue: string;
  onSortChange: (v: string) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
  viewMode: "grid" | "list";
  onViewModeChange: (v: "grid" | "list") => void;
}) {
  const selectClass =
    "h-11 min-w-[120px] rounded-xl border border-cyan-400/25 bg-black/45 px-3 text-sm font-semibold text-white outline-none focus:border-cyan-400/60";

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border border-cyan-400/30 bg-gradient-to-r from-[rgba(7,22,55,.9)] to-[rgba(3,11,29,.94)] p-3 sm:p-4"
      style={{ boxShadow: "0 0 16px rgba(0,160,255,.1)" }}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300/70" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search competitions, games, or keywords..."
            className="h-11 w-full rounded-xl border border-cyan-400/25 bg-black/45 pl-10 pr-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-cyan-400/60"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Status"
            className={selectClass}
            value={statusValue}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value} className="bg-slate-900">
                Status: {o.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Game type"
            className={selectClass}
            value={gameValue}
            onChange={(e) => onGameChange(e.target.value)}
          >
            {gameOptions.map((o) => (
              <option key={o.value} value={o.value} className="bg-slate-900">
                Type: {o.label}
              </option>
            ))}
          </select>

          {showAssets ? (
            <select
              aria-label="Assets"
              className={selectClass}
              value={assetValue}
              onChange={(e) => onAssetChange(e.target.value)}
            >
              {assetOptions.map((o) => (
                <option key={o.value} value={o.value} className="bg-slate-900">
                  Assets: {o.label}
                </option>
              ))}
            </select>
          ) : null}

          <select
            aria-label="Difficulty"
            className={selectClass}
            value={difficultyValue}
            onChange={(e) => onDifficultyChange(e.target.value)}
          >
            {difficultyOptions.map((o) => (
              <option key={o.value} value={o.value} className="bg-slate-900">
                Difficulty: {o.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Sort"
            className={selectClass}
            value={sortValue}
            onChange={(e) => onSortChange(e.target.value)}
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value} className="bg-slate-900">
                Sort: {o.label}
              </option>
            ))}
          </select>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-11 items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-semibold text-white/70 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          ) : null}

          <div className="ml-auto flex items-center rounded-xl border border-cyan-400/30 bg-black/40 p-1">
            <button
              type="button"
              aria-label="Grid view"
              onClick={() => onViewModeChange("grid")}
              className={`rounded-lg p-2 transition ${
                viewMode === "grid"
                  ? "bg-cyan-500/25 text-cyan-200 shadow-[0_0_12px_rgba(0,216,255,.35)]"
                  : "text-white/45 hover:text-white/80"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="List view"
              onClick={() => onViewModeChange("list")}
              className={`rounded-lg p-2 transition ${
                viewMode === "list"
                  ? "bg-cyan-500/25 text-cyan-200 shadow-[0_0_12px_rgba(0,216,255,.35)]"
                  : "text-white/45 hover:text-white/80"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
