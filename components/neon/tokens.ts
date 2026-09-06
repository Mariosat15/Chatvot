/**
 * The neon competition theme, as one set of tokens.
 *
 * WHERE IT COMES FROM: the owner's style sheet of 6 September 2026, committed at
 * `External game plans/design-reference/component-sheet.png`. That image is the specification
 * for both competition lobbies - the trading one and the game one - and this file is the single
 * place its colours and shells are written down.
 *
 * WHY A TOKEN FILE AND NOT CLASS STRINGS AT EACH CALL SITE. The previous pass matched the two
 * lobbies by copying the trading page's class strings into the game lobby, with tests comparing
 * the two files to catch drift. That worked for two screens and does not scale: the sheet also
 * covers the dashboard, the competitions hub, the game arena and the rankings page, and five
 * screens comparing class strings pairwise is twenty comparisons nobody will maintain. One
 * definition with tests on the definition is the version that survives the next screen.
 *
 * A NOTE ON THE COLOUR VALUES. The panel fill and border are written as explicit hex rather
 * than palette names, because the sheet's panels are navy-tinted and the app's `gray-800` is
 * neutral `#141414`. The body background needed nothing: `gray-900` is already `#050505`, which
 * is the sheet's near-black. **Do not "tidy" these into the gray scale** - the tint is what
 * separates a panel from the page behind it in this design, and the flat grey version reads as
 * unstyled.
 *
 * MAPS, NOT OBJECTS, for the lookups. Object indexing walks the prototype chain, so a key like
 * `toString` resolves to something truthy; a `Map` lookup is total. The accents are closed
 * unions so it cannot happen here, but the linter is right to refuse to tell the two cases
 * apart, and "safe by accident is not safe".
 *
 * AND THE TRAP THAT MAKES THIS FILE NECESSARY RATHER THAN CONVENIENT: Tailwind compiles the
 * classes it can SEE in the source. `border-${accent}-500/30` names a class that exists in the
 * TypeScript and in no stylesheet, so the element renders completely unstyled and the next
 * reader goes looking at the CSS build. Every class below is written out in full for that
 * reason, which is also why the list is long and repetitive. It is not a candidate for
 * compression.
 */

/** The semantic accents the sheet uses. Each one means something; none is decorative. */
export type NeonAccent =
  | "prize" // gold - prize pools, first place, trophies
  | "entry" // emerald - entry fees, money, success, "you're in"
  | "players" // sky - participant counts, information
  | "score" // violet - game scores, the play action
  | "waiting" // amber - not started yet, pending
  | "ended" // rose - finished, closed, losses
  | "rate" // cyan - percentages and win rates
  | "value"; // blue - account values

interface AccentClasses {
  /** The rounded icon tile: background, border and the icon's own colour. */
  tile: string;
  /** Text colour for a heading or figure in this accent. */
  text: string;
  /** A tinted surface for a whole card in this accent. */
  surface: string;
}

const ACCENT_CLASSES = new Map<NeonAccent, AccentClasses>([
  [
    "prize",
    {
      tile: "bg-amber-500/10 border-amber-500/30 text-amber-300",
      text: "text-amber-300",
      surface: "bg-amber-500/10 border-amber-500/25",
    },
  ],
  [
    "entry",
    {
      tile: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
      text: "text-emerald-300",
      surface: "bg-emerald-500/10 border-emerald-500/25",
    },
  ],
  [
    "players",
    {
      tile: "bg-sky-500/10 border-sky-500/30 text-sky-300",
      text: "text-sky-300",
      surface: "bg-sky-500/10 border-sky-500/25",
    },
  ],
  [
    "score",
    {
      tile: "bg-violet-500/10 border-violet-500/30 text-violet-300",
      text: "text-violet-300",
      surface: "bg-violet-500/10 border-violet-500/25",
    },
  ],
  [
    "waiting",
    {
      tile: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",
      text: "text-yellow-300",
      surface: "bg-yellow-500/10 border-yellow-500/25",
    },
  ],
  [
    "ended",
    {
      tile: "bg-rose-500/10 border-rose-500/30 text-rose-300",
      text: "text-rose-300",
      surface: "bg-rose-500/10 border-rose-500/25",
    },
  ],
  [
    "rate",
    {
      tile: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
      text: "text-cyan-300",
      surface: "bg-cyan-500/10 border-cyan-500/25",
    },
  ],
  [
    "value",
    {
      tile: "bg-blue-500/10 border-blue-500/30 text-blue-300",
      text: "text-blue-300",
      surface: "bg-blue-500/10 border-blue-500/25",
    },
  ],
]);

const FALLBACK_ACCENT: AccentClasses = {
  tile: "bg-slate-500/10 border-slate-500/30 text-slate-300",
  text: "text-slate-300",
  surface: "bg-slate-500/10 border-slate-500/25",
};

export function accentClasses(accent: NeonAccent): AccentClasses {
  return ACCENT_CLASSES.get(accent) ?? FALLBACK_ACCENT;
}

/**
 * The panel shell every card in the sheet sits in - a navy-tinted near-black with a thin cool
 * border. Deliberately not `bg-gray-800/50`, which is the old neutral shell.
 */
export const NEON_PANEL =
  "rounded-xl border border-[#1B2540] bg-[#0A0F1F]/80 backdrop-blur-sm";

/** The same shell for something clickable. */
export const NEON_PANEL_INTERACTIVE = `${NEON_PANEL} transition-colors hover:border-[#2A3766] hover:bg-[#0D1428]/80`;

/** A leaderboard row, and the two states the sheet gives it. */
export const NEON_ROW =
  "rounded-xl border border-[#161E36] bg-[#080C18]/80 transition-colors hover:border-[#2A3766]";
export const NEON_ROW_YOU = "rounded-xl border border-sky-500/40 bg-sky-500/10";
export const NEON_ROW_PODIUM =
  "rounded-xl border border-amber-500/25 bg-amber-500/[0.06] transition-colors hover:border-amber-500/40";

/** The column headings above a leaderboard - small, spaced and quiet. */
export const NEON_TABLE_HEAD =
  "text-[11px] font-medium uppercase tracking-wider text-gray-500";

/** A figure's label, everywhere it appears. */
export const NEON_LABEL =
  "text-[11px] uppercase tracking-wider text-gray-500";

/** The rounded icon tile that fronts every stat card and panel heading in the sheet. */
export const NEON_TILE_SHAPE =
  "flex items-center justify-center rounded-lg border";
