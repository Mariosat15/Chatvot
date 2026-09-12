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
 * THE CAPITAL FIELDS ARE STILL UNCONDITIONAL, DELIBERATELY. `startingCapital`,
 * `currentCapital` and `availableCapital` remain `required: true` with no default on both
 * copies of the challenge participant model, so omitting them for a provider game would fail
 * validation rather than produce a game-shaped seat. Making them conditional is a change to
 * TRADING's contract and belongs with the step that actually seats a provider challenge -
 * the same order in which the competition model got `score` in X1 and conditional capital in
 * X5. Until then this builder is honest about being trading-shaped below the label.
 */

export interface ChallengeParticipantSeatInput {
  challengeId: string;
  userId: string;
  username: string;
  email: string;
  role: "challenger" | "challenged";
  gameKey?: string | null;
  startingCapital: number;
  joinedAt: Date;
}

export function buildChallengeParticipantSeat(
  input: ChallengeParticipantSeatInput,
): Record<string, unknown> {
  return {
    challengeId: input.challengeId,
    userId: input.userId,
    username: input.username,
    email: input.email,
    role: input.role,

    // Never defaulted. See the header - a defaulted label is a wrong label.
    gameKey: input.gameKey || TRADING_GAME_TYPE,

    // NO `score`. See the header, and the schema path that used to default it.

    startingCapital: input.startingCapital,
    currentCapital: input.startingCapital,
    availableCapital: input.startingCapital,
    joinedAt: input.joinedAt,
  };
}
