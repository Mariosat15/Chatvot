import {
  CalendarClock,
  Clock,
  DoorOpen,
  Gamepad2,
  Hourglass,
  LifeBuoy,
  RotateCcw,
  Swords,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import {
  RuleCard,
  RuleRow,
  type RuleCardAccent,
  type RuleTone,
} from "@/components/trading/lobby/TradingRuleCard";

/**
 * Game sidebar "Event details", organised into categories the way the trading lobby's rule
 * cards are (owner, 15 Oct 2026: the long sentences "must be organised into categories like the
 * competition trading lobby"). Each category is a `RuleCard`; each fact a `RuleRow` with a SHORT
 * value and the full sentence on its ? tip.
 *
 * Only rows with a real value render, and a category with none is dropped - never an empty
 * heading. Icons are chosen by a string key so the facts stay plain data; nothing here switches
 * on a game code.
 */

export type GameEventIcon =
  | "format"
  | "clock"
  | "attempt"
  | "winner"
  | "counts"
  | "opens"
  | "closes"
  | "last"
  | "stall"
  | "leave";

const ICONS = new Map<GameEventIcon, LucideIcon>([
  ["format", Swords],
  ["clock", Clock],
  ["attempt", RotateCcw],
  ["winner", Trophy],
  ["counts", Target],
  ["opens", CalendarClock],
  ["closes", Hourglass],
  ["last", Gamepad2],
  ["stall", LifeBuoy],
  ["leave", DoorOpen],
]);

export interface GameEventRow {
  icon: GameEventIcon;
  label: string;
  value: React.ReactNode;
  tone?: RuleTone;
  tip?: string;
}

export interface GameEventSection {
  title: string;
  subtitle?: string;
  iconSrc: string;
  accent: RuleCardAccent;
  rows: GameEventRow[];
}

function hasValue(value: React.ReactNode): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function GameEventDetails({ sections }: { sections: GameEventSection[] }) {
  const visible = sections
    .map((section) => ({
      ...section,
      rows: section.rows.filter((row) => hasValue(row.value)),
    }))
    .filter((section) => section.rows.length > 0);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-4">
      {visible.map((section) => (
        <RuleCard
          key={section.title}
          iconSrc={section.iconSrc}
          accent={section.accent}
          title={section.title}
          subtitle={section.subtitle}
        >
          {section.rows.map((row) => (
            <RuleRow
              key={row.label}
              icon={ICONS.get(row.icon) ?? Clock}
              label={row.label}
              value={row.value}
              tone={row.tone}
              tip={row.tip}
            />
          ))}
        </RuleCard>
      ))}
    </div>
  );
}
