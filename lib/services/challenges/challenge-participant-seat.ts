import { TRADING_GAME_TYPE } from "@/lib/games";

/**
 * Builds a `ChallengeParticipant` row for one side of an accepted challenge.
 *
 * EXTRACTED FROM THE INLINE OBJECT IT USED TO BE, written twice inside the accept route's
 * single `create` call, for the reason `lib/services/contest-entry/participant-seat.ts` was:
 * a test can compare a named function's output keys against `Model.schema.paths`, and no
 * assertion on a saved document can, because strict mode has already discarded the evidence
 * by then. That is exactly how the simulator's batch route was found to be silently dropping
 * six participant fields.
 *
 * NO `score` KEY, AND THAT IS THE POINT OF THE FILE. The schema carried
 * `required: true, default: 0` until 12 September 2026, so Mongoose stamped a finite score
 * onto both players the instant a challenge was accepted. `providerHasResult` reads a stored
 * nought as "played and scored nothing", so a provider challenge would have settled with both
 * sides apparently scoring, tied at the top, splitting the pot. The default is gone; a seat
 * that names the field again puts it straight back, which is why the omission is asserted
 * rather than merely commented.
 *
 * `gameKey` IS COPIED FROM THE CHALLENGE, NEVER LEFT TO THE DEFAULT, for the same reason as
 * on a competition seat: the participant schema defaults it to `"trading"`, so a defaulted
 * label is a WRONG label on any other game. Nothing crashes and the row saves - and because
 * `gameKey` is immutable, an aggregate that groups by it files the player under the wrong
 * game for ever. That is R7's harm, one model along.
 *
 * THE CAPITAL FIELDS ARE NOW CONDITIONAL, mirroring `buildParticipantSeat`'s competition-side
 * equivalent. This paragraph used to say they were "still unconditional, deliberately" -
 * that was true only until this step, which is the "step that actually seats a provider
 * challenge" the old wording named and deferred to. The old sentence is corrected in place
 * rather than deleted, because it explained the sequencing this step completes: the model
 * (`startingCapital`, `currentCapital`, `availableCapital` on `ChallengeParticipant`) went
 * conditional on `gameKey` first, and a provider participant is now seated with none of the
 * three, exactly as `CompetitionParticipant`'s builder omits them for a provider entry.
 */

export interface ChallengeParticipantSeatInput {
  challengeId: string;
  userId: string;
  username: string;
  email: string;
  role: "challenger" | "challenged";
  gameKey?: string | null;
  /** Absent for a provider participant - the model requires it only when `gameKey` is trading. */
  startingCapital?: number | null;
  joinedAt: Date;
}

export function buildChallengeParticipantSeat(
  input: ChallengeParticipantSeatInput,
): Record<string, unknown> {
  const gameKey = input.gameKey || TRADING_GAME_TYPE;
  const isTrading = gameKey === TRADING_GAME_TYPE;

  const seat: Record<string, unknown> = {
    challengeId: input.challengeId,
    userId: input.userId,
    username: input.username,
    email: input.email,
    role: input.role,

    // Never defaulted. See the header - a defaulted label is a wrong label.
    gameKey,

    // NO `score`. See the header, and the schema path that used to default it.

    joinedAt: input.joinedAt,
  };

  // Trading only, from here down - the three capital fields have no meaning for a game
  // where the provider reports a single score. Omitted entirely rather than written as
  // `undefined`, matching CompetitionParticipant's own seat builder.
  if (!isTrading) return seat;

  const capital = input.startingCapital ?? 0;

  return {
    ...seat,
    startingCapital: capital,
    currentCapital: capital,
    availableCapital: capital,
  };
}
