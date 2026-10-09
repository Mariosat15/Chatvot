"use client";

import { ChevronDown, Search, X } from "lucide-react";
import type { ToolbarFilterOption } from "../CompetitionToolbar";

/**
 * Reason (R60): a native select's option list is painted by the browser, so
 * the chip background must be opaque or the options render white on white.
 */
function FilterChip({
  label,
  value,
  options,
  onChange,
  defaultLabel,
}: {
  label: string;
  value: string;
  options: ToolbarFilterOption[];
  onChange: (v: string) => void;
  /** Shown while the first (default) option is selected, e.g. "Sort". */
  defaultLabel?: string;
}) {
  const selected = options.find((o) => o.value === value) ?? options[0];
  const isDefault = !selected || selected.value === options[0]?.value;
  const shown = isDefault && defaultLabel ? defaultLabel : (selected?.label ?? label);

  return (
    <label
      className={`relative inline-flex h-8 shrink-0 items-center gap-1 rounded-full border pl-3 pr-2 text-[11.5px] font-bold whitespace-nowrap ${
        isDefault
          ? "border-cyan-400/35 bg-[#06122e] text-white/90"
          : "border-cyan-300 bg-cyan-500/20 text-white"
      }`}
    >
      <span className="sr-only">{label}: </span>
      <span aria-hidden>{shown}</span>
      <ChevronDown className="h-3.5 w-3.5 text-cyan-200" aria-hidden />
      {/* The real control sits invisibly over the chip so the browser's own
          picker opens on tap; it keeps an opaque background for R60. */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full bg-[#06122e] text-white opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-slate-900 text-white">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MobileArenaFilters({
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
}) {
  return (
    <section className="flex flex-col gap-2.5" aria-label="Filters">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-200/70"
          aria-hidden
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search competitions..."
          className="h-11 w-full rounded-xl border border-cyan-400/30 bg-black/45 pl-10 pr-3 text-[14px] text-white placeholder:text-white/40 outline-none focus:border-cyan-300"
        />
      </div>

      <div className="-mx-3 flex items-center gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <FilterChip label="Game" value={gameValue} options={gameOptions} onChange={onGameChange} />
        {showAssets ? (
          <FilterChip
            label="Assets"
            value={assetValue}
            options={[{ value: "", label: "All Assets" }, ...assetOptions]}
            onChange={onAssetChange}
          />
        ) : null}
        <FilterChip
          label="Difficulty"
          value={difficultyValue}
          options={difficultyOptions}
          onChange={onDifficultyChange}
          defaultLabel="Difficulty"
        />
        <FilterChip
          label="Status"
          value={statusValue}
          options={statusOptions}
          onChange={onStatusChange}
          defaultLabel="Status"
        />
        <FilterChip
          label="Sort"
          value={sortValue}
          options={sortOptions}
          onChange={onSortChange}
          defaultLabel="Sort"
        />
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear filters"
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-white/25 bg-black/45 px-2.5 text-[11.5px] font-bold text-white/85"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear
          </button>
        ) : null}
      </div>
    </section>
  );
}
