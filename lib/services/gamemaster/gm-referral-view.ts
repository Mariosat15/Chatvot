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
  /**
   * The player's country. Reason: a country is not a way to contact anybody, so it is shown
   * whatever the consent and the package switch say (owner, 1 Oct 2026). The phone number is
   * contact data and is deliberately NOT a field here.
   */
  country: string | null;
  /**
   * The Game Master may send this player the affiliation terms: an OWN referral, still current,
   * with no recorded acceptance. Decided here so the button and the route ask one question.
   */
  canSendTerms: boolean;
  /**
   * The terms answer (`24` s5.6): `accepted`, `pending` (never answered) or `declined`. A
   * declined LEGACY player stays assigned (owner decision "keep"), so this is not the same
   * fact as `isCurrent`.
   */
  consent: ReferralConsent;
  /** The Game Master's one reminder has been used - the button then reads "Terms sent". */
  termsSent: boolean;
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

export type ReferralConsent = "accepted" | "pending" | "declined";

// Reason: a `Map`, like the admin's `ADMIN_CONSENT_LABELS`, so a lookup cannot walk the
// prototype chain. The admin app keeps its own copy (it cannot import this module); a test
// pins the two to the same entries.
export const REFERRAL_CONSENT_LABELS: ReadonlyMap<ReferralConsent, string> = new Map([
  ["accepted", "Accepted"],
  ["pending", "Pending Terms"],
  ["declined", "Declined"],
]);

/** What `readReferralConsentStates` knows about one assigned referral's terms request. */
export interface ReferralConsentState {
  declined: boolean;
  termsSent: boolean;
}

/**
 * A player who signed up through the Game Master's link and is NOT assigned yet - pending
 * their answer, or declined for good. Name only: they have accepted nothing, so there is no
 * contact field to hide or to leak.
 */
export interface GmAwaitingClaimView {
  claimId: string;
  userId: string;
  userName: string | null;
  referredAt: string | null;
  consent: Exclude<ReferralConsent, "accepted">;
  declinedAt: string | null;
  termsSent: boolean;
  canSendTerms: boolean;
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
  /**
   * The row's terms request, if any. Absent means no request exists: never sent, never
   * declined - which is what every row was before s5.5.
   */
  consentState?: ReferralConsentState;
}

/**
 * Whether "Send T&C" applies to this row. Reason: only an OWN referral - an external player's
 * hidden contact is the package's decision, and terms would not change it - and only a live
 * affiliation without an acceptance, so a Game Master cannot re-prompt a player who agreed or
 * who has already left them.
 */
export function canSendReferralTerms(
  row: Pick<ReferredPlayerRow, "kind" | "isCurrent" | "termsAccepted">,
): boolean {
  return row.kind === "own" && row.isCurrent === true && row.termsAccepted !== true;
}

export function toGameMasterReferralView(
  row: ReferredPlayerRow,
  options: GmReferralViewOptions,
): GmReferralView {
  // Reason: fails closed - a row with no recorded acceptance (every pre-v2 link referral and
  // every admin move) shows no email. An admin decision is not the player's consent. And the
  // consent was to THIS affiliation: once the referral ended or moved to another Game Master,
  // the old one keeps the history row and loses the contact details (s5.6).
  const accepted = row.termsAccepted === true;
  const visible = accepted && row.isCurrent === true;
  // Reason: an external player came to this Game Master through ChartVolt rather than the
  // Game Master's own link, so their package decides whether the name and email are theirs to
  // read. Only `=== true` reveals; own referrals are never masked by this switch.
  const masked = row.kind === "external" && options?.showExternalDetails !== true;
  const declined = !accepted && options?.consentState?.declined === true;
  const termsSent = options?.consentState?.termsSent === true;
  return {
    referralId: row.referralId,
    userId: row.userId,
    userName: masked ? maskLastName(row.userName) : row.userName,
    userEmail: !visible ? null : masked ? MASKED_CONTACT : row.userEmail,
    contactHidden: !visible,
    contactMasked: visible && masked,
    termsAccepted: accepted,
    country: row.country ?? null,
    // Reason: once per referral (s5.6) and never after a decline - the same rule
    // `decideTermsRequestSend` enforces, so the button is never offered for a refusal.
    canSendTerms: canSendReferralTerms(row) && !termsSent && !declined,
    consent: accepted ? "accepted" : declined ? "declined" : "pending",
    termsSent,
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
  "Contact details hidden - this player has not accepted the Game Master affiliation terms, or is no longer assigned to you.";

/** Shown wherever an external referral's details are masked by the package. */
export const CONTACT_MASKED_NOTE =
  "External referral - your package shows only the client id, first name and a masked email.";
