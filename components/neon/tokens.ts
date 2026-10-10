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
 * Compact gapped cards for the arena board (owner 26 Sep 2026).
 *
 * WAS a flush table with left accent bars only. The owner's screenshot showed every row's
 * right edge missing — partly because `overflow-y-auto` clips a gold full-border on #1, and
 * partly because ordinary rows never had a right border at all. Image 4 draws each player as
 * its own rounded box; this set now does the same, with a small vertical gap so borders do
 * not collide. Padding on the scroll parent (`ArenaLeaderboardPanel`) must leave room for the
 * rim and glow, or the cutoff returns.
 *
 * BOTH SETS EXIST AND NEITHER REPLACES THE OTHER. The card form (`NEON_ROW*`) is what the
 * trading lobby renders; changing that would be an unasked-for trading change through a
 * shared token. These `FLUSH` names stay for call-site compatibility.
 */
export const NEON_ROW_FLUSH =
  "my-0.5 rounded-lg border border-[#1A4A7A]/55 bg-[#0E2448]/55 shadow-[inset_0_0_0_1px_rgba(16,137,220,0.06)] transition-colors hover:border-[#2A6AB0]/70 hover:bg-[#143258]/60";
export const NEON_ROW_FLUSH_YOU =
  "my-0.5 rounded-lg border border-sky-400/70 bg-sky-500/10 shadow-[0_0_12px_rgba(56,189,248,0.22)]";
export const NEON_ROW_FLUSH_PODIUM =
  "my-0.5 rounded-lg border border-amber-400/45 bg-amber-500/[0.07] shadow-[inset_0_0_0_1px_rgba(255,192,27,0.08)] transition-colors hover:border-amber-400/60";

/**
 * THE LEADER'S ROW, framed in gold on every side, from the owner's leaderboard reference
 * (`arena-target-leaderboard.png`, 11 September 2026), kept as a full box after the 26 Sep
 * cutoff fix so the gold rim is never clipped on the right.
 *
 * The reference singles out ONE row - the top of the board - with a full gold outline and a
 * warm wash fading to the right, and leaves second and third as plain numbered rows. That is
 * a fourth state rather than a restyle of the podium tint: the podium wash still marks the
 * three paying positions on the trading board, and this is drawn on top of it for the first.
 *
 * FLUSH ONLY. There is no card-form twin, because the card form is what the trading lobby
 * renders and the trading board was not part of the request; a gold #1 arriving there through
 * a shared token would be the invisible change the note above warns about.
 */
export const NEON_ROW_FLUSH_LEADER =
  "my-0.5 rounded-xl border border-[#FFC01B]/80 bg-gradient-to-r from-[#FFB300]/28 via-[#FFB300]/12 to-transparent shadow-[0_0_16px_rgba(255,192,27,0.35)]";

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
 *
 * NO CIRCUIT WASH (26 Sep 2026, second pass). The same SVG on the page, every panel AND the
 * board made the arena read as wallpaper; the board keeps a clean deep face so the game art
 * is what lights up, not a second pattern behind the iframe.
 */
export const NEON_STAGE_FRAME =
  "rounded-2xl border-2 border-cyan-400/55 bg-[#050E1C] p-1.5 shadow-[0_0_55px_-10px_rgba(34,211,238,0.9),0_0_28px_-6px_rgba(56,189,248,0.55)]";

/**
 * Quieter arena chrome for standings and the bottom rules strip.
 *
 * WHY IT EXISTS (26 Sep 2026). The board stage must be the brightest lit panel so the eye
 * lands on play first. Standings and rules stay readable but deliberately dimmer than
 * `NEON_PANEL_LIT` / `NEON_STAGE_FRAME` — same family, one step quieter. Do not brighten this
 * to match the stage; that undoes the hierarchy.
 *
 * COOL FLAT NAVY, not the shared circuit wash and not the near-black `#080C18` the owner
 * rejected on contest info (26 Sep polish). A cool face marks "context / standings"; the
 * facts column uses the warmer `NEON_PANEL_LIT` so the two sidebars are not the same card
 * repeated three times.
 */
export const NEON_PANEL_SIDE =
  "rounded-xl border border-[#1A4A7A]/55 bg-gradient-to-b from-[#0B1A36] via-[#091528] to-[#070F1C] shadow-[inset_0_1px_0_rgba(120,190,255,0.08),0_0_18px_-10px_rgba(16,137,220,0.28)]";

/**
 * A panel that is part of the action rather than context - the pre-flight, the result. Lit,
 * but a step below the board frame.
 */
export const NEON_STAGE_PANEL =
  "rounded-2xl border border-sky-500/25 bg-gradient-to-b from-[#0C1730] to-[#070C1A] shadow-[0_0_35px_-18px_rgba(56,189,248,0.65)]";

/** The tinted heading strip every panel in the reference wears. */
export const NEON_HEAD_STRIP =
  "border-b border-[#1089DC]/35 bg-gradient-to-r from-[#0B9FE8]/12 via-[#0B9FE8]/[0.03] to-transparent";

/** The heading text inside that strip: small, heavily tracked, cyan. */
export const NEON_HEADING =
  "text-[11px] font-bold uppercase tracking-[0.18em] text-[#16DFFF]";

/**
 * THE ARENA'S OWN CHROME for hero + contest facts + prize (the "action" column).
 *
 * Distinct from `NEON_PANEL_SIDE` on purpose (26 Sep 2026 polish): a slightly warmer mid-navy
 * so contest info / prize do not share one wallpaper with the leaderboard. No circuit SVG —
 * that wash on every section made the page busy; the page backdrop alone carries the grid.
 */
export const NEON_PANEL_LIT =
  "rounded-xl border border-[#2A6AB0]/45 bg-gradient-to-b from-[#122A52] via-[#0C1C3E] to-[#0A142C] shadow-[inset_0_1px_0_rgba(150,210,255,0.12),inset_0_0_24px_rgba(34,211,238,0.08),0_0_22px_-12px_rgba(56,189,248,0.35)]";

/**
 * Soft navy glass for tiles INSIDE a lit panel (stat cards, prize rows, label/value rows).
 *
 * Replaces the flat `#080C18` black the owner called out (26 Sep 2026) — near-black on mid-navy
 * read as a hole punched in the panel. This sits a shade lighter than the panel face so the
 * tile is a surface, not a void.
 */
export const NEON_FACE_TILE =
  "rounded-lg border border-[#2A5080]/45 bg-[#153566]/40 shadow-[inset_0_1px_0_rgba(160,210,255,0.08)]";

export const NEON_FACE_TILE_MUTED =
  "rounded-lg border border-[#1A3558]/40 bg-[#0E2240]/35 opacity-55";

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
export const NEON_INSET = `rounded-lg border border-[#2A5080]/40 bg-[#122848]/45`;

/**
 * The reference's segmented tabs, in the two sizes it draws: a heading pair across the top of a
 * panel, and a row of small scope pills beneath them.
 *
 * WHY THE TOKENS EXIST RATHER THAN THE CLASSES BEING WRITTEN WHERE THEY ARE USED. There are now
 * two strips on one panel, three states between them, and a third strip is one screen away. Each
 * state is a border, a fill and a text colour that have to agree with the panel they sit on, and
 * the failure when they do not is a tab that reads as a different control rather than as the
 * inactive half of this one. Nothing fails and nothing logs.
 *
 * THE THIRD STATE IS THE ONE WORTH A SENTENCE. `IDLE` is a tab a player can choose and has not;
 * `DEAD` is a tab drawn because the reference draws it, for a scope this platform has no data
 * for. They must not look the same: an idle tab that does nothing when clicked teaches a player
 * the screen is broken, so the dead one is dimmer, carries no hover, and is rendered with
 * `aria-disabled` and a title saying what it is waiting for. That is a labelled fact rather than
 * a control that appears to work.
 */
export const NEON_TABS_STRIP = `flex items-stretch gap-1.5 border-b p-1.5 ${NEON_DIVIDER}`;
export const NEON_TAB_ACTIVE =
  "border-[#1089DC]/55 bg-[#1B7DFF]/35 text-white shadow-[0_0_18px_rgba(43,176,255,0.55)]";
export const NEON_TAB_IDLE =
  "border-[#2A5080]/40 bg-[#153566]/35 text-sky-200/70 hover:border-[#2A5A9A] hover:text-sky-100";
export const NEON_TAB_DEAD =
  "border-[#16203C] bg-[#050A14] text-gray-600 cursor-not-allowed";
/** The shape both tab sizes share: the border, the radius and the centring. */
export const NEON_TAB_SHAPE =
  "flex flex-1 items-center justify-center gap-1.5 rounded-lg border text-center font-bold uppercase tracking-wide transition-colors";
