/**
 * MAY WE EMAIL THIS ADDRESS?
 *
 * The senders in `lib/nodemailer` are handed an email address and a name - never a user
 * id - because they are composed from an invoice, a withdrawal or a payment webhook. So
 * the switch a player set on their own profile has to be found from the address.
 *
 * WHY THIS IS ENFORCED AT THE SENDER AND NOT AT THE CALL SITES. The four money emails are
 * sent from eleven places across both apps, and three of them send the same email twice
 * by two different routes. Gating each caller means forgetting one, and a forgotten one is
 * silent - the player keeps receiving mail they switched off and has no way to report
 * which of eleven paths did it. One check inside each sender cannot be skipped.
 *
 * Account access and security email does not pass through here at all. See the
 * `transactionalEmailsEnabled` note on the preferences model for why that is deliberate.
 */
import { connectToDatabase } from "@/database/mongoose";
import UserNotificationPreferences, {
  EmailGroup,
} from "@/database/models/user-notification-preferences.model";

/**
 * The id the preferences document is keyed by, found from an email address.
 *
 * Reason: Better Auth's MongoDB adapter keeps the identity in `_id` and only sometimes
 * carries a duplicate `id` field, so a lookup that reads one of the two returns an id
 * that matches no preferences document while reporting success. That exact mistake made
 * every avatar on the contest leaderboard invisible for a day (R68), so both are read and
 * the declared one wins - it is what a session hands to every other caller.
 */
async function resolveUserIdByEmail(email: string): Promise<string | null> {
  const mongoose = await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) return null;

  const user = await db
    .collection("user")
    .findOne(
      { email: email.toLowerCase().trim() },
      { projection: { id: 1, _id: 1 } },
    );
  if (!user) return null;

  return user.id ? String(user.id) : user._id ? String(user._id) : null;
}

/**
 * True when this address may be sent an email of this kind.
 *
 * FAILS OPEN, in every direction: an unknown address, an absent preferences document, a
 * database error. A receipt that silently never arrives because a preference read timed
 * out is worse than one extra email - it is a missing financial record, and nobody can
 * report the absence of something they were never told about. An explicit stored `false`
 * is the only thing that stops a send.
 */
export async function mayEmailAddress(
  email: string | undefined | null,
  group: EmailGroup,
): Promise<boolean> {
  if (group === "account") return true;
  if (!email) return true;

  try {
    const userId = await resolveUserIdByEmail(email);
    // An address with no account behind it is an operator test send or a guest checkout.
    if (!userId) return true;

    return await UserNotificationPreferences.mayReceiveEmailGroup(
      userId,
      group,
    );
  } catch (error) {
    console.warn(
      `⚠️ Could not read email preferences for ${email}, sending anyway:`,
      error,
    );
    return true;
  }
}
