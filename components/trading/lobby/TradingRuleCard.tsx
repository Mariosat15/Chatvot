import { AlertTriangle, type LucideIcon } from "lucide-react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

/**
 * The trading detail tabs' rule cards (owner reference, 12 Oct 2026): a lit card with a large
 * neon picture tile, a bold title and a one-line subtitle, then dark rows with a leading glyph,
 * a label and a right-aligned coloured value.
 *
 * Server-only presentation. Every value is computed by `buildTradingLobbySections` and handed
 * in; nothing here decides a rule. The tone and frame dictionaries are Maps of whole class
 * strings so Tailwind sees every class literally and a stored value can never reach a lookup.
 *
 * Explanations ride on `tip` via the shared `InfoTooltip` (? icon) rather than a second row -
 * owner, 12 Oct 2026: the blue info boxes under each row were taking too much space.
 */

export type RuleTone =
  "cyan" | "yellow" | "purple" | "pink" | "red" | "orange" | "green" | "plain";

const VALUE_TONE = new Map<RuleTone, string>([
  ["cyan", "text-cyan-300"],
  ["yellow", "text-amber-300"],
  ["purple", "text-violet-300"],
  ["pink", "text-pink-300"],
  ["red", "text-rose-400"],
  ["orange", "text-orange-300"],
  ["green", "text-emerald-300"],
  ["plain", "text-gray-100"],
]);

export type RuleCardAccent = "sky" | "violet" | "pink" | "rose" | "amber";

const CARD_FRAME = new Map<RuleCardAccent, string>([
  ["sky", "border-sky-400/45 shadow-[0_0_26px_rgba(56,189,248,0.16)]"],
  ["violet", "border-violet-400/45 shadow-[0_0_26px_rgba(167,139,250,0.16)]"],
  ["pink", "border-pink-400/45 shadow-[0_0_26px_rgba(244,114,182,0.16)]"],
  ["rose", "border-rose-400/45 shadow-[0_0_26px_rgba(251,113,133,0.16)]"],
  ["amber", "border-amber-400/45 shadow-[0_0_26px_rgba(251,191,36,0.16)]"],
]);

export function RuleCard({
  iconSrc,
  accent,
  title,
  subtitle,
  badge,
  children,
}: {
  iconSrc: string;
  accent: RuleCardAccent;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border bg-[#060A18]/85 p-5 ${CARD_FRAME.get(accent) ?? ""}`}
    >
      <header className="mb-4 flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed local icon art */}
        <img
          src={iconSrc}
          alt=""
          draggable={false}
          className="h-14 w-14 shrink-0 object-contain"
        />
        <div className="min-w-0 flex-1 pt-1">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-sm text-gray-400">{subtitle}</p>
          )}
        </div>
        {badge}
      </header>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

/** The small pill a card may carry on the right of its heading ("Forex"). */
export function RuleBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-sm font-semibold text-cyan-200">
      {children}
    </span>
  );
}

export function RuleRow({
  icon: Icon,
  label,
  value,
  tone = "plain",
  tip,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  tone?: RuleTone;
  /** Shown on the shared ? icon (hover / tap). Omit when there is nothing to explain. */
  tip?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0B1124]/80 px-3.5 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-gray-300">
        <Icon className="h-4 w-4" />
      </span>
      <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-gray-200">
        {label}
        {tip ? <InfoTooltip text={tip} iconSize={12} /> : null}
      </span>
      <span
        className={`ml-auto text-right text-sm font-bold ${VALUE_TONE.get(tone) ?? "text-gray-100"}`}
      >
        {value}
      </span>
    </div>
  );
}

/** A consequence the trader must not miss, drawn as a red-tinted row. */
export function RuleWarning({
  label,
  value,
  tip,
}: {
  label: string;
  value: React.ReactNode;
  tip?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.08] px-3.5 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-300">
        <AlertTriangle className="h-4 w-4" />
      </span>
      <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-gray-200">
        {label}
        {tip ? <InfoTooltip text={tip} iconSize={12} /> : null}
      </span>
      <span className="ml-auto text-right text-sm font-bold text-rose-400">
        {value}
      </span>
    </div>
  );
}

/**
 * The margin ladder: one row per level with a coloured dot, then the segmented bar. The
 * segment widths are the old card's own (20/20/20/40) - the bar is a legend, not a scale.
 * Optional `tip` uses the same ? icon as `RuleRow` (owner, 12 Oct 2026).
 */
export function MarginLadder({
  levels,
}: {
  levels: {
    label: string;
    value: string;
    dot: string;
    text: string;
    tip?: string;
  }[];
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0B1124]/80 px-3.5 py-3">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">
        Margin levels
      </p>
      <ul className="space-y-2">
        {levels.map((level) => (
          <li key={level.label} className="flex items-center gap-2.5 text-sm">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${level.dot}`}
            />
            <span className="inline-flex min-w-0 items-center gap-1.5 text-gray-200">
              {level.label}
              {level.tip ? (
                <InfoTooltip text={level.tip} iconSize={12} />
              ) : null}
            </span>
            <span className={`ml-auto font-bold ${level.text}`}>
              {level.value}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex h-2 gap-1">
        <div className="w-[20%] rounded-full bg-rose-500" />
        <div className="w-[20%] rounded-full bg-orange-500" />
        <div className="w-[20%] rounded-full bg-amber-400" />
        <div className="w-[40%] rounded-full bg-emerald-500" />
      </div>
    </div>
  );
}
