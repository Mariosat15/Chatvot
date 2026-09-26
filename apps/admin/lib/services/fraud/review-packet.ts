/**
 * Review-packet normalisation, shared by the investigation routes.
 *
 * `reviewEtaDays` and `documentsRequested` are written onto `UserRestriction`
 * and rendered to the player on `/account/review`, so both need clamping and
 * trimming before they are stored. The suspend and ban routes each carried their
 * own copy of this logic with the same comment above it; the investigation-open
 * route added on 2 September 2026 would have made a third.
 *
 * Reason: extracted rather than copied a third time. These two fields are
 * user-visible, so a route that clamps differently shows a different review ETA
 * for the same admin input - a difference nobody would think to test for.
 */

export interface ReviewPacket {
  reviewEtaDays: number | undefined;
  documentsRequested: string[] | undefined;
}

/** Maximum days an admin can promise for a review turnaround. */
const MAX_ETA_DAYS = 90;

/** Maximum number of document requests stored per restriction. */
const MAX_DOCUMENTS = 20;

/**
 * Clamp and trim the review-packet inputs from an admin request body.
 *
 * Accepts the raw values straight off `request.json()` - number, numeric
 * string, empty string, or absent - and returns either a usable value or
 * `undefined`. Never throws.
 */
export function normalizeReviewPacket(
  rawReviewEtaDays: unknown,
  rawDocumentsRequested: unknown,
): ReviewPacket {
  const parsed =
    typeof rawReviewEtaDays === "number"
      ? rawReviewEtaDays
      : typeof rawReviewEtaDays === "string" && rawReviewEtaDays.trim() !== ""
        ? Number(rawReviewEtaDays)
        : undefined;

  const reviewEtaDays =
    typeof parsed === "number" && Number.isFinite(parsed)
      ? Math.max(0, Math.min(MAX_ETA_DAYS, Math.floor(parsed)))
      : undefined;

  const documents = Array.isArray(rawDocumentsRequested)
    ? rawDocumentsRequested
        .map((d: unknown) => (typeof d === "string" ? d.trim() : ""))
        .filter((d: string) => d.length > 0)
        .slice(0, MAX_DOCUMENTS)
    : undefined;

  return {
    reviewEtaDays,
    // Reason: collapse an empty array to undefined so the field is omitted
    // rather than stored as [], which would render an empty "documents needed"
    // section on the player's review page.
    documentsRequested:
      documents && documents.length > 0 ? documents : undefined,
  };
}
