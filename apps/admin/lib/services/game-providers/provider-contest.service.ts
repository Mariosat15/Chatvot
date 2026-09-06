import { randomBytes } from "node:crypto";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import GameProvider from "@/database/models/games/game-provider.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import {
  parseConfigSchema,
  validateConfigValues,
} from "@/lib/services/games/config-schema";
import type { ConfigField } from "@/lib/services/games/config-schema";
import { runPreflight } from "@/lib/services/games/contest-preflight";
import type { PreflightResult } from "@/lib/services/games/contest-preflight";
import type {
  AttemptsPolicy,
  UnresolvedRoundPolicy,
} from "@/lib/services/games/round-types";
import { getProviderAdapter } from "./registry";

/**
 * Creating a competition on an external provider game (X6, chapter 12 section 2).
 *
 * SEPARATE FROM THE TRADING CREATE ACTION, ON PURPOSE. The plan describes one wizard whose
 * step 4 becomes dynamic, and that remains the destination. But the trading form is 2,892
 * lines, its create action writes thirty fields, and chapter 12's own acceptance criteria
 * demand BOTH "a provider contest is creatable without a single trading field appearing"
 * AND "trading contest creation is unchanged". Two paths satisfy both with no risk to the
 * running app; one path satisfies both only after a large refactor of the screen your live
 * trading contests depend on. The shared entry point is the game picker, which routes.
 *
 * IT CREATES A DRAFT, AND THIS IS THE LOAD-BEARING DECISION. `GET /api/competitions`, the
 * player lobby, filters `status: { $ne: "draft" }` - an explicit exclusion, which is a
 * stronger guarantee than an inclusion list would be, since a status added later is hidden
 * by default rather than accidentally exposed. That matters because the player-facing side
 * of a provider contest does not exist yet (X7): every screen would render trading
 * furniture, and the join path still copies trading starting capital onto the participant.
 * Creating anything visible would put a contest in front of players that they cannot play.
 * Publishing is X5's to enable, once entry and settlement understand provider games.
 */

export interface CreateProviderContestInput {
  name: string;
  description: string;
  providerKey: string;
  gameCode: string;
  settings: Record<string, unknown>;

  entryFee: number;
  minParticipants: number;
  maxParticipants: number;
  platformFeePercentage: number;
  prizeDistribution: { rank: number; percentage: number }[];

  startTime: Date;
  endTime: Date;
  playWindowStart: Date;
  playWindowEnd: Date;

  attemptsPolicy: AttemptsPolicy;
  attemptsAllowed?: number;
  unresolvedRoundPolicy: UnresolvedRoundPolicy;
  resultGracePeriodSeconds: number;
  perRoundCostAcknowledged?: boolean;

  createdBy: string;
}

export interface CreateProviderContestResult {
  success: boolean;
  error?: string;
  /** Hard refusals from the pre-flight checklist. */
  errors?: string[];
  /** Advisory notes the operator should see. Present on success too. */
  warnings?: string[];
  competitionId?: string;
  slug?: string;
}

/** Everything the wizard needs to render a title's settings step. */
export interface ProviderContestOption {
  providerKey: string;
  providerName: string;
  gameCode: string;
  gameKey: string;
  displayName: string;
  family: string;
  scoreDirection: string;
  scoreType: string;
  maxDurationSeconds?: number;
  supportsCompetition: boolean;
  supportsOneVsOne: boolean;
  /**
   * Parsed field list, or the reason the schema is unusable.
   *
   * The failure is carried to the UI rather than filtered out of the list, so an operator
   * sees "this game cannot be configured, and here is why" instead of a title that
   * mysteriously never appears.
   */
  schema:
    | { ok: true; fields: ConfigField[] }
    | { ok: false; error: string };
}

/**
 * Lists the titles a contest can currently be created on.
 *
 * ONLY TITLES BOTH SWITCHES AGREE ON. The provider must be enabled and the title must be
 * enabled by us and reported active. A picker showing everything and refusing on submit
 * would be a worse screen: the operator has already filled in six steps by then.
 */
export async function listContestableTitles(): Promise<ProviderContestOption[]> {
  await connectToDatabase();

  const providers = await GameProvider.find({ enabled: true }).lean<
    { providerKey: string; displayName: string }[]
  >();
  if (providers.length === 0) return [];

  const enabledKeys = providers.map((p) => p.providerKey);
  const nameByKey = new Map(providers.map((p) => [p.providerKey, p.displayName]));

  const titles = await ProviderGame.find({
    providerKey: { $in: enabledKeys },
    chartvoltEnabled: true,
    providerStatus: "active",
  })
    .sort({ displayName: 1 })
    .lean();

  return titles
    .filter((title) => Boolean(getProviderAdapter(title.providerKey)))
    .map((title) => {
      const parsed = parseConfigSchema(title.configSchema);
      return {
        providerKey: title.providerKey,
        providerName: nameByKey.get(title.providerKey) ?? title.providerKey,
        gameCode: title.gameCode,
        gameKey: title.gameKey,
        displayName: title.displayName,
        family: title.family,
        scoreDirection: title.scoreDirection,
        scoreType: title.scoreType,
        maxDurationSeconds: title.maxDurationSeconds,
        supportsCompetition: Boolean(title.supportsCompetition),
        supportsOneVsOne: Boolean(title.supportsOneVsOne),
        schema: parsed.ok
          ? { ok: true as const, fields: parsed.fields }
          : { ok: false as const, error: parsed.error },
      } as ProviderContestOption;
    });
}

/** Runs the checklist without creating anything, so the wizard can show it on review. */
export async function preflightProviderContest(
  input: Pick<
    CreateProviderContestInput,
    | "providerKey"
    | "gameCode"
    | "settings"
    | "minParticipants"
    | "playWindowStart"
    | "playWindowEnd"
    | "attemptsPolicy"
    | "attemptsAllowed"
    | "unresolvedRoundPolicy"
    | "resultGracePeriodSeconds"
    | "perRoundCostAcknowledged"
  >,
): Promise<PreflightResult> {
  await connectToDatabase();

  const [provider, title, settings] = await Promise.all([
    GameProvider.findOne({ providerKey: input.providerKey }).lean<{
      enabled: boolean;
    } | null>(),
    ProviderGame.findOne({
      providerKey: input.providerKey,
      gameCode: input.gameCode,
    }).lean(),
    WhiteLabel.findOne()
      .select("externalGamesEnabled")
      .lean<{ externalGamesEnabled?: boolean } | null>(),
  ]);

  if (!title) {
    return {
      ok: false,
      errors: ["That game is not in our catalogue. Sync the provider's catalogue first."],
      warnings: [],
    };
  }

  const parsed = parseConfigSchema(title.configSchema);
  if (!parsed.ok) {
    // Reason: an unusable schema cannot be validated against, so proceeding would save
    // settings nothing has checked. Fail closed - see `config-schema.ts`.
    return {
      ok: false,
      errors: [`This game's settings schema is not supported: ${parsed.error}`],
      warnings: [],
    };
  }

  return runPreflight({
    format: "competition",
    minParticipants: input.minParticipants,
    title: {
      displayName: title.displayName,
      providerStatus: title.providerStatus,
      supportsCompetition: Boolean(title.supportsCompetition),
      supportsOneVsOne: Boolean(title.supportsOneVsOne),
      maxDurationSeconds: title.maxDurationSeconds,
    },
    provider: {
      enabled: Boolean(provider?.enabled),
      adapterInstalled: Boolean(getProviderAdapter(input.providerKey)),
    },
    chartvoltEnabled: Boolean(title.chartvoltEnabled),
    externalGamesEnabled: Boolean(settings?.externalGamesEnabled),
    schemaFields: parsed.fields,
    settings: input.settings,
    playWindowStart: input.playWindowStart,
    playWindowEnd: input.playWindowEnd,
    resultGracePeriodSeconds: input.resultGracePeriodSeconds,
    attemptsPolicy: input.attemptsPolicy,
    attemptsAllowed: input.attemptsAllowed,
    unresolvedRoundPolicy: input.unresolvedRoundPolicy,
    perRoundCostAcknowledged: input.perRoundCostAcknowledged,
    // The catalogue already records this, so the sandbox check reads a real fact rather
    // than a placeholder. It is set when a round for this title last completed
    // successfully - which is exactly the "a live sandbox round succeeded recently"
    // condition on the chapter 03 checklist.
    lastSandboxRoundAt: title.lastSuccessfulRoundAt ?? null,
  });
}

export async function createProviderContest(
  input: CreateProviderContestInput,
): Promise<CreateProviderContestResult> {
  await connectToDatabase();

  const basicError = validateBasics(input);
  if (basicError) return { success: false, error: basicError };

  const preflight = await preflightProviderContest(input);
  if (!preflight.ok) {
    return {
      success: false,
      error: "This contest cannot be created yet.",
      errors: preflight.errors,
      warnings: preflight.warnings,
    };
  }

  const title = await ProviderGame.findOne({
    providerKey: input.providerKey,
    gameCode: input.gameCode,
  }).lean();
  if (!title) return { success: false, error: "That game is no longer in the catalogue." };

  const parsed = parseConfigSchema(title.configSchema);
  if (!parsed.ok) {
    return { success: false, error: `Unsupported settings schema: ${parsed.error}` };
  }

  // Re-validate and take the COERCED values, not the submitted ones. The pre-flight proved
  // they are acceptable; this is what turns "10" from a form into the number 10, and drops
  // any key the schema does not declare so nothing undeclared reaches the provider.
  const validated = validateConfigValues(parsed.fields, input.settings);
  if (!validated.ok) {
    return { success: false, error: "Settings failed validation.", errors: validated.errors };
  }

  const slug = await uniqueSlug(input.name);

  try {
    const competition = await Competition.create({
      name: input.name.trim(),
      description: input.description.trim(),
      slug,

      // The game label. Stamped explicitly rather than left to the schema default, because
      // the default is "trading" and a silently-mislabelled provider contest would be
      // settled by the trading module. `gameKey` is immutable once written.
      gameType: "provider",
      gameKey: title.gameKey,

      gameConfig: {
        providerKey: input.providerKey,
        gameCode: input.gameCode,
        settings: validated.values,
      },
      // One seed for the whole contest, so every player faces the same content. Generated
      // here and never regenerated - a second seed mid-contest would mean two players
      // ranked against each other played different games.
      contentSeed: randomBytes(16).toString("hex"),
      playWindowStart: input.playWindowStart,
      playWindowEnd: input.playWindowEnd,
      resultGracePeriodSeconds: input.resultGracePeriodSeconds,
      attemptsPolicy: input.attemptsPolicy,
      attemptsAllowed:
        input.attemptsPolicy === "single" ? undefined : input.attemptsAllowed,
      unresolvedRoundPolicy: input.unresolvedRoundPolicy,

      entryFee: input.entryFee,
      minParticipants: input.minParticipants,
      maxParticipants: input.maxParticipants,
      currentParticipants: 0,
      startTime: input.startTime,
      endTime: input.endTime,
      registrationDeadline: new Date(input.startTime),

      // DRAFT. Invisible to the player lobby, which queries only upcoming, active,
      // completed and cancelled. See the file header for why that is required, not cautious.
      status: "draft",

      competitionType: "time_based",
      prizePool: 0,
      platformFeePercentage: input.platformFeePercentage,
      prizeDistribution: input.prizeDistribution,

      createdBy: input.createdBy,
    });

    return {
      success: true,
      competitionId: String(competition._id),
      slug,
      warnings: preflight.warnings,
    };
  } catch (error) {
    console.error("❌ Failed to create provider contest:", error);
    return {
      success: false,
      error: "Something went wrong. Please contact support.",
    };
  }
}

function validateBasics(input: CreateProviderContestInput): string | null {
  if (!input.name?.trim()) return "A name is required.";
  if (!input.description?.trim()) return "A description is required.";
  if (!(input.entryFee >= 0)) return "The entry fee cannot be negative.";
  if (!(input.maxParticipants >= input.minParticipants)) {
    return "The maximum number of participants cannot be below the minimum.";
  }
  if (input.platformFeePercentage < 0 || input.platformFeePercentage > 100) {
    return "The platform fee must be between 0 and 100 percent.";
  }
  if (input.endTime.getTime() <= input.startTime.getTime()) {
    return "The contest must end after it starts.";
  }

  const total = input.prizeDistribution.reduce((sum, p) => sum + p.percentage, 0);
  // Reason: the same 0.01 tolerance the trading path uses, because a three-way even split
  // cannot total exactly 100 in decimal.
  if (Math.abs(total - 100) > 0.01) {
    return `The prize distribution must total 100 percent - it currently totals ${total}.`;
  }
  if (input.prizeDistribution.length === 0) {
    return "At least one prize rank is required.";
  }

  // The play window must sit inside the contest, or a player can be inside the contest and
  // outside the window with no explanation on screen.
  if (input.playWindowStart.getTime() < input.startTime.getTime()) {
    return "The play window cannot start before the contest does.";
  }
  if (input.playWindowEnd.getTime() > input.endTime.getTime()) {
    return "The play window cannot end after the contest does.";
  }

  return null;
}

async function uniqueSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "contest";

  let candidate = base;
  let suffix = 1;
  // Bounded, unlike an open `while (true)`: a pathological name should fail visibly rather
  // than spin against the database.
  while (suffix < 50) {
    const clash = await Competition.findOne({ slug: candidate }).select("_id").lean();
    if (!clash) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return `${base}-${Date.now()}`;
}
