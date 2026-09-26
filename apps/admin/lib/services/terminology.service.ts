import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import {
  TERMS,
  isTerminologyToken,
  resolveTerms,
  type TerminologyOverrides,
  type TerminologyPack,
} from "@/lib/constants/terminology";

/**
 * The server-side accessor for the display vocabulary (X6.5, chapter 14 section 2).
 *
 * `lib/constants/terminology.ts` holds the catalogue and the pure resolution rule and is
 * deliberately model-free, so it can be imported by a `"use client"` component (R58). This
 * module is the half that touches the database, which is why it is separate rather than a
 * function on the constants file - a client component importing the catalogue must not drag
 * Mongoose and the MongoDB driver into the browser bundle.
 *
 * IT FAILS TO THE DEFAULTS, and that direction is the point. A settings read that times out
 * must not take an admin screen down, and the worst outcome of falling back is that a
 * deployment which renamed "Competition" to "Tournament" briefly reads "Competition" -
 * a word that was correct until somebody asked for a different one. Compare the credit-value
 * resolver (R74), where the fallback had to be chosen carefully because a wrong fallback
 * overstated money by a hundredfold; here there is no arithmetic to get wrong.
 */

/**
 * Resolve the platform's vocabulary.
 *
 * One query, projected to the one field, and `.lean()` because nothing here needs a hydrated
 * document. Note the projection is load-bearing rather than tidiness: `WhiteLabel` is a
 * single fat settings document, so an unprojected `findOne()` on a path that runs on every
 * screen transfers every branding URL and every price-feed setting with it.
 */
export async function getTerms(): Promise<TerminologyPack> {
  try {
    await connectToDatabase();
    const settings = await WhiteLabel.findOne()
      .select("terminologyOverrides")
      .lean<{ terminologyOverrides?: TerminologyOverrides }>();

    return resolveTerms(settings?.terminologyOverrides);
  } catch (error) {
    console.warn(
      "⚠️ Could not read terminologyOverrides, falling back to default wording:",
      error,
    );
    return resolveTerms(null);
  }
}

/**
 * The STORED overrides, unresolved, for the settings screen only.
 *
 * Deliberately separate from `getTerms()` rather than a flag on it, because the two answer
 * different questions and the difference is the whole of the settings form: every screen in
 * the app wants the resolved word, and the form wants to know which words an operator has
 * actually chosen - so that an untouched box shows the default as a PLACEHOLDER rather than
 * as its value. Handed the resolved pack, the form would save all twenty-three defaults as
 * explicit overrides the first time anybody pressed Save, and the platform would then be
 * unable to change a default word for anybody who had ever opened the screen.
 *
 * This one throws rather than falling back, the opposite direction from `getTerms()`: a form
 * that cannot read what is stored must say so, because the alternative is showing an empty
 * box over a stored value and then overwriting it with the emptiness.
 */
export async function getStoredTerminologyOverrides(): Promise<TerminologyOverrides> {
  await connectToDatabase();
  const settings = await WhiteLabel.findOne()
    .select("terminologyOverrides")
    .lean<{ terminologyOverrides?: TerminologyOverrides }>();

  return settings?.terminologyOverrides ?? {};
}

/**
 * The single writer of the display vocabulary.
 *
 * TWO THINGS HERE ARE LOAD-BEARING.
 *
 * It writes DOTTED PATHS for only the tokens the payload carried, never the whole subdocument.
 * Assigning `terminologyOverrides` wholesale would silently clear every token the form did not
 * send, which is exactly what a future partial form - one tab per token group, say - would do
 * on its first save, and the loss reads as the save having worked.
 *
 * A cleared token is `$unset`, never stored as `""`. A stored empty string is a value that has
 * to be reinterpreted as "absent" on every read, and a reinterpreted value is indistinguishable
 * from an operator who meant it - the same reasoning as `playModeOverride` being cleared with
 * `$unset`, and the reason `resolveTerms` treating a blank as absent is a second line of
 * defence rather than the mechanism.
 *
 * `findOneAndUpdate` with an upsert rather than the `findOne()`-then-`save()` pattern the older
 * settings routes use, because `WhiteLabel` is one fat singleton: reading it whole in order to
 * change one word transfers every branding URL with it (R56), and two operators saving at once
 * would have the second write back the first's stale copy of everything else.
 */
export async function saveTerminologyOverrides(
  overrides: TerminologyOverrides,
): Promise<void> {
  await connectToDatabase();

  // Reason: accumulated in Maps rather than plain objects. The token has already been
  // narrowed by `isTerminologyToken`, so it is safe either way, but a `Map` has no prototype
  // chain at all and so cannot be the next place a caller-supplied key means something.
  const set = new Map<string, string>();
  const unset = new Map<string, "">();

  for (const [token, value] of Object.entries(overrides)) {
    if (!isTerminologyToken(token)) continue;
    const path = `terminologyOverrides.${token}`;
    if (typeof value === "string" && value.trim() !== "") {
      set.set(path, value.trim());
    } else {
      unset.set(path, "");
    }
  }

  const update: Record<string, unknown> = {};
  if (set.size > 0) update.$set = Object.fromEntries(set);
  if (unset.size > 0) update.$unset = Object.fromEntries(unset);
  if (Object.keys(update).length === 0) return;

  await WhiteLabel.findOneAndUpdate({}, update, { upsert: true, new: false });
}

/**
 * Validate and narrow an override payload arriving from the admin settings form.
 *
 * TWO REFUSALS AND ONE SILENT DROP, and which is which is the whole design:
 *
 *   - An UNKNOWN TOKEN is refused with the key named, never dropped. Dropping means the
 *     save appears to succeed while doing nothing, and the operator concludes they
 *     misclicked - the failure mode this codebase keeps finding. Same reading as the
 *     contest-edit field allow-list.
 *   - A NON-STRING value is refused, because it can only arrive from a caller that is not
 *     the form.
 *   - A BLANK value is accepted and recorded as a CLEAR (`undefined`), because that is how
 *     an operator un-renames a token: they empty the box. So blank is a deliberate
 *     instruction here, where on the READ side `resolveTerms` treats a stored blank as
 *     absent - the two are consistent, since clearing writes nothing and reading nothing
 *     yields the default.
 *
 * The lookup goes through `isTerminologyToken`, which is `Set`-backed: `key in TERMS` and
 * `TERMS[key]` both walk the prototype chain, so `"constructor"` would be admitted and
 * `"__proto__"` returns a truthy `Object.prototype` that survives a `!value` test before
 * failing somewhere unrelated.
 */
export type TerminologyUpdate =
  | { ok: true; overrides: TerminologyOverrides }
  | { ok: false; error: string };

export function validateTerminologyOverrides(input: unknown): TerminologyUpdate {
  if (input === null || input === undefined) {
    return { ok: true, overrides: {} };
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Terminology overrides must be an object." };
  }

  const overrides: TerminologyOverrides = {};

  for (const [key, value] of Object.entries(input)) {
    if (!isTerminologyToken(key)) {
      return {
        ok: false,
        error: `"${key}" is not a terminology token. Known tokens: ${Object.keys(TERMS).join(", ")}.`,
      };
    }

    if (value === null || value === undefined || value === "") {
      // Reason: an emptied field is the operator asking to go back to the default word.
      // Recorded as an explicit `undefined` so the caller can `$unset` it rather than
      // storing "" - a stored empty string is a value that has to be reinterpreted on
      // every read, and reinterpreted values are indistinguishable from intent.
      // Reason: `key` is narrowed to a declared token by the Set-backed guard above.
      // eslint-disable-next-line security/detect-object-injection
      overrides[key] = undefined;
      continue;
    }

    if (typeof value !== "string") {
      return {
        ok: false,
        error: `Terminology token "${key}" must be a word, not a ${typeof value}.`,
      };
    }

    const trimmed = value.trim();
    // eslint-disable-next-line security/detect-object-injection -- same narrowing as above.
    overrides[key] = trimmed === "" ? undefined : trimmed;
  }

  return { ok: true, overrides };
}
