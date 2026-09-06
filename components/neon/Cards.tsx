import type { LucideIcon } from "lucide-react";
import {
  NEON_LABEL,
  NEON_PANEL,
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

/** The explanatory sentence under a panel's rows. */
export function NeonNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-xs leading-relaxed text-gray-400">{children}</p>
  );
}
