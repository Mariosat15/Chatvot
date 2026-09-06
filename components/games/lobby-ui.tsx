import { GameIcon } from "@/components/ui/GameIcon";
import type { GameIconName } from "@/lib/constants/game-icons";

/**
 * The visual chrome a game lobby shares with the trading lobby.
 *
 * EVERY CLASS STRING IN HERE WAS COPIED FROM `app/(root)/competitions/[id]/page.tsx`, not
 * invented to look similar. That is the point of the file: the owner's requirement is that the
 * two lobbies read as one product, and "approximately the same dark card" is exactly how a
 * second visual language gets established. A player reaches both screens from the same list, so
 * a different corner radius, border tone or label case is read as a different site rather than
 * as a different game.
 *
 * WHAT IS SHARED IS THE CHROME, NEVER THE CONTENT. The trading lobby's panels hold leverage,
 * margin, asset classes and profit and loss; none of that appears here, because `05` section 10
 * makes it binding rather than stylistic - a figure is either generalised across games or
 * explicitly scoped to one, and there is no third option. So this file exports shells and
 * typography with no opinion about what goes inside them.
 *
 * IT IS NOT AN ABSTRACTION OVER THE TRADING LOBBY, and must not become one. The trading page
 * keeps its own copies of these class strings and is deliberately left byte-identical - that is
 * what makes the existing trading lobby tests evidence that nothing moved. Refactoring the
 * trading page to import from here would destroy that guarantee for a cosmetic gain, which is
 * the same trade that kept a known one-character fee defect verbatim during the settlement
 * extraction.
 */

/**
 * A figure in the hero strip. Plain text on the gradient, exactly as the trading lobby renders
 * prize pool and entry fee - not a card. The mock-up draws these as four bordered tiles; the
 * trading lobby is the reference the owner asked for, so the trading treatment wins and the
 * tiles are noted in `13` s4.1c as part of the future theme.
 */
export function HeroFigure({
  label,
  value,
  tone = "neutral",
  note,
}: {
  label: string;
  /*
    A node, not a string. Reason: the fourth figure is a live countdown component on a running
    contest and a word on a finished one, and the trading lobby renders exactly that. Typed as
    `string` it forced the countdown in through a second "note" slot, which put the figure in
    the footnote's position and the footnote in the figure's - correct output only because both
    class strings were then overridden, which is the kind of fix that survives review and breaks
    on the next edit.
  */
  value: React.ReactNode;
  tone?: "neutral" | "prize" | "live" | "cancelled";
  note?: React.ReactNode;
}) {
  const valueTone =
    tone === "prize"
      ? "text-yellow-500"
      : tone === "live"
        ? "text-yellow-400"
        : tone === "cancelled"
          ? "text-red-500"
          : "text-gray-100";

  return (
    <div>
      <p className="text-[11px] sm:text-xs text-gray-500 uppercase tracking-wider">
        {label}
      </p>
      <div
        className={`text-xl sm:text-2xl md:text-3xl font-bold ${valueTone}`}
      >
        {value}
      </div>
      {note}
    </div>
  );
}

/*
  A lookup rather than interpolation into the class string, and the reason is not style.
  Tailwind compiles the classes it can SEE in the source, so `border-${accent}-500/30` names a
  class that exists in this TypeScript and in no stylesheet - the panel renders completely
  unstyled, which reads as a broken CSS build rather than as a bug in this file.

  A `Map` rather than an object, for the reason the round-resolution action list is one: object
  indexing walks the prototype chain, so a key like `toString` resolves to something truthy. It
  cannot happen here, because `accent` is a closed union - but "safe by accident is not safe",
  and the linter is right to refuse to tell the two cases apart.
*/
const GRAY_SHELL = "from-gray-800/60 to-gray-800/30 border-gray-700";

const PANEL_SHELLS = new Map<string, string>([
  ["gray", GRAY_SHELL],
  ["gold", "from-yellow-500/10 to-gray-800/50 border-yellow-500/30"],
  ["violet", "from-violet-500/10 to-gray-800/50 border-violet-500/30"],
  ["sky", "from-sky-500/10 to-gray-800/50 border-sky-500/30"],
  ["amber", "from-amber-500/10 to-gray-800/50 border-amber-500/30"],
]);

/**
 * A sidebar panel. The gradient-and-tinted-border shell the trading lobby uses for its prize
 * distribution and risk sections, with the accent passed in so a panel can carry a colour that
 * means something. `GameIcon` rather than a lucide glyph: the trading lobby's panels are headed
 * by the 3D icon set, and mixing flat line icons into the same column is the most visible way
 * two screens stop looking like one product.
 */
export function SidePanel({
  icon,
  title,
  accent = "gray",
  children,
  action,
}: {
  icon: GameIconName;
  title: string;
  accent?: "gray" | "gold" | "violet" | "sky" | "amber";
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl bg-gradient-to-br border p-4 ${PANEL_SHELLS.get(accent) ?? GRAY_SHELL}`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <GameIcon name={icon} size={16} />
          <h3 className="text-sm font-semibold text-gray-100">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/**
 * A label/value row inside a panel, matching the trading lobby's risk rows - a tinted pill
 * rather than two spans on the panel background, which is what makes the sidebar read as a
 * list of facts instead of a paragraph.
 */
export function PanelRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 p-2.5 rounded-lg ${
        emphasis
          ? "bg-yellow-500/10 border border-yellow-500/20"
          : "bg-gray-900/50 border border-gray-700/50"
      }`}
    >
      <span className="text-xs text-gray-400">{label}</span>
      <span
        className={`text-sm font-semibold ${emphasis ? "text-yellow-400" : "text-gray-100"}`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The explanatory sentence under a panel's rows. Its own component only so the muted size and
 * colour cannot drift between the three panels that use it - the play window, the attempts and
 * the unresolved-round policy all carry one, and the third is the one that costs money when it
 * is missing, so it must not be styled as an afterthought.
 */
export function PanelNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-2.5 text-xs leading-relaxed text-gray-400">{children}</p>;
}

/**
 * The contest's lifecycle badge. Copied from the trading lobby's hero, including the pulsing
 * dot on a live contest, because a player who has both kinds of contest open in two tabs should
 * not have to work out which convention each tab is using.
 */
export function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-blue-500 text-white text-sm font-medium animate-pulse">
        <span className="w-2 h-2 bg-white rounded-full" />
        LIVE NOW
      </span>
    );
  }

  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-red-600 text-white text-lg font-bold">
        CANCELLED
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-gray-700 text-gray-200 text-sm font-medium">
        COMPLETED
      </span>
    );
  }

  /*
    `draft` deliberately falls through to nothing rather than to a badge. A draft is not visible
    to players at all, so the only way to reach this branch is an operator following a direct
    link - and inventing a player-facing label for a state players cannot see is how the admin
    competitions list ended up rendering drafts in the grey it uses for finished contests.
  */
  return null;
}
