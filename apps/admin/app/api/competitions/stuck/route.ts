import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import { cancelCompetitionAndRefund } from "@/lib/actions/trading/competition-cancel.actions";
import { auditLogService } from "@/lib/services/audit-log.service";
import { isCompetitionIdShaped } from "@/lib/utils/competition-id";
import {
  MAX_STUCK_BATCH,
  assessStuckCompetition,
  findStuckCompetitions,
} from "@/lib/services/competitions/stuck-competitions.service";

/**
 * GET  /api/competitions/stuck - list competitions that are definitely stuck, each with a
 *      per-seat refund preview checked against the wallet ledger.
 * POST /api/competitions/stuck - cancel and refund the selected ones.
 *
 * Both are guarded on the `competitions` section, the grant that owns the calling screen.
 *
 * Reason the POST re-assesses every id rather than trusting the list the browser holds: the
 * list can be minutes old, another operator or the start job may have acted since, and the
 * browser is not where a money decision may be taken. A contest that is no longer stuck, or no
 * longer verifies against its ledger, is refused with the reason and nothing is moved for it.
 */
export async function GET() {
  const guard = await guardSection("competitions");
  if (!guard.ok) return guard.response;

  try {
    const competitions = await findStuckCompetitions();
    return NextResponse.json({ success: true, competitions });
  } catch (error) {
    console.error("❌ Stuck-competition scan failed:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please contact support." },
      { status: 500 },
    );
  }
}

interface CancelOutcome {
  id: string;
  name?: string;
  ok: boolean;
  error?: string;
  refundedCount?: number;
  totalRefunded?: number;
  toGameMaster?: number;
}

export async function POST(request: NextRequest) {
  const guard = await guardSection("competitions");
  if (!guard.ok) return guard.response;

  let body: { ids?: unknown; reason?: unknown; confirm?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.confirm !== true) {
    return NextResponse.json({ error: "Confirmation is required" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 5) {
    return NextResponse.json({ error: "A cancellation reason is required" }, { status: 400 });
  }
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "Select at least one competition" }, { status: 400 });
  }
  const ids = [...new Set(body.ids.filter((v): v is string => typeof v === "string"))];
  if (ids.length !== body.ids.length || ids.some((id) => !isCompetitionIdShaped(id))) {
    return NextResponse.json({ error: "Invalid competition id in selection" }, { status: 400 });
  }
  if (ids.length > MAX_STUCK_BATCH) {
    return NextResponse.json(
      { error: `At most ${MAX_STUCK_BATCH} competitions per request` },
      { status: 400 },
    );
  }

  const results: CancelOutcome[] = [];
  for (const id of ids) {
    const before = await assessStuckCompetition(id);
    if (!before) {
      results.push({ id, ok: false, error: "No longer stuck - it was handled or it started." });
      continue;
    }
    if (!before.refundable) {
      results.push({ id, name: before.name, ok: false, error: before.issues.join(" ") });
      continue;
    }

    try {
      const outcome = await cancelCompetitionAndRefund(id, reason);
      // Read the ledger back: success means nothing is left unrefunded, not merely that the
      // action returned. A seat still outstanding here is reported as a failure.
      const after = await assessStuckCompetition(id);
      const outstanding = after?.seats.filter((s) => !s.alreadyRefunded).length ?? 0;
      const ok = outstanding === 0;

      await auditLogService.log({
        admin: guard.admin,
        action: "competition_cancelled",
        category: "competition",
        description: `Stuck competition cancelled and refunded: ${before.name} - Reason: ${reason}`,
        targetType: "competition",
        targetId: id,
        targetName: before.name,
        metadata: {
          source: "stuck_competition_sweep",
          stuckReason: before.reason,
          reason,
          planned: {
            totalToPlayers: before.totalToPlayers,
            totalToGameMaster: before.totalToGameMaster,
            seats: before.seats.map((s) => ({
              userId: s.userId,
              paid: s.paid,
              refundToPlayer: s.refundToPlayer,
              refundToGameMaster: s.refundToGameMaster,
            })),
          },
          result: {
            refundedCount: outcome.refundedCount,
            totalRefunded: outcome.totalRefunded,
            gameMasterRefund: outcome.gameMasterRefund ?? null,
            outstandingSeats: outstanding,
          },
        },
        status: ok ? "success" : "failed",
        ...(ok ? {} : { errorMessage: `${outstanding} seat(s) still unrefunded after cancel` }),
      });

      console.log(
        `🚫 Stuck sweep: ${before.name} (${id}) cancelled - ${outcome.refundedCount} refunded, ${outcome.totalRefunded} credits, outstanding ${outstanding}`,
      );
      results.push({
        id,
        name: before.name,
        ok,
        refundedCount: outcome.refundedCount,
        totalRefunded: outcome.totalRefunded,
        toGameMaster: before.totalToGameMaster,
        ...(ok ? {} : { error: `${outstanding} seat(s) still unrefunded - check the ledger` }),
      });
    } catch (error) {
      console.error(`❌ Stuck sweep failed for ${id}:`, error);
      await auditLogService.log({
        admin: guard.admin,
        action: "competition_cancelled",
        category: "competition",
        description: `Stuck competition cancel FAILED: ${before.name}`,
        targetType: "competition",
        targetId: id,
        targetName: before.name,
        metadata: { source: "stuck_competition_sweep", reason },
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      results.push({
        id,
        name: before.name,
        ok: false,
        error: "Cancel failed and was rolled back - nothing was moved.",
      });
    }
  }

  return NextResponse.json({
    success: results.every((r) => r.ok),
    results,
  });
}
