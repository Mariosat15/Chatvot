import {
  BarChart3,
  Brain,
  Club,
  Crosshair,
  Cpu,
  Flag,
  Gamepad2,
  HelpCircle,
  LayoutGrid,
  Puzzle,
  Shield,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * The genre badge in the top-left corner of a catalogue card.
 *
 * Keyed on the genre VOCABULARY slug (`game-categories.ts`), never on a game: a new title in an
 * existing genre gets the right icon with no code, and an unknown or custom genre falls back to
 * the generic controller. A `Map`, because the key comes from stored data and an object lookup
 * would walk the prototype chain.
 */
const GENRE_ICONS: ReadonlyMap<string, LucideIcon> = new Map<string, LucideIcon>([
  ["trading", BarChart3],
  ["puzzle", Puzzle],
  ["arcade", Gamepad2],
  ["racing", Flag],
  ["circuit", Cpu],
  ["reflex", Zap],
  ["strategy", Brain],
  ["sports", Trophy],
  ["shooter", Crosshair],
  ["survival", Shield],
  ["card", Club],
  ["board", LayoutGrid],
  ["trivia", HelpCircle],
]);

const CYAN_TONE =
  "border-[rgba(0,220,255,.45)] text-[#78f3ff] [&_svg]:text-[#00d8ff]";
/** Puzzle magenta / racing gold in Image 1; every other genre is cyan. */
const GENRE_TONES: ReadonlyMap<string, string> = new Map([
  ["puzzle", "border-[rgba(236,72,255,.55)] text-[#f5a8ff] [&_svg]:text-[#e879f9]"],
  ["racing", "border-[rgba(255,176,64,.6)] text-[#ffd447] [&_svg]:text-[#ffb040]"],
]);

export function GameCategoryBadge({
  slug,
  label,
}: {
  slug?: string;
  label: string;
}) {
  const Icon = (slug && GENRE_ICONS.get(slug)) || Gamepad2;
  const tone = (slug && GENRE_TONES.get(slug)) || CYAN_TONE;
  return (
    <span
      className={`inline-flex h-8 items-center gap-2 rounded-lg border bg-[rgba(3,14,35,.75)] px-[13px] text-[11px] font-bold uppercase tracking-[0.12em] backdrop-blur-md ${tone}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}
