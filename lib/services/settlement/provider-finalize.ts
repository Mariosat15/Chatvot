import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import {
  settleProviderCompetition,
  type ProviderSettlementResult,
} from "./provider-settlement.service";
import { assessUnresolvedRounds } from "./unresolved-rounds";

/**
 * The lock, the transaction and the retry around provider settlement.
 *
 * Deliberately the same shape as the trading path's: claim `active -> finalizing`
 * atomically, settle inside a transaction, and RELEASE THE CLAIM if anything fails. The
 * release is the part that is easy to leave out and impossible to notice in a test that
 * only checks the happy path - without it a transient write conflict strands the contest
 * in `finalizing` for ever, where no later attempt can claim it, no cron picks it up, and
 * the players are simply never paid.
 */

const MAX_RETRIES = 3;

export async function finalizeProviderCompetition(
  competitionId: string,
): Promise<ProviderSettlementResult> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await attemptProviderFinalize(competitionId);
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
          `⚠️ [PROVIDER] TransientTransactionError on attempt ${attempt}/${MAX_RETRIES} for ${competitionId}, retrying in ${delay}ms...`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      console.error("❌ Error settling provider competition:", error);
      // Reason: returns rather than throws, because every caller is a server action and
      // Next.js strips thrown error messages in production builds - the operator would
      // get a render error instead of a reason.
      return {
        success: false,
        error: "Something went wrong. Please contact support.",
      };
    }
  }

  return {
    success: false,
    error: `Provider settlement failed after ${MAX_RETRIES} retries`,
  };
}

async function attemptProviderFinalize(
  competitionId: string,
): Promise<ProviderSettlementResult> {
  await connectToDatabase();

  // THE HOLD GATE, BEFORE THE LOCK. Under `hold_and_alert` an unreported round means this
  // contest must not settle until a human resolves it - which is a condition that persists,
  // not a transient failure. Checking it here leaves the contest completely untouched;
  // checking it after the claim would set `finalizing` and rely on the release path, and
  // every sweep would churn the status of a contest that is deliberately parked.
  //
  // Same reasoning as the game-label gate in `finalizeCompetition`, and the same reason it
  // cannot be proven by asserting the end status: both placements refuse. The difference is
  // whether a write happened.
  const policyDoc = await Competition.findById(competitionId)
    .select("unresolvedRoundPolicy")
    .lean<{ unresolvedRoundPolicy?: string } | null>();

  if (policyDoc) {
    const held = await assessUnresolvedRounds({
      competitionId,
      storedPolicy: policyDoc.unresolvedRoundPolicy,
    });

    if (held.blocksSettlement) {
      console.warn(`⏸️ [PROVIDER] ${held.blockReason}`);
      return { success: false, error: held.blockReason };
    }
  }

  // Only one caller can move `active -> finalizing`. Everyone else gets null and stops,
  // which is what makes a double cron delivery harmless.
  const lockResult = await Competition.findOneAndUpdate(
    { _id: competitionId, status: "active" },
    { $set: { status: "finalizing" } },
    { new: true },
  );

  if (!lockResult) {
    const existing = await Competition.findById(competitionId)
      .select("status")
      .lean<{ status?: string } | null>();
    console.log(
      `⚠️ Competition ${competitionId} is not active (status: ${existing?.status ?? "not found"}), skipping`,
    );
    return { success: false, error: "Competition is not active" };
  }

  // Reason: the session comes from the MODEL's connection, not a top-level `mongoose`
  // import. The admin app has its own `node_modules/mongoose`, so the global instance can
  // differ from the one the models registered on, and the symptom is the opaque
  // "ClientSession must be from the same MongoClient".
  const session = await Competition.db.startSession();
  session.startTransaction();

  try {
    const competition =
      await Competition.findById(competitionId).session(session);

    if (!competition) {
      await session.abortTransaction();
      await Competition.updateOne(
        { _id: competitionId, status: "finalizing" },
        { $set: { status: "active" } },
      );
      return { success: false, error: "Competition not found" };
    }

    const result = await settleProviderCompetition(
      competition as unknown as Parameters<typeof settleProviderCompetition>[0],
      session,
    );

    // A REFUSAL MUST NOT COMMIT, AND MUST RELEASE THE CLAIM. Until this existed, a
    // `success: false` return committed the transaction anyway and left the contest at
    // `finalizing` for ever - no later attempt could claim it, no cron would pick it up,
    // and nobody would be paid. It was latent rather than live only because nothing
    // returned a refusal yet; the hold-and-alert check above is the first thing that can.
    //
    // The catch block below cannot cover this, because a returned refusal is not a thrown
    // error - which is exactly why this file's own warning about the release being "easy to
    // leave out and impossible to notice in a test that only checks the happy path" applied
    // to itself.
    if (!result.success) {
      await session.abortTransaction();
      session.endSession();
      await Competition.updateOne(
        { _id: competitionId, status: "finalizing" },
        { $set: { status: "active" } },
      );
      return result;
    }

    await session.commitTransaction();
    session.endSession();

    // Reason: the global leaderboard counts wins and podium finishes, so it is stale the
    // moment ranks are written. Best effort - a cold cache is not worth failing a
    // settlement that has already committed.
    //
    // The export is looked up rather than destructured because THE TWO APPS GENUINELY
    // DIFFER HERE: the admin app's leaderboard actions module does not export
    // `clearLeaderboardCache`. Destructuring it compiles in the main app and fails the
    // admin typecheck on a line that is only ever reached on a happy path, which is a
    // confusing way to learn that this file is mirrored into an app with a smaller module.
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

    return result;
  } catch (error) {
    let aborted = false;
    try {
      if (session.inTransaction()) {
        await session.abortTransaction();
        aborted = true;
      }
    } catch (abortErr) {
      // `abortTransaction` throws if MongoDB already auto-aborted the session. The lock
      // still has to be released below, so this is caught rather than propagated.
      console.warn("⚠️ session.abortTransaction() failed:", abortErr);
      aborted = true;
    }

    // Released ONLY when the transaction did not commit. If it did commit, prizes are
    // already paid and resetting to `active` would invite a second payout.
    if (aborted) {
      try {
        await Competition.updateOne(
          { _id: competitionId, status: "finalizing" },
          { $set: { status: "active" } },
        );
      } catch {
        // Best effort
      }
    }

    throw error;
  } finally {
    try {
      session.endSession();
    } catch {
      // Already ended after a successful commit.
    }
  }
}
