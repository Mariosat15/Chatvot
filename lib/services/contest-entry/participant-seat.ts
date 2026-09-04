import { resolveGameType, TRADING_GAME_TYPE } from "@/lib/games";

/**
 * Builds the `CompetitionParticipant` row for a new entry.
 *
 * EXTRACTED FROM THE INLINE OBJECT IT USED TO BE, for the reason the simulator's equivalent
 * was: a test can compare a named function's output keys against `Model.schema.paths`, and
 * no assertion on a saved document can, because strict mode has already discarded the
 * evidence by then. That is exactly how the batch route was found to be silently dropping
 * six fields.
 *
 * TWO THINGS CHANGE FOR A NON-TRADING CONTEST, and only two.
 *
 * **`gameKey` is copied from the contest.** It used to be left to the schema default, which
 * is `"trading"` - so every provider participant would have been stamped as a trading one.
 * That is an R7-class mislabel and the harm is the same: nothing crashes, the row saves, and
 * an aggregate that groups by `gameKey` silently files the player under the wrong game
 * forever, because `gameKey` is immutable.
 *
 * **The three virtual-capital fields are omitted.** A chess player has no starting capital,
 * and `competition.startingCapital` is `undefined` on a provider contest, so copying it
 * would write `undefined` into fields the schema requires. The schema now makes those three
 * conditional on the same label this function writes - which is why the label must be set
 * here rather than defaulted, or the predicate would demand capital the caller has none of.
 */

export interface ParticipantSeatInput {
  competitionId: string;
  userId: string;
  username: string;
  email: string;
  gameKey?: string | null;
  gameType?: string | null;
  startingCapital?: number | null;
  enteredAt: Date;
}

export function buildParticipantSeat(
  input: ParticipantSeatInput,
): Record<string, unknown> {
  const isTrading = resolveGameType(input.gameType) === TRADING_GAME_TYPE;

  const seat: Record<string, unknown> = {
    competitionId: input.competitionId,
    userId: input.userId,
    username: input.username,
    email: input.email,

    // Never defaulted. See the header - a defaulted label is a wrong label.
    gameKey: input.gameKey || TRADING_GAME_TYPE,
    score: 0,

    currentRank: 0,
    highestRank: 0,
    status: "active",
    enteredAt: input.enteredAt,
  };

  if (!isTrading) return seat;

  // Trading only, from here down. Every one of these is a virtual-money or trade-count
  // field that has no meaning in a game where the provider reports a single score.
  const capital = input.startingCapital ?? 0;

  return {
    ...seat,
    startingCapital: capital,
    currentCapital: capital,
    availableCapital: capital,
    usedMargin: 0,
    pnl: 0,
    pnlPercentage: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    averageWin: 0,
    averageLoss: 0,
    largestWin: 0,
    largestLoss: 0,
    currentOpenPositions: 0,
    maxDrawdown: 0,
    maxDrawdownPercentage: 0,
    marginCallWarnings: 0,
  };
}
