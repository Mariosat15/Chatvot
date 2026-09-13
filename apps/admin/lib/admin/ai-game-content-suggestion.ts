/**
 * Turning what the model said into something the content form can offer.
 *
 * THE SHAPE IS THE GUARANTEE, NOT A CHECK ANYWHERE ELSE. This builds an object with exactly
 * the four keys the assistant is allowed to write, field by field, from a payload it treats
 * as arbitrary. A model that returns `rulesSummary` - and it will, because the game's page
 * plainly wants one - produces a suggestion that does not carry it, with nothing to remember
 * and nothing to forget. Same reasoning as the play frame's message type having no score
 * field at all: removing a field is stronger than remembering not to read it.
 *
 * The model's reply is UNTRUSTED INPUT even though we sent the prompt. It is not an attacker
 * here, it is something worse for a guard's purposes - a source that is usually right, so a
 * check that only fires on the unusual case is a check nobody exercises.
 *
 * MODEL-FREE, so the panel and the route read one copy of the limits, and so the whole of
 * this can be driven by a test without a database, a session or a network call.
 *
 * NOT MIRRORED. `apps/admin/lib/admin/` is admin-only.
 */

// Reason: RELATIVE, not `@/lib/admin/...`. Vitest aliases `@` to the repository ROOT rather
// than the admin root, so the aliased form resolves under `next build` and fails in the suite
// with "Cannot find module" - `apps/admin/lib/admin/` is admin-only and has no counterpart at
// the root. The neighbouring modules get away with `@/lib/services/...` only because those
// files are mirrored and a root copy happens to exist. See R58.
import {
  AI_WRITABLE_CONTENT_FIELDS,
  CONTENT_LIMITS,
  type GameHighlight,
} from "./game-content-fields";

export interface GameContentSuggestion {
  displayName: string;
  tagline: string;
  description: string;
  highlights: GameHighlight[];
}

/**
 * How many highlights to offer.
 *
 * The prompt asks for three and the form accepts up to `CONTENT_LIMITS.highlights`. The cap
 * is read from the form's limit rather than from the prompt's number, because the prompt is a
 * request and the limit is a rule - a model returning eight would otherwise produce a
 * suggestion the operator can accept and then cannot save.
 */
const MAX_SUGGESTED_HIGHLIGHTS = CONTENT_LIMITS.highlights;

function text(value: unknown, limit: number): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  // Reason: truncated rather than dropped. This is a suggestion the operator reads and edits
  // before it is ever saved, so a slightly clipped tagline is a starting point; dropping it
  // leaves an empty row with no explanation of why that one field produced nothing.
  return trimmed.length > limit ? trimmed.slice(0, limit).trim() : trimmed;
}

/**
 * A highlight is offered only if BOTH halves survive, and short of the limit rather than cut.
 *
 * The card renders both, so a half-filled one reads as a bug on the player's screen rather
 * than as the operator leaving something out - which is the same rule the dialog already
 * enforces on hand-typed highlights. A detail clipped mid-sentence would pass that rule and
 * still look broken, so these are dropped rather than truncated. That is the opposite choice
 * to the three fields above it, and the difference is that those are one editable box the
 * operator is looking at, while a highlight is one of several small cards they are likely to
 * accept as a set.
 */
function highlights(value: unknown): GameHighlight[] {
  if (!Array.isArray(value)) return [];
  const rows: GameHighlight[] = [];
  for (const entry of value) {
    if (rows.length >= MAX_SUGGESTED_HIGHLIGHTS) break;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const detail = typeof row.detail === "string" ? row.detail.trim() : "";
    if (!title || !detail) continue;
    if (title.length > CONTENT_LIMITS.highlightTitle) continue;
    if (detail.length > CONTENT_LIMITS.highlightDetail) continue;
    rows.push({ title, detail });
  }
  return rows;
}

/**
 * Read the model's reply.
 *
 * The JSON is located with a brace match rather than by parsing the whole response, because
 * models prepend an explanatory sentence often enough that refusing on it would make the
 * feature unreliable for no gain. An unparseable reply yields an EMPTY suggestion rather than
 * a throw: the panel then says it produced nothing, which is the honest thing to show and is
 * one press away from trying again.
 */
export function parseGameContentSuggestion(raw: string): GameContentSuggestion {
  const empty: GameContentSuggestion = {
    displayName: "",
    tagline: "",
    description: "",
    highlights: [],
  };

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return empty;

  let payload: unknown;
  try {
    payload = JSON.parse(match[0]);
  } catch {
    return empty;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return empty;

  const body = payload as Record<string, unknown>;

  return {
    displayName: text(body.displayName, CONTENT_LIMITS.displayName),
    tagline: text(body.tagline, CONTENT_LIMITS.tagline),
    description: text(body.description, CONTENT_LIMITS.description),
    highlights: highlights(body.highlights),
  };
}

/** Did the model produce anything worth offering? Used by the route and by the panel. */
export function suggestionIsEmpty(suggestion: GameContentSuggestion): boolean {
  return (
    suggestion.displayName === "" &&
    suggestion.tagline === "" &&
    suggestion.description === "" &&
    suggestion.highlights.length === 0
  );
}

/**
 * The keys a suggestion carries, derived from the policy rather than written again here.
 *
 * // Reason: this exists so the panel can iterate the text fields without naming them, and so
 * a test can assert the built object against the policy instead of against a literal list.
 * Naming the fields in a third place is how one of them ends up offered on a screen after
 * being barred in the policy - the field-by-field shape above is what makes that impossible
 * for the barred ones, and this keeps the two lists honest for the permitted ones.
 */
export const SUGGESTION_TEXT_FIELDS = AI_WRITABLE_CONTENT_FIELDS.filter(
  (field): field is "displayName" | "tagline" | "description" => field !== "highlights",
);
