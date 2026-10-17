import Competition from "@/database/models/trading/competition.model";
import GameRound from "@/database/models/games/game-round.model";
import {
  MIN_START_WAIT_SECONDS,
  playNeverStarted,
  resolveStartWaitSeconds,
  startWaitCancelReason,
  startWaitDeadline,
  type StartWaitRoundFacts,
} from "./start-wait";

/**
 * Cancels and fully refunds every together-start contest whose waiting limit has passed
 * without play ever beginning (owner rule, 28 September 2026). Called by the every-minute
 * competition job in BOTH apps, beside the minimum-players cancellation it mirrors.
 *
 * THE PLATFORM DECIDES FROM ITS OWN ROUNDS, never from a message the game may or may not
 * send. The game gives up at the same deadline and ends every open round, but a game that is
 * down, or never told anybody, must still not leave paying players' money parked in a contest
 * that cannot happen. `playNeverStarted` reads only what `game_round` already says.
 *
 * The refund itself is `cancelCompetitionAndRefund`, the one full-refund writer: it claims the
 * contest atomically (so this sweep overlapping the other app's cron, or an admin click,
 * refunds nobody twice), refunds the whole entry fee including the platform fee, notifies each
 * player and ends their live rounds. Do NOT set the status before calling it (R43) - its own
 * claim is the lock, and a pre-set status makes it refund nobody.
 *
 * Mirrored byte-for-byte into `apps/admin/lib/services/games/`.
 */
export async function cancelUnstartedTogetherContests(
  now: Date = new Date(),
): Promise<{ cancelled: number }> {
  // Reason: the shortest permitted limit bounds the query, so a contest cannot be missed
  // however its own limit is set; the exact per-contest deadline is checked below.
  const earliest = new Date(now.getTime() - MIN_START_WAIT_SECONDS * 1000);
  const candidates = await Competition.find({
    gameType: "provider",
    playMode: "scheduled",
    status: { $in: ["upcoming", "active"] },
    isPaused: { $ne: true },
    playWindowStart: { $lte: earliest },
  })
    .select("_id name playMode playWindowStart startWaitSeconds")
    .lean<
      Array<{
        _id: unknown;
        name?: string;
        playMode?: string;
        playWindowStart?: Date;
        startWaitSeconds?: number;
      }>
    >();

  let cancelled = 0;
  for (const contest of candidates) {
    const deadline = startWaitDeadline(contest);
    if (!deadline || now < deadline) continue;

    // Reason: `game_round.contestId` is an ObjectId; the contest's own `_id` is passed as-is
    // so no string-versus-ObjectId mismatch can make every contest look unplayed.
    const rounds = await GameRound.find({ contestId: contest._id })
      .select("userId status rawScore")
      .lean();
    const facts: StartWaitRoundFacts[] = rounds.map((round) => ({
      userId: String(round.userId),
      status: String(round.status),
      rawScore: typeof round.rawScore === "number" ? round.rawScore : null,
    }));
    if (!playNeverStarted(facts)) continue;

    const reason = startWaitCancelReason(
      resolveStartWaitSeconds(contest.startWaitSeconds),
    );
    try {
      const { cancelCompetitionAndRefund } = await import(
        "@/lib/actions/trading/competition-cancel.actions"
      );
      const result = await cancelCompetitionAndRefund(String(contest._id), reason);
      if (result.success) {
        cancelled += 1;
        console.log(
          `🔄 Together-start contest "${contest.name}" cancelled after its waiting limit: ` +
            `${result.refundedCount} player(s) refunded in full`,
        );
      }
    } catch (error) {
      console.error(
        `❌ Could not cancel together-start contest ${String(contest._id)}:`,
        error,
      );
    }
  }
  return { cancelled };
}
