import { BookOpen, Target } from "lucide-react";
import { NeonPanel } from "@/components/neon/Cards";
import type { GamePresentation } from "@/lib/services/games/game-presentation.service";

/**
 * The operator's rules for a game title, on the two screens a player reads before and while
 * they play.
 *
 * WHY IT EXISTS. `provider_game.rulesSummary` and `howToPlay` are contractual - `01` section
 * 3.1 requires both of every provider - and R63 made the catalogue sync actually store them
 * on 10 September 2026, after a parse bug had been discarding them. They were then read by
 * nothing: `getGamePresentation` did not select either field, so a paying player could see
 * the pot, the entry fee, the clock and the leaderboard and never be told what a winning
 * score was. The owner reported it the next day.
 *
 * ONE DEFINITION, TWO SCREENS, and the negative half of the guard is the load-bearing one: a
 * test asserts this file's headings appear in NO consumer, because a screen that imports the
 * panel and then hand-rolls a rules block beside it satisfies any check that the import
 * exists. Same rule as `components/neon/` and `components/competitions/PrizeTable.tsx`.
 *
 * THE SCORING RULE IS GIVEN THE PROMINENCE, NOT THE CONTROLS, and that is a deliberate
 * ordering rather than a layout preference. How to draw a path is discoverable by trying;
 * whether an unfinished board scores nothing, or whether the LOWEST total wins, is not - and
 * on a lower-is-better title a player who assumes the usual direction plays to lose while
 * every screen looks correct. It is also the sentence that decides a prize, which is why the
 * content assistant is barred from writing it (`AI_NEVER_WRITABLE_CONTENT_FIELDS`).
 *
 * NOT `"use client"`. It renders text and no interactivity, so it stays a server component -
 * which keeps it out of the browser bundle and away from R58's model-import hazard entirely.
 *
 * NOT MIRRORED. `apps/admin` has no player screen; the operator edits this content through
 * `GameContentDialog.tsx`, which is a different surface with a different job.
 */

interface Props {
  /**
   * Read straight off the presentation rather than as two loose strings, so a caller cannot
   * pass the description where the rules belong. Both fields are optional on that shape and
   * must stay so - a title synced before they existed carries neither.
   */
  presentation: Pick<GamePresentation, "rulesSummary" | "howToPlay" | "gameName">;
  /**
   * Widen the copy on a full-width slot. The arena renders this beneath the board where there
   * is room for two columns; the lobby sidebar has one.
   */
  layout?: "column" | "wide";
}

/**
 * Paragraphs from free text.
 *
 * Reason: both fields are 2,000-character operator-editable textareas, so an operator who
 * presses Return expects a break. Rendered as one block, their paragraphs run together into a
 * wall - and the provider's own `howToPlay` arrives as four joined sentences, which is
 * legitimately one paragraph. Splitting on blank-or-single newlines serves both without the
 * panel having to know which kind of text it was handed.
 *
 * `white-space: pre-wrap` was the alternative and is worse: it preserves the incidental
 * wrapping of whatever the operator's textarea was doing at the width they typed it.
 */
function paragraphs(text: string): string[] {
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export default function GameRulesPanel({ presentation, layout = "column" }: Props) {
  const scoring = presentation.rulesSummary?.trim();
  const playing = presentation.howToPlay?.trim();

  /*
   * Both absent renders NOTHING, never an empty panel with a heading.
   *
   * This is the rule `GamePresentation`'s own header states: a screen printing an empty slot
   * where copy would go tells a player the game has no rules, which is worse than a screen
   * that says less. It is also the live state of every title synced before R63 and of every
   * provider registered but not yet re-synced, so it is the common case rather than an edge.
   */
  if (!scoring && !playing) return null;

  return (
    <NeonPanel
      icon={BookOpen}
      accent="players"
      title={`How ${presentation.gameName} is scored`}
    >
      <div
        className={
          layout === "wide"
            ? "grid gap-5 md:grid-cols-2"
            : "space-y-5"
        }
      >
        {scoring && (
          /*
           * THE STANDOUT BLOCK. An amber rule and a tinted ground, because the owner's report
           * was that the rules are invisible and a paragraph of grey body text among six other
           * panels is invisible in the way that matters. The larger type is on this block only;
           * giving both the same weight is how a page ends up with no emphasis at all.
           */
          <div className="rounded-lg border-l-2 border-amber-400/70 bg-amber-400/[0.07] p-4">
            <div className="mb-2 flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-300" />
              <h3 className="text-sm font-semibold text-amber-200">
                How you win
              </h3>
            </div>
            {paragraphs(scoring).map((line, index) => (
              <p
                key={index}
                className="text-sm leading-relaxed text-amber-50/90 [&+p]:mt-2"
              >
                {line}
              </p>
            ))}
          </div>
        )}

        {playing && <HowToPlay text={playing} />}
      </div>
    </NeonPanel>
  );
}

/**
 * The operator's instructions, numbered when they wrote them as steps.
 *
 * THE STEPS ARE THE OPERATOR'S PARAGRAPH BREAKS AND NOTHING ELSE. The reference draws a
 * numbered list, and the tempting way to produce one is to split on sentences - which would
 * invent a step boundary in the middle of the operator's meaning and number four clauses of
 * one instruction as four things to do. If they pressed Return, they meant a step; if they
 * did not, this renders the prose they wrote.
 *
 * SO THE COMMON CASE TODAY IS PROSE, and that is worth saying plainly rather than presenting
 * the numbered form as the normal one: `circuit-sprint`'s `howToPlay` is a single paragraph,
 * so it will render as a paragraph until somebody edits it in the content dialog. The list
 * appears the moment an operator writes one, with no code change - which is the point.
 */
function HowToPlay({ text }: { text: string }) {
  const steps = paragraphs(text);

  return (
    <div>
      <h3 className="mb-2.5 text-sm font-semibold text-gray-200">How to play</h3>

      {steps.length < 2 ? (
        <p className="text-sm leading-relaxed text-gray-400">{steps[0]}</p>
      ) : (
        <ol className="space-y-2.5">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-2.5">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-400/10 text-[11px] font-bold text-cyan-300"
                aria-hidden
              >
                {index + 1}
              </span>
              <span className="text-sm leading-relaxed text-gray-400">
                {step}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
