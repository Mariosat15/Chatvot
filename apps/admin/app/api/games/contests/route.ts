import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { auditLogService } from "@/lib/services/audit-log.service";
import {
  createProviderContest,
  listContestableTitles,
  preflightProviderContest,
} from "@/lib/services/game-providers/provider-contest.service";
import type {
  AttemptsPolicy,
  UnresolvedRoundPolicy,
} from "@/lib/services/games/round-types";

/**
 * GET  /api/games/contests - the titles a contest can be created on, with their settings schema
 * POST /api/games/contests - run the pre-flight checklist, or create the contest
 *
 * Guarded on `competitions`, not on `game-providers`. Creating a contest is contest
 * administration; an employee who runs competitions should be able to do it without also
 * holding the grant that reaches provider API credentials. Splitting the two is the point
 * of per-section grants.
 */

export const dynamic = "force-dynamic";

interface ContestBody {
  action?: "preflight" | "create";
  name?: string;
  description?: string;
  providerKey?: string;
  gameCode?: string;
  settings?: Record<string, unknown>;
  entryFee?: number;
  minParticipants?: number;
  maxParticipants?: number;
  platformFeePercentage?: number;
  prizeDistribution?: { rank: number; percentage: number }[];
  startTime?: string;
  endTime?: string;
  playWindowStart?: string;
  playWindowEnd?: string;
  attemptsPolicy?: AttemptsPolicy;
  attemptsAllowed?: number;
  unresolvedRoundPolicy?: UnresolvedRoundPolicy;
  resultGracePeriodSeconds?: number;
  perRoundCostAcknowledged?: boolean;
}

export async function GET() {
  const guard = await guardSection("competitions");
  if (!guard.ok) return guard.response;

  try {
    const titles = await listContestableTitles();
    return NextResponse.json({ success: true, titles });
  } catch (error) {
    console.error("❌ Failed to list contestable titles:", error);
    return NextResponse.json(
      { error: "Failed to load the game list." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = await guardSection("competitions");
  if (!guard.ok) return guard.response;

  try {
    const body = (await request.json()) as ContestBody;

    const dates = parseDates(body);
    if ("error" in dates) {
      return NextResponse.json({ error: dates.error }, { status: 400 });
    }

    if (!body.providerKey || !body.gameCode) {
      return NextResponse.json(
        { error: "A provider and a game are required." },
        { status: 400 },
      );
    }

    const shared = {
      providerKey: body.providerKey,
      gameCode: body.gameCode,
      settings: body.settings ?? {},
      minParticipants: body.minParticipants ?? 2,
      playWindowStart: dates.playWindowStart,
      playWindowEnd: dates.playWindowEnd,
      attemptsPolicy: body.attemptsPolicy ?? "single",
      attemptsAllowed: body.attemptsAllowed,
      unresolvedRoundPolicy: body.unresolvedRoundPolicy ?? "score_zero",
      resultGracePeriodSeconds: body.resultGracePeriodSeconds ?? 600,
      perRoundCostAcknowledged: body.perRoundCostAcknowledged,
    };

    if (body.action === "preflight") {
      // Returns 200 even when the checklist refuses. The refusal is the requested answer,
      // not a failed request, and a 4xx here would make the wizard's review step look
      // broken rather than informative.
      const result = await preflightProviderContest(shared);
      return NextResponse.json({ success: true, ...result });
    }

    const result = await createProviderContest({
      ...shared,
      name: body.name ?? "",
      description: body.description ?? "",
      entryFee: body.entryFee ?? 0,
      maxParticipants: body.maxParticipants ?? 0,
      platformFeePercentage: body.platformFeePercentage ?? 0,
      prizeDistribution: body.prizeDistribution ?? [],
      startTime: dates.startTime,
      endTime: dates.endTime,
      createdBy: guard.admin.id,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, errors: result.errors, warnings: result.warnings },
        { status: 400 },
      );
    }

    await auditLogService.log({
      admin: guard.admin,
      action: "competition_created",
      category: "competition",
      description: `Provider contest "${body.name}" created as a draft on ${body.providerKey}/${body.gameCode}`,
      targetType: "competition",
      targetId: result.competitionId,
      targetName: body.name,
      newValue: {
        gameType: "provider",
        providerKey: body.providerKey,
        gameCode: body.gameCode,
        status: "draft",
      },
    });

    // `result` already carries `success: true`, the id, the slug and any warnings. Adding
    // a second `success` key here made it the one that got overwritten.
    return NextResponse.json(result);
  } catch (error) {
    console.error("❌ Failed to create provider contest:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}

type ParsedDates =
  | {
      startTime: Date;
      endTime: Date;
      playWindowStart: Date;
      playWindowEnd: Date;
    }
  | { error: string };

/**
 * Parses the four dates, refusing anything unparseable.
 *
 * Reason for checking each one rather than trusting `new Date()`: an invalid string yields
 * an Invalid Date, whose `getTime()` is NaN, and every comparison against NaN is false. So
 * a typo would sail through the ordering checks in the service and be stored as `null`.
 */
function parseDates(body: ContestBody): ParsedDates {
  const startTime = parseOne(body.startTime, "contest start");
  if (typeof startTime === "string") return { error: startTime };

  const endTime = parseOne(body.endTime, "contest end");
  if (typeof endTime === "string") return { error: endTime };

  const playWindowStart = parseOne(body.playWindowStart, "play window start");
  if (typeof playWindowStart === "string") return { error: playWindowStart };

  const playWindowEnd = parseOne(body.playWindowEnd, "play window end");
  if (typeof playWindowEnd === "string") return { error: playWindowEnd };

  return { startTime, endTime, playWindowStart, playWindowEnd };
}

/** Returns the parsed date, or the message explaining why it could not be parsed. */
function parseOne(raw: string | undefined, label: string): Date | string {
  if (typeof raw !== "string" || raw.trim() === "") {
    return `The ${label} time is required.`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return `The ${label} time is not a valid date.`;
  }
  return date;
}
