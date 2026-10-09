"use client";

function pageWindow(current: number, total: number): Array<number | "…"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: Array<number | "…"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i += 1) pages.push(i);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

export function ArenaPagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (page: number) => void;
}) {
  if (totalItems <= 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  const window = pageWindow(page, Math.max(1, totalPages));

  return (
    <nav
      className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-cyan-400/20 bg-black/35 px-4 py-3 sm:flex-row"
      aria-label="Competition pagination"
    >
      <p className="text-sm text-white/60">
        Showing{" "}
        <span className="font-bold text-white">
          {from}–{to}
        </span>{" "}
        of <span className="font-bold text-white">{totalItems.toLocaleString()}</span>
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={!hasPreviousPage}
          onClick={() => onPageChange(page - 1)}
          className="h-10 rounded-lg border border-white/15 bg-white/5 px-3 text-sm font-semibold text-white/80 disabled:cursor-not-allowed disabled:opacity-35"
        >
          ‹ Previous
        </button>
        {window.map((item, idx) =>
          item === "…" ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-1 text-sm text-white/40"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={`h-10 min-w-10 rounded-lg border px-2.5 text-sm font-bold ${
                item === page
                  ? "border-cyan-400/60 bg-cyan-500/25 text-cyan-100 shadow-[0_0_12px_rgba(0,216,255,.3)]"
                  : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={!hasNextPage}
          onClick={() => onPageChange(page + 1)}
          className="h-10 rounded-lg border border-white/15 bg-white/5 px-3 text-sm font-semibold text-white/80 disabled:cursor-not-allowed disabled:opacity-35"
        >
          Next ›
        </button>
      </div>
    </nav>
  );
}
