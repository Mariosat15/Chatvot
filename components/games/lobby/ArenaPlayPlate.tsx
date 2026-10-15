import { ChevronsLeft, ChevronsRight, Play } from "lucide-react";

const PLATE_SHAPE = "polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%)";

/**
 * The gold PLAY plate on a game lobby (owner target, 15 Oct 2026: "the button we have is
 * very plain"). It is drawn inside the caller's `<Link>`, so it is markup only - never a
 * second interactive element nested in the anchor.
 *
 * Reason the glow sits on a `drop-shadow` wrapper: the plate is cut to its chevron shape
 * with `clip-path`, and `clip-path` also clips `box-shadow`, which is why the old button
 * read flat. A filter on the parent is drawn from the clipped result, so the glow follows
 * the chevron edges instead of disappearing.
 */
export function ArenaPlayPlate({ label = "PLAY" }: { label?: string }) {
  return (
    <span className="group flex w-full items-center justify-center gap-2 sm:gap-3">
      <ChevronsRight
        aria-hidden
        className="h-7 w-7 shrink-0 text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.95)] motion-safe:animate-pulse"
      />
      <span className="relative block min-w-0 flex-1 drop-shadow-[0_0_18px_rgba(251,191,36,0.6)] transition-transform duration-150 group-hover:scale-[1.02] group-active:scale-[0.98]">
        {/* Bevel: a darker gold rim the face sits inside. */}
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-amber-200 via-amber-500 to-amber-700"
          style={{ clipPath: PLATE_SHAPE }}
        />
        <span
          className="relative m-[3px] flex min-h-[3.25rem] items-center justify-center overflow-hidden bg-gradient-to-b from-yellow-200 via-amber-300 to-amber-500 px-6 group-hover:from-yellow-100 group-hover:via-amber-200 group-hover:to-amber-400"
          style={{ clipPath: PLATE_SHAPE }}
        >
          {/* Gloss across the top half. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/55 to-white/0"
          />
          <span className="relative inline-flex items-center gap-2.5 text-lg font-black uppercase tracking-[0.24em] text-[#0a1628] [text-shadow:0_1px_0_rgba(255,255,255,0.45)]">
            <Play
              aria-hidden
              className="h-5 w-5 fill-cyan-500 text-cyan-600 drop-shadow-[0_0_6px_rgba(34,211,238,0.9)]"
            />
            {label}
          </span>
        </span>
      </span>
      <ChevronsLeft
        aria-hidden
        className="h-7 w-7 shrink-0 text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.95)] motion-safe:animate-pulse"
      />
    </span>
  );
}
