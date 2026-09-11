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

/**
 * THE SAME THREE STATES DRAWN FLUSH, for a board long enough that the cards become the problem.
 *
 * Added 11 September 2026 on the owner's reference. A bordered, rounded, gapped tile per player
 * reads well for five rows and badly for twenty: at that length the borders and the gaps are
 * most of the panel, every row is mostly empty space, and the shape of the contest - who is
 * close to whom - is below the fold. The reference draws a table: rows flush against each
 * other, one hairline between them, and a state shown by a left accent bar and a wash rather
 * than by an outline.
 *
 * BOTH SETS EXIST AND NEITHER REPLACES THE OTHER. The card form is right for a short board in a
 * wide column and it is what the trading lobby renders today; changing it here would be an
 * unasked-for change to a trading screen, made invisibly, through a shared token.
 *
 * The left bar is `border-l-2` on every state INCLUDING the ordinary one, where it is
 * transparent. Applied only to the highlighted states, the two pixels appear and disappear with
 * the state and every ordinary row's content sits two pixels to the left of the podium's.
 */
export const NEON_ROW_FLUSH =
  "border-l-2 border-transparent transition-colors hover:bg-[#0D1428]/60";
export const NEON_ROW_FLUSH_YOU = "border-l-2 border-sky-400 bg-sky-500/10";
export const NEON_ROW_FLUSH_PODIUM =
  "border-l-2 border-amber-400/70 bg-amber-500/[0.05] transition-colors hover:bg-amber-500/[0.08]";

/**
 * THE LEADER'S ROW, framed in gold on every side, from the owner's leaderboard reference
 * (`arena-target-leaderboard.png`, 11 September 2026).
 *
 * The reference singles out ONE row - the top of the board - with a full gold outline and a
 * warm wash fading to the right, and leaves second and third as plain numbered rows. That is
 * a fourth state rather than a restyle of the podium tint: the podium wash still marks the
 * three paying positions on the trading board, and this is drawn on top of it for the first.
 *
 * The frame is rounded on a flush board even though its neighbours are not, deliberately: a
 * square gold outline between two hairlines reads as a table cell that happens to be yellow,
 * and the rounded one reads as the medal it is. The row keeps `border-l-2` so its content sits
 * exactly where every other row's does - see the note on the flush set above.
 *
 * FLUSH ONLY. There is no card-form twin, because the card form is what the trading lobby
 * renders and the trading board was not part of the request; a gold #1 arriving there through
 * a shared token would be the invisible change the note above warns about.
 */
export const NEON_ROW_FLUSH_LEADER =
  "rounded-lg border border-l-2 border-[#FFC01B]/80 bg-gradient-to-r from-[#FFB300]/20 to-[#FFB300]/5";

/**
 * The gold a score is written in on the reference board - every score, not only the podium's,
 * because on that board the colour says "this is the figure you are ranked on" rather than
 * "this row is paying". One token, so the leader frame above and the figures inside it are the
 * same gold and cannot drift a shade apart.
 */
export const NEON_SCORE_GOLD = "text-[#FFD72D]";

/** The hairline between flush rows, as a `divide-*` utility rather than a border. */
export const NEON_DIVIDE = "divide-y divide-[#16203C]";

/** The column headings above a leaderboard - small, spaced and quiet. */
export const NEON_TABLE_HEAD =
  "text-[11px] font-medium uppercase tracking-wider text-gray-500";

/** A figure's label, everywhere it appears. */
export const NEON_LABEL =
  "text-[11px] uppercase tracking-wider text-gray-500";

/** The rounded icon tile that fronts every stat card and panel heading in the sheet. */
export const NEON_TILE_SHAPE =
  "flex items-center justify-center rounded-lg border";

/*
 * ----------------------------------------------------------------------------------------
 * THE LIT CHROME, added 8 September 2026 from the owner's arena reference.
 *
 * WHY THESE ARE ADDITIVE RATHER THAN A CHANGE TO `NEON_PANEL`. The reference is the same
 * design language as the component sheet - deep navy, cyan hairlines - but it lights the
 * things a player is looking AT: the board has a glowing frame, and every panel wears a
 * tinted heading strip. `NEON_PANEL` is the quiet card that surrounds them, and it is right
 * as it is; if the quiet card glowed too, nothing would stand out and the screen would read
 * as uniformly loud rather than as designed. **Adding a lit variant is the change. Turning
 * the base panel up is not.**
 *
 * AND THE PRACTICAL REASON THEY LIVE HERE RATHER THAN AT THE CALL SITE: the same shadow and
 * the same border tint appear on the board frame, the stage panels and the headed panels. A
 * shadow written out three times drifts by one hex digit and reads as a rendering fault.
 * ----------------------------------------------------------------------------------------
 */

/**
 * The heavy glowing frame the reference draws around the board itself.
 *
 * The board is the one thing on the screen the player is actually doing, so it is the one
 * thing with a lit edge. Nothing else on the arena may use this.
 */
export const NEON_STAGE_FRAME =
  "rounded-2xl border-2 border-sky-500/35 bg-[#060C1A] p-1.5 shadow-[0_0_45px_-15px_rgba(56,189,248,0.7)]";

/**
 * A panel that is part of the action rather than context - the pre-flight, the result. Lit,
 * but a step below the board frame.
 */
export const NEON_STAGE_PANEL =
  "rounded-2xl border border-sky-500/25 bg-gradient-to-b from-[#0C1730] to-[#070C1A] shadow-[0_0_35px_-18px_rgba(56,189,248,0.65)]";

/** The tinted heading strip every panel in the reference wears. */
export const NEON_HEAD_STRIP =
  "border-b border-[#1089DC]/40 bg-gradient-to-r from-[#0B9FE8]/15 via-[#0B9FE8]/[0.04] to-transparent";

/** The heading text inside that strip: small, heavily tracked, cyan. */
export const NEON_HEADING =
  "text-[11px] font-bold uppercase tracking-[0.18em] text-[#16DFFF]";

/**
 * THE ARENA'S OWN CHROME, brightened 11 September 2026 on the owner's third reference
 * (`arena-target-full.png`), whose words were "the graphics are not like image 2 - the
 * background, the icons, the colours, more glow blue".
 *
 * WHY A SECOND PANEL SHELL RATHER THAN A BRIGHTER `NEON_PANEL`. The base shell is what the
 * TRADING lobby renders, and the trading lobby was not part of the request; turning it up would
 * be an unasked-for change to a trading screen made invisibly through a shared token. So the
 * arena gets its own, and it is the reference's own values - a `#1089DC` rim on a deep-navy
 * face, lit faintly from inside - rather than a guess at "more blue".
 *
 * The two are deliberately close enough to be the same product and far enough apart to tell
 * which screen you are on. `NEON_PANEL_LIT` belongs to the arena; nothing else may use it,
 * for the same reason `NEON_STAGE_FRAME` belongs to the board.
 */
export const NEON_PANEL_LIT =
  "rounded-xl border border-[#1089DC]/55 bg-gradient-to-b from-[#05142C]/95 to-[#030F23]/95 shadow-[inset_0_0_24px_rgba(0,103,221,0.10)]";

/**
 * The arena page's own background: the reference's near-black navy, a shade off the app's
 * near-black so the page reads as a place rather than as a document.
 *
 * The faint circuit grid that goes with it is NOT here, because a grid is a
 * `background-image` with commas in it and Tailwind compiles only the classes it can see -
 * see the trap at the top of this file. It is drawn by `NeonGridBackdrop` in `Cards.tsx`,
 * which uses an inline style and therefore cannot fail silently.
 */
export const NEON_ARENA_SURFACE = "bg-[#020B1C]";

/**
 * The hairline that separates two things sharing one surface, in its two forms.
 *
 * WHY THESE EXIST RATHER THAN THE COLOUR BEING WRITTEN OUT. It had been spelled in full in
 * four places - the stat strip's seam, this file's own inset, the pre-flight and the arena's
 * contest panel - which is three consumers holding a copy of a kit colour. The strip's seams
 * and a divider drawn beside them have to be the SAME tone or the join is visible as a
 * slightly different grey, and that is not a failure any test would report.
 *
 * They are whole class names rather than a bare colour on purpose: Tailwind compiles only
 * classes it can see in the source, so `bg-[${NEON_SEAM_COLOUR}]` renders unstyled.
 */
export const NEON_SEAM = "bg-[#16203C]";
export const NEON_DIVIDER = "border-[#16203C]";

/**
 * A note or figure box INSIDE a panel - one shade darker than whatever contains it.
 *
 * This exists because the game screens were still using `border-gray-700 bg-gray-900/60`,
 * the app's neutral shell, for exactly this job. On a navy panel a neutral grey inset reads
 * as a piece of a different website, which is what the owner was seeing.
 */
export const NEON_INSET = `rounded-lg border ${NEON_DIVIDER} bg-[#070C1A]/70`;
