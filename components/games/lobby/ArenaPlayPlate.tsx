import type { ReactNode } from "react";
import { ChevronsLeft, ChevronsRight, Play } from "lucide-react";

const PLATE_SHAPE = "polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%)";

/**
 * The gold PLAY plate on a game lobby (owner target, 15 Oct 2026: "the button we have is
 * very plain"). It is drawn inside the caller's `<Link>` or `<button>`, so it is markup only -
 * never a second interactive element nested in the control.
 *
 * Reason the glow sits on a `drop-shadow` wrapper: the plate is cut to its chevron shape
 * with `clip-path`, and `clip-path` also clips `box-shadow`, which is why the old button
 * read flat. A filter on the parent is drawn from the clipped result, so the glow follows
 * the chevron edges instead of disappearing.
 *
 * `disabled` is only the LOOK of a refused control; the caller's own `disabled` attribute is
 * what refuses the click. `icon` replaces the play glyph for the resume and loading phases.
 */
export function ArenaPlayPlate({
  label = "PLAY",
  icon,
  disabled = false,
}: {
  label?: string;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  // Reason (16 Oct 2026): disabled used to be grayscale + opacity-60, which made
  // "NOT STARTED YET" nearly invisible on phones (dark text on washed-out gold).
  // Refused state stays clearly readable: slate plate, light label.
  const chevron = disabled
    ? "h-7 w-7 shrink-0 text-slate-400"
    : "h-7 w-7 shrink-0 text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.95)] motion-safe:animate-pulse";
  return (
    <span className="group flex w-full items-center justify-center gap-2 sm:gap-3">
      <ChevronsRight aria-hidden className={chevron} />
      <span
        className={`relative block min-w-0 flex-1 transition-transform duration-150 ${
          disabled
            ? ""
            : "drop-shadow-[0_0_18px_rgba(251,191,36,0.6)] group-hover:scale-[1.02] group-active:scale-[0.98]"
        }`}
      >
        {/* Bevel: a darker gold rim the face sits inside (slate when refused). */}
        <span
          aria-hidden
          className={
            disabled
              ? "absolute inset-0 bg-gradient-to-b from-slate-400 via-slate-500 to-slate-700"
              : "absolute inset-0 bg-gradient-to-b from-amber-200 via-amber-500 to-amber-700"
          }
          style={{ clipPath: PLATE_SHAPE }}
        />
        <span
          className={`relative m-[3px] flex min-h-[3.25rem] items-center justify-center overflow-hidden px-4 sm:px-6 ${
            disabled
              ? "bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500"
              : "bg-gradient-to-b from-yellow-200 via-amber-300 to-amber-500 group-hover:from-yellow-100 group-hover:via-amber-200 group-hover:to-amber-400"
          }`}
          style={{ clipPath: PLATE_SHAPE }}
        >
          {/* Gloss across the top half. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/55 to-white/0"
          />
          <span
            className={`relative inline-flex max-w-full items-center justify-center gap-2 text-center text-[13px] font-black uppercase leading-tight tracking-[0.12em] sm:gap-2.5 sm:text-lg sm:tracking-[0.2em] ${
              disabled
                ? "text-[#0b1220] [text-shadow:0_1px_0_rgba(255,255,255,0.35)]"
                : "text-[#0a1628] [text-shadow:0_1px_0_rgba(255,255,255,0.45)]"
            }`}
          >
            {icon ?? (
              <Play
                aria-hidden
                className={
                  disabled
                    ? "h-5 w-5 shrink-0 fill-[#0b1220] text-[#0b1220]"
                    : "h-5 w-5 shrink-0 fill-cyan-500 text-cyan-600 drop-shadow-[0_0_6px_rgba(34,211,238,0.9)]"
                }
              />
            )}
            <span className="min-w-0 break-words">{label}</span>
          </span>
        </span>
      </span>
      <ChevronsLeft aria-hidden className={chevron} />
    </span>
  );
}
