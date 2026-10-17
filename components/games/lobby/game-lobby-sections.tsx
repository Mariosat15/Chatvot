import { Gamepad2 } from "lucide-react";
import { GameEventDetails, type GameEventSection } from "@/components/competitions/detail/GameEventDetails";
import type { NeonAccordionSection } from "@/components/neon/Accordion";
import { NEON_ICON } from "@/lib/services/games/overview-assets";
import { RuleCard, RuleRow } from "@/components/trading/lobby/TradingRuleCard";
import {
  ATTEMPTS_POLICY_SHORT,
  UNRESOLVED_POLICY_SHORT,
  formatUTCShort,
} from "@/components/games/lobby/game-lobby-copy";

/**
 * Tab bodies for the game lobby main column — same strip as trading's
 * `buildTradingLobbySections`, fed from game event categories + catalogue rules text.
 *
 * Icons are ReactNodes built here on the server page (same pattern as trading).
 */

/** Category cards for the Rules tabs / mobile details column. */
export function buildGameEventSections(input: {
  modeLabel: string;
  modeDetail: string;
  roundTimeLabel: string;
  roundSeconds: number | null;
  attemptsPolicy: string;
  attemptsTip?: string;
  scoreLabel: string;
  scoringNote: string;
  playWindowStart: Date | string | undefined;
  playWindowEnd: Date | string | undefined;
  playWindowStartTip?: string;
  playWindowEndTip?: string;
  unresolvedPolicy: string;
  unresolvedTip?: string;
}): GameEventSection[] {
  return [
    {
      title: "How you play",
      subtitle: "Format and rounds",
      iconSrc: NEON_ICON("swords"),
      accent: "sky",
      rows: [
        {
          icon: "format",
          label: "Format",
          value: input.modeLabel,
          tone: "cyan",
          tip: input.modeDetail,
        },
        {
          icon: "clock",
          label: "Round length",
          value: input.roundSeconds ? `Up to ${input.roundTimeLabel}` : null,
          tone: "cyan",
        },
        {
          icon: "attempt",
          label: "Attempts",
          value: ATTEMPTS_POLICY_SHORT.get(input.attemptsPolicy),
          tone: "purple",
          tip: input.attemptsTip,
        },
      ],
    },
    {
      title: "Scoring",
      subtitle: "Who wins",
      iconSrc: NEON_ICON("target-purple"),
      accent: "violet",
      rows: [
        {
          icon: "winner",
          label: "Winner",
          value: input.scoreLabel === "Time" ? "Fastest time" : "Highest score",
          tone: "yellow",
          tip: input.scoringNote,
        },
      ],
    },
    {
      title: "Play window",
      subtitle: "Times in UTC",
      iconSrc: NEON_ICON("calendar-blue"),
      accent: "sky",
      rows: [
        {
          icon: "opens",
          label: "Opens",
          value: formatUTCShort(input.playWindowStart),
          tip: input.playWindowStartTip,
        },
        {
          icon: "closes",
          label: "Closes",
          value: formatUTCShort(input.playWindowEnd),
          tip: input.playWindowEndTip,
        },
      ],
    },
    {
      title: "If something goes wrong",
      subtitle: "Stalled or abandoned rounds",
      iconSrc: NEON_ICON("shield"),
      accent: "rose",
      rows: [
        {
          icon: "stall",
          label: "If a round stalls",
          value: UNRESOLVED_POLICY_SHORT.get(input.unresolvedPolicy),
          tone: "orange",
          tip: input.unresolvedTip,
        },
        {
          icon: "leave",
          label: "Leaving mid-round",
          value: "Attempt used",
          tone: "red",
          tip: "An attempt is used the moment a round opens, even if you leave before finishing.",
        },
      ],
    },
  ];
}

function iconImg(src: string) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed local icon art
    <img src={src} alt="" draggable={false} className="h-5 w-5 shrink-0 object-contain" />
  );
}

function slugId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function howToPlayCard(how: string) {
  const lines = how
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <RuleCard
      iconSrc={NEON_ICON("swords")}
      accent="sky"
      title="How to play"
      subtitle="Step by step"
    >
      {lines.length > 1 ? (
        <ol className="space-y-2">
          {lines.map((line, i) => (
            <RuleRow
              key={`${i}-${line.slice(0, 24)}`}
              icon={Gamepad2}
              label={`${i + 1}`}
              value={line}
              tone="cyan"
            />
          ))}
        </ol>
      ) : (
        <p className="text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">{how}</p>
      )}
    </RuleCard>
  );
}

export function buildGameLobbySections(input: {
  eventSections: GameEventSection[];
  rulesSummary?: string | null;
  howToPlay?: string | null;
}): NeonAccordionSection[] {
  const sections: NeonAccordionSection[] = [];
  // Reason (owner, 17 Oct 2026): catalogue `howToPlay` used to add a second swords tab
  // ("How to play") beside the event tab ("How you play") — same topic, two menu entries,
  // and a trailing icon with no readable label on a narrow strip. Merge into one tab.
  const how =
    typeof input.howToPlay === "string" ? input.howToPlay.trim() : "";
  let howMerged = false;

  for (const section of input.eventSections) {
    const hasRow = section.rows.some((r) => {
      if (r.value === null || r.value === undefined || r.value === false) return false;
      if (typeof r.value === "string") return r.value.trim().length > 0;
      return true;
    });
    if (!hasRow) continue;
    const isHowYouPlay = section.title === "How you play";
    const mergeHow = isHowYouPlay && how.length > 0;
    if (mergeHow) howMerged = true;
    sections.push({
      id: slugId(section.title) || `event-${sections.length}`,
      icon: iconImg(section.iconSrc),
      title: section.title,
      content: mergeHow ? (
        <div className="flex flex-col gap-4">
          <GameEventDetails sections={[section]} />
          {howToPlayCard(how)}
        </div>
      ) : (
        <GameEventDetails sections={[section]} />
      ),
    });
  }

  const rules = typeof input.rulesSummary === "string" ? input.rulesSummary.trim() : "";
  if (rules) {
    sections.push({
      id: "rules",
      icon: iconImg(NEON_ICON("shield")),
      title: "Rules",
      content: (
        <RuleCard
          iconSrc={NEON_ICON("shield")}
          accent="rose"
          title="Rules summary"
          subtitle="From the game catalogue"
        >
          <p className="text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">{rules}</p>
        </RuleCard>
      ),
    });
  }

  if (how && !howMerged) {
    sections.push({
      id: "how-you-play",
      icon: iconImg(NEON_ICON("swords")),
      title: "How you play",
      content: howToPlayCard(how),
    });
  }

  return sections;
}
