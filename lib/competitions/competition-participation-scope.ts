/**
 * Statuses that belong to a player's own competition history.
 *
 * Open competitions remain discoverable to everyone. Once a competition is
 * settling or settled, it belongs in this browser only when the viewer held a
 * participant seat.
 */
const PARTICIPANT_ONLY_STATUSES = new Set([
  "finalizing",
  "completed",
  "cancelled",
  "emergency_ended",
]);

export function scopeCompetitionStatusesToParticipant(
  statuses: string[],
  participantCompetitionIds: unknown[],
): Record<string, unknown> {
  const discoverable = statuses.filter(
    (status) => !PARTICIPANT_ONLY_STATUSES.has(status),
  );
  const history = statuses.filter((status) =>
    PARTICIPANT_ONLY_STATUSES.has(status),
  );

  if (history.length === 0) {
    return { status: { $in: discoverable, $ne: "draft" } };
  }

  const branches: Record<string, unknown>[] = [];
  if (discoverable.length > 0) {
    branches.push({ status: { $in: discoverable, $ne: "draft" } });
  }
  if (participantCompetitionIds.length > 0) {
    branches.push({
      status: { $in: history },
      _id: { $in: participantCompetitionIds },
    });
  }

  // Reason: an anonymous viewer, or a player with no seats, has no history to show.
  return branches.length > 0 ? { $or: branches } : { _id: { $in: [] } };
}
