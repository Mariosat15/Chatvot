/**
 * Participant row builder for the simulator's batch join.
 *
 * Reason: this lives outside the route so its field names can be checked against
 * CompetitionParticipantSchema by a test. insertMany runs in strict mode, so an undeclared
 * field is dropped in silence and the row is written as though the value had never been
 * supplied - there is no error, no warning, and nothing in the stored document to tell you
 * a field went missing. The only way to catch it is to compare the keys against the schema,
 * which `__tests__/services/simulator-join-batch.test.ts` does.
 *
 * The route previously sent `pnlPercent`, `tradesCount` and `joinedAt` (misspellings of
 * declared fields) plus `currentPnl`, `currentPnlPercent` and `currentDrawdown` (which the
 * schema has no equivalent for at all). All six were discarded. That did no visible damage,
 * because every discarded value happened to equal the schema default - so this was a trap
 * waiting for the first non-zero value rather than a live data fault.
 */

export interface SimulatorParticipantRow {
  competitionId: string;
  userId: string;
  username: string;
  email: string;
  startingCapital: number;
  currentCapital: number;
  availableCapital: number;
  pnl: number;
  pnlPercentage: number;
  unrealizedPnl: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  maxDrawdown: number;
  status: string;
  enteredAt: Date;
}

export function buildSimulatorParticipant(
  competitionId: string,
  userId: string,
  startingCapital: number,
  enteredAt: Date,
): SimulatorParticipantRow {
  const suffix = userId.slice(-6);
  return {
    competitionId,
    userId,
    username: `SimUser_${suffix}`,
    email: `simuser_${suffix}@test.simulator`,
    startingCapital,
    currentCapital: startingCapital,
    availableCapital: startingCapital,
    pnl: 0,
    pnlPercentage: 0,
    unrealizedPnl: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    maxDrawdown: 0,
    status: "active",
    enteredAt,
  };
}
