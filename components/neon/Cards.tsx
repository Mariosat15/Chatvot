import type { LucideIcon } from "lucide-react";
import {
  NEON_ARENA_SURFACE,
  NEON_HEADING,
  NEON_HEAD_STRIP,
  NEON_LABEL,
  NEON_PANEL,
  NEON_PANEL_LIT,
  NEON_SEAM,
  NEON_TAB_ACTIVE,
  NEON_TAB_DEAD,
  NEON_TAB_IDLE,
  NEON_TAB_SHAPE,
  NEON_TILE_SHAPE,
  accentClasses,
  type NeonAccent,
} from "@/components/neon/tokens";

/**
 * The cards from the owner's style sheet: the icon tile, the stat card, the status card and the
 * panel.
 *
 * SERVER-SAFE ON PURPOSE. Nothing here uses a hook or an event handler, so both lobbies - which
 * are async server components - render these without pulling a client boundary into the page.
 * The one piece of the kit that must be a client component is the accordion, and it lives in its
 * own file for exactly that reason. **Do not add an `onClick` to anything in this file**; it
 * would turn every card in both lobbies into client-rendered markup for one caller's benefit.
 *
 * ICONS ARE LUCIDE, NOT THE 3D `GameIcon` SET, and this is a deliberate reversal of yesterday's
 * decision. The sheet's icons are flat line glyphs in tinted rounded tiles - trophy, link,
 * players, gamepad, clock, refresh, info, check - which is precisely what lucide draws. The 3D
 * PNG set is a different visual language and was the right answer only while the trading lobby
 * used it. Since the owner has decided the trading lobby moves too, the whole platform moves,
 * and the reversal is recorded in `13` s4.1d rather than quietly applied.
 */

/**
 * The arena page's background: the reference's navy with its faint circuit grid over it.
 *
 * INLINE STYLES RATHER THAN TAILWIND CLASSES, and it is not a shortcut. A grid is two
 * `linear-gradient`s and a `background-size`, which as an arbitrary Tailwind class is a
 * comma-laden string the compiler either emits or silently does not - the exact trap recorded
 * at the top of `tokens.ts`, where a class that exists in the TypeScript and in no stylesheet
 * renders as nothing and sends the next reader to the CSS build. An inline style cannot fail
 * that way.
 *
 * FIXED, NOT ABSOLUTE. The arena is taller than the viewport, and an absolutely-positioned
 * backdrop inside a scrolling page paints the grid once at the top and leaves the foot bare.
 *
 * THE SAME 34px PITCH AND THE SAME TONE AS THE GAME'S OWN PAGE, which is drawn by
 * `games-service` and shares no code with this repository. The value is copied deliberately -
 * copying a number across that boundary is allowed and importing across it is not - and it
 * matters because the board sits in an iframe in the middle of this page: two grids a few
 * pixels apart in pitch reads as a rendering fault rather than as one screen.
 */
export function NeonGridBackdrop() {
  return (
    <div
      className={`pointer-events-none fixed inset-0 -z-10 ${NEON_ARENA_SURFACE}`}
      aria-hidden
      style={{
        backgroundImage: [
          "linear-gradient(rgba(0,169,255,0.028) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(0,169,255,0.028) 1px, transparent 1px)",
          "radial-gradient(90% 55% at 50% -10%, #071B38 0%, transparent 70%)",
        ].join(", "),
        backgroundSize: "34px 34px, 34px 34px, auto",
      }}
    />
  );
}

/** The tinted rounded square that fronts every figure in the sheet. */
export function IconTile({
  icon: Icon,
  accent,
  size = "md",
}: {
  icon: LucideIcon;
  accent: NeonAccent;
  size?: "sm" | "md" | "lg";
}) {
  const box =
    size === "lg" ? "h-11 w-11" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const glyph =
    size === "lg" ? "h-5 w-5" : size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className={`${NEON_TILE_SHAPE} ${box} ${accentClasses(accent).tile}`}>
      <Icon className={glyph} strokeWidth={2} />
    </div>
  );
}

/**
 * The illustration beside a panel of text: the operator's picture if they uploaded one, and
 * a drawn emblem if they did not.
 *
 * WHY THE FALLBACK IS THE POINT OF THIS COMPONENT. The owner's arena reference draws a small
 * graphic beside each block of copy, and the obvious implementation renders the uploaded URL
 * and nothing when there is none - which means every title in the catalogue today, because
 * none of them carries one. A panel that is illustrated on some titles and bare on others
 * does not read as "artwork pending", it reads as a broken image. So the absent case has a
 * deliberate look, and uploading a picture replaces it rather than filling a hole.
 *
 * NOTHING HERE NAMES A GAME. The emblem is a tinted ring with one of the kit's lucide glyphs
 * in it, chosen by the CALLING PANEL rather than by the title - a rules panel always gets
 * the rules glyph, whatever game it is describing. Drawing something that depicted the game
 * would be per-game code in the layer built to avoid it, which is what the arena's
 * game-agnostic guard exists to catch.
 *
 * THE IMAGE IS A PLAIN `<img>`, NOT `next/image`. These URLs are served by an API route with
 * a database fallback, so they are not statically analysable assets and the optimiser 500s
 * on the one path that matters - the second application server, where the file exists only
 * in the database. Same reasoning as the admin upload field's preview.
 */
export function NeonIllustration({
  src,
  alt,
  icon: Icon,
  accent,
  shape = "square",
  fit = "cover",
}: {
  /** The operator's upload. Absent - the normal case - draws the emblem instead. */
  src?: string;
  /**
   * Describes the panel, never the picture, because nobody here knows what the picture is.
   * An operator's upload has no caption field and inventing one from the game's name would
   * be a claim about an image we have not seen.
   */
  alt: string;
  icon: LucideIcon;
  accent: NeonAccent;
  shape?: "square" | "landscape";
  /**
   * `contain` keeps the whole picture visible; `cover` fills the box and crops.
   *
   * THE ARENA BAND USES `contain` AND THAT IS NOT A PREFERENCE. These two uploads are
   * graphics rather than photographs - a keyed-out emblem, a small diagram - so the edges
   * carry the shape and a crop takes the corners off a badge. `cover` stays the default
   * because the slots that already existed are a logo and a hero banner, where filling the
   * frame is the whole job and a letterboxed banner reads as a broken image.
   */
  fit?: "cover" | "contain";
}) {
  const box = shape === "landscape" ? "aspect-[4/3]" : "aspect-square";
  const classes = accentClasses(accent);

  if (src) {
    return (
      <div
        className={`overflow-hidden rounded-lg border border-[#161E36] bg-[#080C18]/70 ${box}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-lg border border-[#161E36] bg-[#080C18]/70 ${box}`}
      aria-hidden
    >
      {/*
        Two rings and a glyph. The outer ring is the accent at a low opacity and the inner
        one is brighter, which is what gives the sheet's emblems their lit edge - a single
        ring reads as a placeholder box with an icon dropped in it.
      */}
      <div
        className={`flex h-[62%] w-[62%] max-h-24 max-w-24 items-center justify-center rounded-full border ${classes.tile}`}
      >
        <div
          className={`flex h-[70%] w-[70%] items-center justify-center rounded-full border ${classes.tile}`}
        >
          <Icon className="h-[45%] w-[45%]" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}

/**
 * A figure with its icon tile - the sheet's `STAT CARDS` row. One component covers the game
 * variants (prize pool, entry fee, players, your score) and the trading variants (total value,
 * total P&L, win rate, position), because they differ only in icon, accent and whether the
 * value is tinted. **That is the property to protect:** a second component for trading figures
 * is how the two lobbies drift apart again.
 */
export function StatCard({
  icon,
  accent,
  label,
  value,
  valueAccent,
  note,
}: {
  icon: LucideIcon;
  accent: NeonAccent;
  label: string;
  /*
    A node rather than a string, because one of these holds a live countdown component and
    another holds a dash for an absent score. Typed as `string` it forces the caller to smuggle
    the real content in through a second slot, which is the mistake the previous hero figure
    made - the value ended up rendered in the footnote's position with its classes overridden to
    hide it.
  */
  value: React.ReactNode;
  /** Tints the figure itself, for a profit or loss. Left unset the figure is plain white. */
  valueAccent?: NeonAccent;
  note?: React.ReactNode;
}) {
  return (
    <div className={`${NEON_PANEL} p-3 sm:p-4`}>
      <div className="flex items-center gap-3">
        <IconTile icon={icon} accent={accent} />
        <div className="min-w-0">
          <p className={NEON_LABEL}>{label}</p>
          <div
            className={`truncate text-lg font-bold sm:text-xl ${
              valueAccent ? accentClasses(valueAccent).text : "text-gray-100"
            }`}
          >
            {value}
          </div>
        </div>
      </div>
      {note}
    </div>
  );
}

/**
 * The sheet's `STATUS CARDS` - a tinted card with a circular glyph, a coloured headline and a
 * quiet second line. Four of them appear in the sheet and all four are states a player is
 * really in: entered, waiting for the start, finished, and not joined.
 *
 * THE SECOND LINE IS NOT OPTIONAL BY ACCIDENT. Every status in the sheet carries one, because
 * the headline alone tells a player what is true and not what to do about it. "Competition
 * ended" with nothing under it is the kind of message that generates a support ticket.
 */
export function StatusCard({
  icon: Icon,
  accent,
  title,
  detail,
  children,
}: {
  icon: LucideIcon;
  accent: NeonAccent;
  title: string;
  detail: React.ReactNode;
  children?: React.ReactNode;
}) {
  const classes = accentClasses(accent);

  return (
    <div className={`rounded-xl border p-4 ${classes.surface}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${classes.text}`} />
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${classes.text}`}>{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-400">
            {detail}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}

/** The sheet's `PANELS / CONTAINERS`, with the icon-tile heading it draws on every one. */
export function NeonPanel({
  icon,
  accent = "players",
  title,
  action,
  children,
  className = "",
}: {
  icon?: LucideIcon;
  accent?: NeonAccent;
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${NEON_PANEL} p-4 sm:p-5 ${className}`}>
      {title && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {icon && <IconTile icon={icon} accent={accent} size="sm" />}
            <h2 className="text-sm font-semibold text-gray-100">{title}</h2>
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * A panel whose heading sits in its own tinted strip, edge to edge - the shape every panel in
 * the owner's arena reference has.
 *
 * WHY IT IS NOT AN OPTION ON `NeonPanel`. That one pads its whole body and puts the heading
 * inside the padding, which is right for a panel of prose. This one's strip runs to the edges
 * and its body is frequently a divided list or a grid with no padding at all, so a `variant`
 * prop would mean every caller also choosing whether the body is padded - two decisions where
 * there should be one. They are two shapes, so they are two components.
 *
 * THE HEADING IS RENDERED HERE AND NOWHERE ELSE. Both the standings rail and the contest panel
 * had hand-written their own strip, differing already in border colour and letter spacing,
 * which is the "one rule, two copies" shape this codebase keeps paying for.
 */
export function NeonHeadedPanel({
  icon: Icon,
  title,
  action,
  children,
  className = "",
  bodyClassName = "",
  dense = false,
}: {
  icon?: LucideIcon;
  title: string;
  /** A count pill, a link - anything that belongs on the heading's right. */
  action?: React.ReactNode;
  children: React.ReactNode;
  /** The shell. Pass `NEON_STAGE_PANEL` for something the player is acting on. */
  className?: string;
  bodyClassName?: string;
  /**
   * A shorter heading strip, for a panel that has to fit a fixed compact height.
   *
   * IT IS A PROP RATHER THAN A SECOND COMPONENT because the alternative is a second copy of
   * the strip - the gradient, the hairline, the glyph size and the heading token - and the
   * arena's bottom band is exactly where a drifted shade shows, three panels across from the
   * full-height ones above them. The measurement is the reason it exists at all: the default
   * strip is about 34px of a 96px card, so a third of the panel is spent on its own title
   * before a single line of content is drawn.
   */
  dense?: boolean;
}) {
  return (
    /*
      THE LIT SHELL IS THIS PANEL'S DEFAULT since 11 September 2026, and the one-line change is
      the point of it. Every caller of this component is a game-arena screen - the leaderboard
      rail, the contest facts, the recent players, the prize breakdown - so the alternative was
      passing the same token at four call sites, which is four chances to forget and four
      copies to drift. The quiet `NEON_PANEL` remains the default everywhere else, so no
      trading screen moves; that was checked by grep rather than assumed.
    */
    <div className={`${className || NEON_PANEL_LIT} overflow-hidden`}>
      <div
        className={`flex items-center justify-between gap-2 ${
          dense ? "px-3 py-1.5" : "px-4 py-2.5"
        } ${NEON_HEAD_STRIP}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          {/*
            The reference's heading glyphs are the same cyan as its heading text, not a step
            duller - so the icon takes the heading's own colour rather than a sky tint beside
            it. One colour, one token, and they cannot drift a shade apart.
          */}
          {Icon && (
            <Icon
              className={`${dense ? "h-3 w-3" : "h-3.5 w-3.5"} shrink-0 text-[#16DFFF]`}
            />
          )}
          {/*
            `truncate` on the dense heading and not on the default one. A compact panel is one
            of three across a band, so its title is the first thing that runs out of room - and
            a heading that wraps to two lines inside a fixed-height card pushes a line of
            content out of the bottom, which is content disappearing to make space for a title.
          */}
          <h2 className={`${NEON_HEADING} ${dense ? "truncate" : ""}`}>{title}</h2>
        </div>
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

/**
 * The reference's figure strip: several small figures across one row, hairline-separated.
 *
 * `gap-px` over a tinted background is what draws the separators, so the strip has no borders
 * of its own and sits flush inside whatever panel holds it. **Give it items that fit** - the
 * values are short by design (a pot, a fee, a count, a clock), and a long one truncates rather
 * than widening the strip and pushing its neighbours off.
 */
export function NeonStatStrip({
  items,
  columns = 2,
}: {
  items: {
    icon: LucideIcon;
    accent: NeonAccent;
    label: string;
    /** Absent renders a dash. A zero is a real figure and renders as zero. */
    value: React.ReactNode;
  }[];
  columns?: 2 | 4;
}) {
  return (
    <div
      className={`grid gap-px ${NEON_SEAM} ${
        columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"
      }`}
    >
      {items.map((item) => {
        const classes = accentClasses(item.accent);
        return (
          <div key={item.label} className="bg-[#0A1122] px-4 py-3">
            <div className="flex items-center gap-1.5">
              <item.icon className={`h-3.5 w-3.5 shrink-0 ${classes.text}`} />
              <span className={`truncate ${NEON_LABEL}`}>{item.label}</span>
            </div>
            <div className={`mt-1 truncate text-lg font-bold ${classes.text}`}>
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The reference's figure CARDS: the same figures as the strip, each in its own rounded cell
 * with the kit's icon tile.
 *
 * TWO SHAPES RATHER THAN A `variant` ON THE STRIP, for the reason `NeonHeadedPanel` is not an
 * option on `NeonPanel`. The strip is hairline-separated cells flush inside a panel, so it has
 * no padding and no radius of its own; these are separated cards that need both. A flag would
 * mean every caller also deciding the padding, which is two decisions where there should be
 * one.
 *
 * WHEN TO USE WHICH. The strip is for a dense run of facts inside a panel that already has a
 * heading strip - it reads as a table. This is for the small number of figures a player should
 * be able to take in without reading, which on the arena is the contest's own four. Using the
 * cards for everything is how a screen ends up with no hierarchy, which was the owner's
 * complaint about the version before this one.
 */
export function NeonStatTiles({
  items,
  columns = 2,
}: {
  items: {
    icon: LucideIcon;
    accent: NeonAccent;
    label: string;
    /** Absent renders a dash at the call site. A zero is a real figure and renders as zero. */
    value: React.ReactNode;
  }[];
  columns?: 2 | 3;
}) {
  return (
    <div
      className={`grid gap-2.5 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}
    >
      {items.map((item) => {
        const classes = accentClasses(item.accent);
        return (
          <div
            key={item.label}
            className="rounded-lg border border-[#161E36] bg-[#080C18]/70 p-3"
          >
            <div className="flex items-center gap-2">
              <IconTile icon={item.icon} accent={item.accent} size="sm" />
              <span className={`truncate ${NEON_LABEL}`}>{item.label}</span>
            </div>
            <div
              className={`mt-2 truncate text-xl font-bold leading-none ${classes.text}`}
            >
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A label/value line inside a panel. */
export function NeonRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: NeonAccent;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#161E36] bg-[#080C18]/60 px-3 py-2.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span
        className={`text-sm font-semibold ${
          accent ? accentClasses(accent).text : "text-gray-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The small count or tag pill that sits in a panel's header, beside the title.
 *
 * This exists because both lobbies had written the same seven-class string by hand - the game
 * lobby's "N players" and the trading lobby's "N traders" and "Top 10" - which is the "one rule,
 * two copies" shape behind several defects in this codebase. **The wording stays with the
 * caller**, because a game has players and a trading contest has traders, and that difference is
 * meaningful; only the appearance is shared.
 */
export function NeonCountPill({
  children,
  tone = "quiet",
}: {
  children: React.ReactNode;
  tone?: "quiet" | "warn";
}) {
  const shell =
    tone === "warn"
      ? "border-orange-500/25 bg-orange-500/10 text-orange-300"
      : "border-[#1B2540] bg-[#080C18] text-gray-400";

  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${shell}`}
    >
      {children}
    </span>
  );
}

/**
 * The scope strip above the reference's leaderboard - `GLOBAL | FRIENDS | COUNTRY`, filling the
 * width, with the one the board can answer lit.
 *
 * THE DEAD SCOPES ARE DRAWN, ON THE OWNER'S SECOND INSTRUCTION (11 September 2026). They were
 * deliberately omitted before, and the reasoning was sound and is worth keeping visible: a tab
 * that does nothing when clicked teaches a player the screen is broken, and there is no friends
 * graph behind `FRIENDS` and no per-entrant country on a contest board behind `COUNTRY`. The
 * owner asked for all three twice. So they are here, and the way they are drawn is the answer to
 * the original objection - `NEON_TAB_DEAD` is dimmer than an idle tab, has no hover, is not a
 * button, and carries `aria-disabled` and a title saying what it is waiting for. A player can see
 * it is not offering them anything, which is the difference between a labelled fact and a control
 * that appears to work and does nothing.
 *
 * The caller passes the scopes it CAN answer first, then the ones it cannot; the first is lit.
 */
export function NeonScopeStrip({
  scopes,
  unavailable = [],
  unavailableTitle = "Not available yet",
}: {
  scopes: string[];
  /** Present in the reference, no data source here. Drawn dim and not selectable. */
  unavailable?: string[];
  unavailableTitle?: string;
}) {
  const size = "px-2 py-1 text-[10px] font-semibold uppercase tracking-wider";

  return (
    <div className="flex items-stretch gap-1.5 px-3 pt-2.5">
      {scopes.map((scope, index) => (
        <span
          key={scope}
          className={`${NEON_TAB_SHAPE} ${size} ${
            index === 0 ? NEON_TAB_ACTIVE : NEON_TAB_IDLE
          }`}
        >
          {scope}
        </span>
      ))}
      {unavailable.map((scope) => (
        <span
          key={scope}
          aria-disabled="true"
          title={unavailableTitle}
          className={`${NEON_TAB_SHAPE} ${size} ${NEON_TAB_DEAD}`}
        >
          {scope}
        </span>
      ))}
    </div>
  );
}

/** The explanatory sentence under a panel's rows. */
export function NeonNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-xs leading-relaxed text-gray-400">{children}</p>
  );
}
