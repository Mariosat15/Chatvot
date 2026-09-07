import { NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import { connectToDatabase } from "@/database/mongoose";
import Competition from "@/database/models/trading/competition.model";
import ProviderGame from "@/database/models/games/provider-game.model";
import { parseConfigSchema } from "@/lib/services/games/config-schema";
import { hasProviderGameLabel } from "@/lib/admin/contest-game-label";
import {
  UNSCORED_CONTEST_POLICIES,
  type UnscoredContestPolicy,
} from "@/lib/services/games/round-types";
import {
  editProviderContest,
  type EditProviderContestInput,
} from "@/lib/services/game-providers/provider-contest-edit.service";

/**
 * Read and edit one provider-game contest.
 *
 * SEPARATE FROM `PUT /api/competitions/[id]` on purpose, and not merely for tidiness. That
 * route's body shape is the 14 fields the trading editor submits; this one's is the provider
 * settings, play window and attempts policy. One route serving both would have to dispatch
 * on the stored game type and then apply one of two disjoint allow-lists, which is two
 * routes wearing one URL. Keeping them apart also means the trading route can refuse a
 * provider contest outright, which is the server-side half of the withheld Edit button.
 *
 * Guarded on `competitions`, matching create and publish: running contests and reaching
 * provider API credentials are different jobs, and the per-section grant is the only thing
 * keeping them apart.
 */

export const dynamic = "force-dynamic";

/** Everything the edit form needs: the stored contest plus the title's live schema. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const guard = await guardSection("competitions");
  if (!guard.ok) return guard.response;

  try {
    const { competitionId } = await params;
    await connectToDatabase();

    // The generic names only the three paths this handler reads, all checked against
    // `competition.model.ts` - `gameType`, `gameConfig.providerKey` and
    // `gameConfig.gameCode`. Worth stating because an explicitly-typed `.lean<>()` is
    // exactly where a field that does not exist looks real: the compiler checks this
    // hand-written type, never the schema.
    const contest = await Competition.findById(competitionId).lean<
      | (Record<string, unknown> & {
          gameType?: string;
          gameConfig?: { providerKey?: string; gameCode?: string };
        })
      | null
    >();
    if (!contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }
    if (!hasProviderGameLabel(contest)) {
      return NextResponse.json(
        { error: "That is not a provider-game contest." },
        { status: 400 },
      );
    }

    // The schema is fetched fresh rather than remembered from creation day. A provider can
    // change a title's `configSchema` between sync runs, and the form must render the
    // constraints the save will actually be validated against - otherwise an operator fills
    // in a field that no longer exists and is refused with no way to see why.
    const providerKey = contest.gameConfig?.providerKey;
    const gameCode = contest.gameConfig?.gameCode;
    let schema: { ok: true; fields: unknown[] } | { ok: false; error: string } = {
      ok: false,
      error: "This contest has no provider or game recorded.",
    };
    let titleName: string | undefined;
    let scoreDirection: string | undefined;

    if (providerKey && gameCode) {
      const title = await ProviderGame.findOne({ providerKey, gameCode }).lean();
      if (!title) {
        schema = {
          ok: false,
          error:
            "That game is no longer in the catalogue. Sync the provider to restore it.",
        };
      } else {
        titleName = title.displayName;
        scoreDirection = title.scoreDirection;
        const parsed = parseConfigSchema(title.configSchema);
        schema = parsed.ok
          ? { ok: true, fields: parsed.fields }
          : { ok: false, error: parsed.error };
      }
    }

    return NextResponse.json({
      success: true,
      contest: JSON.parse(JSON.stringify(contest)),
      schema,
      titleName,
      scoreDirection,
    });
  } catch (error) {
    console.error("❌ Failed to load provider contest:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const guard = await guardSection("competitions");
  if (!guard.ok) return guard.response;

  try {
    const { competitionId } = await params;
    const body = await request.json();

    const parsed = parseEditBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await editProviderContest(competitionId, parsed.input);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error, errors: result.errors, warnings: result.warnings },
        { status: 400 },
      );
    }

    await auditLogService.log({
      admin: guard.admin,
      action: "competition_updated",
      category: "competition",
      description: `Provider contest edited: ${Object.keys(parsed.input).join(", ")}`,
      targetType: "competition",
      targetId: competitionId,
      newValue: parsed.input,
    });

    return NextResponse.json({ success: true, warnings: result.warnings });
  } catch (error) {
    console.error("❌ Failed to edit provider contest:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}

type ParseOutcome =
  | { ok: true; input: EditProviderContestInput }
  | { ok: false; error: string };

/**
 * Turns a JSON body into the service's input.
 *
 * ONLY DECLARED KEYS ARE READ, so an unexpected field is ignored here rather than refused -
 * the opposite of the trading route's allow-list, and the difference is deliberate. That
 * route had to protect a blind `Object.assign` against a document with sixty writable
 * fields. Here every key is picked out by name and the service then decides whether it is
 * frozen, so an unknown key cannot reach the document however it is spelled.
 *
 * An unparseable date FAILS CLOSED with the field named. Coercing `new Date("soon")` gives
 * `Invalid Date`, which Mongoose stores as null on a non-required field - so a typo in a
 * play window would silently clear it, and an absent play window is a contest players can
 * enter and never play.
 */
function parseEditBody(body: unknown): ParseOutcome {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "The update must be an object." };
  }
  const raw = body as Record<string, unknown>;
  const input: EditProviderContestInput = {};

  if (typeof raw.name === "string") input.name = raw.name;
  if (typeof raw.description === "string") input.description = raw.description;

  if (raw.settings !== undefined) {
    if (
      !raw.settings ||
      typeof raw.settings !== "object" ||
      Array.isArray(raw.settings)
    ) {
      return { ok: false, error: "Settings must be an object." };
    }
    input.settings = raw.settings as Record<string, unknown>;
  }

  for (const key of [
    "entryFee",
    "minParticipants",
    "maxParticipants",
    "platformFeePercentage",
    "attemptsAllowed",
    "resultGracePeriodSeconds",
  ] as const) {
    // Reason: `key` comes from the `as const` literal list above, never from the request, so
    // neither read nor write can be steered by a caller. The rule cannot see that the loop
    // variable is a closed set of literals. Disabled per line rather than per file, so a
    // genuinely request-derived key added later still trips it.
    // eslint-disable-next-line security/detect-object-injection
    const value = raw[key];
    if (value === undefined) continue;
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      return { ok: false, error: `"${key}" must be a number.` };
    }
    // eslint-disable-next-line security/detect-object-injection
    input[key] = numeric;
  }

  for (const key of [
    "startTime",
    "endTime",
    "playWindowStart",
    "playWindowEnd",
  ] as const) {
    // eslint-disable-next-line security/detect-object-injection -- literal key, see above
    const value = raw[key];
    if (value === undefined) continue;
    if (typeof value !== "string" && !(value instanceof Date)) {
      return { ok: false, error: `"${key}" must be a date.` };
    }
    const date = new Date(value as string);
    if (Number.isNaN(date.getTime())) {
      return { ok: false, error: `"${key}" is not a valid date.` };
    }
    // eslint-disable-next-line security/detect-object-injection -- literal key, see above
    input[key] = date;
  }

  if (raw.attemptsPolicy !== undefined) {
    const allowed = ["single", "best_of_n", "sum_of_n"];
    if (
      typeof raw.attemptsPolicy !== "string" ||
      !allowed.includes(raw.attemptsPolicy)
    ) {
      return { ok: false, error: "That attempts policy is not recognised." };
    }
    input.attemptsPolicy =
      raw.attemptsPolicy as EditProviderContestInput["attemptsPolicy"];
  }

  if (raw.unresolvedRoundPolicy !== undefined) {
    const allowed = ["score_zero", "exclude", "hold_and_alert"];
    if (
      typeof raw.unresolvedRoundPolicy !== "string" ||
      !allowed.includes(raw.unresolvedRoundPolicy)
    ) {
      return {
        ok: false,
        error: "That unresolved-round policy is not recognised.",
      };
    }
    input.unresolvedRoundPolicy =
      raw.unresolvedRoundPolicy as EditProviderContestInput["unresolvedRoundPolicy"];
  }

  if (raw.unscoredContestPolicy !== undefined) {
    // REFUSED rather than coerced, unlike the create route's fallback. An edit is a change to
    // a contest that already has a valid policy, so an unrecognised value means the client
    // and the server disagree - and silently substituting a default would move a prize pool
    // to a destination the operator did not pick while reporting the edit as saved.
    if (
      typeof raw.unscoredContestPolicy !== "string" ||
      !UNSCORED_CONTEST_POLICIES.includes(
        raw.unscoredContestPolicy as UnscoredContestPolicy,
      )
    ) {
      return {
        ok: false,
        error: "That no-score policy is not recognised.",
      };
    }
    input.unscoredContestPolicy =
      raw.unscoredContestPolicy as EditProviderContestInput["unscoredContestPolicy"];
  }

  if (Array.isArray(raw.prizeDistribution)) {
    const distribution: { rank: number; percentage: number }[] = [];
    for (const entry of raw.prizeDistribution) {
      if (!entry || typeof entry !== "object") {
        return { ok: false, error: "Each prize entry must be an object." };
      }
      const rank = Number((entry as Record<string, unknown>).rank);
      const percentage = Number(
        (entry as Record<string, unknown>).percentage,
      );
      if (!Number.isFinite(rank) || !Number.isFinite(percentage)) {
        return {
          ok: false,
          error: "Each prize entry needs a numeric rank and percentage.",
        };
      }
      distribution.push({ rank, percentage });
    }
    input.prizeDistribution = distribution;
  } else if (raw.prizeDistribution !== undefined) {
    return { ok: false, error: "The prize distribution must be a list." };
  }

  if (typeof raw.perRoundCostAcknowledged === "boolean") {
    input.perRoundCostAcknowledged = raw.perRoundCostAcknowledged;
  }

  return { ok: true, input };
}
