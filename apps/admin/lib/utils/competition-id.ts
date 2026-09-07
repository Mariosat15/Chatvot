/**
 * Is this string shaped like a competition id at all?
 *
 * WHY IT IS SPELLED OUT RATHER THAN DELEGATED TO `mongoose.Types.ObjectId.isValid`, and the first
 * draft of this comment had it wrong in an instructive way. It claimed `isValid` accepts any
 * 12-character string, so `isValid("competitions")` was true and would be cast to an arbitrary
 * ObjectId matching nothing. **That was true of bson v4 and is false here** - bson 5 removed
 * 12-length string support (NODE-4770) and this repository runs Mongoose 8, where `isValid` and
 * the test below agree on every string. The reason to keep the explicit shape is what the
 * correction exposes rather than what it removes: **the acceptable shape of a URL segment is our
 * decision, and `isValid` is a dependency's** - it has already moved once, in the direction of
 * accepting more, and a widening arriving through a version bump would silently widen what these
 * routes read from the URL. A test asserts the two agree today, so a future change is a red test
 * instead of a wider parser. Every id this application produces is a stringified ObjectId, which
 * is always 24 hex characters.
 *
 * The second reason is duller and just as real: **one spelling, shared by two apps and six
 * routes.** A shape rule written six times is the "one rule, several copies" shape behind several
 * defects here, and this one would fail in the worst way available - one app 404s a URL the other
 * renders, which reads as a caching problem rather than as two different rules.
 *
 * WHAT IT DELIBERATELY DOES NOT DO IS LOG. A malformed id arrives from the URL bar, a crawler or
 * a stale link, so the interesting fact is *which route* received it - see
 * `logMalformedCompetitionId`, which the route calls once and then answers 404.
 */
const COMPETITION_ID_SHAPE = /^[0-9a-f]{24}$/i;

export function isCompetitionIdShaped(id: string | null | undefined): boolean {
  return typeof id === "string" && COMPETITION_ID_SHAPE.test(id);
}

/**
 * The one line a route writes when it refuses a malformed id.
 *
 * Reason it logs at all rather than refusing silently: a bad id in the logs is the only evidence
 * that some link inside the application is building a URL out of an `undefined` or a slug. Losing
 * that evidence would make an in-app defect indistinguishable from a crawler probing the site,
 * which is why the value and the route are both named. One `warn` line, no stack trace - this is
 * a badly-formed request, not a fault.
 */
export function logMalformedCompetitionId(route: string, id: unknown): void {
  console.warn(
    `⚠️ ${route}: ${JSON.stringify(id)} is not a competition id — responding 404`,
  );
}
