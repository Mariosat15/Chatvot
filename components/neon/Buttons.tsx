import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * The buttons from the sheet's `BUTTONS` block: the violet gradient primary with a second line
 * under its label, the blue outline, and the two quiet dark ones.
 *
 * WHY NOT A VARIANT ON THE EXISTING `Button`. `components/ui/button.tsx` is the shadcn
 * component used across roughly the whole application, and its variants are sized for a single
 * line of text. The sheet's primary carries a label *and* a subtitle - "Play Now" over
 * "Competition will start soon" - which is a different shape, not a different colour, and
 * bolting it onto the shared button would change the type of a component several hundred call
 * sites already use. This file is additive and touches nothing.
 *
 * DISABLED IS A `<button disabled>`, NEVER A STYLED `<Link>`. An anchor with pointer events
 * switched off is still keyboard-focusable and still navigates on Enter, so a "disabled" Play
 * button would launch a round - which consumes a paying player's attempt - for anyone tabbing
 * through the page. Same reasoning as keeping the launch out of the page's own render.
 */

type NeonButtonTone = "primary" | "action" | "outline" | "quiet";

const TONES = new Map<NeonButtonTone, string>([
  [
    "primary",
    "border-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/40 hover:from-violet-500 hover:to-fuchsia-500",
  ],
  /*
    THE ONE THE OWNER'S ARENA REFERENCE DRAWS, and it is a second tone rather than a change to
    `primary` on purpose. `primary` is violet because the component sheet says so, and it is
    what both lobbies' navigation buttons already wear; the reference's cyan belongs to the
    single act-now control on the board - Play, Resume, Play again. Two of them on one screen
    would defeat the point, so **there must never be more than one `action` button visible.**
  */
  [
    "action",
    "border-transparent bg-gradient-to-r from-sky-500 to-cyan-400 font-bold uppercase tracking-wide text-[#04101F] shadow-lg shadow-sky-900/50 hover:from-sky-400 hover:to-cyan-300",
  ],
  [
    "outline",
    "border-sky-500/40 bg-sky-500/10 text-sky-200 hover:border-sky-400/60 hover:bg-sky-500/20",
  ],
  [
    "quiet",
    "border-[#1B2540] bg-[#0A0F1F]/80 text-gray-300 hover:border-[#2A3766] hover:bg-[#0D1428] hover:text-gray-100",
  ],
]);

const BASE =
  "inline-flex w-full items-center justify-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold transition-all";
const DISABLED =
  "cursor-not-allowed border-[#161E36] bg-[#080C18] text-gray-500 shadow-none";

/**
 * The same tones, for a control that must be a real `<button>` with a handler.
 *
 * `NeonButton` above is deliberately server-safe - it takes an `href` and never an `onClick`,
 * so both lobbies stay server components. The Play control cannot be: it POSTs, and creating a
 * round spends a paying player's attempt, which is precisely why it must be a click and not a
 * navigation. So the client screens keep their own `<Button>` and borrow the appearance from
 * here. **Borrowing the string is the point** - writing the gradient out again in a game screen
 * is how the act-now control ends up a different colour from one phase to the next.
 */
export function neonButtonClasses(tone: NeonButtonTone): string {
  return TONES.get(tone) ?? "";
}

function Inner({
  icon: Icon,
  label,
  sublabel,
}: {
  icon?: LucideIcon;
  label: string;
  sublabel?: string | null;
}) {
  return (
    <>
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span className="flex flex-col items-center leading-tight">
        <span>{label}</span>
        {sublabel && (
          <span className="mt-0.5 text-[11px] font-normal opacity-70">
            {sublabel}
          </span>
        )}
      </span>
    </>
  );
}

export function NeonButton({
  href,
  tone = "primary",
  icon,
  label,
  sublabel,
  disabled = false,
}: {
  /** Omit to render a disabled button - there is nowhere to go. */
  href?: string;
  tone?: NeonButtonTone;
  icon?: LucideIcon;
  label: string;
  sublabel?: string | null;
  disabled?: boolean;
}) {
  if (disabled || !href) {
    return (
      <button type="button" disabled className={`${BASE} ${DISABLED}`}>
        <Inner icon={icon} label={label} sublabel={sublabel} />
      </button>
    );
  }

  return (
    <Link href={href} className={`${BASE} ${TONES.get(tone) ?? ""}`}>
      <Inner icon={icon} label={label} sublabel={sublabel} />
    </Link>
  );
}

/** The sheet's small `Back to Competitions` / `View Details` pill. */
export function NeonPill({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-[#1B2540] bg-[#0A0F1F]/80 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:border-[#2A3766] hover:text-gray-100"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
