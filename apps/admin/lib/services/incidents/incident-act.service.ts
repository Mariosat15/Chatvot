/**
 * Carry out one catalogue action against the subject stored on the incident.
 *
 * Applicability is read from the stored document, never from the caller. The route
 * has already required both grants. This file does the read, the delegation, and
 * the log line — including when the action is refused, so a refusal is attributable.
 */

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import Incident from "@/database/models/incident.model";
import Competition from "@/database/models/trading/competition.model";
import Challenge from "@/database/models/trading/challenge.model";
import GameRound from "@/database/models/games/game-round.model";
import { hasProviderGameLabel } from "@/lib/admin/contest-game-label";
import {
  explainInapplicable,
  actionsForSubject,
  resolutionActionFor,
  roundNeedsDecision,
  isIncidentClosed,
  INCIDENT_ACTIONS,
  type IncidentSubjectFacts,
  type IncidentSubjectKind,
} from "@/lib/admin/incident-actions";
import {
  pauseContest,
  resumeContest,
} from "@/lib/services/games/contest-pause.service";
import {
  cancelCompetitionAndRefund,
  emergencyCancelActiveCompetition,
} from "@/lib/actions/trading/competition-cancel.actions";
import { resettleProviderCompetition } from "@/lib/services/settlement/provider-resettle.service";
import { resolveRoundManually } from "@/lib/services/games/round-resolution.service";
import { POST as adjustResultsPost } from "@/app/api/competitions/[id]/adjust-results/route";
import { POST as challengePost } from "@/app/api/challenges/route";

export interface IncidentActor {
  id: string;
  email: string;
}

export interface IncidentActionPayload {
  roundIds?: string[];
  adjustments?: Array<{
    participantId?: string;
    newRank?: number;
    newPrize?: number;
    reason?: string;
  }>;
}

interface StoredSubject {
  kind: IncidentSubjectKind;
  id: string;
  facts: IncidentSubjectFacts;
  activityNoun: "Play" | "Trading";
}

function kindFromLegacy(incident: {
  subjectType?: string;
  roundId?: string;
  challengeId?: string;
  competitionId?: string;
}): IncidentSubjectKind {
  if (
    incident.subjectType === "competition" ||
    incident.subjectType === "challenge" ||
    incident.subjectType === "round" ||
    incident.subjectType === "system"
  ) {
    return incident.subjectType;
  }
  if (incident.roundId) return "round";
  if (incident.challengeId) return "challenge";
  if (incident.competitionId) return "competition";
  return "system";
}

export async function loadIncidentSubject(
  incident: {
    subjectType?: string;
    roundId?: string;
    challengeId?: string;
    competitionId?: string;
  },
): Promise<{ subject: StoredSubject | null; error?: string }> {
  await connectToDatabase();
  const kind = kindFromLegacy(incident);

  if (kind === "system") {
    return {
      subject: {
        kind,
        id: "system",
        activityNoun: "Trading",
        facts: {
          kind,
          status: "open",
          isPaused: false,
          isProviderGame: false,
          hasFinalLeaderboard: false,
          needsDecision: false,
        },
      },
    };
  }

  if (kind === "competition") {
    if (!incident.competitionId) {
      return { subject: null, error: "This incident names no contest." };
    }
    const contest = await Competition.findById(incident.competitionId)
      .select("name status gameType isPaused finalLeaderboard")
      .lean<{
        status?: string;
        gameType?: string;
        isPaused?: boolean;
        finalLeaderboard?: unknown[];
      } | null>();
    if (!contest) {
      return { subject: null, error: "The contest on this incident no longer exists." };
    }
    const isProviderGame = hasProviderGameLabel(contest);
    return {
      subject: {
        kind,
        id: incident.competitionId,
        activityNoun: isProviderGame ? "Play" : "Trading",
        facts: {
          kind,
          status: contest.status ?? "",
          isPaused: contest.isPaused === true,
          isProviderGame,
          hasFinalLeaderboard:
            Array.isArray(contest.finalLeaderboard) &&
            contest.finalLeaderboard.length > 0,
          needsDecision: false,
        },
      },
    };
  }

  if (kind === "challenge") {
    if (!incident.challengeId) {
      return { subject: null, error: "This incident names no challenge." };
    }
    const challenge = await Challenge.findById(incident.challengeId)
      .select("status")
      .lean<{ status?: string } | null>();
    if (!challenge) {
      return { subject: null, error: "The challenge on this incident no longer exists." };
    }
    return {
      subject: {
        kind,
        id: incident.challengeId,
        activityNoun: "Trading",
        facts: {
          kind,
          status: challenge.status ?? "",
          isPaused: false,
          isProviderGame: false,
          hasFinalLeaderboard: false,
          needsDecision: false,
        },
      },
    };
  }

  if (!incident.roundId) {
    return { subject: null, error: "This incident names no round." };
  }
  const round = await GameRound.findOne({ roundId: incident.roundId })
    .select("status expiresAt")
    .lean<{ status?: string; expiresAt?: Date } | null>();
  if (!round) {
    return { subject: null, error: "The round on this incident no longer exists." };
  }
  return {
    subject: {
      kind,
      id: incident.roundId,
      activityNoun: "Play",
      facts: {
        kind,
        status: round.status ?? "",
        isPaused: false,
        isProviderGame: true,
        hasFinalLeaderboard: false,
        needsDecision: roundNeedsDecision(round.status ?? "", round.expiresAt),
      },
    },
  };
}

async function postJson(
  handler: (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => Promise<NextResponse>,
  path: string,
  body: unknown,
  id: string,
): Promise<{ ok: boolean; error?: string; detail?: string }> {
  const request = new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = await handler(request, { params: Promise.resolve({ id }) });
  const json = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    success?: boolean;
  };
  if (!response.ok || json.success === false) {
    return { ok: false, error: json.error || json.message || "The action was refused." };
  }
  return { ok: true, detail: json.message };
}

async function delegate(
  actionId: string,
  subject: StoredSubject,
  incidentId: string,
  reason: string,
  actor: IncidentActor,
  payload: IncidentActionPayload,
): Promise<{
  ok: boolean;
  error?: string;
  detail?: string;
  voidedRounds?: number;
  closedPositions?: number;
}> {
  if (actionId === "pause_contest") {
    const result = await pauseContest({
      competitionId: subject.id,
      reason,
      pausedBy: actor.id,
      activityNoun: subject.activityNoun,
    });
    if (!result.success) return { ok: false, error: result.error };
    return { ok: true, detail: result.name };
  }

  if (actionId === "resume_contest") {
    const result = await resumeContest({
      competitionId: subject.id,
      resumedBy: actor.id,
      activityNoun: subject.activityNoun,
    });
    if (!result.success) return { ok: false, error: result.error };
    return { ok: true, detail: result.name };
  }

  if (actionId === "emergency_cancel") {
    const result = await emergencyCancelActiveCompetition(
      subject.id,
      reason,
      actor.id,
    );
    if (!result.success) return { ok: false, error: result.message };
    const closed = result.closedPositions ?? 0;
    const voided = result.voidedRounds ?? 0;
    const detail = subject.facts.isProviderGame
      ? `${voided} rounds voided, ${result.refundedCount ?? 0} refunded`
      : `${closed} positions closed, ${result.refundedCount ?? 0} refunded`;
    return { ok: true, detail, voidedRounds: voided, closedPositions: closed };
  }

  if (actionId === "cancel_upcoming") {
    await cancelCompetitionAndRefund(subject.id, reason);
    return { ok: true, detail: "Cancelled and refunded" };
  }

  if (actionId === "re_settle") {
    const roundIds = (payload.roundIds ?? []).map((id) => id.trim()).filter(Boolean);
    const result = await resettleProviderCompetition({
      competitionId: subject.id,
      roundIds,
      incidentId,
      reason,
      adminId: actor.id,
      adminEmail: actor.email,
    });
    return result.success
      ? { ok: true, detail: "Re-settled" }
      : { ok: false, error: result.error ?? "Re-settle refused." };
  }

  if (actionId === "adjust_results") {
    return postJson(
      adjustResultsPost,
      `/api/competitions/${subject.id}/adjust-results`,
      {
        incidentId,
        adjustments: payload.adjustments ?? [],
        globalReason: reason,
      },
      subject.id,
    );
  }

  const resolution = resolutionActionFor(actionId);
  if (resolution) {
    const result = await resolveRoundManually({
      roundId: subject.id,
      action: resolution,
      reason,
      adminEmail: actor.email,
    });
    return result.success
      ? { ok: true, detail: result.status }
      : { ok: false, error: result.error };
  }

  if (actionId === "cancel_challenge") {
    const request = new NextRequest("http://localhost/api/challenges", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "cancel",
        challengeId: subject.id,
        reason,
      }),
    });
    const response = await challengePost(request);
    const json = (await response.json().catch(() => ({}))) as {
      error?: string;
      success?: boolean;
    };
    if (!response.ok || json.success === false) {
      return { ok: false, error: json.error || "The challenge was not cancelled." };
    }
    return { ok: true, detail: "Challenge cancelled" };
  }

  return { ok: false, error: `No handler for ${actionId}.` };
}

export async function readIncidentActions(incidentId: string): Promise<
  | {
      ok: true;
      subject: IncidentSubjectFacts;
      subjectId: string;
      actions: ReturnType<typeof actionsForSubject>;
    }
  | { ok: false; status: number; error: string }
> {
  await connectToDatabase();
  const incident = await Incident.findById(incidentId).lean<{
    status?: string;
    subjectType?: string;
    roundId?: string;
    challengeId?: string;
    competitionId?: string;
  } | null>();
  if (!incident) return { ok: false, status: 404, error: "Incident not found." };
  const loaded = await loadIncidentSubject(incident);
  if (!loaded.subject) {
    return { ok: false, status: 400, error: loaded.error || "No subject." };
  }
  // Reason: a closed incident must offer no catalogue, even if the subject would
  // still admit an action (e.g. pause after a prior refund resolution).
  const actions = isIncidentClosed(incident.status ?? "")
    ? []
    : actionsForSubject(loaded.subject.facts);
  return {
    ok: true,
    subject: loaded.subject.facts,
    subjectId: loaded.subject.id,
    actions,
  };
}

export async function performIncidentAction(input: {
  incidentId: string;
  actionId: string;
  reason: string;
  actor: IncidentActor;
  payload: IncidentActionPayload;
}): Promise<{
  ok: boolean;
  status: number;
  error?: string;
  detail?: string;
  voidedRounds?: number;
  closedPositions?: number;
}> {
  await connectToDatabase();
  const incident = await Incident.findById(input.incidentId);
  if (!incident) return { ok: false, status: 404, error: "Incident not found." };

  // Reason: UI can hide the button; the server must still refuse a second cancel
  // or re-settle against a closed record.
  if (isIncidentClosed(String(incident.status ?? ""))) {
    return {
      ok: false,
      status: 409,
      error: "This incident is closed. Raise a new one if further action is needed.",
    };
  }

  const loaded = await loadIncidentSubject(incident);
  if (!loaded.subject) {
    return { ok: false, status: 400, error: loaded.error || "No subject." };
  }

  const actionDef = INCIDENT_ACTIONS.get(input.actionId);
  const applicable = actionsForSubject(loaded.subject.facts).some(
    (action) => action.id === input.actionId,
  );
  const outcome = applicable ? "applied" : "refused";
  let detail = applicable
    ? ""
    : explainInapplicable(input.actionId, loaded.subject.facts);
  let finalOutcome: "applied" | "refused" | "failed" = outcome;
  let voidedRounds: number | undefined;
  let closedPositions: number | undefined;

  if (applicable) {
    try {
      const result = await delegate(
        input.actionId,
        loaded.subject,
        input.incidentId,
        input.reason,
        input.actor,
        input.payload,
      );
      if (!result.ok) {
        finalOutcome = "refused";
        detail = result.error || "Refused.";
      } else {
        detail = result.detail || "Applied.";
        voidedRounds = result.voidedRounds;
        closedPositions = result.closedPositions;
      }
    } catch (error) {
      finalOutcome = "failed";
      detail = error instanceof Error ? error.message : "The action failed.";
    }
  }

  // Reason: irreversible solutions (cancel, void round, re-settle, …) close the
  // incident so the same money move cannot be confirmed twice. Pause/resume stay
  // open so the operator can reverse them from the same record.
  const closesIncident =
    finalOutcome === "applied" && actionDef?.irreversible === true;
  const resolvedAt = new Date();
  const auditEntries = [
    {
      timestamp: resolvedAt,
      action: input.actionId,
      by: input.actor.id,
      byEmail: input.actor.email,
      details: `${finalOutcome}: ${detail}`,
    },
    ...(closesIncident
      ? [
          {
            timestamp: resolvedAt,
            action: "incident_resolved",
            by: input.actor.id,
            byEmail: input.actor.email,
            details: `Resolved by applying ${input.actionId}. ${detail}`,
          },
        ]
      : []),
  ];

  await Incident.updateOne(
    { _id: incident._id },
    {
      $push: {
        actionsTaken: {
          actionId: input.actionId,
          subjectType: loaded.subject.kind,
          subjectId: loaded.subject.id,
          reason: input.reason,
          outcome: finalOutcome,
          detail,
          by: input.actor.id,
          byEmail: input.actor.email,
          at: resolvedAt,
        },
        auditLog: { $each: auditEntries },
      },
      ...(closesIncident
        ? {
            $set: {
              status: "resolved",
              resolvedBy: input.actor.id,
              resolvedByEmail: input.actor.email,
              resolvedAt,
              resolution: {
                summary: input.reason,
                action: input.actionId,
                compensations: [],
                resultAdjustments: [],
                resolvedAt,
              },
            },
          }
        : {}),
    },
  );

  if (finalOutcome !== "applied") {
    return { ok: false, status: 400, error: detail };
  }
  return { ok: true, status: 200, detail, voidedRounds, closedPositions };
}
