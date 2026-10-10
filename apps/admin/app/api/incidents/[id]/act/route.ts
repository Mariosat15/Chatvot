import { NextRequest, NextResponse } from "next/server";
import { guardSection } from "@/lib/admin/section-route-guard";
import {
  INCIDENT_ACTIONS,
  MIN_REASON_LENGTH,
} from "@/lib/admin/incident-actions";
import {
  performIncidentAction,
  readIncidentActions,
  type IncidentActionPayload,
} from "@/lib/services/incidents/incident-act.service";

/**
 * GET lists the actions the stored subject admits. POST carries one out.
 *
 * The incidents grant is not enough to move money. The catalogue names the section that
 * owns the subject, and this route requires that grant as well, before anything is written.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardSection("incidents");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const result = await readIncidentActions(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    subjectId: result.subjectId,
    subject: result.subject,
    actions: result.actions,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const incidents = await guardSection("incidents");
  if (!incidents.ok) return incidents.response;

  let body: {
    actionId?: unknown;
    reason?: unknown;
    roundIds?: unknown;
    adjustments?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const actionId = typeof body.actionId === "string" ? body.actionId : "";
  const action = INCIDENT_ACTIONS.get(actionId);
  if (!action) {
    return NextResponse.json(
      { error: `Unknown action "${actionId}".` },
      { status: 400 },
    );
  }

  const subjectGuard = await guardSection(action.section);
  if (!subjectGuard.ok) return subjectGuard.response;

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < MIN_REASON_LENGTH) {
    return NextResponse.json(
      {
        error: `A reason of at least ${MIN_REASON_LENGTH} characters is required.`,
      },
      { status: 400 },
    );
  }

  const payload: IncidentActionPayload = {
    roundIds: Array.isArray(body.roundIds)
      ? body.roundIds.filter((id): id is string => typeof id === "string")
      : undefined,
    adjustments: Array.isArray(body.adjustments)
      ? body.adjustments.filter(
          (row): row is NonNullable<IncidentActionPayload["adjustments"]>[number] =>
            Boolean(row) && typeof row === "object",
        )
      : undefined,
  };

  const { id } = await params;
  const result = await performIncidentAction({
    incidentId: id,
    actionId,
    reason,
    actor: { id: incidents.admin.id, email: incidents.admin.email },
    payload,
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json({
    success: true,
    detail: result.detail,
    voidedRounds: result.voidedRounds,
    closedPositions: result.closedPositions,
  });
}
