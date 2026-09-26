import { connectToDatabase } from "@/database/mongoose";
import Challenge from "@/database/models/trading/challenge.model";
import ChallengeParticipant from "@/database/models/trading/challenge-participant.model";
import ChallengeSettings from "@/database/models/trading/challenge-settings.model";
import { settleChallenge } from "./challenge-settlement.service";
import { assessUnresolvedRounds } from "./unresolved-rounds";
import { assessRoundCutoff } from "./round-cutoff";
import { endLiveRoundsForContest } from "@/lib/services/games/contest-round-cleanup";
import { deriveChallengeWindow } from "@/lib/services/games/challenge-window";
import { formatChallengeResultLine } from "@/lib/utils/challenge-result-line";

/**
 * The lock, the transaction and the retry around provider CHALLENGE settlement.
 *
 * Deliberately the same shape as `provider-finalize.ts`'s competition version - same
 * hold/cut-off gates ahead of the lock, same optimistic `active -> finalizing` claim, same
 * release-the-claim-on-any-abort discipline. What differs is the settlement call itself:
 * `settleChallenge` (already game-agnostic since it was unified onto the shared prize/fee
 * stages) rather than `settleProviderCompetition`, and the notifications a challenge sends
 * that a competition does not.
 *
 * WHY THE GATES APPLY HERE TOO, EVEN THOUGH `Challenge` DECLARES NEITHER FIELD THEY READ.
 * `Challenge` has no `unresolvedRoundPolicy` and no `resultGracePeriodSeconds` - a 1v1 has
 * no operator to configure a policy for, and the two-player shape has no sensible reading
 * of "exclude the unresolved player and re-split the pool" the way a many-player contest
 * does. So both calls below always resolve to their permissive defaults
 * (`score_zero` / `DEFAULT_RESULT_GRACE_SECONDS`) and the hold gate can never fire. They
 * are still called, for two reasons: `assessRoundCutoff`'s grace-window WAIT still matters
 * - a challenger who finishes at the last second must not be scored zero because the cron
 * claimed the challenge sixty seconds after `endTime` - and calling both keeps this file
 * structurally identical to the competition path, so the day a challenge ever gains its own
 * policy field this file needs no restructuring, only a field to read.
 *
 * DELIBERATELY NO XP AND NO BADGE EVALUATION. The trading challenge path
 * (`challenge-finalize.actions.ts`) awards `challenge_completed` / `challenge_won` XP and
 * evaluates every badge category; provider COMPETITIONS award neither, and adding it only
 * to provider CHALLENGES would be a new asymmetry rather than closing an old one. This
 * mirrors the choice already made for `provider-finalize.ts` and leaves the same
 * cross-game progression gap (risk X13 territory) undocumented nowhere else and
 * unresolved here - noted rather than quietly fixed, because fixing it is a decision about
 * every provider contest, not one file.
 */

const MAX_RETRIES = 3;

export interface ProviderChallengeSettlementResult {
  success: boolean;
  error?: string;
  winnerId?: string | null;
  winnerName?: string | null;
  isTie?: boolean;
}

export async function finalizeProviderChallenge(
  challengeId: string,
): Promise<ProviderChallengeSettlementResult> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await attemptProviderChallengeFinalize(challengeId);
    } catch (error: unknown) {
      const mongoErr = error as Record<string, unknown> | null;
      const isTransient =
        (mongoErr?.errorLabelSet as Set<string> | undefined)?.has?.(
          "TransientTransactionError",
        ) ||
        (mongoErr?.errorLabels as string[] | undefined)?.includes?.(
          "TransientTransactionError",
        ) ||
        mongoErr?.code === 112 ||
        mongoErr?.codeName === "WriteConflict";

      if (isTransient && attempt < MAX_RETRIES) {
        const delay = Math.min(500 * Math.pow(2, attempt - 1), 4000);
        console.warn(
          `⚠️ [PROVIDER] TransientTransactionError on attempt ${attempt}/${MAX_RETRIES} for challenge ${challengeId}, retrying in ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      console.error("❌ Error settling provider challenge:", error);
      // Reason: returns rather than throws - every caller of `finalizeChallenge` is either a
      // server action or a worker job, and a thrown error here would surface to a player as
      // a render error instead of a reason.
      return {
        success: false,
        error: "Something went wrong. Please contact support.",
      };
    }
  }

  return {
    success: false,
    error: `Provider challenge settlement failed after ${MAX_RETRIES} retries`,
  };
}

async function attemptProviderChallengeFinalize(
  challengeId: string,
): Promise<ProviderChallengeSettlementResult> {
  await connectToDatabase();

  // THE CUT-OFF AND HOLD GATES, BEFORE THE LOCK - same ordering and same reasoning as
  // `provider-finalize.ts`: the cut-off gate must run first because it is what PUTS a round
  // into `unresolved`, and both sit before the claim so a challenge merely waiting on a
  // grace window is never moved to `finalizing`.
  const policyDoc = await Challenge.findById(challengeId)
    .select("startTime endTime")
    .lean<{ startTime?: Date; endTime?: Date } | null>();

  if (policyDoc) {
    const window = deriveChallengeWindow(policyDoc);

    if (window) {
      const cutoff = await assessRoundCutoff({
        competitionId: challengeId,
        playWindowEnd: window.playWindowEnd,
        // Reason: `Challenge` declares no `resultGracePeriodSeconds` field, so this is
        // always `undefined` and `assessRoundCutoff` falls back to
        // `DEFAULT_RESULT_GRACE_SECONDS` - see the file header for why the call still
        // matters despite the field never being configurable.
        resultGracePeriodSeconds: undefined,
      });

      if (cutoff.deferSettlement) {
        console.log(`⏳ [PROVIDER] ${cutoff.deferReason}`);
        return { success: false, error: cutoff.deferReason };
      }

      if (cutoff.liveRoundCount > 0) {
        await endLiveRoundsForContest({
          contestId: challengeId,
          outcome: "cutoff",
          reason: `Play closed and the ${cutoff.graceSeconds}s result grace window expired with no result`,
        });
      }
    }

    // Reason: `Challenge` declares no `unresolvedRoundPolicy` field, so `storedPolicy` is
    // always `undefined` and this always resolves to `score_zero`, returning immediately
    // with `blocksSettlement: false` - see the file header for why the call is still made.
    const held = await assessUnresolvedRounds({
      competitionId: challengeId,
      storedPolicy: undefined,
    });

    if (held.blocksSettlement) {
      console.warn(`⏸️ [PROVIDER] ${held.blockReason}`);
      return { success: false, error: held.blockReason };
    }
  }

  // OPTIMISTIC LOCK: only one caller can move "active" -> "finalizing". Everyone else gets
  // null and stops, which is what makes a double cron delivery harmless. Also requires
  // `endTime` to have passed (or not set), matching the trading attempt function's own gate.
  const lockResult = await Challenge.findOneAndUpdate(
    {
      _id: challengeId,
      status: "active",
      $or: [
        { endTime: { $exists: false } },
        { endTime: null },
        { endTime: { $lte: new Date() } },
      ],
    },
    { $set: { status: "finalizing" } },
    { new: true },
  );

  if (!lockResult) {
    const existing = await Challenge.findById(challengeId)
      .select("status")
      .lean<{ status?: string } | null>();
    console.log(
      `⚠️ Challenge ${challengeId} is not active (status: ${existing?.status ?? "not found"}), skipping`,
    );
    return { success: false, error: "Challenge is not active" };
  }

  // Reason: the session comes from the MODEL's connection, not a top-level `mongoose`
  // import - the admin app has its own `node_modules/mongoose`, so the global instance can
  // differ from the one the models registered on.
  const session = await Challenge.db.startSession();
  session.startTransaction();

  try {
    const challenge = await Challenge.findById(challengeId).session(session);

    if (!challenge) {
      await session.abortTransaction();
      await Challenge.updateOne(
        { _id: challengeId, status: "finalizing" },
        { $set: { status: "active" } },
      );
      return { success: false, error: "Challenge not found" };
    }

    const participants = await ChallengeParticipant.find({
      challengeId,
    }).session(session);

    if (participants.length !== 2) {
      console.error(`Challenge ${challengeId} doesn't have 2 participants`);
      await session.abortTransaction();
      await Challenge.updateOne(
        { _id: challengeId, status: "finalizing" },
        { $set: { status: "active" } },
      );
      return { success: false, error: "Challenge does not have 2 participants" };
    }

    const challenger = participants.find((p) => p.role === "challenger");
    const challenged = participants.find((p) => p.role === "challenged");

    if (!challenger || !challenged) {
      console.error(`Challenge ${challengeId} missing participants`);
      await session.abortTransaction();
      await Challenge.updateOne(
        { _id: challengeId, status: "finalizing" },
        { $set: { status: "active" } },
      );
      return { success: false, error: "Challenge missing challenger or challenged participant" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mongoose singleton plugin adds getSingleton() at runtime
    const settings = await (ChallengeSettings as any).getSingleton();

    const { winnerId, winnerName, winnerPnL, loserId, loserName, loserPnL, isTie } =
      await settleChallenge({
        session,
        challenge,
        challenger,
        challenged,
        tiePrizeDistribution: settings?.tiePrizeDistribution || "split_equally",
      });

    // Reason: read off the persisted final stats, not `.status` - a disqualified participant
    // who lost by default has their `.status` moved on to "completed" inside
    // `settleChallenge`, so only `*FinalStats.isDisqualified` stays the permanent record.
    const challengerDisqualified =
      challenge.challengerFinalStats?.isDisqualified ?? false;
    const challengedDisqualified =
      challenge.challengedFinalStats?.isDisqualified ?? false;
    const winnerPrize = challenge.winnerPrize;

    // A REFUSAL MUST NOT COMMIT, AND MUST RELEASE THE CLAIM - same reasoning as
    // `provider-finalize.ts`. `settleChallenge` above has no refusal branch today (it
    // either settles or throws), so this is defence in depth rather than a reachable path.
    await session.commitTransaction();
    session.endSession();

    // Send notifications outside the transaction - fire and forget, same as the trading
    // path. `formatChallengeResultLine` is what lets these use the SAME templates as the
    // trading path without printing "Final P&L" over a game score.
    try {
      const { notificationService } = await import(
        "@/lib/services/notification.service"
      );
      const gameType = challenge.gameType;

      if (winnerId && !isTie) {
        notificationService
          .send({
            userId: winnerId,
            templateId: "challenge_won",
            variables: {
              challengeId: challenge._id.toString(),
              challengeSlug: challenge.slug,
              opponentName: loserName || "opponent",
              prize: winnerPrize,
              resultLine: formatChallengeResultLine(gameType, winnerPnL),
            },
          })
          .catch((e) =>
            console.error("Failed to send winner notification:", e),
          );

        if (loserId) {
          notificationService
            .send({
              userId: loserId,
              templateId: "challenge_lost",
              variables: {
                challengeId: challenge._id.toString(),
                challengeSlug: challenge.slug,
                opponentName: winnerName || "opponent",
                resultLine: formatChallengeResultLine(gameType, loserPnL),
              },
            })
            .catch((e) =>
              console.error("Failed to send loser notification:", e),
            );
        }
      } else if (isTie) {
        const tieDistribution = settings?.tiePrizeDistribution || "split_equally";
        const tieResolution =
          tieDistribution === "split_equally"
            ? "Prize has been split equally."
            : tieDistribution === "challenger_wins"
              ? "Challenger wins by default."
              : "No prize awarded.";

        notificationService
          .send({
            userId: challenger.userId,
            templateId: "challenge_tie",
            variables: {
              challengeId: challenge._id.toString(),
              challengeSlug: challenge.slug,
              opponentName: challenged.username || "opponent",
              tieResolution,
            },
          })
          .catch((e) => console.error("Failed to send tie notification:", e));

        notificationService
          .send({
            userId: challenged.userId,
            templateId: "challenge_tie",
            variables: {
              challengeId: challenge._id.toString(),
              challengeSlug: challenge.slug,
              opponentName: challenger.username || "opponent",
              tieResolution,
            },
          })
          .catch((e) => console.error("Failed to send tie notification:", e));
      }

      if (challengerDisqualified) {
        notificationService
          .send({
            userId: challenger.userId,
            templateId: "challenge_disqualified",
            variables: {
              challengeId: challenge._id.toString(),
              challengeSlug: challenge.slug,
              opponentName: challenged.username || "opponent",
              reason: challenger.disqualificationReason || "No score recorded",
            },
          })
          .catch((e) =>
            console.error("Failed to send disqualification notification:", e),
          );
      }

      if (challengedDisqualified) {
        notificationService
          .send({
            userId: challenged.userId,
            templateId: "challenge_disqualified",
            variables: {
              challengeId: challenge._id.toString(),
              challengeSlug: challenge.slug,
              opponentName: challenger.username || "opponent",
              reason: challenged.disqualificationReason || "No score recorded",
            },
          })
          .catch((e) =>
            console.error("Failed to send disqualification notification:", e),
          );
      }
    } catch (notifError) {
      console.error("Error sending provider challenge notifications:", notifError);
    }

    // Reason: the global leaderboard counts challengesWon - stale the moment ranks are
    // written. Best effort, and looked up rather than destructured for the same reason as
    // `provider-finalize.ts`: the admin app's leaderboard actions module does not export
    // `clearLeaderboardCache`.
    try {
      const leaderboardModule = (await import(
        "@/lib/actions/leaderboard/global-leaderboard.actions"
      )) as Record<string, unknown>;
      const clear = leaderboardModule.clearLeaderboardCache;
      if (typeof clear === "function") {
        await (clear as () => Promise<unknown>)();
      }
    } catch {
      // Best effort
    }

    // Award activity XP + evaluate badges for both players (fire and forget).
    //
    // Reason: risk R94. Until this existed a provider challenge awarded NOTHING, for ever -
    // so the whole of a games-only player's XP and badge progress was silently zero. Latent
    // only because no provider challenge has settled in production. A tie leaves both
    // players unranked, so neither takes the winner bonus.
    try {
      const { awardContestRewards } = await import("./contest-rewards");
      await awardContestRewards({
        kind: "challenge",
        contestId: challengeId,
        gameKey: challenge.gameKey,
        fieldSize: 2,
        entryFee: challenge.entryFee || 0,
        participants: [challenger, challenged].map((p) => ({
          userId: p.userId.toString(),
          rank: !isTie && p.userId.toString() === winnerId ? 1 : undefined,
        })),
      });
    } catch (rewardError) {
      console.error(
        `❌ [PROVIDER] Challenge ${challengeId}: rewards stage failed:`,
        rewardError,
      );
    }

    console.log(
      `✅ [PROVIDER] Challenge ${challengeId} finalized: Winner: ${winnerName || "TIE"}`,
    );

    return { success: true, winnerId, winnerName, isTie };
  } catch (error) {
    let aborted = false;
    try {
      if (session.inTransaction()) {
        await session.abortTransaction();
        aborted = true;
      }
    } catch (abortErr) {
      console.warn("⚠️ session.abortTransaction() failed:", abortErr);
      aborted = true;
    }

    // Released ONLY when the transaction did not commit - if it did, prizes are already
    // paid and resetting to "active" would invite a second payout.
    if (aborted) {
      try {
        await Challenge.updateOne(
          { _id: challengeId, status: "finalizing" },
          { $set: { status: "active" } },
        );
      } catch {
        // Best effort
      }
    }

    console.error("Error finalizing provider challenge", challengeId, ":", error);
    throw error;
  } finally {
    try {
      session.endSession();
    } catch {
      // Already ended after a successful commit.
    }
  }
}
