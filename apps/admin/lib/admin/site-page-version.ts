/**
 * Versioning for action-terms pages (`24` s5.2). Admin only, pure, no models.
 *
 * Reason: consent is proven against a version, so the version must move whenever the words a
 * player agreed to move. Leaving that to the operator means one forgotten field keeps every
 * old acceptance valid against new wording, with nothing failing. So the server bumps it on
 * any content change and never takes a version from the request body.
 */

export interface TermsContent {
  title?: unknown;
  subtitle?: unknown;
  sections?: unknown;
}

interface NormalisedSection {
  id: string;
  type: string;
  title: string;
  content: string;
  order: number;
}

const text = (v: unknown): string => (typeof v === "string" ? v : "");

function normaliseSections(sections: unknown): NormalisedSection[] {
  if (!Array.isArray(sections)) return [];
  return sections.map((raw) => {
    const s = (raw ?? {}) as Record<string, unknown>;
    return {
      id: text(s.id),
      type: text(s.type),
      title: text(s.title),
      content: text(s.content),
      order: typeof s.order === "number" ? s.order : 0,
    };
  });
}

/**
 * True when the wording a player reads differs. Only title, subtitle and section content
 * count - toggling `isActive` or `showEveryTime` changes no words and must not invalidate
 * anyone's consent.
 */
export function hasTermsContentChanged(before: TermsContent, after: TermsContent): boolean {
  if (text(before.title) !== text(after.title)) return true;
  if (text(before.subtitle) !== text(after.subtitle)) return true;
  return (
    JSON.stringify(normaliseSections(before.sections)) !==
    JSON.stringify(normaliseSections(after.sections))
  );
}

/**
 * The version after a content change: an integer string goes up by one, an absent version
 * becomes "1", and any other operator-written version gets ".1" appended so it still moves.
 */
export function nextTermsVersion(current: unknown): string {
  const value = typeof current === "string" ? current.trim() : "";
  if (value === "") return "1";
  if (/^\d+$/.test(value)) return String(Number(value) + 1);
  return `${value}.1`;
}
