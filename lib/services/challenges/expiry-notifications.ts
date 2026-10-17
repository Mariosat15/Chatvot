/**
 * Telling the creator that a challenge lapsed.
 *
 * Reason: three separate writers mark a pending challenge `expired` — the
 * server action in `challenge-finalize.actions.ts`, its admin mirror, and the
 * Agenda job in `worker/jobs/challenge-finalize.job.ts`. Writing the
 * notification at each of them is the "one rule, three copies" shape this
 * codebase keeps finding defects in, and the drift is invisible here: whether a
 * player is told their challenge lapsed would depend on which process got there
 * first, with no error on either branch.
 */

export interface ExpiredChallengeSummary {
  _id: unknown;
  challengerId: string;
  challengedName?: string | null;
  slug?: string | null;
  entryFee?: number | null;
  openToAnyone?: boolean | null;
}

/**
 * Notify each creator that their pending challenge expired.
 *
 * Fire-and-forget by design: an expiry sweep runs on a cron and must not fail,
 * retry or slow down because a notification could not be written.
 */
export async function notifyChallengesExpired(
  challenges: ExpiredChallengeSummary[],
): Promise<void> {
  if (challenges.length === 0) return;

  try {
    const { notificationService } = await import(
      "@/lib/services/notification.service"
    );

    for (const challenge of challenges) {
      try {
        await notificationService.send({
          userId: challenge.challengerId,
          // Reason: an open challenge gets its own template rather than
          // parameterised wording, because `challenge_expired`'s stored message
          // names an opponent who "did not respond in time" and seeding is
          // `$setOnInsert` — so every existing deployment would keep telling
          // the creator of an open challenge that a named player ignored them.
          templateId:
            challenge.openToAnyone === true
              ? "challenge_open_expired"
              : "challenge_expired",
          variables: {
            challengeId: String(challenge._id),
            challengeSlug: challenge.slug ?? "",
            // Reason: every variable a template can name must be supplied.
            // `replaceVariables` leaves an unknown one in place, so a missing
            // value is rendered to the player as a literal `{{challengedName}}`.
            challengedName: challenge.challengedName ?? "your opponent",
            entryFee: challenge.entryFee ?? 0,
          },
        });
      } catch (error) {
        console.warn(
          `⚠️ Failed to notify expiry of challenge ${String(challenge._id)}:`,
          error,
        );
      }
    }
  } catch (error) {
    console.warn("⚠️ Failed to send challenge expiry notifications:", error);
  }
}
