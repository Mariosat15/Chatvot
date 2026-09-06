import { connectToDatabase } from "@/database/mongoose";
import GameProvider from "@/database/models/games/game-provider.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import GameRound from "@/database/models/games/game-round.model";
import ProviderEvent from "@/database/models/games/provider-event.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import { getProviderAdapter } from "@/lib/services/game-providers/registry";

/**
 * Provider health, the fifth and last of chapter 12 section 4's admin destinations.
 *
 * DERIVED FROM EVIDENCE, NOT READ FROM A STORED VERDICT, and that is the whole design.
 *
 * `game_provider` carries `healthStatus` and `lastHealthCheckAt`, declared in X2. Nothing
 * in this codebase has ever written to either - checked with `rg` across both apps - and
 * `healthStatus` defaults to `"down"`. A panel that rendered the stored field would
 * therefore show every provider permanently down, including one that had just settled a
 * contest successfully: a screen that appears to work, reports something precise, and is
 * wrong. The same shape as the trading-shaped services in `matchmaking.service.ts`.
 *
 * The two fields are deliberately left on the schema rather than removed - dropping a field
 * is a mirrored migration in both apps for a cosmetic gain, and the `entryBlockThreshold`
 * precedent is to keep the name and document it as historical. What matters is that nothing
 * reads them, and a test pins that.
 *
 * WHAT "NO EVIDENCE" MEANS IS THE PART MOST EASILY GOT WRONG. A provider with no rounds in
 * the window is not healthy and not down; there is nothing to judge by. Reporting either
 * would be a guess presented as a measurement, so it gets its own verdict. This is the same
 * distinction as a stored value versus an absent one, which is what made
 * `canEnterChallenges` a live defect.
 */

/** How far back the window looks. An operator asking "is it working" means today. */
const WINDOW_HOURS = 24;

/**
 * Above this share of finished rounds ending unresolved, the provider is degraded.
 *
 * Reason it is a share and not a count: one unresolved round out of two is a broken
 * integration, and one out of four hundred is a network. A flat count calls the first
 * healthy and the second broken.
 */
const DEGRADED_UNRESOLVED_SHARE = 0.1;

export type ProviderHealthVerdict =
  | "healthy"
  | "degraded"
  | "down"
  | "no_traffic"
  | "not_configured";

export interface ProviderHealthRow {
  providerKey: string;
  displayName: string;
  verdict: ProviderHealthVerdict;
  /** One sentence an operator can act on. Never a status word on its own. */
  summary: string;
  /**
   * Why the provider cannot run at all, if it cannot. Each names the missing thing rather
   * than saying "misconfigured" - a control that cannot work must say which switch or
   * credential is absent, or an operator has nothing to do next.
   */
  blockers: string[];
  windowHours: number;
  rounds: {
    total: number;
    live: number;
    completed: number;
    unresolved: number;
    endedWithoutResult: number;
  };
  events: {
    total: number;
    scored: number;
    /**
     * Held apart from other failures on purpose. A signature failure is either a wrong
     * secret or an attack, and the two are indistinguishable in the log - so it must never
     * be averaged into a general error count where it disappears.
     */
    signatureInvalid: number;
    otherFailures: number;
  };
  /**
   * Observed from `game_round`, NOT from `provider_game.lastSuccessfulRoundAt`.
   *
   * That field had no writer until R38 was fixed, so it is absent for every round ingested
   * before then. Deriving from the rounds themselves is correct for history as well as for
   * today, and it cannot silently disagree with the round list this panel sits beside.
   */
  lastSuccessfulRoundAt: Date | null;
  lastCatalogueSyncAt: Date | null;
  titleCount: number;
  enabledTitleCount: number;
}

/** Round statuses that mean the round ended without ever producing a score. */
const ENDED_WITHOUT_RESULT = ["abandoned", "expired", "voided"] as const;
/** Round statuses that mean a player is, or should be, playing right now. */
const LIVE = ["pending", "launched"] as const;

export async function getProviderHealth(): Promise<ProviderHealthRow[]> {
  await connectToDatabase();

  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);

  const [providers, settings] = await Promise.all([
    GameProvider.find().sort({ displayName: 1 }).lean(),
    WhiteLabel.findOne()
      .select("+gameProviderCredentials externalGamesEnabled")
      .lean<{
        externalGamesEnabled?: boolean;
        gameProviderCredentials?: {
          providerKey: string;
          callbackToken?: string;
          callbackSecret?: string;
        }[];
      } | null>(),
  ]);

  if (providers.length === 0) return [];

  // Reason for aggregating rather than looping: this screen refreshes on a timer, and one
  // query per provider per status would be a query count that grows with the catalogue.
  const [roundStats, eventStats, lastRounds, titleCounts] = await Promise.all([
    GameRound.aggregate<{ _id: { providerKey: string; status: string }; n: number }>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { providerKey: "$providerKey", status: "$status" },
          n: { $sum: 1 },
        },
      },
    ]),
    ProviderEvent.aggregate<{
      _id: { providerKey: string; processingResult: string };
      n: number;
    }>([
      { $match: { receivedAt: { $gte: since } } },
      {
        $group: {
          _id: {
            providerKey: "$providerKey",
            processingResult: "$processingResult",
          },
          n: { $sum: 1 },
        },
      },
    ]),
    // Reason this is NOT limited to the window: "when did this last work" is the question
    // an operator asks precisely when the window is empty, and a windowed answer would
    // return null exactly then.
    GameRound.aggregate<{ _id: string; at: Date }>([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: "$providerKey",
          at: { $max: "$resultReceivedAt" },
        },
      },
    ]),
    ProviderGame.aggregate<{ _id: string; total: number; enabled: number }>([
      {
        $group: {
          _id: "$providerKey",
          total: { $sum: 1 },
          enabled: { $sum: { $cond: ["$chartvoltEnabled", 1, 0] } },
        },
      },
    ]),
  ]);

  const masterEnabled = Boolean(settings?.externalGamesEnabled);
  const credentials = settings?.gameProviderCredentials ?? [];
  const lastRoundBy = new Map(lastRounds.map((r) => [r._id, r.at]));
  const titleCountBy = new Map(titleCounts.map((t) => [t._id, t]));

  return providers.map((provider) => {
    const key = provider.providerKey;

    const roundsByStatus = (statuses: readonly string[]) =>
      roundStats
        .filter((r) => r._id.providerKey === key && statuses.includes(r._id.status))
        .reduce((sum, r) => sum + r.n, 0);

    const totalRounds = roundStats
      .filter((r) => r._id.providerKey === key)
      .reduce((sum, r) => sum + r.n, 0);

    const rounds = {
      total: totalRounds,
      live: roundsByStatus(LIVE),
      completed: roundsByStatus(["completed"]),
      unresolved: roundsByStatus(["unresolved"]),
      endedWithoutResult: roundsByStatus(ENDED_WITHOUT_RESULT),
    };

    const providerEvents = eventStats.filter((e) => e._id.providerKey === key);
    const eventsWith = (result: string) =>
      providerEvents
        .filter((e) => e._id.processingResult === result)
        .reduce((sum, e) => sum + e.n, 0);

    const totalEvents = providerEvents.reduce((sum, e) => sum + e.n, 0);
    const scored = eventsWith("scored");
    const signatureInvalid = eventsWith("signature_invalid");
    // Reason `duplicate_ignored` is not a failure: a retried delivery is a provider being
    // careful. Counting it as an error would make a well-behaved integration look sick.
    const duplicates = eventsWith("duplicate_ignored");
    const events = {
      total: totalEvents,
      scored,
      signatureInvalid,
      otherFailures: Math.max(
        0,
        totalEvents - scored - signatureInvalid - duplicates,
      ),
    };

    const credential = credentials.find((c) => c.providerKey === key);
    const blockers: string[] = [];
    if (!masterEnabled) {
      blockers.push(
        "External games are switched off platform-wide, so nothing this provider offers can be played.",
      );
    }
    if (!provider.enabled) {
      blockers.push("This provider is disabled.");
    }
    if (!getProviderAdapter(key)) {
      blockers.push(
        `No code adapter is installed for "${key}", so every round would be refused.`,
      );
    }
    if (!credential?.callbackToken || !credential?.callbackSecret) {
      // Reason both are named: the token authenticates the request and the secret verifies
      // the body, and a result missing either is refused with an error that reads exactly
      // like an attack in the log.
      blockers.push(
        "The callback token or secret is missing, so every result they send would fail verification and look identical to an attack.",
      );
    }

    const titles = titleCountBy.get(key);

    return {
      providerKey: key,
      displayName: provider.displayName,
      ...verdictFor({ blockers, rounds, events }),
      blockers,
      windowHours: WINDOW_HOURS,
      rounds,
      events,
      lastSuccessfulRoundAt: lastRoundBy.get(key) ?? null,
      lastCatalogueSyncAt: provider.lastCatalogueSyncAt ?? null,
      titleCount: titles?.total ?? 0,
      enabledTitleCount: titles?.enabled ?? 0,
    };
  });
}

/**
 * The verdict, and a sentence saying what it is based on.
 *
 * The summary is returned alongside the verdict rather than being derived in the component,
 * because the two must not be able to disagree: a badge saying "degraded" beside a sentence
 * describing healthy traffic is worse than either alone.
 */
function verdictFor(input: {
  blockers: string[];
  rounds: ProviderHealthRow["rounds"];
  events: ProviderHealthRow["events"];
}): { verdict: ProviderHealthVerdict; summary: string } {
  const { blockers, rounds, events } = input;

  // Configuration first. A provider that cannot run has no health to measure, and reporting
  // "down" for it would send an operator looking for an outage that is really a switch.
  if (blockers.length > 0) {
    return {
      verdict: "not_configured",
      summary:
        blockers.length === 1
          ? blockers[0]
          : `${blockers.length} things stop this provider running. See below.`,
    };
  }

  if (events.signatureInvalid > 0 && events.scored === 0) {
    // Reason this outranks everything else: every result being rejected unread is the one
    // failure that looks like nothing at all from the player's side - rounds simply never
    // finish - while the log fills with what reads as an attack.
    return {
      verdict: "down",
      summary: `Every result received in the last ${WINDOW_HOURS} hours failed signature verification (${events.signatureInvalid}). Either the shared secret does not match, or the requests are not from this provider.`,
    };
  }

  if (rounds.total === 0) {
    // NOT "healthy" and NOT "down". There is no evidence either way, and saying so is the
    // only honest answer - a green badge here would be a guess presented as a measurement.
    return {
      verdict: "no_traffic",
      summary: `No rounds started in the last ${WINDOW_HOURS} hours, so there is nothing to judge this provider by.`,
    };
  }

  const finished = rounds.completed + rounds.unresolved + rounds.endedWithoutResult;

  if (rounds.completed === 0 && finished > 0) {
    return {
      verdict: "down",
      summary: `${finished} rounds finished in the last ${WINDOW_HOURS} hours and none produced a score.`,
    };
  }

  if (rounds.completed === 0) {
    // Every round still live. Not a failure yet, but not evidence of success either.
    return {
      verdict: "no_traffic",
      summary: `${rounds.live} rounds are still in play and none has reported yet, so there is nothing to judge this provider by.`,
    };
  }

  const unresolvedShare = finished > 0 ? rounds.unresolved / finished : 0;
  if (unresolvedShare > DEGRADED_UNRESOLVED_SHARE) {
    return {
      verdict: "degraded",
      summary: `${rounds.unresolved} of ${finished} finished rounds never reported a result (${Math.round(unresolvedShare * 100)}%). Those are the rounds that hold settlement or score zero.`,
    };
  }

  if (events.signatureInvalid > 0) {
    return {
      verdict: "degraded",
      summary: `${rounds.completed} rounds scored normally, but ${events.signatureInvalid} deliveries failed signature verification. That is either a rotation half-applied or traffic that is not from this provider.`,
    };
  }

  return {
    verdict: "healthy",
    summary: `${rounds.completed} rounds scored in the last ${WINDOW_HOURS} hours with no unresolved results.`,
  };
}
