import { randomBytes } from "node:crypto";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import GameProvider from "@/database/models/games/game-provider.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import {
  parseConfigSchema,
  resolveAttemptSeconds,
  validateConfigValues,
} from "@/lib/services/games/config-schema";
import type { ConfigField } from "@/lib/services/games/config-schema";
import { resolveGameCategory } from "@/lib/services/games/game-categories";
import { runPreflight } from "@/lib/services/games/contest-preflight";
import { resolveContestEntryDeadline } from "@/lib/services/games/entry-deadline";
import {
  isPlayModeSupported,
  PLAY_MODE_COPY,
  playShapeRules,
  resolveContestPlayMode,
  resolvePlayMode,
  resolveSupportedPlayModes,
  type PlayMode,
} from "@/lib/services/games/play-shape";
import type { PreflightResult } from "@/lib/services/games/contest-preflight";
import type {
  AttemptsPolicy,
  RoundStartPolicy,
  UnresolvedRoundPolicy,
  UnscoredContestPolicy,
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
  /** Owner decision, 7 Sep 2026. See `UnscoredContestPolicy`. */
  unscoredContestPolicy?: UnscoredContestPolicy;
  /** Owner decision, 7 Sep 2026. See `RoundStartPolicy`. */
  roundStartPolicy?: RoundStartPolicy;
  /**
   * The shape THIS contest is run as, picked from the title's supported set (task document 11).
   *
   * Optional, and an absent value is not the same as a wrong one: it means "whatever this
   * title is", which is what every caller written before task 11 intends and what the wizard
   * sends for a title supporting one shape. An unsupported value is refused with the allowed
   * modes named; it is never quietly corrected, because a contest silently run as the other
   * shape closes entry at a different moment than the operator was shown.
   */
  playMode?: PlayMode;
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
  /**
   * The genre a human reads - "Puzzle", not the stored `puzzle` (task document 9).
   *
   * Resolved here rather than in the wizard for the same reason `playMode` is: the picker
   * must be handed the answer, not the raw field, or two screens end up with two spellings
   * of one genre and the operator cannot tell which is the catalogue's. `undefined` when the
   * title has no genre, so the badge is omitted rather than reading "Uncategorised".
   */
  category?: string;
  family: string;
  /**
   * The title's DEFAULT shape, resolved by `resolvePlayMode` and never the raw declaration -
   * see `listContestableTitles`. Still the answer for a title supporting one shape, and the
   * pre-selection for the picker when it supports two.
   */
  playMode: PlayMode;
  /**
   * Every shape this title may be run as, resolved (task document 11). Always contains
   * `playMode`, so a one-entry list and a title that has no choice are the same thing and the
   * wizard withholds the picker on `length < 2` rather than on a game-shaped test.
   */
  supportedPlayModes: PlayMode[];
  scoreDirection: string;
  scoreType: string;
  maxDurationSeconds?: number;
  supportsCompetition: boolean;
  supportsOneVsOne: boolean;
  supportsContentSeed: boolean;
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
        category: resolveGameCategory(title.category)?.label,
        family: title.family,
        // The RESOLVED shape, not the raw `playMode`. A `head_to_head` title is scheduled
        // whatever it declares, and the wizard must be shown the corrected answer or it offers
        // controls the create service is about to override.
        playMode: resolvePlayMode(title),
        // The set the wizard's per-contest picker is built from (task document 11). RESOLVED
        // for the same reason as `playMode` above: a `head_to_head` title supports scheduled
        // and nothing else however its supported list reads, and the picker must not offer a
        // choice the create service is about to refuse.
        supportedPlayModes: resolveSupportedPlayModes(title),
        scoreDirection: title.scoreDirection,
        scoreType: title.scoreType,
        maxDurationSeconds: title.maxDurationSeconds,
        supportsCompetition: Boolean(title.supportsCompetition),
        supportsOneVsOne: Boolean(title.supportsOneVsOne),
        supportsContentSeed: Boolean(title.supportsContentSeed),
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
    | "roundStartPolicy"
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
      supportsContentSeed: Boolean(title.supportsContentSeed),
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
    // Reason it is passed rather than left to the checker's default: the same short contest
    // is a hard refusal under one policy and a warning under the other, so omitting it would
    // refuse exactly the contests the permissive setting exists to allow.
    roundStartPolicy: input.roundStartPolicy,
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

  // Resolved once, because it decides two things that must never disagree: the rule stored on
  // the contest, and how much of the play window the entry deadline holds back. Two copies of
  // the fallback is how a contest ends up storing one policy and closing entry under the other.
  //
  // The fallback used to be `until_window_closes`, matching a wizard that defaulted to the
  // permissive option. The owner reversed that on 8 September 2026, so it now agrees with both
  // the wizard and the schema again.
  //
  // A SIMULTANEOUS title then overrides both the operator's choice and that fallback. Forcing
  // the stored value here rather than teaching the runtime gates about play modes is the whole
  // design: `roundFitsInWindow`, `RoundPreflight`'s `tooLateToStart` and `fullRoundCutoffMs`
  // all read the stored policy already, so writing the right value means not one of them needs
  // a second branch - and a branch added to each would be four places to forget. The operator
  // is not being overruled behind their back either; the wizard withholds the control for a
  // scheduled title and says why, from this same rule.
  // TASK 11: the operator may pick the shape, but only from the set the TITLE declares.
  //
  // This is what makes a per-contest choice safe, and it is the reason `play-shape.ts`'s
  // "never from caller input" rule could be amended rather than simply broken: the answer is
  // still decided by a stored value, because an unsupported request is refused here. Without
  // this check a caller could declare a race staggered and keep entry open after the gun,
  // which is precisely the failure the old rule existed to prevent.
  //
  // It must sit BEFORE the shape is resolved and before the create, so a refusal leaves no
  // contest and no slug reserved.
  //
  // An omitted mode is not an error - it means "whatever this title is", which is what every
  // caller written before task 11 intends and what the wizard sends when a title supports one
  // shape. Refusing it would break the API for the sake of a field with a correct default.
  if (input.playMode !== undefined && !isPlayModeSupported(title, input.playMode)) {
    const allowed = resolveSupportedPlayModes(title)
      .map((mode) => PLAY_MODE_COPY.get(mode)?.label ?? mode)
      .join(" or ");
    return {
      success: false,
      // Naming what IS allowed, not just what is not. An operator told only that their choice
      // is unsupported has to go and read another screen to find out what to pick.
      error: `${title.displayName} cannot be run that way. It supports: ${allowed}.`,
    };
  }

  // The contest's own shape, which from task 11 onwards is not necessarily the title's. An
  // absent choice resolves to the title's default, so nothing about a single-shape title
  // changed.
  const playMode = resolveContestPlayMode(input.playMode, title);
  const shape = playShapeRules(playMode);
  const roundStartPolicy =
    shape.forcedRoundStartPolicy ?? input.roundStartPolicy ?? "reserve_full_round";
  const attemptsPolicy = shape.forcedAttemptsPolicy ?? input.attemptsPolicy;
  const attemptSeconds = resolveAttemptSeconds(
    parsed.fields,
    validated.values,
    title.maxDurationSeconds,
  );

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
      // The shape THIS contest is run as, stored rather than re-derived (task document 11).
      // Written unconditionally, including for a single-shape title: an absent value falls
      // back to the title, and the title's answer is exactly what changes when its supported
      // set is edited later. Storing it is what stops an edit re-forcing the attempts policy
      // and the entry deadline under people who have already paid.
      playMode,
      playWindowStart: input.playWindowStart,
      playWindowEnd: input.playWindowEnd,
      resultGracePeriodSeconds: input.resultGracePeriodSeconds,
      attemptsPolicy,
      attemptsAllowed: attemptsPolicy === "single" ? undefined : input.attemptsAllowed,
      unresolvedRoundPolicy: input.unresolvedRoundPolicy,
      // Reason for the fallback rather than leaving it absent: the schema default is
      // `unclaimed_pool`, so omitting it on a NEW provider contest would silently give the
      // operator the trading answer while the wizard showed them the refund selected.
      unscoredContestPolicy: input.unscoredContestPolicy ?? "refund_entry_fees",
      // The fallback used to be `until_window_closes`, to match a wizard that defaulted to the
      // permissive option. The owner reversed that on 8 September 2026, so the fallback now
      // agrees with both the wizard and the schema again. Kept explicit rather than dropped:
      // a caller omitting it should get the same contest the wizard would have produced, and
      // reading that off the schema means reading a second file.
      roundStartPolicy,

      entryFee: input.entryFee,
      minParticipants: input.minParticipants,
      maxParticipants: input.maxParticipants,
      currentParticipants: 0,
      startTime: input.startTime,
      endTime: input.endTime,
      // Entry stays open for as long as playing is still possible, which is the owner's
      // 8 September 2026 instruction read honestly - see `resolveContestEntryDeadline`. It was
      // `startTime`, so a player one minute late could not join a contest running for an hour.
      registrationDeadline: resolveContestEntryDeadline({
        playWindowEnd: input.playWindowEnd,
        attemptSeconds,
        roundStartPolicy,
        startTime: input.startTime,
        entryClosesAtStart: shape.entryClosesAtStart,
      }),

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
