import mongoose from "mongoose";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import GameProvider from "@/database/models/games/game-provider.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { getProviderAdapter } from "@/lib/services/game-providers/registry";
import { parseConfigSchema } from "@/lib/services/games/config-schema";
import { runPreflight } from "@/lib/services/games/contest-preflight";
import { contestRoundConfig } from "@/lib/services/games/contest-config";
import type { ProviderContestFields } from "@/lib/services/games/contest-config";

/**
 * Publishing a provider contest: draft -> upcoming.
 *
 * THE WHOLE POINT IS THAT IT RE-RUNS THE CHECKLIST, and does so against the STORED contest
 * rather than anything the caller passes. A draft can sit for a week, and in that week an
 * operator can disable the title, disable the provider, or turn external games off
 * platform-wide. Trusting the validation done on creation day would publish a contest into
 * a world that no longer supports it - players would pay to enter, and the first person to
 * press Play would be refused by `resolveEnabledProvider` with no way to get their money
 * back except a manual refund.
 *
 * It also asks a question creation could not: whether `contestRoundConfig` can read
 * playable round settings back OFF the saved document. Creation validated its own input;
 * this validates what actually persisted. The two differ whenever a field is dropped by
 * strict mode, which is exactly the failure this codebase keeps finding.
 */

export type PublishResult =
  | { success: true; warnings: string[] }
  | { success: false; error: string; errors?: string[] };

/**
 * Reuses `ProviderContestFields` rather than restating it, so that a field added to the
 * round-settings contract cannot be silently missed here. Restating it is how the pre-flight
 * checklist ended up reading `billsPerRound`, a field no model has.
 */
type StoredProviderContest = ProviderContestFields & {
  _id: mongoose.Types.ObjectId;
  name: string;
  status: string;
  minParticipants?: number;
};

export async function publishProviderContest(
  competitionId: string,
): Promise<PublishResult> {
  if (!mongoose.Types.ObjectId.isValid(competitionId)) {
    return { success: false, error: "That competition id is not valid." };
  }

  try {
    await connectToDatabase();

    const contest = await Competition.findById(
      competitionId,
    ).lean<StoredProviderContest | null>();

    if (!contest) {
      return { success: false, error: "Competition not found." };
    }

    // Reason: this route publishes PROVIDER contests. A trading contest reaching it would
    // skip every trading-specific check its own path performs, so refuse rather than
    // quietly do a partial job on it.
    if (contest.gameType !== "provider") {
      return {
        success: false,
        error:
          "This is not a provider-game contest, so it cannot be published from here.",
      };
    }

    if (contest.status !== "draft") {
      return {
        success: false,
        error:
          contest.status === "upcoming"
            ? "This contest is already published."
            : `This contest is ${contest.status} and can no longer be published.`,
      };
    }

    // Gate 1: can the round settings be read back off what was actually stored? This is
    // the X3 bridge, and it REFUSES rather than defaulting - a contest whose settings did
    // not persist must not run on settings nobody chose.
    const roundConfig = contestRoundConfig(contest);
    if (!roundConfig.ok) {
      return {
        success: false,
        error: `This contest cannot be published: ${roundConfig.error}`,
      };
    }

    // Gate 1b: the two settings `contestRoundConfig` does not police, because a round can
    // be launched without them. Publishing cannot: the pre-flight checks the play window
    // sits inside the contest and that the grace period is sane, and it cannot check a
    // value that is absent. Refusing here beats coercing them - a defaulted grace period is
    // a number no operator chose, governing when a player's missing result is written off.
    if (!contest.playWindowStart || !contest.playWindowEnd) {
      return {
        success: false,
        error:
          "This contest has no play window, so players would have no period in which to play. Recreate it with a play window.",
      };
    }
    if (contest.resultGracePeriodSeconds === undefined) {
      return {
        success: false,
        error:
          "This contest has no result grace period, so there is no rule for how long to wait for a late result. Recreate it with one.",
      };
    }

    // Gate 2: the full creation checklist, re-run against today's switches.
    const [provider, title, settings] = await Promise.all([
      GameProvider.findOne({
        providerKey: roundConfig.providerKey,
      }).lean<{ enabled: boolean } | null>(),
      ProviderGame.findOne({
        providerKey: roundConfig.providerKey,
        gameCode: roundConfig.gameCode,
      }).lean(),
      WhiteLabel.findOne()
        .select("externalGamesEnabled")
        .lean<{ externalGamesEnabled?: boolean } | null>(),
    ]);

    if (!title) {
      return {
        success: false,
        error:
          "That game is no longer in our catalogue, so this contest cannot be published.",
      };
    }

    const parsed = parseConfigSchema(title.configSchema);
    if (!parsed.ok) {
      return {
        success: false,
        error: `This game's settings schema is no longer supported: ${parsed.error}`,
      };
    }

    const preflight = runPreflight({
      format: "competition",
      minParticipants: contest.minParticipants ?? 2,
      title: {
        displayName: title.displayName,
        providerStatus: title.providerStatus,
        supportsCompetition: Boolean(title.supportsCompetition),
        supportsOneVsOne: Boolean(title.supportsOneVsOne),
        maxDurationSeconds: title.maxDurationSeconds,
      },
      provider: {
        enabled: Boolean(provider?.enabled),
        adapterInstalled: Boolean(getProviderAdapter(roundConfig.providerKey)),
      },
      chartvoltEnabled: Boolean(title.chartvoltEnabled),
      externalGamesEnabled: Boolean(settings?.externalGamesEnabled),
      schemaFields: parsed.fields,
      settings: contest.gameConfig?.settings ?? {},
      playWindowStart: contest.playWindowStart,
      playWindowEnd: contest.playWindowEnd,
      resultGracePeriodSeconds: contest.resultGracePeriodSeconds,
      attemptsPolicy: contest.attemptsPolicy as never,
      attemptsAllowed: contest.attemptsAllowed,
      unresolvedRoundPolicy: contest.unresolvedRoundPolicy as never,
      // Reason: acknowledged at creation. Re-asking on publish would make it a click to
      // dismiss rather than a decision, which is how a cost warning stops being read.
      perRoundCostAcknowledged: true,
      lastSandboxRoundAt: title.lastSuccessfulRoundAt ?? null,
    });

    if (!preflight.ok) {
      return {
        success: false,
        error:
          "This contest can no longer be published. Fix the problems below and try again.",
        errors: preflight.errors,
      };
    }

    // Claim and complete in one instruction, filtered on the status being unchanged.
    // Setting the final status up front IS the lock - two operators pressing Publish
    // together means the second matches nothing and is told it is already published,
    // rather than both succeeding and one overwriting the other.
    //
    // It deliberately sets ONLY the status. A `publishedAt` was written here first and
    // removed: `Competition` does not declare it, so strict mode would have discarded it
    // while this function went on reporting success - the same silent-drop this codebase
    // has now hit on `referenceId`, `challengeId`, `suspensionEndsAt` and `saveToEnv`.
    // Adding a mirrored field for it would buy nothing, because `updatedAt` already
    // carries the timestamp and the audit log already carries who did it.
    const claimed = await Competition.findOneAndUpdate(
      { _id: contest._id, status: "draft" },
      { $set: { status: "upcoming" } },
      { new: true },
    );

    if (!claimed) {
      return {
        success: false,
        error: "This contest was published by someone else a moment ago.",
      };
    }

    console.log(
      `📢 Published provider contest "${contest.name}" (${competitionId})`,
    );

    return { success: true, warnings: preflight.warnings };
  } catch (error) {
    console.error("❌ Failed to publish provider contest:", error);
    return {
      success: false,
      error: "Something went wrong. Please contact support.",
    };
  }
}
