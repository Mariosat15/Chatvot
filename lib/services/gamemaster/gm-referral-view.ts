/**
 * What a Game Master may see about a player they referred (`External game plans/24` s1 D6,
 * task 5 of the v2 programme). Pure and model-free, so the Game Master's own screens can
 * import the type and the labels without pulling the database driver into the browser (R58).
 *
 * ONE mapper for both Game Master routes (`/api/gamemaster/referrals` and the dashboard), so
 * the two cannot disagree about whether a player's email is visible.
 *
 * Reason: the fields are listed, never spread. The old routes spread the raw referral row and
 * so handed every Game Master each player's email, sign-up IP and browser string whether or
 * not the player had agreed to anything. A spread is how the next field leaks.
 */

import type { ReferredPlayerRow } from "./referral-read-model";
import type { ReferralKind } from "./referral-kind";
import type { AffiliationSurface } from "../../../database/models/user-referral.model";

export interface GmReferralView {
  referralId: string;
  userId: string;
  userName: string | null;
  /** Only when the player accepted the affiliation terms (D6); otherwise null. */
  userEmail: string | null;
  /** True when contact details exist but are withheld because the terms were never accepted. */
  contactHidden: boolean;
  /**
   * True when the email was consented to but the Game Master's package does not show an
   * external referral's details - `userEmail` is then `MASKED_CONTACT` and the last name too.
   */
  contactMasked: boolean;
  termsAccepted: boolean;
  kind: ReferralKind;
  surface: AffiliationSurface | null;
  joinedAt: string | null;
  endedAt: string | null;
  /** The affiliation itself is live. */
  isCurrent: boolean;
  /** Current and a contest seat within the active window. */
  isActive: boolean;
  lastActivityAt: string | null;
  competitionsEntered: number;
  challengesEntered: number;
  entryFees: number;
  earned: number;
  paid: number;
  pending: number;
}

/** What replaces a withheld email or last name for an external referral. */
export const MASKED_CONTACT = "**********";

/**
 * "Jane Smith" -> "Jane **********". Only the first word survives; a one-word name has no
 * last name to hide and is kept. Reason a name containing `@` is masked whole: some accounts
 * carry their email as their display name, and keeping its "first word" would be the email.
 */
export function maskLastName(name: string | null): string | null {
  if (typeof name !== "string") return name;
  const trimmed = name.trim();
  if (!trimmed) return name;
  if (trimmed.includes("@")) return MASKED_CONTACT;
  const [first, ...rest] = trimmed.split(/\s+/);
  return rest.length > 0 ? `${first} ${MASKED_CONTACT}` : first;
}

export interface GmReferralViewOptions {
  /**
   * The Game Master's package switch, resolved by `resolveShowExternalReferralDetails` from
   * the SESSION user's package - never from the request. Required, not optional: `.map(fn)`
   * would otherwise pass the array index here, and a forgotten argument must not compile.
   */
  showExternalDetails: boolean;
}

export function toGameMasterReferralView(
  row: ReferredPlayerRow,
  options: GmReferralViewOptions,
): GmReferralView {
  // Reason: fails closed - a row with no recorded acceptance (every pre-v2 link referral and
  // every admin move) shows no email. An admin decision is not the player's consent.
  const visible = row.termsAccepted === true;
  // Reason: an external player came to this Game Master through ChartVolt rather than the
  // Game Master's own link, so their package decides whether the name and email are theirs to
  // read. Only `=== true` reveals; own referrals are never masked by this switch.
  const masked = row.kind === "external" && options?.showExternalDetails !== true;
  return {
    referralId: row.referralId,
    userId: row.userId,
    userName: masked ? maskLastName(row.userName) : row.userName,
    userEmail: !visible ? null : masked ? MASKED_CONTACT : row.userEmail,
    contactHidden: !visible,
    contactMasked: visible && masked,
    termsAccepted: visible,
    kind: row.kind,
    surface: row.surface,
    joinedAt: row.joinedAt,
    endedAt: row.endedAt,
    isCurrent: row.isCurrent,
    isActive: row.isActive,
    lastActivityAt: row.lastActivityAt,
    competitionsEntered: row.competitionsEntered,
    challengesEntered: row.challengesEntered,
    entryFees: row.entryFees,
    earned: row.earned,
    paid: row.paid,
    pending: row.pending,
  };
}

/** Shown wherever an email is withheld, so a hidden email never reads as a missing one. */
export const CONTACT_HIDDEN_NOTE =
  "Contact details hidden - this player has not accepted the Game Master affiliation terms.";

/** Shown wherever an external referral's details are masked by the package. */
export const CONTACT_MASKED_NOTE =
  "External referral - your package shows only the client id, first name and a masked email.";
